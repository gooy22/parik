// Anonymous, read-only subscriptions from the provider's public web client.
// Account credentials and simulated bets never go to this connection.
export const FEED_URL = 'wss://24parik-bet.org/direct-feed/feed?brand=PRJ4&X-Api-Key=507aa81f-4c27-4e37-9410-21dfb81e9efe';
import { getLanguage } from './i18n.mjs';
const CONTEXT = { channel: 'MOBILE_WEB', brand: 'PRJ4', user: null, currency: 'UAH' };
const RECORD_END = '\x1e';
const canonical = value => JSON.stringify(value, (_, v) => v && !Array.isArray(v) && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v);

// Empty objects in feed deltas mean "unchanged", including inside positional arrays.
export function mergeDelta(previous, delta) {
  if (delta === null || typeof delta !== 'object') return delta;
  if (Array.isArray(delta)) return delta.map((item, i) => mergeDelta(previous?.[i], item)).filter(item => !item?.isRemoved);
  if (!Object.keys(delta).length) return previous;
  const result = { ...previous };
  for (const [key, value] of Object.entries(delta)) result[key] = mergeDelta(previous?.[key], value);
  return result;
}

export function applyBatch(map, batch) {
  if (batch.isInitialBatch) map.clear();
  for (const item of batch.data || []) {
    const id = typeof item.key === 'string' ? item.key : canonical(item.key);
    if (item.isRemoved) map.delete(id);
    else map.set(id, { key: item.key, value: mergeDelta(map.get(id)?.value, item.value) });
  }
  return map;
}

export const MARKET_NAMES = { 1: 'Переможець', 2: 'Результат матчу', 4: 'Фора', 5: 'Тотал', 6: 'Парний / непарний', 16: 'Точний рахунок', 260: 'Фора за картами', 264: 'Тотал карт' };
export function periodName(sport, period) {
  if (!period) return '';
  if (sport === 'CS') return `Карта ${period}`;
  if (sport === 'F') return `${period}-й тайм`;
  if (['T', 'TT', 'VB'].includes(sport)) return `Сет ${period}`;
  return `Період ${period}`;
}
export function marketSelections(row, event) {
  const { key, value } = row;
  if (!event || !MARKET_NAMES[key.marketType] || key.resultKind !== 1) return [];
  const marketName = [periodName(event.sport, key.period), MARKET_NAMES[key.marketType]].filter(Boolean).join(' · ');
  return (value.marketItems || []).filter(item => !item.isRemoved).flatMap(item => (item.outcomes || []).filter(outcome => !outcome.isRemoved).map(outcome => {
    const { type, values = [] } = outcome.key;
    const parameters = item.key.marketParameters || [];
    const names = event.competitors?.map(c => c.name) || [];
    let shortLabel, label;
    if (type === 0 || type === 3) { shortLabel = type === 0 ? 'П1' : 'П2'; label = names[type === 0 ? 0 : 1] || shortLabel; }
    else if (type === 1) { shortLabel = 'X'; label = 'Нічия'; }
    else if (type === 4 || type === 5) { shortLabel = `${type === 4 ? 'Б' : 'М'} ${parameters[0] || ''}`; label = `${type === 4 ? 'Більше' : 'Менше'} ${parameters[0] || ''}`; }
    else if (type === 86 || type === 87) {
      const handicap = Number(parameters[0]);
      if (!Number.isFinite(handicap)) return null;
      const number = type === 86 ? handicap : -handicap;
      shortLabel = `Ф${type === 86 ? 1 : 2} (${number > 0 ? '+' : ''}${number})`;
      label = `${names[type === 86 ? 0 : 1] || ''} ${shortLabel}`;
    } else if (type === 6 || type === 7) { shortLabel = type === 6 ? 'Парний' : 'Непарний'; label = shortLabel; }
    else if (type === 102 && values.length === 2) { shortLabel = values.join(':'); label = `Рахунок ${shortLabel}`; }
    else return null;
    return {
      id: encodeURIComponent(canonical([key, item.key, outcome.key])), eventId: String(key.eventId), eventName: event.name,
      tournament: event.tournamentName, marketName, label, shortLabel, odds: outcome.odd / 100,
      sport: event.sport, subsport: event.subsport, startTime: event.startTime,
      competitors: event.competitors, categoryName: event.categoryName,
      outcomeType: type, outcomeValues: values, resultKind: key.resultKind,
      frozen: !!outcome.isFrozen || event.tradingStatus !== 1 || event.status >= 3 || outcome.odd <= 100,
      stage: event.stage, marketType: key.marketType, period: key.period, parameters, version: outcome.version,
    };
  }).filter(Boolean));
}

export class LiveFeed {
  constructor({ onChange = () => {}, WebSocketImpl = WebSocket, url = FEED_URL } = {}) {
    this.onChange = onChange; this.WebSocket = WebSocketImpl; this.url = url;
    this.sport = 'CS'; this.stage = 'live'; this.range = {fromInHours:0,toInHours:24}; this.state = 'connecting'; this.error = '';
    try { if(localStorage.getItem('arena-default-stage')==='prematch')this.stage='prematch'; }catch{}
    this.events = new Map(); this.watched = new Map(); this.markets = new Map(); this.sports = new Map();
    this.selectedIds = []; this.subscriptions = new Map(); this.nextId = 0; this.failures = 0; this.stopped = false;
  }
  notify() { this.onChange(this); }
  connect() {
    if (this.socket && this.socket.readyState < 2) return;
    clearTimeout(this.retry); this.stopped = false; this.state = 'connecting'; this.ready = false;
    this.eventsReady = false; this.marketsReady = false; this.marketIds = ''; this.subscriptions.clear(); this.notify();
    const socket = this.socket = new this.WebSocket(this.url);
    let buffer = '';
    this.timeout = setTimeout(() => socket.close(), 20000);
    socket.onopen = () => socket.send(JSON.stringify({ protocol: 'json', version: 1 }) + RECORD_END);
    socket.onmessage = ({ data }) => {
      if (socket !== this.socket || typeof data !== 'string') return;
      this.lastMessage = Date.now(); buffer += data;
      const parts = buffer.split(RECORD_END); buffer = parts.pop();
      try { for (const part of parts) if (part) this.message(JSON.parse(part)); }
      catch { this.error = 'Не вдалося прочитати оновлення лінії'; socket.close(); }
    };
    socket.onerror = () => { this.error = 'Немає з’єднання з джерелом матчів'; };
    socket.onclose = () => {
      if (socket !== this.socket) return;
      clearTimeout(this.timeout); clearInterval(this.heartbeat);
      this.ready = false; this.state = 'offline'; this.notify();
      if (!this.stopped) this.retry = setTimeout(() => this.connect(), Math.min(30000, 1500 * 2 ** Math.min(this.failures++, 4)));
    };
  }
  send(message) { if (this.socket?.readyState === 1) this.socket.send(JSON.stringify(message) + RECORD_END); }
  message(message) {
    if (!this.ready && message.type === undefined) {
      if (message.error) { this.error = 'Джерело відхилило підключення'; this.stopped = true; this.socket.close(); return; }
      clearTimeout(this.timeout); this.ready = true; this.failures = 0; this.state = 'connected'; this.error = '';
      this.heartbeat = setInterval(() => {
        if (Date.now() - this.lastMessage > 45000) { this.socket.close(); return; }
        this.send({ type: 6 });
      }, 10000);
      this.subscribe('sports', 'GetSports', [], this.sports);
      this.subscribeEvents(); this.subscribeWatched(); this.notify(); return;
    }
    if (message.type === 7) { this.socket.close(); return; }
    const subscription = this.subscriptions.get(message.invocationId);
    if (!subscription) return;
    if (message.type === 3 && message.error) {
      this.error = 'Джерело тимчасово не віддає цей розділ'; this.state = 'error'; this.notify(); return;
    }
    if (message.type !== 2 || !message.item) return;
    applyBatch(subscription.map, message.item);
    if (subscription.name === 'events') { this.eventsReady = true; this.subscribeMarkets(); }
    if (subscription.name === 'markets') this.marketsReady = true;
    this.notify();
  }
  subscribe(name, target, args, map) {
    this.cancel(name);
    const id = String(++this.nextId);
    this.subscriptions.set(id, { name, map });
    this.send({ type: 4, invocationId: id, target, arguments: [...args, {...CONTEXT,language:getLanguage()}] });
  }
  cancel(name) {
    for (const [id, subscription] of this.subscriptions) if (subscription.name === name) {
      this.send({ type: 5, invocationId: id }); this.subscriptions.delete(id);
    }
  }
  subscribeEvents() {
    this.eventsReady = false;
    const target = this.stage === 'live' ? 'GetLiveRichEventsBySport' : 'GetRichEventsBySportAndTimeRange';
    const args = this.stage === 'live' ? [this.sport] : [this.sport, this.range];
    this.subscribe('events', target, args, this.events);
  }
  setView(sport, stage) {
    this.sport = sport; this.stage = stage; this.events.clear(); this.marketsReady = false; this.marketIds = '';
    if (this.ready) this.subscribeEvents();
    this.notify();
  }
  watch(ids) {
    const next = [...new Set(ids)].sort();
    if (JSON.stringify(next) === JSON.stringify(this.selectedIds)) return;
    this.selectedIds = next;
    if (this.ready) { this.subscribeWatched(); this.subscribeMarkets(); }
  }
  subscribeWatched() {
    this.watched.clear(); this.cancel('watched');
    if (this.selectedIds.length) this.subscribe('watched', 'GetRichEventsByIds', [this.selectedIds], this.watched);
  }
  subscribeMarkets() {
    const ids = [...new Set([...this.events.keys(), ...this.selectedIds])].sort();
    const signature = JSON.stringify(ids);
    if (this.marketIds === signature) return;
    this.marketIds = signature; this.marketsReady = false;
    if (ids.length) this.subscribe('markets', 'GetMarketsByEventIds', [ids, null], this.markets);
    else { this.cancel('markets'); this.markets.clear(); this.marketsReady = true; }
  }
  get fresh() { return this.ready && this.state === 'connected' && this.marketsReady && Date.now() - this.lastMessage < 45000; }
  event(id) { return this.events.get(String(id))?.value || this.watched.get(String(id))?.value; }
  selections(eventId) {
    const event = this.event(eventId);
    return [...this.markets.values()].filter(row => String(row.key.eventId) === String(eventId)).sort((a,b) => a.key.period - b.key.period || (a.value.sortOrder || 0) - (b.value.sortOrder || 0)).flatMap(row => marketSelections(row, event));
  }
  quote(id) {
    for (const row of this.markets.values()) {
      const result = marketSelections(row, this.event(row.key.eventId)).find(selection => selection.id === id);
      if (result) return result;
    }
    return null;
  }
  close() { this.stopped = true; clearTimeout(this.retry); clearTimeout(this.timeout); clearInterval(this.heartbeat); this.socket?.close(); }
}

export class ResultsService {
  constructor({ accounts, onChange = () => {}, fetchImpl = (...args) => fetch(...args) }) {
    Object.assign(this, { accounts, onChange, fetch:fetchImpl });
    this.results = new Map(); this.historyCache = new Map(); this.archiveCache = new Map();
    this.state = 'idle'; this.checkedAt = null;
  }
  start() {
    clearInterval(this.timer);
    this.check();
    this.timer = setInterval(() => { if (!document.hidden) this.check(); }, 30000);
    if (!this.listening) {
      document.addEventListener('visibilitychange', () => { if (!document.hidden) this.check(true); });
      window.addEventListener('online', () => this.check(true));
      this.listening = true;
    }
  }
  stop() { clearInterval(this.timer); }
  async json(url) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15000);
    let response;
    try { response = await this.fetch(url, { credentials:'same-origin', signal:controller.signal }); }
    finally { clearTimeout(timer); }
    if (!response.ok) throw new Error('Джерело результатів тимчасово недоступне');
    return response.json();
  }
  async history(event) {
    if (!event?.competitors?.length || !event.competitors[0].id) return [];
    const key = `${event.competitors[0].id}:${event.subsport || ''}`;
    const cached = this.historyCache.get(key);
    if (cached && Date.now() - cached.time < 60000) return cached.value;
    const ids = event.competitors.map(team => team.id).filter(Boolean).slice(0, 2);
    const lists = await Promise.all(ids.map(id => this.json(`/api/completed?competitor=${encodeURIComponent(id)}&subsport=${encodeURIComponent(event.subsport || '')}`)));
    const value = [...new Map(lists.flat().map(row => [String(row.id), row])).values()].sort((a,b) => Date.parse(b.startTime) - Date.parse(a.startTime));
    this.historyCache.set(key, { time:Date.now(), value });
    return value;
  }
  async archive(day, ids, force = false) {
    const key = `${day}:${[...ids].sort().join(',')}`, cached = this.archiveCache.get(key);
    if (!force && cached && Date.now() - cached.time < 30000) return;
    const rows = await this.json(`/api/results?date=${day}&ids=${encodeURIComponent([...ids].join(','))}`);
    if (!Array.isArray(rows)) throw new Error('Невідомий формат результатів');
    for (const row of rows) this.results.set(String(row.id), row);
    this.archiveCache.set(key, { time:Date.now() });
  }
  async loadEvent(selection, force = false) {
    const eventId = String(selection.eventId || selection.id);
    if (!force && this.results.has(eventId)) return this.results.get(eventId);
    const response = await this.fetch('/api/settlements', {method:'POST', credentials:'same-origin', headers:{'content-type':'application/json'},
      body:JSON.stringify({events:[{eventId,eventName:selection.eventName || selection.name,startTime:selection.startTime,
        categoryName:selection.categoryName,subsport:selection.subsport,competitors:selection.competitors?.map(t => ({name:t.name}))}]}),signal:AbortSignal.timeout(60000)});
    if (!response.ok) throw new Error('Results unavailable');
    const data = await response.json();
    for (const row of data.results || []) this.results.set(String(row.id),row);
    return this.results.get(eventId);
  }
  async check(force = false) {
    if (this.checking) return;
    const account = this.accounts.current();
    const bets = account?.bets.filter(bet => bet.status === 'open') || [];
    if (!bets.length) return;
    this.checking = true; this.state = 'checking';
    const events = [...new Map(bets.flatMap(bet => bet.selections).filter(s => !s.settlement).map(s => [String(s.eventId), {
      eventId:s.eventId, eventName:s.eventName, startTime:s.startTime,
      sport:s.sport, subsport:s.subsport, categoryName:s.categoryName,
      competitors:s.competitors?.map(t => ({name:typeof t === 'string' ? t : t.name})),
    }])).values()];
    let failed = false;
    try {
      for (let i=0; i<events.length; i+=10) {
        const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 60000);
        try {
          const response = await this.fetch('/api/settlements', {method:'POST', credentials:'same-origin',
            headers:{'content-type':'application/json'}, body:JSON.stringify({events:events.slice(i,i+10)}), signal:controller.signal});
          if (!response.ok) throw new Error('Results unavailable');
          const data = await response.json();
          if (!Array.isArray(data.results)) throw new Error('Invalid results');
          for (const row of data.results) this.results.set(String(row.id),row);
          failed ||= !!data.unavailable?.length;
        } finally { clearTimeout(timer); }
      }
      const save = () => this.accounts.settleBets(this.results);
      const result = navigator.locks ? await navigator.locks.request('arena-account-balance', save) : save();
      this.checkedAt = new Date().toISOString(); this.state = failed ? 'unavailable' : 'ready';
      if (result.changed) this.onChange(result);
    } catch { this.state = 'unavailable'; }
    finally { this.checking = false; }
  }
}

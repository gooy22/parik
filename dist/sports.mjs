import { LiveFeed } from './feed.mjs';
import { cents, money, betTotals } from './account.mjs';
import { icon, graphic } from './ui.mjs';
import { ResultsService } from './results.mjs';
import { eventHeader, eventPage } from './event-view.mjs';
import { teamEmblem } from './team-emblem.mjs';
import { timeWindow } from './match-filter.mjs';

const $ = selector => document.querySelector(selector);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icons = () => window.lucide?.createIcons();
const compactMoney = value => new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 }).format(value / 100);
const SPORTS = [['F','football','Футбол'],['T','tennis','Теніс'],['TT','table-tennis','Настільний теніс'],['H','hockey','Хокей'],['CS','esports','Кіберспорт'],['B','basketball','Баскетбол'],['PL','snooker','Снукер'],['VB','volleyball','Волейбол']];
const NAMES = { single: 'Ординар', express: 'Експрес', system: 'Система' };
const TOTALS = { CS: [1006,1], F:[1,4], T:[1009,1], TT:[1009,1], H:[1,5], B:[1010,8], VB:[1009,1], PL:[1001,1] };

export class SportsApp {
  constructor({ accounts, getAccount, openAuth, openProfile, openMenu, openBets, onBalanceChange, showToast }) {
    Object.assign(this, { accounts, getAccount, openAuth, openProfile, openMenu, openBets, onBalanceChange, showToast });
    this.selections = []; this.type = 'single'; this.systemSize = 2; this.draftId = crypto.randomUUID();
    this.expanded = new Set(); this.collapsed = new Set(); this.market = 'winner'; this.tournament = ''; this.search = '';
    this.favorites = new Set(); this.page = 'sport'; this.onlyFavorites = false;
    this.receipt = null; this.timeFilter = '24'; this.prematchTab = 'main';
    this.lastOdds = new Map(); this.oddsMoves = new Map();
    this.detailId = null; this.detailOdds = new Map(); this.detailCollapsed = new Set();
    this.desktop = window.matchMedia('(min-width: 1024px)');
    this.desktop.addEventListener('change', () => this.resizeSlip(true));
    try { this.favorites = new Set(JSON.parse(localStorage.getItem('arena-favorites-v1') || '[]')); } catch { /* A missing preference does not block the line. */ }
    this.feed = new LiveFeed({ onChange: () => this.scheduleRender() });
    this.results = new ResultsService({ accounts, onChange: result => {
      this.onBalanceChange(); this.watchSelections(); this.renderLine();
      if (result.settled.length && localStorage.getItem('arena-settlement-notifications') !== 'off') this.showToast('Ставку розраховано. Виплата та історія оновлені.');
    } });
    document.addEventListener('click', event => {
      const control = event.target.closest('[data-action^="sports-"]');
      if (control) this.click(control.dataset.action, control.dataset.value);
    });
    $('#search-query').addEventListener('input', event => { this.search = event.target.value.trim().toLowerCase(); this.renderLine(); });
    $('#market-filter').addEventListener('change', event => { this.market = event.target.value; this.renderLine(); });
    document.addEventListener('change', event => {
      if(event.target.id !== 'match-time-filter')return;
      this.timeFilter = event.target.value; this.feed.range = timeWindow(this.timeFilter).range;
      this.tournament = ''; this.feed.setView(this.feed.sport,this.feed.stage); this.renderLine();
    });
    $('#stake').addEventListener('input', () => { $('#bet-error').textContent = ''; this.renderSlipState(); });
    $('#system-size').addEventListener('change', event => { this.systemSize = Number(event.target.value); this.newDraft(); this.renderSlip(); });
    $('#bet-form').addEventListener('submit', event => { event.preventDefault(); this.place(); });
    $('#betslip').addEventListener('click', event => {
      if (event.target !== $('#betslip')) return;
      const box = $('#betslip').getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) $('#betslip').close();
    });
    document.addEventListener('visibilitychange', () => { if (!document.hidden && !this.feed.fresh && this.feed.socket?.readyState !== 0) { this.feed.close(); this.feed.connect(); } });
    window.addEventListener('online', () => { this.feed.connect(); });
    window.addEventListener('pagehide', () => { this.feed.close(); this.results.stop(); });
    window.addEventListener('pageshow', event => { if (event.persisted) { this.feed.connect(); this.results.start(); } });
    this.updateAccount(this.getAccount()); this.renderTabs(); this.renderSlip(); this.resizeSlip(); this.watchSelections(); this.feed.connect(); this.results.start();
  }
  scheduleRender() {
    if (this.renderTimer) return;
    this.renderTimer = setTimeout(() => { this.renderTimer = null; this.renderLine(); this.renderSlip(); }, 120);
  }
  setHtml(selector, html) { const element = $(selector); if (element._content !== html) { element.innerHTML = html; element._content = html; } }
  updateAccount(account) {
    this.account = account;
    this.setHtml('#header-auth', account
      ? `<button class="header-wallet" data-action="profile" aria-label="Профіль і баланс">${icon('profile-solid')}<span>${compactMoney(account.balance)} <small>€</small></span></button><button class="header-icon header-notifications" data-action="notifications" aria-label="Сповіщення">${icon('bell')}</button><button class="header-topup" data-action="deposit">Поповнити</button>`
      : '<button class="login-button" data-action="login">Увійти</button><button class="register-button" data-action="register">Реєстрація</button>');
    this.renderNav(); this.renderSlipState(); icons();
    this.watchSelections(); this.results?.check();
  }
  renderNav() {
    const items = [['house','Головна','sports-home','home'],['sports-score','Спорт','sports-home','sport'],['ticket','Мої ставки','sports-bets','bets'],['casino-wheel','Казино','sports-page','casino'],['profile-solid',this.account ? `${compactMoney(this.account.balance)} €` : 'Профіль','profile','profile'],['menu','Меню','sports-page','menu']];
    this.setHtml('#sports-nav', items.map(([name,label,action,value]) => `<button class="${this.page === value || value === 'profile' && this.account ? 'active' : ''}" data-action="${action}" data-value="${value}">${icon(name)}<span>${escape(label)}</span></button>`).join(''));
  }
  renderTabs() {
    this.setHtml('#sport-tabs', `<button class="${this.onlyFavorites ? 'active' : ''}" data-action="sports-favorites"><span class="sport-symbol">${graphic('favorite')}</span><span>Вибране</span></button>${SPORTS.map(([id,symbol,name]) => `<button class="${!this.onlyFavorites && this.feed.sport === id ? 'active' : ''}" data-action="sports-sport" data-value="${id}"><span class="sport-symbol" aria-hidden="true">${graphic(symbol)}</span><span>${name}</span></button>`).join('')}`);
    document.querySelectorAll('[data-action="sports-stage"]').forEach(button => button.classList.toggle('active', button.dataset.value === this.feed.stage)); icons();
    const strip = $('#sport-tabs'), selected = strip.querySelector('.active');
    if (selected && strip.clientWidth) strip.scrollLeft = Math.max(0, selected.offsetLeft - strip.offsetLeft - (strip.clientWidth - selected.offsetWidth) / 2);
  }
  gameBadge(event) {
    const games = { 'Counter-Strike': 'counter-strike', 'Dota 2': 'dota', 'League of Legends': 'lol' };
    const name = games[event.categoryName] || SPORTS.find(s => s[0] === event.sport)?.[1] || 'esports';
    return `<span class="game-badge">${graphic(name)}</span>`;
  }
  eventRows() {
    const source = this.onlyFavorites ? new Map([...this.feed.events, ...this.feed.watched]) : this.feed.events;
    const window = timeWindow(this.timeFilter), byTournament = localStorage.getItem('arena-match-sort') === 'tournament';
    return [...source].map(([id, row]) => ({ id, ...row.value })).filter(event => (!this.onlyFavorites || this.favorites.has(event.id)) && (this.feed.stage === 'live' ? event.stage === 2 : event.stage === 1 && event.startTime*1000 >= window.from && event.startTime*1000 < window.to)).sort((a,b) => (byTournament ? String(a.tournamentName).localeCompare(String(b.tournamentName)) : 0) || a.startTime-b.startTime || a.id.localeCompare(b.id));
  }
  renderLine() {
    if (this.detailId) { this.renderEvent(); return; }
    const all = this.eventRows();
    $('#prematch-filters').hidden = this.feed.stage === 'live';
    this.setHtml('#prematch-filters', `<div class="prematch-view-tabs">${[['main','Головне'],['events','Події'],['tournaments','Турніри']].map(([value,label]) => `<button data-action="sports-prematch-tab" data-value="${value}" class="${this.prematchTab === value ? 'active' : ''}">${label}</button>`).join('')}</div><select id="match-time-filter" aria-label="Час матчів">${[['1','1 H'],['3','3 H'],['12','12 H'],['24','24 H'],['today','Сьогодні'],['tomorrow','Завтра'],['weekend','Вихідні'],['soon','Скоро']].map(([value,label])=>`<option value="${value}" ${this.timeFilter===value?'selected':''}>${label}</option>`).join('')}</select>`);
    const tournaments = [...new Map(all.map(event => [event.tournamentId, event])).values()];
    this.setHtml('#tournament-tabs', tournaments.map(event => `<button class="${this.tournament === event.tournamentId ? 'active' : ''}" data-action="sports-tournament" data-value="${escape(event.tournamentId)}"><span class="tournament-symbol">${this.gameBadge(event)}</span><span class="tournament-name">${escape(event.tournamentName)}</span></button>`).join(''));
    const events = all.filter(event => (!this.tournament || event.tournamentId === this.tournament) && (!this.search || `${event.name} ${event.tournamentName} ${event.categoryName}`.toLowerCase().includes(this.search)));
    $('#match-count').textContent = this.feed.eventsReady ? events.length : '...';
    const notice = $('#line-notice');
    notice.hidden = this.feed.state === 'connected' || (this.feed.state === 'connecting' && !this.feed.events.size);
    notice.innerHTML = `${icon('wifi-off')}<span>${this.feed.state === 'connecting' ? 'Відновлюємо з’єднання' : this.feed.error || 'З’єднання перервано. Відновлюємо лінію…'}</span>`;
    if (!this.feed.eventsReady && !events.length) {
      this.setHtml('#event-list', `<div class="line-loading"><span class="spinner"></span>${this.feed.state === 'error' || this.feed.state === 'offline' ? 'Матчі тимчасово недоступні' : 'Завантаження матчів'}</div>`); icons(); return;
    }
    if (!events.length) {
      this.setHtml('#event-list', `<div class="line-empty">${icon(this.onlyFavorites ? 'star' : 'calendar-clock')}<h2>${this.search ? 'Матчів не знайдено' : this.onlyFavorites ? 'Вибраних матчів поки немає' : 'У цьому розділі зараз немає матчів'}</h2>${!this.search && !this.onlyFavorites ? '<button data-action="sports-stage" data-value="prematch">Переглянути прематч</button>' : ''}</div>`); icons(); return;
    }
    const groups = new Map();
    for (const event of events) { if (!groups.has(event.tournamentId)) groups.set(event.tournamentId, []); groups.get(event.tournamentId).push(event); }
    if(this.feed.stage === 'prematch' && this.prematchTab === 'tournaments' && !this.tournament) {
      this.setHtml('#event-list', `<div class="tournament-directory">${[...groups].map(([id,entries])=>`<button data-action="sports-tournament" data-value="${escape(id)}">${this.gameBadge(entries[0])}<span>${escape(entries[0].tournamentName)}</span><small>${entries.length}</small>${icon('chevron-right')}</button>`).join('')}</div>`); return;
    }
    if(this.feed.stage === 'prematch' && this.prematchTab === 'events') { this.setHtml('#event-list',events.map(event=>this.card(event)).join('')); return; }
    this.setHtml('#event-list', [...groups].map(([id, entries]) => `<section class="tournament-group"><button class="tournament-heading" data-action="sports-collapse-group" data-value="${escape(id)}">${this.gameBadge(entries[0])}<span>${escape(SPORTS.find(s => s[0] === entries[0].sport)?.[2])}. ${escape(entries[0].categoryName)}. ${escape(entries[0].tournamentName)}</span>${icon(this.collapsed.has(id) ? 'chevron-down' : 'chevron-up')}</button>${this.collapsed.has(id) ? '' : entries.map(event => this.card(event)).join('')}</section>`).join(''));
    icons();
  }
  status(event) {
    if (event.stage === 1) return new Date(event.startTime * 1000).toLocaleString('uk-UA', { day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit' });
    if (event.status === 2) return `${event.regulation ? `${event.regulation}, ` : ''}ПЕРЕРВА`;
    const periods = (event.scoreboard?.scores || []).filter(score => score.periodScoreType === 1007);
    const current = periods.length ? Math.max(...periods.map(score => score.period)) - 1 : 0;
    return [event.regulation, event.sport === 'CS' && current ? `К${current}` : 'ЛАЙВ'].filter(Boolean).join(', ');
  }
  card(event) {
    const picks = this.feed.selections(event.id);
    const mainTypes = this.market === 'winner' ? [1,2] : this.market === 'total' ? [5,264] : [4,260];
    const primary = picks.filter(pick => mainTypes.includes(pick.marketType) && pick.period === 0);
    const first = primary[0];
    const choices = first ? primary.filter(pick => pick.marketType === first.marketType && JSON.stringify(pick.parameters) === JSON.stringify(first.parameters)) : [];
    const scores = event.scoreboard?.scores || [], [scoreType, period] = TOTALS[event.sport] || [];
    const total = scores.find(score => score.periodScoreType === scoreType && score.period === period)?.score?.split('-') || [];
    const current = event.sport === 'CS' ? scores.filter(score => score.periodScoreType === 1007).at(-1)?.score?.split('-') || [] : [];
    const teams = (event.competitors || []).map((team, index) => `<div class="team-row"><span class="team-mark" aria-hidden="true">${teamEmblem(team,event.sport)}</span><span class="team-name">${escape(team.name)}</span>${event.stage === 2 ? `<span class="current-score">${escape(current[index])}</span><strong class="match-score">${escape(total[index] ?? '')}</strong>` : ''}</div>`).join('');
    return `<article class="match-card" data-event-id="${escape(event.id)}"><div class="match-meta"><span class="${event.stage === 2 ? 'live-text' : ''}">${escape(this.status(event))}</span>${event.stage === 2 ? icon('chart-no-axes-column-increasing') : ''}<button data-action="sports-expand" data-value="${escape(event.id)}" aria-label="Ринки матчу">+${picks.length} ${icon(this.expanded.has(event.id) ? 'chevron-up' : 'chevron-right')}</button></div><div class="teams"><button class="teams-open" data-action="sports-expand" data-value="${escape(event.id)}">${teams}</button><button class="favorite ${this.favorites.has(event.id) ? 'selected' : ''}" data-action="sports-favorite" data-value="${escape(event.id)}" aria-label="${this.favorites.has(event.id) ? 'Прибрати з вибраного' : 'Додати до вибраного'}" title="Вибране" aria-pressed="${this.favorites.has(event.id)}">${icon('star')}</button></div>${choices.length ? `<div class="outcomes">${choices.map(pick => this.oddButton(pick)).join('')}</div>` : `<button class="more-outcomes" data-action="sports-expand" data-value="${escape(event.id)}">${picks.length ? `${picks.length} доступних результатів` : this.feed.marketsReady ? 'Ринки призупинено' : 'Завантаження коефіцієнтів…'}</button>`}${this.expanded.has(event.id) ? this.allMarkets(picks) : ''}</article>`;
  }
  oddButton(pick) {
    const selected = this.selections.some(selection => selection.id === pick.id);
    const disabled = !this.feed.fresh || pick.frozen;
    const previous = this.lastOdds.get(pick.id);
    if (previous !== undefined && previous !== pick.odds) this.oddsMoves.set(pick.id, { direction: pick.odds > previous ? 'up' : 'down', until: Date.now() + 4000 });
    this.lastOdds.set(pick.id, pick.odds);
    const move = this.oddsMoves.get(pick.id);
    const direction = move?.until > Date.now() ? `price-${move.direction}` : '';
    return `<button class="odd ${selected ? 'selected' : ''} ${direction}" data-action="sports-pick" data-value="${escape(pick.id)}" ${disabled ? 'disabled' : ''} aria-pressed="${selected}" aria-label="${escape(pick.label)}, ${pick.odds.toFixed(2)}"><strong>${pick.odds.toFixed(2)}</strong><span>${escape(pick.shortLabel)}</span></button>`;
  }
  allMarkets(picks) {
    const groups = new Map();
    for (const pick of picks) { const key = `${pick.marketName}:${JSON.stringify(pick.parameters)}`; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(pick); }
    return `<div class="expanded-markets">${[...groups.values()].map(group => `<div class="market-group"><h3>${escape(group[0].marketName)}</h3><div class="outcomes">${group.map(pick => this.oddButton(pick)).join('')}</div></div>`).join('')}</div>`;
  }
  newDraft() { this.draftId = crypto.randomUUID(); }
  watchSelections() {
    const open = this.getAccount()?.bets.filter(bet => bet.status === 'open').flatMap(bet => bet.selections.map(selection => selection.eventId)) || [];
    this.feed.watch([...this.selections.map(selection => selection.eventId), ...open, ...this.favorites, ...(this.detailId ? [this.detailId] : [])]);
  }
  openEvent(id, saved = {}) {
    this.detailId = String(id); this.detailTab = 'overview'; this.detailFilter = 'main';
    this.detailCollapsed.clear(); this.detailOdds.clear(); this.detailHistory = []; this.detailHistoryState = 'loading';
    const live = this.feed.event(id);
    this.detailSnapshot = { id:String(id), name:saved.eventName || saved.name || '', sport:saved.sport || 'CS',
      categoryName:saved.categoryName, tournamentName:saved.tournament || saved.tournamentName,
      startTime:saved.startTime, date:saved.date, competitors:saved.competitors || (saved.eventName || '').split(' - ').filter(Boolean).map(name => ({ name })),
      ...live };
    this.page = 'sport';
    $('.sports-shell').classList.add('event-open'); $('#event-header').hidden = false;
    $('#line-container').hidden = true; $('#sports-extra').hidden = false;
    $('#sports-scroll').scrollTop = 0;
    history.replaceState(null, '', `#event/${encodeURIComponent(id)}`);
    this.watchSelections(); this.renderEvent(); this.renderNav(); this.loadEventData();
  }
  async loadEventData() {
    const id = this.detailId;
    if (!id) return;
    const event = this.feed.event(id) || this.detailSnapshot;
    this.detailHistoryState = 'loading';
    const historyTask = this.results.history(event).then(rows => {
      if (this.detailId !== id) return;
      this.detailHistory = rows; this.detailHistoryState = 'ready'; this.renderEvent();
    }).catch(() => { if (this.detailId === id) { this.detailHistoryState = 'error'; this.renderEvent(); } });
    const resultTask = this.results.loadEvent({ ...event, eventId:id }).then(result => {
      if (this.detailId !== id || !result) return;
      this.detailSnapshot = { ...this.detailSnapshot, name:result.name, categoryName:result.categoryName, tournamentName:result.tournamentName,
        startTime:Date.parse(result.startTime)/1000, competitors:event.competitors?.length ? event.competitors : result.competitors.map(name => ({name})) };
      this.renderEvent(); this.results.check();
    }).catch(() => { /* A missing result never means that a match is complete. */ });
    await Promise.all([historyTask,resultTask]);
  }
  renderEvent() {
    if (!this.detailId) return;
    const live = this.feed.event(this.detailId);
    if (live) {
      const hadTeams = this.detailSnapshot.competitors?.some(team => team.id);
      this.detailSnapshot = { ...this.detailSnapshot, ...live };
      if (!hadTeams && live.competitors?.some(team => team.id)) this.loadEventData();
    }
    this.setHtml('#event-header', eventHeader(this, this.detailSnapshot));
    this.setHtml('#sports-extra', eventPage(this, this.detailSnapshot)); icons();
  }
  closeEvent() {
    this.detailId = null; $('.sports-shell').classList.remove('event-open'); $('#event-header').hidden = true;
    $('#line-container').hidden = false; $('#sports-extra').hidden = true;
    history.replaceState(null, '', location.pathname + location.search);
    this.watchSelections(); this.renderLine();
  }
  repeatBet(bet) {
    this.feed.watch([...this.feed.selectedIds, ...bet.selections.map(selection => selection.eventId)]);
    const quotes = bet.selections.map(selection => this.feed.quote(selection.id));
    if (!this.feed.fresh || quotes.some(quote => !quote || quote.frozen)) {
      this.showToast('Ці результати вже недоступні. Оберіть актуальний коефіцієнт у матчі.');
      this.openEvent(bet.selections[0].eventId, { ...bet.selections[0], date:bet.date }); return;
    }
    this.selections = quotes.map(quote => ({...quote})); this.type = bet.type; this.systemSize = bet.systemSize;
    this.receipt = null; $('#stake').value = (bet.stake/100).toFixed(2); this.newDraft(); this.watchSelections(); this.openSlip();
  }
  async click(action, value) {
    if (action === 'sports-pick') {
      const quote = this.feed.quote(value);
      if (!quote || quote.frozen || !this.feed.fresh) { this.showToast('Коефіцієнт тимчасово недоступний'); return; }
      const existing = this.selections.some(selection => selection.id === value);
      this.receipt = null; $('#bet-error').textContent = '';
      if (existing) this.selections = this.selections.filter(selection => selection.id !== value);
      else {
        if (this.selections.length >= 10) { this.showToast('Максимум 10 результатів у купоні'); return; }
        this.selections = this.selections.filter(selection => selection.eventId !== quote.eventId);
        this.selections.push({ ...quote });
      }
      this.type = this.selections.length > 1 ? 'express' : 'single'; this.newDraft(); this.watchSelections(); this.renderLine(); this.renderSlip();
      if (this.selections.length) this.openSlip();
    } else if (action === 'sports-slip') this.openSlip();
    else if (action === 'sports-collapse' && !this.desktop.matches) $('#betslip').close();
    else if (action === 'sports-remove') {
      this.selections = this.selections.filter(selection => selection.id !== value); if (this.selections.length < 2) this.type = 'single';
      this.newDraft(); this.watchSelections(); this.renderLine(); this.renderSlip();
    } else if (action === 'sports-type') {
      this.type = value; this.newDraft(); $('#bet-error').textContent = ''; this.renderSlip();
    } else if (action === 'sports-stake') {
      let amount = value;
      if (value === 'all') {
        try { amount = (Math.floor((this.account?.balance || 0) / betTotals(2000,this.selections,this.type,this.systemSize).combinations) / 100).toFixed(2); }
        catch { amount = 0; }
      }
      $('#stake').value = amount; $('#bet-error').textContent = ''; this.renderSlipState();
    } else if (action === 'sports-expand') this.openEvent(value);
    else if (action === 'sports-event-back') this.closeEvent();
    else if (action === 'sports-event-tab') { this.detailTab = value; this.renderEvent(); }
    else if (action === 'sports-event-filter') { this.detailFilter = value; this.renderEvent(); }
    else if (action === 'sports-event-market') { this.detailCollapsed.has(value) ? this.detailCollapsed.delete(value) : this.detailCollapsed.add(value); this.renderEvent(); }
    else if (action === 'sports-event-retry') this.loadEventData();
    else if (action === 'sports-event-alert') this.showToast('Розрахунок ваших ставок перевіряється автоматично, поки сайт відкритий.');
    else if (action === 'sports-collapse-group') { this.collapsed.has(value) ? this.collapsed.delete(value) : this.collapsed.add(value); this.renderLine(); }
    else if (action === 'sports-favorite') {
      this.favorites.has(value) ? this.favorites.delete(value) : this.favorites.add(value);
      try { localStorage.setItem('arena-favorites-v1', JSON.stringify([...this.favorites])); } catch { /* Preference storage is optional. */ }
      this.watchSelections(); this.renderLine();
    } else if (action === 'sports-favorites') { this.onlyFavorites = !this.onlyFavorites; this.tournament = ''; this.renderTabs(); this.renderLine(); }
    else if (action === 'sports-tournament') { this.tournament = this.tournament === value ? '' : value; this.renderLine(); }
    else if (action === 'sports-prematch-tab') { this.prematchTab = value; this.tournament = ''; this.renderLine(); }
    else if (action === 'sports-search') { $('#line-search').hidden = !$('#line-search').hidden; if (!$('#line-search').hidden) $('#search-query').focus(); }
    else if (action === 'sports-sport') {
      this.onlyFavorites = false; this.tournament = ''; this.feed.setView(value, this.feed.stage); this.renderTabs();
    } else if (action === 'sports-stage') {
      this.tournament = ''; this.feed.setView(this.feed.sport, value === 'lobby' ? 'live' : value); this.renderTabs();
    } else if (action === 'sports-home') {
      this.closeEvent();
      this.page = 'sport'; $('#line-container').hidden = false; $('#sports-extra').hidden = true; this.renderNav(); icons();
    } else if (action === 'sports-page') {
      if (value === 'menu') { this.openMenu(); return; }
      this.closeEvent();
      this.page = value; $('#line-container').hidden = true; $('#sports-extra').hidden = false;
      $('#sports-extra').innerHTML = `<div class="line-empty">${icon(value === 'bonus' ? 'gift' : 'circle-dot')}<h2>${value === 'bonus' ? 'Активних бонусів немає' : 'Казино'}</h2><p>${value === 'bonus' ? 'Бонуси для цього профілю не нараховані.' : 'У цьому профілі доступні віртуальні ставки на спорт.'}</p><button data-action="sports-home">До спорту</button></div>`;
      this.renderNav(); icons();
    } else if (action === 'sports-bets') { $('#betslip').close(); this.openBets(); }
  }
  resizeSlip(changed = false) {
    const slip = $('#betslip');
    if (changed && slip.open) slip.close();
    if (this.desktop.matches && $('#profile-layer').hidden && !slip.open) slip.show();
  }
  openSlip() {
    this.renderSlip();
    if (!$('#betslip').open) this.desktop.matches ? $('#betslip').show() : $('#betslip').showModal();
  }
  receiptHtml() {
    const bet = this.receipt;
    return `<div class="bet-success">${icon('circle-check')}<h2>Ставку прийнято</h2><p>${escape(bet.selections.map(selection => selection.eventName).join(' · '))}</p><dl><div><dt>Сума купону</dt><dd>${money(bet.cost)} €</dd></div><div><dt>Можливий виграш</dt><dd>${money(bet.potential)} €</dd></div><div><dt>Баланс</dt><dd>${money(this.account?.balance || 0)} €</dd></div></dl><button class="place-bet" data-action="sports-bets">Мої ставки</button></div>`;
  }
  renderSlip() {
    const selected = this.selections.length;
    $('#slip-mini').hidden = !selected || !$('#profile-layer').hidden;
    const combined = this.selections.reduce((total, pick) => total * (this.feed.quote(pick.id)?.odds || pick.odds), 1);
    $('#slip-mini-label').textContent = `${NAMES[this.type]} — ${selected === 1 || this.type === 'express' ? combined.toFixed(2) : `${selected} результати`}`;
    $('#coupon-count').hidden = !selected; $('#coupon-count').textContent = selected;
    document.querySelectorAll('[data-action="sports-type"]').forEach(button => {
      button.classList.toggle('active', button.dataset.value === this.type);
      button.setAttribute('aria-pressed', String(button.dataset.value === this.type));
    });
    $('#system-settings').hidden = this.type !== 'system';
    if (selected > 2) {
      if (this.systemSize >= selected) this.systemSize = 2;
      this.setHtml('#system-size', Array.from({length:selected-2}, (_,i) => `<option value="${i+2}" ${i+2 === this.systemSize ? 'selected' : ''}>${i+2} з ${selected}</option>`).join(''));
    } else this.setHtml('#system-size','');
    this.setHtml('#slip-lines', selected ? this.selections.map(selection => {
      const quote = this.feed.quote(selection.id), unavailable = !quote || quote.frozen || !this.feed.fresh;
      const changed = quote && quote.odds !== selection.odds;
      return `<div class="slip-selection ${unavailable ? 'unavailable' : ''}"><div class="slip-event"><span class="stage-pill ${selection.stage === 2 ? 'live-text' : ''}">${selection.stage === 2 ? 'Лайв' : 'Прематч'}</span><span>${escape(selection.eventName)}</span><button class="icon-button" type="button" data-action="sports-remove" data-value="${escape(selection.id)}" aria-label="Прибрати результат" title="Прибрати результат">${icon('x')}</button></div><div class="slip-outcome"><div><div class="meta">${escape(selection.marketName)}</div><strong>${escape(selection.label)}</strong></div><strong class="slip-odd ${changed ? 'changed' : ''}">${unavailable ? icon('lock-keyhole') : quote.odds.toFixed(2)}</strong></div>${changed ? `<p class="odds-change">Коефіцієнт змінився: ${selection.odds.toFixed(2)} → ${quote.odds.toFixed(2)}</p>` : ''}${unavailable ? '<p class="market-unavailable">Прийом ставок на цей результат призупинено</p>' : ''}</div>`;
    }).join('') : this.receipt ? this.receiptHtml() : `<div class="line-empty">${icon('ticket')}<h2>Твій купон порожній</h2><p>Клікни на коефіцієнт, щоб додати ставку до купону</p></div>`);
    $('#bet-form').hidden = !selected; this.renderSlipState(); icons();
  }
  renderSlipState() {
    $('#slip-balance').textContent = this.account ? `${money(this.account.balance)} €` : '—';
    let totals, error = '';
    const quotes = this.selections.map(selection => this.feed.quote(selection.id));
    try { totals = betTotals(cents($('#stake').value), this.selections.map((selection,i) => quotes[i] || selection), this.type, this.systemSize); }
    catch (problem) { error = problem.message; }
    $('#slip-cost').textContent = totals ? `${money(totals.cost)} €` : '—';
    $('#slip-potential').textContent = totals ? `${money(totals.potential)} €` : '—';
    const unavailable = !this.feed.fresh || quotes.some(quote => !quote || quote.frozen);
    const changed = quotes.some((quote, i) => quote && quote.odds !== this.selections[i].odds);
    const button = $('#place-bet');
    button.disabled = this.placing || !!this.account && unavailable;
    button.textContent = this.placing ? 'Оформлюємо…' : !this.account ? 'Увійти' : unavailable ? 'Коефіцієнти недоступні' : changed ? 'Прийняти зміни коефіцієнтів' : 'Зробити ставку';
    button.title = error || '';
  }
  async place() {
    if (this.placing || !this.selections.length) return;
    if (!this.getAccount()) { $('#betslip').close(); this.openAuth(false, false, () => this.openSlip()); return; }
    const error = $('#bet-error'); error.textContent = '';
    const quotes = this.selections.map(selection => this.feed.quote(selection.id));
    if (!this.feed.fresh || quotes.some(quote => !quote || quote.frozen)) { error.textContent = 'Оновлення лінії недоступні. Дочекайтеся актуального коефіцієнта.'; this.renderSlipState(); return; }
    if (quotes.some((quote,i) => quote.odds !== this.selections[i].odds)) { this.selections = quotes.map(quote => ({...quote})); this.newDraft(); this.renderSlip(); error.textContent = 'Коефіцієнти оновлено. Підтвердьте ставку.'; return; }
    this.placing = true; this.renderSlipState();
    try {
      const save = () => {
        const current = this.selections.map(selection => this.feed.quote(selection.id));
        if (!this.feed.fresh || current.some((quote,i) => !quote || quote.frozen || quote.odds !== this.selections[i].odds)) throw new Error('Коэффициент изменился. Проверьте купон ещё раз.');
        return this.accounts.placeBet({id:this.draftId,stake:cents($('#stake').value),selections:current,type:this.type,systemSize:this.systemSize});
      };
      const bet = navigator.locks ? await navigator.locks.request('arena-account-balance', save) : save();
      this.receipt = bet; this.selections = []; this.type = 'single'; this.newDraft(); this.watchSelections(); this.onBalanceChange(); this.renderLine(); this.renderSlip();
    } catch (problem) { error.textContent = problem.message; }
    finally { this.placing = false; this.renderSlipState(); }
  }
}

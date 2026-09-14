// Independent public results. Never send account, balance or stake data upstream.
const independentCache = new Map();
const providerCooldown = new Map();
const normalizedName = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const aliases = team => [team?.name, ...(team?.team_clans || []).map(c => c.clan_name)].map(normalizedName).filter(Boolean);
const eventTeams = event => (event.competitors?.length === 2 ? event.competitors.map(t => typeof t === 'string' ? t : t.name) : String(event.eventName || event.name || '').split(/\s+[-–—]\s+/)).map(normalizedName);
const eventTime = event => typeof event.startTime === 'number' ? event.startTime * 1000 : Date.parse(event.startTime);
function orientation(event, teams, start) {
  const names = eventTeams(event);
  if (names.length !== 2 || !names.every(Boolean) || Math.abs(eventTime(event) - Date.parse(start)) > 2 * 3600000) return -1;
  if (!Number.isFinite(eventTime(event))) return -1;
  const sets = teams.map(aliases);
  const direct = sets[0].includes(names[0]) && sets[1].includes(names[1]);
  const reverse = sets[1].includes(names[0]) && sets[0].includes(names[1]);
  return direct === reverse ? -1 : direct ? 0 : 1;
}
async function independentJSON(url) {
  const origin = new URL(url).origin;
  if ((providerCooldown.get(origin) || 0) > Date.now()) throw new Error('Provider rate limit; retry later');
  const old = independentCache.get(url);
  if (old && Date.now() - old.time < 60000) return old.task;
  const task = (async () => {
    const response = await fetch(url, { signal:AbortSignal.timeout(20000) });
    if (response.status === 429) {
      const retry = response.headers.get('retry-after');
      const delay = /^\d+$/.test(retry || '') ? Number(retry)*1000 : Date.parse(retry || '')-Date.now();
      providerCooldown.set(origin,Date.now()+Math.max(300000,Number.isFinite(delay)?delay:0));
    }
    if (!response.ok) throw new Error(`Independent results: ${response.status}`);
    return response.json();
  })();
  if (independentCache.size > 120) independentCache.delete(independentCache.keys().next().value);
  independentCache.set(url, { time:Date.now(), task });
  try { return await task; } catch (error) { independentCache.delete(url); throw error; }
}
const bo3URL = (path, query = {}) => `https://api.bo3.gg/api/v1/${path}?${new URLSearchParams(query)}`;
export function normalizeBO3(event, match, games = []) {
  if (match.status !== 'finished' || ![1,4].includes(match.discipline_id)) return null;
  const side = orientation(event, [match.team1, match.team2], match.start_date);
  if (side < 0) return null;
  const teams = side ? [match.team2, match.team1] : [match.team1, match.team2];
  const total = side ? [match.team2_score, match.team1_score] : [match.team1_score, match.team2_score];
  if (!total.every(Number.isInteger) || total.some(x => x < 0) || total[0] === total[1] || teams[total[0] > total[1] ? 0 : 1].id !== match.winner_team_id) return null;
  const periods = [];
  for (const game of [...games].sort((a,b) => a.number - b.number)) {
    if (game.match_id !== match.id || game.status !== 'finished' || game.number !== periods.length + 1) break;
    const winner = teams.findIndex(team => aliases(team).includes(normalizedName(game.winner_clan_name)));
    if (winner < 0 || !aliases(teams[1-winner]).includes(normalizedName(game.loser_clan_name))) break;
    if (![game.winner_clan_score, game.loser_clan_score].every(Number.isInteger) || game.winner_clan_score <= game.loser_clan_score) break;
    periods.push(winner === 0 ? [game.winner_clan_score, game.loser_clan_score] : [game.loser_clan_score, game.winner_clan_score]);
  }
  const mapWins = periods.reduce((a,p) => { a[p[0] > p[1] ? 0 : 1]++; return a; }, [0,0]);
  const completeMaps = periods.length === total[0] + total[1] && mapWins.every((n,i) => n === total[i]);
  return { id:String(event.eventId || event.id), confirmed:true, type:0, sport:'CS', categoryName:match.discipline_id === 4 ? 'Dota 2' : 'Counter-Strike',
    name:event.eventName || event.name, competitors:teams.map(t => t.name), startTime:match.start_date,
    scoreText:total.join('-') + (completeMaps ? ` (${periods.map(p => p.join('-')).join(', ')})` : ''),
    seriesComplete:true, mapsPlayed:total[0]+total[1], bestOf:match.bo_type,
    provider:'BO3.gg', source:`https://bo3.gg/matches/${match.slug}` };
}
async function counterStrikeResults(events, discipline = 1) {
  // Bounded paginated archive. A missing older match stays pending, never guessed.
  const all = [];
  const oldest = Math.min(...events.map(eventTime)) - 2 * 3600000;
  for (let page = 0; page < 4; page++) {
    const data = await independentJSON(bo3URL('matches', { 'page[limit]':'100', 'page[offset]':String(page*100), sort:'-start_date', 'filter[matches.discipline_id][eq]':String(discipline), 'filter[matches.status][eq]':'finished' }));
    if (!Array.isArray(data.results)) throw new Error('Invalid BO3 results');
    all.push(...data.results);
    if (data.results.length < 100 || Date.parse(data.results.at(-1).start_date) < oldest) break;
  }
  const candidates = all.filter(m => m.discipline_id === discipline && events.some(e => Math.abs(eventTime(e) - Date.parse(m.start_date)) <= 2*3600000));
  const ids = [...new Set(candidates.flatMap(m => [m.team1_id,m.team2_id]))];
  const teams = new Map();
  for (let i=0; i<ids.length; i+=100) {
    const data = await independentJSON(bo3URL('teams', { 'page[limit]':'100', 'filter[teams.discipline_id][eq]':String(discipline), 'filter[teams.id][in]':ids.slice(i,i+100).join(',') }));
    for (const team of data.results || []) teams.set(team.id, team);
  }
  const results = [];
  for (const event of events) {
    const matches = candidates.filter(m => orientation(event, [teams.get(m.team1_id),teams.get(m.team2_id)],m.start_date) >= 0);
    if (matches.length !== 1) continue;
    const match = await independentJSON(bo3URL(`matches/${encodeURIComponent(matches[0].slug)}`));
    let games = [];
    try { if (discipline === 1) games = (await independentJSON(bo3URL('games', { 'page[limit]':'10', 'filter[games.match_id][eq]':String(match.id) }))).results || []; } catch { /* Full series winner can still be confirmed. */ }
    const result = normalizeBO3(event, match, games);
    if (result) results.push(result);
  }
  return results;
}
export function normalizeDota(event, games, confirmedSeries = null) {
  if (!games.length) return null;
  const ordered = [...games].sort((a,b) => a.start_time - b.start_time);
  const first = ordered[0], side = orientation(event, [{name:first.radiant_name}, {name:first.dire_name}], new Date(first.start_time*1000).toISOString());
  if (side < 0) return null;
  const ids = side ? [first.dire_team_id, first.radiant_team_id] : [first.radiant_team_id, first.dire_team_id];
  if (!ids.every(Boolean) || ids[0] === ids[1]) return null;
  const required = ({0:1,1:2,2:3})[first.series_type];
  if (!required) return null;
  if (new Set(ordered.map(g => g.match_id)).size !== ordered.length) return null;
  const total = [0,0], periods = [], periodWinners = [];
  for (const game of ordered) {
    if (game.series_id !== first.series_id || game.series_type !== first.series_type || typeof game.radiant_win !== 'boolean' || !ids.includes(game.radiant_team_id) || !ids.includes(game.dire_team_id) || game.radiant_team_id === game.dire_team_id) return null;
    const winner = ids.indexOf(game.radiant_win ? game.radiant_team_id : game.dire_team_id);
    const score = ids[0] === game.radiant_team_id ? [game.radiant_score,game.dire_score] : [game.dire_score,game.radiant_score];
    if (!score.every(Number.isInteger)) return null;
    if (Math.max(...total) >= required) return null;
    total[winner]++; periods.push(score); periodWinners.push(winner);
  }
  if (Math.max(...total) !== required || Math.min(...total) >= required) return null;
  if (confirmedSeries?.confirmed && confirmedSeries.categoryName === 'Dota 2' &&
      confirmedSeries.id === String(event.eventId || event.id) && confirmedSeries.scoreText === total.join('-') &&
      confirmedSeries.mapsPlayed === ordered.length && confirmedSeries.bestOf === required*2-1) {
    return {...confirmedSeries, scoreText:`${total.join('-')} (${periods.map(p => p.join('-')).join(', ')})`,
      periodWinners, mapsVerified:true, provider:'BO3.gg + OpenDota',
      mapSources:ordered.map(g => `https://www.opendota.com/matches/${g.match_id}`)};
  }
  return { id:String(event.eventId || event.id), confirmed:true, type:0, sport:'CS', categoryName:'Dota 2',
    name:event.eventName || event.name, competitors:side ? [first.dire_name,first.radiant_name] : [first.radiant_name,first.dire_name],
    startTime:new Date(first.start_time*1000).toISOString(),
    // proMatches does not guarantee map ordinals. A clinching win proves only the series winner.
    winnerOnly:true, winnerIndex:total[0] > total[1] ? 0 : 1,
    provider:'OpenDota', source:`https://www.opendota.com/matches/${first.match_id}` };
}
export function normalizeDatdota(event, games, confirmedSeries) {
  if (!confirmedSeries || ![1,3,5].includes(confirmedSeries.bestOf)) return null;
  const converted = games.map(g => ({match_id:g.matchId, series_id:g.seriesId,
    series_type:(confirmedSeries.bestOf-1)/2, start_time:Date.parse(g.startDate)/1000,
    radiant_team_id:g.radiant?.valveId,dire_team_id:g.dire?.valveId,
    radiant_name:g.radiant?.name,dire_name:g.dire?.name,
    radiant_score:g.radiant?.score,dire_score:g.dire?.score,radiant_win:g.radiantVictory}));
  const result = normalizeDota(event,converted,confirmedSeries);
  if (!result?.mapsVerified) return null;
  return {...result, provider:'BO3.gg + datdota', mapSources:[...games].sort((a,b)=>Date.parse(a.startDate)-Date.parse(b.startDate)).map(g=>`https://datdota.com/matches/${g.matchId}`)};
}
export async function independentResults(events) {
  const cs = [], dota = [], rows = [], errors = [];
  for (const event of events) {
    const discipline = `${event.categoryName || ''} ${event.subsport || ''}`;
    if (/replay/i.test(`${discipline} ${event.eventName || ''}`)) continue;
    if (/counter.?strike|\bcs2?\b/i.test(discipline)) cs.push(event);
    else if (/dota/i.test(discipline)) dota.push(event);
  }
  if (cs.length) try { rows.push(...await counterStrikeResults(cs)); } catch (e) { errors.push('BO3.gg'); console.error('BO3 results unavailable', e.message); }
  if (dota.length) {
    let series = [];
    try { series = await counterStrikeResults(dota,4); }
    catch (e) { errors.push('BO3.gg Dota'); console.error('Dota series unavailable',e.message); }
    if (series.length) try {
      const archive = await independentJSON('https://api.datdota.com/api/matches');
      if (!Array.isArray(archive.data)) throw new Error('Invalid datdota archive');
      const groups = new Map();
      for (const game of archive.data) {
        const key = game.seriesId || `single-${game.matchId}`;
        if (!groups.has(key)) groups.set(key,[]);
        groups.get(key).push(game);
      }
      for (const event of dota) {
        const confirmed = series.find(r=>r.id===String(event.eventId||event.id));
        const matches = [...groups.values()].map(g=>normalizeDatdota(event,g,confirmed)).filter(Boolean);
        if (matches.length===1) rows.push(matches[0]);
      }
    } catch (e) { errors.push(`datdota: ${e.message}`); }
    const remaining = dota.filter(e=>!rows.some(r=>r.id===String(e.eventId||e.id)));
    if (remaining.length) {
    try {
      const data = [], oldest = Math.min(...dota.map(eventTime)) - 2*3600000;
      let before = '';
      for (let page=0; page<4; page++) {
        const batch = await independentJSON(`https://api.opendota.com/api/proMatches${before ? '?less_than_match_id='+before : ''}`);
        if (!Array.isArray(batch)) throw new Error('Invalid Dota archive');
        data.push(...batch);
        if (batch.length < 100 || Math.min(...batch.map(g => g.start_time))*1000 < oldest) break;
        before = String(Math.min(...batch.map(g => g.match_id)));
      }
      const groups = new Map();
      for (const game of data) {
        const key = game.series_id || `single-${game.match_id}`;
        if (!groups.has(key)) groups.set(key,[]);
        if (!groups.get(key).some(g => g.match_id === game.match_id)) groups.get(key).push(game);
      }
      for (const event of remaining) {
        const confirmed = series.find(r => r.id === String(event.eventId || event.id));
        const matches = [...groups.values()].map(g => normalizeDota(event,g,confirmed)).filter(Boolean);
        if (matches.length === 1 && matches[0].mapsVerified) rows.push(matches[0]);
        else if (confirmed) rows.push(confirmed);
        else if (matches.length === 1) rows.push(matches[0]);
      }
    } catch (e) {
      rows.push(...series.filter(s=>!rows.some(r=>r.id===s.id))); errors.push(`OpenDota: ${e.message}`); console.error('Dota maps unavailable',e.message);
    }
    }
  }
  return { results:rows, unavailable:errors, pending:events.filter(e => !rows.some(r => r.id === String(e.eventId || e.id))).map(e => String(e.eventId || e.id)) };
}

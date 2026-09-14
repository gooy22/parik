import { independentResults } from './independent.mjs';
const SOURCE = 'https://24parik-bet.org';
const SPORT_IDS = { 35:'CS', 21:'F', 2:'B' };
const pending = new Map();
const memoryCache = new Map();
async function sourceJSON(path, ctx, headers = {}) {
  const url = `${SOURCE}${path}`, key = new Request(url);
  const entry=memoryCache.get(url);
  if(entry && Date.now()-entry.time<30000)return entry.value;
  let cache;
  try {cache=globalThis.caches?.default;const stored=await cache?.match(key);if(stored)return stored.json();}catch{cache=null;}
  if (pending.has(url)) return pending.get(url);
  const task = (async () => {
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
    let response;
    try{response=await fetch(url,{headers,signal:controller.signal});}finally{clearTimeout(timer);}
    if (!response.ok) throw new Error(`Result source: ${response.status}`);
    const value = await response.json();
    if(memoryCache.size>6)memoryCache.delete(memoryCache.keys().next().value);
    memoryCache.set(url,{time:Date.now(),value});
    if(cache){try{ctx.waitUntil(cache.put(key,Response.json(value,{headers:{'cache-control':'public, max-age=30'}})).catch(()=>{}));}catch{}}
    return value;
  })();
  pending.set(url, task);
  try { return await task; } finally { pending.delete(url); }
}
export async function handleAPI(request, ctx) {
  const url = new URL(request.url);
  if (url.pathname === '/api/settlements') {
    if (request.method !== 'POST') return new Response('Method not allowed', {status:405});
    try {
      const body = await request.text();
      if (body.length > 48000) return new Response('Too large', {status:413});
      const {events} = JSON.parse(body);
      if (!Array.isArray(events) || events.length > 30 || events.some(e => !e || !/^\d{1,12}$/.test(String(e.eventId || e.id)) || JSON.stringify(e).length > 1500)) return new Response('Invalid events', {status:400});
      return Response.json(await independentResults(events), {headers:{'cache-control':'no-store'}});
    } catch (e) {
      console.error('Independent settlement request failed', e.message);
      return Response.json({error:'Results unavailable'}, {status:503});
    }
  }
  if (!['/api/results', '/api/completed'].includes(url.pathname)) return new Response('Not found', { status:404 });
  if (request.method !== 'GET') return new Response('Method not allowed', { status:405, headers:{ Allow:'GET' } });
  try {
    if (url.pathname === '/api/results') {
      const date = url.searchParams.get('date') || '', ids = (url.searchParams.get('ids') || '').split(',');
      if (!/^20\d{6}$/.test(date) || ids.length > 100 || ids.some(id => !/^\d{1,12}$/.test(id))) return new Response('Invalid result query', { status:400 });
      const source = `/sport-results/assets/${date}-all-uk.json`, groups = await sourceJSON(source, ctx);
      if (!Array.isArray(groups)) throw new Error('Invalid result archive');
      const wanted = new Set(ids), rows = [];
      for (const group of groups) for (const event of group.Events || []) {
        if (!wanted.has(String(event.Eventid))) continue;
        rows.push({ id:String(event.Eventid), confirmed:true, type:event.Type, name:event.Name,
          startTime:event.Date, competitors:event.Competitors, scoreText:event.Score,
          sport:SPORT_IDS[group.SportType] || ({ 'Теніс':'T','Настільний теніс':'TT','Хокей':'H','Волейбол':'VB','Снукер':'PL' })[group.SportName],
          categoryName:group.CategoryName, tournamentName:group.Name, source:`${SOURCE}${source}` });
      }
      return Response.json(rows, { headers:{ 'cache-control':'private, max-age=15' } });
    }
    const competitor = url.searchParams.get('competitor') || '', subsport = url.searchParams.get('subsport') || '';
    if (!/^\d{1,12}$/.test(competitor) || !/^[a-zA-Z0-9_-]{0,30}$/.test(subsport)) return new Response('Invalid competitor', { status:400 });
    const query = new URLSearchParams({ competitorId:competitor, subSport:subsport, limit:'20', includeAnalyticsData:'true' });
    const data = await sourceJSON(`/apg/v0/navigation/sport/widgets/completed-events?${query}`, ctx, {
      'X-Api-Key':'507aa81f-4c27-4e37-9410-21dfb81e9efe', 'X-Brand':'PRJ4', 'X-Channel':'MOBILE_WEB', 'X-Language':'uk',
    });
    const rows = (data.payload?.groups || []).flatMap(group => (group.events || []).map(event => ({
      id:String(event.id), name:event.name, startTime:event.startTime, competitors:event.competitors, tournament:group.tournament?.name,
    })));
    return Response.json(rows, { headers:{ 'cache-control':'private, max-age=30' } });
  } catch (error) {
    console.error('Public result request failed',url.pathname,error.message);
    return Response.json({ error:'Джерело результатів тимчасово недоступне' }, { status:503, headers:{ 'cache-control':'no-store' } });
  }
}

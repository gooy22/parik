import test from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { Accounts, EMAIL, INITIAL_BALANCE } from '../dist/account.mjs';
import { settleSelection, settledBetTotals, parseScore } from '../dist/settlement.mjs';
import { ResultsService } from '../dist/results.mjs';
import { handleAPI } from '../worker/api.mjs';

const memory = () => { const map = new Map(); return { getItem:key=>map.get(key) ?? null, setItem:(key,value)=>map.set(key,value), removeItem:key=>map.delete(key) }; };
const pick = (id, overrides = {}) => ({ id:`pick-${id}`, eventId:String(id), eventName:'Home - Away', label:'Home', marketName:'Переможець', marketType:1, outcomeType:0, odds:2, period:0, resultKind:1, sport:'CS', categoryName:'Counter-Strike', startTime:1788897600, ...overrides });
const result = (id, scoreText = '2-0 (13-11, 13-9)', overrides = {}) => ({ id:String(id), confirmed:true, type:0, sport:'CS', categoryName:'Counter-Strike', scoreText, source:'https://24parik-bet.org/sport-results/assets/20260908-all-uk.json', ...overrides });

test('a confirmed win credits gross payout exactly once across reload and sign-out', async () => {
  const storage = memory(), accounts = new Accounts(storage);
  await accounts.signIn(EMAIL,'0PLM0PLM');
  accounts.placeBet({ id:'win', stake:10000, selections:[pick(1)] });
  assert.equal(accounts.settleBets(new Map()).changed,false);
  assert.equal(accounts.current().bets[0].status,'open');
  const results = new Map([['1',result(1)]]);
  assert.deepEqual(accounts.settleBets(results).settled,['win']);
  assert.equal(accounts.current().balance,INITIAL_BALANCE+10000);
  assert.equal(accounts.current().bets[0].payout,20000);
  assert.equal(accounts.current().bets[0].status,'won');
  const restored = new Accounts(storage);
  for (let i=0;i<5;i++) assert.equal(restored.settleBets(results).changed,false);
  assert.equal(restored.current().payments.length,1);
  restored.signOut(); await restored.signIn(EMAIL,'0PLM0PLM');
  assert.equal(restored.current().balance,INITIAL_BALANCE+10000);
});

test('legacy quote IDs recover settlement metadata and an actual archived Dota result', () => {
  const id = encodeURIComponent(JSON.stringify([{ eventId:'18393871',marketType:1,resultKind:1,period:0 },{ marketParameters:[] },{ type:3,values:[] }]));
  const legacy = { id,eventId:'18393871',odds:1.8, label:'Moonlight Wispers' };
  const archived = result('18393871','0-2 (25-46, 50-46)',{ categoryName:'Dota 2' });
  assert.equal(settleSelection(legacy,archived).factor,1.8);
  assert.equal(settleSelection({ ...legacy,id:'old',resultKind:1,marketType:1,period:2,outcomeType:0 },archived).status,'lost','A kill lead on map two is not a map win');
  assert.equal(settleSelection(pick(1,{categoryName:'Dota 2',period:1}),result(1,'2-1 (21-30, 37-22, 35-35)',{categoryName:'Dota 2'})),null,'Mixed-series MOBA map winner needs explicit confirmation');
});

test('winner, map winner, handicap, totals, exact score and quarter lines', () => {
  assert.equal(settleSelection(pick(1),result(1,'0-2 (8-13, 9-13)')).status,'lost');
  assert.equal(settleSelection(pick(1,{period:2,outcomeType:3}),result(1,'1-2 (13-8, 9-13, 6-13)')).status,'won');
  assert.equal(settleSelection(pick(1,{marketType:260,outcomeType:86,parameters:[-1.5]}),result(1)).status,'won');
  assert.equal(settleSelection(pick(1,{marketType:264,outcomeType:5,parameters:[2.5]}),result(1)).status,'won');
  assert.equal(settleSelection(pick(1,{marketType:5,outcomeType:4,parameters:[46]}),result(1)).status,'void');
  assert.equal(settleSelection(pick(1,{marketType:16,outcomeType:102,outcomeValues:[2,0]}),result(1)).status,'won');
  assert.equal(settleSelection(pick(1,{sport:'F',marketType:4,outcomeType:86,parameters:[-.25]}),result(1,'1-1 (0-0, 1-1)',{sport:'F'})).factor,.5);
  assert.equal(settleSelection(pick(1),{...result(1),confirmed:false}),null);
  assert.equal(settleSelection(pick(1),result(2)),null);
  assert.equal(parseScore('1-0 abandoned'),null);
});

test('unplayed map in a confirmed completed series refunds the stake', () => {
  const selection = pick('18373613',{period:3});
  assert.equal(settleSelection(selection,result('18373613','2-0 (16-14, 16-12)')).status,'void');
  assert.equal(settleSelection(selection,{...result('18373613'),confirmed:false}),null);
  assert.equal(settleSelection(pick(1,{period:3}),result(1,'1-0 (13-11, 5-3)')),null);
});

test('express and systems preserve pending legs and calculate voids and losses correctly', () => {
  const settled = factor => ({settlement:{factor}});
  const base = {type:'express',stake:10000,cost:10000,selections:[settled(2),{}]};
  assert.equal(settledBetTotals(base),null);
  assert.deepEqual(settledBetTotals({...base,selections:[settled(2),settled(1)]}),{payout:20000,status:'won'});
  assert.deepEqual(settledBetTotals({...base,selections:[settled(0),{}]}),{payout:0,status:'lost'});
  assert.deepEqual(settledBetTotals({type:'system',systemSize:2,stake:10000,cost:30000,selections:[settled(2),settled(3),settled(0)]}),{payout:60000,status:'won'});
});

test('source API, result polling, balance credit, history transition and repeat polling', async () => {
  const accounts = new Accounts(memory()); await accounts.signIn(EMAIL,'0PLM0PLM');
  accounts.placeBet({id:'integrated',stake:3000,selections:[pick('18395734',{eventName:'Nemiga - HOTU',startTime:Date.parse('2026-09-09T12:15:00Z')/1000})]});
  const originalFetch = globalThis.fetch;
  const originalCaches = Object.getOwnPropertyDescriptor(globalThis,'caches');
  Object.defineProperty(globalThis,'caches',{configurable:true,get(){throw new Error('Cache API unavailable in this runtime');}});
  const {match,games} = JSON.parse(readFileSync(new URL('./fixtures/bo3-nemiga-hotu.json',import.meta.url)));
  let change;
  globalThis.fetch = async raw => {
    const url = new URL(raw);
    assert.equal(url.origin,'https://api.bo3.gg');
    if (url.pathname === '/api/v1/matches') return Response.json({results:[match]});
    if (url.pathname === '/api/v1/teams') return Response.json({results:[match.team1,match.team2]});
    if (url.pathname === '/api/v1/games') return Response.json({results:games});
    return Response.json(match);
  };
  try {
    const service = new ResultsService({accounts,onChange:result=>{change=result;},fetchImpl:(url,options)=>handleAPI(new Request(`https://example.test${url}`,options),{waitUntil(){}})});
    await service.check(true);
    assert.equal(service.state,'ready');
    assert.equal(accounts.current().bets[0].status,'won');
    assert.equal(accounts.current().balance,INITIAL_BALANCE+3000);
    assert.deepEqual(change.settled,['integrated']);
    await service.check(true); assert.equal(accounts.current().payments.length,1);
    const invalid = await handleAPI(new Request('https://example.test/api/results?date=20260908&ids=https://evil.test'),{});
    assert.equal(invalid.status,400);
  } finally { globalThis.fetch = originalFetch; if(originalCaches)Object.defineProperty(globalThis,'caches',originalCaches);else delete globalThis.caches; }
});

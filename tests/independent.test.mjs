import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeBO3, normalizeDota, normalizeDatdota} from '../worker/independent.mjs';
import {settleSelection} from '../dist/settlement.mjs';
import {Accounts, EMAIL, INITIAL_BALANCE} from '../dist/account.mjs';
const {match,games} = JSON.parse(readFileSync(new URL('./fixtures/bo3-nemiga-hotu.json',import.meta.url)));
const event = {eventId:'18391379',eventName:'Nemiga - HOTU',startTime:Date.parse('2026-09-09T12:15:00Z')/1000};
test('real BO3 map results preserve reversed team ordering and reject another meeting',()=>{
  const r=normalizeBO3(event,match,games);
  assert.equal(r.scoreText,'2-1 (3-13, 13-4, 13-7)');
  for(const [period,status] of [[0,'won'],[1,'lost'],[2,'won'],[3,'won']])
    assert.equal(settleSelection({...event,sport:'CS',categoryName:'Counter-Strike',resultKind:1,marketType:1,outcomeType:0,odds:2,period},r).status,status);
  assert.equal(normalizeBO3({...event,startTime:event.startTime-86400},match,games),null);
  assert.equal(normalizeBO3({...event,eventName:'Nemiga Academy - HOTU'},match,games),null);
  assert.equal(normalizeBO3(event,{...match,status:'current'},games),null);
});
test('OpenDota uses explicit wins, never kill leads or assumed map positions',()=>{
  const start=1788955200;
  const maps=[{series_id:11,series_type:1,start_time:start,radiant_name:'A',dire_name:'B',radiant_team_id:1,dire_team_id:2,radiant_score:40,dire_score:10,radiant_win:false,match_id:1},
    {series_id:11,series_type:1,start_time:start+3600,radiant_name:'B',dire_name:'A',radiant_team_id:2,dire_team_id:1,radiant_score:10,dire_score:40,radiant_win:true,match_id:2}];
  const e={eventId:'4',eventName:'A - B',startTime:start};
  const r=normalizeDota(e,maps);
  const pick={...e,resultKind:1,marketType:1,outcomeType:3,odds:2};
  assert.equal(settleSelection(pick,r).status,'won');
  assert.equal(settleSelection({...pick,period:1},r),null);
  assert.equal(normalizeDota(e,maps.slice(0,1)),null);
});

test('confirmed Dota series enables map wins, map losses, totals and one-time account payout',async()=>{
  const fixture=JSON.parse(readFileSync(new URL('./fixtures/dota-mouz-klim.json',import.meta.url)));
  const event={eventId:'1234',eventName:'MOUZ - Klim Sani4',startTime:Date.parse('2026-09-09T21:00:00Z')/1000};
  const series=normalizeBO3(event,fixture.match);
  const result=normalizeDota(event,fixture.games,series);
  assert.equal(result.mapsVerified,true);
  const datdota=JSON.parse(readFileSync(new URL('./fixtures/dota-datdota.json',import.meta.url)));
  const alternative=normalizeDatdota(event,datdota,series);
  assert.deepEqual(alternative.periodWinners,result.periodWinners);
  assert.equal(alternative.scoreText,result.scoreText);
  assert.equal(normalizeDatdota(event,datdota.slice(0,2),series),null);
  assert.equal(result.scoreText,'1-2 (15-42, 45-14, 15-19)');
  assert.deepEqual(result.periodWinners,[1,0,1]);
  const selection={...event,id:'dota-map-2',label:'MOUZ',sport:'CS',categoryName:'Dota 2',resultKind:1,marketType:1,outcomeType:0,odds:2,period:2};
  assert.equal(settleSelection(selection,result).status,'won');
  assert.equal(settleSelection({...selection,period:1},result).status,'lost');
  assert.equal(settleSelection({...selection,marketType:5,outcomeType:4,parameters:[50.5]},result).status,'won');
  const incomplete=normalizeDota(event,fixture.games.filter(g=>g.radiant_win===false),series);
  assert.notEqual(incomplete?.mapsVerified,true);
  assert.equal(settleSelection(selection,incomplete),null);
  const storage=new Map(), accounts=new Accounts({getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)});
  await accounts.signIn(EMAIL,'0PLM0PLM');
  accounts.placeBet({id:'dota-test',stake:3000,selections:[selection]});
  assert.equal(accounts.hideBet('dota-test'),true);
  assert.equal(accounts.hideBet('dota-test'),false);
  assert.equal(accounts.current().balance,INITIAL_BALANCE-3000);
  accounts.settleBets(new Map([[event.eventId,result]]));
  assert.equal(accounts.current().bets[0].status,'won');
  assert.equal(accounts.current().bets[0].hidden,true);
  assert.equal(accounts.current().balance,INITIAL_BALANCE+3000);
  assert.equal(accounts.settleBets(new Map([[event.eventId,result]])).changed,false);
});

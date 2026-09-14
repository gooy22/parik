import test from 'node:test';
import assert from 'node:assert/strict';
import { Accounts, INITIAL_BALANCE, EMAIL, betTotals, cents } from '../dist/account.mjs';
import { applyBatch, marketSelections } from '../dist/feed.mjs';

function storage() {
  const map = new Map();
  return {getItem:k=>map.get(k) ?? null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
}
const picks = [2,3,4].map((odds,index) => ({id:`quote-${index}`,eventId:`event-${index}`,eventName:`Fixture ${index}`,marketName:'Winner',label:'Team 1',odds}));

test('sign in, debit, persist a bet, avoid duplicate debit, and restore the same session', async () => {
  const local = storage(), accounts = new Accounts(local);
  await assert.rejects(accounts.signIn(EMAIL,'incorrect'), /Неверная/);
  await accounts.signIn(EMAIL,'0PLM0PLM');
  assert.equal(accounts.current().firstName,'Роман');
  const bet = accounts.placeBet({id:'test-bet',stake:cents('30,00'),selections:[picks[0]]});
  assert.equal(bet.potential,6000);
  assert.equal(accounts.current().balance,INITIAL_BALANCE-3000);
  accounts.placeBet({id:'test-bet',stake:3000,selections:[picks[0]]});
  assert.equal(accounts.current().bets.length,1);
  const restored = new Accounts(local);
  assert.equal(restored.current().balance,INITIAL_BALANCE-3000);
  assert.equal(restored.current().bets[0].cost,3000);
  restored.signOut();
  assert.throws(()=>restored.placeBet({id:'guest',stake:3000,selections:[picks[0]]}),/войдите/);
  await restored.signIn(EMAIL,'0PLM0PLM');
  assert.equal(restored.current().bets.length,1);
});

test('invalid amounts, insufficient balance, and invalid combinations do not modify the account', async () => {
  const accounts = new Accounts(storage());
  await accounts.signIn(EMAIL,'0PLM0PLM');
  const before = JSON.stringify(accounts.current());
  for (const stake of [1999,-100,NaN,Infinity,INITIAL_BALANCE+100]) assert.throws(()=>accounts.placeBet({id:crypto.randomUUID(),stake,selections:[picks[0]]}));
  assert.throws(()=>accounts.placeBet({id:'repeat',stake:3000,selections:[picks[0],picks[0]],type:'express'}));
  assert.throws(()=>accounts.placeBet({id:'same-event',stake:3000,selections:[picks[0],{...picks[1],eventId:picks[0].eventId}],type:'express'}));
  assert.equal(JSON.stringify(accounts.current()),before);
  assert.equal(betTotals(10000,picks,'express').potential,240000);
  assert.deepEqual(betTotals(10000,picks,'system',2),{cost:30000,potential:260000,odds:260000/30000,combinations:3});
});

test('old profile storage keeps its balance and history when adding betting', async () => {
  const local = storage(), accounts = new Accounts(local);
  await accounts.signIn(EMAIL,'0PLM0PLM');
  const old = accounts.read(); delete old[0].bets; old[0].balance = 9912345;
  local.setItem('arena-accounts-v1',JSON.stringify(old));
  assert.equal(accounts.current().balance,9912345);
  accounts.placeBet({id:'migrated',stake:3000,selections:[picks[0]]});
  assert.equal(accounts.current().balance,9909345);
  assert.equal(accounts.current().bets.length,1);
});

test('partial live updates preserve identifiers; suspended and removed markets cannot stay active', () => {
  const key = {eventId:'test',marketType:1,period:0,resultKind:1};
  const maps = new Map();
  const event = {name:'Fixture',competitors:[{name:'First'},{name:'Second'}],tradingStatus:1,status:1,stage:2};
  applyBatch(maps,{isInitialBatch:true,data:[{key,value:{marketItems:[{key:{marketParameters:[]},outcomes:[{key:{type:0,values:[]},odd:200,isFrozen:false},{key:{type:3,values:[]},odd:180,isFrozen:false}]}]}}]});
  const original = marketSelections([...maps.values()][0],event);
  applyBatch(maps,{data:[{key,value:{marketItems:[{outcomes:[{odd:240},{}]}]}}]});
  const updated = marketSelections([...maps.values()][0],event);
  assert.equal(updated[0].id,original[0].id); assert.equal(updated[0].odds,2.4); assert.equal(updated[1].odds,1.8);
  applyBatch(maps,{data:[{key,value:{marketItems:[{outcomes:[{isFrozen:true},{}]}]}}]});
  assert.equal(marketSelections([...maps.values()][0],event)[0].frozen,true);
  assert(marketSelections([...maps.values()][0],{...event,tradingStatus:2}).every(quote=>quote.frozen));
  applyBatch(maps,{data:[{key,isRemoved:true}]}); assert.equal(maps.size,0);
});

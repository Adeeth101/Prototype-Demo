import assert from 'node:assert/strict';
import {CATALOGUE} from './prototype/catalogue.mjs?v=bowl-v5';
import {makeRounds} from './prototype/scenarios.mjs?v=bowl-v5';
import {SLOTS,LANES,BASE_ENERGY,BASE_KW,setScenario,evaluate,canPlace,insideWindow,INTENSITY} from './prototype/engine.mjs?v=bowl-v5';
assert.equal(CATALOGUE.length,48);assert.equal(new Set(CATALOGUE.map(t=>t.id)).size,48);assert.equal(SLOTS,12);assert.equal(LANES,3);
for(let lane=0;lane<3;lane++)for(const duration of [1,2])assert.equal(CATALOGUE.filter(t=>t.lane===lane&&t.duration===duration).length,8);
let checked=0,energies=new Set(),windows=new Set();
for(let seed=1;seed<=1000;seed++){
 const days=makeRounds(seed);assert.deepEqual(days,makeRounds(seed),'Seed must reproduce allocation');assert.equal(new Set(days.flatMap(d=>d.tasks.map(t=>t.id))).size,30,'No cross-round repeats');
 for(const day of days){
  assert.equal(day.tasks.length,10);assert.deepEqual([0,1,2].map(l=>day.tasks.filter(t=>t.lane===l).length),[3,3,4]);assert.equal(day.tasks.filter(t=>t.duration===2).length,4);
  const r=evaluate(day.witness,day);assert(r.valid,JSON.stringify(r.issues));assert(Math.abs(r.energy-BASE_ENERGY-day.tasks.reduce((s,t)=>s+t.energy,0))<1e-8);assert(r.timingOpportunityUsed===null||r.timingOpportunityUsed>=0&&r.timingOpportunityUsed<=1);
  for(const t of day.tasks){const p=day.witness.find(p=>p.id===t.id);assert(insideWindow(t,p.start));if(t.after)assert(day.tasks.some(q=>q.id===t.after));windows.add(t.id+':'+t.windows[0].join('-'));}
  energies.add(r.energy.toFixed(4));checked++;
 }
}
assert(energies.size>100);assert(windows.size>100,'Daily time restrictions must vary');
const day=makeRounds(3900)[0];setScenario(day);const empty=evaluate([]);assert(Math.abs(empty.energy-BASE_ENERGY)<1e-9);assert(empty.load.every(x=>x===BASE_KW));assert(!empty.complete);
const long=day.tasks.find(t=>t.duration===2),short=day.tasks.find(t=>t.duration===1),attended=day.tasks.find(t=>!t.unattended),auto=day.tasks.find(t=>t.lane===2);
assert(!canPlace([],long.id,11,long.lane));assert(!canPlace([],attended.id,5,2));assert(canPlace([{id:auto.id,start:5,lane:2}],day.tasks.find(t=>t.id!==auto.id&&t.lane===2).id,5,2));
assert(!canPlace([{id:long.id,start:5,lane:0}],short.id,6,0));
const cross=evaluate([{id:long.id,start:4,lane:long.lane}]);assert(Math.abs(cross.energy-BASE_ENERGY-long.energy)<1e-9);assert(Math.abs(cross.emissions-empty.emissions-long.energy/2*(INTENSITY[4]+INTENSITY[5]))<1e-9);
assert(!evaluate([...day.witness,day.witness[0]]).valid);assert(!evaluate(day.witness.filter(p=>p.id!==short.id)).complete);
console.log(JSON.stringify({passed:true,catalogue:48,generatedDaysChecked:checked,balancedMix:[3,3,4],twoSlotTilesPerDay:4,distinctDayEnergyTotals:energies.size,distinctTaskWindows:windows.size,checks:'determinism; quotas; no repeat; generated feasibility; varied windows; energy and split-slot emissions; attention and collision rules; dependencies; independent-bound range'},null,2));

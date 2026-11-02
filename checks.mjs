import assert from 'node:assert/strict';
import {SLOTS,LANES,STEP_HOURS,TASKS,TOTAL_ENERGY,EXAMPLE,evaluate,canPlace,INTENSITY,MODEL} from './prototype/engine.mjs';
assert.equal(SLOTS,12);assert.equal(LANES,5);assert.equal(INTENSITY.length,12);
assert(TASKS.every(t=>t.duration===1),'All physical tokens occupy one position');
assert(Math.abs(TOTAL_ENERGY-10.298)<1e-9);
const first=evaluate(EXAMPLE);assert(first.valid,JSON.stringify(first.issues));
const revised=EXAMPLE.map(p=>({...p,...({wash:{start:5,lane:0},dry:{start:6,lane:0},dish:{start:6,lane:1},render:{start:5,lane:1},heat:{start:3,lane:1},game:{start:7,lane:0}}[p.id]||{})}));
const second=evaluate(revised);assert(second.valid,JSON.stringify(second.issues));
assert(Math.abs(first.energy-second.energy)<1e-9);assert(second.emissions<first.emissions);assert(second.peak<first.peak);
assert(!evaluate([]).complete);assert(!evaluate([...EXAMPLE,EXAMPLE[0]]).valid);
assert(evaluate(EXAMPLE.map(p=>p.id==='dry'?{...p,start:7,lane:1}:p)).issues.some(i=>i.kind==='sequence'));
assert(evaluate(EXAMPLE.map(p=>p.id==='breakfast'?{...p,start:6}:p)).issues.some(i=>i.kind==='window'));
assert(evaluate(EXAMPLE.map(p=>p.id==='dinner'?{...p,start:4,lane:3}:p)).issues.some(i=>i.kind==='window'));
assert(evaluate(EXAMPLE.map(p=>p.id==='study'?{...p,start:0}:p)).valid,'Tutorial no longer fixed to one time');
assert(!canPlace(EXAMPLE,'render',9,4));assert(!canPlace(EXAMPLE,'render',12,0));assert(!canPlace(EXAMPLE,'render',6,5));assert(canPlace(EXAMPLE,'render',11,4));
for(const task of TASKS){const r=evaluate([{id:task.id,start:6,lane:0}]);assert(Math.abs(r.energy-task.energy)<1e-9);assert(Math.abs(r.load[6]-task.energy/STEP_HOURS)<1e-9);}
// Verify flexibility using genuinely different time choices, not lane permutations.
let seed=3900;const random=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
const signatures=new Set(),emissions=new Set();
for(let i=0;i<2500;i++){
 const starts={wash:random(11),breakfast:3+random(2),dinner:8+random(3)};starts.dry=starts.wash+1+random(11-starts.wash);
 const used=Array(12).fill(0),plan=[];
 for(const t of TASKS){const start=starts[t.id]??random(12),lane=used[start]++;plan.push({id:t.id,start,lane});}
 const r=evaluate(plan);if(!r.valid)continue;
 signatures.add(plan.map(p=>p.start).join(','));emissions.add(r.emissions.toFixed(4));
 assert(Math.abs(r.energy-TOTAL_ENERGY)<1e-9);
}
assert(signatures.size>1500,'Many distinct valid time arrangements must remain');assert(emissions.size>100,'Valid plans must yield different outcomes');
assert.equal(MODEL.demandMeaning.includes('not instantaneous'),true);
console.log(JSON.stringify({passed:true,slots:SLOTS,tasks:TASKS.length,distinctValidTimeArrangements:signatures.size,distinctEmissionOutcomes:emissions.size,totalKWh:TOTAL_ENERGY,first:{emissions:first.emissions,highestSlotAverageKW:first.peak},revision:{emissions:second.emissions,highestSlotAverageKW:second.peak}},null,2));

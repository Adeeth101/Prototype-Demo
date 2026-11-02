import assert from 'node:assert/strict';
import {VERSION,SLOTS,LANES,LANE_META,BASE_KW,BASE_ENERGY,STEP_HOURS,TASKS,CORE_TASKS,TOTAL_ENERGY,EXAMPLE,evaluate,canPlace,insideWindow,INTENSITY,MODEL} from './prototype/engine.mjs';
assert.equal(SLOTS,12);assert.equal(LANES,3);assert.equal(TASKS.length,18);assert.equal(CORE_TASKS.length,10);assert.equal(INTENSITY.length,12);
assert(TASKS.some(t=>t.duration===2));assert(TASKS.every(t=>t.duration===1||t.duration===2));
const empty=evaluate([]);assert(Math.abs(empty.energy-BASE_ENERGY)<1e-9);assert(empty.load.every(x=>x===BASE_KW));assert.equal(empty.concurrentSlots,0);
const core=EXAMPLE.filter(p=>TASKS.find(t=>t.id===p.id).required),first=evaluate(EXAMPLE);assert(first.valid,JSON.stringify(first.issues));assert(evaluate(core).valid,'Optional extras are not required');
assert(Math.abs(evaluate(core).energy-TOTAL_ENERGY)<1e-9);
const revised=EXAMPLE.map(p=>({...p,...({wash:{start:4,lane:2},dry:{start:5,lane:2},dish:{start:6,lane:2},render:{start:5,lane:2},heat:{start:5,lane:1},lights:{start:7,lane:2},ev:{start:5,lane:2},phone:{start:6,lane:2}}[p.id]||{})}));
const second=evaluate(revised);assert(second.valid,JSON.stringify(second.issues));assert(Math.abs(first.energy-second.energy)<1e-9);assert(second.emissions<first.emissions);assert(second.peak<first.peak);
assert(first.maxConcurrentActivities>=5,'Background appliances must support real concurrency');
assert(canPlace([{id:'wash',start:5,lane:2}],'ev',5,2),'Background overlap allowed');
assert(!canPlace([{id:'study',start:5,lane:0}],'work',6,0),'Two-slot attention collision');
assert(canPlace([{id:'study',start:5,lane:0}],'work',7,0),'Adjacent two-slot blocks fit');
assert(!canPlace([],'work',11,0),'Two-slot block cannot run past board');assert(canPlace([],'work',10,0));assert(!canPlace([],'work',5,3));
assert(evaluate([{id:'render',start:5,lane:2},{id:'ev',start:5,lane:2}]).issues.every(i=>i.kind!=='overlap'));
assert(!canPlace([],'dinner',9,2),'Cooking cannot be classified as unattended');
assert(evaluate([{id:'study',start:5,lane:0},{id:'work',start:6,lane:0}]).issues.some(i=>i.kind==='overlap'));
assert(evaluate([{id:'wash',start:5,lane:2},{id:'dry',start:5,lane:2}]).issues.some(i=>i.kind==='sequence'));
assert(!evaluate(core.filter(p=>p.id!=='breakfast')).complete);assert(!evaluate([...core,core[0]]).valid);
for(const task of TASKS){const r=evaluate([{id:task.id,start:4,lane:2}]);assert(Math.abs(r.energy-BASE_ENERGY-task.energy)<1e-9);for(let i=4;i<4+task.duration;i++)assert(Math.abs(r.load[i]-BASE_KW-task.energy/task.duration/STEP_HOURS)<1e-9);}
const crossing=evaluate([{id:'study',start:4,lane:2}]);assert(Math.abs(crossing.emissions-empty.emissions-.16/2*(INTENSITY[4]+INTENSITY[5]))<1e-9,'Long uses sample both grid intensities');
const changedLane=evaluate(EXAMPLE.map(p=>p.id==='wash'?{...p,lane:1}:p));assert(Math.abs(changedLane.emissions-first.emissions)<1e-9,'Lane meaning must not alter power/carbon');
let seed=3900;const random=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
const signatures=new Set(),outcomes=new Set();
for(let i=0;i<3000;i++){
 const plan=[];
 for(const t of CORE_TASKS){
  const before=t.after?plan.find(p=>p.id===t.after):null;
  const choices=Array.from({length:SLOTS-t.duration+1},(_,s)=>s).filter(s=>insideWindow(t,s)&&canPlace(plan,t.id,s,t.lane)&&(!t.after||before&&s>=before.start+TASKS.find(q=>q.id===t.after).duration)&&(t.id!=='wash'||s<11));
  if(!choices.length)break;plan.push({id:t.id,start:choices[random(choices.length)],lane:t.lane});
 }
 if(plan.length!==CORE_TASKS.length)continue;const r=evaluate(plan);
 assert(r.valid,JSON.stringify(r.issues));assert(Math.abs(r.energy-TOTAL_ENERGY)<1e-9);signatures.add(plan.map(p=>p.start).join(','));outcomes.add(r.emissions.toFixed(4));
}
assert(signatures.size>1500);assert(outcomes.size>100);assert.equal(MODEL.lanes.length,3);assert.equal(MODEL.baseLoads.length,2);assert.equal(LANE_META[2].overlap,true);
console.log(JSON.stringify({passed:true,version:VERSION,lanes:LANE_META.map(l=>l.name),coreUses:CORE_TASKS.length,optionalUses:TASKS.length-CORE_TASKS.length,twoSlotUses:TASKS.filter(t=>t.duration===2).length,baseKWh:BASE_ENERGY,coreDayKWh:TOTAL_ENERGY,distinctValidTimes:signatures.size,outcomes:outcomes.size,exampleMaxConcurrency:first.maxConcurrentActivities,example:{kWh:first.energy,kgCO2e:first.emissions,highestSlotAverageKW:first.peak},revision:{kWh:second.energy,kgCO2e:second.emissions,highestSlotAverageKW:second.peak}},null,2));

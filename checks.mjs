import assert from 'node:assert/strict';
import {TASKS,TOTAL_ENERGY,EXAMPLE,evaluate,canPlace,INTENSITY,time} from './dist/engine.mjs';
const first=evaluate(EXAMPLE);
assert(first.valid,JSON.stringify(first.issues));
assert(Math.abs(first.energy-10.298)<1e-9);
assert.equal(INTENSITY.length,48);
assert(INTENSITY.every(value=>value>=0));
assert.equal(time(0),'00:00');assert.equal(time(47),'23:30');assert.equal(time(48),'24:00');
const revised=EXAMPLE.map(p=>({...p,start:({wash:20,dry:22,dish:26,render:28})[p.id]??p.start}));
const improved=evaluate(revised);
assert(improved.valid,JSON.stringify(improved.issues));
assert(Math.abs(improved.energy-first.energy)<1e-9);
assert(improved.emissions<first.emissions);
assert(improved.peak<first.peak);
assert(!evaluate([]).valid);
assert(!evaluate(EXAMPLE.filter(p=>p.id!=='dinner')).complete);
assert(!evaluate([...EXAMPLE,EXAMPLE[0]]).valid);
assert(evaluate(EXAMPLE.map(p=>p.id==='dry'?{...p,start:18}:p)).issues.some(i=>i.kind==='sequence'));
assert(evaluate(EXAMPLE.map(p=>p.id==='study'?{...p,start:35}:p)).issues.some(i=>i.kind==='fixed'));
assert(evaluate(EXAMPLE.map(p=>p.id==='dinner'?{...p,start:20}:p)).issues.some(i=>i.kind==='window'));
assert(!canPlace(EXAMPLE,'dry',36,2));
assert(!canPlace(EXAMPLE,'dry',47,0));
assert(!canPlace(EXAMPLE,'dry',24,5));
assert(canPlace(EXAMPLE,'dry',22,0));
for(const task of TASKS){
  const single=evaluate([{id:task.id,start:task.windows[0][0],lane:0}]);
  assert(Math.abs(single.energy-task.kw*task.duration/2)<1e-9);
}
console.log(JSON.stringify({passed:true,tasks:TASKS.length,totalKWh:TOTAL_ENERGY,first:{kgCO2e:first.emissions,peakKW:first.peak},revision:{kgCO2e:improved.emissions,peakKW:improved.peak},checks:'energy invariant; complete/partial/duplicate; windows; fixed time; precedence; collision; boundaries; emissions sum'},null,2));

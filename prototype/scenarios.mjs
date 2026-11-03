import {CATALOGUE,CATALOGUE_VERSION} from './catalogue.mjs?v=bowl-v5';
import {SLOTS,LANE_META,SLOT_LABELS,insideWindow,evaluate} from './engine.mjs?v=bowl-v5';
export const QUOTA={personal:3,household:3,background:4};
export const DURATION_PROFILE={personal:{one:2,two:1},household:{one:2,two:1},background:{one:2,two:2}};
export function rng(seed){let x=seed>>>0;return ()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};}
export function shuffle(items,random){const result=[...items];for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;}
function referencePlan(tasks,random){
 const map=Object.fromEntries(tasks.map(t=>[t.id,t])),plan=[];
 const order=[...tasks].sort((a,b)=>{if(a.id==='wash')return -1;if(b.id==='wash')return 1;if(a.id==='dry')return 1;if(b.id==='dry')return -1;return (a.windows[0][1]-a.windows[0][0])-(b.windows[0][1]-b.windows[0][0]);});
 function visit(i){if(i===order.length)return true;const t=order[i];for(const start of shuffle(Array.from({length:SLOTS-t.duration+1},(_,s)=>s),random)){
   if(!insideWindow(t,start))continue;
   if(t.after){const before=plan.find(p=>p.id===t.after);if(!before||start<before.start+map[t.after].duration)continue;}
   if(t.lane!==2&&plan.some(p=>p.lane===t.lane&&p.start<start+t.duration&&start<p.start+map[p.id].duration))continue;
   plan.push({id:t.id,start,lane:t.lane});if(visit(i+1))return true;plan.pop();
  }return false;}
 if(!visit(0))throw Error('No feasible reference day');return plan;
}
export function makeRounds(seed){
 const random=rng(seed),used=new Set(),rounds=[];
 for(let round=0;round<3;round++){
  let chosen=[];
  for(let lane=0;lane<3;lane++){
   const role=LANE_META[lane].id,profile=DURATION_PROFILE[role];
   for(const [span,count] of [[1,profile.one],[2,profile.two]]){
    let pool=CATALOGUE.filter(t=>t.lane===lane&&t.duration===span&&!used.has(t.id));
    if(lane===2&&span===1){
     const pair=pool.some(t=>t.id==='wash')&&pool.some(t=>t.id==='dry');
     if(pair&&random()<.4){chosen.push(...pool.filter(t=>['wash','dry'].includes(t.id)));continue;}
     pool=pool.filter(t=>t.id!=='dry');
    }
    const picked=shuffle(pool,random).slice(0,count);if(picked.length!==count)throw Error('Catalogue quota exhausted');chosen.push(...picked);
   }
  }
  chosen=chosen.map(t=>({...structuredClone(t),after:t.after&&chosen.some(q=>q.id===t.after)?t.after:undefined}));
  const witness=referencePlan(chosen,random);
  const tasks=chosen.map(t=>{
   const p=witness.find(p=>p.id===t.id),[a,b]=t.windows[0],width=Math.min(b-a,t.duration+3),lo=Math.max(a,p.start+t.duration-width),hi=Math.min(p.start,b-width),start=lo+Math.floor(random()*(hi-lo+1)),end=start+width;
   const rule=`Use within ${SLOT_LABELS[start]} → ${SLOT_LABELS[end-1]}${t.after?' · after washing':''}${t.duration===2?' · keep both slots together':''}`;
   return {...t,windows:[[start,end]],rule,roundRequestId:`day${round+1}-${t.id}`};
  });
  const scenario={id:`day-${round+1}-${seed.toString(16)}`,seed:seed>>>0,round:round+1,title:['Day 1 · A household day','Day 2 · A changed routine','Day 3 · Another new day'][round],brief:'Today’s requests have their own time windows. Check the labels on the tiles; a previous day’s arrangement may not work.',quota:QUOTA,durationProfile:DURATION_PROFILE,catalogueVersion:CATALOGUE_VERSION,tasks:shuffle(tasks,random),witness,drawOrder:tasks.map(t=>t.id),allocation:'seeded quota/duration-controlled draw without cross-round replacement; paired washing/drying handled together'};
  const check=evaluate(witness,scenario);if(!check.valid)throw Error('Generated day failed feasibility: '+JSON.stringify(check.issues));
  scenario.difficulty={uses:10,twoSlotUses:4,nominalLaneCounts:[3,3,4],totalUseEnergy:tasks.reduce((s,t)=>s+t.energy,0),availableStartCounts:tasks.map(t=>({id:t.id,choices:t.windows[0][1]-t.windows[0][0]-t.duration+1}))};
  tasks.forEach(t=>used.add(t.id));rounds.push(scenario);
 }
 return rounds;
}

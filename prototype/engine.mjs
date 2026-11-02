export const VERSION='daylight-coarse12-2026-11-02-v1';
export const LANES=5,SLOTS=12,STEP_HOURS=2,POWER_TARGET=4;
export const SLOT_LABELS=['Overnight','Late night','Pre-dawn','Early morning','Morning','Late morning','Midday','Afternoon','Late afternoon','Evening','Late evening','Bedtime'];
// Hypothetical broad-period intensities; not live data or a forecast.
export const INTENSITY=[.55,.55,.55,.65,.65,.25,.25,.25,.625,.8,.65,.5];
// A token is ONE USE within a period, not two hours of operation.
const task=(id,name,short,hours,kw,color,rule,extra={})=>({id,name,short,hours,kw,energy:hours*kw,duration:1,windows:[[0,12]],color,rule,note:'One use in this broad period; it does not fill the whole two hours.',...extra});
export const TASKS=[
 task('wash','Wash clothes','Wash',1,.5,'#70aaa7','Any time · before drying'),
 task('dry','Dry clothes','Dryer',1.5,1.8,'#589d99','A later slot than washing',{after:'wash'}),
 task('dish','Dishwasher','Dishes',1.5,.7,'#7494c5','Any time'),
 task('breakfast','Cook breakfast','Breakfast',.5,1.8,'#cc9771','Early morning or morning',{windows:[[3,5]]}),
 task('dinner','Cook dinner','Dinner',1,2.4,'#ce876b','Late afternoon, evening or late evening',{windows:[[8,11]]}),
 task('study','Online tutorial','Tutorial',2,.024,'#b19ac6','Any time · choose a session that suits you'),
 task('tv','Watch television','TV',2,.1,'#8a9ab6','Any time'),
 task('game','Gaming session','Gaming',2,.1,'#a59ec9','Any time'),
 task('heat','Warm the room','Heater',1,2,'#cf9a65','Any time · choose when warmth matters'),
 task('render','Computer render','Render',2,.15,'#899eb1','Any time · can run unattended')
];
export const BY_ID=Object.fromEntries(TASKS.map(t=>[t.id,t]));
export const TOTAL_ENERGY=TASKS.reduce((sum,t)=>sum+t.energy,0);
const clock=h=>`${String(h).padStart(2,'0')}:00`;
export function time(slot){return slot===SLOTS?'24:00':`${clock(slot*2)}–${clock((slot+1)*2)}`;}
export function insideWindow(task,start){return task.windows.some(([a,b])=>start>=a&&start<b);}
export function overlaps(a,b){return a.lane===b.lane&&a.start===b.start;}
export function evaluate(schedule){
 const issues=[],seen=new Set(),load=Array(SLOTS).fill(0),slotEmissions=Array(SLOTS).fill(0),placements=Array.isArray(schedule)?schedule:[];
 for(const p of placements){
  const t=BY_ID[p.id];
  if(!t){issues.push({id:p.id,kind:'unknown',message:'Unknown activity.'});continue;}
  if(seen.has(p.id)){issues.push({id:p.id,kind:'duplicate',message:`${t.name} is placed more than once.`});continue;}
  seen.add(p.id);
  if(!Number.isInteger(p.start)||!Number.isInteger(p.lane)||p.lane<0||p.lane>=LANES||p.start<0||p.start>=SLOTS){issues.push({id:p.id,kind:'bounds',message:`${t.name} is outside the board.`});continue;}
  if(!insideWindow(t,p.start))issues.push({id:p.id,kind:'window',message:`${t.name}: ${t.rule}.`});
  if(t.after){const before=placements.find(q=>q.id===t.after);if(!before||p.start<=before.start)issues.push({id:p.id,kind:'sequence',message:'Put the dryer in a later slot than the wash.'});}
  load[p.start]+=t.energy/STEP_HOURS;slotEmissions[p.start]+=t.energy*INTENSITY[p.start];
 }
 for(let i=0;i<placements.length;i++)for(let j=i+1;j<placements.length;j++)if(BY_ID[placements[i].id]&&BY_ID[placements[j].id]&&overlaps(placements[i],placements[j]))issues.push({id:placements[j].id,kind:'overlap',message:'Use a separate position for each token.'});
 const energy=load.reduce((a,b)=>a+b*STEP_HOURS,0),emissions=slotEmissions.reduce((a,b)=>a+b,0),peak=Math.max(0,...load),missing=TASKS.filter(t=>!seen.has(t.id));
 return {issues,missing,load,slotEmissions,energy,emissions,peak,complete:missing.length===0&&seen.size===TASKS.length,valid:missing.length===0&&seen.size===TASKS.length&&issues.length===0,scheduled:seen.size,total:TASKS.length,overTargetSlots:load.filter(v=>v>POWER_TARGET+1e-9).length,demandMeaning:'two-hour-slot-average-kW-not-instantaneous-peak'};
}
export function canPlace(schedule,id,start,lane){
 if(!BY_ID[id]||!Number.isInteger(start)||!Number.isInteger(lane)||start<0||start>=SLOTS||lane<0||lane>=LANES)return false;
 return !schedule.some(q=>q.id!==id&&BY_ID[q.id]&&overlaps({id,start,lane},q));
}
export const MODEL={version:VERSION,slots:SLOTS,lanes:LANES,slotHours:STEP_HOURS,slotLabels:SLOT_LABELS,intensity:INTENSITY,intensityUnit:'kgCO2e/kWh',demandMeaning:'Energy in each broad period divided by two hours; not instantaneous demand.',tokenMeaning:'One appliance use in a broad time period, not two hours of operation.',tasks:TASKS,kind:'illustrative-not-live'};
export const EXAMPLE=[{id:'breakfast',start:3,lane:0},{id:'wash',start:7,lane:0},{id:'dry',start:9,lane:0},{id:'dish',start:9,lane:1},{id:'dinner',start:9,lane:2},{id:'study',start:9,lane:3},{id:'tv',start:10,lane:0},{id:'game',start:10,lane:1},{id:'heat',start:9,lane:4},{id:'render',start:10,lane:2}];

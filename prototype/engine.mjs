export const VERSION = 'daylight-scheduling-2026-11-02';
export const LANES = 5;
export const SLOTS = 48;
export const STEP_HOURS = .5;
export const POWER_TARGET = 4;
// An explicitly illustrative study profile, not a live grid feed or a forecast.
export const INTENSITY = Array.from({length:48},(_,i)=>{
  const h=i/2;
  return h<6?.55:h<10?.65:h<16?.25:h<17?.45:h<21?.8:.5;
});
export const TASKS = [
  {id:'wash',name:'Wash clothes',short:'Wash',duration:2,kw:.5,windows:[[16,34]],color:'#70aaa7',rule:'1 hour · start after 08:00 · finish by 17:00',note:'Illustrative cycle-average power.'},
  {id:'dry',name:'Dry clothes',short:'Dryer',duration:3,kw:1.8,windows:[[16,40]],after:'wash',color:'#589d99',rule:'1½ hours · after washing · finish by 20:00',note:'Illustrative cycle-average power.'},
  {id:'dish',name:'Dishwasher',short:'Dishes',duration:3,kw:.7,windows:[[24,46]],color:'#7494c5',rule:'1½ hours · available from 12:00 · finish by 23:00',note:'1.05 kWh illustrative cycle, averaged over 1½ hours.'},
  {id:'breakfast',name:'Cook breakfast',short:'Cooktop',duration:1,kw:1.8,windows:[[12,18]],color:'#cc9771',rule:'30 minutes · between 06:00 and 09:00',note:'Scenario cooktop power: 1.8 kW.'},
  {id:'dinner',name:'Cook dinner',short:'Oven',duration:2,kw:2.4,windows:[[34,42]],color:'#ce876b',rule:'1 hour · between 17:00 and 21:00',note:'Scenario oven active-heating power: 2.4 kW.'},
  {id:'study',name:'Online tutorial',short:'Tutorial',duration:4,kw:.024,windows:[[36,40]],fixed:36,color:'#b19ac6',rule:'2 hours · fixed at 18:00–20:00',note:'Laptop only: 24 W. This commitment cannot move.'},
  {id:'tv',name:'Watch television',short:'TV',duration:4,kw:.1,windows:[[36,48]],color:'#8a9ab6',rule:'2 hours · between 18:00 and midnight',note:'Scenario TV power: 100 W.'},
  {id:'game',name:'Gaming session',short:'Gaming',duration:4,kw:.1,windows:[[32,48]],color:'#a59ec9',rule:'2 hours · between 16:00 and midnight',note:'Console only: 100 W; separate from TV activity.'},
  {id:'heat',name:'Warm the room',short:'Heater',duration:2,kw:2,windows:[[12,18],[36,46]],color:'#cf9a65',rule:'1 hour · 06:00–09:00 OR 18:00–23:00',note:'Scenario heater power: 2 kW, full power during its block.'},
  {id:'render',name:'Computer render',short:'PC render',duration:4,kw:.15,windows:[[18,44]],color:'#899eb1',rule:'2 hours · between 09:00 and 22:00',note:'Scenario desktop power: 150 W. Can run unattended.'}
];
export const BY_ID=Object.fromEntries(TASKS.map(t=>[t.id,t]));
export const TOTAL_ENERGY=TASKS.reduce((sum,t)=>sum+t.kw*t.duration*STEP_HOURS,0);
export function time(slot){return `${String(Math.floor(slot/2)).padStart(2,'0')}:${slot%2?'30':'00'}`;}
export function insideWindow(task,start){return task.windows.some(([a,b])=>start>=a&&start+task.duration<=b);}
export function overlaps(a,b){return a.lane===b.lane&&a.start<b.start+BY_ID[b.id].duration&&b.start<a.start+BY_ID[a.id].duration;}
export function evaluate(schedule){
  const issues=[],seen=new Set(),load=Array(SLOTS).fill(0),slotEmissions=Array(SLOTS).fill(0);
  const placements=Array.isArray(schedule)?schedule:[];
  for(const p of placements){
    const t=BY_ID[p.id];
    if(!t){issues.push({id:p.id,kind:'unknown',message:'Unknown activity.'});continue;}
    if(seen.has(p.id)){issues.push({id:p.id,kind:'duplicate',message:`${t.name} is scheduled more than once.`});continue;}
    seen.add(p.id);
    if(!Number.isInteger(p.start)||!Number.isInteger(p.lane)||p.lane<0||p.lane>=LANES||p.start<0||p.start+t.duration>SLOTS){issues.push({id:p.id,kind:'bounds',message:`${t.name} is outside the grid.`});continue;}
    if(!insideWindow(t,p.start))issues.push({id:p.id,kind:'window',message:`${t.name}: ${t.rule}`});
    if(t.fixed!==undefined&&p.start!==t.fixed)issues.push({id:p.id,kind:'fixed',message:`${t.name} must start at ${time(t.fixed)}.`});
    if(t.after){const before=placements.find(q=>q.id===t.after);if(!before||p.start<before.start+BY_ID[t.after].duration)issues.push({id:p.id,kind:'sequence',message:'The dryer must start after the washing finishes.'});}
    for(let s=p.start;s<p.start+t.duration;s++){load[s]+=t.kw;slotEmissions[s]+=t.kw*STEP_HOURS*INTENSITY[s];}
  }
  for(let i=0;i<placements.length;i++)for(let j=i+1;j<placements.length;j++){
    if(BY_ID[placements[i].id]&&BY_ID[placements[j].id]&&overlaps(placements[i],placements[j]))issues.push({id:placements[j].id,kind:'overlap',message:'Two activities overlap in the same lane.'});
  }
  const energy=load.reduce((a,b)=>a+b*STEP_HOURS,0),emissions=slotEmissions.reduce((a,b)=>a+b,0),peak=Math.max(0,...load);
  const missing=TASKS.filter(t=>!seen.has(t.id));
  return {issues,missing,load,slotEmissions,energy,emissions,peak,complete:missing.length===0&&seen.size===TASKS.length,valid:missing.length===0&&seen.size===TASKS.length&&issues.length===0,scheduled:seen.size,total:TASKS.length,overTargetSlots:load.filter(v=>v>POWER_TARGET+1e-9).length};
}
export function canPlace(schedule,id,start,lane){
  const t=BY_ID[id];if(!t||!Number.isInteger(start)||!Number.isInteger(lane)||start<0||start+t.duration>SLOTS||lane<0||lane>=LANES)return false;
  const p={id,start,lane};return !schedule.some(q=>q.id!==id&&BY_ID[q.id]&&overlaps(p,q));
}
export const EXAMPLE=[
  {id:'breakfast',start:14,lane:0},{id:'wash',start:32,lane:0},{id:'dry',start:34,lane:0},
  {id:'dish',start:38,lane:1},{id:'dinner',start:36,lane:2},{id:'study',start:36,lane:3},
  {id:'tv',start:40,lane:2},{id:'game',start:40,lane:3},{id:'heat',start:38,lane:4},{id:'render',start:34,lane:4}
];

import {CATALOGUE,CATALOGUE_VERSION} from './catalogue.mjs?v=bowl-v5';
export const VERSION='daylight-bowl-2026-11-03-v5',LANES=3,SLOTS=12,STEP_HOURS=2,POWER_TARGET=4;
export const LANE_META=[{id:'personal',name:'Personal',description:'Needs your attention',overlap:false},{id:'household',name:'Household',description:'Shared / another person',overlap:false},{id:'background',name:'Background',description:'Runs without attention',overlap:true}];
export const SLOT_LABELS=['Overnight','Late night','Pre-dawn','Early morning','Morning','Late morning','Midday','Afternoon','Late afternoon','Evening','Late evening','Bedtime'];
export const INTENSITY=[.55,.55,.55,.65,.65,.25,.25,.25,.625,.8,.65,.5];
export const BASE_LOADS=[{id:'fridge',name:'Fridge',kw:.06},{id:'router',name:'Wi-Fi router',kw:.012}];
export const BASE_KW=.072,BASE_ENERGY=BASE_KW*24;
export const MODEL_BASE={version:VERSION,catalogueVersion:CATALOGUE_VERSION,slots:SLOTS,lanes:LANE_META,slotHours:STEP_HOURS,slotLabels:SLOT_LABELS,intensity:INTENSITY,intensityUnit:'kgCO2e/kWh',baseLoads:BASE_LOADS,kind:'illustrative-not-live',demandMeaning:'Use energy in each period divided by two hours; not instantaneous demand.',laneMeaning:'Attention/household context, not power level.'};
export let TASKS=CATALOGUE,BY_ID=Object.fromEntries(TASKS.map(t=>[t.id,t])),CORE_TASKS=TASKS,TOTAL_ENERGY=BASE_ENERGY+TASKS.reduce((s,t)=>s+t.energy,0),MODEL={...MODEL_BASE,tasks:TASKS},ACTIVE_SCENARIO=null;
export function modelFor(scenario){return {...MODEL_BASE,tasks:scenario.tasks,scenarioId:scenario.id,quota:scenario.quota,durationProfile:scenario.durationProfile,scenarioSeed:scenario.seed,dayTitle:scenario.title};}
export function setScenario(scenario){ACTIVE_SCENARIO=scenario;TASKS=scenario.tasks;BY_ID=Object.fromEntries(TASKS.map(t=>[t.id,t]));CORE_TASKS=TASKS;TOTAL_ENERGY=BASE_ENERGY+TASKS.reduce((s,t)=>s+t.energy,0);MODEL=modelFor(scenario);}
const clock=h=>`${String(h).padStart(2,'0')}:00`;
export function time(slot){return slot===SLOTS?'24:00':`${clock(slot*2)}–${clock((slot+1)*2)}`;}
export function insideWindow(t,start){return t.windows.some(([a,b])=>start>=a&&start+t.duration<=b);}
function context(scenario){return scenario?{tasks:scenario.tasks,map:Object.fromEntries(scenario.tasks.map(t=>[t.id,t]))}:{tasks:TASKS,map:BY_ID};}
export function overlaps(a,b,map=BY_ID){return a.lane===b.lane&&a.start<b.start+map[b.id].duration&&b.start<a.start+map[a.id].duration;}
export function canPlace(schedule,id,start,lane,scenario=ACTIVE_SCENARIO){
 const {map}=context(scenario),t=map[id];if(!t||!Number.isInteger(start)||!Number.isInteger(lane)||start<0||start+t.duration>SLOTS||lane<0||lane>=LANES)return false;
 if(lane===2&&!t.unattended)return false;
 return LANE_META[lane].overlap||!schedule.some(q=>q.id!==id&&map[q.id]&&overlaps({id,start,lane},q,map));
}
export function evaluate(schedule,scenario=ACTIVE_SCENARIO){
 const {tasks,map}=context(scenario),issues=[],seen=new Set(),load=Array(SLOTS).fill(BASE_KW),slotEmissions=INTENSITY.map(i=>BASE_KW*STEP_HOURS*i),activityCounts=Array(SLOTS).fill(0),laneEnergy=[0,0,0],placements=Array.isArray(schedule)?schedule:[];
 for(const p of placements){
  const t=map[p.id];if(!t){issues.push({id:p.id,kind:'unknown',message:'This tile is not in today’s draw.'});continue;}
  if(seen.has(p.id)){issues.push({id:p.id,kind:'duplicate',message:`${t.name} is placed twice.`});continue;}seen.add(p.id);
  if(!Number.isInteger(p.start)||!Number.isInteger(p.lane)||p.start<0||p.start+t.duration>SLOTS||p.lane<0||p.lane>=LANES){issues.push({id:p.id,kind:'bounds',message:`${t.name} is outside the day.`});continue;}
  if(!insideWindow(t,p.start))issues.push({id:p.id,kind:'window',message:`${t.name}: ${t.rule}`});
  if(p.lane===2&&!t.unattended)issues.push({id:p.id,kind:'attention',message:`${t.name} needs a person.`});
  if(t.after){const before=placements.find(q=>q.id===t.after);if(!before||p.start<before.start+map[t.after].duration)issues.push({id:p.id,kind:'sequence',message:'Drying must follow washing.'});}
  laneEnergy[p.lane]+=t.energy;for(let s=p.start;s<p.start+t.duration;s++){load[s]+=t.energy/t.duration/STEP_HOURS;slotEmissions[s]+=t.energy/t.duration*INTENSITY[s];activityCounts[s]++;}
 }
 for(let i=0;i<placements.length;i++)for(let j=i+1;j<placements.length;j++)if(map[placements[i].id]&&map[placements[j].id]&&!LANE_META[placements[i].lane]?.overlap&&overlaps(placements[i],placements[j],map))issues.push({id:placements[j].id,kind:'overlap',message:'Two uses need the same person at once. Move one or assign another person.'});
 const missing=tasks.filter(t=>!seen.has(t.id)),energy=load.reduce((s,v)=>s+v*STEP_HOURS,0),emissions=slotEmissions.reduce((s,v)=>s+v,0),peak=Math.max(...load),complete=missing.length===0,valid=complete&&issues.length===0;
 const independentBounds=tasks.reduce((b,t)=>{const candidates=[];for(let s=0;s+t.duration<=SLOTS;s++)if(insideWindow(t,s))candidates.push(t.energy/t.duration*INTENSITY.slice(s,s+t.duration).reduce((a,v)=>a+v,0));return {lower:b.lower+Math.min(...candidates),upper:b.upper+Math.max(...candidates)};},{lower:0,upper:0});
 const baseEmissions=BASE_KW*STEP_HOURS*INTENSITY.reduce((s,v)=>s+v,0),range=independentBounds.upper-independentBounds.lower;
 return {issues,missing,load,slotEmissions,energy,emissions,peak,complete,valid,scheduled:seen.size,total:tasks.length,coreScheduled:tasks.length-missing.length,coreTotal:tasks.length,optionalScheduled:0,overTargetSlots:load.filter(v=>v>POWER_TARGET).length,laneEnergy,activityCounts,concurrentSlots:activityCounts.filter(n=>n>1).length,maxConcurrentActivities:Math.max(0,...activityCounts),baseEnergy:BASE_ENERGY,scenarioId:scenario?.id,independentBounds:{...independentBounds,kind:'per-use-intensity-bounds-ignore-contention-and-dependencies'},timingOpportunityUsed:valid&&range>1e-9?Math.max(0,Math.min(1,(independentBounds.upper-(emissions-baseEmissions))/range)):null,demandMeaning:'two-hour-slot-average-kW-not-instantaneous-peak'};
}

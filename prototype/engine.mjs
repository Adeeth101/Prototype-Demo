export const VERSION='daylight-three-lanes-2026-11-02-v2';
export const LANES=3,SLOTS=12,STEP_HOURS=2,POWER_TARGET=4;
export const LANE_META=[
 {id:'personal',name:'Personal',description:'Needs your attention',overlap:false},
 {id:'household',name:'Household',description:'Shared / another person',overlap:false},
 {id:'background',name:'Background',description:'Runs without attention',overlap:true}
];
export const SLOT_LABELS=['Overnight','Late night','Pre-dawn','Early morning','Morning','Late morning','Midday','Afternoon','Late afternoon','Evening','Late evening','Bedtime'];
// All powers, use durations and grid intensities are illustrative scenario inputs.
export const INTENSITY=[.55,.55,.55,.65,.65,.25,.25,.25,.625,.8,.65,.5];
export const BASE_LOADS=[{id:'fridge',name:'Fridge',kw:.06},{id:'router',name:'Wi-Fi router',kw:.012}];
export const BASE_KW=BASE_LOADS.reduce((s,t)=>s+t.kw,0),BASE_ENERGY=BASE_KW*24;
const task=(id,name,short,hours,kw,lane,color,rule,extra={})=>({id,name,short,hours,kw,lane,unattended:lane===2||['heat','lights','fan'].includes(id),energy:hours*kw,duration:hours>2?2:1,required:true,windows:[[0,12]],color,rule,note:'Energy is spread across its board span. One-slot uses may run for less than two hours.',...extra});
export const TASKS=[
 task('breakfast','Cook breakfast','Breakfast',.5,1.8,0,'#cc9771','Early morning or morning',{windows:[[3,5]]}),
 task('dinner','Cook dinner','Dinner',1,2.4,0,'#ce876b','Late afternoon, evening or late evening',{windows:[[8,11]]}),
 task('study','Study / online class','Study',4,.04,0,'#b19ac6','Any time · two consecutive slots'),
 task('tv','Watch television','TV',4,.1,0,'#8a9ab6','Any time · two consecutive slots'),
 task('game','Gaming session','Gaming',2,.1,0,'#a59ec9','Any time'),
 task('heat','Warm the room','Heating',4,.8,1,'#cf9a65','Any time · two consecutive slots'),
 task('wash','Wash clothes','Wash',1,.5,2,'#70aaa7','Any time · before drying'),
 task('dry','Dry clothes','Dryer',1.5,1.8,2,'#589d99','A later slot than washing',{after:'wash'}),
 task('dish','Dishwasher','Dishes',1.5,.7,2,'#7494c5','Any time · runs by itself'),
 task('render','Computer background job','PC job',4,.15,2,'#899eb1','Any time · two consecutive slots'),
 task('lunch','Cook lunch','Lunch',.5,1.8,1,'#c8a17c','Any time',{required:false}),
 task('work','Work from home','Work',4,.06,0,'#91a6c7','Any time · two consecutive slots',{required:false}),
 task('lights','Living-room lighting','Lights',4,.06,1,'#d3bb77','Any time · two consecutive slots',{required:false}),
 task('fan','Cooling fan','Fan',4,.05,1,'#93b9ae','Any time · two consecutive slots',{required:false}),
 task('ev','Charge an electric car','Car charge',4,1.8,2,'#93ad79','Any time · two consecutive slots',{required:false}),
 task('phone','Charge phones / devices','Devices',4,.005,2,'#9ab1a7','Any time · two consecutive slots',{required:false}),
 task('robot','Robot vacuum','Robot',2,.025,2,'#afa68e','Any time · runs by itself',{required:false}),
 task('water','Heat water tank','Hot water',2,1.2,2,'#ba9b88','Any time · runs by itself',{required:false})
];
export const BY_ID=Object.fromEntries(TASKS.map(t=>[t.id,t]));
export const CORE_TASKS=TASKS.filter(t=>t.required);
export const TOTAL_ENERGY=BASE_ENERGY+CORE_TASKS.reduce((s,t)=>s+t.energy,0);
const clock=h=>`${String(h).padStart(2,'0')}:00`;
export function time(slot){return slot===SLOTS?'24:00':`${clock(slot*2)}–${clock((slot+1)*2)}`;}
export function insideWindow(t,start){return t.windows.some(([a,b])=>start>=a&&start+t.duration<=b);}
export function overlaps(a,b){return a.lane===b.lane&&a.start<b.start+BY_ID[b.id].duration&&b.start<a.start+BY_ID[a.id].duration;}
export function canPlace(schedule,id,start,lane){
 const t=BY_ID[id];if(!t||!Number.isInteger(start)||!Number.isInteger(lane)||start<0||start+t.duration>SLOTS||lane<0||lane>=LANES)return false;
 if(lane===2&&!t.unattended)return false;
 return LANE_META[lane].overlap||!schedule.some(q=>q.id!==id&&BY_ID[q.id]&&overlaps({id,start,lane},q));
}
export function evaluate(schedule){
 const issues=[],seen=new Set(),load=Array(SLOTS).fill(BASE_KW),slotEmissions=INTENSITY.map(i=>BASE_KW*STEP_HOURS*i),activityCounts=Array(SLOTS).fill(0),laneEnergy=Array(LANES).fill(0),placements=Array.isArray(schedule)?schedule:[];
 for(const p of placements){
  const t=BY_ID[p.id];
  if(!t){issues.push({id:p.id,kind:'unknown',message:'Unknown activity.'});continue;}
  if(seen.has(p.id)){issues.push({id:p.id,kind:'duplicate',message:`${t.name} is placed more than once.`});continue;}
  seen.add(p.id);
  if(!Number.isInteger(p.start)||!Number.isInteger(p.lane)||p.lane<0||p.lane>=LANES||p.start<0||p.start+t.duration>SLOTS){issues.push({id:p.id,kind:'bounds',message:`${t.name} is outside the board.`});continue;}
  if(!insideWindow(t,p.start))issues.push({id:p.id,kind:'window',message:`${t.name}: ${t.rule}.`});
  if(p.lane===2&&!t.unattended)issues.push({id:p.id,kind:'attention',message:`${t.name} needs a person. Use Personal or Household.`});
  if(t.after){const before=placements.find(q=>q.id===t.after);if(!before||p.start<before.start+BY_ID[t.after].duration)issues.push({id:p.id,kind:'sequence',message:'Put drying after the washing tile finishes.'});}
  laneEnergy[p.lane]+=t.energy;
  for(let s=p.start;s<p.start+t.duration;s++){load[s]+=t.energy/t.duration/STEP_HOURS;slotEmissions[s]+=t.energy/t.duration*INTENSITY[s];activityCounts[s]++;}
 }
 for(let i=0;i<placements.length;i++)for(let j=i+1;j<placements.length;j++)if(BY_ID[placements[i].id]&&BY_ID[placements[j].id]&&!LANE_META[placements[i].lane]?.overlap&&overlaps(placements[i],placements[j]))issues.push({id:placements[j].id,kind:'overlap',message:`Two activities need the same attention lane. Move one, use Household for another person, or Background if it runs by itself.`});
 const missing=CORE_TASKS.filter(t=>!seen.has(t.id)),energy=load.reduce((s,x)=>s+x*STEP_HOURS,0),emissions=slotEmissions.reduce((s,x)=>s+x,0),peak=Math.max(...load),coreScheduled=CORE_TASKS.filter(t=>seen.has(t.id)).length;
 return {issues,missing,load,slotEmissions,energy,emissions,peak,complete:missing.length===0,valid:missing.length===0&&issues.length===0,scheduled:seen.size,total:TASKS.length,coreScheduled,coreTotal:CORE_TASKS.length,optionalScheduled:seen.size-coreScheduled,overTargetSlots:load.filter(v=>v>POWER_TARGET+1e-9).length,laneEnergy,activityCounts,concurrentSlots:activityCounts.filter(n=>n>1).length,maxConcurrentActivities:Math.max(0,...activityCounts),baseEnergy:BASE_ENERGY,demandMeaning:'two-hour-slot-average-kW-not-instantaneous-peak'};
}
export const MODEL={version:VERSION,slots:SLOTS,lanes:LANE_META,slotHours:STEP_HOURS,slotLabels:SLOT_LABELS,intensity:INTENSITY,intensityUnit:'kgCO2e/kWh',baseLoads:BASE_LOADS,demandMeaning:'Energy in each broad period divided by two hours; not instantaneous demand.',tokenMeaning:'A one-slot tile represents one use; two-slot tiles run across four hours. Actual use energy is spread evenly across occupied periods.',laneMeaning:'Participant chooses attention/household context, not a power rating. Personal and Household each hold one activity at a time; unattended Background activities can overlap.',tasks:TASKS,kind:'illustrative-not-live'};
export const EXAMPLE=[
 {id:'breakfast',start:3,lane:0},{id:'dinner',start:9,lane:0},{id:'study',start:5,lane:0},{id:'tv',start:10,lane:0},{id:'game',start:8,lane:0},
 {id:'heat',start:9,lane:1},{id:'wash',start:8,lane:2},{id:'dry',start:9,lane:2},{id:'dish',start:9,lane:2},{id:'render',start:8,lane:2},
 {id:'lights',start:9,lane:2},{id:'ev',start:9,lane:2},{id:'phone',start:10,lane:2}
];

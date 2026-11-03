import {VERSION,MODEL,CORE_TASKS,evaluate} from './engine.mjs?v=learning-v4';
export const DEMO_VERSION='daylight-learning-2026-11-03-v4';
export const PHASES=['initial','guided','final','complete'];
export const clone=value=>JSON.parse(JSON.stringify(value));
export function newSession(at=new Date().toISOString()){
 return {version:VERSION,demoVersion:DEMO_VERSION,model:clone(MODEL),phase:'initial',mode:'blind',schedule:[],baseline:null,guided:null,final:null,finalPool:null,runs:[],events:[],startedAt:at,phaseStartedAt:at};
}
export function advanceSession(previous,at=new Date().toISOString()){
 if(previous.phase==='complete')return clone(previous);
 const state=clone(previous),run={phase:state.phase,mode:state.mode,helpShown:state.phase==='guided',startedAt:state.phaseStartedAt,at,schedule:clone(state.schedule),metrics:evaluate(state.schedule)};
 state.runs.push(run);
 if(state.phase==='initial'){state.baseline=run;state.phase='guided';state.mode='feedback';}
 else if(state.phase==='guided'){state.guided=run;state.finalPool=[...new Set([...CORE_TASKS.map(t=>t.id),...state.schedule.map(p=>p.id)])];state.schedule=[];state.phase='final';state.mode='blind';}
 else{state.final=run;state.phase='complete';state.mode='feedback';}
 state.phaseStartedAt=at;
 return state;
}
export function comparison(a,b){
 if(!a||!b)return {comparable:false,reason:'Both plans must be saved.'};
 if(!a.metrics.valid||!b.metrics.valid)return {comparable:false,reason:'At least one plan is unfinished or does not meet the activity rules.'};
 const ids=r=>r.schedule.map(p=>p.id).sort().join(',');
 if(ids(a)!==ids(b))return {comparable:false,reason:'The selected activities differ, so the change includes both selection and timing.'};
 return {comparable:true,emissionsSaved:a.metrics.emissions-b.metrics.emissions,peakChange:b.metrics.peak-a.metrics.peak,energy:b.metrics.energy};
}

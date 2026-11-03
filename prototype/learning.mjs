import {VERSION,MODEL_BASE,modelFor,evaluate} from './engine.mjs?v=bowl-v5';
import {CATALOGUE,CATALOGUE_VERSION} from './catalogue.mjs?v=bowl-v5';
import {makeRounds,rng,shuffle} from './scenarios.mjs?v=bowl-v5';
export const DEMO_VERSION='daylight-bowl-learning-2026-11-03-v5';
export const CHECKIN_VERSION='daylight-custom-round-checkin-v1';
export const PHASES=['initial','guided','final','complete'];
export const CHECKIN_ITEMS=[
 {id:'confidence',text:'How confident are you that you could plan a different day without energy guidance?',low:'Not at all confident',high:'Very confident',construct:'perceived independent planning confidence'},
 {id:'effort',text:'How much mental effort did arranging this day take?',low:'Very little effort',high:'Very much effort',construct:'self-reported effort, custom single item'},
 {id:'convenience',text:'How convenient was moving and placing the tiles?',low:'Very inconvenient',high:'Very convenient',construct:'interaction convenience'},
 {id:'willingness',text:'How willing would you be to use this for another household day?',low:'Not at all willing',high:'Very willing',construct:'willingness to engage'}
];
export const clone=value=>JSON.parse(JSON.stringify(value));
export function currentDay(s){return s.rounds[s.roundIndex];}
function quizFor(day){
 const random=rng((day.seed+day.round*983)>>>0);
 if(day.round===2)return {id:'demand-parallel-jobs-v1',construct:'load spreading while retaining needs',prompt:'Two necessary uses each need 2 kWh. Period A and Period B have the same grid intensity. Which plan spreads demand without dropping a need?',options:shuffle([{id:'together',text:'Run both in Period A.'},{id:'spread',text:'Run one in A and one in B.'},{id:'omit',text:'Leave one use out.'}],random),correctId:'spread',explanation:'Spreading the same two uses across periods lowers the stacked demand while retaining both needs. Equal intensity keeps their modelled emissions the same.'};
 const values=day.round===1?[.7,.25,.5]:[.3,.8,.6],labels=['A','B','C'],correct=values.indexOf(Math.min(...values));
 return {id:'carbon-pattern-form-'+day.round,construct:'carbon-intensity application',prompt:`A flexible use needs 2 kWh and fits in any period. Grid intensity is A: ${values[0]}, B: ${values[1]}, C: ${values[2]} kg CO₂e/kWh. Which choice has the lowest modelled emissions while still doing the use?`,options:shuffle(labels.map((x,i)=>({id:x,text:'Run it in Period '+x+'.'})),random),correctId:labels[correct],explanation:'For the same energy use, the lower grid intensity gives lower modelled emissions. The appliance still uses 2 kWh.',values};
}
export function newSession(at=new Date().toISOString(),seed=crypto.getRandomValues(new Uint32Array(1))[0]){
 const rounds=makeRounds(seed).map(d=>({...d,quiz:quizFor(d)}));
 return {version:VERSION,demoVersion:DEMO_VERSION,seed:seed>>>0,catalogueVersion:CATALOGUE_VERSION,catalogue:clone(CATALOGUE),rounds,roundIndex:0,phase:'initial',substep:'draw',mode:'blind',model:modelFor(rounds[0]),schedule:[],drawn:[],drawLog:[],drawStartedAt:at,arrangeStartedAt:null,checkinStartedAt:null,checkinDraft:{},baseline:null,guided:null,final:null,runs:[],checkins:[],events:[],startedAt:at,phaseStartedAt:at,checkinSpecification:{version:CHECKIN_VERSION,items:CHECKIN_ITEMS,kind:'custom descriptive items, not validated scales; separate from SUS'}};
}
export function drawTask(previous,lane,position=0,at=new Date().toISOString(),automatic=false){
 const s=clone(previous);if(s.substep!=='draw')return s;
 if(!Number.isInteger(position)||position<0||position>7||s.drawLog.some(p=>p.lane===lane&&p.position===position))return s;
 const remaining=currentDay(s).tasks.filter(t=>t.lane===lane&&!s.drawn.includes(t.id));if(!remaining.length)return s;
 const t=remaining[Math.abs(position)%remaining.length];s.drawn.push(t.id);s.drawLog.push({id:t.id,lane,position,at,automatic});return s;
}
export function drawAll(previous,at=new Date().toISOString()){
 let s=clone(previous);for(let lane=0;lane<3;lane++)for(let i=0;i<8;i++)s=drawTask(s,lane,i,at,true);return s;
}
export function startPlan(previous,at=new Date().toISOString()){
 const s=clone(previous);if(s.substep!=='draw')return s;if(s.drawn.length!==10)throw new TypeError('Draw all 10 tiles first.');s.substep='arrange';s.arrangeStartedAt=at;s.mode=s.phase==='guided'?'feedback':'blind';return s;
}
export function savePlan(previous,at=new Date().toISOString()){
 const s=clone(previous);if(s.substep!=='arrange')return s;const day=currentDay(s),run={phase:s.phase,round:day.round,scenario:clone(day),model:modelFor(day),helpShown:s.phase==='guided',drawStartedAt:s.drawStartedAt,arrangeStartedAt:s.arrangeStartedAt,at,schedule:clone(s.schedule),drawn:[...s.drawn],drawLog:clone(s.drawLog),metrics:evaluate(s.schedule,day)};
 s.runs.push(run);s[s.phase==='initial'?'baseline':s.phase==='guided'?'guided':'final']=run;s.substep='checkin';s.mode='blind';s.checkinStartedAt=at;s.checkinDraft={};return s;
}
export function submitCheckin(previous,answers={},at=new Date().toISOString()){
 const s=clone(previous);if(s.substep!=='checkin')return s;const day=currentDay(s),ratings={};
 for(const item of CHECKIN_ITEMS){const value=answers[item.id];ratings[item.id]=Number.isInteger(value)&&value>=1&&value<=5?value:null;}
 const option=day.quiz.options.find(o=>o.id===answers.quiz),quizAnswer=option?.id||null;
 s.checkins.push({version:CHECKIN_VERSION,round:day.round,phase:s.phase,scenarioId:day.id,helpWasShown:s.phase==='guided',startedAt:s.checkinStartedAt,at,ratings,quiz:{...clone(day.quiz),answerId:quizAnswer,correct:quizAnswer===null?null:quizAnswer===day.quiz.correctId},comment:String(answers.comment||'').slice(0,3000)});
 if(s.roundIndex===2){s.phase='complete';s.substep='summary';s.mode='feedback';}
 else{s.roundIndex++;s.phase=PHASES[s.roundIndex];s.substep='draw';s.mode='blind';s.schedule=[];s.drawn=[];s.drawLog=[];s.drawStartedAt=at;s.arrangeStartedAt=null;s.checkinStartedAt=null;s.checkinDraft={};s.phaseStartedAt=at;s.model=modelFor(currentDay(s));}
 return s;
}
export function comparison(a,b){
 if(!a||!b)return {comparable:false,reason:'Both plans must be saved.'};
 if(a.scenario.id!==b.scenario.id)return {comparable:false,reason:'These are different days with different uses and time windows. Their raw energy/emissions totals are not a learning score.'};
 if(!a.metrics.valid||!b.metrics.valid)return {comparable:false,reason:'At least one plan is unfinished or breaks a rule.'};
 return {comparable:true,emissionsSaved:a.metrics.emissions-b.metrics.emissions};
}

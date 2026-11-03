import assert from 'node:assert/strict';
import {newSession,currentDay,drawTask,drawAll,startPlan,savePlan,submitCheckin,comparison,CHECKIN_ITEMS} from './prototype/learning.mjs?v=bowl-v5';
import {setScenario} from './prototype/engine.mjs?v=bowl-v5';
import {grabOffset,hitTarget,dropState,backgroundTracks} from './prototype/drag-model.mjs?v=bowl-v5';
const clone=x=>JSON.parse(JSON.stringify(x));
let s=newSession('2026-11-03T00:00:00Z',3900);assert.equal(s.substep,'draw');assert.equal(s.mode,'blind');assert.throws(()=>startPlan(s),TypeError);
const before=JSON.stringify(s);s=drawTask(s,0,7);assert.equal(JSON.parse(before).drawn.length,0,'Previous state immutable');assert.equal(s.drawn.length,1);assert.equal(drawTask(s,0,7).drawn.length,1,'Same covered pick cannot be used twice');
s=drawAll(s);assert.equal(s.drawn.length,10);assert.equal(new Set(s.drawLog.map(p=>p.lane+':'+p.position)).size,10);assert.deepEqual([0,1,2].map(l=>s.drawLog.filter(p=>p.lane===l).length),[3,3,4]);
let firstRun;
for(let round=0;round<3;round++){
 if(round>0){assert.equal(s.schedule.length,0);assert.equal(s.drawn.length,0);s=drawAll(s);}
 s=startPlan(s);assert.equal(s.substep,'arrange');assert.equal(s.mode,round===1?'feedback':'blind');s.schedule=clone(currentDay(s).witness);
 const original=JSON.stringify(s);let saved=savePlan(s);assert.equal(JSON.stringify(s),original);assert.equal(saved.substep,'checkin');assert.equal(saved.mode,'blind');assert.equal(saved.runs.length,round+1);assert.equal(savePlan(saved).runs.length,round+1,'No duplicate run');
 if(round===0)firstRun=clone(saved.runs[0]);
 const answers=round===0?{}:{confidence:4,effort:2,convenience:5,willingness:3,quiz:currentDay(saved).quiz.correctId,comment:'Synthetic test'};
 s=submitCheckin(saved,answers);assert.deepEqual(s.runs[0],firstRun,'Later draws/check-ins cannot mutate original plan');
}
assert.equal(s.phase,'complete');assert.equal(s.substep,'summary');assert.equal(s.runs.length,3);assert.equal(s.checkins.length,3);assert.deepEqual(s.runs.map(r=>r.helpShown),[false,true,false]);
assert.equal(s.checkins[0].ratings.confidence,null);assert.equal(s.checkins[0].quiz.correct,null);assert.equal(s.checkins[1].quiz.correct,true);assert.equal(s.checkins[2].quiz.construct,'carbon-intensity application');assert.equal(s.checkins[1].quiz.construct,'load spreading while retaining needs');assert.equal(CHECKIN_ITEMS.length,4);
assert.equal(submitCheckin(s).checkins.length,3);assert.equal(comparison(s.baseline,s.final).comparable,false,'Different-day totals must not become a learning gain');
let partial=startPlan(drawAll(newSession(undefined,42)));partial=savePlan(partial);assert(!partial.runs[0].metrics.valid);assert.equal(submitCheckin(partial).roundIndex,1,'Unfinished plans and skipped items never trap participant');
const day=s.rounds[0];setScenario(day);const long=day.tasks.find(t=>t.duration===2),attended=day.tasks.find(t=>!t.unattended);assert.equal(grabOffset(170,100,100,2),1);
const rect={left:100,top:50,width:700},heights=[92,92,158];assert.equal(hitTarget(503,75,rect,100,heights,1).start,5);assert.equal(hitTarget(150,100,rect,100,heights),null);
assert(!dropState([],long.id,11,long.lane).allowed);assert(!dropState([],attended.id,5,2).allowed);
const t=day.tasks.find(t=>t.windows[0][0]>0),badStart=0;assert.equal(dropState([],t.id,badStart,t.lane,false).tone,'fits');assert.equal(dropState([],t.id,badStart,t.lane,true).tone,'warning','Timing hints only aided');
assert(backgroundTracks(day.witness).count>=1);
console.log('PASS: draw quotas/position handling/resume data; draw -> arrange -> optional check-in x3; phase and help exposure; immutable original days; no duplicate submission; null skips; separate custom constructs/pattern items; no raw cross-day learning gain; partial exits; long-tile drag and unaided cue guards.');

import {VERSION,LANES,LANE_META,BASE_ENERGY,SLOTS,INTENSITY,SLOT_LABELS,TASKS,BY_ID,POWER_TARGET,time,evaluate,canPlace,setScenario} from './engine.mjs?v=bowl-v5';
import {DEMO_VERSION,CHECKIN_ITEMS,currentDay,newSession,drawTask,drawAll,startPlan,savePlan,submitCheckin,comparison,clone} from './learning.mjs?v=bowl-v5';
import {createInteractions} from './interactions.mjs?v=bowl-v5';
const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);
const KEY='daylight-portal-prototype-'+(params.get('session')||'standalone'),IS_TEST=params.get('test')==='1';
let state=newSession(),selected=null,editing=null,toastTimer,lastReason='',renderedCheckinId=null;
try{const saved=JSON.parse(localStorage.getItem(KEY));if(saved?.version===VERSION&&saved.demoVersion===DEMO_VERSION)state=saved;else if(saved)state.earlierDemonstrations=[saved];}catch{}
setScenario(currentDay(state));
const fmt=(n,d=2)=>n.toFixed(d),isEditing=()=>state.substep==='arrange';
const duration=t=>t.duration===2?'2 slots · 4h':'1 slot';
function persist(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch{toast('Keep this page open until your responses are submitted. Browser storage is unavailable.');}}
function notifyParent(type='prototype-update'){if(window.parent!==window)window.parent.postMessage({source:'daylight-prototype',type,state:clone(state),height:Math.ceil(document.querySelector('main').getBoundingClientRect().height)},location.origin);}
function record(type,detail={}){state.events.push({at:new Date().toISOString(),elapsedMs:Date.now()-new Date(state.startedAt).getTime(),phase:state.phase,round:state.roundIndex+1,scenarioId:currentDay(state).id,substep:state.substep,mode:state.mode,helpShown:state.mode==='feedback'&&state.substep==='arrange',type,...detail,schedule:clone(state.schedule)});persist();notifyParent();}
function toast(message,action){const box=$('toast');box.replaceChildren(document.createTextNode(message));if(action){const button=document.createElement('button');button.textContent='Undo';button.onclick=action;box.append(button);}box.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>box.classList.remove('show'),action?7500:4500);}
function hint(message){$('selectionHint').textContent=message|| (selected?`${BY_ID[selected].name} selected · drag or click a recessed slot. Drag a placed tile left to return it to the tray.`:'Drag a tile into a recessed slot. Drag it left into the tray to remove it. Click a tile to edit.');}
const dragUI=createInteractions({getState:()=>state,getSelected:()=>selected,setSelected:id=>selected=id,place,remove:removeTile,record,hint});
function buildGrid(){
 $('timeAxis').innerHTML='<span>ATTENTION</span>'+SLOT_LABELS.map((label,s)=>`<span><strong>${label}</strong><small>${time(s)}</small></span>`).join('');
 $('gridBody').innerHTML=Array.from({length:LANES},(_,lane)=>`<div class="lane"><div class="lane-name"><strong>${LANE_META[lane].name}</strong><small>${LANE_META[lane].description}</small></div><div class="lane-cells">${Array.from({length:SLOTS},(_,s)=>`<div class="slot ${INTENSITY[s]<=.3?'daylight':INTENSITY[s]>=.625?'evening':''}" data-lane="${lane}" data-slot="${s}" title="${LANE_META[lane].name} · ${SLOT_LABELS[s]}"></div>`).join('')}</div></div>`).join('');
 // The preview is transient; replacing grid children must not detach its node.
 gridPreviewReattach();
}
function gridPreviewReattach(){dragUI.reattach();}
function place(id,start,lane,via='editor'){
 if(!isEditing())return false;
 if(!state.drawn.includes(id)){toast('Use a tile drawn for this day.');return false;}
 if(!canPlace(state.schedule,id,start,lane)){record('placement-rejected',{id,start,lane,via});toast(lane===2&&!BY_ID[id]?.unattended?'This needs a person. Use Personal or Household.':'The lane is occupied or the whole tile does not fit. Try another slot.');return false;}
 const before=state.schedule.find(p=>p.id===id),metrics=evaluate(state.schedule);
 state.schedule=state.schedule.filter(p=>p.id!==id).concat({id,start,lane});
 record(before?'move':'place',{id,start,lane,via,previous:before?clone(before):null});selected=null;
 if(state.phase==='guided'){const after=evaluate(state.schedule);lastReason=before?`${BY_ID[id].name}: moving the same use ${after.emissions<metrics.emissions?'lowered':after.emissions>metrics.emissions?'raised':'kept'} modelled emissions${after.emissions!==metrics.emissions?' by '+fmt(Math.abs(after.emissions-metrics.emissions))+' kg CO₂e':''}. Its energy stays the same.`:'A use was added. Total energy can rise; compare timing using the same activities.';}
 render();return true;
}
function removeTile(id,via='editor'){
 if(!isEditing())return;const previous=state.schedule.find(p=>p.id===id);if(!previous)return;
 const phase=state.phase,dayId=currentDay(state).id;state.schedule=state.schedule.filter(p=>p.id!==id);selected=null;record('remove',{id,via,previous:clone(previous)});
 lastReason='Returning a use to the tray removes its energy. To learn about timing, compare plans with the same uses.';render();
 toast(BY_ID[id].name+' returned to the tray.',()=>{if(state.phase!==phase||!isEditing()||currentDay(state).id!==dayId){toast('That day’s step is saved. The removal remains recorded.');return;}if(canPlace(state.schedule,id,previous.start,previous.lane)){state.schedule.push(previous);record('undo-remove',{id,previous});render();toast('Tile restored.');}else toast('That position is occupied now. Place the tile from the tray.');});
}
function renderLibrary(){
 $('taskLibrary').replaceChildren();
 const available=TASKS.filter(t=>state.drawn.includes(t.id));
 for(const task of available){

  const placed=state.schedule.some(p=>p.id===task.id),button=document.createElement('button');
  button.className='task-card'+(placed?' placed':'')+(selected===task.id?' active':'');button.style.setProperty('--task-color',task.color);button.draggable=isEditing();button.disabled=!isEditing();
  button.setAttribute('aria-pressed',String(selected===task.id));button.dataset.id=task.id;
  button.innerHTML=`<span class="tile-grip" aria-hidden="true">⠿</span><span class="task-title">${task.name}<b>${placed?'✓':'+'}</b></span><span class="task-meta">${duration(task)}${state.mode==='feedback'?' · '+fmt(task.energy)+' kWh':''}</span><span class="task-rule">${LANE_META[task.lane].name}${task.required?'':' · optional'} · ${task.rule}</span>`;
  button.title='Drag to the board. '+task.rule;button.addEventListener('click',()=>{if(dragUI.ignoreClick())return;dragUI.beforeRender();selected=selected===task.id?null:task.id;document.querySelectorAll('.task-card').forEach(n=>{n.classList.toggle('active',n.dataset.id===selected);n.setAttribute('aria-pressed',String(n.dataset.id===selected));});hint();});
  button.addEventListener('dblclick',()=>openEditor(task.id));button.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.shiftKey){e.preventDefault();openEditor(task.id);}});dragUI.wireTile(button,task.id,false);$('taskLibrary').append(button);
 }

}
function renderEvents(result){
  document.querySelectorAll('#gridBody > .event').forEach(node=>node.remove());
  const tracks=new Map(),ends=[];
  for(const p of [...state.schedule].filter(p=>p.lane===2&&BY_ID[p.id]).sort((a,b)=>a.start-b.start||a.id.localeCompare(b.id))){let i=ends.findIndex(end=>end<=p.start);if(i<0)i=ends.length;ends[i]=p.start+BY_ID[p.id].duration;tracks.set(p.id,i);}
  const heights=[92,92,46+Math.max(1,ends.length)*56],offsets=[0,92,184];
  document.querySelectorAll('.lane').forEach((node,i)=>node.style.height=heights[i]+'px');
  const grid=$('gridBody');grid.style.height=heights.reduce((a,b)=>a+b,0)+'px';
  const labelWidth=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--lane-label'))||96,available=grid.clientWidth-labelWidth,bad=new Set(result.issues.map(i=>i.id));
  let base=$('alwaysOn');if(!base){base=document.createElement('div');base.id='alwaysOn';base.className='always-on-band';grid.append(base);}
  base.style.left=labelWidth+'px';base.style.top=(offsets[2]+5)+'px';base.style.width=available+'px';base.textContent='Always on · fridge + Wi-Fi'+(state.mode==='feedback'?' · '+BASE_ENERGY.toFixed(2)+' kWh/day':'');
  for(const p of state.schedule){
    const task=BY_ID[p.id];if(!task)continue;
    const event=document.createElement('button');event.className='event'+(state.mode==='feedback'&&bad.has(p.id)?' invalid':'');event.style.setProperty('--event-color',task.color);
    event.style.left=(labelWidth+available*p.start/SLOTS+2)+'px';event.style.width=(available*task.duration/SLOTS-4)+'px';
    event.style.top=(offsets[p.lane]+(p.lane===2?43+(tracks.get(p.id)||0)*56:22))+'px';
    const average=INTENSITY.slice(p.start,p.start+task.duration).reduce((a,b)=>a+b,0)/task.duration;event.style.setProperty('--intensity-color',intensityColor(average));
    event.innerHTML=`<strong>${task.short}${task.duration===2?' · 2 slots':''}</strong><small>${state.mode==='feedback'?fmt(task.energy)+' kWh':duration(task)}</small>`;
    event.title=`${task.name}, ${LANE_META[p.lane].name}, ${SLOT_LABELS[p.start]} to ${SLOT_LABELS[p.start+task.duration-1]}, ${duration(task)}. Click to move.`;event.setAttribute('aria-label',event.title);event.draggable=isEditing();
    event.addEventListener('click',e=>{if(dragUI.ignoreClick()||!isEditing())return;if(selected&&e.detail!==0)return;e.stopPropagation();openEditor(task.id);});
    dragUI.wireTile(event,task.id,true);
    grid.append(event);
  }
}

function renderPhase(){
 const day=currentDay(state),phase=state.phase,sub=state.substep,step=state.roundIndex;
 document.body.className='prototype '+(state.mode==='blind'?'unaided ':'aided ')+(phase==='complete'?'finished':'');
 document.querySelectorAll('#learningSteps li').forEach((n,i)=>{n.classList.toggle('active',phase!=='complete'&&i===step);n.classList.toggle('done',i<step||phase==='complete');if(phase!=='complete'&&i===step)n.setAttribute('aria-current','step');else n.removeAttribute('aria-current');});
 const phaseName={initial:'UNAIDED',guided:'AIDED PRACTICE',final:'NEW DAY · UNAIDED',complete:'THREE DAYS SAVED'}[phase];
 const copy=sub==='draw'?['Draw today’s task list.',`Draw 3 Personal, 3 Household and 4 Background uses. Today has four longer tiles. The time windows belong to this day, so check every label.`,state.drawn.length===10?'Arrange today’s tiles →':'Draw 10 tiles to start']:
 sub==='arrange'?[phase==='guided'?'Practise the pattern on a new day.':'Plan this day without energy cues.',phase==='guided'?'Use the colours and feedback to meet today’s needs, reduce modelled impact and spread demand. This day has new uses and windows.':'Arrange the tiles you drew. The energy colours, scores and coaching are hidden. The task and window labels are still available.','Save this day → Quick check-in']:
 sub==='checkin'?['Pause for a quick check-in.','Separate questions cover your confidence, effort, convenience and willingness. There is one short pattern question. Everything is optional; answers are saved separately from SUS.',state.roundIndex===2?'Save check-in → See the three days':'Save check-in → Draw the next day']:
 ['Three different days, saved.','Review your plans and check-ins, then continue to the questionnaire. Each day has different tasks and time windows; the totals are not a learning score.','Continue to questionnaire →'];
 $('phaseTag').textContent=phase==='complete'?phaseName:`DAY ${day.round} OF 3 · ${phaseName} · ${sub.toUpperCase()}`;$('phaseTitle').textContent=copy[0];$('phaseDescription').textContent=copy[1];
 $('helpBadge').textContent=sub==='draw'?'DRAW → ARRANGE → CHECK-IN':sub==='checkin'?'ALL CHECK-IN QUESTIONS OPTIONAL':state.mode==='blind'?'ENERGY GUIDANCE OFF · UNAIDED':phase==='guided'?'ENERGY GUIDANCE ON · PRACTICE':'RESULTS';
 for(const id of ['stageNext','finishButton']){$(id).textContent=copy[2];$(id).disabled=sub==='draw'&&state.drawn.length!==10;}
 $('bowlSection').hidden=sub!=='draw';$('roundCheckin').hidden=sub!=='checkin';$('workspacePanel').hidden=!['arrange','summary'].includes(sub);$('statsPanel').hidden=!['arrange','summary'].includes(sub);
 $('coach').hidden=!(phase==='guided'&&sub==='arrange');$('coachReason').textContent=lastReason||'In this example, late morning to afternoon has lower grid intensity. Check which of today’s uses can move there, then watch both emissions and demand.';
 $('trayNote').textContent=`${day.title} · 10 drawn uses · each has today’s window`;$('testExample').hidden=!IS_TEST||sub!=='arrange';
 if(sub==='draw')renderBowl();if(sub==='checkin')renderCheckin();
}
function renderBowl(){
 const day=currentDay(state);$('bowlProgress').textContent=state.drawn.length+' / 10 drawn';$('bowlDay').textContent=day.title;$('bowlGroups').replaceChildren();
 for(let lane=0;lane<3;lane++){
  const group=document.createElement('section');group.className='bowl-group';const target=lane===2?4:3,chosen=state.drawLog.filter(p=>p.lane===lane);
  const title=document.createElement('h3');title.textContent=LANE_META[lane].name+' · '+chosen.length+' / '+target;group.append(title);
  const bowl=document.createElement('div');bowl.className='token-bowl';
  for(let position=0;position<8;position++){
   const pick=chosen.find(p=>p.position===position),button=document.createElement('button');button.type='button';button.className='bowl-token'+(pick?' revealed':'');button.disabled=!!pick||chosen.length>=target;button.setAttribute('aria-label',pick?BY_ID[pick.id].name:'Draw '+LANE_META[lane].name+' tile '+(position+1));button.textContent=pick?BY_ID[pick.id].short:'?';
   button.onclick=()=>{const before=state.drawn.length;state=drawTask(state,lane,position);if(state.drawn.length>before)record('bowl-draw',{lane,position,id:state.drawn.at(-1)});render();};bowl.append(button);
  }group.append(bowl);$('bowlGroups').append(group);
 }
 $('drawAll').disabled=state.drawn.length===10;$('drawnTasks').replaceChildren();
 for(const id of state.drawn){const t=BY_ID[id],card=document.createElement('article');card.className='drawn-task';const h=document.createElement('strong');h.textContent=t.name;const text=document.createElement('p');text.textContent=LANE_META[t.lane].name+' · '+duration(t)+' · '+t.rule;card.append(h,text);$('drawnTasks').append(card);}
}
function renderCheckin(){
 const day=currentDay(state);$('checkinDay').textContent=`Day ${day.round} · ${state.phase==='guided'?'after aided practice':'after an unaided day'}`;
 if(renderedCheckinId===day.id)return;renderedCheckinId=day.id;$('roundRatingFields').replaceChildren();
 for(const item of CHECKIN_ITEMS){const field=document.createElement('fieldset');field.className='round-question';const legend=document.createElement('legend');legend.textContent=item.text;field.append(legend);const choices=document.createElement('div');choices.className='round-scale';
  for(const value of ['1','2','3','4','5','']){const label=document.createElement('label'),input=document.createElement('input');input.type='radio';input.name=item.id;input.value=value;input.checked=(state.checkinDraft[item.id]??'')=== (value===''?'':Number(value));label.append(input,document.createTextNode(value||'Skip'));choices.append(label);}
  const anchors=document.createElement('p');anchors.className='round-anchors';anchors.textContent='1 · '+item.low+'   —   5 · '+item.high;field.append(choices,anchors);$('roundRatingFields').append(field);
 }
 $('roundQuizPrompt').textContent=day.quiz.prompt;$('roundQuizOptions').replaceChildren();
 for(const option of [...day.quiz.options,{id:'',text:'Skip this question'}]){const label=document.createElement('label'),input=document.createElement('input');input.type='radio';input.name='quiz';input.value=option.id;input.checked=(state.checkinDraft.quiz||'')===option.id;label.append(input,document.createTextNode(option.text));$('roundQuizOptions').append(label);}
 $('roundComment').value=state.checkinDraft.comment||'';$('roundCheckinSubmit').textContent=state.roundIndex===2?'Save check-in → See results':'Save check-in → Next day’s bowl';
}
function readCheckin(){const data=new FormData($('roundCheckinForm')),answers={};for(const item of CHECKIN_ITEMS){const value=data.get(item.id);answers[item.id]=value?Number(value):null;}answers.quiz=data.get('quiz')||null;answers.comment=String(data.get('comment')||'');return answers;}
function commitCheckin(){const answers=readCheckin();record('round-checkin-submitted',{answeredRatings:CHECKIN_ITEMS.filter(i=>answers[i.id]!==null).length});state=submitCheckin(state,answers);setScenario(currentDay(state));selected=null;lastReason='';persist();render();notifyParent(state.phase==='complete'?'prototype-complete':'learning-step-changed');$('phaseTitle').scrollIntoView({behavior:'smooth',block:'start'});}
function renderFeedback(result){
 const blind=state.mode==='blind';
 $('needsStat').innerHTML=`${result.coreScheduled}<span>/ 10 drawn uses</span>`;
 $('needsNote').textContent=blind?'You can finish or continue to the questionnaire at any point.':result.valid?'✓ Today’s uses and rules met':result.missing.length+' drawn uses still in the tray · '+result.issues.length+' rule issues';
 $('carbonStat').innerHTML=blind?'<span class="blind-value">Hidden while unaided</span>':`${fmt(result.emissions)}<span>kg CO₂e</span>`;
 $('powerStat').innerHTML=blind?'<span class="blind-value">Hidden while unaided</span>':`${fmt(result.peak)}<span>kW slot average</span>`;
 $('energyStat').innerHTML=blind?'<span class="blind-value">Hidden while unaided</span>':`${fmt(result.energy)}<span>kWh</span>`;
 $('powerCard').classList.toggle('red-signal',!blind&&result.peak>POWER_TARGET);$('powerNote').textContent=blind?'No demand feedback in this step.':result.peak>POWER_TARGET?'Above the example 4 kW goal. Try spreading larger uses.':'Within the example 4 kW goal. Several small uses may still run together.';
 $('carbonNote').textContent=blind?'No sustainability feedback in this step.':'Lower depends on both energy used and the intensity of the chosen periods.';
 $('constraintBox').classList.toggle('bad',!blind&&result.issues.length>0);
 $('constraintBox').textContent=blind?'Unaided: only ordinary placement feedback is shown. Your energy outcomes are held until you save this step.':result.issues.length?result.issues.slice(0,2).map(x=>x.message).join(' '):result.missing.length?'Aim to include all ten drawn uses within their own windows. An unfinished plan can still be saved.':'✓ Needs met. Explore a different valid solution; there is no single required arrangement.';
 $('periodSignal').innerHTML=INTENSITY.map((v,i)=>`<div class="period-cue ${v<=.3?'green':v>=.625?'red':'amber'}"><strong>${v<=.3?'LOWER':v>=.625?'HIGHER':'MEDIUM'}</strong><span>${SLOT_LABELS[i]}</span></div>`).join('');
 $('profileChart').innerHTML=INTENSITY.map((v,i)=>`<div class="profile-bar ${v<=.3?'green':v>=.625?'red':'amber'}" style="height:${v/.8*100}%" title="${SLOT_LABELS[i]} · illustrative ${v} kg CO₂e/kWh"></div>`).join('');
 const scale=Math.max(7,result.peak);$('demandChart').style.setProperty('--target-position',`${POWER_TARGET/scale*100}%`);$('demandChart').innerHTML=result.load.map((v,i)=>`<div class="demand-bar ${v>POWER_TARGET?'over':''}" style="height:${Math.max(2,v/scale*100)}%" title="${SLOT_LABELS[i]} · ${fmt(v)} kW average"></div>`).join('');
 renderSummary();
}
function statusLabel(run){return run.metrics.valid?'Needs met':run.metrics.complete?'Rules not met':'Unfinished plan';}
function renderSummary(){
 const box=$('comparison');box.hidden=state.phase!=='complete';if(box.hidden)return;
 const labels={initial:'Unaided',guided:'Aided practice',final:'New day · unaided'};
 box.innerHTML='<h2>Your three different days</h2><div class="result-grid">'+state.runs.map(run=>`<article><h3>Day ${run.round} · ${labels[run.phase]}</h3><strong>${fmt(run.metrics.emissions)} <small>kg CO₂e</small></strong><p>${fmt(run.metrics.peak)} kW highest slot average<br>${fmt(run.metrics.energy)} kWh · ${run.metrics.scheduled}/10 uses placed</p><span class="result-status ${run.metrics.valid?'ok':'incomplete'}">${statusLabel(run)}</span></article>`).join('')+'</div>';
 const note=document.createElement('p');note.textContent='Each day used a different task draw and time windows. These totals describe your plans; they are not a direct learning score. The check-ins keep confidence, effort, convenience and willingness separate. A short immediate check does not establish lasting learning.';box.append(note);
 const table=document.createElement('div');table.className='checkin-results';
 for(const c of state.checkins){const row=document.createElement('article');row.innerHTML=`<h3>Day ${c.round} · your check-in</h3><p>${CHECKIN_ITEMS.map(i=>`${i.id[0].toUpperCase()+i.id.slice(1)}: ${c.ratings[i.id]??'skipped'}`).join(' · ')}</p>`;const answer=document.createElement('p');answer.textContent=c.quiz.correct===null?'Pattern question: skipped.':`Pattern question: ${c.quiz.correct?'correct':'a different answer'}. ${c.quiz.explanation}`;row.append(answer);table.append(row);}box.append(table);
}
function render(){dragUI.beforeRender();setScenario(currentDay(state));renderPhase();if(['arrange','summary'].includes(state.substep)){renderLibrary();hint();const result=evaluate(state.schedule);renderEvents(result);renderFeedback(result);}requestAnimationFrame(()=>notifyParent());}
function nextStep(){
 if(state.phase==='complete'){notifyParent('request-questionnaire');if(window.parent===window)toast('Use the participant portal for the final questionnaire.');return;}
 if(state.substep==='checkin'){$('roundCheckinForm').requestSubmit();return;}
 dragUI.beforeRender();const from=state.substep;try{state=state.substep==='draw'?startPlan(state):savePlan(state);}catch(error){toast(error.message);return;}
 selected=null;lastReason='';record('day-step-changed',{round:state.roundIndex+1,from,to:state.substep});render();notifyParent('learning-step-changed');$('phaseTitle').scrollIntoView({behavior:'smooth',block:'start'});
}
function openEditor(id){if(!isEditing())return;editing=id;const t=BY_ID[id],p=state.schedule.find(p=>p.id===id);$('editorTitle').textContent=t.name;$('editorRule').textContent=duration(t)+' · '+t.rule;
 $('startSelect').innerHTML=Array.from({length:SLOTS-t.duration+1},(_,s)=>`<option value="${s}">${SLOT_LABELS[s]} · ${time(s)}</option>`).join('');$('laneSelect').innerHTML=LANE_META.map((l,i)=>`<option value="${i}" ${i===2&&!t.unattended?'disabled':''}>${l.name}</option>`).join('');$('startSelect').value=p?.start??t.windows[0][0];$('laneSelect').value=p?.lane??t.lane;$('removeTask').disabled=!p;$('editDialog').showModal();}
$('applyEdit').onclick=()=>{if(place(editing,+$('startSelect').value,+$('laneSelect').value))$('editDialog').close();};$('removeTask').onclick=()=>{removeTile(editing,'editor');$('editDialog').close();};$('closeEditor').onclick=()=>$('editDialog').close();
for(const id of ['stageNext','finishButton'])$(id).onclick=nextStep;
$('resetButton').onclick=()=>{if(!isEditing())return;if(state.schedule.length&&!confirm('Return every tile from this current plan to the tray? Saved earlier steps stay preserved.'))return;state.schedule=[];selected=null;record('clear-current-step');render();};
$('testExample').onclick=()=>{if(!IS_TEST||!isEditing())return;state.schedule=clone(currentDay(state).witness);record('test-reference-day');render();};
$('drawAll').onclick=()=>{const before=[...state.drawn];state=drawAll(state);record('bowl-draw-all',{newIds:state.drawn.filter(id=>!before.includes(id))});render();};
$('roundCheckinForm').onsubmit=e=>{e.preventDefault();commitCheckin();};
$('roundCheckinForm').oninput=()=>{state.checkinDraft=readCheckin();persist();notifyParent();};
buildGrid();if(!state.events.length)record('demonstration-started',{demoVersion:DEMO_VERSION});render();
let lastWidth=$('gridBody').clientWidth;new ResizeObserver(entries=>{const width=entries[0].contentRect.width;if(Math.abs(width-lastWidth)>.5){lastWidth=width;if(width>0&&['arrange','summary'].includes(state.substep)){dragUI.beforeRender();renderEvents(evaluate(state.schedule));}}}).observe($('gridBody'));
window.daylight={getSession:()=>clone(state)};

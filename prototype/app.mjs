import {VERSION,LANES,LANE_META,BASE_ENERGY,SLOTS,INTENSITY,SLOT_LABELS,TASKS,BY_ID,POWER_TARGET,time,evaluate,canPlace,EXAMPLE} from './engine.mjs?v=learning-v4';
import {DEMO_VERSION,newSession,advanceSession,comparison,clone} from './learning.mjs?v=learning-v4';
import {createInteractions} from './interactions.mjs?v=learning-v4';
const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);
const KEY='daylight-portal-prototype-'+(params.get('session')||'standalone'),IS_TEST=params.get('test')==='1';
let state=newSession(),selected=null,editing=null,showExtras=false,toastTimer,lastReason='';
try{const saved=JSON.parse(localStorage.getItem(KEY));if(saved?.version===VERSION&&saved.demoVersion===DEMO_VERSION)state=saved;else if(saved)state.earlierDemonstrations=[saved];}catch{}
const fmt=(n,d=2)=>n.toFixed(d),isEditing=()=>state.phase!=='complete';
const duration=t=>t.duration===2?'2 slots · 4h':'1 slot';
function persist(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch{toast('Keep this page open until your responses are submitted. Browser storage is unavailable.');}}
function notifyParent(type='prototype-update'){if(window.parent!==window)window.parent.postMessage({source:'daylight-prototype',type,state:clone(state),height:document.documentElement.scrollHeight},location.origin);}
function record(type,detail={}){state.events.push({at:new Date().toISOString(),elapsedMs:Date.now()-new Date(state.startedAt).getTime(),phase:state.phase,mode:state.mode,helpShown:state.phase==='guided',type,...detail,schedule:clone(state.schedule)});persist();notifyParent();}
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
 if(state.phase==='final'&&!state.finalPool.includes(id)){toast('Use the same activity set for this unaided try.');return false;}
 if(!canPlace(state.schedule,id,start,lane)){record('placement-rejected',{id,start,lane,via});toast(lane===2&&!BY_ID[id]?.unattended?'This needs a person. Use Personal or Household.':'The lane is occupied or the whole tile does not fit. Try another slot.');return false;}
 const before=state.schedule.find(p=>p.id===id),metrics=evaluate(state.schedule);
 state.schedule=state.schedule.filter(p=>p.id!==id).concat({id,start,lane});
 record(before?'move':'place',{id,start,lane,via,previous:before?clone(before):null});selected=null;
 if(state.phase==='guided'){const after=evaluate(state.schedule);lastReason=before?`${BY_ID[id].name}: moving the same use ${after.emissions<metrics.emissions?'lowered':after.emissions>metrics.emissions?'raised':'kept'} modelled emissions${after.emissions!==metrics.emissions?' by '+fmt(Math.abs(after.emissions-metrics.emissions))+' kg CO₂e':''}. Its energy stays the same.`:'A use was added. Total energy can rise; compare timing using the same activities.';}
 render();return true;
}
function removeTile(id,via='editor'){
 if(!isEditing())return;const previous=state.schedule.find(p=>p.id===id);if(!previous)return;
 const phase=state.phase;state.schedule=state.schedule.filter(p=>p.id!==id);selected=null;record('remove',{id,via,previous:clone(previous)});
 lastReason='Returning a use to the tray removes its energy. To learn about timing, compare plans with the same uses.';render();
 toast(BY_ID[id].name+' returned to the tray.',()=>{if(state.phase!==phase){toast('A new step has started. The original removal remains recorded.');return;}if(canPlace(state.schedule,id,previous.start,previous.lane)){state.schedule.push(previous);record('undo-remove',{id,previous});render();toast('Tile restored.');}else toast('That position is occupied now. Place the tile from the tray.');});
}
function renderLibrary(){
 $('taskLibrary').replaceChildren();
 const available=state.phase==='final'?TASKS.filter(t=>state.finalPool.includes(t.id)):TASKS;
 for(const task of available){
  if(!task.required&&!showExtras&&state.phase!=='final')continue;
  const placed=state.schedule.some(p=>p.id===task.id),button=document.createElement('button');
  button.className='task-card'+(placed?' placed':'')+(selected===task.id?' active':'');button.style.setProperty('--task-color',task.color);button.draggable=isEditing();button.disabled=!isEditing();
  button.setAttribute('aria-pressed',String(selected===task.id));
  button.innerHTML=`<span class="tile-grip" aria-hidden="true">⠿</span><span class="task-title">${task.name}<b>${placed?'✓':'+'}</b></span><span class="task-meta">${duration(task)}${state.mode==='feedback'?' · '+fmt(task.energy)+' kWh':''}</span><span class="task-rule">${LANE_META[task.lane].name}${task.required?'':' · optional'} · ${task.rule}</span>`;
  button.title='Drag to the board. '+task.rule;button.addEventListener('click',()=>{if(dragUI.ignoreClick())return;dragUI.beforeRender();selected=selected===task.id?null:task.id;renderLibrary();hint();});
  button.addEventListener('dblclick',()=>openEditor(task.id));button.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.shiftKey){e.preventDefault();openEditor(task.id);}});dragUI.wireTile(button,task.id,false);$('taskLibrary').append(button);
 }
 if(state.phase!=='final'){const more=document.createElement('button');more.className='extras-button';more.textContent=showExtras?'Hide optional extras':'＋ Optional extra activities (8)';more.onclick=()=>{showExtras=!showExtras;renderLibrary();};$('taskLibrary').append(more);}
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
 const phase=state.phase,step=phase==='initial'?0:phase==='guided'?1:2;
 document.body.className='prototype '+(state.mode==='blind'?'unaided ':'aided ')+(phase==='complete'?'finished':'');
 document.querySelectorAll('#learningSteps li').forEach((node,i)=>{node.classList.toggle('active',phase!=='complete'&&i===step);node.classList.toggle('done',i<step||phase==='complete');if(phase!=='complete'&&i===step)node.setAttribute('aria-current','step');else node.removeAttribute('aria-current');});
 const content={initial:['STEP 1 OF 3 · UNAIDED','Try your own plan first.','Meet the household needs and choose times you think work well. Energy colours, scores and hints are hidden. Save this plan when you are ready.','Save unaided plan → Guided practice'],guided:['STEP 2 OF 3 · AIDED','Learn the pattern. Then improve your plan.','Use the colours and live feedback to explore the trade-offs. Keep needs and activities comparable. When ready, try again without these hints.','Save practice → Try unaided again'],final:['STEP 3 OF 3 · UNAIDED','Apply what you learned, without the cues.','This is a fresh board with the same core activities and chosen extras. Rebuild a sensible day from memory. Colours, live scores and coaching are hidden until you finish.','Save final unaided plan → See results'],complete:['THREE STEPS SAVED','Your practice is complete.','All three plans are preserved, including any unfinished work. Review what changed, then continue to the questionnaire.','Continue to questionnaire →']}[phase];
 $('phaseTag').textContent=content[0];$('phaseTitle').textContent=content[1];$('phaseDescription').textContent=content[2];$('helpBadge').textContent=state.mode==='blind'?'HELP OFF · UNAIDED':phase==='guided'?'HELP ON · GUIDED PRACTICE':'RESULTS';
 for(const id of ['stageNext','finishButton']){$(id).textContent=content[3];$(id).disabled=false;}
 $('coach').hidden=phase!=='guided';$('coachReason').textContent=lastReason||'In this example, the late-morning, midday and afternoon periods have lower grid intensity. Move a flexible use there, then check both emissions and demand.';
 $('trayNote').textContent=phase==='final'?'Use this same activity set again. Longer tiles span two slots.':'10 core uses · optional extras · fixed fridge + Wi-Fi';
 $('testExample').hidden=!IS_TEST||phase==='complete';
}
function renderFeedback(result){
 const blind=state.mode==='blind';
 $('needsStat').innerHTML=`${result.coreScheduled}<span>/ 10 core${result.optionalScheduled?' + '+result.optionalScheduled+' extras':''}</span>`;
 $('needsNote').textContent=blind?'You can finish or continue to the questionnaire at any point.':result.valid?'✓ Core needs and activity rules met':result.missing.length+' core uses still in the tray · '+result.issues.length+' rule issues';
 $('carbonStat').innerHTML=blind?'<span class="blind-value">Hidden while unaided</span>':`${fmt(result.emissions)}<span>kg CO₂e</span>`;
 $('powerStat').innerHTML=blind?'<span class="blind-value">Hidden while unaided</span>':`${fmt(result.peak)}<span>kW slot average</span>`;
 $('energyStat').innerHTML=blind?'<span class="blind-value">Hidden while unaided</span>':`${fmt(result.energy)}<span>kWh</span>`;
 $('powerCard').classList.toggle('red-signal',!blind&&result.peak>POWER_TARGET);$('powerNote').textContent=blind?'No demand feedback in this step.':result.peak>POWER_TARGET?'Above the example 4 kW goal. Try spreading larger uses.':'Within the example 4 kW goal. Several small uses may still run together.';
 $('carbonNote').textContent=blind?'No sustainability feedback in this step.':'Lower depends on both energy used and the intensity of the chosen periods.';
 $('constraintBox').classList.toggle('bad',!blind&&result.issues.length>0);
 $('constraintBox').textContent=blind?'Unaided: only ordinary placement feedback is shown. Your energy outcomes are held until you save this step.':result.issues.length?result.issues.slice(0,2).map(x=>x.message).join(' '):result.missing.length?'Aim to include the core uses. Extras are optional. An unfinished plan can still be saved.':'✓ Needs met. Explore a different valid solution; there is no single required arrangement.';
 $('periodSignal').innerHTML=INTENSITY.map((v,i)=>`<div class="period-cue ${v<=.3?'green':v>=.625?'red':'amber'}"><strong>${v<=.3?'LOWER':v>=.625?'HIGHER':'MEDIUM'}</strong><span>${SLOT_LABELS[i]}</span></div>`).join('');
 $('profileChart').innerHTML=INTENSITY.map((v,i)=>`<div class="profile-bar ${v<=.3?'green':v>=.625?'red':'amber'}" style="height:${v/.8*100}%" title="${SLOT_LABELS[i]} · illustrative ${v} kg CO₂e/kWh"></div>`).join('');
 const scale=Math.max(7,result.peak);$('demandChart').style.setProperty('--target-position',`${POWER_TARGET/scale*100}%`);$('demandChart').innerHTML=result.load.map((v,i)=>`<div class="demand-bar ${v>POWER_TARGET?'over':''}" style="height:${Math.max(2,v/scale*100)}%" title="${SLOT_LABELS[i]} · ${fmt(v)} kW average"></div>`).join('');
 renderSummary();
}
function statusLabel(run){return run.metrics.valid?'Needs met':run.metrics.complete?'Rules not met':'Unfinished plan';}
function renderSummary(){
 const box=$('comparison');box.hidden=state.phase!=='complete';if(box.hidden)return;
 const items=[['First unaided',state.baseline],['Guided practice',state.guided],['Final unaided',state.final]];
 box.innerHTML='<h2>Your three saved plans</h2><div class="result-grid">'+items.map(([label,run])=>`<article><h3>${label}</h3><strong>${fmt(run.metrics.emissions)} <small>kg CO₂e</small></strong><p>${fmt(run.metrics.peak)} kW highest slot average<br>${fmt(run.metrics.energy)} kWh</p><span class="result-status ${run.metrics.valid?'ok':'incomplete'}">${statusLabel(run)}</span></article>`).join('')+'</div>';
 const c=comparison(state.baseline,state.final),p=document.createElement('p');p.textContent=c.comparable?`With the same activities, your final unaided plan has ${fmt(Math.abs(c.emissionsSaved))} kg CO₂e ${c.emissionsSaved>=0?'lower':'higher'} modelled emissions than the first. Both use ${fmt(c.energy)} kWh. This is an immediate practice check, not a test of lasting learning.`:c.reason+' The original plans are kept as observed; no like-for-like improvement score is shown.';box.append(p);
}
function render(){dragUI.beforeRender();renderPhase();renderLibrary();hint();const result=evaluate(state.schedule);renderEvents(result);renderFeedback(result);requestAnimationFrame(()=>notifyParent());}
function nextStep(){
 if(state.phase==='complete'){notifyParent('request-questionnaire');if(window.parent===window)toast('Open the participant portal to complete the questionnaire.');return;}
 dragUI.beforeRender();const from=state.phase;state=advanceSession(state);selected=null;lastReason='';record('learning-step-saved',{from,to:state.phase});render();
 notifyParent(state.phase==='complete'?'prototype-complete':'learning-step-changed');$('phaseTitle').scrollIntoView({behavior:'smooth',block:'start'});
}
function openEditor(id){if(!isEditing())return;editing=id;const t=BY_ID[id],p=state.schedule.find(p=>p.id===id);$('editorTitle').textContent=t.name;$('editorRule').textContent=duration(t)+' · '+t.rule;
 $('startSelect').innerHTML=Array.from({length:SLOTS-t.duration+1},(_,s)=>`<option value="${s}">${SLOT_LABELS[s]} · ${time(s)}</option>`).join('');$('laneSelect').innerHTML=LANE_META.map((l,i)=>`<option value="${i}" ${i===2&&!t.unattended?'disabled':''}>${l.name}</option>`).join('');$('startSelect').value=p?.start??t.windows[0][0];$('laneSelect').value=p?.lane??t.lane;$('removeTask').disabled=!p;$('editDialog').showModal();}
$('applyEdit').onclick=()=>{if(place(editing,+$('startSelect').value,+$('laneSelect').value))$('editDialog').close();};$('removeTask').onclick=()=>{removeTile(editing,'editor');$('editDialog').close();};$('closeEditor').onclick=()=>$('editDialog').close();
for(const id of ['stageNext','finishButton'])$(id).onclick=nextStep;
$('resetButton').onclick=()=>{if(!isEditing())return;if(state.schedule.length&&!confirm('Return every tile from this current plan to the tray? Saved earlier steps stay preserved.'))return;state.schedule=[];selected=null;record('clear-current-step');render();};
$('testExample').onclick=()=>{if(!IS_TEST||!isEditing())return;state.schedule=clone(EXAMPLE.filter(p=>state.phase!=='final'||state.finalPool.includes(p.id)));record('test-example');render();};
buildGrid();if(!state.events.length)record('demonstration-started',{demoVersion:DEMO_VERSION});render();
let lastWidth=$('gridBody').clientWidth;new ResizeObserver(entries=>{const width=entries[0].contentRect.width;if(Math.abs(width-lastWidth)>.5){lastWidth=width;dragUI.beforeRender();renderEvents(evaluate(state.schedule));}}).observe($('gridBody'));
window.daylight={getSession:()=>clone(state)};

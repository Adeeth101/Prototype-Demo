import {VERSION,LANES,SLOTS,INTENSITY,TASKS,BY_ID,POWER_TARGET,TOTAL_ENERGY,time,evaluate,canPlace,EXAMPLE} from './engine.mjs';
const $=id=>document.getElementById(id);
const EMBED_PARAMS=new URLSearchParams(location.search);
const KEY='daylight-portal-prototype-'+(EMBED_PARAMS.get('session')||'standalone');
const IS_TEST=EMBED_PARAMS.get('test')==='1';
const clone=v=>JSON.parse(JSON.stringify(v));
const fresh=(participant='TEST')=>({version:VERSION,participant,mode:participant==='TEST'?'feedback':'blind',phase:participant==='TEST'?'explore':'unaided',schedule:[],baseline:null,runs:[],events:[],startedAt:new Date().toISOString()});
let state=fresh('participant'),selected=null,editing=null,dragged=null,toastTimer;
try{const saved=JSON.parse(localStorage.getItem(KEY));if(saved?.version===VERSION&&Array.isArray(saved.schedule)&&Array.isArray(saved.events))state=saved;}catch{}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch{toast('Browser storage is unavailable. Export this session before leaving.');}}
function notifyParent(type='prototype-update'){if(window.parent!==window)window.parent.postMessage({source:'daylight-prototype',type,state:clone(state)},location.origin);}
function record(type,detail={}){state.events.push({at:new Date().toISOString(),elapsedMs:Date.now()-new Date(state.startedAt).getTime(),phase:state.phase,mode:state.mode,type,...detail,schedule:clone(state.schedule)});persist();notifyParent();}
function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),4200);}
function intensityColor(value){return value<=.3?'#b7cf8d':value<=.55?'#d8d9aa':'#dba285';}
function fmt(value,digits=2){return value.toFixed(digits);}
function duration(t){return `${t.duration/2} h`;}
function chosen(){return selected?BY_ID[selected]:null;}

function buildGrid(){
  $('timeAxis').innerHTML='<span>LANES</span>'+Array.from({length:SLOTS},(_,s)=>`<span>${s%4===0?time(s):''}</span>`).join('');
  $('gridBody').innerHTML=Array.from({length:LANES},(_,lane)=>`<div class="lane"><div class="lane-name">LANE ${lane+1}</div><div class="lane-cells" data-lane="${lane}">${Array.from({length:SLOTS},(_,slot)=>`<div class="slot ${slot>=20&&slot<32?'daylight':slot>=34&&slot<42?'evening':''}" data-lane="${lane}" data-slot="${slot}" title="Lane ${lane+1}, ${time(slot)}"></div>`).join('')}</div></div>`).join('');
  $('gridBody').addEventListener('click',event=>{const cell=event.target.closest('.slot');if(cell&&selected)place(selected,Number(cell.dataset.slot),Number(cell.dataset.lane));});
  $('gridBody').addEventListener('dragover',event=>{if(event.target.closest('.slot'))event.preventDefault();});
  $('gridBody').addEventListener('drop',event=>{
    const cell=event.target.closest('.slot');if(!cell)return;event.preventDefault();
    const id=event.dataTransfer.getData('text/plain')||dragged;
    if(BY_ID[id])place(id,Number(cell.dataset.slot),Number(cell.dataset.lane));dragged=null;
  });
}
function place(id,start,lane){
  if(!canPlace(state.schedule,id,start,lane)){record('placement-rejected',{id,start,lane,reason:'overlap-or-grid-boundary'});toast('That space is occupied or too close to the end of the day. Try another lane or time.');return false;}
  const before=state.schedule.find(p=>p.id===id);
  state.schedule=state.schedule.filter(p=>p.id!==id).concat({id,start,lane});
  record(before?'move':'place',{id,start,lane,previous:before?clone(before):null});selected=null;render();return true;
}
function renderLibrary(){
  $('taskLibrary').replaceChildren();
  for(const task of TASKS){
    const placement=state.schedule.find(p=>p.id===task.id),button=document.createElement('button');
    button.className='task-card'+(placement?' placed':'')+(selected===task.id?' active':'');
    button.style.setProperty('--task-color',task.color);button.draggable=true;
    button.setAttribute('aria-pressed',String(selected===task.id));
    button.innerHTML=`<div class="task-title">${task.name}<span>${placement?'✓':'+'}</span></div><div class="task-meta">${duration(task)} &nbsp;·&nbsp; ${task.kw<.1?Math.round(task.kw*1000)+' W':task.kw+' kW'} &nbsp;·&nbsp; ${fmt(task.kw*task.duration/2)} kWh</div><div class="task-rule">${task.rule}</div>`;
    button.title=task.rule+'. '+task.note;
    button.addEventListener('click',()=>{selected=selected===task.id?null:task.id;renderLibrary();renderHint();});
    button.addEventListener('dblclick',()=>openEditor(task.id));
    button.addEventListener('keydown',event=>{if(event.key==='Enter'&&event.shiftKey){event.preventDefault();openEditor(task.id);}});
    button.addEventListener('dragstart',event=>{dragged=task.id;event.dataTransfer.setData('text/plain',task.id);event.dataTransfer.effectAllowed='move';selected=task.id;renderHint();});
    $('taskLibrary').append(button);
  }
}
function renderHint(){
  const task=chosen();$('selectionHint').textContent=task?`${task.name} selected · ${task.rule}. Click a lane, or double-click its library card to use the time editor.`:'Choose any activity on the left to begin. Each column is 30 minutes.';
}
function renderEvents(result){
  document.querySelectorAll('#gridBody > .event').forEach(node=>node.remove());
  const bad=new Set(result.issues.map(i=>i.id));
  const grid=$('gridBody'),labelWidth=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--lane-label'))||58;
  const available=grid.clientWidth-labelWidth;
  for(const p of state.schedule){
    const task=BY_ID[p.id];if(!task)continue;
    const event=document.createElement('button');
    event.className='event'+(state.mode==='feedback'&&bad.has(p.id)?' invalid':'');event.style.setProperty('--event-color',task.color);
    event.style.left=`${labelWidth+available*p.start/SLOTS+1}px`;
    event.style.width=`${available*task.duration/SLOTS-2}px`;event.style.top=`${p.lane*64+10}px`;
    const average=INTENSITY.slice(p.start,p.start+task.duration).reduce((a,b)=>a+b,0)/task.duration;
    event.style.setProperty('--intensity-color',intensityColor(average));
    event.innerHTML=`<strong>${task.short}</strong><small>${time(p.start)} · ${task.kw<.1?Math.round(task.kw*1000)+' W':task.kw+' kW'}</small>`;
    event.title=`${task.name}, lane ${p.lane+1}, ${time(p.start)}–${time(p.start+task.duration)}. Click to edit.`;
    event.setAttribute('aria-label',event.title);event.draggable=true;
    event.addEventListener('click',()=>openEditor(task.id));
    event.addEventListener('dragstart',e=>{dragged=task.id;e.dataTransfer.setData('text/plain',task.id);e.dataTransfer.effectAllowed='move';});
    grid.append(event);
  }
}
function renderFeedback(result){
  const blind=state.mode==='blind';document.body.classList.toggle('unaided',blind);
  $('needsStat').innerHTML=`${result.scheduled}<span>/ ${TASKS.length}</span>`;
  $('needsNote').textContent=blind?'Activities placed. Outcomes are hidden until you save.':result.valid?'All ten activities meet their timing rules.':`${result.missing.length} not placed${result.issues.length?' · '+result.issues.length+' timing / layout issues':''}`;
  $('carbonStat').innerHTML=blind?'<span class="blind-value">Hidden until the end</span>':`${fmt(result.emissions)}<span>kg CO₂e</span>`;
  $('powerStat').innerHTML=blind?'<span class="blind-value">Hidden until the end</span>':`${fmt(result.peak)}<span>kW</span>`;
  $('energyStat').innerHTML=blind?'<span class="blind-value">Hidden until the end</span>':`${fmt(result.energy)}<span>kWh</span>`;
  $('carbonNote').textContent=blind?'No live sustainability feedback in this run.':result.complete?'Example grid model, not measured household emissions.':'Scheduled activities only · complete all ten to compare.';
  $('powerNote').textContent=blind?'No live demand feedback in this run.':result.peak>POWER_TARGET?`${result.overTargetSlots} half-hour blocks exceed the ${POWER_TARGET} kW scenario target.`:`Within the ${POWER_TARGET} kW scenario target so far.`;
  $('constraintBox').classList.toggle('bad',!blind&&result.issues.length>0);
  if(blind)$('constraintBox').innerHTML='<span class="check-symbol">○</span><div><strong>Unaided run</strong><p>Use the activity rules. Save the first run to reveal the result.</p></div>';
  else if(result.issues.length)$('constraintBox').innerHTML=`<span class="check-symbol">!</span><div><strong>${result.issues.length} things to resolve</strong><p>${result.issues.slice(0,2).map(i=>i.message).join(' ')}</p></div>`;
  else if(result.missing.length)$('constraintBox').innerHTML=`<span class="check-symbol">○</span><div><strong>${result.missing.length} activities still need a place</strong><p>Every activity must be included. Each one keeps the same duration and energy.</p></div>`;
  else $('constraintBox').innerHTML='<span class="check-symbol">✓</span><div><strong>Every household need is met</strong><p>You can keep exploring the timing or save this version.</p></div>';
  $('finishButton').disabled=blind?!result.complete:!result.valid;
  $('finishButton').innerHTML=blind?'Save unaided run &amp; reveal <span>↗</span>':'Finish &amp; save this run <span>↗</span>';
  $('profileChart').innerHTML=INTENSITY.map((value,i)=>`<div class="profile-bar" style="--profile-color:${intensityColor(value)};--intensity-height:${value/.8*100}%" title="${time(i)}: ${value.toFixed(2)} kg CO₂e/kWh, illustrative"></div>`).join('');
  const scale=Math.max(7,result.peak);
  $('demandChart').style.setProperty('--target-position',`${POWER_TARGET/scale*100}%`);
  $('demandChart').innerHTML=result.load.map((value,i)=>`<div class="demand-bar ${value>POWER_TARGET?'over':''}" style="--demand-height:${Math.min(100,value/scale*100)}%" title="${time(i)}: ${fmt(value)} kW"></div>`).join('');
  $('feedbackMode').classList.toggle('selected',!blind);$('blindMode').classList.toggle('selected',blind);
  $('modeNote').textContent=blind?'Feedback is held until you save this run.':'Feedback updates as you move activities.';
  $('remainingCount').textContent=`${result.missing.length} TO PLACE`;
  $('guidedButton').disabled=!state.baseline;
  renderComparison(result);
}
function renderComparison(result){
  const box=$('comparison');box.hidden=!state.baseline||state.mode==='blind';if(box.hidden)return;
  const first=evaluate(state.baseline.schedule);
  const comparable=first.valid&&result.valid;
  const change=first.emissions-result.emissions;
  box.innerHTML=`<strong>Your first run stays saved.</strong><br>First plan: ${fmt(first.emissions)} kg CO₂e · ${fmt(first.peak)} kW peak · ${first.valid?'all needs met':'incomplete or timing rules not met'}.<br>Current plan: ${fmt(result.emissions)} kg CO₂e · ${fmt(result.peak)} kW peak.<br>${comparable?`${change>=0?'Lower':'Higher'} modelled emissions by ${fmt(Math.abs(change))} kg CO₂e (${fmt(Math.abs(change)/first.emissions*100,1)}%). Both complete schedules use ${fmt(TOTAL_ENERGY,3)} kWh.`:'Complete a valid schedule before interpreting the difference. If the first plan broke requirements, compare feasibility as well as emissions.'}<br><span class="small-note">This is a before-and-after revision. Practice and the revealed information can both contribute.</span>`;
}
function render(){const result=evaluate(state.schedule);renderLibrary();renderHint();renderEvents(result);renderFeedback(result);$('participant').value=state.participant;}
function openEditor(id){
  editing=id;const task=BY_ID[id],placement=state.schedule.find(p=>p.id===id);
  $('editorTitle').textContent=task.name;$('editorRule').textContent=task.rule+'. '+task.note;
  $('startSelect').innerHTML=Array.from({length:SLOTS-task.duration+1},(_,s)=>`<option value="${s}">${time(s)}</option>`).join('');
  $('laneSelect').innerHTML=Array.from({length:LANES},(_,i)=>`<option value="${i}">Lane ${i+1}</option>`).join('');
  $('startSelect').value=placement?.start??task.fixed??task.windows[0][0];$('laneSelect').value=placement?.lane??0;
  $('removeTask').disabled=!placement;$('editDialog').showModal();
}
function captureBaseline(){
  if(state.baseline){toast('The first run is already saved and will not be overwritten. Export it or start a new participant session.');return;}
  state.baseline={at:new Date().toISOString(),schedule:clone(state.schedule),metrics:evaluate(state.schedule),source:'online-unaided-grid',phase:state.phase};
  record('baseline-frozen',{baseline:clone(state.baseline)});state.mode='feedback';state.phase='guided';persist();render();document.getElementById('roundBanner').textContent='ROUND 2 · Your first plan is saved. Use the feedback to improve timing while meeting every household need.';notifyParent('baseline-saved');
  toast('First run saved. Feedback is now visible. Start guided revision when ready.');
}
function exportSession(){
  record('export-requested');const payload={...clone(state),profile:{kind:'illustrative-not-live',unit:'kgCO2e/kWh',halfHourIntensity:INTENSITY},tasks:clone(TASKS),currentMetrics:evaluate(state.schedule),researchNote:'Paper-first plus digital guided revision. Order, learning, information and medium are confounded; do not claim an isolated causal feedback effect.'};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`daylight-${state.participant}-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Session exported. Keep the original JSON as raw study evidence.');
}
$('applyEdit').addEventListener('click',()=>{if(place(editing,Number($('startSelect').value),Number($('laneSelect').value)))$('editDialog').close();});
$('removeTask').addEventListener('click',()=>{state.schedule=state.schedule.filter(p=>p.id!==editing);record('remove',{id:editing});$('editDialog').close();render();});
$('closeEditor').addEventListener('click',()=>$('editDialog').close());
$('helpButton').addEventListener('click',()=>$('helpDialog').showModal());
for(const id of ['closeHelp','startPlaying'])$(id).addEventListener('click',()=>$('helpDialog').close());
$('feedbackMode').addEventListener('click',()=>{state.mode='feedback';record('feedback-mode');render();});
$('blindMode').addEventListener('click',()=>{state.mode='blind';state.phase='unaided';record('unaided-mode');render();});
$('exampleButton').addEventListener('click',()=>{if(state.participant!=='TEST'){toast('Use TEST to explore an example. Participant sessions start with their own plan.');return;}if(state.schedule.length&&!confirm('Replace the working grid with an example? Existing events and saved runs remain in the session export.'))return;state.schedule=clone(EXAMPLE);record('load-example');render();toast('Illustrative example loaded. Do not use example data as participant evidence.');});
$('resetButton').addEventListener('click',()=>{if(state.schedule.length&&!confirm('Clear the working grid? The original actions and saved first run remain in your export.'))return;record('before-clear');state.schedule=[];selected=null;record('clear');render();});
$('captureButton').addEventListener('click',captureBaseline);
$('guidedButton').addEventListener('click',()=>{if(!state.baseline)return;state.schedule=clone(state.baseline.schedule);state.mode='feedback';state.phase='guided';record('guided-revision-start');render();toast('Revise your first plan with live feedback. Its original version stays saved.');});
$('finishButton').addEventListener('click',()=>{if(state.mode==='blind'){captureBaseline();return;}const metrics=evaluate(state.schedule);if(!metrics.valid)return;const run={at:new Date().toISOString(),phase:state.phase,mode:state.mode,schedule:clone(state.schedule),metrics};state.runs.push(run);record('finish-run',{run});render();notifyParent('prototype-complete');document.getElementById('roundBanner').textContent='PLAN COMPLETE · Your final plan is saved. Use Continue to questionnaire above the planner.';toast('Plan complete. Continue to the questionnaire above.');});
$('exportButton').addEventListener('click',exportSession);
$('participant').addEventListener('change',event=>{
  const code=event.target.value;
  if(state.events.length&&!confirm('Start a new participant session? Export the current session first if needed. A browser-local archive will also be kept.')){event.target.value=state.participant;return;}
  try{const archive=JSON.parse(localStorage.getItem(KEY+'-archive')||'[]');archive.push(clone(state));localStorage.setItem(KEY+'-archive',JSON.stringify(archive));}catch{}
  state=fresh(code);selected=null;record('new-session');render();
});
buildGrid();if(!state.events.length)record('session-opened');render();
new ResizeObserver(()=>renderEvents(evaluate(state.schedule))).observe($('gridBody'));
// Exported for a researcher to retrieve an existing local session, not for cloud storage.
window.daylight={getSession:()=>clone(state)};
if(state.baseline)document.getElementById('roundBanner').textContent='ROUND 2 · Your first plan is saved. Revise with feedback, then finish and save.';
notifyParent(state.runs.length?'prototype-complete':'prototype-update');
if(IS_TEST){const b=document.createElement('button');b.textContent='TEST ONLY: load example';b.style.cssText='margin:8px;padding:10px';b.addEventListener('click',()=>{state.schedule=clone(EXAMPLE);record('test-example');render();});document.getElementById('roundBanner').append(b);}

import {API_URL,VERSION} from './config.mjs';
const $=id=>document.getElementById(id);
const TEST=new URLSearchParams(location.search).get('test')==='1';
const KEY=VERSION+(TEST?'-test':'-participant');
const clone=v=>JSON.parse(JSON.stringify(v));
const empty=()=>({version:VERSION,test:TEST,stage:'welcome',id:null,token:null,code:null,revision:0,events:[],experience:null,prototype:null,questionnaire:null,media:[],savedAt:null});
let state=empty(),saveTimer,noticeTimer,saving=Promise.resolve(),submitting=false,loadedContent;
try{const saved=JSON.parse(sessionStorage.getItem(KEY));if(saved?.version===VERSION&&saved.test===TEST)state=saved;}catch{}
function persist(){try{sessionStorage.setItem(KEY,JSON.stringify(state));}catch{notice('Browser storage is unavailable. Keep this tab open until your responses are submitted.');}}
function event(type,detail={}){state.events.push({at:new Date().toISOString(),type,...detail});persist();}
function notice(text){$('globalNotice').textContent=text;$('globalNotice').hidden=false;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('globalNotice').hidden=true,6000);}
function show(stage,{save=true}={}){
 state.stage=stage;persist();document.querySelectorAll('.view').forEach(v=>v.hidden=v.dataset.step!==stage);
 const pos={welcome:0,consent:1,instructions:2,prototype:2,questionnaire:3,complete:4}[stage]??0;
 document.querySelectorAll('#progress li').forEach((li,i)=>{li.classList.toggle('active',i===pos);li.classList.toggle('done',i<pos);if(i===pos)li.setAttribute('aria-current','step');else li.removeAttribute('aria-current');});
 document.querySelector('.shell').classList.toggle('task-open',stage==='prototype');
 $('withdraw').hidden=!state.id||stage==='withdrawn';$('sessionCode').textContent=state.code||'';
 if(stage==='questionnaire')setupSurvey();
 if(stage==='complete')renderComplete();
 if(stage==='prototype')loadPlanner();
 window.scrollTo({top:0,behavior:'instant'});$('main').focus({preventScroll:true});
 if(save&&state.id&&['instructions','prototype','questionnaire'].includes(stage))scheduleSave();
}
async function api(body){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);try{const response=await fetch(API_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal});let result;try{result=await response.json();}catch{throw Error('The response service could not be reached. Keep this page open and try again.');}if(!response.ok)throw Error(result.error||'Could not save');return result;}finally{clearTimeout(timer);}}
function payload(){return {version:VERSION,test:TEST,stage:['instructions','prototype','questionnaire','complete'].includes(state.stage)?state.stage:'instructions',experience:state.experience,events:clone(state.events),prototype:clone(state.prototype),questionnaire:clone(state.questionnaire),prototypeStopped:state.prototypeStopped||false};}
function scheduleSave(){if(!state.id)return;clearTimeout(saveTimer);saveTimer=setTimeout(()=>saveNow().catch(()=>{}),1000);}
function saveNow(action='save'){
 clearTimeout(saveTimer);if(!state.id)return Promise.resolve();
 const revision=++state.revision,body={action,id:state.id,token:state.token,revision,payload:payload()};persist();
 $('saveStatus').textContent='Saving privately…';$('saveStatus').classList.remove('problem');
 const operation=saving.catch(()=>{}).then(async()=>{const result=await api(body);state.savedAt=result.savedAt;persist();$('saveStatus').textContent='Saved privately · '+new Date(result.savedAt).toLocaleTimeString();return result;}).catch(error=>{$('saveStatus').textContent='Not synced yet. Keep this page open. Your draft remains here; retry by continuing.';$('saveStatus').classList.add('problem');throw error;});
 saving=operation;return operation;
}
function mediaLabel(text){return text.replace(/^Do you agree to /,'').replace(/^May /,'').replace(/\?$/,'');}
function buildForms(content){
 $('mediaFields').replaceChildren();
 content.mediaQuestions.forEach((question,i)=>{const row=document.createElement('div');row.className='permission-row';const field=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=question;field.append(legend);const choices=document.createElement('div');choices.className='choices';for(const [value,label] of [['yes','Yes'],['no','No']]){const wrapper=document.createElement('label'),input=document.createElement('input');input.type='radio';input.name='media'+i;input.value=value;input.required=true;wrapper.append(input,document.createTextNode(label));choices.append(wrapper);}field.append(choices);row.append(field);$('mediaFields').append(row);});
 $('susFields').replaceChildren();
 content.susItems.forEach((item,i)=>{const row=document.createElement('div');row.className='sus-row';const field=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=(i+1)+'. '+item;field.append(legend);const scale=document.createElement('div');scale.className='scale';for(let n=1;n<=5;n++){const label=document.createElement('label'),input=document.createElement('input');input.type='radio';input.name='sus'+i;input.value=n;input.setAttribute('aria-label',`${n}${n===1?' Strongly disagree':n===5?' Strongly agree':''}`);label.append(input,document.createTextNode(n));scale.append(label);}const skip=document.createElement('label');skip.className='skip-answer';const input=document.createElement('input');input.type='radio';input.name='sus'+i;input.value='';skip.append(input,document.createTextNode('Skip'));scale.append(skip);field.append(scale);const anchors=document.createElement('div');anchors.className='scale-anchors';anchors.innerHTML='<span>1 · Strongly disagree</span><span>5 · Strongly agree</span>';field.append(anchors);row.append(field);$('susFields').append(row);});
}
function loadPlanner(){
 const src='prototype/?session='+encodeURIComponent(state.id)+(TEST?'&test=1':'');
 if(!$('planner').getAttribute('src'))$('planner').src=src;
 if(state.prototype?.runs?.length){$('toFeedback').disabled=false;$('taskHeading').textContent='Your plan is saved.';}
}
const routeNames={digital:'Online prototype',physical:'Physical prototype with researcher',demonstration:'Researcher-led demonstration',none:'No prototype experience'};
function setupSurvey(){
 $('routeLabel').textContent='Your experience: '+routeNames[state.experience];
 const noExperience=state.experience==='none';$('susFields').hidden=noExperience;$('customFields').hidden=noExperience;$('noExperienceNote').hidden=!noExperience;
 if(state.questionnaire){const q=state.questionnaire;for(let i=0;i<10;i++){const value=q.sus[i]??'';const input=document.querySelector(`[name="sus${i}"][value="${value}"]`);if(input)input.checked=true;}for(const key of ['clarity','usefulness','comment'])$('surveyForm').elements[key].value=q[key]??'';}
 updateSurveyDraft(false);
}
function updateSurveyDraft(save=true){
 const f=new FormData($('surveyForm')),number=name=>{const x=f.get(name);return x===null||x===''?null:Number(x);};
 state.questionnaire={sus:Array.from({length:10},(_,i)=>state.experience==='none'?null:number('sus'+i)),clarity:state.experience==='none'?null:number('clarity'),usefulness:state.experience==='none'?null:number('usefulness'),comment:String(f.get('comment')||''),systemContext:state.experience};
 const missing=state.questionnaire.sus.filter(x=>x===null).length;
 $('missingNote').textContent=state.experience==='none'?'You can submit with or without a comment.':missing?`${missing} usability ${missing===1?'statement is':'statements are'} unanswered. You may submit as-is; a total usability score is calculated only when all ten are answered.`:'All ten usability statements are answered. Thank you.';
 persist();if(save)scheduleSave();
}
function renderComplete(){
 $('receiptCode').textContent=state.code;$('receiptTime').textContent='Saved '+new Date(state.savedAt).toLocaleString();
 $('permissionSummary').replaceChildren();loadedContent?.mediaQuestions.forEach((q,i)=>{const row=document.createElement('div');row.className='permission-summary';const label=document.createElement('span'),value=document.createElement('strong');label.textContent=mediaLabel(q);value.textContent=state.media[i]?'Yes':'No';row.append(label,value);$('permissionSummary').append(row);});
}
function download(value,name){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('begin').addEventListener('click',()=>show('consent',{save:false}));
$('decline').addEventListener('click',()=>{$('consentForm').reset();show('declined',{save:false});});
$('restartDecline').addEventListener('click',()=>show('welcome',{save:false}));
$('consentForm').addEventListener('submit',async e=>{
 e.preventDefault();if(submitting)return;submitting=true;$('consentSubmit').disabled=true;$('consentError').textContent='Saving your consent privately…';
 const f=new FormData(e.currentTarget),consent={name:String(f.get('name')).trim(),uid:String(f.get('uid')).trim().toLowerCase(),eligible:f.get('eligible')==='on',agreed:f.get('agreed')==='on',media:Array.from({length:5},(_,i)=>f.get('media'+i)==='yes'),restrictions:String(f.get('restrictions')||''),test:TEST,infoVersion:VERSION,at:new Date().toISOString()};
 try{const r=await api({action:'create',consent});state={...empty(),id:r.id,token:r.token,code:r.code,media:consent.media,savedAt:r.savedAt};event('consent-saved',{infoVersion:VERSION});e.target.reset();$('consentError').textContent='';show('instructions');}catch(error){$('consentError').textContent=error.message;}finally{submitting=false;$('consentSubmit').disabled=false;}
});
$('startOnline').addEventListener('click',()=>{state.experience='digital';event('route-chosen',{experience:'digital'});show('prototype');});
$('skipOnline').addEventListener('click',()=>{if(!$('experienceConfirmed').checked){$('routeError').textContent='Confirm that the activity is finished, or that you have agreed with Adith to continue.';return;}state.experience=$('experienceRoute').value;event('route-chosen',{experience:state.experience});show('questionnaire');});
$('toFeedback').addEventListener('click',()=>{event('prototype-to-questionnaire');show('questionnaire');});
$('leaveTask').addEventListener('click',()=>{if(!confirm('Stop the online activity and continue to feedback? Your unfinished plan will be kept as observed.'))return;state.prototypeStopped=true;event('prototype-stopped-early');show('questionnaire');});
window.addEventListener('message',e=>{
 if(e.origin!==location.origin||e.source!==$('planner').contentWindow||e.data?.source!=='daylight-prototype'||!state.id||state.experience!=='digital'||state.stage!=='prototype')return;
 const p=e.data.state;if(!Array.isArray(p?.schedule)||!Array.isArray(p?.events))return;
 state.prototype=p;persist();scheduleSave();
 if(p.baseline){$('taskHeading').textContent='Now explore a better time.';$('taskNote').textContent='Your first plan is saved. Revise it with live feedback, then finish and save.';}
 if(e.data.type==='prototype-complete'||p.runs?.length){$('toFeedback').disabled=false;$('taskHeading').textContent='Your plan is saved.';$('taskNote').textContent='Continue to the questionnaire when you are ready.';}
});
$('surveyForm').addEventListener('input',()=>updateSurveyDraft());
$('surveyForm').addEventListener('submit',async e=>{e.preventDefault();if(submitting)return;submitting=true;$('surveySubmit').disabled=true;$('surveyError').textContent='Submitting your responses…';updateSurveyDraft(false);event('questionnaire-submitted');const previous=state.stage;state.stage='complete';try{const r=await saveNow('finish');if(!r.finished)throw Error('Submission was not confirmed. Please retry.');state.savedAt=r.savedAt;show('complete',{save:false});}catch(error){state.stage=previous;persist();$('surveyError').textContent=error.message;}finally{submitting=false;$('surveySubmit').disabled=false;}});
$('downloadReceipt').addEventListener('click',()=>download({code:state.code,test:state.test,experience:state.experience,savedAt:state.savedAt,contact:'u7623871@anu.edu.au',withdrawBy:'2026-11-05 23:59 AEDT'},'daylight-receipt-'+state.code+'.json'));
$('newParticipant').addEventListener('click',()=>{if(!confirm('Your submission is saved. Clear this device and return to welcome?'))return;try{localStorage.removeItem('daylight-portal-prototype-'+state.id);sessionStorage.removeItem(KEY);}catch{}location.reload();});
$('withdraw').addEventListener('click',async()=>{if(!confirm('Delete the website consent and responses for this session? Separate interview recordings or copies must also be withdrawn with Adith.'))return;clearTimeout(saveTimer);$('withdraw').disabled=true;try{await saving.catch(()=>{});await api({action:'withdraw',id:state.id,token:state.token});try{localStorage.removeItem('daylight-portal-prototype-'+state.id);sessionStorage.removeItem(KEY);}catch{}state=empty();show('withdrawn',{save:false});}catch(error){notice(error.message);}finally{$('withdraw').disabled=false;}});
$('testFill').addEventListener('click',()=>{if(!TEST)return;const f=$('consentForm');f.elements.name.value='Test Participant';f.elements.uid.value='u0000000';f.elements.eligible.checked=true;f.elements.agreed.checked=true;for(let i=0;i<5;i++)f.querySelector(`[name="media${i}"][value="no"]`).checked=true;});
$('testBanner').hidden=!TEST;$('testFill').hidden=!TEST;
try{const response=await fetch('study-content.json');if(!response.ok)throw Error();loadedContent=await response.json();buildForms(loadedContent);show(state.stage,{save:false});}catch{notice('Study questions could not be loaded. Please refresh before continuing.');$('begin').disabled=true;}
window.addEventListener('online',()=>{if(state.id&&['instructions','prototype','questionnaire'].includes(state.stage))saveNow().catch(()=>{});});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&state.id&&['instructions','prototype','questionnaire'].includes(state.stage))saveNow().catch(()=>{});});

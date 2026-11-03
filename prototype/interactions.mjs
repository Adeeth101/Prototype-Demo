import {SLOTS,BY_ID,LANE_META,SLOT_LABELS} from './engine.mjs?v=learning-v4';
import {grabOffset,hitTarget,dropState,backgroundTracks} from './drag-model.mjs?v=learning-v4';
export function createInteractions({getState,getSelected,setSelected,place,remove,record,hint}){
 const grid=document.getElementById('gridBody'),library=document.querySelector('.library'),zone=document.getElementById('removeZone'),preview=document.createElement('div');
 preview.className='drop-preview';preview.hidden=true;preview.setAttribute('aria-hidden','true');grid.append(preview);
 let drag=null,hoverKey='',ignoreUntil=0,grown=null;
 const labelWidth=()=>parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--lane-label'))||96;
 function clean(){
  preview.hidden=true;hoverKey='';document.querySelectorAll('.target-cell,.target-header,.target-lane,.source-cell').forEach(n=>n.classList.remove('target-cell','target-header','target-lane','source-cell','blocked','warning'));
  if(grown){grid.style.height=grown.grid;document.querySelectorAll('.lane')[2].style.height=grown.lane;grown=null;}
 }
 function target(e){return hitTarget(e.clientX,e.clientY,grid.getBoundingClientRect(),labelWidth(),[...document.querySelectorAll('.lane')].map(n=>n.offsetHeight),drag?.offset||0);}
 function markSource(id){
  clean();const p=getState().schedule.find(p=>p.id===id);if(!p)return;
  for(let s=p.start;s<p.start+BY_ID[id].duration;s++)grid.querySelector(`.slot[data-lane="${p.lane}"][data-slot="${s}"]`)?.classList.add('source-cell');
 }
 function show(e){
  const id=drag?.id||getSelected(),p=target(e);if(!id||!p){clean();return null;}
  const state=getState(),status=dropState(state.schedule,id,p.start,p.lane,state.phase==='guided'),key=[id,p.start,p.lane,status.tone].join(':');
  if(key===hoverKey)return {id,...p,...status};clean();hoverKey=key;
  const task=BY_ID[id],width=grid.clientWidth-labelWidth(),cell=width/SLOTS;
  let top=p.lane===0?22:p.lane===1?114:227;
  if(p.lane===2){const others=state.schedule.filter(q=>q.id!==id),layout=backgroundTracks(others);let track=0;while(others.some(q=>q.lane===2&&layout.map.get(q.id)===track&&q.start<p.start+task.duration&&p.start<q.start+BY_ID[q.id].duration))track++;top=227+track*56;
   if(top+54>grid.offsetHeight){const row=document.querySelectorAll('.lane')[2];grown={grid:grid.style.height,lane:row.style.height};row.style.height=(top+54-184)+'px';grid.style.height=(top+54)+'px';}
  }
  preview.hidden=false;preview.className='drop-preview '+status.tone;preview.style.cssText=`left:${labelWidth()+Math.max(0,p.start)*cell+2}px;top:${top}px;width:${Math.max(18,(Math.min(SLOTS,p.start+task.duration)-Math.max(0,p.start))*cell-4)}px`;
  preview.textContent=task.short+' · '+task.duration+(task.duration===1?' slot':' slots');
  for(let s=Math.max(0,p.start);s<Math.min(SLOTS,p.start+task.duration);s++){
   grid.querySelector(`.slot[data-lane="${p.lane}"][data-slot="${s}"]`)?.classList.add('target-cell',status.tone);
   document.querySelectorAll('#timeAxis>span')[s+1]?.classList.add('target-header',status.tone);
  }
  document.querySelectorAll('.lane')[p.lane]?.classList.add('target-lane');
  hint(`${task.name} → ${LANE_META[p.lane].name}, ${SLOT_LABELS[p.start]||'outside day'} · ${status.message}`);
  return {id,...p,...status};
 }
 function end(committed=false){
  if(drag&&!committed&&!drag.committed){record('drag-cancelled',{id:drag.id});setSelected(drag.previous);}
  drag=null;clean();document.body.classList.remove('drag-active','drag-removing');document.querySelectorAll('.drag-source').forEach(n=>n.classList.remove('drag-source'));zone.classList.remove('over');hint();
 }
 function begin(e,id,placed){
  if(getState().phase==='complete'){e.preventDefault();return;}
  const rect=e.currentTarget.getBoundingClientRect();drag={id,placed,previous:getSelected(),offset:placed?grabOffset(e.clientX,rect.left,rect.width,BY_ID[id].duration):0,committed:false};
  setSelected(id);e.dataTransfer.setData('text/plain',id);e.dataTransfer.effectAllowed='move';e.currentTarget.classList.add('drag-source');document.body.classList.add('drag-active');record('drag-started',{id,from:placed?'board':'tray',grabOffset:drag.offset});hint('Drag onto the board. Drag left into the tray to remove.');
 }
 grid.addEventListener('dragover',e=>{if(!drag)return;e.preventDefault();zone.classList.remove('over');document.body.classList.remove('drag-removing');const p=show(e);e.dataTransfer.dropEffect=p?.allowed?'move':'none';});
 grid.addEventListener('drop',e=>{if(!drag)return;e.preventDefault();const p=show(e);drag.committed=true;ignoreUntil=Date.now()+200;clean();if(p)place(p.id,p.start,p.lane,'drag');end(true);});
 grid.addEventListener('dragleave',e=>{if(!grid.contains(e.relatedTarget)){clean();hint();}});
 grid.addEventListener('mousemove',e=>{if(drag)return;if(getSelected())show(e);});
 grid.addEventListener('mouseleave',()=>{if(!drag){clean();hint();}});
 grid.addEventListener('click',e=>{if(Date.now()<ignoreUntil||!getSelected()||getState().phase==='complete')return;const p=target(e);if(p){clean();place(getSelected(),p.start,p.lane,'click');}});
 library.addEventListener('dragover',e=>{if(!drag)return;e.preventDefault();clean();zone.classList.add('over');document.body.classList.add('drag-removing');e.dataTransfer.dropEffect='move';hint(drag.placed?'Release on the left to return this tile to the tray.':'Release to leave this tile in the tray.');});
 library.addEventListener('dragleave',e=>{if(!library.contains(e.relatedTarget)){zone.classList.remove('over');document.body.classList.remove('drag-removing');}});
 library.addEventListener('drop',e=>{if(!drag)return;e.preventDefault();const {id,placed}=drag;drag.committed=true;ignoreUntil=Date.now()+200;end(true);setSelected(null);if(placed)remove(id,'drag-left');else hint('Tile returned to the tray.');});
 zone.addEventListener('click',()=>{const id=getSelected();if(id&&getState().schedule.some(p=>p.id===id)){clean();remove(id,'tray-button');}else hint('Drag a placed tile left into the tray to remove it.');});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){end(false);setSelected(null);hint();}});
 return {
  beforeRender:clean,reattach:()=>grid.append(preview),ignoreClick:()=>Date.now()<ignoreUntil,
  wireTile(node,id,placed){
   node.addEventListener('dragstart',e=>begin(e,id,placed));node.addEventListener('dragend',()=>end());
   node.addEventListener('mouseenter',()=>{if(!drag&&!getSelected())markSource(id);});node.addEventListener('mouseleave',()=>{if(!drag&&!getSelected())clean();});
   if(placed)node.addEventListener('keydown',e=>{if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();clean();remove(id,'keyboard');}});
  }
 };
}

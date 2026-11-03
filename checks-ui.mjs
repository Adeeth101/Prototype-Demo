import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const {Window}=await import(process.argv[2]?pathToFileURL(process.argv[2]).href:'happy-dom');
const win=new Window({url:'https://daylight.test/prototype/?test=1&session=ui-regression',settings:{disableJavaScriptFileLoading:true,disableCSSFileLoading:true,enableJavaScriptEvaluation:false}});
win.document.write(readFileSync(new URL('./prototype/index.html',import.meta.url),'utf8'));
for(const k of ['window','document','location','localStorage','getComputedStyle','requestAnimationFrame','ResizeObserver','FormData']){
 const v=k==='window'?win:win[k];if(v)Object.defineProperty(globalThis,k,{value:typeof v==='function'&&!['ResizeObserver','FormData'].includes(k)?v.bind(win):v,configurable:true,writable:true});
}
globalThis.ResizeObserver=class{observe(){}disconnect(){}};globalThis.requestAnimationFrame=cb=>{cb();return 1;};win.HTMLElement.prototype.scrollIntoView=function(){};
Object.defineProperty(win.HTMLElement.prototype,'clientWidth',{get(){return 800;},configurable:true});Object.defineProperty(win.HTMLElement.prototype,'offsetHeight',{get(){return parseFloat(this.style.height)||92;},configurable:true});
win.HTMLElement.prototype.getBoundingClientRect=function(){const tile=this.classList.contains('event'),card=this.classList.contains('task-card'),left=card?0:tile?100+parseFloat(this.style.left):100,top=card?0:tile?50+parseFloat(this.style.top):50,width=card?200:tile?parseFloat(this.style.width):800,height=this.offsetHeight;return {left,top,width,height,right:left+width,bottom:top+height,x:left,y:top};};
win.document.documentElement.style.setProperty('--lane-label','100px');
const errors=[];win.addEventListener('error',e=>errors.push(String(e.error||e.message)));
await import('./prototype/app.mjs');const $=id=>win.document.getElementById(id),session=()=>win.daylight.getSession();
const assertRendered=()=>{assert.deepEqual(errors,[],'Application handlers must not throw');assert.equal(win.document.querySelectorAll('#gridBody>.event').length,session().schedule.length,'Every saved placement must create a visible tile node');};
$('drawAll').click();$('stageNext').click();assert.equal(session().substep,'arrange');assert.equal(win.document.querySelectorAll('.task-card').length,10);
const first=win.document.querySelector('.task-card');first.click();$('gridBody').dispatchEvent(new win.MouseEvent('click',{bubbles:true,clientX:200+5*700/12+5,clientY:75,detail:1}));assert.equal(session().schedule.length,1);assertRendered();
const long=session().rounds[0].tasks.find(t=>t.duration===2&&t.id!==first.dataset.id),card=win.document.querySelector(`.task-card[data-id="${long.id}"]`),data=new Map(),transfer={effectAllowed:'',dropEffect:'',setData:(k,v)=>data.set(k,v),getData:k=>data.get(k)||''};
function dragEvent(node,type,x,y){const e=new win.Event(type,{bubbles:true,cancelable:true});Object.defineProperties(e,{clientX:{value:x},clientY:{value:y},dataTransfer:{value:transfer}});node.dispatchEvent(e);}
dragEvent(card,'dragstart',20,20);dragEvent($('gridBody'),'dragover',200+7*700/12+5,50+92+25);
assert.equal(win.document.querySelector('.drop-preview').hidden,false);assert(parseFloat(win.document.querySelector('.drop-preview').style.width)>100,'Preview must show both slots');assert.equal(session().schedule.length,1,'Hover must not mutate the plan');
dragEvent($('gridBody'),'drop',200+7*700/12+5,50+92+25);assert.equal(session().schedule.length,2);assertRendered();
const placed=[...win.document.querySelectorAll('#gridBody>.event')].find(n=>n.title.startsWith(long.name)),rect=placed.getBoundingClientRect();dragEvent(placed,'dragstart',rect.left+10,rect.top+10);dragEvent(win.document.querySelector('.library'),'drop',30,300);assert.equal(session().schedule.length,1);assertRendered();
$('toast').querySelector('button').click();assert.equal(session().schedule.length,2);assertRendered();
$('testExample').click();assert.equal(session().schedule.length,10);assertRendered();
$('stageNext').click();assert.equal(session().substep,'checkin');$('stageNext').click();assert.equal(session().roundIndex,1);$('drawAll').click();$('stageNext').click();$('testExample').click();assert.equal(session().mode,'feedback');assert.equal(session().schedule.length,10);assertRendered();
await win.happyDOM.abort();console.log('PASS: actual app entrypoint/handlers render click and drag placements, two-slot hover, left-tray removal/Undo, TEST full plan and next-day aided board with no runtime errors. DOM geometry is a fixture, not browser visual QA.');

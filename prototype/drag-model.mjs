import {SLOTS,LANE_META,BY_ID,insideWindow,canPlace} from './engine.mjs?v=learning-v4';
export function grabOffset(clientX,left,width,duration){return Math.max(0,Math.min(duration-1,Math.floor((clientX-left)/width*duration)));}
export function hitTarget(x,y,rect,labelWidth,laneHeights,offset=0){
 const localX=x-rect.left-labelWidth,localY=y-rect.top,width=rect.width-labelWidth;
 if(localX<0||localX>=width||localY<0||localY>=laneHeights.reduce((a,b)=>a+b,0))return null;
 let lane=0,top=0;while(lane<laneHeights.length-1&&localY>=top+laneHeights[lane])top+=laneHeights[lane++];
 return {lane,start:Math.floor(localX/width*SLOTS)-offset};
}
export function dropState(schedule,id,start,lane,showRules=false){
 const t=BY_ID[id];if(!t)return {allowed:false,tone:'blocked',message:'Choose an activity.'};
 if(start<0||start+t.duration>SLOTS)return {allowed:false,tone:'blocked',message:'The whole tile must fit inside the day.'};
 if(lane===2&&!t.unattended)return {allowed:false,tone:'blocked',message:'Needs a person: use Personal or Household.'};
 if(!canPlace(schedule,id,start,lane))return {allowed:false,tone:'blocked',message:'That attention lane is occupied.'};
 const before=t.after?schedule.find(p=>p.id===t.after):null;
 if(showRules&&(!insideWindow(t,start)||t.after&&(!before||start<before.start+BY_ID[t.after].duration)))return {allowed:true,tone:'warning',message:t.rule+'. You can place it, then revise.'};
 return {allowed:true,tone:'fits',message:LANE_META[lane].overlap?'Fits here. Background uses can overlap.':'Fits here.'};
}
export function backgroundTracks(schedule){
 const map=new Map(),ends=[];
 for(const p of [...schedule].filter(p=>p.lane===2&&BY_ID[p.id]).sort((a,b)=>a.start-b.start||a.id.localeCompare(b.id))){let i=ends.findIndex(end=>end<=p.start);if(i<0)i=ends.length;ends[i]=p.start+BY_ID[p.id].duration;map.set(p.id,i);}
 return {map,count:Math.max(1,ends.length)};
}

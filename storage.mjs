import {DATA_EPOCH} from './config.mjs?v=placement-fix-v6';
export function clearRetiredDrafts(storage){
 for(let i=storage.length-1;i>=0;i--){const key=storage.key(i);if(key&&/^(daylight-portal-|daylight-study-)/.test(key)&&!key.includes(DATA_EPOCH))storage.removeItem(key);}
}
export const prototypeKey=id=>'daylight-portal-prototype-'+DATA_EPOCH+'-'+id;

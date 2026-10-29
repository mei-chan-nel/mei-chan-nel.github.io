import {currentData,applyData} from './shared/data-model.mjs?v=20261026-final-upgrade';
import {renderDataView} from './data/view.mjs?v=20261026-final-upgrade';
// Adapter for existing calculation states; UI and validation are shared with foundations.
export function renderDataTab(root,{id,state,sample,apply,analyze,nextLabel,allowGroup=false,dataOverride=null,ui={}}){
 const data=dataOverride||currentData(id,state);ui.commitData=()=>true;
 renderDataView(root,{id:allowGroup?'projects':id,data,sample,analyze,nextLabel,notice:ui.dataNotice||'',apply:document=>apply(applyData(id,state,{...document,x:id==='time-series'?1:0,y:1,date:0,group:id==='histogram'?1:allowGroup?2:-1}))});
}

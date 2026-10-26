import {showDataContext,updateDataIntro} from "../data/context.mjs?v=20261026-final-upgrade";
import {esc} from '../shared/ui.mjs?v=20261026-final-upgrade';
import {renderDataView} from '../data/view.mjs?v=20261026-final-upgrade';
import {setupFullscreen} from '../fullscreen.mjs?v=20261026-final-upgrade';
import {clearFullscreenExplanations} from '../shared/fullscreen-layout.mjs?v=20261026-final-upgrade';
import {renderAcademicExplanation} from '../shared/explanation.mjs?v=20261026-final-upgrade';
import {fitWorkspaceCharts} from '../shared/chart-layout.mjs?v=20261026-final-upgrade';
const id=document.body.dataset.statLab,config=(await import(`../${id}/lab.mjs?v=${'20261026-final-upgrade'}`)).default,key=`study-atlas-statistics-${id}-v1`;
let state=config.initial(),view=-1,notice='',lastRenderedView=null;
try{const saved=JSON.parse(localStorage.getItem(key));if(saved?.version===1&&saved.id===id&&saved.state?.origin==='user')state=config.normalize(saved.state);}catch{}
const root=document.querySelector('#experiment'),tabs=document.querySelector('#view-tabs');
const persist=()=>{try{localStorage.setItem(key,JSON.stringify({version:1,id,state}));}catch{}};
const fail=error=>{const box=document.querySelector('#foundation-error');if(box){box.textContent=error.message;box.hidden=false;}};
function update(patch){try{state=config.normalize({...state,...patch});persist();draw();}catch(e){fail(e);}}
function go(next){if(next>=0&&config.enterView){state=config.enterView(state,next);persist();}view=next;notice='';draw();}
function dataView(){
 const data={name:state.dataInfo?.name||(state.origin==='sample'?config.dataTitle:'自分のデータ'),headers:state.dataInfo?.columns||config.headers,rows:state.rows,origin:state.origin,filename:state.dataInfo?.filename,operation:config.dataHint};
 renderDataView(root,{id,data,notice,nextLabel:config.views[0].title,analyze:()=>go(0),sample:()=>{state=config.initial();persist();notice='標準データに戻しました。';draw();},apply:doc=>{state=config.normalize({...state,rows:doc.rows,origin:'user',truth:null,dataInfo:{name:doc.name,columns:doc.headers,filename:doc.filename}});persist();notice='自分のデータを読み込みました。';draw();}});
}
function draw(){
 updateDataIntro(id,{name:state.dataInfo?.name||config.dataTitle,rows:state.rows,origin:state.origin});
 const focused=document.activeElement?.id;
 const openDetails=view===lastRenderedView?[...root.querySelectorAll('details[id][open]')].map(el=>el.id):[];
 lastRenderedView=view;clearFullscreenExplanations(root);
 tabs.innerHTML=[{title:'データ'},...config.views].map((v,i)=>`<button type="button" id="${i?'view-'+(i-1):'data-tab'}" data-view="${i-1}" aria-pressed="${view===i-1}">${esc(v.title)}</button>`).join('');
 tabs.querySelectorAll('[data-view]').forEach(el=>el.onclick=()=>go(Number(el.dataset.view)));
 document.querySelector('#tab-progress').textContent=`${view+2} / ${config.views.length+1} · ${view<0?'データ確認':config.views[view].purpose}`;
 document.querySelector('#lab-lead').textContent='';document.querySelector('#experiment-insight').textContent='';document.querySelector('#analysis-flow').textContent='';
 if(view<0)dataView();else{root.innerHTML='<div class="workbench unified-workbench foundation-workbench"><div class="workbench-body"><section class="workbench-display"></section></div></div>';const display=root.querySelector('.workbench-display');config.render(display,{state,view,update});showDataContext(display,{name:state.dataInfo?.name||(state.origin==='sample'?config.dataTitle:'自分のデータ'),rows:state.rows});display.insertAdjacentHTML('afterbegin','<p id="foundation-error" class="error" role="alert" hidden></p>');fitWorkspaceCharts(display);}
 document.querySelector('#step-navigation').innerHTML=`<div class="step-buttons">${view>=0?'<button id="step-prev" type="button">← 前へ</button>':''}<span>${view+2} / ${config.views.length+1}</span>${view<config.views.length-1?'<button id="step-next" class="primary" type="button">次へ →</button>':''}</div>`;
 document.querySelector('#step-prev')?.addEventListener('click',()=>go(view-1));document.querySelector('#step-next')?.addEventListener('click',()=>go(view+1));
 for(const id of openDetails){const el=root.querySelector('#'+id);if(el?.tagName==='DETAILS')el.open=true;}
 if(focused)document.getElementById(focused)?.focus({preventScroll:true});
}
const explanation=document.querySelector('#explanation-body');renderAcademicExplanation(explanation,config.explanation);
document.querySelector('#lab-picker').onchange=e=>location.href=`../${e.target.value}/`;
setupFullscreen(document.querySelector('#statistics-workspace'),draw);performance.mark('statistics-data-ready');document.dispatchEvent(new Event('statistics-data-ready'));draw();
let layoutTimer;
window.addEventListener('resize',()=>{
 clearTimeout(layoutTimer);
 if(view>=0)layoutTimer=setTimeout(()=>{if(view>=0)draw();},120);
});

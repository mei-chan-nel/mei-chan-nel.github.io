import {esc} from '../shared/ui.mjs?v=20261025-reading-missing';
import {parseDelimited,serializeCSV} from '../shared/csv.mjs';
import {setupFullscreen} from '../fullscreen.mjs?v=20261025-reading-missing';
import {clearFullscreenExplanations} from '../shared/fullscreen-layout.mjs?v=20261025-reading-missing';
import {renderAcademicExplanation} from '../shared/explanation.mjs';
import {fitWorkspaceCharts} from '../shared/chart-layout.mjs?v=20261025-reading-missing';
const id=document.body.dataset.statLab,config=(await import(`../${id}/lab.mjs?v=20261025-reading-missing`)).default,key=`study-atlas-statistics-${id}-v1`;
let state=config.initial(),view=-1,draft=null,dirty=false,notice='';
try{const saved=JSON.parse(localStorage.getItem(key));if(saved?.version===1&&saved.id===id)state=config.normalize(saved.state);}catch{}
const root=document.querySelector('#experiment'),tabs=document.querySelector('#view-tabs');
const persist=()=>{try{localStorage.setItem(key,JSON.stringify({version:1,id,state}));}catch{}};
const fail=error=>{const box=document.querySelector('#foundation-error');if(box){box.textContent=error.message;box.hidden=false;}};
function update(patch){try{state=config.normalize({...state,...patch});draft=null;dirty=false;persist();draw();}catch(e){fail(e);}}
function applyRows(rows){state=config.normalize({...state,rows:config.validateRows(rows),origin:'user',truth:null});draft=null;dirty=false;persist();}
function commit(){if(!dirty)return true;try{applyRows(draft);return true;}catch(e){fail(e);return false;}}
function go(next){if(view===-1&&!commit())return;view=next;notice='';draw();}
function dataView(){
 if(!draft)draft=state.rows.map(r=>[...r]);
 root.innerHTML=`<section class="data-view"><div class="data-view-heading"><div><h2>${esc(state.origin==='sample'?config.dataTitle:'入力したデータ')}</h2><p>${state.origin==='sample'?'気象庁の実データ'+(id==='missing-values'?'に欠損を作る実験':''):'入力したデータ'} · ${draft.length}行</p></div><div class="actions"><button id="use-sample" type="button">実データに戻す</button><button id="download-csv" type="button">CSVを保存</button><button id="upload-csv" type="button">CSVを読み込む</button></div></div><p>${esc(config.dataHint)}</p><p id="foundation-error" role="alert" class="error" hidden></p><p role="status">${esc(notice)}</p><div class="table-scroll foundation-data-table"><table class="stat-table"><thead><tr>${config.headers.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}<th scope="col">行の操作</th></tr></thead><tbody>${draft.map((r,i)=>`<tr>${r.map((v,c)=>`<td><input id="data-cell-${i}-${c}" data-row="${i}" data-col="${c}" type="${c===0?'text':'number'}" ${c>0?'step="any"':''} value="${esc(v)}" aria-label="${i+1}行目 ${esc(config.headers[c])}" ${id==='missing-values'&&c===1?'placeholder="欠損"':''}></td>`).join('')}<td><button type="button" data-delete="${i}" aria-label="${i+1}行目を削除">削除</button></td></tr>`).join('')}</tbody></table></div><div class="actions"><button id="add-data-row" type="button">行を追加</button><button id="apply-data-edits" type="button">表の変更を反映</button><button id="discard-data-edits" type="button">編集を取り消す</button><button id="analyze-data" class="primary" type="button">${esc(config.views[0].title)}へ →</button></div><section id="data-upload" class="panel" hidden><h3>CSV・表の貼り付け</h3><p>先頭行は項目名です。</p><label class="control"><span>UTF-8のCSVファイル</span><input id="csv-file" type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values"></label><label class="control" for="csv-text"><span>CSV・TSVを貼り付ける</span><textarea id="csv-text" rows="6"></textarea></label><button id="csv-apply" type="button">読み込む</button></section></section>`;
 root.querySelectorAll('[data-row]').forEach(el=>el.addEventListener('input',()=>{draft[Number(el.dataset.row)][Number(el.dataset.col)]=el.value;dirty=true;}));
 root.querySelectorAll('[data-delete]').forEach(el=>el.onclick=()=>{draft.splice(Number(el.dataset.delete),1);dirty=true;draw();});
 root.querySelector('#add-data-row').onclick=()=>{if(draft.length>=config.maxRows){fail(Error(`最大${config.maxRows}行です。`));return;}draft.push(config.headers.map(()=>''));dirty=true;draw();root.querySelector(`#data-cell-${draft.length-1}-0`)?.focus();};
 root.querySelector('#apply-data-edits').onclick=()=>{if(commit()){notice='表の変更を反映しました。';draw();}};
 root.querySelector('#discard-data-edits').onclick=()=>{draft=null;dirty=false;notice='編集を取り消しました。';draw();};
 root.querySelector('#use-sample').onclick=()=>{state=config.initial();draft=null;dirty=false;persist();notice='実データに戻しました。';draw();};
 root.querySelector('#analyze-data').onclick=()=>go(0);
 root.querySelector('#download-csv').onclick=()=>{if(!commit())return;const url=URL.createObjectURL(new Blob(['\ufeff'+serializeCSV(config.headers,state.rows)],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=`statistics-${id}.csv`;a.click();URL.revokeObjectURL(url);};
 root.querySelector('#upload-csv').onclick=()=>{root.querySelector('#data-upload').hidden=false;};
 root.querySelector('#csv-file').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>1000000)throw Error('1MB以内のファイルを指定してください。');root.querySelector('#csv-text').value=await file.text();}catch(e){fail(e);}};
 root.querySelector('#csv-apply').onclick=()=>{try{const text=root.querySelector('#csv-text').value;if(text.length>1000000)throw Error('1MB以内のデータを貼り付けてください。');const rows=parseDelimited(text);if(rows[0]?.length!==config.headers.length)throw Error(`${config.headers.length}列の項目名とデータを入力してください。`);applyRows(rows.slice(1));notice='CSVを読み込みました。';draw();}catch(e){fail(e);}};
}
function draw(){
 const focused=document.activeElement?.id;clearFullscreenExplanations(root);
 tabs.innerHTML=[{title:'データ'},...config.views].map((v,i)=>`<button type="button" id="${i?'view-'+(i-1):'data-tab'}" data-view="${i-1}" aria-pressed="${view===i-1}">${esc(v.title)}</button>`).join('');
 tabs.querySelectorAll('[data-view]').forEach(el=>el.onclick=()=>go(Number(el.dataset.view)));
 document.querySelector('#tab-progress').textContent=`${view+2} / ${config.views.length+1} · ${view<0?'データ確認':config.views[view].purpose}`;
 document.querySelector('#lab-lead').textContent='';document.querySelector('#experiment-insight').textContent='';document.querySelector('#analysis-flow').textContent='';
 if(view<0)dataView();else{root.innerHTML='<div class="workbench unified-workbench foundation-workbench"><div class="workbench-body"><section class="workbench-display"></section></div></div>';const display=root.querySelector('.workbench-display');config.render(display,{state,view,update});display.insertAdjacentHTML('afterbegin','<p id="foundation-error" class="error" role="alert" hidden></p>');fitWorkspaceCharts(display);}
 document.querySelector('#step-navigation').innerHTML=`<div class="step-buttons">${view>=0?'<button id="step-prev" type="button">← 前へ</button>':''}<span>${view+2} / ${config.views.length+1}</span>${view<config.views.length-1?'<button id="step-next" class="primary" type="button">次へ →</button>':''}</div>`;
 document.querySelector('#step-prev')?.addEventListener('click',()=>go(view-1));document.querySelector('#step-next')?.addEventListener('click',()=>go(view+1));
 if(focused)document.getElementById(focused)?.focus({preventScroll:true});
}
const explanation=document.querySelector('#explanation-body');renderAcademicExplanation(explanation,config.explanation);
document.querySelector('#lab-picker').onchange=e=>location.href=`../${e.target.value}/`;
setupFullscreen(document.querySelector('#statistics-workspace'),draw);draw();

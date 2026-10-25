import {esc,metrics,table} from '../shared/ui.mjs?v=20261025-missing-comparison';
import {fmt} from '../shared/math.mjs';
import {METHODS,scenario,validateRows,processMissing,stats,normalize} from './model.mjs?v=20261025-missing-comparison';
import {missingValuesChart} from './charts.mjs?v=20261025-missing-comparison';
import {sourceNote} from '../foundations/weather-data.mjs';
const f=v=>v===null?'—':fmt(v,2);
const patterns=[['random','無作為の6日'],['high','大雨の6日'],['low','少雨の6日'],['none','欠損なし']];
const patternLabel=s=>patterns.find(([id])=>s.origin==='sample'&&s.pattern===id)?.[1]||'表で決めた欠損';
const explanation=`<h3>データを決めてから比べる</h3><p>欠損の位置と観測値はデータタブで決めます。分析では同じデータに対して補完方法を変え、平均・分散・日ごとの値を比べます。0mmは観測値、空欄は分からない値です。</p><h3>一定の値で補完する</h3><p>0、観測値の平均、観測値の中央値で補完できます。平均補完は有効な値だけの平均を保ちますが、平均と同じ値が増えるため分散は小さくなります。中央値は大きな値の影響を受けにくく、平均とは異なる補完値になります。分散の分母は集計した件数nです。</p><h3>前後の観測を使う</h3><p>直前の値による補完は、表の順に最後の観測値を引き継ぎます。線形補間は前後の観測値を日付に沿って直線でつなぎます。日降水量のように急変する量では、雨のピークを再現できない場合があります。先頭の欠損は直前の値がなく、線形補間では両端の欠損に前後の値がないため、そのまま残します。</p><h3>欠け方と偏り</h3><p>大雨の日が欠けたデータでは、残った値だけの平均が低くなります。データタブで異なる欠け方を用意し、同じ方法でも結果が変わることを確かめられます。</p><h3>初期データ</h3><p>東京の2025年6月の日降水量30日分のうち、6日分を教材上で隠しています。公表データの実際の欠測を表すものではありません。実データの例では、隠す前の値を白丸で確認できます。CSVや表で値を変更した場合は、観測値と補完後の値を比較します。</p><p>気象庁の「--」は降水なしとして0mm、「0.0」は公表値0.0mmとして集計します。「0.0」は0.5mm未満の降水を表します。</p>${sourceNote}`;
function methodTable(s){
 return `<div class="table-scroll missing-method-table"><table class="stat-table"><caption>方法を選ぶと、下のグラフに反映されます。</caption><thead><tr><th scope="col">方法</th><th scope="col">集計日数</th><th scope="col">平均（mm）</th><th scope="col">分散（mm²）</th><th scope="col">残る欠損</th></tr></thead><tbody>${METHODS.map(([id,label])=>{const r=processMissing(s.rows,id);return `<tr data-select-method="${id}" class="${s.method===id?'is-selected':''}"><th scope="row"><button type="button" id="missing-method-${id}" data-missing-method="${id}" aria-pressed="${s.method===id}">${label}</button></th><td>${r.n}日</td><td>${f(r.mean)}</td><td>${f(r.variance)}</td><td>${r.remaining}日</td></tr>`;}).join('')}</tbody></table></div>`;
}
const legend=truth=>`<div class="legend missing-legend"><span><i class="missing-key-observed"></i>観測値（0は丸）</span><span><i class="missing-key-imputed"></i>補完値（0はひし形）</span><span>破線と「欠」：残る欠損</span>${truth?'<span>白丸：隠す前の実測値</span>':''}</div>`;
function render(root,{state:s,view,update}){
 root.classList.add('missing-values-display');
 const result=processMissing(s.rows,s.method),selected=METHODS.find(([id])=>id===s.method),truth=s.truth?stats(s.truth):null,bias=view===1;
 const context=`${s.rows.length}日分・欠損${result.missing}日`,heading=bias?'欠け方と補完の結果を読む':'補完方法で、平均・分散はどう変わる？';
 const fixedComparison=bias?`<div class="table-scroll missing-reference-table">${table(['データ','集計日数','平均（mm）','分散（mm²）'],[...(truth?[['隠す前の全データ',truth.n+'日',f(truth.mean),f(truth.variance)]]:[]),['観測値だけ',result.observed.n+'日',f(result.observed.mean),f(result.observed.variance)],[selected[1],result.n+'日',f(result.mean),f(result.variance)]])}</div>`:methodTable(s);
 let interpretation='';
 if(truth&&result.observed.mean!==null){const diff=result.observed.mean-truth.mean;interpretation=`${diff===0?'観測値だけの平均は、隠す前と同じです。':`観測値だけの平均は、隠す前の平均より${f(Math.abs(diff))}mm${diff>0?'高く':'低く'}なっています。`}欠損の設定：${patternLabel(s)}。`;}
 else if(!truth)interpretation='欠損する前の値がないため、観測値だけの集計と補完後の集計を比べます。';
 else interpretation='観測値がないため、元の値から求めた平均だけを示しています。';
 const equation=result.n?`平均 = ${f(result.sum)} ÷ ${result.n} = ${f(result.mean)}mm`:'集計できる値がないため、平均・分散は求められません。';
 root.innerHTML=`<header class="missing-subject-heading"><h2>${heading}</h2><p>${context}</p></header>${fixedComparison}<figure class="missing-primary-plot">${missingValuesChart(s.rows,result.filled,{truth:bias?s.truth:null})}<figcaption>${selected[1]}：${result.imputed}日を補完、${result.remaining}日の欠損が残ります。</figcaption></figure><section class="missing-reading" data-screen-nav-section="${bias?'結果を読む':'選択した方法'}"><h3 id="missing-selected-method">${selected[1]}</h3><p>${selected[2]}</p>${result.reason?`<p id="missing-method-reason" role="status">${esc(result.reason)}</p>`:''}${metrics([['平均（mm）',f(result.mean)],['分散（mm²）',f(result.variance)],['集計日数',`${result.n}日`],['残る欠損',`${result.remaining}日`]])}<p id="missing-equation" aria-live="polite">${equation}</p>${bias?`<p id="missing-bias">${interpretation}</p>${s.truth?'<p>補完後の棒と白丸が離れている日は、補完した値と実測値が違います。</p>':''}`:''}</section>${legend(bias&&s.truth)}<details id="missing-daily-values" class="analysis-notes missing-details"><summary>日ごとの値を確認</summary><div>${table(['日付・観測名','観測値（mm）','集計に使う値（mm）',...(s.truth?['隠す前（mm）']:[])],s.rows.map((r,i)=>[r[0],r[1]===null?'欠損':f(r[1]),result.filled[i]===null?'欠損':f(result.filled[i]),...(s.truth?[f(s.truth[i])]:[])]))}</div></details>`;
 const choose=method=>update({method});
 root.querySelectorAll('[data-missing-method]').forEach(el=>el.onclick=()=>choose(el.dataset.missingMethod));
 root.querySelectorAll('[data-select-method]').forEach(el=>el.onclick=e=>{if(!e.target.closest('button'))choose(el.dataset.selectMethod);});
}
function dataSetup(s){return `<fieldset class="missing-data-examples"><legend>東京の実データで欠損の例を用意する</legend><div>${patterns.map(([id,label])=>`<button id="missing-example-${id}" type="button" data-missing-example="${id}" aria-pressed="${s.origin==='sample'&&s.pattern===id}">${label}</button>`).join('')}</div></fieldset>`;}
function bindDataSetup(root,{state,replace}){root.querySelectorAll('[data-missing-example]').forEach(el=>el.onclick=()=>replace({...scenario(el.dataset.missingExample),method:state.method}));}
export default {id:'missing-values',headers:['日付・観測名','降水量（mm）'],dataTitle:'東京の日降水量（2025年6月）',dataHint:'欠損の位置と観測値は、このタブで決めます。空欄・NAは欠損値、0は観測値です。',maxRows:90,views:[{title:'集計方法を比べる',purpose:'同じ欠損データで、補完方法による平均・分散の違いを比べる。'},{title:'欠け方と偏り',purpose:'確定したデータの欠け方と、補完後の値のずれを読む。'}],initial:()=>normalize({...scenario(),method:'drop'}),normalize,validateRows,render,explanation,dataSetup,bindDataSetup};

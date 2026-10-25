import {esc,number,table} from '../shared/ui.mjs?v=20261025-rain-series';
import {fmt} from '../shared/math.mjs';
import {sampleRows,validateRows,normalize,enterView,histogram} from './model.mjs?v=20261025-rain-series';
import {KINDS,lesson,suitability,rainAxisExample,supportedKinds} from './lessons.mjs?v=20261025-rain-series';
import {categoryChart,scatterChart,pieChart} from '../foundations/charts.mjs?v=20261025-rain-series';
import {pairedTimeChart} from './charts.mjs?v=20261025-rain-series';
import {sourceNote} from '../foundations/weather-data.mjs';
const explanation=`<h3>気温の変化を読む</h3><p>折れ線は日付順の変化を追えます。棒では変化が見えにくく、0℃から棒を伸ばす意味もありません。ヒストグラムはどの気温帯の日が多いかを表し、日付順の変化は表しません。</p><h3>降水量の内訳を読む</h3><p>日降水量を「1mm未満・1mm以上10mm未満・10mm以上」に分けます。棒は区分ごとの日数や差を比較し、円は全日数を100%として内訳を表します。折れ線も描けますが、区分を結んだ線から時間の変化は読めません。ヒストグラムでは降水量を同じ幅に区切り、分布を見ます。</p><h3>日照と気温の関係を読む</h3><p>散布図では、同じ日の日照時間と気温を1つの点で対応させます。折れ線や棒では横軸を日付にして、2系列を重ねたり、上下に分けたりできます。丸は日照時間、四角は気温です。単位が違うため、重ねる場合は左右に別々の目盛りを置きます。線の交点や同じ高さが、同じ量を意味するわけではありません。</p><h3>初期データ</h3><p>東京の2025年6〜7月の61日分です。降水量の3区分は重複せず、全日数の内訳になります。気象庁の「--」は降水なしとして0、「0.0」は公表値0.0mmとして集計します。「0.0」は0.5mm未満の降水を表します。</p>${sourceNote}`;
const titles=['気温の変化','降水量の内訳','日照と気温の関係'];
const orderControl=l=>['compare','share'].includes(l.id)?'<div class="graph-order-controls" role="group" aria-label="区分の並び"><span>区分の並び</span><button id="graph-reorder" type="button">並び順を変える</button></div>':'';
function plot(s,l,kind){
 const fit=suitability(l.id,kind);
 if(!supportedKinds(l.id).includes(kind))return `<section class="graph-subject-plot graph-no-chart" id="graph-no-chart" role="status"><div><h3>${esc(fit.title)}</h3><p>${esc(fit.text)}</p></div></section>`;
 if(l.id==='relation'&&['line','bar'].includes(kind))return `<figure class="graph-subject-plot">${pairedTimeChart(s.rows,{focusDay:l.focusDay,selectedDay:s.selectedDay,kind,layout:s.pairLayout})}<figcaption>${s.pairLayout==='stack'?'上：日照時間、下：日平均気温。':'左目盛り：日照時間（丸）、右目盛り：気温（四角）。'}横軸は日付です。</figcaption></figure>`;
 if(l.id==='relation')return `<figure class="graph-subject-plot">${scatterChart(s.rows,['sun','日照時間','h',3],['temp','日平均気温','℃',2],{focusDay:l.focusDay,selectedDay:s.selectedDay})}<figcaption>1点が1日。橙の点を選ぶと、同じ日の2つの値を確認できます。</figcaption></figure>`;
 if(kind==='pie')return `<figure class="graph-subject-plot">${pieChart(l.items,'全日数に占める降水量の3区分')}<figcaption>全${s.rows.length}日が100%。3区分は重複しません。${orderControl(l)}</figcaption></figure>`;
 let items=l.items,unit=l.unit,min=0,contiguous=false,highlights=[];
 if(l.id==='trend'&&kind==='histogram'){
  const dist=lesson(s.rows,'distribution');items=dist.items;unit=dist.unit;contiguous=true;
 }else if(kind==='histogram'){
  items=histogram(s.rows.map(r=>r[1]),5);unit='日数（日）';contiguous=true;
 }else if(l.id==='trend'){
  const values=items.map(r=>r.value);min=kind==='bar'?Math.min(0,...values):Math.min(...values)-1;
  highlights=[values.indexOf(Math.min(...values)),values.indexOf(Math.max(...values))];
 }
 const caption=l.id==='trend'?(kind==='histogram'?'横軸は気温の区間（℃）、縦軸は日数。日付の順序は表しません。':'横軸は日付、縦軸は日平均気温。値の高低と差を読みます。'):(kind==='histogram'?'横軸は降水量の区間（mm）、縦軸は日数。各区間の幅は5mmです。':'横軸は降水量の3区分。区分同士に時間の順序はありません。');
 return `<figure class="graph-subject-plot">${categoryChart(items,{min,baseline:l.id==='trend'&&kind==='bar'?0:null,line:kind==='line',contiguous,integerTicks:l.id!=='trend'||kind==='histogram',highlightIndices:highlights,unit,title:kind==='histogram'?(l.id==='trend'?'日平均気温の分布。日付順の変化は表しません。':'日降水量の分布。5mmごとの日数。'):l.title})}<figcaption>${caption}${kind==='histogram'?'':orderControl(l)}</figcaption></figure>`;
}
function render(root,{state:s,view,update}){
 root.classList.add('graph-reading-display');
 const task=view===0?'trend':view===1?s.rainQuestion:'relation',l=lesson(s.rows,task,s.orders[view]),kind=s.choices[view],allowed=supportedKinds(task),fit=suitability(task,kind);
 const set=(key,value)=>update({[key]:s[key].map((v,i)=>i===view?value:v)});
 const canRender=allowed.includes(kind);
 const answer=s.answers[view],answered=l.quiz.options.some(o=>o[0]===answer),correct=answered&&answer===l.quiz.correct;
 const selected=s.rows.find(r=>r[0]===s.selectedDay),point=task==='relation'&&canRender?(selected?`${selected[0]}：日照${selected[3]}h、日平均気温${selected[2]}℃。`:'点をクリック、またはTabで選んでEnterを押すと数値を確認できます。'):'';
 const rain=rainAxisExample(s.rows);let axis='';
 if(view===1&&rain&&canRender){const a=rain.items[0].value,b=rain.items[1].value;axis=`<details id="graph-axis" class="analysis-notes graph-values"><summary>補足：降水量と棒の長さ</summary><p>量の比を比較できる降水量2日分で、下限だけを変えます。</p><div class="foundation-controls">${number('graph-rain-base','縦軸の下限（mm）',s.axisBase,0,rain.limit,.1)}<button id="graph-rain-zero" type="button">0mmからに戻す</button></div><figure>${categoryChart(rain.items,{min:s.axisBase,unit:'日降水量（mm）',title:'降水量と棒の長さの比較'}).replace('<svg ', '<svg data-scroll-chart ')}</figure><p id="graph-rain-ratios">実際の量の比：${fmt(a/b,2)}倍。棒の長さの比：${fmt((a-s.axisBase)/(b-s.axisBase),2)}倍。</p></details>`;}
 root.innerHTML=`<header class="graph-subject-heading"><h2>${titles[view]}</h2><p>${esc(l.context)}</p></header><div class="graph-subject-controls">${view===1?`<div class="graph-task-switch" role="group" aria-label="内訳から読み取ること"><button type="button" data-rain-question="compare" aria-pressed="${task==='compare'}">日数の差を比べる</button><button type="button" data-rain-question="share" aria-pressed="${task==='share'}">全体の割合を見る</button></div>`:''}<div class="foundation-chart-choices" role="group" aria-label="グラフの種類">${KINDS.map(([id,title])=>`<button type="button" data-chart-kind="${id}" aria-pressed="${kind===id}" >${title}${id===l.recommended?'<small>おすすめ</small>':''}</button>`).join('')}</div>${task==='relation'&&['line','bar'].includes(kind)?`<div class="graph-task-switch graph-pair-layout" role="group" aria-label="2系列の配置"><span>2系列の配置</span><button type="button" data-pair-layout="overlay" aria-pressed="${s.pairLayout==='overlay'}">重ねて表示</button><button type="button" data-pair-layout="stack" aria-pressed="${s.pairLayout==='stack'}">上下に分けて表示</button></div>`:''}</div>${plot(s,l,kind)}${canRender?`<section class="graph-subject-reading" data-screen-nav-section="解説"><h3 id="graph-choice-title">${esc(fit.title)}</h3><p id="graph-choice-feedback" aria-live="polite">${esc(fit.text)}</p><p class="graph-point-reading" id="graph-point-reading">${esc(point)}</p></section><details id="graph-quiz" class="analysis-notes graph-quiz"><summary>読み取りを確かめる</summary><h3>${esc(l.quiz.prompt)}</h3><div class="graph-answer-choices" role="group" aria-label="読み取りの答え">${l.quiz.options.map(([id,label])=>`<button type="button" data-graph-answer="${esc(id)}" aria-pressed="${answer===id}">${esc(label)}</button>`).join('')}</div>${answered?`<p id="graph-answer-feedback" role="status"><strong>${correct?'正解です。':'値を確認しましょう。'}</strong> ${esc(l.quiz.reason)}</p>`:''}</details><details id="graph-values" class="analysis-notes graph-values"><summary>元の値を確認</summary>${table(task==='relation'?['日付','日照時間（h）','日平均気温（℃）']:task==='trend'?['日付','日平均気温（℃）']:['区分','日数（日）'],task==='relation'?s.rows.map(r=>[r[0],r[3],r[2]]):l.items.map(r=>[r.label,r.value]))}</details>${axis}`:''}`;
 root.querySelectorAll('[data-chart-kind]').forEach(el=>el.onclick=()=>set('choices',el.dataset.chartKind));
 root.querySelectorAll('[data-rain-question]').forEach(el=>el.onclick=()=>update({rainQuestion:el.dataset.rainQuestion,choices:s.choices.map((v,i)=>i===1?(el.dataset.rainQuestion==='share'?'pie':'bar'):v),answers:s.answers.map((v,i)=>i===1?'':v)}));
 root.querySelectorAll('[data-pair-layout]').forEach(el=>el.onclick=()=>update({pairLayout:el.dataset.pairLayout}));
 root.querySelectorAll('[data-graph-answer]').forEach(el=>el.onclick=()=>set('answers',el.dataset.graphAnswer));
 root.querySelector('#graph-reorder')?.addEventListener('click',()=>set('orders',(s.orders[view]+1)%3));
 root.querySelector('#graph-rain-base')?.addEventListener('change',e=>{if(e.target.value!==''&&e.target.checkValidity())update({axisBase:Number(e.target.value)});});root.querySelector('#graph-rain-zero')?.addEventListener('click',()=>update({axisBase:0}));
 root.querySelectorAll('[data-lesson-point]').forEach(el=>{const choose=()=>update({selectedDay:el.dataset.lessonPoint});el.addEventListener('click',choose);el.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();choose();}});});
}
export default {id:'graph-reading',headers:['日付','日降水量（mm）','日平均気温（℃）','日照時間（h）'],dataTitle:'東京の日別気象データ（2025年6〜7月）',dataHint:'1行が1日です。気温の変化、降水量の内訳、日照と気温の関係を、それぞれ別のグラフで比べます。',maxRows:90,views:[{title:'気温の変化',purpose:'日付順の変化と、分布や棒での見え方を比べる。'},{title:'降水量の内訳',purpose:'同じ区分を棒・折れ線・円で表し、差や割合を読み分ける。'},{title:'日照と気温',purpose:'2つの量の関係を散布図で、各量の時間変化を折れ線・棒で比べる。'}],initial:()=>normalize({rows:sampleRows(),origin:'sample'}),normalize,enterView,validateRows,render,explanation};

import {esc,number,table} from '../shared/ui.mjs?v=20261025-subject-graphs';
import {fmt} from '../shared/math.mjs';
import {sampleRows,validateRows,normalize} from './model.mjs?v=20261025-subject-graphs';
import {KINDS,lesson,suitability,rainAxisExample,supportedKinds} from './lessons.mjs?v=20261025-subject-graphs';
import {categoryChart,scatterChart,pieChart} from '../foundations/charts.mjs?v=20261025-subject-graphs';
import {sourceNote} from '../foundations/weather-data.mjs';
const explanation=`<h3>気温の変化を読む</h3><p>折れ線は日付順の変化を追えます。棒でも各日の高低は分かりますが、線でつなぐと上昇・下降を追いやすくなります。ヒストグラムはどの気温帯の日が多いかを表し、日付順の変化は表しません。</p><h3>雨と日照の内訳を読む</h3><p>棒は同じ目盛りで日数や差を比較し、円は全体を100%として内訳を表します。区分同士に時間の順序はないため、折れ線の右上がりを時間的な増加とは読めません。並び順を変えて比べられます。</p><h3>2つの量の関係を読む</h3><p>散布図では、同じ日の日照時間と気温を1つの点で対応させます。日付順に点を結んだ線も表示できますが、その線は回帰直線ではなく、2つの量の関係を表すために必要なものでもありません。</p><h3>温度の差と降水量の比</h3><p>℃は間隔尺度です。0℃は量がないことを意味せず、20℃を10℃の2倍の温度とは読みません。気温の棒でも長さの比は解釈せず、値の高低や差を読みます。降水量は0mmを起点とした量の比を比較できるため、棒の長さと軸の下限を比べる補足には降水量を使います。</p><h3>初期データと3区分</h3><p>東京の2025年6〜7月の61日分です。日降水量1mm以上、1mm未満かつ日照6時間未満、1mm未満かつ日照6時間以上の3区分に分けます。どの日も1つの区分に入り、全日数が全体になります。</p><p>気象庁の「--」は降水なしとして0、「0.0」は公表値0.0mmとして集計します。「0.0」は0.5mm未満の降水を表します。</p>${sourceNote}`;
const titles=['気温の変化','雨と日照の内訳','日照と気温の関係'];
function plot(s,l,kind){
 if(l.id==='relation')return `<figure class="graph-subject-plot">${scatterChart(s.rows,['sun','日照時間','h',3],['temp','日平均気温','℃',2],{connect:kind==='line',focusDay:l.focusDay,selectedDay:s.selectedDay})}<figcaption>1点が1日。橙の点を選ぶと、同じ日の2つの値を確認できます。</figcaption></figure>`;
 if(kind==='pie')return `<figure class="graph-subject-plot">${pieChart(l.items,'全日数に占める雨と日照の3区分')}<figcaption>全${s.rows.length}日が100%。3区分は重複しません。</figcaption></figure>`;
 let items=l.items,unit=l.unit,min=0,contiguous=false,highlights=[];
 if(l.id==='trend'&&kind==='histogram'){
  const dist=lesson(s.rows,'distribution');items=dist.items;unit=dist.unit;contiguous=true;
 }else if(l.id==='trend'){
  const values=items.map(r=>r.value);min=kind==='bar'?Math.min(0,...values):Math.min(...values)-1;
  highlights=[values.indexOf(Math.min(...values)),values.indexOf(Math.max(...values))];
 }
 const caption=l.id==='trend'?(kind==='histogram'?'横軸は気温の区間（℃）、縦軸は日数。日付の順序は表しません。':'横軸は日付、縦軸は日平均気温。値の高低と差を読みます。'):'横軸は雨と日照の3区分。区分同士に時間の順序はありません。';
 return `<figure class="graph-subject-plot">${categoryChart(items,{min,baseline:l.id==='trend'&&kind==='bar'?0:null,line:kind==='line',contiguous,integerTicks:l.id!=='trend'||kind==='histogram',highlightIndices:highlights,unit,title:kind==='histogram'?'日平均気温の分布。日付順の変化は表しません。':l.title})}<figcaption>${caption}</figcaption></figure>`;
}
function render(root,{state:s,view,update}){
 root.classList.add('graph-reading-display');
 const task=view===0?'trend':view===1?s.rainQuestion:'relation',l=lesson(s.rows,task,s.orders[view]),kind=s.choices[view],allowed=supportedKinds(task),fit=suitability(task,kind);
 const set=(key,value)=>update({[key]:s[key].map((v,i)=>i===view?value:v)});
 const preferred=KINDS.find(k=>k[0]===l.recommended)[1];
 const disabled=KINDS.filter(k=>!allowed.includes(k[0])).map(([id,title])=>`${title}：${id==='pie'?'気温や2つの量は、全体の内訳ではありません':id==='scatter'?'この題材は対応する2つの数値を使いません':id==='histogram'?(task==='relation'?'2つの量の対応を表す図ではありません':'区分は連続した数値の階級ではありません'):'この題材の2つの値を対応させる図ではありません'}`);
 const answer=s.answers[view],answered=l.quiz.options.some(o=>o[0]===answer),correct=answered&&answer===l.quiz.correct;
 const selected=s.rows.find(r=>r[0]===s.selectedDay),point=task==='relation'?(selected?`${selected[0]}：日照${selected[3]}h、日平均気温${selected[2]}℃。`:'点をクリック、またはTabで選んでEnterを押すと数値を確認できます。'):'';
 const rain=rainAxisExample(s.rows);let axis='';
 if(view===1&&rain){const a=rain.items[0].value,b=rain.items[1].value;axis=`<details id="graph-axis" class="analysis-notes graph-values"><summary>補足：降水量と棒の長さ</summary><p>量の比を比較できる降水量2日分で、下限だけを変えます。</p><div class="foundation-controls">${number('graph-rain-base','縦軸の下限（mm）',s.axisBase,0,rain.limit,.1)}<button id="graph-rain-zero" type="button">0mmからに戻す</button></div><figure>${categoryChart(rain.items,{min:s.axisBase,unit:'日降水量（mm）',title:'降水量と棒の長さの比較'}).replace('<svg ', '<svg data-scroll-chart ')}</figure><p id="graph-rain-ratios">実際の量の比：${fmt(a/b,2)}倍。棒の長さの比：${fmt((a-s.axisBase)/(b-s.axisBase),2)}倍。</p></details>`;}
 root.innerHTML=`<header class="graph-subject-heading"><h2>${titles[view]}</h2><p>${esc(l.context)}</p></header><div class="graph-subject-controls">${view===1?`<div class="graph-task-switch" role="group" aria-label="内訳から読み取ること"><button type="button" data-rain-question="compare" aria-pressed="${task==='compare'}">日数の差を比べる</button><button type="button" data-rain-question="share" aria-pressed="${task==='share'}">全体の割合を見る</button></div>`:''}<div class="foundation-chart-choices" role="group" aria-label="グラフの種類">${KINDS.map(([id,title])=>`<button type="button" data-chart-kind="${id}" aria-pressed="${kind===id}" ${allowed.includes(id)?'':`disabled aria-describedby="graph-disabled-help"`}>${title}${id===l.recommended?'<small>おすすめ</small>':''}</button>`).join('')}${view===1?'<button id="graph-reorder" type="button">並び順を変える</button>':''}</div><p id="graph-disabled-help" class="graph-disabled-help">選べないグラフの理由は「解説」に記載しています。</p></div>${plot(s,l,kind)}<section class="graph-subject-reading" data-screen-nav-section="解説"><h3 id="graph-choice-title">${esc(fit.title)}</h3><p id="graph-choice-feedback" aria-live="polite">${esc(fit.text)}</p><p class="graph-point-reading" id="graph-point-reading">${esc(point)}</p><details id="graph-disabled-reasons"><summary>選べないグラフの理由</summary><ul>${disabled.map(text=>`<li>${esc(text)}</li>`).join('')}</ul></details></section><details id="graph-quiz" class="analysis-notes graph-quiz"><summary>読み取りを確かめる</summary><h3>${esc(l.quiz.prompt)}</h3><div class="graph-answer-choices" role="group" aria-label="読み取りの答え">${l.quiz.options.map(([id,label])=>`<button type="button" data-graph-answer="${esc(id)}" aria-pressed="${answer===id}">${esc(label)}</button>`).join('')}</div>${answered?`<p id="graph-answer-feedback" role="status"><strong>${correct?'正解です。':'値を確認しましょう。'}</strong> ${esc(l.quiz.reason)}</p>`:''}</details><details id="graph-values" class="analysis-notes graph-values"><summary>元の値を確認</summary>${table(task==='relation'?['日付','日照時間（h）','日平均気温（℃）']:task==='trend'?['日付','日平均気温（℃）']:['区分','日数（日）'],task==='relation'?s.rows.map(r=>[r[0],r[3],r[2]]):l.items.map(r=>[r.label,r.value]))}</details>${axis}`;
 root.querySelectorAll('[data-chart-kind]:not(:disabled)').forEach(el=>el.onclick=()=>set('choices',el.dataset.chartKind));
 root.querySelectorAll('[data-rain-question]').forEach(el=>el.onclick=()=>update({rainQuestion:el.dataset.rainQuestion,choices:s.choices.map((v,i)=>i===1?(el.dataset.rainQuestion==='share'?'pie':'bar'):v),answers:s.answers.map((v,i)=>i===1?'':v)}));
 root.querySelectorAll('[data-graph-answer]').forEach(el=>el.onclick=()=>set('answers',el.dataset.graphAnswer));
 root.querySelector('#graph-reorder')?.addEventListener('click',()=>set('orders',(s.orders[view]+1)%3));
 root.querySelector('#graph-rain-base')?.addEventListener('change',e=>{if(e.target.value!==''&&e.target.checkValidity())update({axisBase:Number(e.target.value)});});root.querySelector('#graph-rain-zero')?.addEventListener('click',()=>update({axisBase:0}));
 root.querySelectorAll('[data-lesson-point]').forEach(el=>{const choose=()=>update({selectedDay:el.dataset.lessonPoint});el.addEventListener('click',choose);el.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();choose();}});});
}
export default {id:'graph-reading',headers:['日付','日降水量（mm）','日平均気温（℃）','日照時間（h）'],dataTitle:'東京の日別気象データ（2025年6〜7月）',dataHint:'1行が1日です。気温の変化、雨と日照の内訳、日照と気温の関係を、それぞれ別のグラフで比べます。',maxRows:90,views:[{title:'気温の変化',purpose:'日付順の変化と、分布や棒での見え方を比べる。'},{title:'雨と日照の内訳',purpose:'同じ区分を棒・折れ線・円で表し、差や割合を読み分ける。'},{title:'日照と気温',purpose:'対応する2つの量を、点だけの場合と線を結んだ場合で比べる。'}],initial:()=>normalize({rows:sampleRows(),origin:'sample'}),normalize,validateRows,render,explanation};

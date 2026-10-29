import {esc,table} from '../shared/ui.mjs?v=20261026-final-upgrade';
import {fmt} from '../shared/math.mjs?v=20261026-final-upgrade';
import {METHODS,scenario,validateRows,processMissing,normalize} from './model.mjs?v=20261026-final-upgrade';
import {missingValuesChart} from './charts.mjs?v=20261026-final-upgrade';
import {sourceNote} from '../foundations/weather-data.mjs?v=20261026-final-upgrade';
const f=v=>v===null?'—':fmt(v,2);
const explanation=`<h3>データを決めてから比べる</h3><p>欠損の位置と観測値はデータタブで決めます。分析では同じデータに対して補完方法を変え、平均・分散・日ごとの値を比べます。0mmは観測値、空欄は分からない値です。</p><h3>一定の値で補完する</h3><p>0、観測値の平均、観測値の中央値で補完できます。平均補完は有効な値だけの平均を保ちますが、平均と同じ値が増えるため分散は小さくなります。中央値は大きな値の影響を受けにくく、平均とは異なる補完値になります。分散の分母は集計した件数nです。</p><h3>前後の観測を使う</h3><p>直前の値による補完は、表の順に最後の観測値を引き継ぎます。線形補間は前後の観測値を日付に沿って直線でつなぎます。日降水量のように急変する量では、雨のピークを再現できない場合があります。先頭の欠損は直前の値がなく、線形補間では両端の欠損に前後の値がないため、そのまま残します。</p><h3>標準データの出典と加工</h3><p>東京の2025年6月の日降水量30日分のうち、6日分を教材上で隠しています。公表データの実際の欠測を表すものではありません。実データの例では、隠す前の値を日別の表で確認できます。自分のCSV・Excelを読み込んだ場合は、観測値と補完後の値を比較します。</p><p>気象庁の「--」は降水なしとして0mm、「0.0」は公表値0.0mmとして集計します。「0.0」は0.5mm未満の降水を表します。</p>${sourceNote}`;
function methodTable(s){
 return `<div class="table-scroll missing-method-table"><table class="stat-table"><caption>方法を選ぶと、下のグラフに反映されます。</caption><thead><tr><th scope="col">方法</th><th scope="col">集計日数</th><th scope="col">平均（mm）</th><th scope="col">分散（mm²）</th><th scope="col">残る欠損</th></tr></thead><tbody>${METHODS.map(([id,label])=>{const r=processMissing(s.rows,id);return `<tr data-select-method="${id}" class="${s.method===id?'is-selected':''}"><th scope="row"><button type="button" id="missing-method-${id}" data-missing-method="${id}" aria-pressed="${s.method===id}">${label}</button></th><td>${r.n}日</td><td>${f(r.mean)}</td><td>${f(r.variance)}</td><td>${r.remaining}日</td></tr>`;}).join('')}</tbody></table></div>`;
}
const notes={
 drop:{merit:'観測された値を変更せずに集計できます。',demerit:'欠損した日を除くため、集計する日数が減ります。雨の多い日ばかり欠けると、平均を低く見積もります。'},
 zero:{merit:'合計を変えずに、全日数で集計できます。',demerit:'分からない日をすべて0mmとして扱います。平均は0に近づき、分散は値の分布によって増減します。'},
 mean:{merit:'観測値だけの平均を保ったまま、欠損を埋められます。',demerit:'補完した値が全て平均に集まり、分散は観測値だけで求めた値以下になります。欠けた日の大雨のピークは再現できません。'},
 median:{merit:'大きく外れた値の影響を受けにくい中央値で補完できます。',demerit:'同じ中央値が増え、平均は中央値に近づきます。分散も変わり、元の分布の形は保てません。'},
 previous:{merit:'直前の状態が続くデータでは、観測の順序を使って補完できます。',demerit:'次の観測まで同じ値が続くため、降水量の急な増減を追えません。先頭から続く欠損は残ります。'},
 linear:{merit:'前後の観測値と日付の間隔を使い、滑らかな変化を補えます。',demerit:'前後の値を直線でつなぐため、途中のピークや谷は再現できません。前後の観測で挟めない欠損は残ります。'},
};
function changeText(before,after){
 if(before===null||after===null)return '比較できません';
 const delta=after-before,tolerance=1e-10*Math.max(1,Math.abs(before),Math.abs(after));
 if(Math.abs(delta)<=tolerance)return '変化なし';
 const amount=Math.abs(delta)<.005?Number(Math.abs(delta).toPrecision(2)).toString():f(Math.abs(delta));
 return `${amount}${delta>0?'増加':'減少'}`;
}
function methodImpact(result,method){
 if(!result.missing)return '欠損がないため、どの方法でも観測値と集計結果は変わりません。';
 if(method==='drop')return result.n?`欠損${result.missing}日を除いた${result.n}日分で計算します。観測された値は変更しません。`:`欠損${result.missing}日を除くと、集計できる値が残りません。`;
 if(!result.imputed)return `この方法では補完できず、${result.remaining}日の欠損が残ります。`;
 if(['zero','mean','median'].includes(method)){
  return `${result.imputed}日を同じ値で補完し、${result.n}日分で計算します。`;
 }
 return `${result.imputed}日を補完し、${result.remaining}日の欠損が残ります。`;
}
const legend='<div class="legend missing-legend"><span><i class="missing-key-observed"></i>観測値（0は丸）</span><span><i class="missing-key-imputed"></i>補完値（0はひし形）</span><span>破線と「欠」：残る欠損</span></div>';
function render(root,{state:s,update}){
 root.classList.add('missing-values-display');
 const result=processMissing(s.rows,s.method),selected=METHODS.find(([id])=>id===s.method),note=notes[s.method],base=result.observed;
 const equation=result.n?`平均 = ${f(result.sum)} ÷ ${result.n} = ${f(result.mean)}mm`:'集計できる値がないため、平均・分散は求められません。';
 const constant=result.imputed&&['zero','mean','median'].includes(s.method)?result.filled[s.rows.findIndex(r=>r[1]===null)]:null;
 root.innerHTML=`<header class="missing-subject-heading"><h2>補完方法で、平均・分散はどう変わる？</h2><p>${s.rows.length}日分・欠損${result.missing}日</p></header>${methodTable(s)}<figure class="missing-primary-plot">${missingValuesChart(s.rows,result.filled,{compact:!!root.closest('.statistics-fullscreen')})}<figcaption>${selected[1]}：${result.imputed}日を補完、${result.remaining}日の欠損が残ります。</figcaption></figure><section class="missing-reading" data-screen-nav-section="選択した方法"><h3 id="missing-selected-method">${selected[1]}</h3><p>${selected[2]}</p>${result.reason?`<p id="missing-method-reason" role="status">${esc(result.reason)}</p>`:''}<dl class="missing-method-notes"><div><dt>メリット</dt><dd id="missing-method-merit">${note.merit}</dd></div><div><dt>デメリット</dt><dd id="missing-method-demerit">${note.demerit}</dd></div></dl><h4>今回の変化</h4><p class="missing-comparison-base">観測値だけの集計 → 選んだ方法</p><dl class="missing-method-impact"><div><dt>平均（mm）</dt><dd id="missing-mean-change">${f(base.mean)} → ${f(result.mean)}<span>${changeText(base.mean,result.mean)}</span></dd></div><div><dt>分散（mm²）</dt><dd id="missing-variance-change">${f(base.variance)} → ${f(result.variance)}<span>${changeText(base.variance,result.variance)}</span></dd></div><div><dt>集計日数</dt><dd>${base.n}日 → ${result.n}日</dd></div></dl><p id="missing-method-impact">${methodImpact(result,s.method)}${constant===null?'':`補完値は${f(constant)}mmです。`}</p><p id="missing-equation" aria-live="polite">${equation}</p></section>${legend}<details id="missing-daily-values" class="analysis-notes missing-details"><summary>日ごとの値を確認</summary><div>${table(['日付・観測名','観測値（mm）','集計に使う値（mm）',...(s.truth?['隠す前（mm）']:[])],s.rows.map((r,i)=>[r[0],r[1]===null?'欠損':f(r[1]),result.filled[i]===null?'欠損':f(result.filled[i]),...(s.truth?[f(s.truth[i])]:[])]))}</div></details>`;
 const choose=method=>update({method});
 root.querySelectorAll('[data-missing-method]').forEach(el=>el.onclick=()=>choose(el.dataset.missingMethod));
 root.querySelectorAll('[data-select-method]').forEach(el=>el.onclick=e=>{if(!e.target.closest('button'))choose(el.dataset.selectMethod);});
}
export default {id:'missing-values',headers:['日付・観測名','降水量（mm）'],dataTitle:'東京の日降水量（2025年6月）',dataHint:'標準データでは実測値の6日分を隠しています。自分のデータでは、空欄・NAは欠損値、0は観測値です。',maxRows:90,views:[{title:'集計方法を比べる',purpose:'同じ欠損データで、補完方法による平均・分散の違いを比べる。'}],initial:()=>normalize({...scenario(),method:'drop'}),normalize,validateRows,render,explanation};

import { chartKey, esc, number, svg, axes, table } from '../shared/ui.mjs?v=20261025-basic-test';
import { fmt } from '../shared/math.mjs';
import { academicExplanation } from '../shared/reading.mjs?v=20261025-basic-test';
import { exactTest, testPerformance, distributionBins } from './model.mjs?v=20261025-basic-test';
import { downloadCSV } from '../data-editor.mjs?v=20261025-basic-test';
const pct = (v, digits = 1) => (v > 0 && v < .001 ? (v * 100).toPrecision(2) : fmt(v * 100, digits)) + '%';
const pText = test => test.pValue === 0 && test.logP !== -Infinity ? '0.0001未満' : test.pValue > 0 && test.pValue < .0001 ? '0.0001未満' : fmt(test.pValue, 4);
const radio = (id, label, choices, value) => `<fieldset class="hyp-radio"><legend>${label}</legend>${choices.map(([v,l])=>`<label><input type="radio" name="${id}" value="${v}" ${Number(v)===value?'checked':''}>${l}</label>`).join('')}</fieldset>`;
function rangeText(mask) {
  const groups=[];
  for(let k=0;k<mask.length;k++) if(mask[k]) { const start=k; while(k+1<mask.length&&mask[k+1])k++;groups.push(start===k?`${fmt(k,0)}個`:`${fmt(start,0)}〜${fmt(k,0)}個`); }
  return groups.join('、') || '該当する個数なし';
}
function axisLabels(a, lo, hi) {
  // Counts are integers, including at the displayed endpoints.
  const ticks=[...new Set(Array.from({length:6},(_,i)=>Math.round(lo+(hi-lo)*i/5)))];
  return a.markup.replace(/<text x="[^"]+" y="331" text-anchor="middle">[^<]*<\/text>/g,'') + ticks.map(k=>`<text x="${a.x(k)}" y="331" text-anchor="middle">${fmt(k,0)}</text>`).join('');
}
function distributionChart(test, label, alternative = null) {
  const data = distributionBins(test, [test.tail || test.rejection, test.rejection], alternative ? null : test.k, alternative);
  const ymax = Math.max(...data.bins.flatMap(b=>[b.mass,b.alternative]),.001) * 120;
  const a = axes({xmin:data.lo-.5,xmax:data.hi+.5,ymin:0,ymax,xlabel:`${label}の個数`,ylabel:`${data.width===1?'その個数':'その範囲'}になる確率（%）`,w:760,h:360});
  const bars=data.bins.map(b=>{
    const x=a.x(b.lo-.5)+.5,w=Math.max(.5,a.x(b.hi+.5)-a.x(b.lo-.5)-1),tail=b.selected[0];
    const title=`${b.lo===b.hi?fmt(b.lo,0):fmt(b.lo,0)+'〜'+fmt(b.hi,0)}個：${pct(b.mass)}`;
    return `<g><title>${title}</title><rect x="${x}" y="${a.y(b.mass*100)}" width="${w}" height="${a.y(0)-a.y(b.mass*100)}" fill="var(--chart-primary)"/>${!alternative&&tail>0?`<rect x="${x}" y="${a.y(tail*100)}" width="${w}" height="${a.y(0)-a.y(tail*100)}" fill="url(#hyp-tail-pattern)"/>`:''}</g>`;
  }).join('');
  let critical='';
  for(let k=data.lo;k<=data.hi;k++) if(test.rejection[k]) {
    const start=k;while(k<data.hi&&test.rejection[k+1])k++;
    critical+=`<rect x="${a.x(start-.5)}" y="${a.y(0)-4}" width="${a.x(k+.5)-a.x(start-.5)}" height="4" fill="var(--chart-purple)"/>`;
  }
  const alt=alternative?`<polyline points="${data.bins.map(b=>`${a.x((b.lo+b.hi)/2)},${a.y(b.alternative*100)}`).join(' ')}" fill="none" stroke="var(--chart-secondary-dark)" stroke-width="2.5" stroke-dasharray="6 3"/>`:'';
  const mark=(x,text,color,dash)=>`<line x1="${a.x(x)}" x2="${a.x(x)}" y1="30" y2="312" stroke="${color}" stroke-width="2" stroke-dasharray="${dash}"/><text x="${a.x(x)}" y="${text.startsWith('今回')?51:25}" text-anchor="${x>(data.lo+data.hi)/2?'end':'start'}" fill="${color}">${text}</text>`;
  const defs='<defs><pattern id="hyp-tail-pattern" width="7" height="7" patternUnits="userSpaceOnUse"><rect width="7" height="7" fill="var(--chart-secondary)"/><path d="M-1 1L1-1M0 7L7 0M6 8L8 6" stroke="white" stroke-width="1" opacity=".55"/></pattern></defs>';
  const content=defs+axisLabels(a,data.lo,data.hi)+bars+critical+alt+mark(test.center,`基準なら平均 ${fmt(test.center,2)}個`,'var(--chart-neutral)','3 4')+(!alternative?mark(test.k,`今回 ${fmt(test.k,0)}個`,'var(--chart-secondary-dark)','6 3'):'');
  return `${svg(content,alternative?'基準の割合と、実際に異なる割合の分布。紫の帯は基準を棄却する個数。':'基準の割合を仮定した個数の分布。橙の斜線は今回以上に基準から離れる個数、紫の帯は棄却する個数。',760,360)}<div class="legend">${chartKey('基準の割合での分布','var(--chart-primary)','bar')}${chartKey(alternative?'本当の割合での分布':'今回以上のずれ', 'var(--chart-secondary)',alternative?'line-dashed':'stripe')}${test.rejection.some(Boolean)?chartKey('棄却する個数','var(--chart-purple)','bar'):''}</div>${data.lo>0||data.hi<test.n?'<p class="hint">図は分布と注目する個数に合わせて横軸を拡大しています。確率の計算には表示外も含めた全個数を使います。</p>':''}${data.width>1?`<p class="hint">棒1本は最大${data.width}個分の範囲です。${alternative?"破線も同じ範囲の確率を示します。":"橙の高さは、その範囲のうち今回以上にずれる結果の確率だけを表します。"}</p>`:''}`;
}
function controls(s, extra='') { return `<div class="hyp-controls">${extra}${number('null-rate','事前に決める基準の割合（%）',Math.round(s.p0*100000)/1000,0,100,'any')}${radio('hyp-alpha','有意水準（判断の基準）',[[.01,'1%'],[.05,'5%'],[.1,'10%']],s.alpha)}</div><p class="hint">基準の割合や有意水準は、結果を見る前に決めます。操作による比較では観測された個数を変更しません。</p>`; }
function wire(root,ctx){
 root.querySelector('#null-rate')?.addEventListener('change',e=>{if(e.target.value!==''&&e.target.checkValidity())ctx.update({p0:Number(e.target.value)/100});});
 root.querySelectorAll('[name="hyp-alpha"]').forEach(el=>el.addEventListener('change',()=>ctx.update({alpha:Number(el.value)})));
 for(const [id,key,scale] of [['plan-n','planN',1],['true-rate','trueP',100]]) root.querySelector('#'+id)?.addEventListener('change',e=>{if(e.target.value!==''&&e.target.checkValidity())ctx.update({[key]:Number(e.target.value)/scale});});
}
export default {
 id:'hypothesis-test',title:'統計的な判断と仮説検定',
 description:'予想した割合と観測結果のずれを、偶然のばらつきと比べる。',
 initial:()=>({n:7324,success:5474,label:'丸い種子',p0:.75,alpha:.05,planN:40,trueP:.65}),
 related:['sampling','crosstab'],explanation:academicExplanation('hypothesis-test'),
 renderDataExtras(root){
  let old;try{old=JSON.parse(localStorage.getItem('study-atlas-statistics-hypothesis-test-v1'));}catch{}
  if(old?.state?.dataInfo?.origin!=='user')return;
  const s=old.state;if(![s.nA,s.nB,s.successA,s.successB].every(Number.isFinite))return;
  const box=document.createElement('details');box.className='panel';box.innerHTML='<summary>以前の2群の保存データ</summary><p>以前読み込んだデータはCSVで取り出せます。現在の1つの割合の検定には混ぜません。</p><button id="hyp-old-csv" type="button">以前のデータをCSVで保存</button>';
  root.append(box);box.querySelector('button').onclick=()=>downloadCSV('以前の2群データ.csv',s.dataInfo.columns||['群','総数','該当数'],[[s.groupLabels?.[0]||'A',s.nA,s.successA],[s.groupLabels?.[1]||'B',s.nB,s.successB]]);
 },
 render(root,ctx){
  const s=ctx.state,test=exactTest(s.n,s.success,s.p0,s.alpha),label=esc(s.label);
  if((ctx.view||0)===0){
   root.innerHTML=`<section class="panel chart-panel hyp-test"><h2>予想した割合と、今回の結果を比べる</h2>${controls(s)}<section class="hyp-question" data-screen-nav-section="仮説と観測結果"><h3>何を調べる？</h3><p>${label}になる割合は、基準の<strong>${pct(s.p0)}</strong>と違うといえるでしょうか。</p><p><strong>帰無仮説：</strong>その割合は${pct(s.p0)}である。<br><strong>対立仮説：</strong>その割合は${pct(s.p0)}と異なる（多い側・少ない側の両方を調べる）。</p><p id="hyp-observed">観測結果：${fmt(s.n,0)}個中${fmt(s.success,0)}個が${label}（${pct(s.success/s.n)}）。基準との差は${fmt((s.success/s.n-s.p0)*100,2)}ポイントです。</p></section>${distributionChart(test,s.label)}<section class="hyp-decision" data-screen-nav-section="p値と判断"><h3>今回以上のずれは、どれくらい起こる？</h3><p>基準が正しいと仮定し、平均${fmt(test.center,2)}個から今回と同じか、それ以上に離れる結果の確率を合計します。</p><p class="hyp-p-value">両側p値：<strong id="hyp-p-value" data-p-value="${test.pValue}">${pText(test)}</strong>（${test.logP!==-Infinity&&test.logP<Math.log(.0001)?'0.01%未満':pct(test.pValue,2)}）</p><p id="hyp-decision" class="annotation">${test.reject?`p値が有意水準${pct(s.alpha)}以下なので、帰無仮説を棄却します。基準の割合からのずれを示す結果です。`:`p値が有意水準${pct(s.alpha)}を上回るので、帰無仮説を棄却しません。この結果だけでは、基準の割合と違うとはいえません。`}</p><p class="hint">${test.reject?'どの程度のずれがあり、何が原因かは別に考える必要があります。':'基準が正しいと証明されたわけではありません。調べる個数が少なければ、違いを見逃すこともあります。'} p値は「帰無仮説が正しい確率」ではありません。</p></section><details class="hyp-details" data-screen-nav-section="計算と棄却域"><summary>計算と、棄却する個数を確かめる</summary><p>帰無仮説のもとで X は二項分布 B(${fmt(s.n,0)}, ${s.p0}) に従うと仮定します。両側p値は P(|X − ${fmt(test.center,2)}| ≥ ${fmt(Math.abs(s.success-test.center),2)}) です。離れ具合を個数の差の絶対値で測る方法に統一しています。</p><p>今回以上のずれ：${rangeText(test.tail)}。有意水準${pct(s.alpha)}で棄却する個数：${rangeText(test.rejection)}。</p><p>各個数の確率を合計して計算しています。乱数による近似ではないため、同じデータと条件なら同じp値になります。離散分布なので、棄却される確率は有意水準ちょうどとは限りません。</p></details></section>`;
  }else{
   const perf=testPerformance(s.planN,s.p0,s.trueP,s.alpha);
   root.innerHTML=`<section class="panel chart-panel hyp-errors"><h2>基準が正しいときも、判断を誤ることがある</h2><p>ここからは、これから${fmt(s.planN,0)}個を調べる調査計画の比較です。データタブの実測値は変更しません。種子ごとに同じ割合で独立に結果が決まる確率モデルを使います。</p>${controls(s,number('plan-n','これから調べる個数',s.planN,1,1000,1)+number('true-rate','比較する本当の割合（%）',Math.round(s.trueP*100000)/1000,0,100,'any'))}${distributionChart({...perf,tail:perf.rejection},s.label,perf.alternative)}<section data-screen-nav-section="判断の誤り"><h3>同じ判断基準を繰り返し使うと</h3>${table(['本当の割合','棄却する確率','棄却しない確率'],[[`基準と同じ ${pct(s.p0)}`,`${pct(perf.falsePositive)}（第1種の誤り）`,pct(1-perf.falsePositive)],[`比較する割合 ${pct(s.trueP)}`,perf.hasAlternative?`${pct(perf.detected)}（検出力）`:`${pct(perf.detected)}（第1種の誤り）`,perf.hasAlternative?`${pct(perf.missed)}（第2種の誤り）`:pct(perf.missed)]])}<p class="annotation">基準が正しいのに棄却する確率は${pct(perf.falsePositive)}です。有意水準${pct(s.alpha)}以下になるように、${perf.rejection.some(Boolean)?"紫の棄却域を決めています。":"この条件では棄却する個数がありません。"}</p><p>${perf.hasAlternative?`本当の割合が${pct(s.trueP)}なら、${pct(perf.detected)}の確率で違いを検出し、${pct(perf.missed)}の確率で見逃します。`:'本当の割合が基準と同じなので、この比較には違いがありません。検出力・第2種の誤りとしては表示しません。'} 調べる個数と有意水準を変え、判断の変化を確かめましょう。</p></section><details class="hyp-details" data-screen-nav-section="仮定と計算"><summary>計算の前提を確かめる</summary><p>棄却する個数は基準の割合だけで決め、比較する本当の割合では決め直しません。その同じ棄却域に入る確率を、それぞれの二項分布で合計します。これは調査を繰り返した場合の理論上の確率で、今回の仮説が間違っている確率ではありません。</p><p>各結果が独立で、同じ割合に従うことを仮定します。選び方の偏りや観測誤りを、標本数だけで解消することはできません。</p></details></section>`;
  }
  wire(root,ctx);
 }
};

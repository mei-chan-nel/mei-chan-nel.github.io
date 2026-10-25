import { chartKey, esc, number, svg, table, groupPattern } from '../shared/ui.mjs?v=20261025-ai-faces';
import { fmt } from '../shared/math.mjs';
import { academicExplanation } from '../shared/reading.mjs?v=20261025-ai-faces';
import { participantScores, meanTest, meanTestPower, studentDensity, noncentralDensity } from './mean-model.mjs?v=20261025-ai-faces';
import { aiFaceParticipants } from './data.mjs?v=20261025-ai-faces';
import { downloadCSV } from '../data-editor.mjs?v=20261025-ai-faces';
const pct = (v, d=1) => fmt(v * 100, d) + '%';
const pText = value => value < .000001 ? '0.000001未満' : fmt(value, 6);
const radio = s => `<fieldset class="hyp-radio"><legend>有意水準（事前に決める判断基準）</legend>${[.01,.05,.1].map(v=>`<label><input type="radio" name="hyp-alpha" value="${v}" ${s.alpha===v?'checked':''}>${pct(v,0)}</label>`).join('')}</fieldset>`;
function niceStep(value) {
  const power=10**Math.floor(Math.log10(value || 1)), scaled=value/power;
  return (scaled<=1?1:scaled<=2?2:scaled<=5?5:10)*power;
}
function ticks(lo,hi) {
  const step=niceStep((hi-lo)/5), start=Math.ceil(lo/step)*step;
  return Array.from({length:Math.max(1,Math.floor((hi-start)/step+1e-9)+1)},(_,i)=>Math.abs(start+i*step)<step*1e-8?0:start+i*step);
}
function plotAxes(lo,hi,rawMax,xlabel,ylabel,height=330) {
  const top=34,bottom=height-50,left=62,right=736,step=niceStep(rawMax/4), ymax=Math.ceil(rawMax/step)*step;
  const x=v=>left+(v-lo)/(hi-lo)*(right-left),y=v=>bottom-v/ymax*(bottom-top);
  const value=v=>fmt(v,Math.abs(v)>=1?0:2);
  let markup='';
  for(let i=0;i<=Math.round(ymax/step);i++) {
    const v=i*step;
    markup+=`<line class="gridline" x1="${left}" x2="${right}" y1="${y(v)}" y2="${y(v)}"/><text x="${left-9}" y="${y(v)+4}" text-anchor="end">${value(v)}</text>`;
  }
  for(const v of ticks(lo,hi))markup+=`<text x="${x(v)}" y="${bottom+20}" text-anchor="middle">${fmt(v,Math.abs(v)<1&&v!==0?2:0)}</text>`;
  markup+=`<path class="axis" d="M${left},${top}V${bottom}H${right}"/><text x="${(left+right)/2}" y="${height-6}" text-anchor="middle">${esc(xlabel)}</text><text x="${left}" y="17">${esc(ylabel)}</text>`;
  return {lo,hi,x,y,top,bottom,markup};
}
const polyline = (points, color, dash='') => `<polyline points="${points.map(p=>p.join(',')).join(' ')}" fill="none" stroke="${color}" stroke-width="2.5" ${dash?`stroke-dasharray="${dash}"`:''}/>`;
function area(a,fn,lo,hi,fill,opacity=1) {
  lo=Math.max(a.lo,lo);hi=Math.min(a.hi,hi);if(hi<=lo)return '';
  const values=Array.from({length:121},(_,i)=>lo+(hi-lo)*i/120);
  return `<polygon points="${a.x(lo)},${a.y(0)} ${values.map(t=>`${a.x(t)},${a.y(fn(t))}`).join(' ')} ${a.x(hi)},${a.y(0)}" fill="${fill}" opacity="${opacity}"/>`;
}
function vertical(a,value,color,dash='') {
  return `<line x1="${a.x(value)}" x2="${a.x(value)}" y1="${a.top}" y2="${a.bottom}" stroke="${color}" stroke-width="2" ${dash?`stroke-dasharray="${dash}"`:''}/>`;
}
function scoreHistogram(scores,test) {
  const counts=Array(20).fill(0);for(const v of scores)counts[Math.min(19,Math.floor(v*20))]++;
  const a=plotAxes(0,100,Math.max(...counts,1)*1.12,'1人ごとの正答率（%）','参加者数（人）',300);
  const bars=counts.map((count,i)=>`<g><title>${i*5}%以上${(i+1)*5}%${i===19?'以下':'未満'}：${count}人</title><rect data-hyp-bin-count="${count}" x="${a.x(i*5)+1}" y="${a.y(count)}" width="${a.x(5)-a.x(0)-2}" height="${a.y(0)-a.y(count)}" fill="var(--chart-primary)"/></g>`).join('');
  return svg(a.markup+bars+vertical(a,50,'var(--chart-neutral)','4 4')+vertical(a,test.mean*100,'var(--chart-secondary-dark)'), '参加者ごとの正答率の分布。棒の高さは人数、灰の破線は50%、橙の実線は今回の平均。',760,300)+`<div class="legend">${chartKey('参加者の正答率','var(--chart-primary)','bar')}${chartKey('基準50%','var(--chart-neutral)','line-dashed')}${chartKey(`今回の平均 ${pct(test.mean,2)}`,'var(--chart-secondary-dark)','line')}</div>`;
}
function testChart(test) {
  const span=Math.max(5,Math.min(8,Math.ceil(Math.abs(test.t)*1.18)),Math.ceil(test.critical*1.3));
  const offscreen=Math.abs(test.t)>span;
  const density=t=>studentDensity(t,test.df),a=plotAxes(-span,span,density(0)*1.18,'基準50%からのずれ ÷ 標準誤差（t）','帰無仮説のもとでの確率密度');
  const points=Array.from({length:401},(_,i)=>{const t=-span+2*span*i/400;return[a.x(t),a.y(density(t))];});
  let content=groupPattern('hyp-tail-pattern')+a.markup+area(a,density,-span,span,'var(--chart-primary)',.12);
  for(const side of [-1,1]) {
    const lo=side<0?-span:Math.abs(test.t),hi=side<0?-Math.abs(test.t):span;
    content+=area(a,density,lo,hi,'url(#hyp-tail-pattern)');
    const begin=side<0?-span:test.critical,end=side<0?-test.critical:span;
    if(end>begin)content+=`<rect x="${a.x(begin)}" y="${a.bottom-4}" width="${a.x(end)-a.x(begin)}" height="4" fill="var(--chart-purple)"/>`;
    if(!offscreen)content+=vertical(a,side*Math.abs(test.t),'var(--chart-secondary-dark)','6 3');
  }
  content+=polyline(points,'var(--chart-primary)')+vertical(a,0,'var(--chart-neutral)','3 4');
  content+=`<text x="${a.x(Math.max(-span,Math.min(span,test.t)))+(test.t<=0?7:-7)}" y="55" text-anchor="${test.t<=0?'start':'end'}" style="fill:var(--chart-secondary-dark)">${offscreen&&test.t<0?"← ":""}今回 t=${fmt(test.t,2)}${offscreen?(test.t>0?" →（範囲外）":"（範囲外）"):""}</text>`;
  return svg(content,'平均正答率が50%という帰無仮説のもとでのt分布。橙の斜線の両側の面積がp値。紫の帯は棄却する範囲。',760,330)+`<div class="legend">${chartKey('50%を仮定した分布','var(--chart-primary)','line')}${chartKey(offscreen?'今回以上のずれ（図の外側）':'今回以上のずれ（両側）','var(--chart-secondary)','stripe')}${chartKey('棄却する範囲','var(--chart-purple)','bar')}</div><p class="hint">${offscreen?"今回のずれと、それ以上に離れた橙の領域は表示範囲の外側です。":"左右両側の橙の面積を合計してp値を求めます。"} p値は図の外側まで含めて計算しています。</p>`;
}
function intervalChart(test) {
  const [lower,upper]=test.interval, pad=Math.max((upper-lower)*.25,.005), lo=Math.min(lower,.5)-pad,hi=Math.max(upper,.5)+pad;
  const x=v=>62+(v-lo)/(hi-lo)*674;
  let content=`<line x1="${x(.5)}" x2="${x(.5)}" y1="27" y2="99" stroke="var(--chart-neutral)" stroke-width="2" stroke-dasharray="4 4"/><text x="${x(.5)}" y="17" text-anchor="middle">基準50%</text><line x1="${x(lower)}" x2="${x(upper)}" y1="67" y2="67" stroke="var(--chart-purple)" stroke-width="4"/>`;
  for(const v of [lower,upper])content+=`<line x1="${x(v)}" x2="${x(v)}" y1="59" y2="75" stroke="var(--chart-purple)" stroke-width="2"/>`;
  content+=`<circle cx="${x(test.mean)}" cy="67" r="5" fill="var(--chart-secondary-dark)"/><text x="${x(test.mean)}" y="47" text-anchor="middle">平均 ${pct(test.mean,2)}</text>`;
  for(const v of ticks(lo*100,hi*100))content+=`<text x="${x(v/100)}" y="116" text-anchor="middle">${fmt(v,Math.abs(hi-lo)<.04?1:0)}</text>`;
  content+='<text x="399" y="144" text-anchor="middle">参加者の平均正答率（%）・区間の周辺を拡大</text>';
  return svg(content,`${pct(1-test.alpha,0)}信頼区間は${pct(lower,2)}から${pct(upper,2)}。基準50%との位置関係を示す。`,760,150).replace('class="stat-chart"','class="stat-chart hyp-interval-chart"');
}
function planningChart(plan) {
  const spread=Math.max(6,Math.abs(plan.delta)*Math.sqrt(2/plan.df)*4);
  const lo=Math.floor(Math.min(-5,plan.delta-spread)),hi=Math.ceil(Math.max(5,plan.delta+spread));
  const nullDensity=t=>studentDensity(t,plan.df),altDensity=t=>noncentralDensity(t,plan.df,plan.delta);
  const ts=Array.from({length:361},(_,i)=>lo+(hi-lo)*i/360),alt=ts.map(altDensity);
  const a=plotAxes(lo,hi,Math.max(nullDensity(0),...alt)*1.2,'基準50%からのずれ ÷ 標準誤差（t）','同じ判断基準を使ったときの確率密度');
  let content=groupPattern('hyp-missed-pattern')+a.markup+area(a,nullDensity,lo,hi,'var(--chart-primary)',.1);
  if(plan.hasAlternative)content+=area(a,altDensity,-plan.critical,plan.critical,'url(#hyp-missed-pattern)',.8);
  content+=polyline(ts.map(t=>[a.x(t),a.y(nullDensity(t))]),'var(--chart-primary)');
  if(plan.hasAlternative)content+=polyline(ts.map((t,i)=>[a.x(t),a.y(alt[i])]),'var(--chart-secondary-dark)','6 3');
  for(const side of [-1,1]) {
    const start=side<0?lo:plan.critical,end=side<0?-plan.critical:hi;
    content+=`<rect x="${a.x(start)}" y="${a.bottom-4}" width="${a.x(end)-a.x(start)}" height="4" fill="var(--chart-purple)"/>`+vertical(a,side*plan.critical,'var(--chart-purple)','3 4');
  }
  return svg(content,'平均が50%の場合と異なる場合の分布。同じ紫の棄却域を使い、中央の橙の斜線が違いを見逃す確率を示す。',760,330)+`<div class="legend">${chartKey('平均が50%の場合','var(--chart-primary)','line')}${plan.hasAlternative?chartKey(`平均が${pct(plan.trueMean,2)}の場合`,'var(--chart-secondary-dark)','line-dashed')+chartKey('違いを見逃す範囲','var(--chart-secondary)','stripe'):''}${chartKey('棄却する範囲','var(--chart-purple)','bar')}</div>`;
}
function wire(root,ctx) {
  root.querySelectorAll('[name="hyp-alpha"]').forEach(el=>el.addEventListener('change',()=>ctx.update({alpha:Number(el.value)})));
  for(const [id,key,scale] of [['plan-n','planN',1],['true-rate','trueMean',100]])root.querySelector('#'+id)?.addEventListener('change',e=>{
    if(e.target.value!==''&&e.target.checkValidity())ctx.update({[key]:Number(e.target.value)/scale});
  });
  root.querySelector('#hyp-use-observed-mean')?.addEventListener('click',()=>ctx.update({trueMean:meanTest(participantScores(ctx.state.participants)).mean}));
}
export default {
  id:'hypothesis-test',title:'統計的な判断と仮説検定',
  description:'AI生成の顔写真を見分ける実験で、平均正答率と50%との差を調べる。',
  initial:()=>({participants:aiFaceParticipants(),alpha:.05,planN:315,trueMean:.48152281746031744}),
  related:['sampling','crosstab'],explanation:academicExplanation('hypothesis-test'),
  renderDataExtras(root) {
    for(const version of ['v1','v2']) {
      let old;try{old=JSON.parse(localStorage.getItem(`study-atlas-statistics-hypothesis-test-${version}`));}catch{}
      if(old?.state?.dataInfo?.origin!=='user')continue;
      const s=old.state,isTwo=version==='v1';
      if(!(isTwo?[s.nA,s.nB,s.successA,s.successB]:[s.n,s.success]).every(Number.isFinite))continue;
      const box=document.createElement('details'),id=isTwo?'hyp-old-csv':'hyp-previous-count-csv';
      box.className='panel';box.innerHTML=`<summary>以前の${isTwo?'2群':'個数集計'}の保存データ</summary><p>以前読み込んだデータはCSVで取り出せます。現在の参加者ごとの正答率には読み替えません。</p><button id="${id}" type="button">以前のデータをCSVで保存</button>`;
      root.append(box);box.querySelector('button').onclick=()=>downloadCSV(`以前の${isTwo?'2群':'個数集計'}データ.csv`,s.dataInfo.columns||['対象','総数','該当数'],isTwo?[[s.groupLabels?.[0]||'A',s.nA,s.successA],[s.groupLabels?.[1]||'B',s.nB,s.successB]]:[[s.label||'対象',s.n,s.success]]);
    }
  },
  render(root,ctx) {
    const s=ctx.state,scores=participantScores(s.participants),test=meanTest(scores,.5,s.alpha);
    if((ctx.view||0)===0) {
      const total=s.participants.reduce((v,p)=>v+p.trials,0),uniform=new Set(s.participants.map(p=>p.trials)).size===1;
      root.innerHTML=`<section class="panel chart-panel hyp-test"><h2>顔写真を見分ける正答率は、50%と違う？</h2><section class="hyp-question" data-screen-nav-section="仮説と観測結果"><p>本物かAI生成かを2択で答える課題です。当てずっぽうの正答率は50%。今回の平均との差は、偶然のばらつきで説明できるでしょうか。</p><p><strong>帰無仮説：</strong>この課題での参加者の平均正答率は50%である。<br><strong>対立仮説：</strong>平均正答率は50%と異なる（高い側・低い側の両方を調べる）。</p><p id="hyp-observed">${fmt(test.n,0)}人${uniform?`が各${fmt(s.participants[0].trials,0)}枚`:'の'}、計${fmt(total,0)}回の判定。1人ごとの正答率を平均すると<strong>${pct(test.mean,2)}</strong>で、50%との差は<strong>${fmt(test.difference*100,2)}ポイント</strong>です。</p></section><section class="hyp-section"><h3>1人ごとの正答率には、ばらつきがある</h3>${scoreHistogram(scores,test)}<p class="hint" data-screen-nav-section="参加者ごとの分布">${uniform?'':'判定枚数が違う場合も、'}1人につき1つの正答率を使い、各人を同じ重みで平均します。${fmt(total,0)}回の回答を、${fmt(total,0)}人分の独立したデータとしては数えません。</p></section><section class="hyp-section" data-screen-nav-section="偶然のずれとp値"><h3>50%を仮定すると、今回以上のずれはどれくらい起こる？</h3><div class="hyp-controls">${radio(s)}</div><p class="hint">有意水準は結果を見る前に決めます。ここでの切り替えは、同じ観測結果に異なる判断基準を当てはめる比較です。</p>${test.valid?`${testChart(test)}<p class="hyp-p-value">両側p値：<strong id="hyp-p-value" data-p-value="${test.pValue}">${pText(test.pValue)}</strong>（${test.pValue<.00001?'0.001%未満':pct(test.pValue,3)}）</p><p id="hyp-decision" class="annotation">${test.reject?`p値が有意水準${pct(s.alpha,0)}以下なので、帰無仮説を棄却します。参加者の平均正答率が50%と異なることを示す結果です。`:`p値が有意水準${pct(s.alpha,0)}を上回るので、帰無仮説を棄却しません。50%と異なるという十分な証拠は得られません。`}</p>`:`<p id="hyp-unavailable" class="annotation">${esc(test.reason)} このデータではt検定と信頼区間を計算できません。データタブの正答数を確認してください。</p>`}</section>${test.valid?`<section class="hyp-section"><h3>有意差があると、見分けられたといえる？</h3>${intervalChart(test)}<div data-screen-nav-section="差の方向と大きさ"><p>${pct(1-s.alpha,0)}信頼区間は<strong>${pct(test.interval[0],2)}〜${pct(test.interval[1],2)}</strong>で、50%を${test.interval[0] <= .5 && test.interval[1] >= .5?'含みます':'含みません'}。</p><p id="hyp-interpretation">${test.reject?(test.difference<0?`今回の平均は50%を${fmt(-test.difference*100,2)}ポイント下回る方向の差です。偶然よりよく見分けられた、という結果にはなっていません。`:`今回の平均は50%を${fmt(test.difference*100,2)}ポイント上回る方向の差です。この差が実際の画像確認に十分な精度かも考える必要があります。`):'今回のデータでは平均正答率と50%の違いを示せませんでした。50%という仮説が証明されたことにはなりません。'} 有意差の有無と、差の方向・大きさを一緒に読みます。</p><p class="hint">p値は「帰無仮説が正しい確率」や「今回の差が偶然である確率」ではありません。この実験から、現在のSNS上の画像全般や日本の高校生の正答率を直接求めることもできません。</p></div></section><details class="hyp-details" data-screen-nav-section="計算の手順"><summary>計算の手順と前提を確かめる</summary><p>参加者の正答率をxᵢとし、平均x̄と標本標準偏差s（分母n−1）を求めます。標準誤差はs÷√nです。</p><p>n=${fmt(test.n,0)}人、x̄=${pct(test.mean,4)}、s=${fmt(test.sd*100,4)}ポイント、標準誤差=${fmt(test.se*100,4)}ポイント。</p><p>t=(x̄−0.5)÷(s÷√n)=${fmt(test.t,4)}。自由度${test.df}のt分布でP(|T|≥${fmt(Math.abs(test.t),4)})を両側p値として計算します。</p><p>有意水準${pct(s.alpha,0)}では|t|≥${fmt(test.critical,4)}を棄却域とし、同じ基準から${pct(1-s.alpha,0)}信頼区間x̄±${fmt(test.critical,4)}×s÷√nを求めます。</p><p>参加者間の独立性を仮定した1標本t検定です。正答率は離散的な値なので、母集団が正規分布なら厳密な手順、今回の多数の参加者では近似として使います。画像群は共通で、別の画像群への一般化まで検証する分析ではありません。</p></details>`:''}</section>`;
    } else {
      const plan=test.valid?meanTestPower(s.planN,s.trueMean,test.sd,s.alpha):null;
      root.innerHTML=`<section class="panel chart-panel hyp-errors"><h2>同じ判断基準でも、誤判定や見逃しは起こる</h2><section data-screen-nav-section="これから調べる計画"><p>ここでは、これから${fmt(s.planN,0)}人を調べる計画を考えます。データタブの${fmt(test.n,0)}人の観測結果は変わりません。</p><div class="hyp-controls">${number('plan-n','これから調べる人数（人）',s.planN,30,1000,1)}${number('true-rate','仮定する本当の平均正答率（%）',Number((s.trueMean*100).toFixed(6)),0,100,'any')}${radio(s)}</div><button id="hyp-use-observed-mean" type="button">今回の平均正答率を仮定に使う</button><p class="hint">本当の平均は実際には未知です。ここでは比較のために仮定を置きます。人数は独立した参加者の数です。</p></section>${plan?`<section class="hyp-section">${planningChart(plan)}</section><section class="hyp-section"><h3>この計画で同じ検定を繰り返すと</h3>${table(['仮定する本当の平均','棄却する確率','棄却しない確率'],[[`基準と同じ50%`,`${pct(plan.falsePositive,2)}（第1種の誤り）`,pct(1-plan.falsePositive,2)],[`${pct(plan.trueMean,2)}`,`${pct(plan.detected,2)}（${plan.hasAlternative?'検出力':'第1種の誤り'}）`,`${pct(plan.missed,2)}${plan.hasAlternative?'（第2種の誤り）':''}`]])}<p class="annotation" id="hyp-plan-interpretation">${plan.hasAlternative?`本当の平均が${pct(plan.trueMean,2)}なら、この計画で違いを検出する確率は${pct(plan.detected,2)}、見逃す確率は${pct(plan.missed,2)}です。`:'本当の平均を50%としたので、2つの仮定は同じです。違いがないため、検出力や第2種の誤りとしては表示しません。'}</p><p>人数を増やすと小さな差も検出しやすくなります。有意水準を小さくすると、基準が正しいのに棄却する誤りを減らせますが、違いの見逃しは増えます。</p></section><details class="hyp-details" data-screen-nav-section="計画モデルの前提"><summary>この計画例の前提を確かめる</summary><p>参加者ごとの正答率の分布を正規分布で近似し、母標準偏差を今回のデータの${fmt(test.sd*100,2)}ポイントに固定した計画例です。人数が変わっても、前タブと同じ1標本t検定の方法を使います。帰無仮説側だけで決めた棄却域を、平均が異なる場合にもそのまま当てはめます。</p><p>平均が50%なら自由度${plan.df}のt分布、仮定する平均が異なる場合は非心t分布を使い、それぞれの棄却域に入る確率を計算します。乱数による反復結果ではなく、このモデルでの理論値です。</p><p>正答率は0〜100%に収まる値なので、正規分布による計画は近似です。特に平均を0%や100%に近づけた場合や、人数が少ない場合の計画値は、そのまま実際の成功率を保証しません。選び方の偏りや同じ画像の共有も、人数だけで解消されるわけではありません。</p></details>`:`<p class="annotation">参加者の正答率がすべて同じため、計画に使うばらつきを推定できません。データタブの正答数を確認してください。</p>`}</section>`;
    }
    wire(root,ctx);
  }
};

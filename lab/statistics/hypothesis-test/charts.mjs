import { chartKey, esc, svg, groupPattern } from '../shared/ui.mjs?v=20261025-guided-test';
import { fmt } from '../shared/math.mjs';
import { studentDensity, noncentralDensity } from './mean-model.mjs?v=20261025-guided-test';
const pct = (v,d=1) => fmt(v*100,d)+'%';
function niceStep(value) {
  const power=10**Math.floor(Math.log10(value || 1)), scaled=value/power;
  return (scaled<=1?1:scaled<=2?2:scaled<=5?5:10)*power;
}
function ticks(lo,hi) {
  const step=niceStep((hi-lo)/5), start=Math.ceil(lo/step)*step;
  return Array.from({length:Math.max(1,Math.floor((hi-start)/step+1e-9)+1)},(_,i)=>Math.abs(start+i*step)<step*1e-8?0:start+i*step);
}
function plotAxes(lo,hi,rawMax,xlabel,ylabel,height=330,wholeY=false) {
  const top=34,bottom=height-50,left=62,right=736,step=Math.max(wholeY?1:0,niceStep(rawMax/4)), ymax=Math.ceil(rawMax/step)*step;
  const x=v=>left+(v-lo)/(hi-lo)*(right-left),y=v=>bottom-v/ymax*(bottom-top);
  const value=v=>fmt(v,Math.max(0,Math.min(8,Math.ceil(-Math.log10(step)))));
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
export function scoreBins(scores, width=5) {
  if(![5,10,20].includes(width))throw Error('階級幅を確認してください。');
  const counts=Array(100/width).fill(0);
  for(const v of scores){const q=v*100/width;counts[Math.min(counts.length-1,Math.floor(q+8*Number.EPSILON*Math.max(1,q)))]++;}
  return counts.map((count,i)=>({count,lo:i*width,hi:(i+1)*width,last:i===counts.length-1}));
}
export function scoreHistogram(scores,{width=5,selected=-1,mean=null,reference=null,label='正答率'}={}) {
  const bins=scoreBins(scores,width),a=plotAxes(0,100,Math.max(...bins.map(b=>b.count),1)*1.12,`1人ごとの${label}（%）`,'人数（人）',300,true);
  const bars=bins.map((b,i)=>`<g><title>${b.lo}%以上${b.hi}%${b.last?'以下':'未満'}：${b.count}人</title><rect id="hyp-bin-${i}" role="button" tabindex="0" aria-label="${b.lo}%以上${b.hi}%${b.last?'以下':'未満'}、${b.count}人" aria-pressed="${i===selected}" data-hyp-bin="${i}" data-hyp-bin-count="${b.count}" x="${a.x(b.lo)+1}" y="${a.y(b.count)}" width="${a.x(b.hi)-a.x(b.lo)-2}" height="${a.y(0)-a.y(b.count)}" fill="var(${i===selected?'--chart-secondary':'--chart-primary'})"/></g>`).join('');
  let content=a.markup+bars;
  if(reference!==null)content+=vertical(a,reference*100,'var(--chart-neutral)','4 4');
  if(mean!==null)content+=vertical(a,mean*100,'var(--chart-secondary-dark)');
  return svg(content,`1人ごとの${label}を幅${width}ポイントでまとめたヒストグラム。棒の高さは人数。`,760,300)+`<div class="legend">${chartKey(`1人ごとの${label}`,'var(--chart-primary)','bar')}${selected>=0?chartKey('選んだ範囲','var(--chart-secondary)','bar'):''}${reference!==null?chartKey(`基準 ${pct(reference)}`,'var(--chart-neutral)','line-dashed'):''}${mean!==null?chartKey(`標本平均 ${pct(mean,2)}`,'var(--chart-secondary-dark)','line'):''}</div>`;
}
export const rejectionRanges = test => [
  ...(Number.isFinite(test.acceptance[0])?[[-Infinity,test.acceptance[0]]]:[]),
  ...(Number.isFinite(test.acceptance[1])?[[test.acceptance[1],Infinity]]:[]),
];
export function testChart(test,{showDecision=false,label='正答率'}={}) {
  const span=Math.max(5,Math.min(8,Math.ceil(Math.abs(test.t)*1.18)),Math.ceil(Math.abs(test.critical)*1.3)),offscreen=Math.abs(test.t)>span;
  const density=t=>studentDensity(t,test.df),a=plotAxes(-span,span,density(0)*1.18,'平均との差 ÷ 標準誤差（t）','確率密度（面積が確率を表す）');
  const points=Array.from({length:401},(_,i)=>{const t=-span+2*span*i/400;return[a.x(t),a.y(density(t))];});
  const ranges=test.direction==='two-sided'?[[-Infinity,-Math.abs(test.t)],[Math.abs(test.t),Infinity]]:test.direction==='greater'?[[test.t,Infinity]]:[[-Infinity,test.t]];
  let content=groupPattern('hyp-tail-pattern')+a.markup+area(a,density,-span,span,'var(--chart-primary)',.1);
  for(const [lo,hi] of ranges)content+=area(a,density,lo,hi,'url(#hyp-tail-pattern)');
  if(showDecision)for(const [lo,hi] of rejectionRanges(test)){
    const from=Math.max(-span,lo),to=Math.min(span,hi);
    if(to>from)content+=`<rect x="${a.x(from)}" y="${a.bottom-4}" width="${a.x(to)-a.x(from)}" height="4" fill="var(--chart-purple)"/>`;
  }
  content+=polyline(points,'var(--chart-primary)')+vertical(a,0,'var(--chart-neutral)','3 4');
  for(const value of test.direction==='two-sided'?[-Math.abs(test.t),Math.abs(test.t)]:[test.t])if(Math.abs(value)<=span)content+=vertical(a,value,'var(--chart-secondary-dark)','6 3');
  content+=`<text x="${a.x(Math.max(-span,Math.min(span,test.t)))+(test.t<=0?7:-7)}" y="55" text-anchor="${test.t<=0?'start':'end'}" style="fill:var(--chart-secondary-dark)">今回 t=${fmt(test.t,2)}${offscreen?'（範囲外）':''}</text>`;
  return svg(content,`平均${label}が基準${pct(test.reference)}の場合のt分布。橙の面積が選んだ方向のp値。`,760,330)+`<div class="legend">${chartKey('帰無仮説のもとでのt分布','var(--chart-primary)','line')}${chartKey(`今回以上のずれ${test.direction==='two-sided'?'（両側）':test.direction==='greater'?'（右側）':'（左側）'}`,'var(--chart-secondary)','stripe')}${showDecision?chartKey('棄却域','var(--chart-purple)','bar'):''}</div>${offscreen?'<p class="hint">今回のtは表示範囲外です。確率は図の外まで含めて計算しています。</p>':''}`;
}
export function scaleChart(test,label='正答率') {
  const lo=Math.min(test.reference-4*test.se,test.mean)-test.se,hi=Math.max(test.reference+4*test.se,test.mean)+test.se;
  const x=v=>62+(v-lo)/(hi-lo)*674;
  let content=`<line x1="62" x2="736" y1="105" y2="105" class="axis"/>`;
  for(const v of ticks(lo*100,hi*100))content+=`<text x="${x(v/100)}" y="126" text-anchor="middle">${fmt(v,Math.max(0,Math.min(8,Math.ceil(-Math.log10(niceStep((hi-lo)*100/5))))))}</text>`;
  content+=`<line x1="${x(test.reference)}" x2="${x(test.reference)}" y1="30" y2="109" stroke="var(--chart-neutral)" stroke-dasharray="4 4"/><text x="${x(test.reference)}" y="21" text-anchor="${x(test.reference)>650?'end':x(test.reference)<120?'start':'middle'}">基準 ${pct(test.reference,2)}</text><circle cx="${x(test.mean)}" cy="105" r="5" fill="var(--chart-secondary-dark)"/><text x="${x(test.mean)}" y="84" text-anchor="${test.mean<test.reference?'start':'end'}">今回 ${pct(test.mean,2)}</text>`;
  const from=test.reference,to=test.reference+test.se;
  content+=`<path d="M${x(from)},54V64H${x(to)}V54" fill="none" stroke="var(--chart-primary)" stroke-width="2"/><text x="${(x(from)+x(to))/2}" y="47" text-anchor="middle">標準誤差1つ分</text><text x="399" y="161" text-anchor="middle">平均${esc(label)}（%）</text>`;
  return svg(content,'基準と今回の平均の位置、標準誤差1つ分の長さを比べる。',760,170).replace('class="stat-chart"','class="stat-chart hyp-short-chart"');
}
export function intervalText(test) {
  return test.direction==='two-sided'?`${pct(test.interval[0],2)}〜${pct(test.interval[1],2)}`
    :test.direction==='greater'?`${pct(test.interval[0],2)}以上（片側の信頼下限）`:`${pct(test.interval[1],2)}以下（片側の信頼上限）`;
}
export function intervalChart(test,label='正答率') {
  const [lower,upper]=test.interval,finite=[test.mean,test.reference,...test.interval.filter(Number.isFinite)];
  const spread=Math.max(.01,Math.max(...finite)-Math.min(...finite)),lo=Math.min(...finite)-spread*.3,hi=Math.max(...finite)+spread*.3;
  const x=v=>62+(v-lo)/(hi-lo)*674,from=Number.isFinite(lower)?lower:lo,to=Number.isFinite(upper)?upper:hi;
  let content=`<line x1="${x(test.reference)}" x2="${x(test.reference)}" y1="27" y2="99" stroke="var(--chart-neutral)" stroke-width="2" stroke-dasharray="4 4"/><text x="${x(test.reference)}" y="17" text-anchor="middle">基準 ${pct(test.reference,2)}</text><line x1="${x(from)}" x2="${x(to)}" y1="67" y2="67" stroke="var(--chart-purple)" stroke-width="4"/>`;
  for(const v of [lower,upper].filter(Number.isFinite))content+=`<line x1="${x(v)}" x2="${x(v)}" y1="59" y2="75" stroke="var(--chart-purple)" stroke-width="2"/>`;
  if(!Number.isFinite(lower))content+='<text x="62" y="72" style="fill:var(--chart-purple)">←</text>';
  if(!Number.isFinite(upper))content+='<text x="736" y="72" text-anchor="end" style="fill:var(--chart-purple)">→</text>';
  content+=`<circle cx="${x(test.mean)}" cy="67" r="5" fill="var(--chart-secondary-dark)"/><text x="${x(test.mean)}" y="47" text-anchor="middle">標本平均 ${pct(test.mean,2)}</text>`;
  for(const v of ticks(lo*100,hi*100))content+=`<text x="${x(v/100)}" y="116" text-anchor="middle">${fmt(v,Math.max(0,Math.min(8,Math.ceil(-Math.log10(niceStep((hi-lo)*100/5))))))}</text>`;
  content+=`<text x="399" y="144" text-anchor="middle">平均${esc(label)}（%）・区間の周辺を拡大</text>`;
  return svg(content,`${pct(1-test.alpha,0)}信頼区間：${intervalText(test)}`,760,150).replace('class="stat-chart"','class="stat-chart hyp-interval-chart"');
}
export function planningChart(plan,{world='both',shade='missed',label='正答率'}={}) {
  const spread=Math.max(6,Math.abs(plan.delta)*Math.sqrt(2/plan.df)*4),includeAlt=world!=='null';
  const lo=Math.floor(Math.min(-5,includeAlt?plan.delta-spread:-5)),hi=Math.ceil(Math.max(5,includeAlt?plan.delta+spread:5));
  const nullDensity=t=>studentDensity(t,plan.df),altDensity=t=>noncentralDensity(t,plan.df,plan.delta);
  const values=[...new Set([...Array.from({length:281},(_,i)=>lo+(hi-lo)*i/280),...Array.from({length:101},(_,i)=>-5+i/10)])].sort((a,b)=>a-b),alt=includeAlt?values.map(altDensity):[];
  const a=plotAxes(lo,hi,Math.max(studentDensity(0,plan.df),...alt)*1.2,'平均との差 ÷ 標準誤差（t）','同じルールを繰り返すモデル・面積が確率');
  let content=groupPattern('hyp-error-pattern')+a.markup;
  if(world!=='alternative')content+=area(a,nullDensity,lo,hi,'var(--chart-primary)',.1);
  if(shade==='false-positive')for(const [from,to] of rejectionRanges(plan))content+=area(a,nullDensity,from,to,'url(#hyp-error-pattern)');
  if(includeAlt&&shade==='missed')content+=area(a,altDensity,plan.acceptance[0],plan.acceptance[1],'url(#hyp-error-pattern)',.85);
  if(world!=='alternative')content+=polyline(values.map(t=>[a.x(t),a.y(nullDensity(t))]),'var(--chart-primary)');
  if(includeAlt)content+=polyline(values.map((t,i)=>[a.x(t),a.y(alt[i])]),'var(--chart-secondary-dark)','6 3');
  for(const [from,to] of rejectionRanges(plan)) {
    const start=Math.max(lo,from),end=Math.min(hi,to);
    if(end>start)content+=`<rect x="${a.x(start)}" y="${a.bottom-4}" width="${a.x(end)-a.x(start)}" height="4" fill="var(--chart-purple)"/>`;
  }
  for(const c of plan.acceptance.filter(Number.isFinite))content+=vertical(a,c,'var(--chart-purple)','3 4');
  return svg(content,'帰無仮説側と比較する平均の分布。同じ紫の棄却域で判断する。橙の斜線が注目する誤りの確率。',760,330)+`<div class="legend">${world!=='alternative'?chartKey(`平均が基準${pct(plan.reference,2)}の場合`,'var(--chart-primary)','line'):''}${includeAlt?chartKey(`平均が${pct(plan.trueMean,2)}の場合`,'var(--chart-secondary-dark)','line-dashed'):''}${chartKey('棄却域','var(--chart-purple)','bar')}${chartKey(shade==='false-positive'?'基準どおりなのに棄却':plan.hasAlternative?'違いを見逃す':'この平均で棄却しない','var(--chart-secondary)','stripe')}</div>`;
}

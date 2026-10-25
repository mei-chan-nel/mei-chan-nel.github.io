import { chartKey, esc, svg, groupPattern } from '../shared/ui.mjs?v=20261025-plain-copy';
import { normalDensity } from './normal-model.mjs?v=20261025-plain-copy';
import { rateText } from './guide.mjs?v=20261025-plain-copy';
import { fmt } from '../shared/math.mjs';
import { studentDensity, noncentralDensity } from './mean-model.mjs?v=20261025-plain-copy';
const pct = (v,d=1) => fmt(v*100,d)+'%';
function niceStep(value) {
  const power=10**Math.floor(Math.log10(value || 1)), scaled=value/power;
  return (scaled<=1?1:scaled<=2?2:scaled<=5?5:10)*power;
}
function ticks(lo,hi) {
  const step=niceStep((hi-lo)/5), start=Math.ceil(lo/step)*step;
  return Array.from({length:Math.max(1,Math.floor((hi-start)/step+1e-9)+1)},(_,i)=>Math.abs(start+i*step)<step*1e-8?0:start+i*step);
}
function plotAxes(lo,hi,rawMax,xlabel,ylabel,height=330,wholeY=false,top=34) {
  const bottom=height-50,left=62,right=736,step=Math.max(wholeY?1:0,niceStep(rawMax/4)), ymax=Math.ceil(rawMax/step)*step;
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
export function scoreHistogram(scores,{width=5,selected=-1,mean=null,reference=null,label='正答率',interactive=true}={}) {
  const bins=scoreBins(scores,width),a=plotAxes(0,100,Math.max(...bins.map(b=>b.count),1)*1.12,`1人ごとの${label}（%）`,'人数（人）',300,true,mean!==null?65:34);
  const bars=bins.map((b,i)=>`<g><title>${b.lo}%以上${b.hi}%${b.last?'以下':'未満'}：${b.count}人</title><rect id="hyp-bin-${i}" ${interactive?`role="button" tabindex="0" aria-label="${b.lo}%以上${b.hi}%${b.last?'以下':'未満'}、${b.count}人" aria-pressed="${i===selected}" data-hyp-bin="${i}"`: ''} data-hyp-bin-count="${b.count}" x="${a.x(b.lo)+1}" y="${a.y(b.count)}" width="${a.x(b.hi)-a.x(b.lo)-2}" height="${a.y(0)-a.y(b.count)}" fill="var(${interactive&&i===selected?'--chart-secondary':'--chart-primary'})"/></g>`).join('');
  let content=a.markup+bars;
  if(reference!==null)content+=vertical(a,reference*100,'var(--chart-reference)','4 4');
  if(mean!==null)content+=vertical(a,mean*100,'var(--chart-secondary-dark)');
  if(mean!==null&&reference!==null){
    const left=mean<=reference;
    content+=`<text x="${a.x(mean*100)+(left?-6:6)}" y="42" text-anchor="${a.x(mean*100)<220?'start':a.x(mean*100)>550?'end':left?'end':'start'}" style="fill:var(--chart-secondary-dark)">今回の標本平均 ${rateText(mean)}</text><text x="${a.x(reference*100)+(left?6:-6)}" y="58" text-anchor="${a.x(reference*100)<220?'start':a.x(reference*100)>550?'end':left?'start':'end'}" style="fill:var(--chart-reference)">帰無仮説の平均 ${rateText(reference)}</text>`;
  }
  return svg(content,`1人ごとの${label}を幅${width}ポイントでまとめたヒストグラム。棒の高さは人数。`,760,300)+`<div class="legend">${chartKey(`1人ごとの${label}`,'var(--chart-primary)','bar')}${interactive&&selected>=0?chartKey('選んだ範囲','var(--chart-secondary)','bar'):''}${reference!==null?chartKey(`帰無仮説の平均 ${rateText(reference)}`,'var(--chart-reference)','line-dashed'):''}${mean!==null?chartKey(`標本平均 ${pct(mean,2)}`,'var(--chart-secondary-dark)','line'):''}</div>`;
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
  content+=polyline(points,'var(--chart-primary)')+vertical(a,0,'var(--chart-reference)','3 4');
  for(const value of test.direction==='two-sided'?[-Math.abs(test.t),Math.abs(test.t)]:[test.t])if(Math.abs(value)<=span)content+=vertical(a,value,'var(--chart-secondary-dark)','6 3');
  content+=`<text x="${a.x(Math.max(-span,Math.min(span,test.t)))+(test.t<=0?7:-7)}" y="55" text-anchor="${test.t<=0?'start':'end'}" style="fill:var(--chart-secondary-dark)">今回 t=${fmt(test.t,2)}${offscreen?'（範囲外）':''}</text>`;
  return svg(content,`平均${label}が基準${rateText(test.reference)}の場合のt分布。橙の面積が、選んだ方向で今回以上にずれる確率。`,760,330)+`<div class="legend">${chartKey('帰無仮説のもとでのt分布','var(--chart-primary)','line')}${chartKey(`今回以上のずれ${test.direction==='two-sided'?'（両側）':test.direction==='greater'?'（右側）':'（左側）'}`,'var(--chart-secondary)','stripe')}${showDecision?chartKey('棄却域','var(--chart-purple)','bar'):''}</div>${offscreen?'<p class="hint">今回のtは表示範囲外です。確率は図の外まで含めて計算しています。</p>':''}`;
}
export function scaleChart(test,label='正答率') {
  const score=test.z??test.t,distance=Math.abs(score),sign=score<0?-1:1,shown=Math.min(6,distance),end=test.reference+sign*shown*test.se;
  const lo=Math.min(test.reference,end)-test.se*.8,hi=Math.max(test.reference,end)+test.se*.8;
  const x=v=>62+(v-lo)/(hi-lo)*674,refX=x(test.reference),endX=x(end),meanText=rateText(test.mean);
  const anchor=v=>x(v)<200?'start':x(v)>580?'end':'middle';
  let content=`<line x1="62" x2="736" y1="70" y2="70" class="axis"/><line x1="${refX}" x2="${refX}" y1="35" y2="172" stroke="var(--chart-reference)" stroke-width="2" stroke-dasharray="5 4"/><text x="${refX}" y="23" text-anchor="${anchor(test.reference)}">帰無仮説の平均 ${rateText(test.reference)}</text>`;
  content+=`<line x1="${refX}" x2="${endX}" y1="70" y2="70" stroke="var(--chart-secondary)" stroke-width="7"/><circle cx="${endX}" cy="70" r="6" fill="var(--chart-secondary-dark)"/><text x="${endX}" y="49" text-anchor="${anchor(end)}" style="fill:var(--chart-secondary-dark)">今回の平均 ${meanText}${distance>6?'（位置は省略）':''}</text>`;
  content+=`<text x="399" y="102" text-anchor="middle">橙：今回の差 ${fmt(test.difference*100,2)}ポイント</text>`;
  for(let i=0;i<Math.ceil(shown);i++) {
    const a=x(test.reference+sign*i*test.se),b=x(test.reference+sign*Math.min(i+1,shown)*test.se);
    content+=`<rect x="${Math.min(a,b)}" y="134" width="${Math.abs(b-a)}" height="22" fill="var(--chart-primary-pale)" stroke="var(--chart-primary)"/>`;
    if(Math.abs(b-a)>30)content+=`<text x="${(a+b)/2}" y="150" text-anchor="middle">${fmt(Math.min(1,shown-i),shown-i<1?2:0)}</text>`;
  }
  content+=`<text x="399" y="123" text-anchor="middle">緑の1区切り＝標準誤差 ${fmt(test.se*100,2)}ポイント</text><text x="399" y="183" text-anchor="middle">今回の差は、標準誤差の ${fmt(distance,2)} 個分${distance>6?'（緑の目盛りは6個まで）':''}</text>`;
  return svg(content,`帰無仮説の平均${rateText(test.reference)}から今回の平均${meanText}までの差を、標準誤差の等しい長さで区切ると${fmt(distance,2)}個分。`,760,200).replace('class="stat-chart"','class="stat-chart hyp-short-chart"');
}
export function intervalText(test) {
  return test.direction==='two-sided'?`${pct(test.interval[0],2)}〜${pct(test.interval[1],2)}`
    :test.direction==='greater'?`${pct(test.interval[0],2)}以上（片側の信頼下限）`:`${pct(test.interval[1],2)}以下（片側の信頼上限）`;
}
export function intervalChart(test,label='正答率') {
  const [lower,upper]=test.interval,finite=[test.mean,test.reference,...test.interval.filter(Number.isFinite)];
  const spread=Math.max(.01,Math.max(...finite)-Math.min(...finite)),lo=Math.min(...finite)-spread*.3,hi=Math.max(...finite)+spread*.3;
  const x=v=>62+(v-lo)/(hi-lo)*674,from=Number.isFinite(lower)?lower:lo,to=Number.isFinite(upper)?upper:hi;
  const inInterval=test.reference>=lower&&test.reference<=upper;
  let content=`<text x="399" y="20" text-anchor="middle" style="fill:var(--chart-purple)">紫の線：母平均の${rateText(1-test.alpha,0)}信頼区間</text><line x1="${x(from)}" x2="${x(to)}" y1="85" y2="85" stroke="var(--chart-purple-pale)" stroke-width="20"/><line x1="${x(from)}" x2="${x(to)}" y1="85" y2="85" stroke="var(--chart-purple)" stroke-width="4"/>`;
  for(const [v,name] of [[lower,'下限'],[upper,'上限']].filter(([v])=>Number.isFinite(v)))content+=`<line x1="${x(v)}" x2="${x(v)}" y1="72" y2="98" stroke="var(--chart-purple)" stroke-width="2"/><text x="${x(v)}" y="120" text-anchor="middle">${name} ${rateText(v)}</text>`;
  if(!Number.isFinite(lower))content+='<text x="62" y="90" style="fill:var(--chart-purple)">← この先も含む</text>';
  if(!Number.isFinite(upper))content+='<text x="736" y="90" text-anchor="end" style="fill:var(--chart-purple)">この先も含む →</text>';
  content+=`<line x1="${x(test.reference)}" x2="${x(test.reference)}" y1="45" y2="103" stroke="var(--chart-reference)" stroke-width="2" stroke-dasharray="5 4"/><text x="${x(test.reference)}" y="40" text-anchor="${x(test.reference)>570?'end':x(test.reference)<200?'start':'middle'}">帰無仮説の平均 ${rateText(test.reference)}</text><circle cx="${x(test.mean)}" cy="85" r="6" fill="var(--chart-secondary-dark)"/><text x="${x(test.mean)}" y="65" text-anchor="${test.mean<=test.reference?'end':'start'}" style="fill:var(--chart-secondary-dark)">今回の平均 ${rateText(test.mean)}</text><text x="399" y="151" text-anchor="middle">基準 ${rateText(test.reference)} は、この区間に${inInterval?'入っています':'入っていません'}</text><text x="399" y="177" text-anchor="middle">横の位置＝平均${esc(label)}（%）・区間の周辺を拡大</text>`;
  return svg(content,`${rateText(1-test.alpha,0)}信頼区間は${intervalText(test)}。帰無仮説の平均は区間${inInterval?'内':'外'}。`,760,190).replace('class="stat-chart"','class="stat-chart hyp-interval-chart"');
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
  return svg(content,'帰無仮説側と比較する平均の分布。同じ紫の棄却域で判断する。橙の斜線が注目する誤りの確率。',760,330)+`<div class="legend">${world!=='alternative'?chartKey(`平均が基準${rateText(plan.reference)}の場合`,'var(--chart-primary)','line'):''}${includeAlt?chartKey(`平均が${pct(plan.trueMean,2)}の場合`,'var(--chart-secondary-dark)','line-dashed'):''}${chartKey('棄却域','var(--chart-purple)','bar')}${chartKey(shade==='false-positive'?'基準どおりなのに棄却':plan.hasAlternative?'違いを見逃す':'この平均で棄却しない','var(--chart-secondary)','stripe')}</div>`;
}

export function normalChart(rule,{observed=false,reading=false}={}) {
  const shown=observed&&Number.isFinite(rule.z)?rule.z:0,span=Math.max(4,Math.min(7,Math.ceil(Math.abs(shown))),Math.abs(rule.critical)*1.3),height=250;
  const x=v=>52+(v+span)/(2*span)*684,y=v=>195-v/normalDensity(0)*153;
  const a={lo:-span,hi:span,x,y,top:32,bottom:195};
  let content=`<text x="52" y="18">標準正規分布 N(0,1)</text><line class="axis" x1="52" x2="736" y1="195" y2="195"/>`;
  if(reading)content+=area(a,normalDensity,0,Math.abs(rule.critical),'var(--chart-primary)',.25);
  for(const [lo,hi] of rejectionRanges(rule))content+=area(a,normalDensity,lo,hi,'var(--chart-purple)',.3);
  content+=polyline(Array.from({length:301},(_,i)=>{const z=-span+2*span*i/300;return[x(z),y(normalDensity(z))];}),'var(--chart-primary)');
  const labels=[0,...rule.acceptance.filter(Number.isFinite)];
  for(const z of [...new Set(labels)]) {
    content+=`<line x1="${x(z)}" x2="${x(z)}" y1="32" y2="195" stroke="var(${z===0?'--chart-reference':'--chart-purple'})" stroke-width="${z===0?1:2}" stroke-dasharray="4 4"/><text x="${x(z)}" y="216" text-anchor="middle">${Number(z.toFixed(3))}</text>`;
  }
  if(observed){const clipped=Math.max(-span,Math.min(span,shown));content+=`<line x1="${x(clipped)}" x2="${x(clipped)}" y1="40" y2="195" stroke="var(--chart-secondary-dark)" stroke-width="3"/><text x="${x(clipped)+(shown<0?7:-7)}" y="36" text-anchor="${shown<0?'start':'end'}" style="fill:var(--chart-secondary-dark)">今回のZ ${fmt(shown,2)}${Math.abs(shown)>span?'（範囲外）':''}</text>`;}
  content+='<text x="394" y="242" text-anchor="middle">平均のずれを、標準誤差の個数で表した値（Z）</text>';
  return svg(content,`標準正規分布。紫は帰無仮説を棄却する範囲。${reading?'緑は正規分布表で読む0から境目までの面積。':''}${observed?'橙の線は今回のZ。':''}`,760,height)+`<div class="legend">${chartKey('標準正規分布','var(--chart-primary)','line')}${reading?chartKey('表で読む0から境目まで','var(--chart-primary)','bar'):''}${chartKey('棄却域','var(--chart-purple)','bar')}${observed?chartKey('今回のZ','var(--chart-secondary-dark)','line'):''}</div>`;
}

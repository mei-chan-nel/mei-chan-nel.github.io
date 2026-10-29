// Large-sample normal approximation for a mean of independent participant ratios.
// One observation is one participant; repeated image judgments are not extra people.
export const normalDensity = z => Math.exp(-z*z/2)/Math.sqrt(2*Math.PI);
// For z >= 0, P(N(0,1) >= z) = Q(1/2,z²/2)/2.
// A gamma series near zero and continued fraction in the tail avoid cancellation.
export function normalUpper(z) {
  if(z===Infinity)return 0;if(z===-Infinity)return 1;if(z===0)return .5;
  if(typeof z!=='number'||Number.isNaN(z))throw Error('Zを確認してください。');
  const x=z*z/2,a=.5,scale=Math.exp(-x+a*Math.log(x)-Math.log(Math.PI)/2);
  if(!Number.isFinite(x))return z>0?0:1;
  let q;
  if(x<1.5) {
    let term=1/a,sum=term;
    for(let i=1;i<1000;i++){term*=x/(a+i);sum+=term;if(Math.abs(term)<Math.abs(sum)*2e-16)break;}
    q=1-scale*sum;
  }else {
    const nonzero=v=>Math.abs(v)<1e-300?(v<0?-1e-300:1e-300):v;
    let b=x+1-a,c=1e300,d=1/b,h=d;
    for(let i=1;i<10000;i++){const an=-i*(i-a);b+=2;d=1/nonzero(an*d+b);c=nonzero(b+an/c);const delta=d*c;h*=delta;if(Math.abs(delta-1)<2e-15)break;}
    q=scale*h;
  }
  const tail=Math.max(0,Math.min(.5,q/2));return z>0?tail:1-tail;
}
export function normalCritical(alpha,direction='two-sided') {
  if(!Number.isFinite(alpha)||alpha<=0||alpha>=1||!['two-sided','greater','less'].includes(direction))throw Error('有意水準と検定の方向を確認してください。');
  const tail=direction==='two-sided'?alpha/2:alpha,negative=tail>.5,target=negative?1-tail:tail;
  if(target===.5)return 0;
  let lo=0,hi=1;while(normalUpper(hi)>target&&hi<64)hi*=2;
  for(let i=0;i<100;i++){const mid=(lo+hi)/2;if(normalUpper(mid)>target)lo=mid;else hi=mid;}
  return (negative?-1:1)*(lo+hi)/2;
}
export function normalRule(alpha,direction='two-sided') {
  const critical=normalCritical(alpha,direction);
  const acceptance=direction==='two-sided'?[-critical,critical]:direction==='greater'?[-Infinity,critical]:[-critical,Infinity];
  return {alpha,direction,critical,acceptance};
}
export function normalMeanTest(scores,reference=.5,alpha=.05,direction='two-sided') {
  if(!Array.isArray(scores)||scores.length<2||scores.length>10000||scores.some(x=>!Number.isFinite(x)||x<0||x>1))throw Error('1人ごとの割合を0〜1で2〜10,000人分指定してください。');
  if(!Number.isFinite(reference)||reference<=0||reference>=1)throw Error('帰無仮説の平均を0より大きく1より小さい値にしてください。');
  let mean=0,sumSquares=0;scores.forEach((x,i)=>{const d=x-mean;mean+=d/(i+1);sumSquares+=d*(x-mean);});
  const n=scores.length,variance=Math.max(0,sumSquares/(n-1)),sd=Math.sqrt(variance),se=sd/Math.sqrt(n),difference=mean-reference;
  const rule=normalRule(alpha,direction),reason=sd===0?'全員の割合が同じため、平均のばらつきを推定できません。':n<30?'この教材の正規近似は、大標本の例として30人以上を扱います。少人数では別の検定方法を検討してください。':'';
  const z=reason?null:difference/se,reject=z===null?null:z<=rule.acceptance[0]||z>=rule.acceptance[1];
  return {...rule,n,mean,sumSquares,variance,sd,se,difference,reference,z,reject,valid:!reason,reason};
}
export const normalTableArea = z => {if(!Number.isFinite(z)||z<0)throw Error('表のZは0以上にしてください。');return .5-normalUpper(z);};
export function normalTableReading(alpha,direction='two-sided') {
  const critical=normalCritical(alpha,direction),magnitude=Math.abs(critical),tail=direction==='two-sided'?alpha/2:alpha,target=Math.abs(.5-tail);
  const low=Math.floor(magnitude*100)/100,high=Math.ceil(magnitude*100)/100,rounded=Math.round(magnitude*100)/100;
  const exactAtTable=Number(normalTableArea(rounded).toFixed(4))===Number(target.toFixed(4));
  const limited=target>.49995||target>0&&target<.00005;
  const selected=exactAtTable&&!limited?[rounded]:[...new Set([low,high])];
  const center=Math.floor(magnitude*10)/10,start=Math.max(0,Math.round((center-.1)*10)/10);
  const rows=Array.from({length:3},(_,i)=>Math.round((start+i*.1)*10)/10).map(base=>({base,cells:Array.from({length:10},(_,i)=>{const z=Math.round((base+i*.01)*100)/100;return {z,area:normalTableArea(z),selected:selected.includes(z)};})}));
  return {critical,magnitude,tail,target,selected,limited,rows,negative:critical<0};
}

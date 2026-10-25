import {weatherRows} from '../foundations/weather-data.mjs';
export const RAIN = weatherRows().filter(r=>r[0].startsWith('2025-06')).map(r=>r[1]);
export function scenario(pattern='random') {
  const order=RAIN.map((_,i)=>i);let seed=20261025;
  for(let i=order.length-1;i>0;i--){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const j=seed%(i+1);[order[i],order[j]]=[order[j],order[i]];}
  const hidden=new Set(pattern==='none'?[]:pattern==='low'?order.slice().sort((a,b)=>RAIN[a]-RAIN[b]||a-b).slice(0,6):pattern==='high'?order.slice().sort((a,b)=>RAIN[b]-RAIN[a]||a-b).slice(0,6):order.slice(0,6));
  return {rows:RAIN.map((v,i)=>[`2025-06-${String(i+1).padStart(2,'0')}`,hidden.has(i)?null:v]),truth:[...RAIN],pattern,origin:'sample'};
}
export function validateRows(rows) {
  if(!Array.isArray(rows)||rows.length<2||rows.length>90)throw Error('2〜90日分を入力してください。');
  const ids=new Set();return rows.map((r,i)=>{
    if(!Array.isArray(r)||r.length!==2)throw Error('「日付,降水量」の2列にしてください。');
    const id=String(r[0]??'').trim();if(!id||id.length>24||ids.has(id))throw Error(`${i+1}行目の日付・観測名は、重複しない24文字以内の名前にしてください。`);ids.add(id);
    const raw=r[1],empty=raw===null||String(raw??'').trim()===''||String(raw).trim().toUpperCase()==='NA';
    const v=empty?null:raw==='--'?0:Number(raw);if(v!==null&&(!Number.isFinite(v)||v<0||v>2000))throw Error(`${i+1}行目の降水量は0〜2000の数値、または空欄にしてください。`);
    return [id,v];
  });
}
export function stats(values) {
  const n=values.length;if(!n)return {n:0,sum:0,mean:null,variance:null};
  const sum=values.reduce((a,b)=>a+b,0),mean=sum/n;
  return {n,sum,mean,variance:values.reduce((a,b)=>a+(b-mean)**2,0)/n};
}
export const METHODS=[
 ['drop','有効な値だけ','欠損した日は集計から外し、値がある日数を分母にします。'],
 ['zero','0で補完','欠損を0mmとして集計します。実際に0mmだった日とは区別して表示します。'],
 ['mean','平均値で補完','観測された値の平均で埋めます。補完した値は全て同じ平均になります。'],
 ['median','中央値で補完','観測された値を小さい順に並べ、中央の値で埋めます。大きな値の影響を受けにくい方法です。'],
 ['previous','直前の値で補完','表の順に、直前に観測された値を引き継ぎます。先頭から続く欠損は残します。'],
 ['linear','線形補間','前後の観測値を日付に沿って直線でつなぎます。前後を観測値で挟めない欠損は残します。'],
];
function timeCoordinates(rows){
 const dates=rows.map(r=>{const day=r[0];if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return NaN;const at=Date.parse(day);return Number.isFinite(at)&&new Date(at).toISOString().slice(0,10)===day?at:NaN;});
 return dates.every((v,i)=>Number.isFinite(v)&&(!i||v>dates[i-1]))?dates:null;
}
export function processMissing(rows,method='drop') {
 const observed=rows.map(r=>r[1]).filter(v=>v!==null),base=stats(observed),missing=rows.length-observed.length;
 let filled=rows.map(r=>r[1]),available=true,reason='';
 if(method==='zero')filled=filled.map(v=>v??0);
 else if(method==='mean'||method==='median'){
  if(base.n){const ordered=[...observed].sort((a,b)=>a-b),mid=Math.floor(ordered.length/2),value=method==='mean'?base.mean:ordered.length%2?ordered[mid]:(ordered[mid-1]+ordered[mid])/2;filled=filled.map(v=>v??value);}
  else{available=false;reason='補完に使える観測値がありません。';}
 }else if(method==='previous'){
  let prior=null;filled=filled.map(v=>{if(v!==null)prior=v;return v??prior;});
 }else if(method==='linear'&&missing){
  const times=timeCoordinates(rows);
  if(!times){available=false;reason='線形補間には、YYYY-MM-DDの日付を古い順に並べたデータが必要です。';}
  else{let left=-1;for(let i=0;i<filled.length;i++){if(rows[i][1]===null)continue;if(left>=0)for(let j=left+1;j<i;j++)filled[j]=rows[left][1]+(rows[i][1]-rows[left][1])*(times[j]-times[left])/(times[i]-times[left]);left=i;}}
 }
 const values=filled.filter(v=>v!==null),remaining=filled.length-values.length;
 return {...stats(values),observed:base,missing,remaining,imputed:missing-remaining,available,reason,values,filled};
}
export function normalize(state) {
  const rows=validateRows(state.rows),s={rows,method:METHODS.some(([id])=>id===state.method)?state.method:'drop',pattern:['none','random','low','high','manual'].includes(state.pattern)?state.pattern:'random',origin:state.origin==='sample'?'sample':'user',truth:null};
  if(s.origin==='sample'&&Array.isArray(state.truth)&&state.truth.length===rows.length&&state.truth.every(v=>Number.isFinite(v)&&v>=0&&v<=2000))s.truth=[...state.truth];
  return s;
}

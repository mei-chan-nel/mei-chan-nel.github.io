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
export function processMissing(rows,method='drop') {
  const observed=rows.map(r=>r[1]).filter(v=>v!==null),base=stats(observed);
  const values=method==='zero'?rows.map(r=>r[1]??0):method==='mean'?base.n?rows.map(r=>r[1]??base.mean):[]:observed;
  return {...stats(values),observed:base,missing:rows.length-observed.length,values,filled:rows.map(r=>r[1]===null?(method==='zero'?0:method==='mean'?base.mean:null):r[1])};
}
export function normalize(state) {
  const rows=validateRows(state.rows),s={rows,method:['drop','zero','mean'].includes(state.method)?state.method:'drop',pattern:['none','random','low','high','manual'].includes(state.pattern)?state.pattern:'random',origin:state.origin==='sample'?'sample':'user',truth:null};
  if(s.origin==='sample'&&Array.isArray(state.truth)&&state.truth.length===rows.length&&state.truth.every(v=>Number.isFinite(v)&&v>=0&&v<=2000))s.truth=[...state.truth];
  return s;
}

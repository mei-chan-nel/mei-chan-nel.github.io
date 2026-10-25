import {weatherRows} from '../foundations/weather-data.mjs';
export const sampleRows=weatherRows;
export const FIELDS=[['rain','日降水量','mm',1],['temp','日平均気温','℃',2],['sun','日照時間','h',3]];
export function validateRows(rows) {
  if(!Array.isArray(rows)||rows.length<2||rows.length>90)throw Error('2〜90日分を入力してください。');
  const dates=new Set();const next=rows.map((r,i)=>{
    if(!Array.isArray(r)||r.length!==4)throw Error('「日付,降水量,平均気温,日照時間」の4列にしてください。');
    const day=String(r[0]??'').trim();if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||Number.isNaN(Date.parse(day))||new Date(day).toISOString().slice(0,10)!==day||dates.has(day))throw Error(`${i+1}行目の日付は重複しないYYYY-MM-DD形式にしてください。`);dates.add(day);
    if(r.slice(1).some(v=>v===null||String(v).trim()===''))throw Error(`${i+1}行目の数値を入力してください。`);
    const rain=r[1]==='--'?0:Number(r[1]),temp=Number(r[2]),sun=Number(r[3]);
    if(![rain,temp,sun].every(Number.isFinite)||rain<0||rain>2000||temp< -80||temp>65||sun<0||sun>24)throw Error(`${i+1}行目は降水量0〜2000mm、気温−80〜65℃、日照0〜24時間で入力してください。`);
    return [day,rain,temp,sun];
  });return next.sort((a,b)=>a[0].localeCompare(b[0]));
}
export const filteredRows=s=>s.month==='all'?s.rows:s.rows.filter(r=>r[0].slice(0,7)===s.month);
export function histogram(values,width=2){
  const start=Math.floor(Math.min(...values)/width)*width,n=Math.max(1,Math.floor((Math.max(...values)-start)/width)+1);
  const bins=Array.from({length:n},(_,i)=>({label:`${Number((start+i*width).toFixed(2))}〜${Number((start+(i+1)*width).toFixed(2))}`,value:0}));
  for(const v of values)bins[Math.min(n-1,Math.floor((v-start)/width+1e-10))].value++;
  return bins;
}
export function categoryCounts(rows,field,threshold) {
  const values=rows.map(r=>r[field]),above=values.filter(v=>v>=threshold).length;
  return [{label:`${threshold}以上`,value:above},{label:`${threshold}未満`,value:values.length-above}];
}
export function normalize(state) {
 const rows=validateRows(state.rows),key=JSON.stringify(rows),fresh=state.lessonVersion!==3||state.rowsKey!==key;
 const kindOptions=[['bar','line','histogram'],['bar','line','pie'],['scatter','line']],defaults=['line','bar','scatter'];
 const choices=defaults.map((v,i)=>!fresh&&kindOptions[i].includes(state.choices?.[i])?state.choices[i]:v);
 const positive=rows.filter(r=>r[1]>0).sort((a,b)=>b[1]-a[1]),second=positive.find(r=>r[1]<positive[0]?.[1]),limit=second?Math.max(0,second[1]-.1):0;
 return {rows,origin:state.origin==='sample'?'sample':'user',lessonVersion:3,rowsKey:key,choices,rainQuestion:!fresh&&state.rainQuestion==='share'?'share':'compare',answers:defaults.map((_,i)=>!fresh&&typeof state.answers?.[i]==='string'?state.answers[i].slice(0,30):''),orders:defaults.map((_,i)=>!fresh&&Number.isInteger(state.orders?.[i])?Math.max(0,Math.min(2,state.orders[i])):0),axisBase:!fresh&&Number.isFinite(state.axisBase)?Math.max(0,Math.min(limit,state.axisBase)):0,selectedDay:!fresh&&typeof state.selectedDay==='string'&&rows.some(r=>r[0]===state.selectedDay)?state.selectedDay:''};
}

import {svg,esc} from '../shared/ui.mjs?v=20261025-graph-reasons';
import {fmt} from '../shared/math.mjs';
// Two ordinary time-series panels share dates, not units or a vertical scale.
export function pairedTimeChart(rows,{focusDay='',selectedDay=''}={}){
 const left=64,right=730,w=760,h=430,start=Date.parse(rows[0][0]),end=Date.parse(rows.at(-1)[0]),span=end-start||86400000,x=day=>left+(Date.parse(day)-start)/span*(right-left);
 let body='';
 const fields=[{id:'sun',column:3,label:'日照時間（h）',top:40,bottom:170,color:'var(--chart-primary)',low:0,high:Math.max(3,Math.ceil(Math.max(...rows.map(r=>r[3]))/3)*3)},{id:'temp',column:2,label:'日平均気温（℃）',top:242,bottom:372,color:'var(--chart-purple)',low:Math.floor(Math.min(...rows.map(r=>r[2]))-1),high:Math.ceil(Math.max(...rows.map(r=>r[2]))+1)}];
 for(const f of fields){
  const y=v=>f.bottom-(v-f.low)/(f.high-f.low)*(f.bottom-f.top);
  body+=`<g data-time-series="${f.id}"><text x="${left}" y="${f.top-16}">${f.label}</text>`;
  for(let i=0;i<=3;i++){const value=f.low+(f.high-f.low)*i/3;body+=`<line class="gridline" x1="${left}" x2="${right}" y1="${y(value)}" y2="${y(value)}"/><text x="${left-8}" y="${y(value)+4}" text-anchor="end">${fmt(value,Number.isInteger(value)?0:1)}</text>`;}
  body+=`<path class="axis" d="M${left},${f.top}V${f.bottom}H${right}"/><polyline fill="none" stroke="${f.color}" stroke-width="2" points="${rows.map(r=>`${x(r[0])},${y(r[f.column])}`).join(' ')}"/>`;
  for(const r of rows){const focus=r[0]===focusDay,selected=r[0]===selectedDay;body+=`<circle data-lesson-point="${esc(r[0])}" role="button" tabindex="0" aria-label="${esc(r[0])} ${f.label} ${r[f.column]}" cx="${x(r[0])}" cy="${y(r[f.column])}" r="${focus||selected?5:2.5}" fill="${focus?'var(--chart-secondary)':selected?'var(--chart-secondary-dark)':f.color}"><title>${esc(r[0])} ${f.label} ${r[f.column]}</title></circle>`;}
  body+='</g>';
 }
 for(let i=0;i<=6;i++){const t=start+(end-start)*i/6,day=new Date(t).toISOString().slice(0,10),at=left+(right-left)*i/6;body+=`<line x1="${at}" x2="${at}" y1="372" y2="377" class="axis"/><text x="${at}" y="395" text-anchor="middle">${day.slice(5)}</text>`;}
 body+='<text x="397" y="420" text-anchor="middle">日付（上段・下段共通）</text>';
 return svg(body,'横軸は日付。上段は日照時間、下段は日平均気温を、それぞれの目盛りで表した折れ線グラフ。',w,h).replace('<svg ','<svg data-preserve-geometry preserveAspectRatio="xMidYMid meet" ');
}

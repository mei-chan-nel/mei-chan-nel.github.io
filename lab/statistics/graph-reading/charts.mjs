import {svg,esc} from '../shared/ui.mjs?v=20261025-rain-series';
import {fmt} from '../shared/math.mjs';
// Each quantity keeps its own unit and scale, in either a shared or split plot.
export function pairedTimeChart(rows,{focusDay='',selectedDay='',kind='line',layout='overlay'}={}){
 const stacked=layout==='stack',bars=kind==='bar',left=68,right=748,w=820,h=stacked?460:410;
 const start=Date.parse(rows[0][0]),end=Date.parse(rows.at(-1)[0]),span=end-start||86400000,pad=bars?16:0;
 const x=day=>left+pad+(Date.parse(day)-start)/span*(right-left-2*pad);
 const temps=rows.map(r=>r[2]);
 const fields=[{id:'sun',column:3,label:'日照時間（h）',shape:'circle',color:'var(--chart-primary)',low:0,high:Math.max(3,Math.ceil(Math.max(...rows.map(r=>r[3]))/3)*3),top:stacked?60:70,bottom:stacked?190:330},{id:'temp',column:2,label:'日平均気温（℃）',shape:'square',color:'var(--chart-purple)',low:bars?Math.min(0,Math.floor(Math.min(...temps)-1)):Math.floor(Math.min(...temps)-1),high:Math.max(bars?1:-79,Math.ceil(Math.max(...temps)+1)),top:stacked?265:70,bottom:stacked?395:330}];
 const marker=(f,cx,cy,size,color)=>f.shape==='circle'?`<circle cx="${cx}" cy="${cy}" r="${size}" fill="${color}"/>`:`<rect x="${cx-size}" y="${cy-size}" width="${size*2}" height="${size*2}" fill="${color}"/>`;
 let body='<defs><pattern id="graph-temp-hatch" patternUnits="userSpaceOnUse" width="6" height="6"><rect width="6" height="6" fill="var(--chart-purple)"/><path d="M-1,1L1,-1M0,6L6,0M5,7L7,5" stroke="white" stroke-width="1"/></pattern></defs>';
 // A legend remains useful when printed without color.
 fields.forEach((f,i)=>{const at=left+i*310;body+=`<g data-series-legend="${f.id}">${bars?`<rect x="${at}" y="18" width="24" height="12" fill="${i?'url(#graph-temp-hatch)':f.color}"/>`:`<line x1="${at}" x2="${at+24}" y1="24" y2="24" stroke="${f.color}" stroke-width="2" ${i?'stroke-dasharray="6 4"':''}/>`}${marker(f,at+12,24,3.5,f.color)}<text x="${at+33}" y="29">${f.label}・${i?'四角':'丸'}${bars?'':i?'・破線':'・実線'}</text></g>`;});
 for(let fIndex=0;fIndex<fields.length;fIndex++){
  const f=fields[fIndex],axisX=!stacked&&fIndex===1?right:left,y=v=>f.bottom-(v-f.low)/(f.high-f.low)*(f.bottom-f.top),axisColor=fIndex?'var(--chart-purple)':'var(--chart-primary)';
  body+=`<g data-time-series="${f.id}" data-series-shape="${f.shape}" data-axis-side="${!stacked&&fIndex===1?'right':'left'}"><text x="${axisX}" y="${f.top-12}" text-anchor="${!stacked&&fIndex===1?'end':'start'}" style="fill:${axisColor}">${f.label}${stacked?'':fIndex?'・右目盛り':'・左目盛り'}</text>`;
  for(let i=0;i<=3;i++){const value=f.low+(f.high-f.low)*i/3;if(stacked||fIndex===0)body+=`<line class="gridline" x1="${left}" x2="${right}" y1="${y(value)}" y2="${y(value)}"/>`;body+=`<text x="${axisX+(!stacked&&fIndex===1?9:-9)}" y="${y(value)+4}" text-anchor="${!stacked&&fIndex===1?'start':'end'}" style="fill:${axisColor}">${fmt(value,Number.isInteger(value)?0:1)}</text>`;}
  body+=`<path class="axis" d="M${axisX},${f.top}V${f.bottom}"/>`;
  if(!bars)body+=`<polyline fill="none" stroke="${f.color}" stroke-width="2" ${fIndex?'stroke-dasharray="6 4"':''} points="${rows.map(r=>`${x(r[0])},${y(r[f.column])}`).join(' ')}"/>`;
  const band=Math.min(20,(right-left)/rows.length*.7);
  for(const r of rows){const focus=r[0]===focusDay,selected=r[0]===selectedDay,cx=x(r[0])+(bars&&!stacked?(fIndex?band/4:-band/4):0),cy=y(r[f.column]),size=focus||selected?5:bars?2.5:3,color=focus?'var(--chart-secondary)':selected?'var(--chart-secondary-dark)':f.color;
   body+=`<g data-lesson-point="${esc(r[0])}" data-series-point="${f.id}" role="button" tabindex="0" aria-label="${esc(r[0])} ${f.label} ${r[f.column]}"><title>${esc(r[0])} ${f.label} ${r[f.column]}</title>`;
   if(bars){const base=y(0),bw=stacked?band:band/2;body+=`<rect data-series-bar="${f.id}" x="${cx-bw/2}" y="${Math.min(cy,base)}" width="${bw}" height="${Math.abs(base-cy)}" fill="${fIndex?'url(#graph-temp-hatch)':f.color}"/>`;}
   body+=marker(f,cx,cy,size,color)+'</g>';
  }
  if(bars)body+=`<line class="axis" x1="${left}" x2="${right}" y1="${y(0)}" y2="${y(0)}"/>`;body+='</g>';
 }
 const bottom=stacked?395:330;
 body+=`<line class="axis" x1="${left}" x2="${right}" y1="${bottom}" y2="${bottom}"/>`;
 for(let i=0;i<=6;i++){const day=new Date(start+(end-start)*i/6).toISOString().slice(0,10),at=left+pad+(right-left-2*pad)*i/6;body+=`<text x="${at}" y="${bottom+23}" text-anchor="middle">${day.slice(5)}</text>`;}
 body+=`<text x="408" y="${bottom+48}" text-anchor="middle">日付${stacked?'（上下共通）':''}</text>`;
 return svg(body,`${stacked?'上下の別々の目盛り':'左は日照時間、右は日平均気温の目盛り'}で表示した2系列の${bars?'棒':'折れ線'}グラフ。丸は日照時間、四角は気温。`,w,h).replace('<svg ','<svg data-preserve-geometry preserveAspectRatio="xMidYMid meet" ');
}

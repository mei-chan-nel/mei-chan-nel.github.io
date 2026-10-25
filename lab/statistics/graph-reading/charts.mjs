import {svg,esc} from '../shared/ui.mjs?v=20261025-distributions';
import {distributionBins,rainIntervals} from './model.mjs?v=20261025-distributions';
import {fmt} from '../shared/math.mjs';
// Each quantity keeps its own unit and scale, in either a shared or split plot.
export function pairedTimeChart(rows,{selectedDay='',kind='line',layout='overlay'}={}){
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
  for(const r of rows){const selected=r[0]===selectedDay,cx=x(r[0])+(bars&&!stacked?(fIndex?band/4:-band/4):0),cy=y(r[f.column]),size=selected?5:bars?2.5:3,color=selected?'var(--chart-secondary-dark)':f.color;
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

const fixedSvg=(body,title,w,h)=>svg(body,title,w,h).replace('<svg ','<svg data-preserve-geometry preserveAspectRatio="xMidYMid meet" ');
const pieColors=['#176f68','#8959b0','#b75c22','#3979ad','#9a435b','#637d2b','#8b6d28','#506375'];
function piePanel(items,{x=0,width=760,title=''}){
 const total=items.reduce((n,r)=>n+r.value,0),single=width>600,cx=single?195:125,cy=192,radius=single?115:95,lx=single?385:245;let angle=-Math.PI/2;
 let body=`<g transform="translate(${x},0)" data-distribution-pie><text x="${width/2}" y="30" text-anchor="middle" style="font-size:17px;font-weight:600">${esc(title)}</text>`;
 items.forEach((r,i)=>{const share=r.value/total,next=angle+share*2*Math.PI,color=pieColors[i%pieColors.length];
  if(share===1)body+=`<circle data-pie-count="${r.value}" cx="${cx}" cy="${cy}" r="${radius}" fill="${color}"/>`;
  else if(share>0)body+=`<path data-pie-count="${r.value}" d="M${cx},${cy}L${cx+radius*Math.cos(angle)},${cy+radius*Math.sin(angle)}A${radius},${radius} 0 ${share>.5?1:0},1 ${cx+radius*Math.cos(next)},${cy+radius*Math.sin(next)}Z" fill="${color}" stroke="white"/>`;
  const ly=65+i*40;body+=`<rect x="${lx}" y="${ly}" width="12" height="12" fill="${color}"/><text x="${lx+19}" y="${ly+11}" style="font-size:14px">${esc(r.label)}</text><text x="${lx+19}" y="${ly+28}" style="font-size:13px">${r.value}日（${fmt(share*100,1)}%）</text>`;angle=next;
 });return body+`<text x="${cx}" y="340" text-anchor="middle" style="font-size:14px">全${total}日 = 100%</text></g>`;
}
export function temperaturePieChart(rows){
 const bins=distributionBins(rows,2).map(r=>({...r,label:r.label+'℃'}));
 return fixedSvg(piePanel(bins,{title:'気温帯ごとの日数の割合'}),'気温帯ごとの日数を割合にした円グラフ。日付の順序は表さない。',760,410);
}
function histogramPanel(items,{x=0,title,unit,color}){
 const left=56,right=460,top=66,bottom=320,max=Math.max(4,Math.ceil(Math.max(...items.map(r=>r.value))/4)*4),y=v=>bottom-v/max*(bottom-top),bw=(right-left)/items.length;
 let body=`<g transform="translate(${x},0)" data-distribution-histogram><text x="258" y="30" text-anchor="middle" style="font-size:17px;font-weight:600">${esc(title)}</text><text x="${left}" y="53" style="font-size:13px">日数（日）</text>`;
 for(let i=0;i<=4;i++){const v=max*i/4;body+=`<line class="gridline" x1="${left}" x2="${right}" y1="${y(v)}" y2="${y(v)}"/><text x="${left-9}" y="${y(v)+4}" text-anchor="end" style="font-size:13px">${v}</text>`;}
 items.forEach((r,i)=>{const at=left+i*bw;body+=`<rect data-histogram-count="${r.value}" x="${at}" y="${y(r.value)}" width="${bw}" height="${bottom-y(r.value)}" fill="${color}" stroke="white" stroke-width=".7"><title>${esc(r.label)}${esc(unit)}：${r.value}日</title></rect><text x="${at+bw/2}" y="${bottom+24}" text-anchor="middle" style="font-size:12px">${esc(r.label)}</text>`;});
 body+=`<path class="axis" d="M${left},${top}V${bottom}H${right}"/><text x="258" y="380" text-anchor="middle" style="font-size:14px">${esc(title)}（${esc(unit)}）</text></g>`;return body;
}
export function pairedDistributionChart(rows,kind){
 const fields=[{column:3,title:'日照時間',unit:'h',color:'var(--chart-primary)'},{column:2,title:'日平均気温',unit:'℃',color:'var(--chart-purple)'}];
 const body=fields.map((f,i)=>{const items=distributionBins(rows,f.column);return kind==='pie'?piePanel(items.map(r=>({...r,label:r.label+f.unit})),{x:i*520,width:520,title:f.title+'の内訳'}):histogramPanel(items,{x:i*520,...f});}).join('');
 return fixedSvg(body,'日照時間と気温を別々に集計した2つの'+(kind==='pie'?'円グラフ':'ヒストグラム')+'。同じ日の2つの値の対応は分からない。',1040,410);
}
export function rainfallHistogram(rows){
 const bins=rainIntervals(rows),upper=bins.at(-1).high,left=68,right=734,top=46,bottom=280,max=Math.max(1,...bins.map(r=>r.density))*1.2,x=v=>left+v/upper*(right-left),y=v=>bottom-v/max*(bottom-top);
 let body='<text x="68" y="23">度数密度（日/mm）</text>';
 for(let i=0;i<=4;i++){const v=max*i/4;body+=`<line class="gridline" x1="${left}" x2="${right}" y1="${y(v)}" y2="${y(v)}"/><text x="${left-9}" y="${y(v)+4}" text-anchor="end">${fmt(v,1)}</text>`;}
 for(const b of bins)body+=`<rect data-density-count="${b.count}" data-density-low="${b.low}" data-density-high="${b.high}" x="${x(b.low)}" y="${y(b.density)}" width="${x(b.high)-x(b.low)}" height="${bottom-y(b.density)}" fill="var(--chart-primary)" stroke="white" stroke-width=".6"><title>${b.label}：${b.count}日、幅${b.high-b.low}mm、度数密度${fmt(b.density,3)}日/mm</title></rect><text x="${(x(b.low)+x(b.high))/2}" y="${y(b.density)-8}" text-anchor="middle">${b.count}日</text>`;
 for(const b of bins)body+=`<text x="${(x(b.low)+x(b.high))/2}" y="326" text-anchor="middle" style="font-size:11px">${b.label}</text>`;
 for(const v of [0,1,10,upper])body+=`<text x="${x(v)}" y="${bottom+22}" text-anchor="middle">${v}</text>`;
 body+=`<path class="axis" d="M${left},${top}V${bottom}H${right}"/><text x="400" y="355" text-anchor="middle">日降水量（mm）</text>`;
 return fixedSvg(body,'1mm未満・1mm以上10mm未満・10mm以上の不等幅ヒストグラム。面積が日数を表す。',760,380);
}

import {esc,svg} from '../shared/ui.mjs?v=20261026-final-upgrade';
import {fmt} from '../shared/math.mjs?v=20261026-final-upgrade';
export function categoryChart(items,{min=0,max=null,unit='',line=false,title='グラフ',height=330,contiguous=false,integerTicks=false,highlightIndices=[],baseline=null}={}) {
  const w=760,h=height,left=62,right=734,top=38,bottom=h-60;
  max=max??Math.max(1,...items.map(r=>r.value))*1.18;if(integerTicks&&min===0)max=Math.max(4,Math.ceil(max/4)*4);if(!(max>min))max=min+1;
  const y=v=>bottom-(v-min)/(max-min)*(bottom-top),x=i=>left+(i+.5)*(right-left)/items.length;
  let body=`<text x="${left}" y="19">${esc(unit)}</text>`;
  for(let i=0;i<=4;i++){const v=min+(max-min)*i/4;body+=`<line class="gridline" x1="${left}" x2="${right}" y1="${y(v)}" y2="${y(v)}"/><text x="${left-9}" y="${y(v)+4}" text-anchor="end">${fmt(v,Number.isInteger(v)?0:1)}</text>`;}
  body+=`<path class="axis" d="M${left},${top}V${bottom}H${right}"/>`;
  if(min>0&&!line)body+=`<path d="M${left-6},${bottom-10}l12,-6l-12,-6l12,-6" fill="none" stroke="var(--chart-text)" stroke-width="2"/><text x="${right}" y="19" text-anchor="end" style="fill:var(--chart-secondary-dark)">縦軸は${fmt(min,Number.isInteger(min)?0:1)}から</text>`;
  if(line)body+=`<polyline points="${items.map((r,i)=>`${x(i)},${y(r.value)}`).join(' ')}" fill="none" stroke="var(--chart-primary)" stroke-width="2.5"/>`;
  items.forEach((r,i)=>{const cx=x(i),cy=y(r.value),barBase=baseline===null?bottom:y(baseline),bw=contiguous?(right-left)/items.length:Math.min(72,(right-left)/items.length*.58);body+=line?`<circle cx="${cx}" cy="${cy}" r="4" fill="var(--chart-primary)"/>`:`<rect x="${cx-bw/2}" y="${Math.min(cy,barBase)}" width="${bw}" height="${Math.abs(barBase-cy)}" fill="var(--chart-primary)"/>`;if(items.length<=12||highlightIndices.includes(i))body+=`<text x="${cx}" y="${cy-8}" text-anchor="middle">${fmt(r.value,Number.isInteger(r.value)?0:1)}</text>`;if(i%Math.ceil(items.length/10)===0||i===items.length-1)body+=`<text x="${cx}" y="${bottom+22}" text-anchor="middle" style="font-size:11px">${esc(r.label)}</text>`;});
  if(baseline!==null)body+=`<line class="axis" x1="${left}" x2="${right}" y1="${y(baseline)}" y2="${y(baseline)}"/>`;
  return svg(body,title,w,h);
}
export function missingChart(rows,filled=null) {
  const values=rows.map((r,i)=>filled?filled[i]:r[1]),max=Math.max(1,...values.filter(v=>v!==null))*1.2,w=760,h=300,left=48,right=738,bottom=248,top=36,x=i=>left+(i+.5)*(right-left)/rows.length,y=v=>bottom-v/max*(bottom-top),bw=Math.min(24,(right-left)/rows.length*.65);
  let body='<text x="48" y="18">1日の降水量（mm）</text>';
  for(let i=0;i<=4;i++){const v=max*i/4;body+=`<line class="gridline" x1="${left}" x2="${right}" y1="${y(v)}" y2="${y(v)}"/><text x="${left-8}" y="${y(v)+4}" text-anchor="end">${fmt(v,1)}</text>`;}
  body+=`<path class="axis" d="M${left},${top}V${bottom}H${right}"/>`;
  rows.forEach((r,i)=>{const v=values[i],cx=x(i),imputed=r[1]===null&&v!==null,color=imputed?'var(--chart-secondary)':'var(--chart-primary)';body+=v===null?`<rect x="${cx-bw/2}" y="${bottom-24}" width="${bw}" height="24" fill="none" stroke="var(--chart-reference)" stroke-dasharray="3 2"/><text x="${cx}" y="${bottom-7}" text-anchor="middle" style="font-size:11px">欠</text>`:v===0?`<circle cx="${cx}" cy="${bottom}" r="3" fill="${color}"/><text x="${cx}" y="${bottom-9}" text-anchor="middle" style="font-size:11px">0</text>`:`<rect x="${cx-bw/2}" y="${y(v)}" width="${bw}" height="${bottom-y(v)}" fill="${color}"/><text x="${cx}" y="${y(v)-7}" text-anchor="middle" style="font-size:11px">${fmt(v,Number.isInteger(v)?0:1)}</text>`;body+=`<text x="${cx}" y="${bottom+22}" text-anchor="middle" style="font-size:11px">${esc(/^\d{4}-/.test(r[0])?r[0].slice(8):r[0])}</text>`;});
  return svg(body,'日ごとの降水量。丸と0は0mm、破線と欠は隠した値または欠損値。橙は補完した値。',w,h);
}
export function scatterChart(rows,xField,yField,{connect=false,focusDay='',selectedDay=''}={}) {
  const w=760,h=330,left=64,right=730,top=38,bottom=270;
  const xs=rows.map(r=>r[xField[3]]),ys=rows.map(r=>r[yField[3]]),xmin=['sun','rain'].includes(xField[0])?Math.max(0,Math.min(...xs)-1):Math.min(...xs)-1,xmax=Math.max(...xs)+1,ymin=Math.min(...ys)-1,ymax=Math.max(...ys)+1,x=v=>left+(v-xmin)/(xmax-xmin)*(right-left),y=v=>bottom-(v-ymin)/(ymax-ymin)*(bottom-top);
  let body=`<text x="${left}" y="18">${esc(yField[1])}（${esc(yField[2])}）</text>`;
  for(let i=0;i<=4;i++){let xv=xmin+(xmax-xmin)*i/4,yv=ymin+(ymax-ymin)*i/4;body+=`<line class="gridline" x1="${left}" x2="${right}" y1="${y(yv)}" y2="${y(yv)}"/><text x="${left-8}" y="${y(yv)+4}" text-anchor="end">${fmt(yv,1)}</text><text x="${x(xv)}" y="${bottom+21}" text-anchor="middle">${fmt(xv,1)}</text>`;}
  body+=`<path class="axis" d="M${left},${top}V${bottom}H${right}"/><text x="390" y="320" text-anchor="middle">${esc(xField[1])}（${esc(xField[2])}）</text>`;
  if(connect)body+=`<polyline points="${rows.map(r=>`${x(r[xField[3]])},${y(r[yField[3]])}`).join(' ')}" fill="none" stroke="var(--chart-reference)" stroke-width="1.5"/>`;
  rows.forEach(r=>{const focus=r[0]===focusDay,selected=r[0]===selectedDay;body+=`<circle data-lesson-point="${esc(r[0])}" tabindex="0" role="button" aria-label="${esc(r[0])}：${r[xField[3]]}${esc(xField[2])}、${r[yField[3]]}${esc(yField[2])}" cx="${x(r[xField[3]])}" cy="${y(r[yField[3]])}" r="${focus||selected?6:4.5}" fill="${focus?'var(--chart-secondary)':selected?'var(--chart-purple)':'var(--chart-primary)'}" opacity=".85"><title>${esc(r[0])}：${r[xField[3]]}${esc(xField[2])}、${r[yField[3]]}${esc(yField[2])}</title></circle>`;});
  return svg(body,'1点が1日を表す散布図。'+xField[1]+'と'+yField[1]+'の関係。',w,h);
}
export function pieChart(items,title='全体に占める割合') {
  const narrow=typeof window!=='undefined'&&window.innerWidth<=600,w=narrow?Math.max(230,window.innerWidth-76):760;
  const cx=narrow?w/2:230,cy=160,radius=narrow?90:112,lx=narrow?18:410;
  const n=items.reduce((a,b)=>a+b.value,0),colors=['var(--chart-primary)','var(--chart-secondary)','var(--chart-purple)'];let angle=-Math.PI/2,body='';
  items.forEach((r,i)=>{const share=n?r.value/n:0,next=angle+share*2*Math.PI,ly=narrow?280+i*64:65+i*70;
    if(share===1)body+=`<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${colors[i]}"/>`;
    else if(share>0)body+=`<path d="M${cx},${cy}L${cx+radius*Math.cos(angle)},${cy+radius*Math.sin(angle)} A${radius},${radius} 0 ${share>.5?1:0},1 ${cx+radius*Math.cos(next)},${cy+radius*Math.sin(next)}Z" fill="${colors[i]}" stroke="white"/>`;
    angle=next;body+=`<rect x="${lx}" y="${ly}" width="14" height="14" fill="${colors[i]}"/><text x="${lx+25}" y="${ly+12}">${esc(r.label)}</text><text x="${lx+25}" y="${ly+35}">${r.value}日 / ${n}日 = ${fmt(share*100,1)}%</text>`;
  });return svg(body,title+'。全体は'+n+'日。',w,narrow?280+items.length*64:320).replace('<svg ', '<svg data-preserve-geometry preserveAspectRatio="xMidYMid meet" ');
}

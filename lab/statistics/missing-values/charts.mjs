import {svg,esc} from '../shared/ui.mjs?v=20261025-missing-comparison';
import {fmt} from '../shared/math.mjs';
export function missingValuesChart(rows,filled,{truth=null}={}){
 const w=800,h=350,left=64,right=776,top=40,bottom=285,values=[...filled.filter(v=>v!==null),...(truth||[])],max=Math.max(5,Math.ceil(Math.max(0,...values)/5)*5),x=i=>left+(i+.5)*(right-left)/rows.length,y=v=>bottom-v/max*(bottom-top),bw=Math.min(30,(right-left)/rows.length*.65);
 let body='<defs><pattern id="missing-imputed-hatch" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="var(--chart-secondary)"/><path d="M-1,1L1,-1M0,6L6,0M5,7L7,5" stroke="white" stroke-width="1"/></pattern></defs><text x="64" y="20">日降水量（mm）</text>';
 for(let i=0;i<=4;i++){const v=max*i/4;body+=`<line class="gridline" x1="${left}" x2="${right}" y1="${y(v)}" y2="${y(v)}"/><text x="${left-9}" y="${y(v)+4}" text-anchor="end">${fmt(v,Number.isInteger(v)?0:1)}</text>`;}
 rows.forEach((r,i)=>{const value=filled[i],imputed=r[1]===null&&value!==null,cx=x(i),color=imputed?'var(--chart-secondary)':'var(--chart-primary)';
  body+=`<g data-missing-day="${esc(r[0])}" data-missing-original="${r[1]===null?'null':r[1]}" data-missing-value="${value===null?'null':value}" data-missing-imputed="${imputed}"><title>${esc(r[0])}：${r[1]===null?'欠損':r[1]+'mm'}${imputed?' → '+fmt(value,2)+'mmで補完':''}</title>`;
  if(value===null)body+=`<rect x="${cx-bw/2}" y="${bottom-23}" width="${bw}" height="23" fill="none" stroke="var(--chart-reference)" stroke-dasharray="3 2"/><text x="${cx}" y="${bottom-7}" text-anchor="middle" style="font-size:11px">欠</text>`;
  else if(value===0)body+=imputed?`<path d="M${cx},${bottom-4}l4,4l-4,4l-4,-4Z" fill="${color}"/><text x="${cx}" y="${bottom-10}" text-anchor="middle" style="font-size:11px">0</text>`:`<circle cx="${cx}" cy="${bottom}" r="3" fill="${color}"/><text x="${cx}" y="${bottom-10}" text-anchor="middle" style="font-size:11px">0</text>`;
  else body+=`<rect x="${cx-bw/2}" y="${y(value)}" width="${bw}" height="${bottom-y(value)}" fill="${imputed?'url(#missing-imputed-hatch)':color}"/>${rows.length<=8?`<text x="${cx}" y="${y(value)-8}" text-anchor="middle">${fmt(value,1)}</text>`:''}`;
  if(truth&&r[1]===null){if(value!==null)body+=`<line x1="${cx}" x2="${cx}" y1="${y(value)}" y2="${y(truth[i])}" stroke="var(--chart-reference)" stroke-dasharray="3 2"/>`;body+=`<circle data-reference-value="${truth[i]}" cx="${cx}" cy="${y(truth[i])}" r="5" fill="white" stroke="var(--chart-reference)" stroke-width="2"><title>隠す前：${truth[i]}mm</title></circle>`;}
  if(i===rows.length-1||(i%Math.ceil(rows.length/8)===0&&rows.length-1-i>=Math.max(1,Math.ceil(rows.length/8)*.6)))body+=`<text x="${cx}" y="${bottom+23}" text-anchor="middle" style="font-size:11px">${esc(/^\d{4}-/.test(r[0])?r[0].slice(5):r[0])}</text>`;
  body+='</g>';
 });
 body+=`<path class="axis" d="M${left},${top}V${bottom}H${right}"/><text x="420" y="335" text-anchor="middle">日付・観測名</text>`;
 return svg(body,'日ごとの降水量。単色は観測値、斜線は補完した値、欠は残っている欠損。'+(truth?'白丸は教材で隠す前の実測値。':''),w,h).replace('<svg ','<svg data-preserve-geometry preserveAspectRatio="xMidYMid meet" ');
}

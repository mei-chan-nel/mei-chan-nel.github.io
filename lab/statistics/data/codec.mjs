import {typeDescription} from './schema.mjs?v=20261026-final-upgrade';
export const FILE_LIMIT=5*1024*1024;
const prefix=/^[=+@\-\t\r]/;
const protect=v=>typeof v==='string'&&(prefix.test(v)||v.startsWith("'"))?"'"+v:v;
export function documentRows(schema,data,{template=false}={}){
  return [
    ['#StudyAtlas','1'],['#表題',template?'ここに表題を入力':data.name||'自分のデータ'],
    ['#文字列保護','apostrophe-v1'],
    ['#列名',...(template?schema.columns.map(c=>c.name):data.headers)],
    ['#型',...schema.columns.map(typeDescription)],
    schema.columns.map(c=>c.name),
    ...(template?schema.examples:data.rows),
  ].map(r=>r.map(v=>protect(v??'')));
}
export function encodeCSV(rows){
  const field=v=>{const s=String(v??'');return /[",\n\r]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;};
  return '\ufeff'+rows.map(r=>r.map(field).join(',')).join('\r\n')+'\r\n';
}
// RFC4180 fields with physical line locations, including embedded newlines.
export function parseCSV(text){
  text=String(text).replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
  const rows=[],lineNumbers=[];let row=[],field='',quoted=false,closed=false,line=1,start=1;
  const separator=text.split('\n')[0].includes('\t')?'\t':',';
  const finish=()=>{row.push(field);if(row.some(v=>v!=='')){rows.push(row);lineNumbers.push(start);}row=[];field='';closed=false;};
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else{field+=c;if(c==='\n')line++;}continue;}
    if(c==='"'&&!field&&!closed){quoted=true;continue;}
    if(c===separator){row.push(field);field='';closed=false;continue;}
    if(c==='\n'){finish();line++;start=line;continue;}
    if(closed&&c.trim())throw Error(`${line}行目の引用符の後に文字があります。区切りのカンマを確認してください。`);
    if(c==='"')throw Error(`${line}行目に途中から始まる引用符があります。セル全体を二重引用符で囲んでください。`);
    field+=c;
  }
  if(quoted)throw Error(`${start}行目からの引用符が閉じていません。末尾に二重引用符を付けてください。`);
  finish();return {rows,lineNumbers};
}
export function decodeRows(input){
  const rows=input.rows.map(r=>[...r]),lines=input.lineNumbers||rows.map((_,i)=>i+1);let start=0,title='',labels=[],protectedText=false;
  const checkHeading=i=>rows[i]?.forEach((v,c)=>{if(v&&typeof v==='object')throw Error(`${lines[i]}行目の${c+1}列目に数式または対応していないセルがあります。計算結果を値として貼り付けてください。`);});
  while(start<rows.length&&String(rows[start][0]).startsWith('#')){
    checkHeading(start);
    const [key,...rest]=rows[start];
    if(key==='#表題')title=String(rest[0]??'');
    else if(key==='#列名')labels=rest.map(v=>String(v??''));
    else if(key==='#文字列保護')protectedText=rest[0]==='apostrophe-v1';
    else if(!['#StudyAtlas','#型'].includes(key))throw Error(`${lines[start]}行目の「${key}」は未対応のメタデータです。ひな形の行名に戻してください。`);
    start++;
  }
  checkHeading(start);
  // Keep unsupported data cells for schema validation so all cell errors are
  // reported together, instead of stopping at the first Excel formula.
  const unprotect=v=>protectedText&&typeof v==='string'&&v.startsWith("'")?v.slice(1):v;
  return {headers:(rows[start]||[]).map(v=>String(unprotect(v)??'').trim()),rows:rows.slice(start+1).map(r=>r.map(unprotect)),lineNumbers:lines.slice(start+1),title:unprotect(title),labels:labels.map(unprotect)};
}
export function validateXlsxContainer(buffer){
  const v=new DataView(buffer);let total=0,entries=0;
  // Limit declared inflated sizes before a ZIP parser allocates them.
  for(let i=0;i+46<=v.byteLength;i++)if(v.getUint32(i,true)===0x02014b50){
    const size=v.getUint32(i+24,true),name=v.getUint16(i+28,true),extra=v.getUint16(i+30,true),comment=v.getUint16(i+32,true);
    if(size===0xffffffff)throw Error('ZIP64形式は読み込めません。通常の.xlsx形式で保存し直してください。');
    total+=size;entries++;if(total>32*1024*1024||entries>500)throw Error('展開後のファイルが大きすぎます。必要なシートとデータだけを新しいExcelファイルに保存してください。');
    i+=45+name+extra+comment;
  }
  if(!entries)throw Error('Excel（.xlsx）ファイルとして読めません。.xlsを拡張子だけ変更せず、Excelで.xlsxとして保存してください。');
}

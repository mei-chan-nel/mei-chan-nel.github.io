import {FILE_LIMIT,encodeCSV,parseCSV,decodeRows,validateXlsxContainer,documentRows} from './codec.mjs?v=20261026-final-upgrade';
import {typeDescription} from './schema.mjs?v=20261026-final-upgrade';
function excel(task,signal){
  return new Promise((resolve,reject)=>{
    if(signal?.aborted){reject(Error('読み込みを取り消しました。'));return;}
    const worker=new Worker(new URL('./excel-worker.js?v=20261026-final-upgrade',import.meta.url));
    const finish=(error,result)=>{clearTimeout(timer);worker.terminate();signal?.removeEventListener('abort',cancel);error?reject(error):resolve(result);};
    const cancel=()=>finish(Error('読み込みを取り消しました。'));
    const timer=setTimeout(()=>finish(Error('Excelの処理に時間がかかりすぎています。不要な書式やシートを削除して保存し直してください。')),20000);
    signal?.addEventListener('abort',cancel,{once:true});
    worker.onmessage=e=>e.data.ok?finish(null,e.data):finish(Error(e.data.message));
    worker.onerror=()=>finish(Error('Excelの処理を開始できません。ページを開き直すかCSV形式を使用してください。'));
    worker.postMessage(task,task.buffer?[task.buffer]:[]);
  });
}
export function download(name,content,type){
  const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');
  a.href=url;a.download=name.replace(/[\\/:*?"<>|\r\n]/g,'_').slice(0,140);document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export async function downloadTemplate(schema,format,signal){
  const rows=documentRows(schema,{}, {template:true});
  if(format==='csv')download(`StudyAtlas-${schema.id}-ひな形.csv`,encodeCSV(rows),'text/csv;charset=utf-8');
  else{const r=await excel({operation:'write',rows,help:schema.columns.map(c=>[c.name,typeDescription(c)])},signal);download(`StudyAtlas-${schema.id}-ひな形.xlsx`,r.buffer,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');}
}
export function downloadAll(schema,data){download(`${data.name||schema.id}.csv`,encodeCSV(documentRows(schema,data)),'text/csv;charset=utf-8');}
// Legacy saved aggregate documents have no active lab schema; keep their export.
export function downloadCSV(filename,headers,rows){download(filename,encodeCSV([headers,...rows]),'text/csv;charset=utf-8');}
export async function readFile(file,schema,signal){
  if(file.size>FILE_LIMIT)throw Error('ファイルは5MB以内にしてください。不要な行・列・書式を取り除いてください。');
  let parsed,otherSheets=[];
  if(/\.xlsx$/i.test(file.name)){
    const buffer=await file.arrayBuffer();validateXlsxContainer(buffer);parsed=await excel({operation:'read',buffer},signal);otherSheets=parsed.otherSheets;
  }else if(/\.csv$/i.test(file.name)){
    const buffer=await file.arrayBuffer();let source;
    try{source=new TextDecoder('utf-8',{fatal:true}).decode(buffer);}catch{throw Error('文字コードを読み取れません。Excelの「CSV UTF-8（コンマ区切り）」で保存してください。');}
    parsed=parseCSV(source);
  }else throw Error('CSV（.csv）またはExcel（.xlsx）を選んでください。.xlsは.xlsxとして保存し直してください。');
  const result=decodeRows(parsed);
  // Excel date cells become ISO dates. A monthly role accepts first-of-month only.
  schema.columns.forEach(c=>{if(c.type!=='month')return;const j=result.headers.findIndex(h=>[c.name,...c.aliases].includes(h));if(j>=0)result.rows.forEach(r=>{if(/^\d{4}-\d{2}-01$/.test(String(r[j])))r[j]=r[j].slice(0,7);});});
  return {...result,filename:file.name,otherSheets};
}

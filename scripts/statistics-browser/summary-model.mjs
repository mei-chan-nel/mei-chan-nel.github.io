import {createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const base=process.argv[2],output=process.argv[3];globalThis.location={search:''};globalThis.localStorage={getItem:()=>null,setItem:()=>{}};
const {sampleState}=await import(pathToFileURL(base+'/shared/samples.mjs')),{currentData}=await import(pathToFileURL(base+'/shared/data-model.mjs'));const out={};
for(const id of ['graph-reading','missing-values','histogram','crosstab','correlation','time-series','sampling','hypothesis-test']){const config=(await import(pathToFileURL(base+'/'+id+'/lab.mjs'))).default,s=sampleState(id,config.initial(),1234);const d=currentData(id,s);out[id]={n:d.rows.length,hash:createHash('sha256').update(JSON.stringify(d.rows)).digest('hex'),totals:d.headers.map((_,c)=>d.rows.reduce((n,r)=>n+(typeof r[c]==='number'?r[c]:0),0))};}
await writeFile(output,JSON.stringify(out,null,2));

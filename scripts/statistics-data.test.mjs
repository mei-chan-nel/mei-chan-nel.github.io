import test from 'node:test';
import assert from 'node:assert/strict';
import {getSchema,schemas,validateInput,previewRows} from '../lab/statistics/data/schema.mjs';
import {documentRows,encodeCSV,parseCSV,decodeRows,validateXlsxContainer} from '../lab/statistics/data/codec.mjs';
import {applyData,currentData} from '../lab/statistics/shared/data-model.mjs';
import {sampleState} from '../lab/statistics/shared/samples.mjs';
const doc=(id,rows,extra={})=>({headers:getSchema(id).columns.map(c=>c.name),rows,...extra});
for(const id of Object.keys(schemas))test(`${id}: template and full CSV round trip preserve all rows and labels`,async()=>{
 const schema=getSchema(id),input=decodeRows(parseCSV(encodeCSV(documentRows(schema,{}, {template:true})))),result=validateInput(input,schema);
 assert.deepEqual(result.errors,[]);assert.deepEqual(result.data.rows,schema.examples);
 let data={...result.data,name:'実験「A,B」\n日本語',headers:schema.columns.map((c,i)=>i===0?'独自の列名':c.name)};
 const text=encodeCSV(documentRows(schema,data));assert.ok(text.startsWith('\ufeff'));
 const next=validateInput(decodeRows(parseCSV(text)),schema);assert.equal(next.valid,true);assert.equal(next.data.name,data.name);assert.deepEqual(next.data.headers,data.headers);assert.deepEqual(next.data.rows,data.rows);
 if(!['projects','graph-reading','missing-values'].includes(id)){
  const config=(await import(`../lab/statistics/${id}/lab.mjs`)).default,base=sampleState(id,config.initial(),100),state=applyData(id,base,{...next.data,x:id==='time-series'?1:0,y:1,date:0,group:id==='histogram'?1:-1});
  assert.deepEqual(currentData(id,state).rows,next.data.rows);assert.equal(currentData(id,state).name,data.name);
 }
});
test('preview retains sequence, shows exactly first/last ten, and never changes source',()=>{
 const rows=Array.from({length:61},(_,i)=>[i,i*2]),before=JSON.stringify(rows);
 const p=previewRows(rows,getSchema('correlation'));assert.deepEqual(p.indices,[...Array.from({length:10},(_,i)=>i),...Array.from({length:10},(_,i)=>i+51)]);assert.equal(JSON.stringify(rows),before);assert.equal(previewRows(rows.slice(0,20),getSchema('correlation')).indices.length,20);
});
test('categorical preview covers eight combinations and reports partial pattern coverage',()=>{
 const rows=Array.from({length:8},(_,i)=>Array.from({length:100},()=>[String(i>>2),String(i>>1&1),String(i&1)])).flat(),before=JSON.stringify(rows);
 const p=previewRows(rows,getSchema('crosstab'));assert.equal(new Set(p.indices.map(i=>JSON.stringify(rows[i]))).size,8);assert.equal(new Set(p.indices).size,20);assert.equal(JSON.stringify(rows),before);
 const many=previewRows(Array.from({length:30},(_,i)=>[i,String(i)]),getSchema('histogram'));assert.equal(many.patterns,30);assert.equal(many.shownPatterns,20);
});
test('multiple field failures carry physical CSV row and column positions',()=>{
 const s=getSchema('graph-reading'),d=decodeRows(parseCSV('#表題,"2行の\n表題"\n日付,日降水量（mm）,日平均気温（℃）,日照時間（h）\n2025-02-30,不明,20,25\n2025-03-01,-1,,5\n'));
 const r=validateInput(d,s);assert.ok(r.errors.length>=5);assert.ok(r.errors.some(e=>e.message.includes('B列の4行目')&&e.message.includes('不明')));assert.ok(r.errors.some(e=>e.message.includes('C列の5行目')));
});
test('missing columns, duplicate columns, unsupported categories and wrong counts are errors',()=>{
 assert.ok(validateInput({headers:['x'],rows:[[1],[2]]},getSchema('correlation')).errors.some(e=>e.message.includes('「y」列')));
 assert.ok(validateInput({headers:['x','x'],rows:[[1,2],[3,4]]},getSchema('correlation')).errors.some(e=>e.message.includes('重複')));
 assert.equal(validateInput(doc('crosstab',[['A','x','yes'],['A','y','no']]),getSchema('crosstab')).valid,false);
 assert.equal(validateInput(doc('histogram',[[1,'a'],[2,'b'],[3,'c']]),getSchema('histogram')).valid,false);
 assert.equal(validateInput(doc('sampling',[[1]]),getSchema('sampling')).valid,false);
 assert.equal(validateInput(doc('projects',[[1,2,'A'.repeat(41)],[2,3,'B']]),getSchema('projects')).valid,false);
});
test('only the missing-value lab accepts missing observations; no accidental numeric coercion',()=>{
 assert.equal(validateInput(doc('missing-values',[['a',null],['b','NA'],['c',0]]),getSchema('missing-values')).valid,true);
 for(const bad of ['',null,'NA','NaN','Infinity','0x20','2mm','=1+1'])assert.equal(validateInput(doc('sampling',[[bad],[1]]),getSchema('sampling')).valid,false,bad);
 assert.equal(validateInput(doc('sampling',[['1e3'],['-2.5']]),getSchema('sampling')).valid,true);
});
test('ordered dates are never silently sorted or filled',()=>{
 const rows=[['2025-06-02',0,20,5],['2025-06-01',0,19,3]],before=JSON.stringify(rows);assert.equal(validateInput(doc('graph-reading',rows),getSchema('graph-reading')).valid,false);assert.equal(JSON.stringify(rows),before);
 const months=structuredClone(schemas['time-series'].examples);months[2][0]='2024-04';assert.equal(validateInput(doc('time-series',months),getSchema('time-series')).valid,false);
 const missing=validateInput(doc('missing-values',[['後',null],['前',0]]),getSchema('missing-values'));assert.equal(missing.valid,true);assert.ok(missing.warnings.some(e=>e.message.includes('線形補間')));
});
test('statistical warnings allow limited exploration while impossible counts fail',()=>{
 let r=validateInput(doc('correlation',[[1,2],[1,3]]),getSchema('correlation'));assert.equal(r.valid,true);assert.ok(r.warnings.length);
 r=validateInput(doc('hypothesis-test',[['a',20,5],['b',20,5]]),getSchema('hypothesis-test'));assert.equal(r.valid,true);assert.equal(r.warnings.length,2);
 r=validateInput(doc('hypothesis-test',[['a',20,21],['b',20,4]]),getSchema('hypothesis-test'));assert.equal(r.valid,false);
 r=validateInput(doc('hypothesis-test',[['a',20,4],['a',20,4]]),getSchema('hypothesis-test'));assert.equal(r.valid,false);
});
test('CSV quoting, injection protection and metadata preserve text exactly',()=>{
 const s=getSchema('crosstab'),data={name:'=不正な数式',headers:['=分類1','分類2','結果'],rows:[["'=a",'+test','@yes'],['-person','正常','no']]};
 const encoded=encodeCSV(documentRows(s,data));assert.match(encoded,/'=不正な数式/);assert.ok(!encoded.includes('\r\n=不正'));
 const d=decodeRows(parseCSV(encoded));assert.equal(d.title,data.name);assert.deepEqual(d.labels,data.headers);assert.deepEqual(d.rows,data.rows);
 assert.throws(()=>parseCSV('x,y\n1,"未完'),/引用符/);assert.throws(()=>decodeRows({rows:[['#表題',{formula:'1+1'}],['x','y'],[1,2]]}),/数式/);
 assert.throws(()=>validateXlsxContainer(new ArrayBuffer(60)),/Excel/);
});
test('all Excel formula cells are reported together without evaluating cached results',()=>{
 const document=decodeRows({rows:[['x','y'],[{formula:'1+1',result:2},3],[4,{formula:'2+2',result:4}]]});
 const result=validateInput(document,getSchema('correlation'));
 assert.equal(result.valid,false);assert.equal(result.errors.length,2);
 assert.match(result.errors[0].message,/A列の2行目.*数式/);
 assert.match(result.errors[1].message,/B列の3行目.*数式/);
});
test('domain errors use source columns when columns are reordered',()=>{
 const result=validateInput({headers:['正答数','参加者番号','判定枚数'],rows:[[21,'P1',20],[8,'P2',20]]},getSchema('hypothesis-test'));
 assert.equal(result.valid,false);assert.match(result.errors[0].message,/A列の2行目/);
});

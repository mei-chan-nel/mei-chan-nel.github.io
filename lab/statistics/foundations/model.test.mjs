import test from 'node:test';
import assert from 'node:assert/strict';
import {RAW_WEATHER,weatherRows} from './weather-data.mjs';
import {scenario,processMissing,validateRows as missingRows,stats,normalize as missingState} from '../missing-values/model.mjs';
import {histogram,categoryCounts,normalize,validateRows} from '../graph-reading/model.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
test('published Tokyo data retain all dates and original precipitation symbols',()=>{
 assert.equal(RAW_WEATHER.length,61);assert.equal(new Set(RAW_WEATHER.map(r=>r[0])).size,61);assert.ok(RAW_WEATHER.some(r=>r[1]==='--'));assert.ok(RAW_WEATHER.some(r=>r[1]==='0.0'));const rows=weatherRows();assert.equal(rows.filter(r=>r[0].startsWith('2025-06')).length,30);near(rows.filter(r=>r[0].startsWith('2025-06')).reduce((n,r)=>n+r[1],0),100);near(rows.filter(r=>r[0].startsWith('2025-07')).reduce((n,r)=>n+r[1],0),74.5);assert.equal(rows[2][1],31);assert.equal(rows[39][1],24);near(rows[0][2],18.6);near(rows[60][3],8.7);
});
test('null, empty, NA, zero and no-precipitation symbols stay distinct',()=>{
 const r=missingRows([['a',null],['b',''],['c','NA'],['d',0],['e','--'],['f',2.5]]);assert.deepEqual(r.map(x=>x[1]),[null,null,null,0,0,2.5]);assert.equal(processMissing(r).n,3);near(processMissing(r).mean,2.5/3);assert.throws(()=>missingRows([['a','NaN'],['b',0]]));assert.throws(()=>missingRows([['a',-1],['b',0]]));
});
test('imputation changes denominators; mean imputation preserves the mean and shrinks variance',()=>{
 const rows=[['a',0],['b',6],['c',null],['d',null]],drop=processMissing(rows,'drop'),zero=processMissing(rows,'zero'),mean=processMissing(rows,'mean');assert.equal(drop.n,2);near(drop.mean,3);near(drop.variance,9);assert.equal(zero.n,4);near(zero.mean,1.5);near(mean.mean,drop.mean);near(mean.variance,4.5);assert.deepEqual(mean.filled,[0,6,3,3]);assert.equal(rows[2][1],null);
});
test('all missing observations cannot supply a mean for mean imputation',()=>{
 for(const method of ['drop','mean'])assert.equal(processMissing([['a',null],['b',null]],method).mean,null);assert.equal(processMissing([['a',null],['b',null]],'zero').mean,0);
});
test('equal counts of missing observations have different biases for heavy-rain and random days',()=>{
 const s=scenario('random'),high=scenario('high'),low=scenario('low');for(const r of [s,high,low]){assert.equal(processMissing(r.rows).missing,6);near(stats(r.truth).mean,100/30);}assert.ok(processMissing(high.rows).mean<processMissing(s.rows).mean);assert.ok(processMissing(low.rows).mean>stats(low.truth).mean);assert.deepEqual(scenario('random'),s);assert.equal(processMissing(scenario('none').rows).missing,0);
});
test('custom data have no invented reference truth and saved states restore nullable values',()=>{
 const s=missingState({...scenario('high'),method:'mean'});assert.equal(s.rows.filter(r=>r[1]===null).length,6);assert.equal(s.method,'mean');assert.equal(missingState({...s,origin:'user'}).truth,null);assert.throws(()=>missingRows([['a',0],['a',1]]));
});
test('histograms count every observation exactly once at positive and negative class boundaries',()=>{
 for(const width of [.5,1,2,5,20])for(const values of [[0,0,.5,1,2,31],[-4,-2,0,2,4],[1,1,1]])assert.equal(histogram(values,width).reduce((n,r)=>n+r.value,0),values.length);
});
test('proportions use actual month lengths and the threshold is inclusive',()=>{
 const rows=weatherRows();for(const [month,total,count] of [['06',30,8],['07',31,5]]){const r=rows.filter(r=>r[0].slice(5,7)===month),c=categoryCounts(r,1,1);assert.equal(r.length,total);assert.equal(c[0].value,count);assert.equal(c.reduce((n,x)=>n+x.value,0),total);}assert.equal(categoryCounts([['a',1],['b',.5]],1,1)[0].value,1);
});
test('dates sort chronologically, impossible dates and invalid climate values are rejected',()=>{
 const r=weatherRows().slice(0,3).reverse();assert.equal(validateRows(r)[0][0],'2025-06-01');for(const row of [['2025-02-30',0,0,0],['2025-01-01',null,0,0],['2025-01-01',0,0,25],['2025-01-01',-1,0,0]])assert.throws(()=>validateRows([row,['2025-01-02',0,0,0]]));
});
test('graph normalization bounds axes and preserves graph choices without mutating observations',()=>{
 const rows=weatherRows(),before=JSON.stringify(rows),s=normalize({rows,month:'2025-06',field:'temp',base:1000,kind:'scatter',xField:'sun',proportion:'rate',rainThreshold:2});assert.equal(s.kind,'scatter');assert.equal(s.xField,'sun');assert.equal(s.proportion,'rate');assert.equal(s.rainThreshold,2);assert.ok(s.base<=18.6);assert.equal(JSON.stringify(rows),before);
});

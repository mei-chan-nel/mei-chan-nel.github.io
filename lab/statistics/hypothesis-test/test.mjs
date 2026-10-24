import test from 'node:test';
import assert from 'node:assert/strict';
import {binomialModel,exactTest,testPerformance,distributionBins} from './model.mjs';
import config from './lab.mjs';
import {currentData,applyData} from '../shared/data-model.mjs';
import {sampleState} from '../shared/samples.mjs';
import {validateDocument} from '../shared/validation.mjs';
function enumerate(n,p){
 const m=Array(n+1).fill(0);
 for(let bits=0;bits<2**n;bits++){
  let k=0;for(let i=0;i<n;i++)k+=(bits>>>i)&1;
  m[k]+=p**k*(1-p)**(n-k);
 }
 return m;
}
test('exact one-sample p values equal independent enumeration of all Bernoulli outcomes',()=>{
 for(let n=1;n<=10;n++)for(const p of [.1,.25,.5,.75,.9]){
  const m=enumerate(n,p);
  for(let k=0;k<=n;k++){
   const want=m.reduce((s,v,x)=>s+(Math.abs(x-n*p)>=Math.abs(k-n*p)-1e-9?v:0),0);
   const t=exactTest(n,k,p);
   assert.ok(Math.abs(t.pValue-want)<1e-11,`${n}/${k}/${p}`);
   assert.equal(t.reject,t.pValue<=.05+1e-12);
  }
 }
});
test('symmetric two-sided tails include ties and both outcomes; zero/one nulls remain valid',()=>{
 assert.ok(Math.abs(exactTest(10,10,.5).pValue-1/512)<1e-14);
 for(const p of [0,1]){
  assert.equal(exactTest(10,p*10,p).pValue,1);
  assert.equal(exactTest(10,p?0:10,p).pValue,0);
  assert.equal(exactTest(10,p?0:10,p).reject,true);
 }
 assert.ok(Math.abs(exactTest(1,0,.5).pValue-1)<1e-14);
});
test('every displayed rejection outcome has the same inclusive-tail decision and size is bounded by alpha',()=>{
 for(const n of [1,2,5,20,40,100,7324])for(const p of [0,.01,.25,.5,.75,.99,1])for(const alpha of [.01,.05,.1]){
  const t=exactTest(n,0,p,alpha),size=t.mass.reduce((s,v,k)=>s+(t.rejection[k]?v:0),0);
  assert.ok(size<=alpha+1e-11,`${n}/${p}/${alpha}:${size}`);
  for(const k of [0,Math.round(n*p),Math.round(n/2),n])assert.equal(t.rejection[k],exactTest(n,k,p,alpha).reject);
 }
});
test('large and very unbalanced binomial models retain probability, mean and variance',()=>{
 for(const n of [100,7324,10000])for(const p of [.000001,.01,.5,.75,.99,.999999]){
  const m=binomialModel(n,p),sum=m.mass.reduce((a,b)=>a+b,0),mean=m.mass.reduce((a,b,k)=>a+b*k,0),variance=m.mass.reduce((a,b,k)=>a+b*(k-n*p)**2,0);
  assert.ok(Math.abs(sum-1)<1e-12);
  assert.ok(Math.abs(mean-n*p)<1e-8);
  assert.ok(Math.abs(variance-n*p*(1-p))<1e-7);
 }
 const t=exactTest(10000,0,.5);assert.ok(Number.isFinite(t.logP)&&t.logP<-6900);
});
test('power uses the fixed null rejection region under both known worlds',()=>{
 const a=testPerformance(40,.75,.65,.05),b=testPerformance(160,.75,.65,.05);
 assert.ok(a.falsePositive<=.05);assert.ok(b.detected>a.detected);
 assert.ok(Math.abs(a.detected+a.missed-1)<1e-12);
 const same=testPerformance(40,.75,.75,.05);
 assert.equal(same.hasAlternative,false);assert.equal(same.falsePositive,same.detected);
 const strict=testPerformance(40,.75,.65,.01);
 assert.ok(strict.falsePositive<=a.falsePositive&&strict.detected<=a.detected);
});
test('chart aggregation preserves exact selected mass and includes observations',()=>{
 for(const [n,k,p] of [[40,30,.75],[7324,5474,.75],[10000,0,.999999],[1,1,0]]){
  const t=exactTest(n,k,p),d=distributionBins(t,[t.tail,t.rejection],k);
  assert.ok(d.lo<=k&&d.hi>=k&&d.bins.length<=90);
  const shown=d.bins.reduce((s,b)=>s+b.selected[0],0);
  const direct=t.mass.reduce((s,v,i)=>s+(i>=d.lo&&i<=d.hi&&t.tail[i]?v:0),0);
  assert.ok(Math.abs(shown-direct)<1e-12);
 }
});
test('published seed counts stay fixed when the reference and decision criterion change',()=>{
 const s=sampleState('hypothesis-test',config.initial(),42),d=currentData('hypothesis-test',s);
 assert.deepEqual(d.rows,[['丸い種子',7324,5474]]);
 assert.deepEqual(currentData('hypothesis-test',{...s,p0:.5,alpha:.01,planN:20}).rows,d.rows);
 validateDocument({version:1,id:'hypothesis-test',state:s},'hypothesis-test',config.initial());
 const own=applyData('hypothesis-test',s,{headers:['対象','合計','該当'],rows:[['陽性',25,7]],name:'調査'});
 assert.equal(own.dataInfo.publicDataset,undefined);
 assert.deepEqual(currentData('hypothesis-test',own).rows,[['陽性',25,7]]);
 assert.equal(own.p0,.75);
});
test('one-sample data rejects fractional counts, empty totals, extra groups and invalid criteria',()=>{
 for(const [n,k,p] of [[0,0,.5],[10001,2,.5],[20,21,.5],[20,-1,.5],[20,1.5,.5],[2.2,1,.5],[20,2,NaN],[20,2,1.1]])assert.throws(()=>exactTest(n,k,p));
 for(const alpha of [0,1,NaN])assert.throws(()=>exactTest(20,10,.5,alpha));
 for(const rows of [[['X',0,0]],[['X',10,11]],[['X',10,1],['Y',20,2]],[['',20,2]]])assert.throws(()=>applyData('hypothesis-test',config.initial(),{headers:['対象','総数','該当数'],rows,name:'bad'}));
});

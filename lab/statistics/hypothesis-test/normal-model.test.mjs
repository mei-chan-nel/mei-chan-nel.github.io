import test from 'node:test';
import assert from 'node:assert/strict';
import {normalUpper,normalCritical,normalMeanTest,normalTableReading,normalTableArea} from './normal-model.mjs';
import {aiFaceParticipants} from './data.mjs';
const near=(a,b,eps=3e-7)=>assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);
test('normal cutoffs agree with reference quantiles for two and one sided rules',()=>{
 for(const [alpha,two,one] of [[.01,2.5758293035489004,2.3263478740408408],[.05,1.959963984540054,1.6448536269514722],[.1,1.6448536269514722,1.2815515655446004]]) {
  near(normalCritical(alpha),two);near(normalCritical(alpha,'greater'),one);near(normalCritical(alpha,'less'),one);
 }
 near(normalUpper(1.959963984540054),.025,3e-9);near(normalUpper(-2),1-normalUpper(2),1e-14);
 near(normalCritical(.8,'greater'),-.8416212335729143);
 assert.ok(Number.isFinite(normalCritical(1e-100)));assert.throws(()=>normalCritical(0));
});
test('normal table locates the 1.9 row and .06 column, and brackets interpolated thresholds',()=>{
 const r=normalTableReading(.05);assert.deepEqual(r.selected,[1.96]);near(r.target,.475,1e-15);
 const row=r.rows.find(x=>x.base===1.9);assert.equal(row.cells[6].z,1.96);assert.equal(row.cells[6].area.toFixed(4),'0.4750');assert.equal(row.cells[6].selected,true);
 const one=normalTableReading(.05,'greater');assert.deepEqual(one.selected,[1.64,1.65]);assert.equal(one.target.toFixed(4),'0.4500');
 near(normalTableArea(1.96),.4750021048517795,3e-9);
});
test('participant averages use their sample standard deviation and normal rejection limits',()=>{
 const scores=aiFaceParticipants().map(p=>p.correct/p.trials),r=normalMeanTest(scores);
 near(r.mean,.48152281746031744,1e-14);near(r.sd,.09493165355787131,1e-14);near(r.se,.00534879272752323,1e-14);near(r.z,-3.454458506983211,1e-12);
 assert.equal(r.valid,true);assert.equal(r.reject,true);near(r.critical,1.959963984540054);
 assert.equal(normalMeanTest(scores,.5,.05,'greater').reject,false);assert.equal(normalMeanTest(scores,.5,.05,'less').reject,true);
});
test('small samples and zero spread remain readable but do not produce a normal decision',()=>{
 for(const scores of [[.2,.8],Array.from({length:29},(_,i)=>i/30),Array(40).fill(.5)]){
  const r=normalMeanTest(scores);assert.equal(r.valid,false);assert.equal(r.z,null);assert.equal(r.reject,null);assert.ok(Number.isFinite(r.mean));assert.ok(r.reason);
 }
 assert.throws(()=>normalMeanTest([.2,.8],1));assert.throws(()=>normalMeanTest([.1,1.1]));
});
test('rejection follows the selected side and the full precision boundary',()=>{
 const scores=Array.from({length:100},(_,i)=>i%2?.6:.4),base=normalMeanTest(scores),q=normalCritical(.05);
 for(const sign of [-1,1])for(const eps of [-1e-6,1e-6]) {
  const reference=base.mean-sign*(q+eps)*base.se,r=normalMeanTest(scores,reference);
  assert.equal(r.reject,eps>0);assert.equal(Math.sign(r.z),sign);
 }
 const weak=normalMeanTest(scores,.52,.01),strong=normalMeanTest(scores,.52,.1);assert.ok(weak.critical>strong.critical);
});

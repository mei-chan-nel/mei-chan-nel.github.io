import test from 'node:test';
import assert from 'node:assert/strict';
import config from './lab.mjs';
import {normalizeGuide,hypothesisText} from './guide.mjs';
import {scoreBins} from './charts.mjs';
import {applyData,currentData} from '../shared/data-model.mjs';
import {sampleState} from '../shared/samples.mjs';
import {validateDocument} from '../shared/validation.mjs';
test('old v3 participant data receive guide defaults without replacing observations or their provenance',()=>{
 const old={participants:[{id:'X',trials:20,correct:8},{id:'Y',trials:25,correct:9}],alpha:.01,planN:100,trueMean:.55,dataInfo:{name:'調査',origin:'user',columns:['参加者','総数','成功'],baseline:[['X',20,8],['Y',25,9]]}};
 const before=structuredClone(old),next=normalizeGuide(old);
 assert.deepEqual(old,before);assert.deepEqual(next.participants,old.participants);assert.deepEqual(next.dataInfo,old.dataInfo);
 assert.equal(next.testStep,0);assert.equal(next.reference,.5);assert.equal(next.alpha,.01);
 validateDocument({version:1,id:'hypothesis-test',state:next},'hypothesis-test',config.initial());
});
test('replacement data restart both journeys while preserving explicitly chosen hypotheses',()=>{
 const s={...config.initial(),testStep:7,errorStep:4,reference:.25,direction:'greater',measureLabel:'成功率'};
 const own=applyData('hypothesis-test',s,{name:'調査',headers:['参加者','試行','成功'],rows:[['X',20,8],['Y',25,9]]});
 assert.equal(own.testStep,0);assert.equal(own.errorStep,0);assert.equal(own.reference,.25);assert.equal(own.direction,'greater');assert.equal(own.measureLabel,'成功率');
 assert.match(currentData('hypothesis-test',own).operation,/25.00%/);
});
test('guide state validates directions, finite settings, steps, labels and bin widths',()=>{
 const base=sampleState('hypothesis-test',config.initial());
 for(const patch of [{reference:0},{reference:1},{direction:'other'},{testStep:8},{errorStep:-1},{binWidth:7},{selectedBin:20},{measureLabel:''},{sigmaMode:'none'},{planningSD:0}])
  assert.throws(()=>validateDocument({version:1,id:'hypothesis-test',state:{...base,...patch}},'hypothesis-test',config.initial()));
 assert.match(hypothesisText(.6,'greater','成功率').null,/60%以下/);
 assert.match(hypothesisText(.6,'less','成功率').alternative,/60%を下回る/);
});
test('histogram boundaries are half-open except 100 percent and all participants remain counted',()=>{
 for(const width of [5,10,20]) {
  const bins=scoreBins([0,.05,.1,.15,.2,.5,1],width);
  assert.equal(bins.reduce((v,b)=>v+b.count,0),7);
  assert.equal(bins.at(-1).count,1);
 }
 assert.equal(scoreBins([.3],5)[6].count,1);
 assert.equal(scoreBins([1],5)[19].count,1);
 assert.throws(()=>scoreBins([.3],7));
});

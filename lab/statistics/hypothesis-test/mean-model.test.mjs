import test from 'node:test';
import assert from 'node:assert/strict';
import {participantScores, meanTest, studentTail, studentDensity, studentCritical, meanTestPower, noncentralDensity} from './mean-model.mjs';
import {aiFaceParticipants, correctCounts} from './data.mjs';
const close = (a, b, tolerance = 1e-10) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);

test('Student tails and critical points match the analytic Cauchy distribution at df=1', () => {
  for (const t of [0, 1e-8, .1, 1, 10, 100, 10000]) {
    close(studentTail(t, 1), Math.atan2(1, t) / Math.PI);
    close(studentDensity(t, 1), 1 / (Math.PI * (1 + t * t)));
  }
  close(studentCritical(.05, 1), 12.7062047361747, 1e-9);
  close(studentCritical(.1, 1), 6.31375151467504, 1e-9);
});

test('Student densities are symmetric, integrate to one, and critical points recover their tail sizes', () => {
  for (const df of [1, 2, 9, 314, 9999]) {
    for (const t of [.1, 1, 2, 5]) close(studentDensity(t, df), studentDensity(-t, df));
    // Change variables t=tan(u), so even the df=1 heavy tail has a finite interval.
    const count = 10000, width = Math.PI / count;
    let total = 0;
    for (let i = 0; i < count; i++) {
      const u = -Math.PI / 2 + (i + .5) * width;
      total += studentDensity(Math.tan(u), df) / Math.cos(u) ** 2 * width;
    }
    close(total, 1, 1e-8);
    for (const alpha of [.01, .05, .1]) close(2 * studentTail(studentCritical(alpha, df), df), alpha);
  }
});

test('one participant contributes one score even when the numbers of judgements differ', () => {
  const data = [{id:'A', trials:100, correct:90}, {id:'B', trials:10, correct:1}, {id:'C', trials:10, correct:5}];
  const original = structuredClone(data), scores = participantScores(data), result = meanTest(scores);
  assert.deepEqual(scores, [.9, .1, .5]);
  assert.equal(result.n, 3);
  assert.equal(result.df, 2);
  close(result.mean, .5);
  assert.equal(result.pValue, 1);
  assert.equal(result.reject, false);
  assert.deepEqual(data, original);
});

test('mean test uses between-participant sample variation and both directions of a difference', () => {
  const scores = [.40, .41, .42, .43, .44, .45, .46, .47, .48, .49];
  const result = meanTest(scores), reflected = meanTest(scores.map(v => 1 - v));
  close(result.mean, .445);
  close(result.sd ** 2, .0009166666666666666);
  close(result.se, result.sd / Math.sqrt(10));
  close(result.pValue, reflected.pValue);
  assert.equal(result.reject, true);
  assert.equal(reflected.reject, true);
  assert.ok(result.interval[1] < .5 && reflected.interval[0] > .5);
  const atMean = meanTest(scores, result.mean);
  close(atMean.pValue, 1);
  assert.equal(atMean.reject, false);
});

test('confidence interval and two-sided decision agree as the reference or alpha changes', () => {
  const scores = Array.from({length:315}, (_, i) => .3 + (i % 39) / 100);
  for (const alpha of [.01, .05, .1]) {
    const r = meanTest(scores, .5, alpha), midpoint = (r.interval[0] + r.interval[1]) / 2;
    close(midpoint, r.mean);
    for (const reference of [r.mean, r.interval[0] - .001, r.interval[1] + .001]) {
      const m = meanTest(scores, reference, alpha);
      assert.equal(m.reject, reference < m.interval[0] || reference > m.interval[1]);
    }
  }
  assert.ok(meanTest(scores, .5, .01).interval[0] < meanTest(scores, .5, .1).interval[0]);
});

test('zero participant variation produces an unavailable test rather than infinite certainty', () => {
  for (const value of [0, .5, .7, 1]) {
    const r = meanTest([value, value, value]);
    assert.equal(r.valid, false);
    for (const k of ['t','pValue','interval','reject']) assert.equal(r[k], null);
  }
});

test('participant identifiers, counts, scores and criteria reject invalid or sparse data', () => {
  const valid = [{id:'A',trials:128,correct:60}, {id:'B',trials:128,correct:65}];
  for (const row of [{id:'A',trials:128,correct:1}, {id:' ',trials:128,correct:1},
    {id:'C',trials:0,correct:0}, {id:'C',trials:128,correct:129}, {id:'C',trials:128,correct:1.5}])
    assert.throws(() => participantScores([valid[0], row]));
  assert.throws(() => participantScores(Array(2)));
  for (const scores of [[], [.5], [.3,NaN], [.3,Infinity], [.3,1.1], [.3,-.1], Array(2)])
    assert.throws(() => meanTest(scores));
  for (const reference of [NaN, -1, 2]) assert.throws(() => meanTest([.4,.6], reference));
  for (const alpha of [0, 1, NaN]) assert.throws(() => meanTest([.4,.6], .5, alpha));
});

test('uploaded experiment-1 extraction reproduces the published average and interval using 315 participants', async () => {
  const {readFile} = await import('node:fs/promises');
  const {parseDelimited} = await import('../shared/csv.mjs');
  const rows = parseDelimited(await readFile(new URL('../shared/datasets/ai-face-accuracy.csv', import.meta.url),'utf8')).slice(1);
  assert.equal(rows.length,315);
  assert.deepEqual(rows.map(r=>Number(r[2])),correctCounts);
  assert.ok(rows.every((r,i)=>r[0]===`P${String(i+1).padStart(3,'0')}`&&Number(r[1])===128));
  assert.equal(correctCounts.reduce((a,b)=>a+b,0),19415);
  const r=meanTest(participantScores(aiFaceParticipants()));
  assert.equal(r.n,315);assert.equal(r.df,314);
  close(r.mean,.48152281746031744,1e-14);
  close(r.sd,.09493165355787131,1e-14);
  close(r.t,-3.454458506983211,1e-12);
  close(r.pValue,.0006271759805342343,1e-13);
  close(r.interval[0],.4709988126417428,1e-12);
  close(r.interval[1],.49204682227889207,1e-12);
  assert.equal(r.reject,true);
});

test('planning uses the same t rule under a normal-score model and preserves null error and direction symmetry', () => {
  const r=meanTest(participantScores(aiFaceParticipants()));
  const same=meanTestPower(315,.5,r.sd,.05);
  assert.equal(same.hasAlternative,false);
  assert.equal(same.detected,.05);
  const low=meanTestPower(100,.48,r.sd),high=meanTestPower(315,.48,r.sd),reflected=meanTestPower(315,.52,r.sd);
  assert.ok(high.detected>low.detected);
  close(high.detected,reflected.detected,1e-10);
  close(high.detected+high.missed,1);
  close(high.critical,studentCritical(.05,314));
  assert.ok(meanTestPower(315,.48,r.sd,.01).detected<high.detected);
  for(const t of [-3,0,3])close(noncentralDensity(t,314,0),studentDensity(t,314));
  for(const n of [0,2,29,1001])assert.throws(()=>meanTestPower(n,.48,r.sd));
  assert.throws(()=>meanTestPower(315,.48,0));
});

import assert from "node:assert/strict";
import {
  sampleBinomial,
  simulateDifferences,
  monteCarloP,
  rejectionThreshold,
  repeatedExperiments,
} from "./lab.mjs";

assert.equal(
  sampleBinomial(100, 0, () => 0.5),
  0,
);
assert.equal(
  sampleBinomial(100, 1, () => 0.5),
  100,
);
assert.deepEqual(
  monteCarloP([-0.2, 0.2, 0], 0.2),
  { extreme: 2, p: 0.75 },
  "Two-sided p includes ties and the +1 correction.",
);
assert.equal(monteCarloP([-0.2, 0.2, 0], 0).p, 1);
assert.equal(
  monteCarloP([-0.2, 0.2, 0], 0.3).p,
  0.25,
  "Simulation p must not be zero.",
);
assert.equal(
  rejectionThreshold([-0.2, 0.2, 0], 5, 5, 0.1),
  null,
  "No rejection region exists below the minimum attainable corrected p.",
);
assert.equal(
  rejectionThreshold(Array(200).fill(1), 10, 10, 0.05),
  null,
  "No feasible difference can exceed 1.",
);
assert.equal(
  rejectionThreshold(Array(200).fill(0), 10, 10, 0.05, 0),
  null,
  "A degenerate null has only one achievable outcome.",
);
const defaultNull = simulateDifferences(80, 80, 0.475, 0.475, 2000, 2027);
const defaultThreshold = rejectionThreshold(defaultNull, 80, 80, 0.05, 0.475);
assert.ok(
  defaultThreshold > 0.15,
  "The empirical .15 quantile itself is not rejecting when ties give p>.05.",
);
assert.ok(monteCarloP(defaultNull, defaultThreshold).p <= 0.05);
assert.ok(monteCarloP(defaultNull, defaultThreshold - 1 / 80).p > 0.05);
for (const [nA, nB] of [
  [3, 4],
  [10, 10],
  [7, 9],
]) {
  const reference = simulateDifferences(nA, nB, 0.4, 0.4, 500, 178);
  const threshold = rejectionThreshold(reference, nA, nB, 0.05, 0.4);
  for (let a = 0; a <= nA; a++)
    for (let b = 0; b <= nB; b++) {
      const difference = b / nB - a / nA;
      assert.equal(
        threshold !== null && Math.abs(difference) + 1e-12 >= threshold,
        monteCarloP(reference, difference).p <= 0.05,
        "Every attainable point in the displayed rejection region must match the actual inclusive-tail decision.",
      );
    }
}
const distribution = simulateDifferences(2, 2, 0.5, 0.5, 20000, 91);
const average = distribution.reduce((s, v) => s + v, 0) / distribution.length;
const variance =
  distribution.reduce((s, v) => s + (v - average) ** 2, 0) /
  distribution.length;
assert.ok(Math.abs(average) < 0.015);
assert.ok(
  Math.abs(variance - 0.25) < 0.015,
  "Difference of independent binomial rates has variance p(1-p)(1/nA+1/nB).",
);
assert.deepEqual(
  simulateDifferences(50, 30, 0.4, 0.6, 100, 14),
  simulateDifferences(50, 30, 0.4, 0.6, 100, 14),
);
assert.deepEqual(simulateDifferences(10, 12, 0, 0, 20, 3), Array(20).fill(0));
const large = simulateDifferences(1000, 1000, 0.4, 0.4, 20000, 91);
const largeMean = large.reduce((s, v) => s + v, 0) / large.length;
const largeVariance =
  large.reduce((s, v) => s + (v - largeMean) ** 2, 0) / large.length;
assert.ok(Math.abs(largeMean) < 0.001);
assert.ok(
  Math.abs(largeVariance - 0.00048) < 0.000025,
  "The exact inverse-binomial sampler must retain the correct large-group variance.",
);
assert.deepEqual(
  simulateDifferences(1000, 1000, 1, 1, 20, 3),
  Array(20).fill(0),
);
const experiments = repeatedExperiments({
  nA: 80,
  nB: 80,
  base: 0.4,
  effect: 0.2,
  repetitions: 3000,
  trials: 1500,
  alpha: 0.05,
  seed: 2027,
});
assert.ok(
  experiments.falsePositives / experiments.trials < 0.09,
  "The calibrated null rejection rate should remain near or below alpha, allowing finite simulation variation.",
);
assert.ok(experiments.falsePositives > 0);
assert.ok(
  experiments.detected / experiments.trials > 0.65,
  "A large real effect should usually be detected.",
);
assert.equal(experiments.detected + experiments.missed, experiments.trials);
const conservative = repeatedExperiments({
  nA: 80,
  nB: 80,
  base: 0.4,
  effect: 0.2,
  repetitions: 3000,
  trials: 1500,
  alpha: 0.01,
  seed: 2027,
});
assert.ok(
  conservative.falsePositives <= experiments.falsePositives,
  "Lower alpha should not increase null rejections with identical draws.",
);
assert.ok(
  conservative.detected <= experiments.detected,
  "Lower alpha should not increase power with identical draws.",
);
console.log(
  "hypothesis-test: exact Bernoulli simulation, two-sided tails, ties, +1 p rule, reproducibility and error/power calibration passed",
);

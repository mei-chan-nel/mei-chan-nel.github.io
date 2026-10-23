import test from "node:test";
import assert from "node:assert/strict";
import { validateDocument } from "../shared/validation.mjs";
import {
  population,
  finiteSE,
  samplingSE,
  samplePopulation,
  simulateSample,
  newExperiment,
  normalizeExperiment,
  addTrials,
  samplingDomain,
  experimentSummary,
  comparisonSettings,
  compareSampleSizes,
} from "./model.mjs";
const near = (a, b, tolerance = 1e-12) =>
  assert.ok(
    Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(b)),
    `${a} != ${b}`,
  );

test("without-replacement draws are reproducible, unique and exact at a census", () => {
  const people = population(),
    first = samplePopulation(people, 20, "without", 17);
  assert.deepEqual(first, samplePopulation(people, 20, "without", 17));
  assert.equal(new Set(first.map((p) => p.id)).size, 20);
  const result = simulateSample(people, people.length, "without", 19);
  assert.equal(result.low, result.high);
  assert.equal(result.covers, true);
  assert.equal(
    samplingSE(
      people.map((p) => p.value),
      people.length,
      "without",
    ),
    0,
  );
});
test("with-replacement draws count repeated people and do not become a census at n=N", () => {
  const people = population(),
    s = addTrials(newExperiment({ n: people.length, method: "with" }), 99);
  validateDocument(
    { version: 1, id: "sampling", state: s },
    "sampling",
    newExperiment(),
  );
  assert.equal(s.last.length, people.length);
  assert.ok(new Set(s.last).size < people.length);
  const lookup = new Map(people.map((p) => [p.id, p.value]));
  near(
    s.history.at(-1).mean,
    s.last.reduce((sum, id) => sum + lookup.get(id), 0) / s.n,
  );
  assert.ok(s.history.every((r) => r.high > r.low));
  assert.ok(new Set(s.history.map((r) => r.mean)).size > 1);
  assert.deepEqual(s.last, addTrials(s, s.trials, true).last);
});
test("standard errors use the finite-population correction only without replacement", () => {
  near(finiteSE([0, 2], 1), 1);
  assert.equal(finiteSE([0, 2], 2), 0);
  assert.ok(Number.isNaN(finiteSE([0, 2], 3)));
  near(samplingSE([0, 2], 2, "with"), Math.SQRT1_2);
  near(samplingSE([0, 2], 1, "with"), 1);
  for (const n of [5, 20, 60, 120]) {
    const values = population().map((p) => p.value);
    assert.ok(
      samplingSE(values, n, "with") >= samplingSE(values, n, "without"),
    );
  }
});
test("both uniform methods center near truth and match their own theoretical spread", () => {
  const people = population(),
    values = people.map((p) => p.value),
    truth = values.reduce((a, b) => a + b, 0) / values.length;
  for (const method of ["without", "with"]) {
    const history = Array.from({ length: 1500 }, (_, trial) =>
      simulateSample(people, 30, method, 31, trial),
    );
    const summary = experimentSummary(history, truth);
    assert.ok(Math.abs(summary.error) < 0.5);
    assert.ok(
      Math.abs(summary.spread / samplingSE(values, 30, method) - 1) < 0.12,
    );
    assert.ok(summary.coverage > 0.9 && summary.coverage < 0.99);
  }
});
test("replay exactly preserves estimates, repeated draws and counts for both methods", () => {
  for (const method of ["without", "with"]) {
    const s = addTrials(newExperiment({ method }), 99);
    assert.deepEqual(addTrials(s, s.trials, true), s);
    assert.equal(s.history.length, 100);
  }
});
test("a narrow common axis expands equally to both sides when observed intervals exceed it", () => {
  const values = population().map((p) => p.value),
    n = 20,
    se = samplingSE(values, n, "without"),
    d = samplingDomain(values, n);
  near((d.xmin + d.xmax) / 2, d.truth);
  assert.ok(
    d.xmax - d.xmin < 40,
    "initial scale is much narrower than the former possible-sample bounds",
  );
  const centered = {
    mean: d.truth,
    low: d.truth - 1.96 * se,
    high: d.truth + 1.96 * se,
  };
  assert.deepEqual(samplingDomain(values, n, [centered]), d);
  const extreme = {
    mean: d.truth + 7 * se,
    low: d.truth + 5 * se,
    high: d.truth + 9 * se,
  };
  const expanded = samplingDomain(values, n, [centered, extreme]);
  assert.ok(expanded.xmax > d.xmax);
  near(d.xmin - expanded.xmin, expanded.xmax - d.xmax);
  near((expanded.xmin + expanded.xmax) / 2, d.truth);
  assert.ok(extreme.high < expanded.xmax);
  assert.ok(centered.low > expanded.xmin);
  assert.deepEqual(
    samplingDomain(values, n, [centered, extreme, centered]),
    expanded,
  );
  for (const method of ["without", "with"]) {
    const s = addTrials(newExperiment({ method }), 199),
      domain = samplingDomain(values, s.n, s.history, method);
    for (const r of s.history) {
      assert.ok(r.low > domain.xmin);
      assert.ok(r.high < domain.xmax);
    }
  }
  assert.ok(samplingDomain([0, 0], 2).xmax > samplingDomain([0, 0], 2).xmin);
});
test("coverage summaries count every trial and distinguish misses", () => {
  const s = experimentSummary(
    [
      { mean: 2, low: 1, high: 3 },
      { mean: 5, low: 4, high: 6 },
      { mean: 3, low: 2, high: 4 },
    ],
    3,
  );
  assert.equal(s.covered, 2);
  assert.equal(s.missed, 1);
  assert.equal(s.coverage, 2 / 3);
  near(s.center, 10 / 3);
  near(s.rmse, Math.sqrt(5 / 3));
  assert.equal(experimentSummary([], 3).coverage, null);
  assert.equal(
    experimentSummary([{ mean: 3, low: 3, high: 3 }], 3).spread,
    null,
  );
});
test("decimal-valued censuses remain exact only for the without-replacement method", () => {
  const customPopulation = [0.1, 0.2, 0.4, 0.8].map((value, id) => ({
    id,
    value,
  }));
  const s = addTrials(
      newExperiment({ customPopulation, n: 4, method: "without" }),
      99,
    ),
    truth = customPopulation.reduce((a, p) => a + p.value, 0) / 4;
  for (const r of s.history) {
    assert.equal(r.mean, truth);
    assert.equal(r.low, truth);
    assert.equal(r.high, truth);
    assert.equal(r.covers, true);
  }
  assert.equal(experimentSummary(s.history, truth).coverage, 1);
});
test("legacy group data retains every measured value while restarting its obsolete sampling scheme", () => {
  const customPopulation = [10, 20, 90].map((value, id) => ({
    id,
    value,
    frequent: id === 2,
  }));
  const old = {
    ...newExperiment({ customPopulation }),
    method: "biased",
    groupNames: ["A", "B"],
    groupLabel: "群",
    signature: "legacy",
    dataInfo: {
      name: "自分の値",
      origin: "user",
      columns: ["値", "群"],
      baseline: [
        [10, "A"],
        [20, "A"],
        [90, "B"],
      ],
    },
  };
  const next = normalizeExperiment(old);
  assert.equal(next.method, "without");
  assert.equal(next.trials, 1);
  assert.deepEqual(
    next.customPopulation,
    customPopulation.map(({ id, value }) => ({ id, value })),
  );
  assert.equal(next.groupNames, undefined);
  assert.deepEqual(next.dataInfo.columns, ["値"]);
  assert.deepEqual(next.dataInfo.baseline, [[10], [20], [90]]);
  assert.equal(next.dataInfo.origin, "user");
});

test("single and paired views share the same trial count, draw sequence and actual intervals", () => {
  for (const method of ["without", "with"]) {
    const initial = newExperiment({
      method,
      compareSamples: true,
      compareN: 40,
    });
    const first = compareSampleSizes(initial);
    assert.equal(first.trials, 1);
    assert.deepEqual(first.sizes, [20, 40]);
    assert.equal(first.series[0].summary.spread, null);
    assert.deepEqual(first.series[0].history, initial.history);
    const state = addTrials(initial, 199),
      comparison = compareSampleSizes(state),
      people = population();
    for (const series of comparison.series) {
      assert.equal(series.history.length, 200);
      for (const trial of [0, 19, 199]) {
        const { indices, ...expected } = simulateSample(
          people,
          series.n,
          method,
          state.seed,
          trial,
        );
        assert.deepEqual(series.history[trial], expected);
      }
      assert.ok(Math.abs(series.summary.spread / series.se - 1) < 0.15);
    }
    assert.deepEqual(comparison.series[0].history, state.history);
    const [a, b] = comparison.series;
    near(b.se / a.se, method === "with" ? 1 / Math.sqrt(2) : Math.sqrt(0.4));
    assert.ok(b.summary.spread < a.summary.spread);
  }
});
test("both sample sizes extend together and every interval fits one centered scale", () => {
  const state = addTrials(newExperiment({ compareN: 40 }), 199),
    before = compareSampleSizes(state),
    after = compareSampleSizes(addTrials(state, 100));
  for (let i = 0; i < 2; i++) {
    assert.deepEqual(
      after.series[i].history.slice(0, 200),
      before.series[i].history,
    );
    for (const result of after.series[i].history) {
      assert.ok(result.low > after.domain.xmin);
      assert.ok(result.high < after.domain.xmax);
    }
  }
  near((after.domain.xmin + after.domain.xmax) / 2, after.domain.truth);
  assert.ok(
    after.domain.xmin <= before.domain.xmin &&
      after.domain.xmax >= before.domain.xmax,
  );
});
test("changing sampling conditions restarts both estimates and interval histories at trial one", () => {
  const state = addTrials(
    newExperiment({ compareN: 40, compareSamples: true }),
    1999,
  );
  for (const patch of [
    { n: 21 },
    { compareN: 41 },
    { method: "with" },
    { seed: 3 },
    { compareSamples: false },
  ]) {
    const next = newExperiment({ ...state, ...patch }),
      comparison = compareSampleSizes(next);
    assert.equal(next.trials, 1);
    assert.equal(next.history.length, 1);
    assert.ok(comparison.series.every((s) => s.history.length === 1));
    assert.equal(next.compareN, patch.compareN || 40);
  }
});
test("comparison redraws reuse results and invalidate them for changed conditions or counts", () => {
  const state = addTrials(newExperiment({ compareN: 40 }), 99),
    result = compareSampleSizes(state);
  assert.equal(compareSampleSizes({ ...state }), result);
  for (const patch of [
    { seed: 5 },
    { method: "with" },
    { n: 10 },
    { compareN: 60 },
    {
      customPopulation: population().map((p) => ({
        ...p,
        value: p.value + 10,
      })),
    },
  ])
    assert.notDeepEqual(
      compareSampleSizes(newExperiment({ ...state, ...patch })),
      result,
    );
  assert.notEqual(compareSampleSizes(addTrials(state, 1)), result);
});
test("paired small populations handle equal sizes, census widths and constant values", () => {
  const customPopulation = [0.1, 0.2, 0.4].map((value, id) => ({ id, value })),
    state = addTrials(newExperiment({ customPopulation }), 99),
    comparison = compareSampleSizes(state);
  assert.deepEqual(comparisonSettings(state).sizes, [3, 3]);
  assert.deepEqual(comparison.series[0], comparison.series[1]);
  assert.equal(comparison.series[0].se, 0);
  assert.equal(comparison.series[0].summary.spread, 0);
  const constant = compareSampleSizes(
    addTrials(
      newExperiment({
        customPopulation: [
          { id: 0, value: 5 },
          { id: 1, value: 5 },
        ],
      }),
      99,
    ),
  );
  assert.equal(constant.series[0].summary.spread, 0);
  assert.ok(constant.domain.xmax > constant.domain.xmin);
});
test("comparison settings preserve saved data and migrate the former separate comparison", () => {
  const old = newExperiment();
  validateDocument(
    { version: 1, id: "sampling", state: old },
    "sampling",
    newExperiment(),
  );
  const state = { ...old, compareSamples: true, compareN: 40 };
  validateDocument(
    { version: 1, id: "sampling", state },
    "sampling",
    newExperiment(),
  );
  assert.deepEqual(
    normalizeExperiment(JSON.parse(JSON.stringify(state))),
    state,
  );
  for (const patch of [
    { compareN: 0 },
    { compareN: 121 },
    { compareN: 1.5 },
    { compareSamples: "yes" },
  ])
    assert.throws(() =>
      validateDocument(
        { version: 1, id: "sampling", state: { ...state, ...patch } },
        "sampling",
        newExperiment(),
      ),
    );
  const legacy = { ...old, sizeComparison: { sizes: [20, 40], trials: 2000 } };
  validateDocument(
    { version: 1, id: "sampling", state: legacy },
    "sampling",
    newExperiment(),
  );
  const migrated = normalizeExperiment(legacy);
  assert.equal(migrated.compareN, 40);
  assert.equal(migrated.compareSamples, true);
  assert.equal(migrated.sizeComparison, undefined);
  assert.deepEqual(migrated.history, old.history);
  const small = newExperiment({
    ...state,
    customPopulation: [
      { id: 0, value: 1 },
      { id: 1, value: 2 },
    ],
  });
  assert.equal(small.compareN, 2);
});

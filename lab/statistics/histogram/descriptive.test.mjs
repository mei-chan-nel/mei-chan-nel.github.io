import test from "node:test";
import assert from "node:assert/strict";
import {
  describe,
  oneWayAnova,
  fSurvival,
  quartileRanks,
} from "./descriptive.mjs";
const near = (a, b, tol = 1e-11) =>
  assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} != ${b}`);
test("distribution statistics use median-of-halves quartiles and distinguish fences from actual whiskers", () => {
  const d = describe([10, 11, 12, 13, 14, 15, 16, 100]);
  assert.equal(d.q1, 11.5);
  assert.equal(d.q2, 13.5);
  assert.equal(d.q3, 15.5);
  assert.equal(d.lower, 10);
  assert.equal(d.upper, 16);
  assert.deepEqual(d.outliers, [100]);
  assert.deepEqual(describe([9]).outliers, []);
  assert.equal(describe([9]).sampleVariance, null);
  assert.equal(describe([1, 2, 3, 4, 5]).q1, 1.5);
  assert.equal(describe([1, 2, 3, 4, 5]).q3, 4.5);
  assert.deepEqual(describe([1, 1, 1, 1, 1, 1, 1, 9]).outliers, [9]);
  near(describe([1, 2, 3]).variance, 2 / 3);
  near(describe([1, 2, 3]).sampleVariance, 1);
});
test("ANOVA decomposes unequal groups around the weighted grand mean", () => {
  const rows = [
    ...[1, 2, 3].map((value) => ({ group: "A", value })),
    ...[4, 5].map((value) => ({ group: "B", value })),
  ];
  const a = oneWayAnova(rows);
  near(a.total.mean, 3);
  near(a.between, 7.5);
  near(a.within, 2.5);
  near(a.total.ss, 10);
  assert.equal(a.dfBetween, 1);
  assert.equal(a.dfWithin, 3);
  assert.equal(a.dfTotal, 4);
  near(a.f, 9);
  near(a.p, 0.0576688856224373);
  const shifted = oneWayAnova(
    rows.map((r) => ({ ...r, value: 100000 + 7 * r.value })),
  );
  near(shifted.f, a.f);
  near(shifted.p, a.p);
  near(shifted.total.ss, shifted.between + shifted.within);
});
test("ANOVA handles several groups, no between-group effect and degenerate inputs", () => {
  const rows = ["A", "B", "C"].flatMap((group) =>
    [1, 2, 3].map((value) => ({ group, value })),
  );
  const a = oneWayAnova(rows);
  assert.equal(a.f, 0);
  assert.equal(a.p, 1);
  assert.equal(a.dfBetween, 2);
  for (const data of [
    [{ group: "A", value: 1 }],
    [
      { group: "A", value: 1 },
      { group: "B", value: 2 },
    ],
    [
      { group: "A", value: 1 },
      { group: "A", value: 1 },
      { group: "B", value: 2 },
      { group: "B", value: 2 },
    ],
  ]) {
    const x = oneWayAnova(data);
    assert.equal(x.available, false);
    assert.equal(x.f, null);
    assert.equal(x.p, null);
    assert.ok(x.reason);
  }
});
test("F upper tails match exact simple distributions and preserve small probabilities", () => {
  near(fSurvival(9, 1, 3), 0.0576688856224373);
  near(fSurvival(4, 2, 2), 0.2);
  near(fSurvival(3, 1, 1), 1 / 3);
  near(fSurvival(100, 2, 10), (10 / (10 + 2 * 100)) ** 5);
  assert.equal(fSurvival(0, 1, 10), 1);
  assert.equal(fSurvival(Infinity, 1, 10), 0);
  assert.equal(fSurvival(1, 1, 0), null);
});

test("overlapping teaching samples put one fast B pupil inside A's hill without high-side outliers", async () => {
  const { default: config } = await import("./lab.mjs");
  const { sampleState } = await import("../shared/samples.mjs");
  for (let seed = 0; seed < 200; seed++) {
    const s = sampleState("histogram", config.initial(), seed);
    assert.equal(s.rows.length, 60);
    assert.equal(s.width, 5);
    assert.equal(s.mode, "split");
    const a = describe(
      s.rows.filter((r) => r.group === "A").map((r) => r.value),
    );
    const b = describe(
      s.rows.filter((r) => r.group === "B").map((r) => r.value),
    );
    assert.equal(a.n, 30);
    assert.equal(b.n, 30);
    assert.deepEqual(a.outliers, [], `${seed}: A`);
    assert.equal(b.outliers.length, 1, `${seed}: B`);
    assert.ok(b.outliers[0] < b.lowerFence, `${seed}: fast B pupil`);
    assert.ok(
      b.outliers[0] >= a.q1 && b.outliers[0] <= a.q3,
      `${seed}: inside A's hill`,
    );
    assert.ok(b.lower < a.max, `${seed}: the ordinary groups overlap too`);
    assert.ok(a.q3 < b.q1, `${seed}: distinct centres`);
    for (const d of [a, b]) {
      const middle = d.sorted.filter((v) => Math.abs(v - d.q2) <= 4).length;
      assert.ok(middle > d.sorted.filter((v) => v < d.q2 - 4).length);
      assert.ok(middle > d.sorted.filter((v) => v > d.q2 + 4).length);
    }
  }
});
test("table edits preserve the selected histogram width and old saved records remain valid", async () => {
  const { default: config } = await import("./lab.mjs");
  const { sampleState } = await import("../shared/samples.mjs");
  const { currentData } = await import("../shared/data-model.mjs");
  const { applyTableRows } = await import("../shared/table-data.mjs");
  const { validateDocument } = await import("../shared/validation.mjs");
  const s = { ...sampleState("histogram", config.initial(), 1), width: 7 };
  const data = currentData("histogram", s),
    rows = data.rows.map((row) => row.map(String));
  rows.at(-1)[0] = String(Number(rows.at(-1)[0]) + 1);
  const next = applyTableRows("histogram", s, data, rows);
  assert.equal(next.width, 7);
  delete next.calcKind;
  delete next.calcGroup;
  delete next.varianceSample;
  validateDocument(
    { version: 1, id: "histogram", state: next },
    "histogram",
    config.initial(),
  );
});

test("quartile source ranks identify the exact observations for odd, even and single values", () => {
  const fixtures = [
    [1, { q1: [1], q2: [1], q3: [1] }],
    [2, { q1: [1], q2: [1, 2], q3: [2] }],
    [3, { q1: [1], q2: [2], q3: [3] }],
    [5, { q1: [1, 2], q2: [3], q3: [4, 5] }],
    [6, { q1: [2], q2: [3, 4], q3: [5] }],
    [60, { q1: [15, 16], q2: [30, 31], q3: [45, 46] }],
  ];
  for (const [count, expected] of fixtures) {
    assert.deepEqual(quartileRanks(count), expected);
    const values = Array.from({ length: count }, (_, i) => (i + 1) ** 2);
    const d = describe(values);
    for (const key of ["q1", "q2", "q3"]) {
      const ranks = quartileRanks(count)[key];
      near(
        ranks.reduce((total, rank) => total + values[rank - 1], 0) /
          ranks.length,
        d[key],
      );
    }
  }
  assert.deepEqual(quartileRanks(0), { q1: [], q2: [], q3: [] });
});

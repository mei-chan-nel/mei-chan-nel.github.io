import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyWorkbook,
  presetWorkbook,
  presetExample,
  fillExample,
  parseWorkbook,
  ranking,
  comparison,
  simulate,
  canSimulate,
  simulationChanged,
  markEdited,
  causeForNode,
  descendants,
  report,
} from "../lab/thinking-tools/model.mjs";

test("free mode starts completely empty and both modes round-trip through files", () => {
  const s = emptyWorkbook();
  for (const k of [
    "cards",
    "groups",
    "factors",
    "causes",
    "nodes",
    "criteria",
    "checks",
    "records",
    "kpt",
  ])
    assert.deepEqual(s[k], []);
  assert.ok(Object.values(s.problem).every((v) => v === ""));
  assert.equal(comparison(s).before, null);
  assert.equal(comparison(s).after, null);
  for (const workbook of [s, presetWorkbook()])
    assert.deepEqual(parseWorkbook(JSON.stringify(workbook)), workbook);
});
test("weights change the ranking and missing scores are not counted as zero", () => {
  const s = presetExample();
  s.criteria.forEach((c) => (c.weight = 1));
  s.criteria[0].weight = 5;
  assert.equal(ranking(s)[0].node.strategy, "display");
  s.criteria[0].weight = 1;
  s.criteria[1].weight = 5;
  assert.equal(ranking(s)[0].node.strategy, "labels");
  delete s.nodes.find((n) => n.strategy === "labels").ratings["v-0"];
  assert.equal(
    ranking(s).find((r) => r.node.strategy === "labels").score,
    null,
  );
});
test("node branches inherit the cause, and descendants identify invalid parent targets", () => {
  const s = presetExample();
  const n = s.nodes.find((n) => n.strategy === "photos");
  assert.equal(causeForNode(s, n).id, "h-notice");
  assert.ok(descendants(s, "n-notice").has(n.id));
  assert.ok(!descendants(s, n.id).has("n-notice"));
});
test("each preset decision creates distinct results and marks them as fictional", () => {
  const outcomes = new Set();
  for (const strategy of ["display", "photos", "announce", "labels"]) {
    const s = presetExample();
    s.selectedIdea = `n-${strategy}`;
    assert.equal(simulate(s), true);
    assert.equal(s.resultFor, s.selectedIdea);
    assert.equal(s.records.length, 4);
    outcomes.add(comparison(s).after);
    assert.match(report(s), /架空シミュレーション/);
    assert.equal(parseWorkbook(JSON.stringify(s)).simulation, strategy);
  }
  assert.equal(outcomes.size, 4);
});
test("simulation never fabricates results for free mode or changed topics, ideas or measures", () => {
  const blank = emptyWorkbook();
  assert.equal(simulate(blank), false);
  for (const modify of [
    (s) => (s.problem.title = "別の題材"),
    (s) => (s.measure.label = "別の指標"),
    (s) => (s.measure.kind = "value"),
    (s) => (s.measure.beforeTotal = 50),
    (s) => (s.nodes.find((n) => n.id === s.selectedIdea).text = "自分の対策"),
  ]) {
    const s = presetExample();
    s.selectedIdea = "n-display";
    modify(s);
    assert.equal(canSimulate(s), false);
    assert.equal(simulate(s), false);
    assert.deepEqual(s.records, []);
  }
});
test("rates aggregate raw counts; blank, partial and impossible rows stay unknown", () => {
  const s = emptyWorkbook();
  const row = (id, count, total) => ({
    id,
    label: "",
    count,
    total,
    value: null,
    note: "",
  });
  s.records = [row("a", 2, 5), row("b", 8, 10), row("c", null, null)];
  assert.equal(comparison(s).after, (100 * 10) / 15);
  s.records.push(row("d", 2, null));
  assert.equal(comparison(s).after, null);
  assert.equal(comparison(s).invalid, true);
  s.records = [row("a", 6, 5)];
  assert.equal(comparison(s).after, null);
  s.records = [row("a", 0, 5)];
  assert.equal(comparison(s).after, 0);
});
test("custom numerical metrics support averages, smaller-is-better and zero", () => {
  const s = emptyWorkbook();
  s.measure.kind = "value";
  s.measure.direction = "lower";
  s.measure.beforeValue = 8;
  s.measure.target = 4;
  s.records = [
    { id: "a", label: "day1", count: null, total: null, value: 0, note: "" },
    { id: "b", label: "day2", count: null, total: null, value: 6, note: "" },
  ];
  assert.deepEqual(comparison(s), {
    before: 8,
    after: 3,
    invalid: false,
    met: true,
    change: -5,
  });
});
test("upstream edits flag completed later stages without erasing work or results", () => {
  const s = presetExample();
  s.done.fill(true);
  s.selectedIdea = "n-display";
  simulate(s);
  const rows = structuredClone(s.records);
  markEdited(s, 1);
  assert.deepEqual(s.review, [false, false, true, true, true, true, true]);
  assert.deepEqual(s.records, rows);
  s.selectedIdea = "n-photos";
  assert.match(report(s), /以前選んだ対策/);
});
test("import rejects cycles, dangling references, invalid numbers and unsafe structures", () => {
  const mutations = [
    (s) => (s.nodes[0].parent = s.nodes[0].id),
    (s) => (s.nodes[0].parent = s.nodes[3].id),
    (s) => (s.causes[0].evidence = "missing"),
    (s) => (s.nodes[0].cause = "missing"),
    (s) => (s.cards[0].kind = "html"),
    (s) => (s.cards[0].group = "missing"),
    (s) => (s.nodes[0].ratings = { missing: 3 }),
    (s) => (s.nodes[0].ratings = { "v-0": 6 }),
    (s) => (s.criteria[0].weight = 0),
    (s) => (s.measure.beforeCount = -1),
    (s) => s.cards.push(s.cards[0]),
    (s) => (s.selectedIdea = "n-access"),
  ];
  for (const mutate of mutations) {
    const s = presetExample();
    mutate(s);
    assert.throws(() => parseWorkbook(JSON.stringify(s)));
  }
  assert.throws(() => parseWorkbook("{"));
  assert.throws(() => parseWorkbook(" ".repeat(2_000_001)));
  const s = presetExample();
  s.extra = "<script>";
  assert.equal(Object.hasOwn(parseWorkbook(JSON.stringify(s)), "extra"), false);
});
test("report covers all tools, measurement conditions, ratings and KPT evidence", () => {
  const s = presetExample();
  s.kpt = [{ id: "k", kind: "try", text: "次の試行", source: "比較した記録" }];
  const output = report(s);
  for (const value of [
    "1. 問題",
    "2. 現状",
    "3. 原因",
    "4. 解決策",
    "5. 解決策",
    "6. 実行",
    "7. 評価",
    "次の試行",
    "比較した記録",
    "測定条件",
    "個人情報への配慮",
  ])
    assert.ok(output.includes(value));
});

test("editing a simulated topic or decision keeps the result and flags its source", () => {
  const s = presetExample();
  s.selectedIdea = "n-display";
  simulate(s);
  assert.equal(simulationChanged(s), false);
  const records = structuredClone(s.records);
  s.nodes.find((n) => n.id === s.resultFor).text = "別の対策";
  assert.equal(simulationChanged(s), true);
  assert.deepEqual(s.records, records);
  assert.match(report(s), /編集前の題材・案・指標/);
});

test("preset also starts with empty content and examples progress without overwriting edits", () => {
  const s = presetWorkbook();
  assert.equal(s.problem.title, "");
  assert.deepEqual(s.cards, []);
  assert.deepEqual(s.nodes, []);
  s.problem.who = "自分の観点";
  assert.equal(fillExample(s, "context"), true);
  assert.equal(s.problem.who, "自分の観点");
  assert.equal(s.measure.beforeCount, null);
  assert.equal(fillExample(s, "context"), false);
  for (const id of [
    "gap",
    "question",
    "cards",
    "groups",
    "relations",
    "synthesis",
    "causes",
    "tests",
    "branches",
    "criteria",
    "scores",
  ])
    assert.equal(fillExample(s, id), true, id);
  assert.equal(
    s.factors.find((f) => f.group === "g-recognize").title,
    s.groups[0].title,
  );
  assert.equal(s.cards.find((c) => c.id === "c-work").group, "");
  assert.equal(s.causes.find((c) => c.id === "h-time").evidence, "c-time");
  s.selectedIdea = "n-photos";
  assert.equal(fillExample(s, "plan"), true);
  assert.match(s.plan.test, /写真一覧/);
  for (const id of ["checks", "results", "kpt", "next"])
    assert.equal(fillExample(s, id), true, id);
  assert.equal(comparison(s).after, 67.5);
  assert.match(s.kpt.find((k) => k.kind === "problem").text, /65分/);
  assert.deepEqual(parseWorkbook(JSON.stringify(s)), s);
});
test("guided actions cannot invent prerequisites or overwrite results", () => {
  const s = presetWorkbook();
  for (const id of [
    "groups",
    "relations",
    "tests",
    "scores",
    "plan",
    "results",
    "kpt",
    "next",
  ])
    assert.equal(fillExample(s, id), false, id);
  for (const id of [
    "context",
    "gap",
    "cards",
    "causes",
    "branches",
    "criteria",
    "scores",
  ])
    fillExample(s, id);
  s.selectedIdea = "n-display";
  s.records = [
    {
      id: "own",
      label: "自分の結果",
      count: 1,
      total: 2,
      value: null,
      note: "",
    },
  ];
  assert.equal(fillExample(s, "results"), false);
  assert.equal(s.records[0].id, "own");
  assert.equal(fillExample(emptyWorkbook(), "context"), false);
});
test("old files migrate without replacing work; KJ hierarchy and relation references are bounded", () => {
  const old = presetExample();
  old.version = 1;
  delete old.examples;
  delete old.relations;
  delete old.synthesis;
  old.factors.forEach((f) => delete f.group);
  old.problem.title = "以前の作業";
  const migrated = parseWorkbook(JSON.stringify(old));
  assert.equal(migrated.version, 2);
  assert.equal(migrated.problem.title, "以前の作業");
  assert.deepEqual(migrated.relations, []);
  const s = presetWorkbook();
  fillExample(s, "cards");
  fillExample(s, "groups");
  fillExample(s, "relations");
  s.groups[0].parent = s.groups[1].id;
  s.groups[1].parent = s.groups[0].id;
  assert.throws(() => parseWorkbook(JSON.stringify(s)));
  s.groups.forEach((g) => (g.parent = ""));
  s.relations[0].to = "missing";
  assert.throws(() => parseWorkbook(JSON.stringify(s)));
});

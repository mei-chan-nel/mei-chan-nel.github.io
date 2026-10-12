import test from "node:test";
import assert from "node:assert/strict";
import {
  presetActive,
  togglePreset,
  removeItem,
  changeNotes,
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
  brainstormToCards,
  stageSummary,
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
  assert.equal(migrated.version, 3);
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

test("preset writes one field or card, can be cleared after reload, and preserves other edits", () => {
  let s = presetWorkbook();
  assert.equal(togglePreset(s, "field:problem.title").ok, true);
  assert.equal(s.problem.who, "");
  assert.deepEqual(s.cards, []);
  s.problem.who = "自分で考えた対象";
  s = parseWorkbook(JSON.stringify(s));
  assert.equal(togglePreset(s, "field:problem.title").cleared, true);
  assert.equal(s.problem.title, "");
  assert.equal(s.problem.who, "自分で考えた対象");
  assert.equal(togglePreset(s, "field:problem.who").ok, false);
  togglePreset(s, "card:c-known");
  assert.equal(s.cards.length, 1);
  togglePreset(s, "card:c-time");
  assert.equal(s.cards.length, 2);
  togglePreset(s, "card:c-known");
  assert.deepEqual(
    s.cards.map((c) => c.id),
    ["c-time"],
  );
  assert.deepEqual(parseWorkbook(JSON.stringify(s)), s);
});
test("group preset only gathers its own loaded cards; clearing preserves cards and another grouping", () => {
  const s = presetWorkbook();
  for (const id of ["c-known", "c-own", "c-time", "c-shame"])
    togglePreset(s, `card:${id}`);
  togglePreset(s, "group:recognize");
  assert.equal(s.groups.length, 1);
  assert.equal(s.cards.find((c) => c.id === "c-time").group, "");
  togglePreset(s, "group:access");
  togglePreset(s, "relation:awareness");
  assert.equal(s.relations.length, 1);
  togglePreset(s, "group:recognize");
  assert.equal(s.cards.length, 4);
  assert.equal(s.cards.find((c) => c.id === "c-known").group, "");
  assert.equal(s.cards.find((c) => c.id === "c-time").group, "g-access");
  assert.deepEqual(
    s.groups.map((g) => g.id),
    ["g-access"],
  );
  assert.equal(s.relations.length, 0);
  assert.deepEqual(parseWorkbook(JSON.stringify(s)), s);
});
test("diagram presets add one shape with explicit parent; clearing cleans references and keeps descendants", () => {
  const s = presetWorkbook();
  togglePreset(s, "factor:f-info");
  assert.equal(s.causes.length, 0);
  togglePreset(s, "cause:h-notice", { factor: "f-info" });
  assert.equal(s.causes[0].test, "");
  togglePreset(s, "branch:n-notice");
  assert.equal(s.nodes.length, 1);
  togglePreset(s, "branch:n-photos", { parent: "n-notice" });
  assert.equal(s.nodes[1].parent, "n-notice");
  assert.deepEqual(s.nodes[1].ratings, {});
  togglePreset(s, "cause:h-notice", { factor: "f-info" });
  assert.equal(s.nodes[0].cause, "");
  togglePreset(s, "branch:n-notice");
  assert.equal(s.nodes.length, 1);
  assert.equal(s.nodes[0].parent, "");
  assert.deepEqual(parseWorkbook(JSON.stringify(s)), s);
});
test("score and weekly-result presets are independent, reversible, and retain provenance", () => {
  const s = presetWorkbook();
  for (const id of ["context", "gap", "branches"]) fillExample(s, id);
  s.nodes.forEach((n) => (n.ratings = {}));
  togglePreset(s, "criterion:v-0");
  togglePreset(s, "criterion:v-1");
  const path = "nodes.n-display.ratings.v-0";
  const before = structuredClone(s);
  togglePreset(s, `field:${path}`);
  assert.deepEqual(s.nodes.find((n) => n.id === "n-display").ratings, {
    "v-0": 5,
  });
  assert.equal(changeNotes(before, s, 4)[0].path, path);
  const loaded = parseWorkbook(JSON.stringify(s));
  togglePreset(loaded, `field:${path}`);
  assert.equal(
    loaded.nodes.find((n) => n.id === "n-display").ratings["v-0"],
    null,
  );
  s.selectedIdea = "n-display";
  togglePreset(s, "record:0");
  assert.equal(s.records.length, 1);
  togglePreset(s, "record:1");
  assert.equal(s.records.length, 2);
  assert.equal(s.observation, "");
  togglePreset(s, "record:0");
  assert.equal(s.records.length, 1);
  assert.equal(s.records[0].id, "record-1");
  assert.equal(s.simulation, "display");
  assert.deepEqual(parseWorkbook(JSON.stringify(s)), s);
});
test("upstream review identifies the exact changed field and merges successive edits", () => {
  const s = presetWorkbook();
  s.done.fill(true);
  const before = structuredClone(s);
  s.problem.question = "受け取り可能な時間を調べる";
  markEdited(s, 0, changeNotes(before, s, 0));
  const note = s.reviewNotes[2][0];
  assert.equal(note.path, "problem.question");
  assert.equal(note.before, "空欄");
  assert.equal(note.after, s.problem.question);
  assert.equal(note.label, "調査で確かめること");
  const earlier = structuredClone(s);
  s.problem.question = "昼休みと放課後を比較する";
  markEdited(s, 0, changeNotes(earlier, s, 0));
  assert.equal(s.reviewNotes[2].length, 1);
  assert.equal(s.reviewNotes[2][0].before, "空欄");
  assert.equal(s.reviewNotes[2][0].after, s.problem.question);
  assert.deepEqual(parseWorkbook(JSON.stringify(s)), s);
});
test("v2 files keep manual work and regain field toggles; malformed restoration targets are rejected", () => {
  const old = presetWorkbook();
  fillExample(old, "context");
  old.problem.who = "手動編集を保存";
  old.version = 2;
  delete old.presetWrites;
  delete old.reviewNotes;
  const s = parseWorkbook(JSON.stringify(old));
  assert.equal(s.version, 3);
  assert.equal(togglePreset(s, "field:problem.title").cleared, true);
  assert.equal(s.problem.who, "手動編集を保存");
  assert.equal(togglePreset(s, "field:problem.who").ok, false);
  const valid = presetWorkbook();
  togglePreset(valid, "field:problem.title");
  for (const path of ["cards", "problem.__proto__", "nodes.x.ratings.v-0"]) {
    const invalid = structuredClone(valid);
    invalid.presetWrites[0].fields[0].path = path;
    assert.throws(() => parseWorkbook(JSON.stringify(invalid)));
  }
  const invalid = structuredClone(valid);
  invalid.presetWrites[0].fields[0].before = 3;
  assert.throws(() => parseWorkbook(JSON.stringify(invalid)));
});

test("deleting a criterion drops its preset score history and remains resumable", () => {
  const s = presetWorkbook();
  togglePreset(s, "branch:n-access");
  togglePreset(s, "branch:n-display", { parent: "n-access" });
  togglePreset(s, "criterion:v-0");
  togglePreset(s, "field:nodes.n-display.ratings.v-0");
  removeItem(s, "criteria", "v-0");
  assert.equal(
    s.presetWrites.some((w) => w.id === "field:nodes.n-display.ratings.v-0"),
    false,
  );
  assert.deepEqual(parseWorkbook(JSON.stringify(s)), s);
});
test("previous complete v2 workbook migrates local toggles for grouping, results and KPT", () => {
  const old = presetWorkbook();
  for (const id of [
    "context",
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
    fillExample(old, id);
  old.selectedIdea = "n-display";
  for (const id of ["plan", "checks", "results", "kpt", "next"])
    fillExample(old, id);
  old.version = 2;
  delete old.presetWrites;
  delete old.reviewNotes;
  const s = parseWorkbook(JSON.stringify(old));
  assert.deepEqual(parseWorkbook(JSON.stringify(s)), s);
  assert.equal(s.records.length, 4);
  assert.equal(s.records[0].id, "record-0");
  togglePreset(s, "record:0");
  assert.equal(s.records.length, 3);
  togglePreset(s, "kpt:try");
  assert.equal(s.kpt.length, 2);
  togglePreset(s, "group:recognize");
  assert.equal(s.groups.length, 1);
  assert.equal(s.cards.length, 9);
  assert.deepEqual(parseWorkbook(JSON.stringify(s)), s);
});

test("one context or gap preset fills its item, highlights every change, and preserves manual input", () => {
  const s = presetWorkbook();
  s.problem.who = "自分で記入した対象";
  const r = togglePreset(s, "block:context");
  assert.equal(r.ok, true);
  assert.equal(r.paths.length, 6);
  assert.equal(s.problem.who, "自分で記入した対象");
  assert.equal(s.problem.current, "");
  assert.equal(s.cards.length, 0);
  assert.equal(presetActive(s, "block:context"), true);
  let loaded = parseWorkbook(JSON.stringify(s));
  togglePreset(loaded, "block:context");
  assert.equal(loaded.problem.title, "");
  assert.equal(loaded.problem.who, "自分で記入した対象");
  const gap = togglePreset(s, "block:gap");
  assert.equal(comparison(s).before, 30);
  assert.equal(gap.derived.gap, true);
  assert.equal(gap.paths.length, 7);
  assert.equal(s.causes.length, 0);
  assert.equal(s.problem.question, "");
});
test("grouped cards and cause presets include all fields and references in the change outline", () => {
  const s = presetWorkbook();
  const cards = togglePreset(s, "block:cards");
  assert.equal(s.cards.length, 9);
  assert.equal(cards.rows.length, 9);
  assert.ok(cards.paths.includes("cards.c-total.text"));
  assert.ok(cards.paths.includes("cards.c-total.kind"));
  assert.ok(cards.paths.includes("cards.c-total.source"));
  const grouped = togglePreset(s, "block:groups");
  assert.equal(s.groups.length, 2);
  assert.ok(grouped.paths.includes("cards.c-known.group"));
  assert.ok(grouped.paths.includes("groups.g-recognize.title"));
  const cause = togglePreset(s, "block:causes");
  assert.equal(s.factors.length, 3);
  assert.equal(s.causes.length, 3);
  assert.ok(cause.paths.includes("causes.h-notice.evidence"));
  assert.ok(cause.paths.includes("causes.h-notice.status"));
  assert.ok(s.causes.every((c) => !c.test));
  togglePreset(s, "block:tests");
  assert.ok(s.causes.every((c) => c.test));
  assert.deepEqual(parseWorkbook(JSON.stringify(s)), s);
  const undo = togglePreset(s, "block:groups");
  assert.equal(s.groups.length, 0);
  assert.equal(s.cards.length, 9);
  assert.ok(undo.paths.includes("cards.c-known.group"));
  assert.deepEqual(parseWorkbook(JSON.stringify(s)), s);
});
test("a mind-map branch preset includes only one root family and undo retains manually added branches", () => {
  const s = presetWorkbook();
  const r = togglePreset(s, "branchset:n-notice");
  assert.deepEqual(
    s.nodes.map((n) => n.id),
    ["n-notice", "n-photos", "n-announce"],
  );
  assert.ok(r.paths.includes("nodes.n-photos.candidate"));
  assert.ok(r.paths.includes("nodes.n-photos.text"));
  s.nodes.push({
    id: "manual",
    parent: "n-notice",
    text: "自分の案",
    cause: "",
    candidate: false,
    strategy: "",
    ratings: {},
  });
  togglePreset(s, "branchset:n-notice");
  assert.deepEqual(
    s.nodes.map((n) => n.id),
    ["manual"],
  );
  assert.equal(s.nodes[0].parent, "");
  assert.deepEqual(parseWorkbook(JSON.stringify(s)), s);
});
test("the scoring and result item controls reduce clicks without filling another stage", () => {
  const s = presetWorkbook();
  for (const id of [
    "block:context",
    "block:gap",
    "branchset:n-access",
    "branchset:n-notice",
    "branchset:n-prevent",
    "block:criteria",
  ])
    togglePreset(s, id);
  const scores = togglePreset(s, "block:scores");
  assert.equal(scores.paths.filter((p) => p.includes(".ratings.")).length, 12);
  assert.equal(s.selectedIdea, "n-display");
  assert.ok(scores.paths.includes("selectedIdea"));
  assert.equal(scores.derived.matrix, true);
  assert.equal(s.plan.who, "");
  s.selectedIdea = "n-display";
  const results = togglePreset(s, "block:results");
  assert.equal(s.records.length, 4);
  assert.equal(comparison(s).after, 55);
  assert.equal(s.observation, "");
  assert.ok(!results.paths.includes("observation"));
  togglePreset(s, "field:observation");
  assert.ok(s.observation.includes("22/40"));
  assert.equal(results.derived.graph, true);
  assert.equal(s.kpt.length, 0);
  assert.ok(results.paths.includes("records.record-0.note"));

  const saved = parseWorkbook(JSON.stringify(s));
  togglePreset(saved, "block:results");
  assert.equal(saved.records.length, 0);
  assert.ok(saved.observation.includes("22/40"));
  togglePreset(saved, "field:observation");
  assert.equal(saved.observation, "");
  assert.equal(saved.simulation, "");
  togglePreset(s, "block:kpt");
  assert.equal(s.kpt.length, 3);
  assert.equal(s.next, "");
  assert.deepEqual(parseWorkbook(JSON.stringify(s)), s);
});
test("previous individual writes can be undone by their new item control after resume", () => {
  const s = presetWorkbook();
  togglePreset(s, "field:problem.title");
  togglePreset(s, "field:problem.who");
  s.problem.where = "手動の場所";
  const saved = parseWorkbook(JSON.stringify(s));
  assert.equal(presetActive(saved, "block:context"), true);
  const undo = togglePreset(saved, "block:context");
  assert.equal(undo.cleared, true);
  assert.equal(saved.problem.title, "");
  assert.equal(saved.problem.who, "");
  assert.equal(saved.problem.where, "手動の場所");
  assert.deepEqual(parseWorkbook(JSON.stringify(saved)), saved);
});
test("a grouped result cannot append another strategy's notes to previous records", () => {
  const s = presetWorkbook();
  for (const id of [
    "block:context",
    "block:gap",
    "branchset:n-access",
    "branchset:n-notice",
  ])
    togglePreset(s, id);
  s.selectedIdea = "n-display";
  togglePreset(s, "block:results");
  // Existing results may be imported without a reversible preset receipt.
  s.presetWrites = [];
  s.observation = "";
  s.selectedIdea = "n-photos";
  const before = structuredClone(s);
  assert.equal(togglePreset(s, "block:results").ok, false);
  assert.deepEqual(s, before);
});

test("KJ diagram display is independently reversible and survives resume without changing grouping", () => {
  const s = presetWorkbook();
  assert.equal(togglePreset(s, "block:diagram").ok, false);
  togglePreset(s, "block:cards");
  togglePreset(s, "block:groups");
  assert.equal(s.kjDiagramReady, false);
  const groups = structuredClone(s.groups),
    cards = structuredClone(s.cards);
  assert.equal(togglePreset(s, "block:diagram").ok, true);
  assert.equal(s.kjDiagramReady, true);
  const saved = parseWorkbook(JSON.stringify(s));
  assert.equal(presetActive(saved, "block:diagram"), true);
  togglePreset(saved, "block:diagram");
  assert.equal(saved.kjDiagramReady, false);
  assert.deepEqual(saved.groups, groups);
  assert.deepEqual(saved.cards, cards);
});
test("previous grouped results migrate to independent observation and diagram controls", () => {
  const s = presetWorkbook();
  for (const id of [
    "block:context",
    "block:gap",
    "block:cards",
    "block:groups",
    "branchset:n-access",
    "block:criteria",
    "block:scores",
    "block:results",
    "field:observation",
  ])
    togglePreset(s, id);
  const legacy = structuredClone(s);
  delete legacy.kjDiagramReady;
  const note = legacy.presetWrites.find((w) => w.id === "field:observation");
  legacy.presetWrites
    .find((w) => w.id === "block:results")
    .fields.push(...note.fields);
  legacy.presetWrites = legacy.presetWrites.filter(
    (w) => w.id !== "field:observation",
  );
  const loaded = parseWorkbook(JSON.stringify(legacy));
  assert.equal(loaded.kjDiagramReady, true);
  assert.equal(presetActive(loaded, "block:diagram"), true);
  assert.equal(presetActive(loaded, "field:observation"), true);
  togglePreset(loaded, "block:results");
  assert.equal(loaded.records.length, 0);
  assert.equal(loaded.observation, s.observation);
  togglePreset(loaded, "field:observation");
  assert.equal(loaded.observation, "");
  assert.equal(loaded.simulation, "");
  assert.deepEqual(parseWorkbook(JSON.stringify(loaded)), loaded);
  assert.throws(() =>
    parseWorkbook(JSON.stringify({ ...s, kjDiagramReady: "true" })),
  );
});
test("a manually selected trial remains selected through preset scoring and undo", () => {
  const s = presetWorkbook();
  togglePreset(s, "branchset:n-access");
  togglePreset(s, "branchset:n-notice");
  togglePreset(s, "block:criteria");
  s.selectedIdea = "n-photos";
  togglePreset(s, "block:scores");
  assert.equal(s.selectedIdea, "n-photos");
  togglePreset(s, "block:scores");
  assert.equal(s.selectedIdea, "n-photos");
});

test("brainstorming can start empty, develop a statement, and transfer opinions without inventing facts", () => {
  const s = emptyWorkbook();
  assert.deepEqual(s.brainstorm, []);
  s.brainstorm.push(
    {
      id: "first",
      text: "見たい時間に確認できないのでは",
      kind: "hypothesis",
      parent: "",
      card: "",
    },
    {
      id: "second",
      text: "朝にも見られたらどうだろう",
      kind: "opinion",
      parent: "first",
      card: "",
    },
  );
  assert.equal(brainstormToCards(s).length, 2);
  assert.deepEqual(
    s.cards.map((c) => c.kind),
    ["hypothesis", "opinion"],
  );
  assert.ok(s.cards.every((c) => c.source.includes("未検証")));
  assert.ok(s.brainstorm.every((n) => s.cards.some((c) => c.id === n.card)));
  s.cards[0].text = "KJ法で編集した内容";
  assert.deepEqual(brainstormToCards(s), []);
  assert.equal(s.cards[0].text, "KJ法で編集した内容");
  const resumed = parseWorkbook(JSON.stringify(s));
  removeItem(resumed, "brainstorm", "first");
  assert.equal(resumed.brainstorm[0].parent, "");
  assert.equal(resumed.cards.length, 2);
  removeItem(resumed, "cards", resumed.brainstorm[0].card);
  assert.equal(resumed.brainstorm[0].card, "");
  assert.equal(brainstormToCards(resumed).length, 1);
  assert.deepEqual(parseWorkbook(JSON.stringify(resumed)), resumed);
  assert.match(report(s), /ブレーンストーミングの発言（未検証）/);
});
test("brainstorming presets are reversible after resume while transferred KJ work is retained", () => {
  const s = presetWorkbook();
  assert.equal(togglePreset(s, "block:brainstorm").ok, true);
  assert.equal(s.brainstorm.length, 4);
  assert.ok(s.brainstorm.some((n) => n.parent));
  assert.equal(s.cards.length, 0);
  assert.equal(brainstormToCards(s).length, 4);
  const loaded = parseWorkbook(JSON.stringify(s));
  togglePreset(loaded, "block:brainstorm");
  assert.equal(loaded.brainstorm.length, 0);
  assert.equal(loaded.cards.length, 4);
  assert.ok(loaded.cards.every((c) => c.kind !== "fact"));
  assert.deepEqual(parseWorkbook(JSON.stringify(loaded)), loaded);
  assert.equal(togglePreset(emptyWorkbook(), "block:brainstorm").ok, false);
});
test("brainstorm imports migrate previous workbooks and reject cycles, dangling references, and fabricated fact types", () => {
  const prior = presetExample();
  delete prior.brainstorm;
  const migrated = parseWorkbook(JSON.stringify(prior));
  assert.deepEqual(migrated.brainstorm, []);
  assert.deepEqual(migrated.cards, prior.cards);
  const s = presetWorkbook();
  togglePreset(s, "block:brainstorm");
  for (const mutate of [
    (s) => (s.brainstorm[0].parent = "missing"),
    (s) => (s.brainstorm[0].card = "missing"),
    (s) => (s.brainstorm[0].kind = "fact"),
    (s) => {
      s.brainstorm[0].parent = s.brainstorm[1].id;
      s.brainstorm[1].parent = s.brainstorm[0].id;
    },
  ]) {
    const bad = structuredClone(s);
    mutate(bad);
    assert.throws(() => parseWorkbook(JSON.stringify(bad)));
  }
});
test("stage summaries show concrete outgoing work and distinguish unfinished and fictional results", () => {
  const empty = emptyWorkbook();
  assert.ok(stageSummary(empty, 0).pending.some((s) => s.includes("まだ")));
  const s = presetExample();
  const first = stageSummary(s, 0);
  assert.ok(first.passed.some((r) => r.value === s.problem.question));
  assert.ok(
    first.passed.some(
      (r) => r.value.includes("30%") && r.value.includes("60%"),
    ),
  );
  assert.ok(stageSummary(s, 2).pending.some((n) => n.includes("まだ選んで")));
  s.focusCause = "h-notice";
  const causes = stageSummary(s, 2);
  assert.ok(
    causes.passed.some(
      (r) => r.value === s.causes.find((c) => c.id === s.focusCause).text,
    ),
  );
  s.selectedIdea = "n-display";
  simulate(s);
  const results = stageSummary(s, 5);
  assert.ok(
    results.passed.some(
      (r) => r.value.includes("55%") && r.value.includes("架空"),
    ),
  );
  assert.ok(results.passed.some((r) => r.value === s.observation));
  const before = structuredClone(s);
  for (let i = 0; i < 7; i++) {
    const summary = stageSummary(s, i);
    assert.ok(summary.completed.length && summary.passed.length);
  }
  assert.deepEqual(s, before);
});

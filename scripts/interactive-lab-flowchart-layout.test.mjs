import test from "node:test";
import assert from "node:assert/strict";
import { fromProgram, toProgram } from "../lab/flowchart/conversion.mjs";
import { exampleDocument } from "../lab/flowchart/examples.mjs";
import { nextOf, flowDocument } from "../lab/flowchart/graph.mjs";
import { dimensions, portPoint, shape } from "../lab/flowchart/symbols.mjs";
import { wireGeometry } from "../lab/flowchart/wires.mjs";
import { FlowRunner } from "../lab/flowchart/runner.mjs";
import { documentJSON, parseDocument } from "../lab/flowchart/documents.mjs";

const draft = (source) => ({
  version: 1,
  title: "配置の確認",
  source,
  settings: { indexBase: 0, inputs: {} },
});
function vertices(path) {
  const points = [];
  let point = { x: 0, y: 0 };
  for (const command of path.matchAll(/([MHV])(-?[\d.]+)(?:\s+(-?[\d.]+))?/g)) {
    point =
      command[1] === "M"
        ? { x: +command[2], y: +command[3] }
        : command[1] === "H"
          ? { ...point, x: +command[2] }
          : { ...point, y: +command[2] };
    points.push(point);
  }
  return points;
}
function byId(graph, id) {
  return graph.nodes.find((n) => n.id === id);
}
function run(document) {
  const runner = new FlowRunner(document.graph);
  for (let count = 0; !runner.state.completed; count++) {
    assert.ok(count < 1000);
    runner.next();
  }
  return runner.state.output;
}

test("YES leaves the diamond bottom, NO leaves its right, without changing truth semantics", () => {
  for (const score of [72, 40]) {
    const document = fromProgram(
        draft(
          `点数 = ${score}\nもし 点数 >= 60 ならば：\n  表示する("合格")\nそうでなければ：\n  表示する("再挑戦")`,
        ),
      ),
      graph = document.graph,
      decision = graph.nodes.find((n) => n.type === "decision"),
      size = dimensions("decision");
    assert.deepEqual(portPoint(decision, "out", 0), {
      x: decision.x,
      y: decision.y + size.h / 2,
    });
    assert.deepEqual(portPoint(decision, "out", 1), {
      x: decision.x + size.w / 2,
      y: decision.y,
    });
    assert.deepEqual(run(document), [score >= 60 ? "合格" : "再挑戦"]);
    assert.deepEqual(run(fromProgram(toProgram(document))), run(document));
  }
});

test("start, YES-side processing, joins and end share one vertical axis", () => {
  const graph = exampleDocument("decision").graph,
    start = graph.nodes.find((n) => n.type === "start");
  let node = start;
  while (node) {
    assert.equal(node.x, start.x);
    const edge = graph.edges.find((e) => e.from === node.id && e.port === 0);
    if (!edge) break;
    const geometry = wireGeometry(graph, edge),
      points = vertices(geometry.path);
    assert.ok(points.every((p) => p.x === start.x));
    assert.ok(points.at(-1).y > points[0].y);
    node = byId(graph, edge.to);
  }
  assert.equal(node.type, "end");
});

test("NO enters its block with one corner and rejoins with a left-pointing arrow", () => {
  const graph = exampleDocument("decision").graph,
    decision = graph.nodes.find((n) => n.type === "decision"),
    no = graph.edges.find((e) => e.from === decision.id && e.port === 1),
    points = vertices(wireGeometry(graph, no).path);
  assert.equal(points.length, 3);
  assert.ok(points[1].x > points[0].x);
  assert.equal(points[0].y, points[1].y);
  assert.equal(points[1].x, points[2].x);
  assert.ok(points[2].y > points[1].y);
  const joining = graph.edges.find((e) => e.from === no.to),
    geometry = wireGeometry(graph, joining),
    join = vertices(geometry.path);
  assert.equal(join.length, 3);
  assert.equal(join[0].x, join[1].x);
  assert.ok(join[1].y > join[0].y);
  assert.ok(join[2].x < join[1].x);
  assert.equal(join[2].y, join[1].y);
  assert.equal(geometry.arrow, true);
  const mainEdge = graph.edges.find(
    (e) => e.to === joining.to && e.from !== joining.from,
  );
  assert.equal(
    wireGeometry(graph, mainEdge).arrow,
    false,
    "the main line stays continuous at the join",
  );
  assert.doesNotMatch(shape("connector"), /circle/);
});

test("a missing else bypasses the YES body and merges without adding dummy processing", () => {
  const document = fromProgram(
      draft("x = 3\nもし x > 0 ならば：\n  x = x + 1\n表示する(x)"),
    ),
    graph = document.graph,
    decision = graph.nodes.find((n) => n.type === "decision"),
    edge = graph.edges.find((e) => e.from === decision.id && e.port === 1),
    before = JSON.stringify(graph);
  assert.equal(byId(graph, edge.to).type, "connector");
  const geometry = wireGeometry(graph, edge),
    points = vertices(geometry.path);
  assert.equal(points.length, 4);
  assert.ok(points[1].x > points[0].x);
  assert.ok(points[2].y > points[1].y);
  assert.equal(points.at(-1).x, decision.x);
  assert.equal(points[2].y, points[3].y);
  assert.equal(JSON.stringify(graph), before);
  assert.deepEqual(run(document), ["4"]);
  // A separate diagram lane must not push this bypass across unrelated blocks.
  graph.nodes.push({
    id: "n99",
    type: "process",
    scope: "main",
    x: 5000,
    y: decision.y + 170,
    code: "z = 0",
  });
  assert.deepEqual(wireGeometry(graph, edge), geometry);
});

test("nested YES and NO branches reserve room and remain free of overlapping symbols", () => {
  const document = fromProgram(
      draft(
        "x = 1\nもし x > 0 ならば：\n  もし x < 5 ならば：\n    x = x + 1\n  そうでなければ：\n    x = x + 2\nそうでなければ：\n  x = x - 1\n  x = x - 2\n表示する(x)",
      ),
    ),
    graph = document.graph;
  for (const decision of graph.nodes.filter((n) => n.type === "decision")) {
    assert.equal(byId(graph, nextOf(graph, decision.id, 0)).x, decision.x);
    assert.ok(byId(graph, nextOf(graph, decision.id, 1)).x > decision.x);
  }
  for (const a of graph.nodes)
    for (const b of graph.nodes) {
      if (a.id === b.id) continue;
      const da = dimensions(a.type),
        db = dimensions(b.type);
      assert.ok(
        Math.abs(a.x - b.x) >= (da.w + db.w) / 2 ||
          Math.abs(a.y - b.y) >= (da.h + db.h) / 2,
        `${a.id} and ${b.id} overlap`,
      );
    }
  assert.deepEqual(run(document), ["2"]);
  assert.deepEqual(run(fromProgram(toProgram(document))), ["2"]);
});

test("the nested no-else bypass stays inside its own YES subtree", () => {
  const graph = fromProgram(
      draft(
        "x = 1\nもし x > 0 ならば：\n  もし x < 5 ならば：\n    x = 2\nそうでなければ：\n  x = -1\n  x = -2\n  x = -3\n表示する(x)",
      ),
    ).graph,
    decisions = graph.nodes.filter((n) => n.type === "decision"),
    outer = decisions[0],
    inner = decisions[1],
    falseSide = byId(graph, nextOf(graph, outer.id, 1)),
    edge = graph.edges.find((e) => e.from === inner.id && e.port === 1);
  assert.ok(
    wireGeometry(graph, edge).bounds.maxX <
      falseSide.x - dimensions(falseSide.type).w / 2,
  );
});

test("old saved coordinates and branch ports remain intact through JSON import and execution", () => {
  const document = exampleDocument("decision"),
    graph = document.graph,
    decision = graph.nodes.find((n) => n.type === "decision");
  byId(graph, nextOf(graph, decision.id, 0)).x = decision.x - 220;
  byId(graph, nextOf(graph, decision.id, 1)).x = decision.x + 220;
  const restored = parseDocument(documentJSON(document));
  assert.deepEqual(restored.graph, flowDocument(graph).graph);
  assert.deepEqual(run(restored), ["合格"]);
  for (const edge of restored.graph.edges) {
    const geometry = wireGeometry(restored.graph, edge),
      points = vertices(geometry.path);
    assert.deepEqual(
      points[0],
      portPoint(byId(graph, edge.from), "out", edge.port),
    );
    assert.deepEqual(points.at(-1), portPoint(byId(graph, edge.to), "in"));
  }
  const startEdge = graph.edges.find((e) => e.from === "n1");
  byId(graph, startEdge.to).x += 0.001;
  assert.deepEqual(
    vertices(wireGeometry(graph, startEdge).path).at(-1),
    portPoint(byId(graph, startEdge.to), "in"),
  );
});

import test from "node:test";
import assert from "node:assert/strict";
import { joinWire, collapseJunctions } from "../lab/flowchart/connections.mjs";
import {
  addNode,
  connect,
  emptyGraph,
  flowDocument,
  checkFlowDirection,
  checkForwardChanges,
} from "../lab/flowchart/graph.mjs";
import { wireGeometry } from "../lab/flowchart/wires.mjs";
import { portPoint } from "../lab/flowchart/symbols.mjs";
import { FlowRunner } from "../lab/flowchart/runner.mjs";
import { exampleDocument } from "../lab/flowchart/examples.mjs";
import {
  documentJSON,
  parseDocument,
  encodeShare,
  decodeShare,
} from "../lab/flowchart/documents.mjs";
import { copyPart, pastePart } from "../lab/flowchart/clipboard.mjs";

const snapshot = (g) => JSON.stringify(g);
const execute = (g) => {
  const runner = new FlowRunner(g);
  for (let i = 0; !runner.state.completed; i++) {
    assert.ok(i < 100);
    runner.next();
  }
  return runner.state.output;
};
function fixture() {
  const graph = exampleDocument("decision").graph,
    yes = graph.nodes.find(
      (n) => n.type === "output" && n.code.includes("合格"),
    ),
    no = graph.nodes.find(
      (n) => n.type === "output" && n.code.includes("再挑戦"),
    ),
    stem = graph.edges.find((e) => e.from === yes.id);
  return { graph, yes, no, stem };
}

test("a line join creates one zero-height junction and preserves both source operations", () => {
  const { graph, yes, no, stem } = fixture(),
    before = snapshot(graph),
    originalPath = wireGeometry(graph, stem).points,
    result = joinWire(graph, no.id, 0, stem.id, { x: yes.x + 3, y: 508 }),
    junction = result.graph.nodes.find((n) => n.id === result.id);
  assert.equal(snapshot(graph), before);
  assert.equal(junction.junction, true);
  assert.deepEqual(portPoint(junction, "in"), { x: yes.x, y: 508 });
  assert.deepEqual(portPoint(junction, "out"), portPoint(junction, "in"));
  assert.equal(result.graph.nodes.length, graph.nodes.length + 1);
  assert.equal(
    result.graph.edges.length,
    graph.edges.length + 1,
    "replace the branch's old destination",
  );
  const upstream = result.graph.edges.find((e) => e.id === stem.id),
    downstream = result.graph.edges.find((e) => e.from === junction.id);
  assert.deepEqual(
    wireGeometry(result.graph, upstream).points[0],
    originalPath[0],
  );
  assert.deepEqual(
    wireGeometry(result.graph, downstream).points.at(-1),
    originalPath.at(-1),
  );
  for (const [score, expected] of [
    [72, "合格"],
    [40, "再挑戦"],
  ]) {
    result.graph.nodes.find((n) => n.type === "process").code =
      `点数 = ${score}`;
    assert.deepEqual(
      execute(result.graph),
      [expected],
      "joining a line must not run its source again",
    );
  }
});

test("any horizontal/vertical segment retains its existing bends and the exact dropped position", () => {
  const initial = fixture().graph,
    candidateEdges = initial.edges.filter(
      (e) => wireGeometry(initial, e).points.length > 2,
    );
  for (const edge of candidateEdges) {
    const old = wireGeometry(initial, edge).points;
    for (let i = 0; i < old.length - 1; i++) {
      const graph = flowDocument(initial).graph,
        source = addNode(graph, "process", "main", 1200, 0),
        point = {
          x: old[i].x * 0.63 + old[i + 1].x * 0.37,
          y: old[i].y * 0.63 + old[i + 1].y * 0.37,
        },
        result = joinWire(graph, source.id, 0, edge.id, point),
        up = result.graph.edges.find((e) => e.id === edge.id),
        down = result.graph.edges.find((e) => e.from === result.id),
        prefix = wireGeometry(result.graph, up).points,
        suffix = wireGeometry(result.graph, down).points;
      assert.deepEqual(prefix.at(-1), point);
      assert.deepEqual(suffix[0], point);
      assert.deepEqual(prefix.slice(0, -1), old.slice(0, i + 1));
      assert.deepEqual(suffix.slice(1), old.slice(i + 1));
      assert.doesNotThrow(() => checkFlowDirection(result.graph));
    }
  }
});

test("repeated attachments at a shared point reuse the junction rather than add stacked parts", () => {
  const { graph, no, stem } = fixture(),
    first = joinWire(graph, no.id, 0, stem.id, { x: 400, y: 508 }),
    source = addNode(first.graph, "process", "main", 1000, 100),
    remaining = first.graph.edges.find((e) => e.from === first.id),
    result = joinWire(first.graph, source.id, 0, remaining.id, {
      x: 400,
      y: 508,
    });
  assert.equal(result.id, first.id);
  assert.equal(result.graph.nodes.length, first.graph.nodes.length);
  assert.equal(result.graph.edges.filter((e) => e.to === first.id).length, 3);
});

test("failed upward, own-line, cross-scope and capacity attempts are atomic", () => {
  const { graph, no, stem } = fixture(),
    before = snapshot(graph);
  assert.throws(
    () => joinWire(graph, no.id, 0, "w1", { x: 400, y: 110 }),
    /上方向/,
  );
  const own = graph.edges.find((e) => e.from === no.id);
  assert.throws(
    () => joinWire(graph, no.id, 0, own.id, { x: 500, y: 525 }),
    /自分/,
  );
  assert.equal(snapshot(graph), before);
  graph.scopes.push({ id: "f1", name: "別の図", parameters: [] });
  const foreign = addNode(graph, "process", "f1", 100, 0),
    withScope = snapshot(graph);
  assert.throws(
    () => joinWire(graph, foreign.id, 0, stem.id, { x: 400, y: 508 }),
    /同じ図/,
  );
  assert.equal(snapshot(graph), withScope);
  while (graph.nodes.length < 120) addNode(graph, "process", "main", 1200, 0);
  const full = snapshot(graph);
  assert.throws(
    () => joinWire(graph, no.id, 0, stem.id, { x: 400, y: 508 }),
    /120個/,
  );
  assert.equal(snapshot(graph), full);
});

test("deleting or rewiring the last joining arrow restores one continuous original line", () => {
  const { graph, no, stem } = fixture(),
    continuation = graph.edges.find((e) => e.from === stem.to),
    result = joinWire(graph, no.id, 0, stem.id, { x: 400, y: 508 }),
    joined = result.graph;
  joined.edges = joined.edges.filter(
    (e) => !(e.from === no.id && e.to === result.id),
  );
  collapseJunctions(joined);
  assert.equal(
    joined.nodes.some((n) => n.id === result.id),
    false,
  );
  const restored = joined.edges.find((e) => e.id === stem.id);
  assert.equal(restored.to, continuation.to);
  assert.equal(
    joined.nodes.some((n) => n.junction),
    false,
  );
  assert.deepEqual(wireGeometry(joined, restored).points, [
    wireGeometry(graph, stem).points[0],
    wireGeometry(graph, continuation).points.at(-1),
  ]);
});

test("zero-height cyclic connections and moves that reverse a connection are refused", () => {
  const graph = emptyGraph(),
    a = addNode(graph, "connector", "main", 100, 200),
    b = addNode(graph, "connector", "main", 200, 200);
  a.junction = b.junction = true;
  connect(graph, a.id, 0, b.id);
  const before = snapshot(graph);
  assert.throws(() => connect(graph, b.id, 0, a.id), /戻る/);
  assert.equal(snapshot(graph), before);
  const moved = structuredClone(graph);
  moved.nodes.find((n) => n.id === b.id).y = 180;
  assert.throws(() => checkForwardChanges(graph, moved), /上向き/);
});

test("JSON, share links and copy/paste preserve junctions and split-line paths", async () => {
  const graph = fixture().graph,
    extra = addNode(graph, "process", "main", 1000, 0),
    no = graph.edges.find((e) => e.from === "n3" && e.port === 1),
    result = joinWire(graph, extra.id, 0, no.id, { x: 620, y: 305 }),
    doc = flowDocument(result.graph);
  assert.deepEqual(parseDocument(documentJSON(doc)), doc);
  assert.deepEqual(await decodeShare(await encodeShare(doc)), doc);
  const pasted = pastePart(doc.graph, copyPart(doc.graph, result.id), "main", {
    x: 1100,
    y: 500,
  });
  assert.equal(
    pasted.graph.nodes.find((n) => n.id === pasted.id).junction,
    true,
  );
  const malformed = structuredClone(doc.graph);
  malformed.edges[0].via = [{ x: Infinity, y: 1 }];
  assert.throws(() => flowDocument(malformed), /経路/);
});

test("when both decision outlets share a junction the highlighted edge still follows the actual condition", () => {
  for (const code of ["1 < 2", "1 > 2"]) {
    const graph = emptyGraph(),
      decision = addNode(graph, "decision", "main", 360, 180);
    graph.nodes.find((n) => n.type === "end").y = 500;
    decision.code = code;
    connect(graph, "n1", 0, decision.id);
    connect(graph, decision.id, 0, "n2");
    connect(graph, decision.id, 1, "n2");
    const stem = graph.edges.find(
        (e) => e.from === decision.id && e.port === 0,
      ),
      joined = joinWire(graph, decision.id, 1, stem.id, { x: 360, y: 300 }),
      runner = new FlowRunner(joined.graph);
    runner.next();
    runner.next();
    const chosen = joined.graph.edges.find((e) => e.id === runner.lastEdge);
    assert.equal(chosen.port, code === "1 < 2" ? 0 : 1);
    runner.previous();
    runner.next();
    assert.equal(runner.lastEdge, chosen.id);
  }
});

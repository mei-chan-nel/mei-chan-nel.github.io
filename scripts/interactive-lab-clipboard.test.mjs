import test from "node:test";
import assert from "node:assert/strict";
import { clipboardText, clipboardData } from "../lab/shared/diagram-keys.mjs";
import {
  copyPart as copyCircuit,
  pastePart as pasteCircuit,
} from "../lab/logic-circuit/clipboard.mjs";
import {
  copyPart as copyFlow,
  pastePart as pasteFlow,
} from "../lab/flowchart/clipboard.mjs";
import { exampleCircuit } from "../lab/logic-circuit/examples.mjs";
import { exampleDocument } from "../lab/flowchart/examples.mjs";
import { emptyGraph, addNode, flowDocument } from "../lab/flowchart/graph.mjs";
import { defaultInput } from "../lab/flowchart/studio.mjs";

test("clipboard format distinguishes diagrams from ordinary text and other editors", () => {
  const data = { node: { type: "and" } },
    text = clipboardText("logic-circuit", data);
  assert.deepEqual(clipboardData("logic-circuit", text), data);
  for (const value of [text, "hello", "{}", "null", "x".repeat(100001)])
    assert.equal(clipboardData("flowchart", value), null);
  assert.throws(() =>
    clipboardData("logic-circuit", text.replace('"version":1', '"version":2')),
  );
});

for (const type of ["and", "or", "not", "branch", "input", "output"]) {
  test(`circuit ${type}: fresh identities, preserved values, no original connections`, () => {
    const graph = exampleCircuit("adder"),
      original = graph.nodes.find((n) => n.type === type);
    if (["input", "output"].includes(type)) {
      original.name = "複製する端子";
      original.meaning = "説明";
      if (type === "input") original.value = 1;
    }
    const before = structuredClone(graph),
      data = copyCircuit(graph, original.id),
      result = pasteCircuit(graph, data, { x: 600, y: 400 }),
      node = result.graph.nodes.find((n) => n.id === result.id);
    assert.deepEqual(graph, before);
    assert.equal(node.type, type);
    assert.notEqual(node.id, original.id);
    assert.equal(node.x, 600);
    assert.deepEqual(result.graph.edges, graph.edges);
    if (["input", "output"].includes(type)) {
      assert.notEqual(node.label, original.label);
      assert.equal(node.name, original.name);
      assert.equal(node.meaning, original.meaning);
      if (type === "input") assert.equal(node.value, 1);
    } else assert.ok(node.number > original.number);
  });
}

test("circuit rejection leaves the graph intact at terminal/part limits and on malformed paste", () => {
  let graph = exampleCircuit("adder"),
    input = copyCircuit(graph, graph.nodes.find((n) => n.type === "input").id);
  while (graph.nodes.filter((n) => n.type === "input").length < 4)
    graph = pasteCircuit(graph, input, { x: 0, y: 0 }).graph;
  let before = structuredClone(graph);
  assert.throws(() => pasteCircuit(graph, input, { x: 0, y: 0 }), /4つ/);
  assert.deepEqual(graph, before);
  const gate = copyCircuit(graph, graph.nodes.find((n) => n.type === "and").id);
  while (graph.nodes.length < 40)
    graph = pasteCircuit(graph, gate, { x: 0, y: 0 }).graph;
  before = structuredClone(graph);
  assert.throws(() => pasteCircuit(graph, gate, { x: 0, y: 0 }), /40個/);
  assert.deepEqual(graph, before);
  for (const data of [
    {},
    { node: { type: "constructor" } },
    { node: { type: "input", value: 9 } },
  ])
    assert.throws(() =>
      pasteCircuit(exampleCircuit("and"), data, { x: 0, y: 0 }),
    );
});

test("flow copy preserves code and notes but detaches external edges and changes identities", () => {
  const graph = exampleDocument("decision").graph,
    source = graph.nodes.find((n) => n.type === "process");
  source.note = "保持するメモ";
  const before = JSON.stringify(graph),
    data = copyFlow(graph, source.id),
    result = pasteFlow(graph, data, "main", { x: 100, y: 200 }),
    node = result.graph.nodes.find((n) => n.id === result.id);
  assert.equal(JSON.stringify(graph), before);
  assert.equal(node.code, source.code);
  assert.equal(node.note, source.note);
  assert.notEqual(node.id, source.id);
  assert.deepEqual(result.graph.edges, graph.edges);
});

for (const type of ["loopStart", "loopEnd"]) {
  test(`flow ${type}: loop pairs and internal edges survive with new IDs`, () => {
    const graph = emptyGraph(),
      start = addNode(graph, "loopStart", "main", 300, 200),
      end = graph.nodes.find((n) => n.id === start.pair),
      source = type === "loopStart" ? start : end,
      data = copyFlow(graph, source.id),
      result = pasteFlow(graph, data, "main", { x: 500, y: 400 }),
      node = result.graph.nodes.find((n) => n.id === result.id),
      pair = result.graph.nodes.find((n) => n.id === node.pair);
    assert.equal(result.graph.nodes.length, graph.nodes.length + 2);
    assert.equal(node.type, type);
    assert.equal(pair.pair, node.id);
    assert.notEqual(pair.id, source.pair);
    assert.equal(node.x, 500);
    assert.equal(node.y, 400);
    assert.equal(pair.y - node.y, type === "loopStart" ? 220 : -220);
    const edge = result.graph.edges.at(-1);
    assert.equal(edge.from, type === "loopStart" ? node.id : pair.id);
    assert.equal(edge.to, type === "loopStart" ? pair.id : node.id);
    assert.notEqual(edge.id, graph.edges.at(-1).id);
    assert.deepEqual(flowDocument(result.graph).graph, result.graph);
  });
}

test("flow input settings survive cross-document paste without overwriting an existing variable", () => {
  const source = emptyGraph(),
    input = addNode(source, "input", "main", 200, 200);
  input.code = "点数";
  source.settings.inputs["点数"] = defaultInput();
  const data = copyFlow(source, input.id),
    target = emptyGraph(),
    result = pasteFlow(target, data, "main", { x: 300, y: 300 });
  assert.deepEqual(
    result.graph.settings.inputs,
    flowDocument(source).graph.settings.inputs,
  );
  target.settings.inputs["点数"] = { ...defaultInput(), max: 50 };
  assert.deepEqual(
    pasteFlow(target, data, "main", { x: 300, y: 300 }).graph.settings.inputs,
    flowDocument(target).graph.settings.inputs,
  );
});

test("flow rejects incomplete pairs, invalid endpoints and illegal scope/terminal duplication atomically", () => {
  const graph = emptyGraph(),
    start = addNode(graph, "loopStart", "main", 300, 200),
    data = copyFlow(graph, start.id),
    before = structuredClone(graph);
  for (const bad of [
    { ...data, nodes: [data.nodes[0]] },
    { ...data, edges: [{ from: start.id, port: 0, to: "n999999" }] },
    { ...data, nodes: data.nodes.map((n) => ({ ...n, code: null })) },
    { ...data, nodes: data.nodes.map((n) => ({ ...n, x: Infinity })) },
    {
      nodes: [{ ...graph.nodes[0], type: "return" }],
      selected: "n1",
      edges: [],
    },
  ]) {
    assert.throws(() => pasteFlow(graph, bad, "main", { x: 300, y: 300 }));
    assert.deepEqual(graph, before);
  }
  assert.throws(
    () => pasteFlow(graph, copyFlow(graph, "n1"), "main", { x: 300, y: 300 }),
    /1つ/,
  );
  assert.throws(() => pasteFlow(graph, data, "f9", { x: 300, y: 300 }));
  assert.deepEqual(graph, before);
});

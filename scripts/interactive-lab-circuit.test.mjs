import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  connect,
  evaluate,
  truthTable,
  validCircuit,
  orderedNodes,
} from "../lab/logic-circuit/circuit.mjs";
import {
  exampleCircuit,
  circuitExamples,
  arithmeticReadout,
} from "../lab/logic-circuit/examples.mjs";
import {
  circuitDocument,
  parseDocument,
  documentJSON,
} from "../lab/logic-circuit/documents.mjs";
import { encodeShare, decodeShare } from "../lab/logic-circuit/sharing.mjs";

test("AND, OR and NOT have the standard truth tables", () => {
  for (const [type, expected] of [
    ["and", [0, 0, 0, 1]],
    ["or", [0, 1, 1, 1]],
    ["not", [1, 0]],
  ]) {
    const graph = exampleCircuit(type),
      { gates, outputs } = orderedNodes(graph);
    assert.ok(validCircuit(graph));
    const rows = truthTable(graph);
    assert.deepEqual(
      rows.map((r) => r.values.get(gates[0].id)),
      expected,
    );
    assert.deepEqual(
      rows.map((r) => r.values.get(outputs[0].id)),
      expected,
    );
  }
});
test("XOR and half-adder work through numbered intermediate gates and explicit branches", () => {
  for (const type of ["xor", "adder"]) {
    const graph = exampleCircuit(type),
      { outputs, branches } = orderedNodes(graph);
    assert.ok(validCircuit(graph));
    const rows = truthTable(graph);
    assert.deepEqual(
      rows.map((r) => r.values.get(outputs.find((n) => n.label === "X").id)),
      [0, 1, 1, 0],
    );
    if (type === "adder")
      assert.deepEqual(
        rows.map((r) => r.values.get(outputs.find((n) => n.label === "Y").id)),
        [0, 0, 0, 1],
      );
    for (const row of rows)
      for (const branch of branches) {
        const incoming = graph.edges.find((e) => e.to.node === branch.id);
        assert.equal(
          row.values.get(branch.id),
          row.values.get(incoming.from.node),
        );
      }
  }
});
test("unconnected gates remain incomplete instead of treating a floating input as 0", () => {
  const graph = exampleCircuit("and"),
    gate = graph.nodes.find((n) => n.type === "and"),
    output = graph.nodes.find((n) => n.type === "output");
  graph.edges = graph.edges.filter(
    (e) => e.to.node !== gate.id || e.to.port !== 1,
  );
  for (const row of truthTable(graph)) {
    assert.equal(row.values.get(gate.id), null);
    assert.equal(row.values.get(output.id), null);
  }
});

test("useful three-input circuits enumerate all eight combinations with correct sum, vote, selection and even parity", () => {
  assert.deepEqual(
    circuitExamples.map((e) => e.id),
    [
      "xor",
      "adder",
      "full-adder",
      "two-bit-adder",
      "majority",
      "selector",
      "parity",
    ],
  );
  for (const type of ["full-adder", "majority", "selector", "parity"]) {
    const graph = exampleCircuit(type),
      { inputs, outputs } = orderedNodes(graph);
    assert.ok(validCircuit(graph));
    assert.equal(inputs.length, 3);
    const rows = truthTable(graph);
    assert.equal(rows.length, 8);
    for (const row of rows) {
      const [a, b, c] = inputs.map((n) => row.inputs[n.id]);
      const x = row.values.get(outputs.find((n) => n.label === "X").id);
      assert.ok([...row.values.values()].every((v) => v === 0 || v === 1));
      if (type === "full-adder") {
        const y = row.values.get(outputs.find((n) => n.label === "Y").id);
        assert.equal(x + 2 * y, a + b + c);
      }
      if (type === "majority") assert.equal(x, a + b + c >= 2 ? 1 : 0);
      if (type === "selector") assert.equal(x, c ? b : a);
      if (type === "parity") {
        assert.equal(x, (a + b + c) % 2);
        assert.equal((a + b + c + x) % 2, 0);
      }
    }
  }
});

test("two-bit addition handles all 16 operand pairs and propagates the lower carry into the higher full adder", () => {
  const graph = exampleCircuit("two-bit-adder"),
    { inputs, outputs, gates } = orderedNodes(graph);
  assert.ok(validCircuit(graph));
  assert.equal(inputs.length, 4);
  assert.equal(outputs.length, 3);
  assert.equal(gates.length, 13);
  const rows = truthTable(graph);
  for (let a = 0; a < 4; a++)
    for (let b = 0; b < 4; b++) {
      const row = rows[a * 4 + b];
      const [x, y, z] = outputs.map((n) => row.values.get(n.id));
      assert.equal(4 * x + 2 * y + z, a + b);
      assert.equal(
        row.values.get(gates.find((n) => n.number === 2).id),
        a & 1 & (b & 1),
      );
      assert.ok([...row.values.values()].every((v) => v === 0 || v === 1));
    }
  assert.match(arithmeticReadout(graph, rows[15].values), /110₂（6）/);
  // The readout uses actual output signals after edits, including incompleteness.
  const changed = structuredClone(graph),
    output = outputs.find((n) => n.label === "X");
  changed.edges = changed.edges.filter((e) => e.to.node !== output.id);
  assert.match(arithmeticReadout(changed, evaluate(changed)), /未接続/);
});

test("every new example survives JSON and shared-URL round trips with its input meanings, truth table and immutable source", async () => {
  for (const example of circuitExamples) {
    const graph = exampleCircuit(example.id),
      pristine = structuredClone(graph);
    const doc = circuitDocument(graph, example.name);
    assert.deepEqual(parseDocument(documentJSON(doc)), doc);
    const shared = await decodeShare(
      await encodeShare(doc, "https://mei-chan-nel.com/lab/logic-circuit/"),
    );
    assert.deepEqual(shared, doc);
    assert.deepEqual(
      truthTable(shared.circuit).map((r) => [...r.values]),
      truthTable(graph).map((r) => [...r.values]),
    );
    graph.nodes[0].value = 1;
    graph.nodes[0].x += 80;
    graph.edges.splice(0, 1);
    assert.deepEqual(exampleCircuit(example.id), pristine);
  }
});
test("reconnecting an input replaces its old wire and cannot create feedback", () => {
  const graph = exampleCircuit("and"),
    gate = graph.nodes.find((n) => n.type === "and");
  const a = graph.nodes.find((n) => n.label === "A"),
    b = graph.nodes.find((n) => n.label === "B");
  const changed = connect(
    graph,
    { node: a.id, port: 0 },
    { node: gate.id, port: 1 },
    "w4",
  );
  assert.equal(
    changed.edges.filter((e) => e.to.node === gate.id && e.to.port === 1)
      .length,
    1,
  );
  assert.equal(evaluate(changed, { [a.id]: 1, [b.id]: 0 }).get(gate.id), null);
  assert.equal(changed.edges.filter((e) => e.from.node === a.id).length, 1);
  assert.throws(
    () =>
      connect(
        changed,
        { node: gate.id, port: 0 },
        { node: gate.id, port: 0 },
        "w5",
      ),
    /一周/,
  );
  assert.throws(
    () =>
      connect(
        changed,
        { node: gate.id, port: 1 },
        { node: gate.id, port: 0 },
        "w5",
      ),
    /端子/,
  );
  const xor = exampleCircuit("xor"),
    first = xor.nodes.find((n) => n.type === "or"),
    last = xor.nodes.find((n) => n.type === "and" && n.number === 4);
  assert.throws(
    () =>
      connect(
        xor,
        { node: last.id, port: 0 },
        { node: first.id, port: 0 },
        "w20",
      ),
    /一周/,
  );
});
test("inserting a branch preserves the original signal and both downstream uses", () => {
  let graph = exampleCircuit("and");
  const edge = graph.edges.at(-1),
    output = graph.nodes.find((n) => n.type === "output");
  graph.nodes.push(
    { id: "n10", type: "branch", number: 1, x: 600, y: 170 },
    { id: "n11", type: "not", number: 2, x: 730, y: 240 },
  );
  graph.edges = graph.edges.filter((e) => e.id !== edge.id);
  graph = connect(graph, edge.from, { node: "n10", port: 0 }, "w10");
  graph = connect(graph, { node: "n10", port: 0 }, edge.to, "w11");
  graph = connect(
    graph,
    { node: "n10", port: 1 },
    { node: "n11", port: 0 },
    "w12",
  );
  assert.ok(validCircuit(graph));
  for (const row of truthTable(graph)) {
    assert.equal(row.values.get(output.id), row.values.get("n10"));
    assert.equal(row.values.get("n11"), 1 - row.values.get("n10"));
  }
});
test("four inputs enumerate all 16 combinations; invalid local circuits are rejected", () => {
  const graph = exampleCircuit("and");
  graph.nodes.push(
    { id: "n5", type: "input", label: "C", value: 0, x: 40, y: 280 },
    { id: "n6", type: "input", label: "D", value: 1, x: 40, y: 320 },
  );
  assert.equal(truthTable(graph).length, 16);
  assert.deepEqual(
    Object.values(truthTable(graph).at(-1).inputs),
    [1, 1, 1, 1],
  );
  assert.ok(validCircuit(graph));
  const bad = structuredClone(graph);
  bad.edges.push({ ...bad.edges[0], id: "w99" });
  assert.equal(validCircuit(bad), false);
  assert.equal(
    validCircuit({
      nodes: [{ id: "n1", type: "bogus", x: 0, y: 0 }],
      edges: [],
    }),
    false,
  );
});
test("Lab links the public circuit exhibit under digital representation", async () => {
  const home = await readFile(
    new URL("../lab/index.html", import.meta.url),
    "utf8",
  );
  const page = await readFile(
    new URL("../lab/logic-circuit/index.html", import.meta.url),
    "utf8",
  );
  assert.equal((home.match(/href="\.\/logic-circuit\/"/g) || []).length, 1);
  assert.doesNotMatch(page, /<meta name="robots" content="[^"]*noindex/);
  assert.doesNotMatch(page, /googletagmanager|adsbygoogle/);
});

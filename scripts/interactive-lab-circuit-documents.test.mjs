import test from "node:test";
import assert from "node:assert/strict";
import {
  CircuitStorage,
  circuitDocument,
  validateDocument,
  documentJSON,
  parseDocument,
  fingerprint,
  exportFilename,
  DRAFT_KEY,
  SAVED_KEY,
} from "../lab/logic-circuit/documents.mjs";
import { encodeShare, decodeShare } from "../lab/logic-circuit/sharing.mjs";
import { exampleCircuit } from "../lab/logic-circuit/examples.mjs";
import { truthTable, validCircuit } from "../lab/logic-circuit/circuit.mjs";

class MemoryStorage {
  data = new Map();
  getItem(key) {
    return this.data.get(key) ?? null;
  }
  setItem(key, value) {
    this.data.set(key, value);
  }
}
function fixture() {
  const graph = exampleCircuit("adder", 900, 380);
  graph.nodes.find((node) => node.label === "A").value = 1;
  graph.nodes.find((node) => node.label === "B").value = 1;
  graph.nodes.find((node) => node.type === "not").x += 24;
  graph.nextGate = 20; // Deleted parts' numbers must not be reused after loading.
  return circuitDocument(graph, "半加算器：和と桁上がり 🔴");
}
const rows = (graph) => truthTable(graph).map((row) => [...row.values]);

test("legacy fan-out files gain explicit branches without losing signals or reusing deleted numbers", () => {
  const graph = exampleCircuit("and");
  const gate = graph.nodes.find((n) => n.type === "and");
  graph.nodes.push(
    { id: "n10", type: "not", number: 2, x: 600, y: 280 },
    { id: "n11", type: "output", label: "Y", x: 800, y: 280 },
  );
  graph.edges.push(
    {
      id: "w10",
      from: { node: gate.id, port: 0 },
      to: { node: "n10", port: 0 },
    },
    { id: "w11", from: { node: "n10", port: 0 }, to: { node: "n11", port: 0 } },
  );
  graph.nextBranch = 20;
  assert.equal(validCircuit(graph), false);
  assert.equal(validCircuit(graph, { allowFanout: true }), true);
  const restored = circuitDocument(graph).circuit;
  assert.equal(validCircuit(restored), true);
  assert.equal(restored.nodes.find((n) => n.type === "branch").number, 20);
  const originals = truthTable(graph),
    converted = truthTable(restored);
  for (let i = 0; i < originals.length; i++)
    for (const node of graph.nodes)
      assert.equal(
        converted[i].values.get(node.id),
        originals[i].values.get(node.id),
      );
  assert.equal(graph.nodes.filter((n) => n.type === "branch").length, 0);
});

test("terminal names round-trip through JSON and sharing; saved-state metadata stays local", async () => {
  const graph = exampleCircuit("adder");
  graph.nodes.find((n) => n.label === "A").name = "入力する数 a";
  graph.nodes.find((n) => n.label === "X").name = "和 <S>";
  const document = circuitDocument(graph, "名前付きの加算器");
  assert.deepEqual(parseDocument(documentJSON(document)), document);
  assert.deepEqual(
    await decodeShare(
      await encodeShare(
        document,
        "https://mei-chan-nel.com/lab/logic-circuit/",
      ),
    ),
    document,
  );
  const storage = new CircuitStorage(new MemoryStorage()),
    baseline = fingerprint(document);
  storage.saveDraft(document, null, baseline);
  assert.equal(storage.draftState().cleanFingerprint, baseline);
  const changed = structuredClone(document);
  changed.circuit.nodes[0].name = "別の名前";
  storage.saveDraft(changed, null, baseline);
  assert.notEqual(
    fingerprint(storage.draftState().document),
    storage.draftState().cleanFingerprint,
  );
  assert.ok(!documentJSON(changed).includes("cleanFingerprint"));
});

test("circuit JSON preserves layout, wire ports, input states, numbered gates and all truth-table rows", () => {
  const doc = fixture(),
    restored = parseDocument(documentJSON(doc));
  assert.deepEqual(restored, doc);
  assert.deepEqual(rows(restored.circuit), rows(doc.circuit));
  assert.equal(restored.circuit.nextGate, 20);
  assert.equal(exportFilename("実験：半加算器"), "実験：半加算器.circuit.json");
  assert.equal(exportFilename("CON.json"), "circuit-CON.json");
  assert.throws(() => exportFilename("  "), /ファイル名/);
});

test("unsupported or damaged files, cycles, duplicate numbers and oversized data are rejected", () => {
  const doc = fixture();
  const damaged = [
    { ...doc, format: "mei-program-studio" },
    { ...doc, version: 2 },
    { ...doc, title: "x".repeat(121) },
    ...[
      (g) => g.nodes.push(null),
      (g) => {
        g.nodes[0].type = "constructor";
      },
      (g) => {
        g.nodes[0].label = ["A"];
      },
      (g) => {
        g.nodes[0].type = ["input"];
      },
      (g) => {
        g.nodes[0].x = Infinity;
      },
      (g) => {
        g.nodes[0].label = "X";
      },
      (g) => {
        g.nextGate = -1;
      },
      (g) => {
        g.nodes.find((n) => n.number === 4).number = 1;
      },
      (g) => g.edges.push({ ...g.edges[0], id: "w99" }),
      (g) => {
        const first = g.nodes.find((n) => n.type === "or"),
          last = g.nodes.find((n) => n.number === 4);
        g.edges = g.edges.filter(
          (e) => e.to.node !== first.id || e.to.port !== 0,
        );
        g.edges.push({
          id: "w99",
          from: { node: last.id, port: 0 },
          to: { node: first.id, port: 0 },
        });
      },
    ].map((mutate) => {
      const copy = structuredClone(doc);
      mutate(copy.circuit);
      return copy;
    }),
  ];
  for (const bad of damaged) assert.throws(() => validateDocument(bad));
  assert.throws(() => parseDocument("not JSON"), /JSON/);
  assert.throws(() => parseDocument(" ".repeat(100001)), /100KB/);
  assert.deepEqual(fixture(), doc);
});

test("browser saves migrate the first release's draft and support copy, overwrite and deletion", () => {
  const memory = new MemoryStorage(),
    storage = new CircuitStorage(memory),
    doc = fixture();
  memory.setItem(DRAFT_KEY, JSON.stringify(doc.circuit));
  assert.deepEqual(storage.draft().circuit, doc.circuit);
  storage.saveDraft(doc);
  assert.deepEqual(storage.draft(), doc);
  const original = storage.save(doc),
    copied = storage.save({ ...doc, title: "別の回路" });
  assert.notEqual(copied.id, original.id);
  assert.equal(storage.list().length, 2);
  const overwritten = storage.save(
    { ...doc, title: "更新した回路" },
    original.id,
  );
  assert.equal(overwritten.id, original.id);
  assert.equal(storage.list().length, 2);
  assert.equal(
    storage.list().find((r) => r.id === original.id).document.title,
    "更新した回路",
  );
  storage.remove(copied.id);
  assert.equal(storage.list().length, 1);
  assert.throws(() => storage.save(doc, "missing"), /見つかりません/);
});

test("a corrupt save list or full storage never silently replaces the existing records", () => {
  const memory = new MemoryStorage(),
    storage = new CircuitStorage(memory),
    doc = fixture();
  memory.setItem(SAVED_KEY, "damaged");
  assert.throws(() => storage.list(), /変更していません/);
  assert.throws(() => storage.save(doc), /変更していません/);
  assert.equal(memory.getItem(SAVED_KEY), "damaged");
  const records = Array.from({ length: 100 }, (_, i) => ({
    id: `save-${i}`,
    updatedAt: i,
    document: doc,
  }));
  memory.setItem(SAVED_KEY, JSON.stringify(records));
  const before = memory.getItem(SAVED_KEY);
  assert.throws(() => storage.save(doc), /100件/);
  assert.equal(memory.getItem(SAVED_KEY), before);
  assert.equal(storage.save(doc, "save-0").id, "save-0");
  const full = new CircuitStorage({
    getItem: (key) => memory.getItem(key),
    setItem: () => {
      throw new Error("quota");
    },
  });
  assert.throws(() => full.save(doc, "save-0"), /保存できません/);
  assert.equal(storage.list().length, 100);
});

test("drafts retain an explicit overwrite target; examples and JSON imports remain new after reload", () => {
  const memory = new MemoryStorage(),
    storage = new CircuitStorage(memory),
    doc = fixture();
  const owned = storage.save(doc);
  const edited = { ...doc, title: "編集中の自分の回路" };
  storage.saveDraft(edited, owned.id);
  assert.deepEqual(storage.draftState(), {
    document: edited,
    recordId: owned.id,
    legacy: false,
    cleanFingerprint: null,
  });
  assert.ok(!documentJSON(storage.draft()).includes(owned.id));
  // Even identical content must not reattach an example to a named save.
  storage.saveDraft(doc);
  assert.deepEqual(storage.draftState(), {
    document: doc,
    recordId: null,
    legacy: false,
    cleanFingerprint: null,
  });
  assert.deepEqual(storage.list()[0], owned);
  assert.deepEqual(parseDocument(memory.getItem(DRAFT_KEY)), doc);
  assert.throws(() => storage.saveDraft(doc, { id: owned.id }), /保存先/);
  memory.setItem(DRAFT_KEY, documentJSON(doc));
  assert.equal(storage.draftState().legacy, true);
});

test("compressed share URLs round-trip Japanese titles and every circuit detail without server storage", async () => {
  const doc = fixture(),
    url = await encodeShare(
      doc,
      "https://mei-chan-nel.com/lab/logic-circuit/?old=1#old",
    );
  assert.match(
    url,
    /^https:\/\/mei-chan-nel\.com\/lab\/logic-circuit\/#lc1\.d\./,
  );
  assert.ok(url.length < 2000);
  assert.deepEqual(await decodeShare(url), doc);
  assert.deepEqual(await decodeShare(new URL(url).hash), doc);
  assert.match(
    await encodeShare(doc, "file:///private/folder/circuit.html"),
    /^https:\/\/mei-chan-nel\.com\/lab\/logic-circuit\//,
  );
  assert.equal(fingerprint(await decodeShare(url)), fingerprint(doc));
});

test("sharing falls back to JSON without compression and explains unavailable decompression", async () => {
  const compress = globalThis.CompressionStream,
    decompress = globalThis.DecompressionStream;
  const doc = fixture(),
    compressed = await encodeShare(
      doc,
      "https://example.com/lab/logic-circuit/",
    );
  try {
    globalThis.CompressionStream = undefined;
    const raw = await encodeShare(
      doc,
      "https://example.com/lab/logic-circuit/",
    );
    assert.match(raw, /#lc1\.j\./);
    globalThis.DecompressionStream = undefined;
    assert.deepEqual(await decodeShare(raw), doc);
    await assert.rejects(() => decodeShare(compressed), /ブラウザでは共有URL/);
  } finally {
    globalThis.CompressionStream = compress;
    globalThis.DecompressionStream = decompress;
  }
});

test("invalid, truncated, unsupported and expanding share payloads are rejected before loading", async () => {
  const doc = fixture(),
    url = await encodeShare(doc, "https://example.com/lab/logic-circuit/");
  for (const raw of [
    "",
    "not a URL",
    "#lc2.j.e30",
    "#lc1.j.a",
    "#lc1.j.Zg=",
    "#lc1.d.e30",
    url.slice(0, -12),
  ])
    await assert.rejects(() => decodeShare(raw));
  const badBytes = Buffer.from([0xff, 0xfe]).toString("base64url");
  await assert.rejects(() => decodeShare(`#lc1.j.${badBytes}`));
  const expanded = await new Response(
    new Blob([" ".repeat(100001)])
      .stream()
      .pipeThrough(new CompressionStream("deflate")),
  ).arrayBuffer();
  await assert.rejects(
    () => decodeShare(`#lc1.d.${Buffer.from(expanded).toString("base64url")}`),
    /大きすぎます/,
  );
});

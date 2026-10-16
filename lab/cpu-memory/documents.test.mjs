import test from "node:test";
import assert from "node:assert/strict";
import {
  programDocument,
  readPrograms,
  saveProgram,
  removeProgram,
  SAVED_KEY,
} from "./documents.mjs";
import { presets } from "./presets.mjs";
import { defaults } from "./model.mjs";
import { transferSteps } from "./transfers.mjs";
const document = () => ({
  version: 1,
  name: "実験",
  initial: structuredClone(presets[0].memory),
  config: { ...defaults },
});
const storage = () => {
  const values = new Map();
  return {
    getItem: (k) => values.get(k) ?? null,
    setItem: (k, v) => values.set(k, v),
  };
};
test("named browser programs are independent snapshots; overwrite, copy and delete are precise", () => {
  const s = storage(),
    d = document(),
    a = saveProgram(s, d);
  d.initial[16].arg = 100;
  assert.equal(readPrograms(s)[0].document.initial[16].arg, 7);
  const b = saveProgram(s, d, a.id);
  assert.equal(b.id, a.id);
  assert.equal(readPrograms(s).length, 1);
  assert.equal(b.document.initial[16].arg, 100);
  const c = saveProgram(s, d);
  assert.notEqual(c.id, a.id);
  assert.equal(readPrograms(s).length, 2);
  removeProgram(s, a.id);
  assert.equal(readPrograms(s)[0].id, c.id);
});
test("legacy JSON round-trips, unknown fields are stripped and invalid imports are rejected", () => {
  const d = document();
  d.unknown = "ignored";
  d.initial[0].unknown = "ignored";
  const clean = programDocument(JSON.parse(JSON.stringify(d)));
  assert.equal(clean.format, "interactive-lab-cpu-memory");
  assert.equal(clean.unknown, undefined);
  assert.equal(clean.initial[0].unknown, undefined);
  assert.throws(() => programDocument({ ...d, format: "another-lab" }));
  assert.throws(() => programDocument({ ...d, initial: [] }));
  assert.throws(() =>
    programDocument({ ...d, config: { ...defaults, start: 32 } }),
  );
});
test("browser storage failures do not produce a false successful save", () => {
  const s = storage();
  s.setItem(SAVED_KEY, "malformed");
  assert.throws(() => readPrograms(s));
  assert.throws(() => saveProgram(s, document()));
  const denied = {
    getItem: () => null,
    setItem: () => {
      throw new Error("quota");
    },
  };
  assert.throws(() => saveProgram(denied, document()), /quota/);
});
test("directional transfer phases reflect cache hits, fills, write allocate and write through", () => {
  const e = { address: 18, base: 18, cell: { op: "data", arg: 12 } };
  assert.deepEqual(
    transferSteps({ ...e, kind: "read", hit: true }).map((s) => [s.from, s.to]),
    [["cache", "cpu"]],
  );
  assert.deepEqual(
    transferSteps({ ...e, kind: "fetch", hit: false }).map((s) => [
      s.from,
      s.to,
    ]),
    [
      ["ram", "cache"],
      ["cache", "cpu"],
    ],
  );
  assert.deepEqual(
    transferSteps({ ...e, kind: "write", hit: false }).map((s) => [
      s.from,
      s.to,
    ]),
    [
      ["ram", "cache"],
      ["cpu", "cache"],
      ["cache", "ram"],
    ],
  );
  assert.deepEqual(
    transferSteps({ ...e, kind: "write", hit: true }).map((s) => [
      s.from,
      s.to,
    ]),
    [
      ["cpu", "cache"],
      ["cache", "ram"],
    ],
  );
  assert.deepEqual(
    transferSteps({ ...e, kind: "read", hit: null }).map((s) => [s.from, s.to]),
    [["ram", "cpu"]],
  );
  assert.deepEqual(
    transferSteps({ ...e, kind: "write", hit: null }).map((s) => [
      s.from,
      s.to,
    ]),
    [["cpu", "ram"]],
  );
  assert.match(
    transferSteps({ ...e, kind: "write", hit: true })[1].label,
    /18番地：12/,
  );
});

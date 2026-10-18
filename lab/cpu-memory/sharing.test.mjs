import test from "node:test";
import assert from "node:assert/strict";
import { newProgram, programDocument } from "./documents.mjs";
import { defaults, OPS } from "./model.mjs";
import { encodeShare, decodeShare, isProgramShare } from "./sharing.mjs";

test("a new program is an independent, editable initial RAM and default configuration", () => {
  const a = newProgram(),
    b = newProgram();
  assert.equal(a.initial.length, 32);
  assert.deepEqual(a.initial[0], { op: "halt", arg: 0 });
  assert.ok(
    a.initial.slice(1).every((cell) => cell.op === "data" && cell.arg === 0),
  );
  assert.deepEqual(a.config, defaults);
  a.initial[16].arg = 99;
  a.config.blocks = 16;
  assert.equal(b.initial[16].arg, 0);
  assert.equal(defaults.blocks, 2);
});

test("share URLs preserve all instruction types, Japanese names, signed data and timing settings", () => {
  const doc = newProgram();
  doc.name = "計算・実験 🔬";
  OPS.forEach(([op], address) => {
    doc.initial[address] = { op, arg: op === "data" ? -123 : 31 };
  });
  doc.initial[16].arg = Number.MIN_SAFE_INTEGER;
  doc.config = {
    enabled: false,
    blocks: 16,
    cpuTime: 0.25,
    cacheTime: 0,
    ramTime: 101,
    start: 0,
  };
  const url = encodeShare(
    { ...doc, stats: { cpu: 10 }, records: ["private"], savedId: "private" },
    "https://example.test/lab/cpu-memory/?temporary=token#old",
  );
  assert.equal(new URL(url).pathname, "/lab/cpu-memory/");
  assert.equal(new URL(url).search, "");
  assert.ok(isProgramShare(new URL(url).hash));
  assert.deepEqual(decodeShare(url), programDocument(doc));
  assert.deepEqual(decodeShare(new URL(url).hash), programDocument(doc));
  assert.equal(
    new URL(encodeShare(doc, "file:///tmp/lab.html")).origin,
    "https://mei-chan-nel.com",
  );
  doc.initial[16].arg = 0;
  assert.equal(decodeShare(url).initial[16].arg, Number.MIN_SAFE_INTEGER);
});

test("malformed, oversized, foreign and invalid-instruction share URLs are rejected", () => {
  const valid = encodeShare(newProgram(), "https://example.test/");
  for (const raw of [
    "",
    "#lc1.abc",
    "#cm2.abc",
    "#cm1.A",
    "#cm1._",
    "#cm1.%%%%",
    "#cm1." + "a".repeat(10001),
    valid.slice(0, -2),
  ])
    assert.throws(() => decodeShare(raw), /共有URL/);
  const packet = [
    1,
    "bad",
    Array.from({ length: 32 }, () => [0, 0]),
    [true, 2, 2, 40, 1],
  ];
  const hash = () =>
    "#cm1." + Buffer.from(JSON.stringify(packet)).toString("base64url");
  packet[2][0] = [99, 0];
  assert.throws(() => decodeShare(hash()), /共有URL/);
  packet[2][0] = [2, 32];
  assert.throws(() => decodeShare(hash()), /共有URL/);
  packet[2][0] = [0, 0];
  packet[3][0] = "true";
  assert.throws(() => decodeShare(hash()), /共有URL/);
  assert.equal(isProgramShare("#lab-guide"), false);
});

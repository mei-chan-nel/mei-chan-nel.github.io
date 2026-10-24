import test from "node:test";
import assert from "node:assert/strict";
import {
  Machine,
  defaults,
  copy,
  conditionKey,
  timeBreakdown,
} from "./model.mjs";
import { presets } from "./presets.mjs";
const run = (memory, config = {}) => {
  const m = new Machine(memory, { ...defaults, ...config });
  for (let i = 0; i < 10000 && !m.halted && !m.error; i++) m.step();
  assert.equal(m.error, "");
  assert.equal(m.halted, true);
  return m;
};
const blank = () => Array.from({ length: 32 }, () => ({ op: "data", arg: 0 }));
test("all presets give the same CPU and RAM results at every cache capacity", () => {
  for (const [i, preset] of presets.entries()) {
    const off = run(preset.memory, { enabled: false });
    assert.equal(off.acc, [12, 12, 10, 10, 0][i]);
    for (const blocks of [1, 2, 4, 8, 16]) {
      const on = run(preset.memory, { blocks });
      assert.deepEqual(on.ram, off.ram);
      assert.equal(on.acc, off.acc);
      assert.equal(on.steps, off.steps);
      assert.equal(
        on.stats.hits + on.stats.misses,
        on.stats.fetch + on.stats.read + on.stats.write,
      );
      assert.ok(on.cache.length <= blocks);
    }
  }
});
test("two-address fills, instruction sharing and explicit timing", () => {
  const m = new Machine(presets[0].memory, defaults);
  m.step();
  assert.equal(m.acc, 7);
  assert.equal(m.stats.wait, 84);
  assert.equal(m.stats.cpu, 1);
  assert.equal(m.stats.misses, 2);
  m.step();
  assert.equal(m.acc, 12);
  assert.deepEqual(
    m.events.map((e) => e.hit),
    [true, true],
  );
  assert.equal(m.stats.wait, 88);
  m.step();
  assert.equal(m.ram[18].arg, 12);
  assert.equal(m.stats.wait, 212);
  assert.equal(m.stats.ramReads, 4);
  assert.equal(m.stats.ramWrites, 1);
  m.step();
  assert.equal(m.stats.wait, 214);
  assert.equal(m.stats.cpu, 4);
  assert.deepEqual(timeBreakdown(m), { cpu: 4, cache: 14, ram: 200 });
  assert.equal(m.stats.hits, 3);
  assert.equal(m.stats.misses, 4);
  const off = run(presets[0].memory, { enabled: false });
  assert.equal(off.stats.wait, 280);
  assert.equal(off.stats.cpu, 4);
  assert.equal(off.stats.hits, 0);
  assert.deepEqual(timeBreakdown(off), { cpu: 4, cache: 0, ram: 280 });
  const legacy = m.result();
  delete legacy.stats.cache;
  delete legacy.stats.ram;
  assert.deepEqual(timeBreakdown(legacy), timeBreakdown(m));
});
test("cache lookup time includes misses and a write hit still charges RAM for write through", () => {
  const m = new Machine(blank(), { ...defaults, cacheTime: 3, ramTime: 11 });
  m.advance();
  assert.deepEqual(timeBreakdown(m), { cpu: 0, cache: 3, ram: 0 });
  assert.equal(m.stats.misses, 1);
  const access = new Machine(blank(), {
    ...defaults,
    cacheTime: 3,
    ramTime: 11,
  });
  access.access(16, "read");
  assert.deepEqual(timeBreakdown(access), { cpu: 0, cache: 3, ram: 11 });
  access.access(16, "write", 9);
  assert.equal(access.events.at(-1).hit, true);
  assert.deepEqual(timeBreakdown(access), { cpu: 0, cache: 6, ram: 22 });
  assert.equal(access.stats.wait, access.stats.cache + access.stats.ram);
  assert.equal(access.stats.ramReads, 1);
  assert.equal(access.stats.ramWrites, 1);
});
test("LRU uses every access, evicts the least recently used block, distinguishes first and capacity misses", () => {
  const m = new Machine(blank(), defaults);
  m.access(0, "fetch");
  m.access(16, "read");
  m.access(1, "fetch");
  m.access(18, "read");
  assert.equal(m.events.at(-1).evicted, 16);
  assert.match(m.events.at(-1).reason, /LRU/);
  m.access(17, "read");
  assert.equal(m.events.at(-1).evicted, 0);
  assert.match(m.events.at(-1).reason, /容量不足/);
  m.access(20, "read");
  assert.match(m.events.at(-1).reason, /初回ミス/);
});
test("write allocate and write through keep cache and RAM coherent, including overwritten instructions", () => {
  const memory = blank();
  memory[0] = { op: "halt", arg: 0 };
  const m = new Machine(memory, defaults);
  m.access(0, "write", 9);
  assert.equal(m.stats.wait, 82);
  assert.equal(m.ram[0].op, "data");
  assert.equal(m.cache[0].cells[0].arg, 9);
  assert.equal(m.access(0, "fetch").arg, 9);
  assert.equal(m.events.at(-1).hit, true);
  m.access(1, "write", 3);
  assert.equal(m.events.at(-1).cost, 42);
  assert.equal(m.ram[1].arg, 3);
  m.step();
  assert.match(m.error, /数値/);
});
test("branch when zero, unconditional branch and reset from untouched initial memory", () => {
  const first = run(presets[4].memory);
  assert.equal(first.steps, 25);
  assert.equal(first.ram[16].arg, 0);
  assert.equal(presets[4].memory[16].arg, 5);
  const again = run(first.initial);
  assert.deepEqual(again.result(), first.result());
  assert.notEqual(
    conditionKey(first.initial, 0),
    conditionKey(first.initial, 1),
  );
});
test("bad program references and overflow stop with an actionable error", () => {
  const memory = blank();
  memory[0] = { op: "load", arg: 1 };
  memory[1] = { op: "halt", arg: 0 };
  const m = new Machine(memory, defaults);
  m.step();
  assert.match(m.error, /命令/);
  assert.equal(m.steps, 0);
  const overflow = blank();
  overflow[0] = { op: "set", arg: Number.MAX_SAFE_INTEGER };
  overflow[1] = { op: "add", arg: 16 };
  overflow[16].arg = 1;
  const n = new Machine(overflow, defaults);
  n.step();
  n.step();
  assert.match(n.error, /整数/);
  assert.equal(n.acc, Number.MAX_SAFE_INTEGER);
  assert.throws(() => new Machine(blank(), { ...defaults, start: 32 }));
  assert.throws(() => new Machine(blank(), { ...defaults, ramTime: -1 }));
});
test("random edited programs preserve the mathematical result regardless of cache settings", () => {
  let seed = 137;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed;
  };
  for (let trial = 0; trial < 100; trial++) {
    const memory = blank();
    let expected = 0;
    for (let i = 16; i < 32; i++) memory[i].arg = (random() % 101) - 50;
    for (let i = 0; i < 12; i++) {
      const op = ["set", "load", "add", "sub", "store"][random() % 5],
        arg = op === "set" ? (random() % 101) - 50 : 16 + (random() % 16);
      memory[i] = { op, arg };
      if (op === "set") expected = arg;
    }
    memory[12] = { op: "halt", arg: 0 };
    // Independent scalar interpreter for these generated programs.
    const data = copy(memory);
    expected = 0;
    for (let i = 0; i < 12; i++) {
      const { op, arg } = data[i];
      if (op === "set") expected = arg;
      if (op === "load") expected = data[arg].arg;
      if (op === "add") expected += data[arg].arg;
      if (op === "sub") expected -= data[arg].arg;
      if (op === "store") data[arg] = { op: "data", arg: expected };
    }
    for (const config of [
      { enabled: false },
      { blocks: 1 },
      { blocks: 2 },
      { blocks: 16 },
    ]) {
      const result = run(memory, config);
      assert.equal(result.acc, expected);
      assert.deepEqual(result.ram, data);
    }
  }
});

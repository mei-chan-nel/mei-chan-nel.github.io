import test from "node:test";
import assert from "node:assert/strict";
import { Machine, defaults, copy } from "./model.mjs";
import { presets } from "./presets.mjs";
import { transferGeometry, transferSteps } from "./transfers.mjs";
const advance = (m) => {
  m.advance();
  return copy(m.phase);
};
test("fetch, decode, operand delivery and calculation are separate observable actions", () => {
  const m = new Machine(presets[0].memory, defaults);
  let p = advance(m);
  assert.equal(p.stage, "cache-request");
  assert.deepEqual([p.transfer.from, p.transfer.to], ["cpu", "cache"]);
  assert.equal(p.transfer.request, true);
  assert.equal(p.event.hit, undefined);
  assert.equal(m.stats.wait, 0);
  assert.equal(m.stats.misses, 0);
  p = advance(m);
  assert.equal(p.stage, "lookup");
  assert.equal(m.current, null);
  assert.equal(m.cache.length, 0);
  assert.equal(m.stats.wait, 2);
  assert.equal(m.stats.ramReads, 0);
  p = advance(m);
  assert.equal(p.stage, "ram-request");
  assert.deepEqual([p.transfer.from, p.transfer.to], ["cache", "ram"]);
  assert.equal(m.stats.ramReads, 0);
  p = advance(m);
  assert.equal(p.stage, "block-fill");
  assert.equal(m.cache.length, 1);
  assert.equal(m.current, null);
  assert.equal(m.stats.ramReads, 1);
  assert.equal(m.stats.wait, 42);
  assert.deepEqual([p.transfer.from, p.transfer.to], ["ram", "cache"]);
  p = advance(m);
  assert.equal(p.stage, "cpu-receive");
  assert.deepEqual(m.current, { op: "load", arg: 16 });
  assert.equal(m.acc, 0);
  assert.equal(m.steps, 0);
  assert.equal(m.stats.cpu, 0);
  p = advance(m);
  assert.equal(p.stage, "decode");
  assert.equal(m.events.length, 1);
  assert.equal(m.stats.read, 0);
  assert.equal(m.received, null);
  p = advance(m);
  assert.equal(p.stage, "cache-request");
  assert.deepEqual([p.transfer.from, p.transfer.to], ["cpu", "cache"]);
  p = advance(m);
  assert.equal(p.stage, "lookup");
  assert.deepEqual(p.focus, { device: "cache", address: 16 });
  assert.equal(m.stats.read, 1);
  assert.equal(m.stats.ramReads, 1);
  assert.equal(m.cache.length, 1);
  p = advance(m);
  assert.equal(p.stage, "ram-request");
  assert.deepEqual(p.focus, { device: "ram", address: 16 });
  p = advance(m);
  assert.equal(p.stage, "block-fill");
  assert.equal(m.stats.ramReads, 2);
  assert.equal(m.acc, 0);
  assert.equal(m.received, null);
  assert.equal(m.cache.find((c) => c.base === 16).cells[0].arg, 7);
  p = advance(m);
  assert.equal(p.stage, "cpu-receive");
  assert.equal(m.received.arg, 7);
  assert.equal(m.acc, 0);
  assert.equal(m.pc, 0);
  assert.equal(m.steps, 0);
  assert.equal(m.result().inProgress, true);
  assert.equal(m.stats.wait, 84);
  p = advance(m);
  assert.equal(p.stage, "complete");
  assert.equal(m.acc, 7);
  assert.equal(m.pc, 1);
  assert.equal(m.steps, 1);
  assert.equal(m.stats.cpu, 1);
  assert.equal(m.result().inProgress, false);
});
const snapshot = (machine) => {
  const { sequence, checkpoints, ...state } = machine;
  return copy(state);
};
test("back restores every observable state and replay resumes exactly, including partial writes, LRU, halt and errors", () => {
  const invalid = copy(presets[0].memory);
  invalid[0] = { op: "data", arg: 3 };
  for (const memory of [...presets.map((p) => p.memory), invalid]) {
    for (const config of [
      { ...defaults, blocks: 1 },
      { ...defaults, enabled: false },
    ]) {
      let machine = new Machine(memory, config);
      const states = [snapshot(machine)];
      while (!machine.halted && !machine.error) {
        machine.advance();
        states.push(snapshot(machine));
      }
      for (let i = states.length - 1; i > 0; i--) {
        machine = machine.back();
        assert.deepEqual(snapshot(machine), states[i - 1]);
        machine.advance();
        assert.deepEqual(snapshot(machine), states[i]);
        machine = machine.back();
      }
      assert.equal(machine.actions, 0);
      assert.equal(machine.back(), machine);
    }
  }
});
test("bounded checkpoint storage still allows undo all the way to the initial state", () => {
  const memory = copy(presets[0].memory);
  memory[0] = { op: "jump", arg: 0 };
  let machine = new Machine(memory, defaults);
  for (let i = 0; i < 70; i++) machine.step();
  assert.equal(machine.checkpoints.length, 64);
  while (machine.actions) machine = machine.back();
  assert.deepEqual(snapshot(machine), snapshot(new Machine(memory, defaults)));
});
test("a cache hit supplies the CPU without a RAM read or a RAM focus", () => {
  const m = new Machine(presets[0].memory, defaults);
  m.step();
  const before = m.stats.ramReads,
    phases = [];
  while (m.steps < 2) {
    phases.push(advance(m));
  }
  assert.equal(m.acc, 12);
  assert.equal(m.stats.ramReads, before);
  assert.equal(
    phases.some((p) => p.focus?.device === "ram"),
    false,
  );
  assert.equal(
    phases.some((p) => p.transfer?.from === "ram" || p.transfer?.to === "ram"),
    false,
  );
  assert.equal(
    phases.find((p) => p.stage === "lookup" && p.event.kind === "read").event
      .hit,
    true,
  );
});
test("write allocate fetches the old block, then updates cache, then mirrors the same CPU value to RAM", () => {
  const m = new Machine(presets[0].memory, defaults);
  m.step();
  m.step();
  let p;
  do {
    p = advance(m);
  } while (p.stage !== "block-fill" || p.event.kind !== "write");
  assert.equal(m.cache.find((c) => c.base === 18).cells[0].arg, 0);
  assert.equal(m.ram[18].arg, 0);
  assert.equal(m.steps, 2);
  p = advance(m);
  assert.equal(p.stage, "cache-write");
  assert.equal(m.cache.find((c) => c.base === 18).cells[0].arg, 12);
  assert.equal(m.ram[18].arg, 0);
  assert.equal(m.stats.ramWrites, 0);
  assert.equal(m.stats.wait, 172);
  p = advance(m);
  assert.equal(p.stage, "ram-write");
  assert.deepEqual([p.transfer.from, p.transfer.to], ["cpu", "ram"]);
  assert.equal(m.ram[18].arg, 12);
  assert.equal(m.stats.ramWrites, 1);
  assert.equal(m.stats.wait, 212);
  assert.equal(m.steps, 2);
  p = advance(m);
  assert.equal(p.stage, "complete");
  assert.equal(m.steps, 3);
  assert.equal(m.acc, 12);
});
test("phased and whole-instruction runs have identical results for every preset and cache setting", () => {
  for (const preset of presets)
    for (const config of [
      { ...defaults, enabled: false },
      ...[1, 2, 4, 8, 16].map((blocks) => ({ ...defaults, blocks })),
    ]) {
      const phased = new Machine(preset.memory, config),
        atomic = new Machine(preset.memory, config);
      for (let i = 0; i < 10000 && !phased.halted && !phased.error; i++)
        phased.advance();
      for (let i = 0; i < 10000 && !atomic.halted && !atomic.error; i++)
        atomic.step();
      assert.deepEqual(phased.result(), atomic.result());
      assert.deepEqual(phased.cache, atomic.cache);
      assert.equal(phased.error, "");
    }
});
test("one active phase draws only its own transfer, and receive endpoints lie inside target fields", () => {
  assert.deepEqual(transferSteps({ phaseTransfer: null }), []);
  assert.deepEqual(
    transferSteps({ phaseTransfer: { from: "cache", to: "cpu" } }),
    [{ from: "cache", to: "cpu" }],
  );
  const rect = { left: 10, top: 20 },
    a = { left: 10, right: 200, top: 30, bottom: 500, width: 190 },
    b = { left: 250, right: 500, top: 30, bottom: 500, width: 250 };
  const source = { left: 30, right: 180, top: 100, bottom: 160 },
    target = { left: 270, right: 480, top: 250, bottom: 290 };
  const p = transferGeometry(a, b, source, target, rect);
  assert.ok(p.tx + rect.left > target.left && p.tx + rect.left < target.right);
  assert.ok(p.ty + rect.top > target.top && p.ty + rect.top < target.bottom);
  const reverse = transferGeometry(b, a, target, source, rect);
  assert.ok(
    reverse.tx + rect.left > source.left &&
      reverse.tx + rect.left < source.right,
  );
  const vertical = transferGeometry(
    a,
    { ...b, left: 10, right: 500, top: 550, bottom: 800 },
    source,
    { left: 40, right: 300, top: 600, bottom: 640 },
    rect,
  );
  assert.ok(vertical.ty + rect.top > 600 && vertical.ty + rect.top < 640);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { OSSimulation, APP_CONFIG } from './simulation.mjs';

const ticks = (sim, count) => {
  let snapshot = sim.snapshot();
  for (let i = 0; i < count; i += 1) snapshot = sim.step();
  return snapshot;
};

const until = (sim, condition, limit = 300) => {
  let snapshot = sim.snapshot();
  for (let i = 0; i < limit; i += 1) {
    if (condition(snapshot)) return snapshot;
    snapshot = sim.step();
  }
  assert.fail('Expected simulation state was not reached within the tick limit');
};

function invariant(snapshot) {
  const { memory, apps, cpu } = snapshot;
  assert.equal(memory.used + memory.free, memory.total);
  assert.equal(memory.segments.reduce((sum, segment) => sum + segment.size, 0), memory.total);
  assert.equal(memory.used, memory.os + Object.values(apps).reduce((sum, app) => sum + app.memory, 0));
  assert.ok(memory.free >= 0);
  assert.ok(apps.music.music.buffer >= 0 && apps.music.music.buffer <= apps.music.music.capacity);
  assert.ok(apps.photo.photo.progress >= 0 && apps.photo.photo.progress <= 100);
  const running = Object.entries(apps).filter(([, app]) => app.state === 'running');
  assert.ok(running.length <= 1, 'Only one process can own the single core');
  if (running.length) assert.equal(running[0][0], cpu.owner);
  for (const app of Object.values(apps)) {
    if (!app.running) {
      assert.equal(app.memory, 0);
      assert.equal(app.state, 'stopped');
    }
  }
}

test('launch is an OS input; window selection and process lifecycle stay independent', () => {
  const sim = new OSSimulation();
  sim.view('photo');
  let snapshot = sim.launch('music');
  assert.equal(snapshot.time, 0);
  assert.equal(snapshot.apps.music.running, false);
  assert.equal(snapshot.pendingInputs.length, 1);
  snapshot = sim.step();
  assert.equal(snapshot.cpu.owner, 'os');
  assert.match(snapshot.cpu.task, /入力イベント/);
  assert.equal(snapshot.apps.music.running, true);
  assert.equal(snapshot.apps.music.state, 'waiting');
  assert.equal(snapshot.visible, 'photo');
  sim.view('music');
  snapshot = sim.close('music');
  assert.equal(snapshot.apps.music.running, true, 'Close is queued, not applied outside virtual time');
  snapshot = sim.step();
  assert.equal(snapshot.visible, 'music');
  assert.equal(snapshot.apps.music.state, 'stopped');
});

test('idle apps keep memory while the CPU is idle, and closing releases it', () => {
  const sim = new OSSimulation();
  sim.launch('web');
  let snapshot = ticks(sim, 5);
  assert.equal(snapshot.cpu.owner, 'idle');
  assert.equal(snapshot.apps.web.state, 'waiting');
  assert.equal(snapshot.apps.web.memory, APP_CONFIG.web.memory);
  const memory = snapshot.memory.used;
  snapshot = ticks(sim, 8);
  assert.equal(snapshot.memory.used, memory);
  sim.close('web');
  snapshot = sim.step();
  assert.equal(snapshot.memory.used, snapshot.memory.os);
  invariant(snapshot);
});

test('Web CPU request, device wait and render use the same clock and retain the loaded page', () => {
  const sim = new OSSimulation();
  sim.launch('web');
  sim.webLoad('space');
  let snapshot = until(sim, (s) => s.apps.web.web.phase === 'network');
  assert.equal(snapshot.apps.web.web.networkRemaining, 6);
  assert.equal(snapshot.history.filter((entry) => entry.owner === 'web').length, 3);
  assert.equal(snapshot.cpu.owner, 'web');
  assert.equal(snapshot.quantum.used, 3, 'The final request tick still displays the three CPU units it used');
  const startTime = snapshot.time;
  const retainedMemory = snapshot.apps.web.memory;
  snapshot = sim.step();
  assert.equal(snapshot.cpu.owner, 'os');
  assert.equal(snapshot.quantum.used, 0, 'OS intervals do not inherit the completed app time slice');
  snapshot = ticks(sim, 4);
  assert.equal(snapshot.apps.web.web.phase, 'network');
  assert.equal(snapshot.apps.web.web.networkRemaining, 1);
  assert.equal(snapshot.apps.web.memory, retainedMemory);
  snapshot = sim.step();
  assert.equal(snapshot.time, startTime + 6);
  assert.equal(snapshot.apps.web.web.phase, 'render');
  snapshot = until(sim, (s) => s.apps.web.web.page === 'space');
  assert.equal(snapshot.history.filter((entry) => entry.owner === 'web').length, 6);
  assert.equal(snapshot.quantum.used, 3, 'The final render tick retains its completed time slice');
  snapshot = ticks(sim, 3);
  assert.equal(snapshot.cpu.owner, 'idle');
  assert.equal(snapshot.apps.web.web.page, 'space');
  assert.equal(snapshot.apps.web.state, 'waiting');
  sim.webLoad('city');
  snapshot = sim.step();
  assert.equal(snapshot.apps.web.web.page, 'space', 'The old page remains visible during a new request');
  assert.equal(snapshot.apps.web.web.topic, 'city');
});

test('photo advances only on its CPU ticks, has OS timer switches, and frees workspace on completion', () => {
  const sim = new OSSimulation();
  sim.launch('photo');
  sim.startPhoto('mono');
  let previous = sim.snapshot();
  let photoTicks = 0;
  let sawWorkspace = false;
  for (let i = 0; i < 100; i += 1) {
    const snapshot = sim.step();
    invariant(snapshot);
    if (snapshot.cpu.owner === 'photo') photoTicks += 1;
    if (snapshot.apps.photo.photo.processing) {
      sawWorkspace = true;
      assert.equal(snapshot.apps.photo.memory, APP_CONFIG.photo.memory + 200);
    }
    if (snapshot.cpu.owner !== 'photo') {
      assert.equal(snapshot.apps.photo.photo.progress, previous.apps.photo.photo.progress);
    }
    assert.equal(snapshot.apps.photo.photo.completed, photoTicks);
    previous = snapshot;
    if (snapshot.apps.photo.photo.completedFilter) break;
  }
  assert.equal(sawWorkspace, true);
  assert.equal(photoTicks, 30);
  assert.equal(previous.apps.photo.photo.progress, 100);
  assert.equal(previous.apps.photo.photo.completedFilter, 'mono');
  assert.equal(previous.apps.photo.memory, APP_CONFIG.photo.memory);
  assert.ok(previous.history.some((entry) => entry.owner === 'os' && /タイマー割り込み/.test(entry.task)));
  assert.ok(previous.history.some((entry) => entry.owner === 'os' && /プロセス切り替え/.test(entry.task)));
});

test('three runnable apps share one core in slices no longer than three CPU ticks', () => {
  const sim = new OSSimulation();
  for (const id of ['web', 'music', 'photo']) sim.launch(id);
  sim.webLoad('nature');
  sim.toggleMusic();
  sim.startPhoto('sunset');
  const snapshot = ticks(sim, 110);
  let previous = null;
  let runLength = 0;
  const seen = new Set();
  for (const entry of snapshot.history) {
    invariant({ ...entry, cpu: { owner: entry.owner } });
    runLength = entry.owner === previous ? runLength + 1 : 1;
    previous = entry.owner;
    if (Object.hasOwn(APP_CONFIG, entry.owner)) {
      seen.add(entry.owner);
      assert.ok(runLength <= 3, `${entry.owner} exceeded the time slice`);
    }
  }
  assert.deepEqual([...seen].sort(), ['music', 'photo', 'web']);
  assert.equal(snapshot.apps.photo.photo.progress, 100, 'Background photo processing must eventually complete');
  assert.equal(snapshot.apps.web.web.page, 'nature');
});

test('music consumes the buffer while another app runs and refills only on its own CPU ticks', () => {
  const sim = new OSSimulation();
  sim.launch('music');
  sim.toggleMusic();
  until(sim, (s) => s.apps.music.music.buffer >= 20);
  sim.launch('photo');
  sim.startPhoto('warm');
  sim.view('photo');
  let previous = sim.snapshot();
  let backgroundConsumption = 0;
  let refillTicks = 0;
  for (let i = 0; i < 100; i += 1) {
    const snapshot = sim.step();
    invariant(snapshot);
    const before = previous.apps.music.music;
    const after = snapshot.apps.music.music;
    if (snapshot.cpu.owner === 'music') {
      refillTicks += 1;
      assert.ok(after.buffer > before.buffer, 'Only scheduled music work prepares more audio');
    } else if (before.buffer > 0) {
      assert.equal(after.buffer, before.buffer - 1);
      assert.equal(after.elapsed, before.elapsed + 1);
      if (snapshot.cpu.owner === 'photo') backgroundConsumption += 1;
    }
    previous = snapshot;
  }
  assert.ok(backgroundConsumption >= 20);
  assert.ok(refillTicks > 3);
  assert.equal(previous.apps.music.music.underruns, 0);
  assert.equal(previous.apps.music.music.playing, true);
  assert.equal(previous.visible, 'photo');
});

test('pausing music keeps its buffer; elapsed and buffer resume from retained values', () => {
  const sim = new OSSimulation();
  sim.launch('music');
  sim.toggleMusic();
  until(sim, (s) => s.apps.music.music.buffer >= 20);
  sim.toggleMusic();
  let snapshot = sim.step();
  const buffer = snapshot.apps.music.music.buffer;
  const elapsed = snapshot.apps.music.music.elapsed;
  snapshot = ticks(sim, 12);
  assert.equal(snapshot.apps.music.music.buffer, buffer);
  assert.equal(snapshot.apps.music.music.elapsed, elapsed);
  assert.equal(snapshot.apps.music.running, true);
  sim.toggleMusic();
  sim.step();
  snapshot = sim.step();
  assert.ok(snapshot.apps.music.music.elapsed > elapsed);
});

test('closing each active app cancels CPU work, device waits, buffering and workspace', () => {
  const sim = new OSSimulation();
  for (const id of ['web', 'music', 'photo']) sim.launch(id);
  sim.webLoad('city');
  sim.toggleMusic();
  sim.startPhoto('sunset');
  until(sim, (s) => s.apps.web.web.phase === 'network');
  for (const id of ['web', 'music', 'photo']) sim.close(id);
  let snapshot = ticks(sim, 3);
  assert.equal(snapshot.memory.used, snapshot.memory.os);
  snapshot = ticks(sim, 30);
  assert.equal(snapshot.cpu.owner, 'idle');
  assert.equal(snapshot.apps.web.web.page, null);
  assert.equal(snapshot.apps.music.music.buffer, 0);
  assert.equal(snapshot.apps.music.music.playing, false);
  assert.equal(snapshot.apps.photo.photo.progress, 0);
  assert.equal(snapshot.apps.photo.photo.processing, false);
  invariant(snapshot);
});

test('close discards stale queued app operations while preserving an explicit later relaunch', () => {
  const sim = new OSSimulation();
  sim.launch('photo');
  sim.close('photo');
  sim.startPhoto('mono');
  sim.launch('photo');
  sim.startPhoto('sunset');
  const snapshot = until(sim, (s) => s.apps.photo.photo.completedFilter === 'sunset');
  assert.equal(snapshot.apps.photo.photo.completed, 30);
  assert.equal(snapshot.events.filter((event) => /写真加工を開始/.test(event.message)).length, 1);
});

test('identical inputs produce identical snapshots, reset clears everything, and snapshots are detached', () => {
  const first = new OSSimulation();
  const second = new OSSimulation();
  for (const sim of [first, second]) {
    sim.launch('web');
    sim.launch('photo');
    sim.webLoad('space');
    sim.startPhoto('mono');
    ticks(sim, 40);
    sim.view('photo');
  }
  assert.deepEqual(first.snapshot(), second.snapshot());
  const detached = first.snapshot();
  detached.apps.photo.photo.progress = -10;
  detached.history[0].apps.web.memory = -1;
  assert.deepEqual(first.snapshot(), second.snapshot());
  assert.deepEqual(first.reset(), new OSSimulation().snapshot());
  assert.equal(first.snapshot().pendingInputs.length, 0);
  assert.equal(first.snapshot().history.length, 0);
});

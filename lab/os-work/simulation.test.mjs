import test from 'node:test';
import assert from 'node:assert/strict';
import { OSSimulation, APP_CONFIG, FOREGROUND_IDS, BACKGROUND_IDS } from './simulation.mjs';

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

test('track changes queue without advancing time, then reset audio while preserving playback, memory and display', () => {
  const sim = new OSSimulation();
  sim.launch('music');
  sim.toggleMusic();
  let snapshot = until(sim, (s) => s.apps.music.music.buffer >= 20);
  sim.view('photo');
  const previousTime = snapshot.time;
  const previousMemory = snapshot.memory;
  const previousAudio = snapshot.apps.music.music;
  snapshot = sim.selectTrack('duru-rondo');
  assert.equal(snapshot.time, previousTime);
  assert.deepEqual(snapshot.apps.music.music, previousAudio, 'Queued selections do not mutate the current track');
  assert.equal(snapshot.pendingInputs[0].type, 'selectTrack');
  snapshot = sim.step();
  assert.equal(snapshot.cpu.owner, 'os');
  assert.match(snapshot.cpu.task, /曲を切り替える/);
  assert.equal(snapshot.apps.music.music.track, 'duru-rondo');
  assert.equal(snapshot.apps.music.music.playing, true);
  assert.equal(snapshot.apps.music.music.buffer, 0);
  assert.equal(snapshot.apps.music.music.elapsed, 0);
  assert.equal(snapshot.apps.music.music.underruns, 0);
  assert.equal(snapshot.apps.music.music.buffering, true);
  assert.equal(snapshot.visible, 'photo');
  assert.deepEqual(snapshot.memory, previousMemory);
  assert.equal(snapshot.apps.music.state, 'ready');
  snapshot = sim.step();
  assert.equal(snapshot.cpu.owner, 'os');
  assert.equal(snapshot.apps.music.music.buffer, 0, 'OS switching does not create new audio');
  snapshot = sim.step();
  assert.equal(snapshot.cpu.owner, 'music');
  assert.equal(snapshot.apps.music.music.buffer, 8);
  assert.equal(snapshot.apps.music.music.track, 'duru-rondo');
  invariant(snapshot);
});

test('switching tracks in the middle of a music CPU slice discards old work safely', () => {
  const sim = new OSSimulation();
  sim.launch('music');
  sim.toggleMusic();
  let snapshot = until(sim, (s) => s.cpu.owner === 'music');
  assert.equal(snapshot.quantum.used, 1);
  assert.equal(snapshot.apps.music.music.buffer, 8);
  sim.selectTrack('duru-arcade-vibe');
  snapshot = sim.step();
  assert.equal(snapshot.apps.music.music.buffer, 0);
  assert.equal(snapshot.apps.music.music.track, 'duru-arcade-vibe');
  assert.equal(snapshot.apps.music.music.hasPlayed, false);
  snapshot = until(sim, (s) => s.cpu.owner === 'music');
  assert.equal(snapshot.quantum.used, 1, 'New audio begins a fresh time slice');
  assert.equal(snapshot.apps.music.music.buffer, 8);
  const switchTime = snapshot.time;
  snapshot = ticks(sim, 20);
  assert.ok(snapshot.apps.music.music.elapsed > 0);
  assert.equal(snapshot.apps.music.music.underruns, 0);
  assert.equal(snapshot.apps.music.music.track, 'duru-arcade-vibe');
  assert.ok(snapshot.history.filter((entry) => entry.time >= switchTime && entry.owner === 'music').length >= 3);
  invariant(snapshot);
});

test('selecting a track while music is stopped waits for play; selecting the same track preserves audio', () => {
  const sim = new OSSimulation();
  sim.launch('music');
  sim.step();
  sim.selectTrack('duru-rondo');
  let snapshot = sim.step();
  assert.equal(snapshot.apps.music.music.playing, false);
  assert.equal(snapshot.apps.music.music.track, 'duru-rondo');
  snapshot = ticks(sim, 6);
  assert.equal(snapshot.cpu.owner, 'idle');
  assert.equal(snapshot.apps.music.music.buffer, 0);
  sim.toggleMusic();
  snapshot = until(sim, (s) => s.apps.music.music.buffer >= 20);
  const music = snapshot.apps.music.music;
  const time = snapshot.time;
  snapshot = sim.selectTrack('duru-rondo');
  assert.equal(snapshot.time, time);
  assert.deepEqual(snapshot.apps.music.music, music);
  assert.equal(snapshot.pendingInputs.length, 0);
  // Selecting the original song while another selection is pending must queue
  // both requests in their actual order, rather than treating the last as a no-op.
  sim.selectTrack('duru-arcade-vibe');
  snapshot = sim.selectTrack('duru-rondo');
  assert.equal(snapshot.pendingInputs.length, 2);
  snapshot = ticks(sim, 2);
  assert.equal(snapshot.apps.music.music.track, 'duru-rondo');
});

test('closing music cancels stale track selections and a relaunch uses the default song', () => {
  const sim = new OSSimulation();
  sim.launch('music');
  sim.toggleMusic();
  until(sim, (s) => s.apps.music.music.buffer >= 20);
  sim.close('music');
  sim.selectTrack('duru-rondo');
  let snapshot = sim.step();
  assert.equal(snapshot.apps.music.running, false);
  assert.equal(snapshot.apps.music.music.track, 'roomscene-lofi');
  assert.equal(snapshot.pendingInputs.length, 0);
  sim.launch('music');
  snapshot = ticks(sim, 4);
  assert.equal(snapshot.apps.music.music.track, 'roomscene-lofi');
  assert.equal(snapshot.apps.music.music.playing, false);
  assert.equal(snapshot.apps.music.music.buffer, 0);
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

test('resident processes allocate memory without a foreground window or immediate CPU work', () => {
  const sim = new OSSimulation();
  assert.deepEqual([...FOREGROUND_IDS].sort(), ['music', 'photo', 'web']);
  assert.deepEqual([...BACKGROUND_IDS].sort(), ['notify', 'security', 'sync']);
  assert.deepEqual(BACKGROUND_IDS.map((id) => APP_CONFIG[id].memory).sort((a, b) => a - b), [64, 96, 128]);
  for (const id of [...FOREGROUND_IDS, ...BACKGROUND_IDS]) sim.launch(id);
  const snapshot = ticks(sim, 6);
  assert.equal(snapshot.memory.used, 1008);
  assert.equal(snapshot.memory.free, 16);
  assert.equal(snapshot.visible, 'web');
  for (const id of BACKGROUND_IDS) {
    const app = snapshot.apps[id];
    assert.equal(app.running, true);
    assert.equal(app.state, 'waiting');
    assert.equal(app.background.phase, 'waiting');
    assert.equal(app.background.cpuTicks, 0);
    assert.ok(app.background.nextEventAt > snapshot.time);
    assert.throws(() => sim.view(id), RangeError);
  }
  invariant(snapshot);
});

for (const [id, period, cpuTicks] of [['notify', 12, 2], ['sync', 18, 5], ['security', 26, 9]]) {
  test(`${id} wakes on the common clock, uses its specified CPU work, and schedules the next cycle after completion`, () => {
    const sim = new OSSimulation();
    const queued = sim.launch(id);
    assert.equal(queued.time, 0);
    assert.equal(queued.apps[id].running, false);
    let snapshot = sim.step();
    const launchTime = snapshot.time;
    assert.equal(snapshot.cpu.owner, 'os');
    assert.equal(snapshot.apps[id].background.nextEventAt, launchTime + period);
    snapshot = ticks(sim, period - 1);
    assert.equal(snapshot.time, launchTime + period - 1);
    assert.equal(snapshot.cpu.owner, 'idle');
    assert.equal(snapshot.apps[id].background.cpuTicks, 0);
    assert.equal(snapshot.apps[id].background.wakeups, 0);
    snapshot = sim.step();
    assert.equal(snapshot.cpu.owner, 'os', 'The wakeup must first be handled by an OS interrupt');
    assert.equal(snapshot.apps[id].state, 'ready');
    assert.equal(snapshot.apps[id].background.phase, 'work');
    assert.equal(snapshot.apps[id].background.wakeups, 1);
    assert.equal(snapshot.apps[id].background.cpuTicks, 0);
    assert.equal(snapshot.apps[id].background.nextEventAt, null);
    const memory = snapshot.apps[id].memory;
    snapshot = until(sim, (s) => s.apps[id].background.cycles === 1);
    const completedAt = snapshot.time;
    assert.equal(snapshot.apps[id].background.cpuTicks, cpuTicks);
    assert.equal(snapshot.history.filter((entry) => entry.owner === id).length, cpuTicks);
    assert.equal(snapshot.apps[id].background.phase, 'waiting');
    assert.equal(snapshot.apps[id].background.nextEventAt, completedAt + period);
    assert.equal(snapshot.apps[id].memory, memory);
    snapshot = ticks(sim, period - 1);
    assert.equal(snapshot.apps[id].background.wakeups, 1);
    assert.equal(snapshot.apps[id].background.cpuTicks, cpuTicks);
    snapshot = sim.step();
    assert.equal(snapshot.cpu.owner, 'os');
    assert.equal(snapshot.apps[id].background.wakeups, 2);
    invariant(snapshot);
  });
}

test('sync releases the CPU during its six common-time network ticks and resumes only after its completion interrupt', () => {
  const sim = new OSSimulation();
  sim.launch('sync');
  sim.launch('photo');
  sim.startPhoto('warm');
  let snapshot = until(sim, (s) => s.apps.sync.background.phase === 'network');
  assert.equal(snapshot.apps.sync.background.networkRemaining, 6);
  assert.equal(snapshot.apps.sync.background.cpuTicks, 3);
  const startedAt = snapshot.time;
  const memory = snapshot.apps.sync.memory;
  let otherCpuTicks = 0;
  for (let remaining = 5; remaining > 0; remaining -= 1) {
    snapshot = sim.step();
    assert.equal(snapshot.apps.sync.background.phase, 'network');
    assert.equal(snapshot.apps.sync.background.networkRemaining, remaining);
    assert.equal(snapshot.apps.sync.background.cpuTicks, 3);
    assert.equal(snapshot.apps.sync.memory, memory);
    assert.notEqual(snapshot.cpu.owner, 'sync');
    if (snapshot.cpu.owner === 'photo') otherCpuTicks += 1;
    invariant(snapshot);
  }
  snapshot = sim.step();
  assert.equal(snapshot.time, startedAt + 6);
  assert.equal(snapshot.cpu.owner, 'os');
  assert.equal(snapshot.apps.sync.background.phase, 'finish');
  assert.equal(snapshot.apps.sync.background.networkRemaining, 0);
  assert.equal(snapshot.apps.sync.background.cpuTicks, 3, 'A completion interrupt does not execute application work');
  assert.equal(snapshot.apps.sync.state, 'ready');
  assert.ok(otherCpuTicks > 0, 'Another runnable process should use the CPU during communication');
  snapshot = until(sim, (s) => s.apps.sync.background.cycles === 1);
  assert.equal(snapshot.apps.sync.background.cpuTicks, 5);
  invariant(snapshot);
});

test('all resident processes share the single core fairly with foreground work in slices of at most three ticks', () => {
  const sim = new OSSimulation();
  for (const id of [...BACKGROUND_IDS, 'music', 'photo']) sim.launch(id);
  sim.toggleMusic();
  sim.startPhoto('mono');
  let previousOwner = null;
  let sliceLength = 0;
  const seen = new Set();
  let snapshot;
  for (let i = 0; i < 240; i += 1) {
    snapshot = sim.step();
    invariant(snapshot);
    sliceLength = snapshot.cpu.owner === previousOwner ? sliceLength + 1 : 1;
    previousOwner = snapshot.cpu.owner;
    if (Object.hasOwn(APP_CONFIG, snapshot.cpu.owner)) {
      seen.add(snapshot.cpu.owner);
      assert.ok(sliceLength <= 3, `${snapshot.cpu.owner} exceeded its round-robin time slice`);
    }
  }
  assert.deepEqual([...seen].sort(), [...BACKGROUND_IDS, 'music', 'photo'].sort());
  assert.equal(snapshot.apps.photo.photo.completedFilter, 'mono');
  assert.equal(snapshot.apps.photo.photo.completed, 30);
  assert.ok(snapshot.apps.music.music.elapsed > 0);
  for (const id of BACKGROUND_IDS) {
    assert.ok(snapshot.apps[id].background.cycles >= 1, `${id} must not starve`);
    assert.ok(snapshot.apps[id].background.cpuTicks > 0);
  }
});

test('closing a waiting resident at its deadline cancels the wake interrupt and a relaunch gets a fresh deadline', () => {
  const sim = new OSSimulation();
  sim.launch('notify');
  let snapshot = sim.step();
  const deadline = snapshot.apps.notify.background.nextEventAt;
  snapshot = ticks(sim, deadline - snapshot.time - 1);
  sim.close('notify');
  snapshot = sim.step();
  assert.equal(snapshot.time, deadline);
  assert.equal(snapshot.apps.notify.running, false);
  assert.equal(snapshot.apps.notify.background.phase, 'stopped');
  assert.equal(snapshot.apps.notify.background.nextEventAt, null);
  assert.equal(snapshot.memory.used, snapshot.memory.os);
  for (let i = 0; i < 35; i += 1) {
    snapshot = sim.step();
    assert.deepEqual(snapshot.pendingInterrupts, []);
    if (i === 0) {
      assert.equal(snapshot.cpu.owner, 'os', 'The OS may finish managing the close input');
      assert.doesNotMatch(snapshot.cpu.task, /割り込み/);
    } else {
      assert.equal(snapshot.cpu.owner, 'idle', 'A closed process must not leave a delayed wake interrupt');
    }
    assert.equal(snapshot.apps.notify.background.cpuTicks, 0);
    assert.equal(snapshot.apps.notify.background.wakeups, 0);
    invariant(snapshot);
  }
  sim.launch('notify');
  snapshot = sim.step();
  assert.equal(snapshot.apps.notify.background.nextEventAt, snapshot.time + 12);
  assert.equal(snapshot.apps.notify.background.cycles, 0);
  assert.equal(snapshot.apps.notify.background.wakeups, 0);
});

test('closing sync during communication cancels the completion interrupt and releases its allocation', () => {
  const sim = new OSSimulation();
  sim.launch('sync');
  let snapshot = until(sim, (s) => s.apps.sync.background.phase === 'network');
  assert.equal(snapshot.apps.sync.background.networkRemaining, 6);
  sim.close('sync');
  snapshot = sim.step();
  assert.equal(snapshot.apps.sync.running, false);
  assert.equal(snapshot.apps.sync.background.phase, 'stopped');
  assert.equal(snapshot.apps.sync.background.networkRemaining, 0);
  assert.equal(snapshot.memory.used, snapshot.memory.os);
  for (let i = 0; i < 30; i += 1) {
    snapshot = sim.step();
    assert.deepEqual(snapshot.pendingInterrupts, []);
    if (i === 0) {
      assert.equal(snapshot.cpu.owner, 'os', 'The OS may finish managing the close input');
      assert.doesNotMatch(snapshot.cpu.task, /割り込み/);
    } else {
      assert.equal(snapshot.cpu.owner, 'idle', 'A canceled network wait must not produce a completion interrupt');
    }
    assert.equal(snapshot.apps.sync.background.cycles, 0);
    assert.equal(snapshot.apps.sync.background.cpuTicks, 0);
    invariant(snapshot);
  }
});

test('a failed launch leaves memory and existing work intact, and retry succeeds after memory is freed', () => {
  const sim = new OSSimulation();
  for (const id of ['photo', 'web', 'music']) sim.launch(id);
  sim.startPhoto('mono');
  let snapshot = ticks(sim, 4);
  assert.equal(snapshot.memory.used, 920);
  const memory = snapshot.memory;
  const photo = snapshot.apps.photo.photo;
  const queued = sim.launch('security');
  assert.equal(queued.lastFailure, null, 'Allocation is attempted only when the OS processes the input');
  snapshot = sim.step();
  assert.equal(snapshot.cpu.owner, 'os');
  assert.equal(snapshot.apps.security.running, false);
  assert.equal(snapshot.apps.security.memory, 0);
  assert.equal(snapshot.apps.security.background.nextEventAt, null);
  assert.deepEqual(snapshot.memory, memory);
  assert.deepEqual(snapshot.apps.photo.photo, photo);
  assert.equal(snapshot.lastFailure.id, 'security');
  assert.equal(snapshot.lastFailure.operation, 'launch');
  assert.equal(snapshot.lastFailure.required, 128);
  assert.equal(snapshot.lastFailure.available, 104);
  assert.equal(snapshot.lastFailure.time, snapshot.time);
  assert.ok(snapshot.lastFailure.message.length > 0);
  assert.deepEqual(snapshot.failures.security, snapshot.lastFailure);
  sim.close('web');
  sim.step();
  sim.launch('security');
  snapshot = sim.step();
  assert.equal(snapshot.apps.security.running, true);
  assert.equal(snapshot.apps.security.memory, 128);
  assert.equal(snapshot.apps.security.background.nextEventAt, snapshot.time + 26);
  assert.equal(snapshot.failures.security ?? null, null);
  assert.equal(snapshot.lastFailure, null);
  invariant(snapshot);
});

test('a failed workspace allocation preserves the completed image and progress, then retries without partial changes', () => {
  const sim = new OSSimulation();
  for (const id of FOREGROUND_IDS) sim.launch(id);
  sim.startPhoto('mono');
  let snapshot = until(sim, (s) => s.apps.photo.photo.completedFilter === 'mono');
  for (const id of BACKGROUND_IDS) sim.launch(id);
  snapshot = ticks(sim, 3);
  assert.equal(snapshot.memory.used, 1008);
  const photo = snapshot.apps.photo.photo;
  const memory = snapshot.memory;
  sim.startPhoto('sunset');
  snapshot = sim.step();
  assert.equal(snapshot.cpu.owner, 'os');
  assert.deepEqual(snapshot.apps.photo.photo, photo);
  assert.deepEqual(snapshot.memory, memory);
  assert.equal(snapshot.apps.photo.state, 'waiting');
  assert.equal(snapshot.lastFailure.id, 'photo');
  assert.equal(snapshot.lastFailure.operation, 'workspace');
  assert.equal(snapshot.lastFailure.required, 200);
  assert.equal(snapshot.lastFailure.available, 16);
  assert.equal(snapshot.lastFailure.time, snapshot.time);
  assert.deepEqual(snapshot.failures.photo, snapshot.lastFailure);
  sim.close('security');
  sim.close('sync');
  ticks(sim, 2);
  sim.startPhoto('sunset');
  snapshot = sim.step();
  assert.equal(snapshot.apps.photo.photo.processing, true);
  assert.equal(snapshot.apps.photo.photo.filter, 'sunset');
  assert.equal(snapshot.apps.photo.photo.completedFilter, 'mono', 'The prior image stays available while the new one is processed');
  assert.equal(snapshot.apps.photo.photo.progress, 0);
  assert.equal(snapshot.apps.photo.memory, APP_CONFIG.photo.memory + 200);
  assert.equal(snapshot.failures.photo ?? null, null);
  assert.equal(snapshot.lastFailure, null);
  snapshot = until(sim, (s) => s.apps.photo.photo.completedFilter === 'sunset');
  assert.equal(snapshot.apps.photo.photo.progress, 100);
  assert.equal(snapshot.apps.photo.memory, APP_CONFIG.photo.memory);
  invariant(snapshot);
});

test('clearing the newest allocation failure retains the earlier unresolved failure until its successful retry', () => {
  const sim = new OSSimulation();
  for (const id of FOREGROUND_IDS) sim.launch(id);
  sim.startPhoto('warm');
  sim.launch('notify');
  let snapshot = ticks(sim, 5);
  assert.equal(snapshot.memory.free, 40);
  sim.launch('sync');
  snapshot = sim.step();
  const earlier = snapshot.lastFailure;
  assert.equal(earlier.id, 'sync');
  sim.launch('security');
  snapshot = sim.step();
  assert.equal(snapshot.lastFailure.id, 'security');
  sim.close('security');
  snapshot = sim.step();
  assert.deepEqual(snapshot.lastFailure, earlier);
  assert.deepEqual(snapshot.failures.sync, earlier);
  assert.equal(snapshot.failures.security, undefined);
  sim.close('web');
  sim.step();
  sim.launch('sync');
  snapshot = sim.step();
  assert.equal(snapshot.apps.sync.running, true);
  assert.equal(snapshot.lastFailure, null);
  assert.deepEqual(snapshot.failures, {});
  invariant(snapshot);
});

test('closing an app clears its allocation failure and reset deterministically cancels resident timers and pending work', () => {
  const first = new OSSimulation();
  const second = new OSSimulation();
  for (const sim of [first, second]) {
    for (const id of [...FOREGROUND_IDS, ...BACKGROUND_IDS]) sim.launch(id);
    ticks(sim, 6);
    sim.startPhoto('sunset');
    let snapshot = sim.step();
    assert.equal(snapshot.lastFailure.operation, 'workspace');
    sim.close('photo');
    snapshot = sim.step();
    assert.equal(snapshot.failures.photo ?? null, null);
    assert.equal(snapshot.lastFailure, null);
    ticks(sim, 34);
    sim.close('notify');
    sim.launch('notify');
  }
  assert.deepEqual(first.snapshot(), second.snapshot());
  const detached = first.snapshot();
  detached.apps.sync.background.cpuTicks = -1;
  assert.deepEqual(first.snapshot(), second.snapshot());
  assert.deepEqual(first.reset(), new OSSimulation().snapshot());
  assert.equal(first.snapshot().lastFailure, null);
  assert.equal(Object.keys(first.snapshot().failures).length, 0);
  const snapshot = ticks(first, 80);
  assert.equal(snapshot.cpu.owner, 'idle');
  assert.equal(snapshot.memory.used, snapshot.memory.os);
  for (const id of BACKGROUND_IDS) {
    assert.equal(snapshot.apps[id].running, false);
    assert.equal(snapshot.apps[id].background.phase, 'stopped');
    assert.equal(snapshot.apps[id].background.nextEventAt, null);
    assert.equal(snapshot.apps[id].background.cpuTicks, 0);
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { OSSimulation, APP_CONFIG, FOREGROUND_IDS, BACKGROUND_IDS } from './simulation.mjs';

const ticks = (sim, count) => {
  let snapshot = sim.snapshot();
  for (let i = 0; i < count; i += 1) snapshot = sim.step();
  return snapshot;
};

const until = (sim, condition, limit = 600) => {
  let snapshot = sim.snapshot();
  for (let i = 0; i < limit; i += 1) {
    if (condition(snapshot)) return snapshot;
    snapshot = sim.step();
  }
  assert.fail('Expected simulation state was not reached within the tick limit');
};

const launchPhoto = (sim) => {
  sim.launch('photo');
  return until(sim, (s) => s.apps.photo.photo.phase === 'ready');
};

const waitFor = (snapshot, id) => snapshot.memoryWaits.find((wait) => wait.id === id);

const externalSchedule = (time, intervals) => {
  const arrivals = [];
  let next = intervals[0];
  let index = 1;
  while (next <= time) {
    arrivals.push(next);
    next += intervals[index % intervals.length];
    index += 1;
  }
  return { arrivals, next };
};

const EXTERNAL = {
  notify: { intervals: [12, 23, 17, 31], source: '通知の受信' },
  sync: { intervals: [18, 29, 41, 23], source: '別の端末のファイル更新' },
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
  for (const [id, app] of Object.entries(apps)) {
    if (!app.running) {
      assert.equal(app.memory, 0);
      assert.equal(app.state, app.memoryWait ? 'memory-wait' : 'stopped');
    }
    if (app.memoryWait) {
      assert.equal(app.state, 'memory-wait');
      assert.notEqual(cpu.owner, id, 'An allocation wait cannot consume application CPU time');
      assert.deepEqual(app.memoryWait, waitFor(snapshot, id));
    }
  }
  for (const id of BACKGROUND_IDS) assert.equal(apps[id].running, true);
  for (const id of ['notify', 'sync']) {
    const background = apps[id].background;
    assert.equal(background.receivedEvents, background.processedEvents + background.activeEvents + background.pendingEvents,
      `${id} must account for every received event exactly once`);
    assert.ok(snapshot.pendingInterrupts.filter((event) => event.id === id && event.type === 'wake').length <= 1,
      `${id} must not queue duplicate wake interrupts`);
  }
}

test('residents start at virtual time zero with memory, fixed deadlines and protected lifecycles', () => {
  const sim = new OSSimulation();
  const initial = sim.snapshot();
  assert.equal(initial.time, 0);
  assert.equal(initial.memory.used, 448);
  assert.equal(initial.memory.free, 576);
  assert.equal(initial.cpu.owner, 'idle');
  assert.deepEqual([...FOREGROUND_IDS].sort(), ['music', 'photo', 'web']);
  assert.deepEqual([...BACKGROUND_IDS].sort(), ['notify', 'security', 'sync']);
  for (const [id, memory, deadline] of [['notify', 64, 12], ['sync', 96, 18], ['security', 128, 26]]) {
    assert.equal(APP_CONFIG[id].memory, memory);
    assert.equal(initial.apps[id].running, true);
    assert.equal(initial.apps[id].state, 'waiting');
    assert.equal(initial.apps[id].background.phase, 'waiting');
    assert.equal(initial.apps[id].background.nextEventAt, deadline);
    assert.equal(initial.apps[id].background.cpuTicks, 0);
    assert.deepEqual(sim.launch(id), initial, 'Launching a resident is a no-op');
    assert.deepEqual(sim.close(id), initial, 'Closing a resident is a no-op');
    assert.throws(() => sim.view(id), RangeError);
  }
  assert.deepEqual(initial.memoryWaits, []);
  invariant(initial);
});

test('foreground launch and close are OS inputs, independent of the selected window', () => {
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
  assert.equal(snapshot.apps.music.state, 'ready');
  assert.equal(snapshot.visible, 'photo');
  sim.view('music');
  snapshot = sim.close('music');
  assert.equal(snapshot.apps.music.running, true);
  snapshot = sim.step();
  assert.equal(snapshot.visible, 'music');
  assert.equal(snapshot.apps.music.state, 'stopped');
  assert.equal(snapshot.memory.used, 448);
  invariant(snapshot);
});

test('idle foreground apps retain memory while resident work comes and goes; close releases only their allocation', () => {
  const sim = new OSSimulation();
  sim.launch('web');
  until(sim, (s) => s.apps.web.web.phase === 'loaded');
  let snapshot = until(sim, (s) => s.cpu.owner === 'idle');
  assert.equal(snapshot.apps.web.state, 'waiting');
  assert.equal(snapshot.apps.web.memory, APP_CONFIG.web.memory);
  const memory = snapshot.memory.used;
  for (let i = 0; i < 80; i += 1) {
    snapshot = sim.step();
    assert.equal(snapshot.memory.used, memory);
    assert.notEqual(snapshot.cpu.owner, 'web');
    invariant(snapshot);
  }
  sim.close('web');
  snapshot = sim.step();
  assert.equal(snapshot.memory.used, 448);
  assert.equal(snapshot.apps.web.memory, 0);
});

test('Web CPU requests, six-tick device waits and rendering share the clock and retain the loaded page', () => {
  const sim = new OSSimulation();
  sim.launch('web');
  sim.webLoad('space');
  let snapshot = until(sim, (s) => s.apps.web.web.phase === 'network');
  assert.equal(snapshot.apps.web.web.networkRemaining, 6);
  assert.equal(snapshot.history.filter((entry) => entry.owner === 'web').length, 3);
  assert.equal(snapshot.quantum.used, 3);
  const startedAt = snapshot.time;
  const memory = snapshot.apps.web.memory;
  for (let remaining = 5; remaining > 0; remaining -= 1) {
    snapshot = sim.step();
    assert.equal(snapshot.apps.web.web.phase, 'network');
    assert.equal(snapshot.apps.web.web.networkRemaining, remaining);
    assert.equal(snapshot.apps.web.memory, memory);
    assert.notEqual(snapshot.cpu.owner, 'web');
  }
  snapshot = sim.step();
  assert.equal(snapshot.time, startedAt + 6);
  assert.equal(snapshot.apps.web.web.networkRemaining, 0);
  snapshot = until(sim, (s) => s.apps.web.web.page === 'space');
  assert.equal(snapshot.history.filter((entry) => entry.owner === 'web').length, 6);
  assert.equal(snapshot.quantum.used, 3);
  snapshot = ticks(sim, 4);
  assert.equal(snapshot.apps.web.state, 'waiting');
  assert.equal(snapshot.apps.web.web.page, 'space');
  sim.webLoad('city');
  snapshot = sim.step();
  assert.equal(snapshot.apps.web.web.page, 'space');
  assert.equal(snapshot.apps.web.web.topic, 'city');
  snapshot = until(sim, (s) => s.apps.web.web.page === 'city');
  invariant(snapshot);
});

test('photo progress changes only on its CPU ticks and completion releases workspace', () => {
  const sim = new OSSimulation();
  launchPhoto(sim);
  sim.startPhoto('mono');
  let previous = sim.snapshot();
  let photoTicks = 0;
  let sawWorkspace = false;
  for (let i = 0; i < 300; i += 1) {
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

test('resident and foreground work share one core fairly with CPU slices no longer than three ticks', () => {
  const sim = new OSSimulation();
  sim.launch('music');
  launchPhoto(sim);
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
      assert.ok(sliceLength <= 3, `${snapshot.cpu.owner} exceeded its time slice`);
    }
  }
  assert.deepEqual([...seen].sort(), [...BACKGROUND_IDS, 'music', 'photo'].sort());
  assert.equal(snapshot.apps.photo.photo.completedFilter, 'mono');
  assert.equal(snapshot.apps.photo.photo.completed, 30);
  assert.ok(snapshot.apps.music.music.elapsed > 0);
  for (const id of BACKGROUND_IDS) assert.ok(snapshot.apps[id].background.cycles >= 1, `${id} must not starve`);
});

test('music uses its prepared buffer while other processes run and refills only on its CPU ticks', () => {
  const sim = new OSSimulation();
  sim.launch('music');
  until(sim, (s) => s.apps.music.music.buffer >= 20);
  launchPhoto(sim);
  sim.startPhoto('warm');
  sim.view('photo');
  let previous = sim.snapshot();
  let backgroundConsumption = 0;
  let refillTicks = 0;
  for (let i = 0; i < 160; i += 1) {
    const snapshot = sim.step();
    invariant(snapshot);
    const before = previous.apps.music.music;
    const after = snapshot.apps.music.music;
    if (snapshot.cpu.owner === 'music') {
      refillTicks += 1;
      assert.ok(after.buffer > before.buffer);
    } else if (before.buffer > 0) {
      assert.equal(after.buffer, before.buffer - 1);
      assert.equal(after.elapsed, before.elapsed + 1);
      if (snapshot.cpu.owner === 'photo' || BACKGROUND_IDS.includes(snapshot.cpu.owner)) backgroundConsumption += 1;
    }
    previous = snapshot;
  }
  assert.ok(backgroundConsumption >= 20);
  assert.ok(refillTicks > 3);
  assert.equal(previous.apps.music.music.playing, true);
  assert.equal(previous.visible, 'photo');
});

test('music pause retains audio and memory despite resident activity, and resume continues from that position', () => {
  const sim = new OSSimulation();
  sim.launch('music');
  until(sim, (s) => s.apps.music.music.buffer >= 20);
  sim.toggleMusic();
  let snapshot = sim.step();
  const buffer = snapshot.apps.music.music.buffer;
  const elapsed = snapshot.apps.music.music.elapsed;
  const memory = snapshot.apps.music.memory;
  snapshot = ticks(sim, 45);
  assert.equal(snapshot.apps.music.music.buffer, buffer);
  assert.equal(snapshot.apps.music.music.elapsed, elapsed);
  assert.equal(snapshot.apps.music.memory, memory);
  sim.toggleMusic();
  sim.step();
  snapshot = sim.step();
  assert.ok(snapshot.apps.music.music.elapsed > elapsed);
});

test('track selection is queued, retains playback intent, and resets audio without changing memory or display', () => {
  const sim = new OSSimulation();
  sim.launch('music');
  let snapshot = until(sim, (s) => s.apps.music.music.buffer >= 20);
  sim.view('photo');
  const time = snapshot.time;
  const memory = snapshot.memory;
  const audio = snapshot.apps.music.music;
  snapshot = sim.selectTrack('duru-rondo');
  assert.equal(snapshot.time, time);
  assert.deepEqual(snapshot.apps.music.music, audio);
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
  assert.deepEqual(snapshot.memory, memory);
  snapshot = until(sim, (s) => s.cpu.owner === 'music');
  assert.equal(snapshot.quantum.used, 1);
  assert.equal(snapshot.apps.music.music.buffer, 8);
  invariant(snapshot);
});

test('a track change during a music slice discards old work and begins a fresh time slice', () => {
  const sim = new OSSimulation();
  sim.launch('music');
  let snapshot = until(sim, (s) => s.cpu.owner === 'music');
  assert.equal(snapshot.quantum.used, 1);
  sim.selectTrack('duru-arcade-vibe');
  snapshot = sim.step();
  assert.equal(snapshot.apps.music.music.buffer, 0);
  assert.equal(snapshot.apps.music.music.track, 'duru-arcade-vibe');
  assert.equal(snapshot.apps.music.music.hasPlayed, false);
  snapshot = until(sim, (s) => s.cpu.owner === 'music');
  assert.equal(snapshot.quantum.used, 1);
  assert.equal(snapshot.apps.music.music.buffer, 8);
  snapshot = ticks(sim, 35);
  assert.ok(snapshot.apps.music.music.elapsed > 0);
  assert.equal(snapshot.apps.music.music.track, 'duru-arcade-vibe');
  invariant(snapshot);
});

test('selecting a paused track waits for play, and selecting the current track preserves audio', () => {
  const sim = new OSSimulation();
  sim.launch('music');
  sim.step();
  sim.toggleMusic();
  sim.step();
  sim.selectTrack('duru-rondo');
  let snapshot = sim.step();
  snapshot = ticks(sim, 35);
  assert.equal(snapshot.apps.music.music.playing, false);
  assert.equal(snapshot.apps.music.music.track, 'duru-rondo');
  assert.equal(snapshot.apps.music.music.buffer, 0);
  sim.toggleMusic();
  snapshot = until(sim, (s) => s.apps.music.music.buffer >= 20);
  const audio = snapshot.apps.music.music;
  const time = snapshot.time;
  snapshot = sim.selectTrack('duru-rondo');
  assert.equal(snapshot.time, time);
  assert.deepEqual(snapshot.apps.music.music, audio);
  assert.equal(snapshot.pendingInputs.length, 0);
  sim.selectTrack('duru-arcade-vibe');
  snapshot = sim.selectTrack('duru-rondo');
  assert.equal(snapshot.pendingInputs.length, 2);
  snapshot = ticks(sim, 2);
  assert.equal(snapshot.apps.music.music.track, 'duru-rondo');
});

test('close cancels foreground CPU, network and audio work while residents continue normally', () => {
  const sim = new OSSimulation();
  sim.launch('web');
  sim.launch('music');
  sim.webLoad('city');
  until(sim, (s) => s.apps.web.web.phase === 'network');
  sim.close('web');
  sim.close('music');
  sim.selectTrack('duru-rondo');
  let snapshot = ticks(sim, 2);
  assert.equal(snapshot.memory.used, 448);
  assert.equal(snapshot.pendingInputs.length, 0);
  snapshot = ticks(sim, 70);
  assert.equal(snapshot.apps.web.web.page, null);
  assert.equal(snapshot.apps.music.music.buffer, 0);
  assert.equal(snapshot.apps.music.music.playing, false);
  assert.equal(snapshot.apps.music.music.track, 'roomscene-lofi');
  assert.ok(BACKGROUND_IDS.some((id) => snapshot.apps[id].background.cpuTicks > 0));
  sim.launch('music');
  snapshot = ticks(sim, 4);
  assert.equal(snapshot.apps.music.music.track, 'roomscene-lofi');
  assert.equal(snapshot.apps.music.music.playing, true);
  invariant(snapshot);
});

test('close discards stale queued photo operations but preserves an explicit later relaunch', () => {
  const sim = new OSSimulation();
  sim.launch('photo');
  sim.close('photo');
  sim.startPhoto('mono');
  launchPhoto(sim);
  sim.startPhoto('sunset');
  const snapshot = until(sim, (s) => s.apps.photo.photo.completedFilter === 'sunset');
  assert.equal(snapshot.apps.photo.photo.completed, 30);
  assert.equal(snapshot.events.filter((event) => /写真加工を開始/.test(event.message)).length, 1);
  invariant(snapshot);
});

for (const [id, firstArrival, secondArrival, cpuTicks] of [['notify', 12, 35, 2], ['sync', 18, 47, 5]]) {
  test(`${id} handles an external arrival with exact batch work, then waits for the next absolute arrival`, () => {
    const sim = new OSSimulation();
    let snapshot = ticks(sim, firstArrival - 1);
    assert.equal(snapshot.apps[id].background.cpuTicks, 0);
    assert.equal(snapshot.apps[id].background.wakeups, 0);
    snapshot = sim.step();
    assert.equal(snapshot.time, firstArrival);
    assert.notEqual(snapshot.cpu.owner, id);
    snapshot = until(sim, (s) => s.apps[id].background.wakeups === 1);
    assert.equal(snapshot.cpu.owner, 'os', 'Wakeup becomes runnable through an OS interrupt');
    assert.equal(snapshot.apps[id].state, 'ready');
    assert.equal(snapshot.apps[id].background.phase, 'work');
    assert.equal(snapshot.apps[id].background.cpuTicks, 0);
    assert.equal(snapshot.apps[id].background.nextEventAt, secondArrival);
    assert.equal(snapshot.apps[id].background.activeEvents, 1);
    assert.equal(snapshot.apps[id].background.lastSource, EXTERNAL[id].source);
    const memory = snapshot.apps[id].memory;
    snapshot = until(sim, (s) => s.apps[id].background.cycles === 1);
    assert.ok(snapshot.time < secondArrival);
    assert.equal(snapshot.apps[id].background.cpuTicks, cpuTicks);
    assert.equal(snapshot.apps[id].background.processedEvents, 1);
    assert.equal(snapshot.apps[id].background.phase, 'waiting');
    assert.equal(snapshot.apps[id].background.nextEventAt, secondArrival, 'Completion must not shift an external source clock');
    assert.equal(snapshot.apps[id].memory, memory);
    snapshot = ticks(sim, secondArrival - snapshot.time - 1);
    assert.equal(snapshot.apps[id].background.wakeups, 1);
    assert.equal(snapshot.apps[id].background.cpuTicks, cpuTicks);
    snapshot = until(sim, (s) => s.apps[id].background.wakeups === 2);
    assert.equal(snapshot.cpu.owner, 'os');
    invariant(snapshot);
  });
}

test('security runs a periodic quick scan and schedules its next cycle after completion', () => {
  const sim = new OSSimulation();
  let snapshot = ticks(sim, 25);
  assert.equal(snapshot.apps.security.background.cpuTicks, 0);
  snapshot = until(sim, (s) => s.apps.security.background.wakeups === 1);
  assert.equal(snapshot.cpu.owner, 'os');
  assert.equal(snapshot.apps.security.state, 'ready');
  assert.equal(snapshot.apps.security.background.nextEventAt, null);
  assert.equal(snapshot.apps.security.background.lastSource, '定期スキャン');
  snapshot = until(sim, (s) => s.apps.security.background.cycles === 1);
  const completedAt = snapshot.time;
  assert.equal(snapshot.apps.security.background.cpuTicks, 9);
  assert.equal(snapshot.apps.security.background.nextEventAt, completedAt + 26);
  assert.ok(snapshot.history.some((entry) => entry.owner === 'security' && /定期クイックスキャン/.test(entry.task)));
  snapshot = ticks(sim, 25);
  assert.equal(snapshot.apps.security.background.wakeups, 1);
  assert.equal(snapshot.apps.security.background.cpuTicks, 9);
  snapshot = until(sim, (s) => s.apps.security.background.wakeups === 2);
  assert.equal(snapshot.cpu.owner, 'os');
  invariant(snapshot);
});

test('sync network wait lasts six shared ticks, lets photo run, and needs an OS completion interrupt before finishing', () => {
  const sim = new OSSimulation();
  launchPhoto(sim);
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
  assert.equal(snapshot.apps.sync.background.networkRemaining, 0);
  assert.notEqual(snapshot.cpu.owner, 'sync');
  snapshot = until(sim, (s) => s.apps.sync.background.phase === 'finish');
  assert.equal(snapshot.cpu.owner, 'os');
  assert.equal(snapshot.apps.sync.background.cpuTicks, 3);
  assert.equal(snapshot.apps.sync.state, 'ready');
  assert.ok(otherCpuTicks > 0);
  snapshot = until(sim, (s) => s.apps.sync.background.cycles === 1);
  assert.equal(snapshot.apps.sync.background.cpuTicks, 5);
  invariant(snapshot);
});

test('all foreground apps fit in base memory but photo workspace becomes a retained memory wait', () => {
  const sim = new OSSimulation();
  for (const id of FOREGROUND_IDS) sim.launch(id);
  let snapshot = until(sim, (s) => s.apps.photo.photo.phase === 'ready');
  assert.equal(snapshot.memory.used, 1008);
  assert.equal(snapshot.memory.free, 16);
  const before = snapshot.apps.photo.photo;
  sim.startPhoto('sunset');
  snapshot = sim.step();
  assert.equal(snapshot.cpu.owner, 'os');
  assert.equal(snapshot.apps.photo.running, true);
  assert.equal(snapshot.apps.photo.state, 'memory-wait');
  assert.deepEqual(snapshot.apps.photo.photo, before);
  assert.equal(snapshot.apps.photo.memory, APP_CONFIG.photo.memory);
  assert.equal(snapshot.memoryWaits.length, 1);
  assert.deepEqual(waitFor(snapshot, 'photo'), {
    id: 'photo', operation: 'workspace', required: 200, available: 16,
    requestedAt: snapshot.time, filter: 'sunset',
  });
  assert.deepEqual(snapshot.apps.photo.memoryWait, waitFor(snapshot, 'photo'));
  assert.equal(snapshot.lastFailure.id, 'photo');
  assert.equal(snapshot.lastFailure.operation, 'workspace');
  assert.equal(snapshot.lastFailure.required, 200);
  assert.equal(snapshot.lastFailure.available, 16);
  assert.deepEqual(snapshot.failures.photo, snapshot.lastFailure);
  for (let i = 0; i < 55; i += 1) {
    snapshot = sim.step();
    assert.equal(snapshot.apps.photo.state, 'memory-wait');
    assert.equal(snapshot.apps.photo.photo.progress, 0);
    assert.notEqual(snapshot.cpu.owner, 'photo');
    invariant(snapshot);
  }
});

test('a blocked launch allocates automatically on an OS tick after photo completion frees workspace, without changing the view', () => {
  const sim = new OSSimulation();
  launchPhoto(sim);
  sim.startPhoto('mono');
  let snapshot = ticks(sim, 2);
  assert.equal(snapshot.memory.used, 888);
  sim.view('music');
  sim.launch('web');
  snapshot = sim.step();
  const requestedAt = snapshot.time;
  assert.equal(snapshot.apps.web.running, false);
  assert.equal(snapshot.apps.web.state, 'memory-wait');
  assert.equal(snapshot.apps.web.memory, 0);
  assert.deepEqual(waitFor(snapshot, 'web'), {
    id: 'web', operation: 'launch', required: 200, available: 136, requestedAt,
  });
  assert.equal(snapshot.lastFailure.operation, 'launch');
  assert.equal(snapshot.lastFailure.available, 136);
  while (!snapshot.apps.photo.photo.completedFilter) {
    assert.notEqual(snapshot.cpu.owner, 'web');
    assert.equal(snapshot.apps.web.running, false);
    invariant(snapshot);
    snapshot = sim.step();
  }
  const completedAt = snapshot.time;
  assert.equal(snapshot.cpu.owner, 'photo');
  assert.equal(snapshot.apps.web.state, 'memory-wait');
  assert.equal(snapshot.memory.free, 336);
  const eligibleLaunch = snapshot;
  for (let i = 0; i < 10; i += 1) assert.deepEqual(sim.snapshot(), eligibleLaunch, 'A paused eligible request must wait for an OS step');
  snapshot = sim.step();
  assert.equal(snapshot.time, completedAt + 1);
  assert.equal(snapshot.cpu.owner, 'os', 'Allocation itself consumes OS time');
  assert.equal(snapshot.apps.web.running, true);
  assert.equal(snapshot.apps.web.state, 'ready');
  assert.equal(snapshot.apps.web.web.phase, 'request');
  assert.equal(snapshot.apps.web.memory, APP_CONFIG.web.memory);
  assert.equal(snapshot.visible, 'music');
  assert.equal(snapshot.memory.used, 888);
  assert.equal(waitFor(snapshot, 'web'), undefined);
  assert.equal(snapshot.apps.web.memoryWait, null);
  assert.equal(snapshot.lastFailure, null);
  assert.equal(snapshot.failures.web ?? null, null);
  invariant(snapshot);
});

test('blocked photo keeps its previous image and original filter, then automatically starts after close frees memory', () => {
  const sim = new OSSimulation();
  launchPhoto(sim);
  sim.startPhoto('mono');
  let snapshot = until(sim, (s) => s.apps.photo.photo.completedFilter === 'mono');
  sim.launch('web');
  sim.launch('music');
  snapshot = ticks(sim, 2);
  assert.equal(snapshot.memory.used, 1008);
  const image = snapshot.apps.photo.photo;
  sim.startPhoto('sunset');
  snapshot = sim.step();
  const wait = waitFor(snapshot, 'photo');
  assert.deepEqual(snapshot.apps.photo.photo, image);
  assert.equal(snapshot.apps.photo.state, 'memory-wait');
  const waitingSnapshot = sim.snapshot();
  assert.deepEqual(sim.startPhoto('warm'), waitingSnapshot, 'A duplicate click must not queue input or overwrite the retained filter');
  assert.deepEqual(sim.startPhoto('mono'), waitingSnapshot);
  for (let i = 0; i < 20; i += 1) assert.deepEqual(sim.snapshot(), waitingSnapshot, 'Reading paused state must not advance time or allocate');
  sim.view('web');
  sim.close('web');
  snapshot = sim.step();
  assert.equal(snapshot.cpu.owner, 'os');
  assert.equal(snapshot.apps.web.running, false);
  assert.equal(snapshot.apps.photo.state, 'memory-wait', 'The close tick only releases memory');
  assert.equal(waitFor(snapshot, 'photo').requestedAt, wait.requestedAt);
  assert.equal(snapshot.memory.free, 216);
  const eligibleWorkspace = snapshot;
  for (let i = 0; i < 10; i += 1) assert.deepEqual(sim.snapshot(), eligibleWorkspace, 'Reading eligible state must not start processing');
  snapshot = sim.step();
  assert.equal(snapshot.cpu.owner, 'os');
  assert.equal(snapshot.apps.photo.photo.processing, true);
  assert.equal(snapshot.apps.photo.photo.filter, 'sunset');
  assert.equal(snapshot.apps.photo.photo.completedFilter, 'mono');
  assert.equal(snapshot.apps.photo.photo.progress, 0);
  assert.equal(snapshot.apps.photo.state, 'ready');
  assert.equal(snapshot.apps.photo.memory, APP_CONFIG.photo.memory + 200);
  assert.equal(snapshot.visible, 'web');
  assert.equal(waitFor(snapshot, 'photo'), undefined);
  assert.equal(snapshot.lastFailure, null);
  snapshot = until(sim, (s) => s.apps.photo.photo.completedFilter === 'sunset');
  assert.equal(snapshot.apps.photo.photo.progress, 100);
  assert.equal(snapshot.apps.photo.memory, APP_CONFIG.photo.memory);
  invariant(snapshot);
});

test('a smaller launch fits while an older larger request stays blocked and duplicate launches retain one request', () => {
  const sim = new OSSimulation();
  launchPhoto(sim);
  sim.startPhoto('warm');
  sim.launch('music');
  ticks(sim, 3);
  sim.launch('web');
  let snapshot = sim.step();
  const requestedAt = waitFor(snapshot, 'web').requestedAt;
  assert.equal(snapshot.memory.free, 16);
  assert.deepEqual(sim.launch('web'), snapshot);
  assert.deepEqual(sim.launch('web'), snapshot);
  assert.equal(sim.snapshot().memoryWaits.length, 1);
  sim.close('music');
  snapshot = sim.step();
  assert.equal(snapshot.memory.free, 136);
  assert.equal(snapshot.apps.web.state, 'memory-wait');
  sim.launch('music');
  snapshot = sim.step();
  assert.equal(snapshot.cpu.owner, 'os');
  assert.equal(snapshot.apps.music.running, true, 'A 120 MB request can use the available 136 MB');
  assert.equal(snapshot.apps.web.running, false, 'The older 200 MB request remains blocked');
  assert.equal(snapshot.memoryWaits.length, 1);
  assert.equal(waitFor(snapshot, 'web').requestedAt, requestedAt);
  assert.equal(waitFor(snapshot, 'web').available, 16);
  assert.equal(snapshot.apps.web.memory, 0);
  snapshot = until(sim, (s) => s.apps.web.running);
  assert.equal(snapshot.cpu.owner, 'os');
  assert.equal(snapshot.memory.used, 1008);
  assert.deepEqual(snapshot.memoryWaits, []);
  invariant(snapshot);
});

test('closing a pending launch cancels it even though the app never ran, and freed workspace cannot resurrect it', () => {
  const sim = new OSSimulation();
  launchPhoto(sim);
  sim.startPhoto('warm');
  sim.launch('web');
  let snapshot = ticks(sim, 3);
  assert.equal(snapshot.apps.web.state, 'memory-wait');
  sim.close('web');
  snapshot = sim.step();
  assert.equal(snapshot.apps.web.state, 'stopped');
  assert.equal(snapshot.apps.web.memoryWait, null);
  assert.equal(waitFor(snapshot, 'web'), undefined);
  assert.equal(snapshot.failures.web ?? null, null);
  assert.equal(snapshot.lastFailure, null);
  snapshot = until(sim, (s) => s.apps.photo.photo.completedFilter === 'warm');
  snapshot = ticks(sim, 60);
  assert.equal(snapshot.apps.web.running, false);
  assert.equal(snapshot.apps.web.state, 'stopped');
  assert.equal(snapshot.apps.web.memory, 0);
  assert.ok(snapshot.history.every((entry) => entry.owner !== 'web'));
  invariant(snapshot);
});

test('close wins over an eligible workspace allocation and cancels the retained operation permanently', () => {
  const sim = new OSSimulation();
  for (const id of FOREGROUND_IDS) sim.launch(id);
  until(sim, (s) => s.apps.photo.photo.phase === 'ready');
  sim.startPhoto('sunset');
  let snapshot = sim.step();
  assert.equal(snapshot.apps.photo.state, 'memory-wait');
  sim.close('web');
  sim.close('photo');
  snapshot = sim.step();
  assert.equal(snapshot.memory.free, 216);
  assert.equal(snapshot.apps.photo.state, 'memory-wait');
  snapshot = sim.step();
  assert.equal(snapshot.cpu.owner, 'os');
  assert.equal(snapshot.apps.photo.running, false, 'The queued close must win over automatic workspace allocation');
  assert.equal(snapshot.apps.photo.state, 'stopped');
  assert.equal(snapshot.apps.photo.memoryWait, null);
  assert.deepEqual(snapshot.memoryWaits, []);
  assert.equal(snapshot.lastFailure, null);
  ticks(sim, 70);
  sim.launch('photo');
  snapshot = sim.step();
  assert.equal(snapshot.apps.photo.running, true);
  assert.equal(snapshot.apps.photo.photo.processing, false);
  assert.equal(snapshot.apps.photo.photo.progress, 0);
  assert.equal(snapshot.apps.photo.photo.completedFilter, null);
  assert.equal(snapshot.apps.photo.memory, APP_CONFIG.photo.memory);
  snapshot = ticks(sim, 40);
  assert.equal(snapshot.apps.photo.photo.processing, false);
  assert.equal(snapshot.apps.photo.photo.progress, 0);
  invariant(snapshot);
});

test('identical inputs, resident timers and memory waits remain deterministic; snapshots detach and reset restores residents', () => {
  const first = new OSSimulation();
  const second = new OSSimulation();
  for (const sim of [first, second]) {
    for (const id of FOREGROUND_IDS) sim.launch(id);
    until(sim, (s) => s.apps.photo.photo.phase === 'ready');
    sim.startPhoto('sunset');
    ticks(sim, 35);
    sim.view('photo');
  }
  assert.deepEqual(first.snapshot(), second.snapshot());
  const detached = first.snapshot();
  detached.apps.sync.background.cpuTicks = -1;
  detached.apps.photo.memoryWait.filter = 'broken';
  detached.memoryWaits[0].required = -1;
  detached.history[0].apps.web.memory = -1;
  detached.failures.photo.available = -1;
  assert.deepEqual(first.snapshot(), second.snapshot());
  first.close('web');
  assert.deepEqual(first.reset(), new OSSimulation().snapshot());
  assert.equal(first.snapshot().lastFailure, null);
  assert.equal(Object.keys(first.snapshot().failures).length, 0);
  assert.deepEqual(first.snapshot().memoryWaits, []);
  assert.equal(first.snapshot().pendingInputs.length, 0);
  assert.equal(first.snapshot().pendingInterrupts.length, 0);
  const snapshot = ticks(first, 80);
  assert.equal(snapshot.memory.used, 448);
  for (const id of FOREGROUND_IDS) assert.equal(snapshot.apps[id].running, false);
  for (const id of BACKGROUND_IDS) assert.ok(snapshot.apps[id].background.cpuTicks > 0);
  invariant(snapshot);
});

test('irregular external arrivals use absolute shared-time schedules under both idle and heavy foreground input', () => {
  const idle = new OSSimulation();
  const loaded = new OSSimulation();
  loaded.launch('web');
  for (let time = 1; time <= 170; time += 1) {
    if (time > 1) loaded.webLoad(time % 2 ? 'space' : 'city');
    const idleSnapshot = idle.step();
    const loadedSnapshot = loaded.step();
    for (const [id, { intervals, source }] of Object.entries(EXTERNAL)) {
      const { arrivals, next } = externalSchedule(time, intervals);
      for (const snapshot of [idleSnapshot, loadedSnapshot]) {
        const background = snapshot.apps[id].background;
        assert.equal(background.receivedEvents, arrivals.length, `${id} arrival count at time ${time}`);
        assert.equal(background.nextEventAt, next, `${id} source clock must not depend on CPU completion`);
        assert.equal(background.lastEventAt, arrivals.at(-1) ?? null);
        if (arrivals.length) assert.equal(background.lastSource, source);
        invariant(snapshot);
      }
    }
  }
  assert.ok(idle.snapshot().apps.sync.background.processedEvents > loaded.snapshot().apps.sync.background.processedEvents,
    'The same arrivals should occur even when application work cannot yet run');
  assert.deepEqual(externalSchedule(95, EXTERNAL.notify.intervals).arrivals, [12, 35, 52, 83, 95]);
  assert.deepEqual(externalSchedule(129, EXTERNAL.sync.intervals).arrivals, [18, 47, 88, 111, 129]);
  const reset = loaded.reset();
  assert.deepEqual(reset, new OSSimulation().snapshot());
  const replay = new OSSimulation();
  for (let i = 0; i < 170; i += 1) assert.deepEqual(loaded.step(), replay.step());
});

test('sync performs no extra full cycles between remote changes when no photo has been saved', () => {
  const sim = new OSSimulation();
  let snapshot = ticks(sim, 17);
  assert.equal(snapshot.apps.sync.background.cycles, 0);
  assert.equal(snapshot.apps.sync.background.cpuTicks, 0);
  for (let cycle = 1; cycle <= 2; cycle += 1) {
    snapshot = until(sim, (s) => s.apps.sync.background.cycles === cycle);
    const nextArrival = snapshot.apps.sync.background.nextEventAt;
    const cpuTicks = snapshot.apps.sync.background.cpuTicks;
    assert.equal(snapshot.apps.sync.background.receivedEvents, cycle);
    assert.equal(snapshot.apps.sync.background.processedEvents, cycle);
    assert.equal(snapshot.apps.sync.background.phase, 'waiting');
    while (snapshot.time < nextArrival - 1) {
      snapshot = sim.step();
      assert.equal(snapshot.apps.sync.background.cycles, cycle);
      assert.equal(snapshot.apps.sync.background.cpuTicks, cpuTicks);
      assert.equal(snapshot.apps.sync.background.phase, 'waiting');
      assert.notEqual(snapshot.cpu.owner, 'sync');
      invariant(snapshot);
    }
    snapshot = sim.step();
    assert.equal(snapshot.apps.sync.background.receivedEvents, cycle + 1);
    assert.equal(snapshot.apps.sync.background.cycles, cycle);
  }
});

for (const [id, heldUntil, minimumPending, workPerBatch] of [['notify', 84, 3, 2], ['sync', 112, 3, 5]]) {
  test(`${id} batches arrivals received while busy without losing events or queuing duplicate wakes`, () => {
    const sim = new OSSimulation();
    sim.launch('web');
    let snapshot = until(sim, (s) => s.apps[id].background.wakeups === 1);
    assert.equal(snapshot.apps[id].background.activeEvents, 1);
    assert.equal(snapshot.apps[id].background.cpuTicks, 0);
    while (snapshot.time < heldUntil) {
      sim.webLoad('space');
      snapshot = sim.step();
      assert.equal(snapshot.cpu.owner, 'os');
      assert.equal(snapshot.apps[id].background.cpuTicks, 0);
      assert.equal(snapshot.apps[id].background.activeEvents, 1);
      assert.equal(snapshot.apps[id].background.cycles, 0);
      assert.equal(snapshot.pendingInterrupts.filter((event) => event.id === id && event.type === 'wake').length, 0,
        'Busy arrivals stay pending instead of creating redundant wake entries');
      invariant(snapshot);
    }
    assert.ok(snapshot.apps[id].background.pendingEvents >= minimumPending);
    assert.equal(snapshot.apps[id].background.receivedEvents,
      externalSchedule(snapshot.time, EXTERNAL[id].intervals).arrivals.length);
    assert.equal(snapshot.apps[id].background.lastSource, EXTERNAL[id].source);
    snapshot = until(sim, (s) => s.apps[id].background.cycles === 1);
    assert.equal(snapshot.apps[id].background.processedEvents, 1);
    assert.equal(snapshot.apps[id].background.cpuTicks, workPerBatch);
    assert.equal(snapshot.apps[id].background.activeEvents, 0);
    assert.ok(snapshot.apps[id].background.pendingEvents >= minimumPending);
    const pendingWake = snapshot.pendingInterrupts.filter((event) => event.id === id && event.type === 'wake');
    assert.equal(pendingWake.length, 1, 'Finishing the active batch queues exactly one wake for all pending arrivals');
    assert.equal(pendingWake[0].source, EXTERNAL[id].source);
    snapshot = until(sim, (s) => s.apps[id].background.wakeups === 2);
    assert.equal(snapshot.cpu.owner, 'os');
    const batchSize = snapshot.apps[id].background.activeEvents;
    assert.ok(batchSize >= minimumPending);
    assert.equal(snapshot.apps[id].background.pendingEvents, 0);
    snapshot = until(sim, (s) => s.apps[id].background.cycles === 2);
    assert.equal(snapshot.apps[id].background.processedEvents, 1 + batchSize);
    assert.equal(snapshot.apps[id].background.cpuTicks, workPerBatch * 2,
      'A coalesced batch uses fixed work rather than replaying the full work for each arrival');
    invariant(snapshot);
    for (let i = 0; i < 120; i += 1) invariant(sim.step());
    snapshot = until(sim, (s) => s.apps[id].background.receivedEvents === s.apps[id].background.processedEvents);
    assert.equal(snapshot.apps[id].background.activeEvents, 0);
    assert.equal(snapshot.apps[id].background.pendingEvents, 0);
    invariant(snapshot);
  });
}

test('only the final photo CPU tick saves a file and adds a local sync event; paused or memory-blocked work adds none', () => {
  const blocked = new OSSimulation();
  for (const id of FOREGROUND_IDS) blocked.launch(id);
  until(blocked, (s) => s.apps.photo.photo.phase === 'ready');
  blocked.startPhoto('warm');
  let snapshot = blocked.step();
  assert.equal(snapshot.apps.photo.state, 'memory-wait');
  for (let i = 0; i < 65; i += 1) {
    snapshot = blocked.step();
    assert.equal(snapshot.apps.photo.photo.progress, 0);
    assert.equal(snapshot.apps.sync.background.receivedEvents,
      externalSchedule(snapshot.time, EXTERNAL.sync.intervals).arrivals.length);
    assert.ok(snapshot.events.every((event) => !/写真の保存/.test(event.message)));
  }
  const sim = new OSSimulation();
  launchPhoto(sim);
  sim.startPhoto('mono');
  snapshot = ticks(sim, 2);
  const start = snapshot;
  for (let i = 0; i < 15; i += 1) assert.deepEqual(sim.snapshot(), start);
  assert.equal(snapshot.apps.sync.background.receivedEvents, 0);
  while (!snapshot.apps.photo.photo.completedFilter) {
    const before = snapshot;
    snapshot = sim.step();
    const remoteCount = externalSchedule(snapshot.time, EXTERNAL.sync.intervals).arrivals.length;
    if (!snapshot.apps.photo.photo.completedFilter) {
      assert.equal(snapshot.apps.sync.background.receivedEvents, remoteCount);
      assert.ok(snapshot.events.every((event) => !/写真の保存/.test(event.message)));
    } else {
      assert.equal(snapshot.cpu.owner, 'photo');
      assert.equal(before.apps.photo.photo.completed, 29);
      assert.equal(snapshot.apps.photo.photo.completed, 30);
      assert.equal(snapshot.apps.sync.background.receivedEvents, remoteCount + 1);
      assert.equal(snapshot.apps.sync.background.lastSource, '写真の保存');
      assert.equal(snapshot.apps.sync.background.lastEventAt, snapshot.time);
      assert.ok(snapshot.events.some((event) => event.time === snapshot.time && /写真の保存/.test(event.message)));
    }
    invariant(snapshot);
  }
  const saved = snapshot;
  for (let i = 0; i < 15; i += 1) assert.deepEqual(sim.snapshot(), saved);
  for (let i = 0; i < 70; i += 1) {
    snapshot = sim.step();
    assert.equal(snapshot.apps.sync.background.receivedEvents,
      externalSchedule(snapshot.time, EXTERNAL.sync.intervals).arrivals.length + 1,
      'Displaying a completed image must not save it again');
    invariant(snapshot);
  }
});

test('Web progress follows request CPU work, shared network time and render CPU work, with 100 only on completion', () => {
  const sim = new OSSimulation();
  assert.equal(sim.snapshot().apps.web.web.progress, 0);
  assert.equal(sim.snapshot().apps.web.web.completedLoads, 0);
  sim.launch('web');
  sim.webLoad('space');
  let snapshot = ticks(sim, 2);
  assert.equal(snapshot.apps.web.web.progress, 0);
  snapshot = until(sim, (s) => s.cpu.owner === 'web');
  assert.ok(Math.abs(snapshot.apps.web.web.progress - 20 / 3) < 1e-9);
  const requestProgress = snapshot.apps.web.web.progress;
  sim.launch('music');
  snapshot = sim.step();
  assert.equal(snapshot.cpu.owner, 'os');
  assert.equal(snapshot.apps.web.web.progress, requestProgress, 'An input interrupt must stall CPU-bound request work');
  snapshot = until(sim, (s) => s.apps.web.web.phase === 'network');
  assert.equal(snapshot.apps.web.web.progress, 20);
  const networkAt = snapshot.time;
  for (let remaining = 5; remaining > 0; remaining -= 1) {
    snapshot = sim.step();
    assert.equal(snapshot.apps.web.web.networkRemaining, remaining);
    assert.ok(Math.abs(snapshot.apps.web.web.progress - (20 + (6 - remaining) * 50 / 6)) < 1e-9);
    assert.equal(snapshot.apps.web.web.page, null);
    assert.equal(snapshot.apps.web.web.completedLoads, 0);
  }
  snapshot = sim.step();
  assert.equal(snapshot.time, networkAt + 6);
  assert.equal(snapshot.apps.web.web.progress, 70);
  assert.equal(snapshot.apps.web.web.completedLoads, 0);
  snapshot = until(sim, (s) => s.cpu.owner === 'web' && s.apps.web.web.phase === 'render');
  assert.equal(snapshot.apps.web.web.progress, 80);
  sim.close('music');
  snapshot = sim.step();
  assert.equal(snapshot.cpu.owner, 'os');
  assert.equal(snapshot.apps.web.web.progress, 80, 'An OS tick must stall CPU-bound rendering');
  while (snapshot.apps.web.web.page !== 'space') {
    const before = snapshot;
    snapshot = sim.step();
    if (snapshot.cpu.owner !== 'web') assert.equal(snapshot.apps.web.web.progress, before.apps.web.web.progress);
    if (snapshot.apps.web.web.page !== 'space') {
      assert.ok(snapshot.apps.web.web.progress < 100);
      assert.equal(snapshot.apps.web.web.completedLoads, 0);
    }
  }
  assert.equal(snapshot.cpu.owner, 'web');
  assert.equal(snapshot.apps.web.web.progress, 100);
  assert.equal(snapshot.apps.web.web.completedLoads, 1);
  sim.webLoad('city');
  snapshot = sim.step();
  assert.equal(snapshot.cpu.owner, 'os');
  assert.equal(snapshot.apps.web.web.progress, 0);
  assert.equal(snapshot.apps.web.web.page, 'space');
  assert.equal(snapshot.apps.web.web.completedLoads, 1);
  while (snapshot.apps.web.web.page !== 'city') {
    snapshot = sim.step();
    if (snapshot.apps.web.web.page !== 'city') {
      assert.ok(snapshot.apps.web.web.progress < 100);
      assert.equal(snapshot.apps.web.web.completedLoads, 1);
    }
    invariant(snapshot);
  }
  assert.equal(snapshot.cpu.owner, 'web');
  assert.equal(snapshot.apps.web.web.progress, 100);
  assert.equal(snapshot.apps.web.web.completedLoads, 2);
});

test('launch immediately requests the first page or first track and repeat launch preserves ongoing work', () => {
  for (const id of ['web', 'music']) {
    const sim = new OSSimulation();
    sim.launch(id);
    let snapshot = sim.step();
    assert.equal(snapshot.cpu.owner, 'os');
    assert.equal(snapshot.apps[id].state, 'ready');
    if (id === 'web') {
      assert.equal(snapshot.apps.web.web.topic, 'nature');
      assert.equal(snapshot.apps.web.web.phase, 'request');
      snapshot = until(sim, (s) => s.apps.web.web.phase === 'loaded');
      assert.equal(snapshot.apps.web.web.page, 'nature');
      assert.equal(snapshot.apps.web.web.completedLoads, 1);
      assert.equal(snapshot.history.filter((entry) => entry.owner === 'web').length, 6);
    } else {
      assert.equal(snapshot.apps.music.music.track, 'roomscene-lofi');
      assert.equal(snapshot.apps.music.music.playing, true);
      assert.equal(snapshot.apps.music.music.buffer, 0);
      snapshot = until(sim, (s) => s.apps.music.music.elapsed > 0);
      assert.ok(snapshot.history.some((entry) => entry.owner === 'music'));
      sim.toggleMusic(); sim.step();
      sim.selectTrack('duru-rondo'); snapshot = sim.step();
    }
    const app = snapshot.apps[id];
    const memory = snapshot.memory;
    sim.launch(id); snapshot = sim.step();
    assert.deepEqual(snapshot.apps[id].web ?? snapshot.apps[id].music, app.web ?? app.music);
    assert.deepEqual(snapshot.memory, memory);
    if (id === 'web') {
      sim.webLoad('space');
      until(sim, (s) => s.apps.web.web.page === 'space');
    }
    sim.close(id); sim.step();
    sim.launch(id); snapshot = sim.step();
    if (id === 'web') {
      assert.equal(snapshot.apps.web.web.topic, 'nature');
      assert.equal(snapshot.apps.web.web.phase, 'request');
    } else {
      assert.equal(snapshot.apps.music.music.track, 'roomscene-lofi');
      assert.equal(snapshot.apps.music.music.playing, true);
      assert.equal(snapshot.apps.music.music.buffer, 0);
    }
    invariant(snapshot);
  }
});

test('photo launch reads a file, waits without CPU, handles completion through OS and decodes only on its CPU ticks', () => {
  const sim = new OSSimulation();
  sim.launch('photo');
  let snapshot = sim.step();
  assert.equal(snapshot.apps.photo.photo.phase, 'request');
  assert.equal(snapshot.apps.photo.photo.loadProgress, 0);
  assert.equal(snapshot.apps.photo.memory, 240);
  sim.startPhoto('mono'); snapshot = sim.step();
  assert.equal(snapshot.apps.photo.photo.processing, false);
  assert.equal(snapshot.memoryWaits.length, 0);
  assert.match(snapshot.cpu.reason, /画像を読み込み中/);
  snapshot = until(sim, (s) => s.apps.photo.photo.phase === 'read');
  assert.equal(snapshot.apps.photo.photo.loadProgress, 20);
  assert.equal(snapshot.history.filter((entry) => entry.owner === 'photo').length, 2);
  const readAt = snapshot.time;
  for (let remaining = 3; remaining > 0; remaining--) {
    snapshot = sim.step();
    assert.equal(snapshot.apps.photo.photo.readRemaining, remaining);
    assert.equal(snapshot.apps.photo.photo.phase, 'read');
    assert.notEqual(snapshot.cpu.owner, 'photo');
    assert.equal(snapshot.apps.photo.memory, 240);
  }
  snapshot = sim.step();
  assert.equal(snapshot.time, readAt + 4);
  assert.equal(snapshot.apps.photo.photo.readRemaining, 0);
  assert.equal(snapshot.apps.photo.photo.loadProgress, 60);
  snapshot = until(sim, (s) => s.apps.photo.photo.phase === 'decode');
  assert.equal(snapshot.cpu.owner, 'os');
  assert.match(snapshot.cpu.task, /画像読み込み完了/);
  assert.equal(snapshot.apps.photo.state, 'ready');
  let decodeTicks = 0;
  while (snapshot.apps.photo.photo.phase !== 'ready') {
    const before = snapshot;
    snapshot = sim.step();
    if (snapshot.cpu.owner === 'photo') decodeTicks++;
    else assert.equal(snapshot.apps.photo.photo.loadProgress, before.apps.photo.photo.loadProgress);
    assert.equal(snapshot.apps.photo.photo.completed, 0);
    assert.equal(snapshot.apps.photo.photo.processing, false);
    if (snapshot.apps.photo.photo.phase !== 'ready') assert.ok(snapshot.apps.photo.photo.loadProgress < 100);
    invariant(snapshot);
  }
  assert.equal(decodeTicks, 3);
  assert.equal(snapshot.apps.photo.photo.loadProgress, 100);
  assert.equal(snapshot.apps.photo.memory, 240);
  const paused = sim.snapshot();
  assert.deepEqual(sim.snapshot(), paused);
  sim.startPhoto('mono'); snapshot = sim.step();
  assert.equal(snapshot.apps.photo.photo.processing, true);
  assert.equal(snapshot.apps.photo.memory, 440);
});

test('closing photo during storage wait cancels the device completion and relaunch starts a fresh image load', () => {
  const sim = new OSSimulation();
  sim.launch('photo');
  until(sim, (s) => s.apps.photo.photo.phase === 'read');
  sim.close('photo'); sim.step();
  let snapshot = ticks(sim, 30);
  assert.equal(snapshot.apps.photo.running, false);
  assert.equal(snapshot.apps.photo.photo.loadProgress, 0);
  assert.ok(snapshot.pendingInterrupts.every((entry) => entry.id !== 'photo'));
  sim.launch('photo'); snapshot = sim.step();
  assert.equal(snapshot.apps.photo.photo.phase, 'request');
  assert.equal(snapshot.apps.photo.photo.loadProgress, 0);
  snapshot = until(sim, (s) => s.apps.photo.photo.phase === 'ready');
  assert.equal(snapshot.apps.photo.photo.loadProgress, 100);
  invariant(snapshot);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { RecordedAudioController } from './audio-controller.mjs';
import { OSSimulation } from './simulation.mjs';

class FakeMedia {
  constructor() {
    this.paused = true;
    this.currentTime = 0;
    this.duration = 60;
    this.readyState = 4;
    this.volume = 1;
    this.muted = false;
    this.playCalls = 0;
    this.pauseCalls = 0;
    this.loadCalls = 0;
    this.src = '';
    this.requests = [];
    this.listeners = {};
  }
  addEventListener(type, listener) { (this.listeners[type] ??= []).push(listener); }
  emit(type) { for (const listener of this.listeners[type] ?? []) listener(); }
  play() {
    this.playCalls += 1;
    const promise = new Promise((resolve, reject) => {
      this.requests.push({
        resolve: () => { this.readyState = 4; this.paused = false; resolve(); },
        reject: (name) => reject(Object.assign(new Error(name), { name })),
      });
    });
    return promise;
  }
  pause() { this.pauseCalls += 1; this.paused = true; }
  load() { this.loadCalls += 1; this.readyState = 0; this.currentTime = 0; this.paused = true; }
}

const snapshot = ({ running = true, playing = true, buffer = 16, elapsed = 0, visible = 'music', cpu = 'music' } = {}) => ({
  visible, cpu: { owner: cpu }, apps: { music: { running, music: { playing, buffer, elapsed } } },
});
const settle = async () => { await Promise.resolve(); await Promise.resolve(); };
const create = () => {
  const media = new FakeMedia();
  let time = 0;
  const controller = new RecordedAudioController({ media, now: () => time });
  return { media, controller, advance: (milliseconds) => { time += milliseconds; } };
};

test('one recording keeps playing through view and CPU changes without repeated play calls', async () => {
  const { media, controller } = create();
  controller.sync(snapshot(), true);
  const unlocked = controller.unlock();
  media.requests[0].resolve();
  await unlocked;
  for (const [visible, cpu] of [['web', 'photo'], ['photo', 'os'], ['web', 'idle'], ['music', 'music']]) {
    controller.sync(snapshot({ visible, cpu, elapsed: 1 }), true);
  }
  assert.equal(media.playCalls, 1);
  assert.equal(media.paused, false);
  assert.equal(media.muted, false);
  assert.equal(media.loop, true);
});

test('ticks while play is pending do not duplicate requests', async () => {
  const { media, controller } = create();
  controller.sync(snapshot(), true);
  const unlocked = controller.unlock();
  for (let elapsed = 0; elapsed < 8; elapsed += 1) controller.sync(snapshot({ elapsed }), true);
  assert.equal(media.playCalls, 1);
  media.requests[0].resolve();
  await unlocked;
  assert.equal(media.currentTime, 0, 'Virtual elapsed time cannot skip ahead through unheard audio.');
});

for (const reason of ['OS pause', 'app close', 'music pause']) {
  test(`${reason} silences a pending play, even if it later resolves`, async () => {
    const { media, controller } = create();
    controller.sync(snapshot(), true);
    const unlocked = controller.unlock();
    const next = {
      'OS pause': [snapshot(), false],
      'app close': [snapshot({ running: false, elapsed: 0 }), true],
      'music pause': [snapshot({ playing: false }), true],
    }[reason];
    controller.sync(...next);
    assert.equal(media.paused, true);
    assert.equal(media.muted, true);
    media.requests[0].resolve();
    await unlocked;
    assert.equal(media.paused, true);
    assert.equal(media.muted, true);
  });
}

test('empty buffer silences transport and replenishment resumes without another play request', async () => {
  const { media, controller } = create();
  controller.sync(snapshot({ elapsed: 10 }), true);
  const unlocked = controller.unlock();
  media.requests[0].resolve();
  await unlocked;
  media.currentTime = 5.4;
  controller.sync(snapshot({ elapsed: 12, buffer: 0 }), true);
  assert.equal(media.paused, false);
  assert.equal(media.muted, true);
  // The already granted transport keeps running silently. A browser that
  // denies a subsequent programmatic play() must not strand the sound.
  media.play = () => {
    media.playCalls++;
    return Promise.reject(Object.assign(new Error('another gesture required'), { name: 'NotAllowedError' }));
  };
  media.currentTime = 12;
  media.emit('canplay');
  assert.equal(media.currentTime, 12, 'Do not keep seeking while the model has no data.');
  controller.sync(snapshot({ elapsed: 12, buffer: 8, cpu: 'photo', visible: 'web' }), true);
  assert.equal(media.playCalls, 1);
  await settle();
  assert.equal(media.paused, false);
  assert.equal(media.muted, false);
  assert.equal(media.currentTime, 5.4);
  assert.equal(controller.status, 'ready');
});

test('autoplay rejection waits for another gesture, which retries once', async () => {
  const statuses = [];
  const media = new FakeMedia();
  const controller = new RecordedAudioController({ media, onStatus: (status) => statuses.push(status) });
  controller.sync(snapshot(), true);
  const first = controller.unlock();
  media.requests[0].reject('NotAllowedError');
  assert.equal(await first, false);
  assert.equal(controller.status, 'blocked');
  for (let i = 0; i < 10; i += 1) controller.sync(snapshot(), true);
  assert.equal(media.playCalls, 1);
  const second = controller.unlock();
  assert.equal(media.playCalls, 2);
  media.requests[1].resolve();
  assert.equal(await second, true);
  assert.equal(controller.status, 'ready');
  assert.deepEqual(statuses, ['blocked', 'ready']);
});

test('a gesture safely primes a silent element before simulated audio is ready', async () => {
  const { media, controller } = create();
  const unlocked = controller.unlock();
  controller.sync(snapshot({ buffer: 0 }), true);
  assert.equal(media.muted, true);
  media.requests[0].resolve();
  await unlocked;
  assert.equal(media.paused, false);
  assert.equal(media.muted, true);
  controller.sync(snapshot({ buffer: 8 }), true);
  assert.equal(media.playCalls, 1);
  await settle();
  assert.equal(media.muted, false);
  assert.equal(media.paused, false);
});

test('volume and mute preferences persist across close and reset', async () => {
  const { media, controller } = create();
  assert.equal(controller.volume, 0.45);
  controller.setVolume(0.7);
  assert.equal(media.volume, 0.7);
  assert.equal(controller.toggleMute(), true);
  controller.sync(snapshot(), true);
  const unlocked = controller.unlock();
  media.requests[0].resolve();
  await unlocked;
  assert.equal(media.muted, true);
  controller.setMuted(false);
  assert.equal(media.muted, false);
  controller.reset();
  assert.equal(controller.volume, 0.7);
  assert.equal(controller.muted, false);
  controller.setVolume(5);
  assert.equal(media.volume, 1);
  controller.setVolume(-2);
  assert.equal(media.volume, 0);
});

test('the displayed playhead follows the recording and natural loop, without virtual-time correction', async () => {
  const { media, controller, advance } = create();
  controller.sync(snapshot(), true);
  const unlocked = controller.unlock();
  media.requests[0].resolve();
  await unlocked;
  media.currentTime = 45;
  controller.sync(snapshot({ elapsed: 100 }), true);
  assert.equal(controller.positionSeconds, 45);
  media.currentTime = 45.5;
  controller.sync(snapshot({ elapsed: 100 }), true);
  assert.equal(media.currentTime, 45.5, 'Minor wall-clock drift does not cause constant seeking.');
  media.currentTime = 30;
  controller.sync(snapshot({ elapsed: 100 }), true);
  assert.equal(media.currentTime, 30, 'Repeated render calls cannot immediately seek again.');
  advance(2000);
  controller.sync(snapshot({ elapsed: 100 }), true);
  assert.equal(media.currentTime, 30);
  advance(2000);
  media.currentTime = 0.3;
  controller.sync(snapshot({ elapsed: 140 }), true);
  assert.equal(media.currentTime, 0.3);
  assert.equal(controller.positionSeconds, 0.3);
});

test('reset clears position immediately and after an old play promise resolves', async () => {
  const { media, controller } = create();
  controller.sync(snapshot({ elapsed: 40 }), true);
  const unlocked = controller.unlock();
  controller.reset();
  assert.equal(media.currentTime, 0);
  assert.equal(media.paused, true);
  media.requests[0].resolve();
  await unlocked;
  assert.equal(media.currentTime, 0);
  assert.equal(media.paused, true);
  assert.equal(media.muted, true);
});

test('quick pause and resume recover when the previous play request was aborted', async () => {
  const { media, controller, advance } = create();
  controller.sync(snapshot(), true);
  const first = controller.unlock();
  controller.sync(snapshot(), false);
  controller.sync(snapshot(), true);
  assert.equal(media.playCalls, 1);
  media.requests[0].reject('AbortError');
  assert.equal(await first, false);
  assert.equal(media.playCalls, 1);
  advance(499); controller.sync(snapshot(), true);
  assert.equal(media.playCalls, 1);
  advance(1); controller.sync(snapshot(), true);
  assert.equal(media.playCalls, 2);
  media.requests[1].resolve();
  await settle();
  assert.equal(media.paused, false);
  assert.equal(media.muted, false);
});

test('reset then restart waits for an obsolete pending request before starting another', async () => {
  const { media, controller } = create();
  controller.sync(snapshot({ elapsed: 40 }), true);
  const first = controller.unlock();
  controller.reset();
  controller.sync(snapshot({ elapsed: 0 }), true);
  controller.unlock();
  assert.equal(media.playCalls, 1);
  media.requests[0].resolve();
  await first;
  assert.equal(media.playCalls, 1, 'A stale promise must not recursively restart playback.');
  controller.sync(snapshot(), true);
  assert.equal(media.playCalls, 2);
  media.requests[1].resolve();
  await settle();
  assert.equal(media.paused, false);
  assert.equal(media.currentTime, 0);
});

test('a late playing event cannot restart sound after app close', async () => {
  const { media, controller } = create();
  controller.sync(snapshot(), true);
  const unlocked = controller.unlock();
  controller.sync(snapshot({ running: false }), true);
  media.paused = false;
  media.emit('playing');
  assert.equal(media.paused, true);
  assert.equal(media.muted, true);
  media.requests[0].resolve();
  await unlocked;
});

test('a failed recording is reported without repeated requests', async () => {
  const { media, controller } = create();
  controller.sync(snapshot(), true);
  const unlocked = controller.unlock();
  media.requests[0].reject('NotSupportedError');
  assert.equal(await unlocked, false);
  assert.equal(controller.status, 'error');
  controller.sync(snapshot(), true);
  assert.equal(media.playCalls, 1);
});

test('switching recordings pauses immediately, preserves settings and primes the same element', async () => {
  const { media, controller } = create();
  controller.sync(snapshot({ elapsed: 40 }), true);
  const first = controller.unlock();
  media.requests[0].resolve();
  await first;
  controller.setVolume(0.3);
  controller.setMuted(true);
  assert.equal(controller.setSource('audio/second.mp3'), true);
  assert.equal(controller.media, media);
  assert.equal(media.src, 'audio/second.mp3');
  assert.equal(media.loadCalls, 1);
  assert.equal(media.paused, true);
  assert.equal(media.currentTime, 0);
  assert.equal(controller.status, 'loading');
  assert.equal(controller.volume, 0.3);
  assert.equal(controller.muted, true);
  const second = controller.unlock();
  assert.equal(media.playCalls, 2);
  assert.equal(media.muted, true);
  controller.sync(snapshot({ elapsed: 0, buffer: 0 }), false);
  media.requests[1].resolve();
  await second;
  assert.equal(media.paused, true);
  controller.setMuted(false);
  controller.sync(snapshot({ elapsed: 0, buffer: 8 }), true);
  assert.equal(media.playCalls, 3);
  media.requests[2].resolve();
  await settle();
  assert.equal(media.paused, false);
  assert.equal(media.volume, 0.3);
  assert.equal(media.muted, false);
});

test('selecting the same recording twice does not reload or reset its position', async () => {
  const { media, controller } = create();
  assert.equal(controller.setSource('audio/first.mp3'), true);
  controller.sync(snapshot({ elapsed: 20 }), true);
  const unlocked = controller.unlock();
  media.requests[0].resolve();
  await unlocked;
  media.currentTime = 9;
  assert.equal(media.currentTime, 9);
  assert.equal(controller.setSource('audio/first.mp3'), false);
  assert.equal(media.currentTime, 9);
  assert.equal(media.paused, false);
  assert.equal(media.loadCalls, 1);
  assert.equal(media.playCalls, 1);
});

for (const rejection of ['NotAllowedError', 'NotSupportedError', 'AbortError']) {
  test(`a late old-source ${rejection} does not stop or reclassify the selected recording`, async () => {
    const { media, controller } = create();
    controller.setSource('audio/first.mp3');
    controller.sync(snapshot(), true);
    const first = controller.unlock();
    controller.setSource('audio/second.mp3');
    const second = controller.unlock();
    controller.sync(snapshot({ elapsed: 10 }), true);
    media.requests[1].resolve();
    await second;
    const currentTime = media.currentTime;
    const calls = media.playCalls;
    media.requests[0].reject(rejection);
    assert.equal(await first, false);
    assert.equal(controller.status, 'ready');
    assert.equal(media.paused, false);
    assert.equal(media.muted, false);
    assert.equal(media.currentTime, currentTime);
    assert.equal(media.playCalls, calls);
  });
}

test('an old-source resolution cannot consume the new source play request or restart paused sound', async () => {
  const { media, controller } = create();
  controller.setSource('audio/first.mp3');
  controller.sync(snapshot({ elapsed: 40 }), true);
  const first = controller.unlock();
  controller.setSource('audio/second.mp3');
  const second = controller.unlock();
  controller.sync(snapshot({ elapsed: 0, buffer: 0 }), false);
  media.requests[0].resolve();
  assert.equal(await first, false);
  assert.equal(controller.status, 'loading');
  assert.equal(media.paused, true);
  assert.equal(media.muted, true);
  assert.equal(controller.unlock(), second, 'The selected source still owns the pending request.');
  assert.equal(media.playCalls, 2);
  media.requests[1].resolve();
  await second;
  assert.equal(media.paused, true);
});

test('old-source completion leaves an already playing selected source at its own elapsed position', async () => {
  const { media, controller } = create();
  controller.sync(snapshot({ elapsed: 50 }), true);
  const first = controller.unlock();
  controller.setSource('audio/second.mp3');
  controller.sync(snapshot({ elapsed: 8 }), true);
  const second = controller.unlock();
  media.requests[1].resolve();
  await second;
  media.currentTime = 3.7;
  media.requests[0].resolve();
  await first;
  assert.equal(media.currentTime, 3.7);
  assert.equal(media.paused, false);
  assert.equal(controller.status, 'ready');
});

test('selecting a new source recovers from a recording error and follows its buffer refills', async () => {
  const { media, controller } = create();
  controller.sync(snapshot(), true);
  const first = controller.unlock();
  media.requests[0].reject('NotSupportedError');
  await first;
  assert.equal(controller.status, 'error');
  controller.setSource('audio/working.mp3');
  assert.equal(controller.status, 'loading');
  const second = controller.unlock();
  controller.sync(snapshot({ elapsed: 0, buffer: 0 }), true);
  media.requests[1].resolve();
  await second;
  controller.sync(snapshot({ elapsed: 6, buffer: 8 }), true);
  await settle();
  assert.equal(media.currentTime, 0);
  media.currentTime = 2.7;
  controller.sync(snapshot({ elapsed: 7, buffer: 0 }), true);
  assert.equal(media.paused, false);
  assert.equal(media.muted, true);
  media.currentTime = 5;
  controller.sync(snapshot({ elapsed: 7, buffer: 12 }), true);
  await settle();
  assert.equal(media.currentTime, 2.7);
  assert.equal(media.paused, false);
  assert.equal(controller.status, 'ready');
});

test('an empty buffer during pending playback stays silent and can recover before play settles', async () => {
  const { media, controller } = create();
  controller.sync(snapshot({ elapsed: 4 }), true);
  const request = controller.unlock();
  media.currentTime = 1.8;
  controller.sync(snapshot({ elapsed: 4, buffer: 0 }), true);
  assert.equal(media.muted, true);
  controller.sync(snapshot({ elapsed: 4, buffer: 8 }), true);
  media.requests[0].resolve();
  await request;
  assert.equal(media.playCalls, 1);
  assert.equal(media.paused, false);
  assert.equal(media.muted, false);
  assert.equal(media.currentTime, 1.8);
});

test('repeated underruns retain user mute/volume and explicit pauses still stop transport', async () => {
  const { media, controller } = create();
  controller.sync(snapshot(), true);
  const request = controller.unlock(); media.requests[0].resolve(); await request;
  controller.setVolume(0.3);
  controller.setMuted(true);
  for (let elapsed = 1; elapsed <= 4; elapsed++) {
    controller.sync(snapshot({ elapsed, buffer: 0 }), true);
    assert.equal(media.muted, true);
    controller.sync(snapshot({ elapsed, buffer: 8 }), true);
    assert.equal(media.muted, true);
    assert.equal(media.volume, 0.3);
    assert.equal(media.paused, false);
  }
  controller.setMuted(false);
  controller.sync(snapshot({ elapsed: 4, buffer: 0 }), true);
  controller.setVolume(0.7);
  assert.equal(media.muted, true, 'Volume changes must not make an empty buffer audible.');
  controller.sync(snapshot({ elapsed: 4, buffer: 8 }), true);
  assert.equal(media.muted, false);
  assert.equal(media.playCalls, 1);
  controller.sync(snapshot({ elapsed: 4, buffer: 8 }), false);
  assert.equal(media.paused, true);
  assert.equal(media.muted, true);
});

test('starting music during photo processing without Web recovers from a natural underrun', async () => {
  const sim = new OSSimulation();
  const { media, controller } = create();
  sim.launch('photo'); sim.startPhoto();
  while (sim.snapshot().apps.photo.photo.progress === 0) sim.step();
  sim.launch('music'); sim.toggleMusic();
  const prime = controller.unlock(); media.requests[0].resolve(); await prime;
  let resolved = 1;
  let depleted = null;
  for (let i = 0; i < 180; i++) {
    if (!media.paused) media.currentTime = (media.currentTime + 0.45) % media.duration;
    const s = sim.step();
    assert.equal(s.apps.web.running, false);
    const music = s.apps.music.music;
    controller.sync(s, true);
    while (resolved < media.requests.length) media.requests[resolved++].resolve();
    await settle();
    if (music.hasPlayed && music.buffer === 0 && !depleted) {
      assert.equal(s.apps.photo.photo.processing, true);
      depleted = { elapsed: music.elapsed, position: controller.positionSeconds, requests: media.playCalls, pauses: media.pauseCalls };
      assert.equal(media.muted, true);
      assert.equal(media.paused, false);
    } else if (depleted && music.buffer > 0) {
      assert.equal(s.apps.photo.photo.processing, true, 'Resume before the photo job finishes.');
      assert.equal(music.elapsed, depleted.elapsed);
      assert.equal(media.paused, false);
      assert.equal(media.muted, false);
      assert.equal(media.playCalls, depleted.requests);
      assert.equal(media.pauseCalls, depleted.pauses);
      assert.equal(media.currentTime, depleted.position);
      return;
    }
  }
  assert.fail('Expected a real model underrun and automatic recovery.');
});

test('repeated browser AbortErrors cannot start a recursive play loop', async () => {
  const { media, controller } = create();
  media.play = () => {
    media.playCalls++;
    // A sentinel stops the old implementation's runaway microtask loop.
    const name = media.playCalls <= 64 ? 'AbortError' : 'NotSupportedError';
    return Promise.reject(Object.assign(new Error(name), { name }));
  };
  controller.sync(snapshot(), true);
  await controller.unlock();
  await new Promise(setImmediate);
  assert.equal(media.playCalls, 1, 'A rejected request must yield to the application clock.');
});

test('delayed currentTime readback and canplay events cannot form a seek loop', async () => {
  const { media, controller } = create();
  controller.sync(snapshot({ elapsed: 10 }), true);
  void controller.unlock();
  media.currentTime = 4.5;
  controller.sync(snapshot({ elapsed: 10, buffer: 0 }), true);
  let position = 9;
  let seeks = 0;
  Object.defineProperty(media, 'currentTime', {
    get() { return position; },
    set(value) {
      seeks++;
      // Real seeking is asynchronous. Simulate canplay before readback catches
      // up; the sentinel bounds the old implementation for this regression.
      if (seeks > 64) position = value;
      queueMicrotask(() => media.emit('canplay'));
    },
  });
  controller.sync(snapshot({ elapsed: 10, buffer: 8 }), true);
  await new Promise(setImmediate);
  assert.equal(seeks, 1, 'Ready events must not request another position correction.');
});

test('persistent aborted playback is rate-limited and stops after three attempts', async () => {
  const { media, controller, advance } = create();
  media.play = () => {
    media.playCalls++;
    return Promise.reject(Object.assign(new Error('interrupted'), { name: 'AbortError' }));
  };
  controller.sync(snapshot(), true);
  await controller.unlock();
  for (let i = 0; i < 1000; i++) {
    media.emit('canplay'); media.emit('canplaythrough');
    controller.sync(snapshot(), true);
  }
  assert.equal(media.playCalls, 1);
  for (let i = 0; i < 20; i++) {
    advance(500); controller.sync(snapshot(), true); await settle();
  }
  assert.equal(media.playCalls, 3);
  assert.equal(controller.status, 'blocked');
  assert.equal(await controller.unlock(), false);
  assert.equal(media.playCalls, 4, 'An explicit user gesture may start a new bounded attempt.');
});

test('a pending native seek waits for seeked and consumes its intent only once', async () => {
  const { media, controller } = create();
  controller.sync(snapshot({ elapsed: 10 }), true);
  media.currentTime = 4.5;
  controller.sync(snapshot({ elapsed: 10, buffer: 0 }), true);
  let position = 9;
  let seeks = 0;
  Object.defineProperty(media, 'currentTime', {
    get() { return position; },
    set(value) { seeks++; position = value; },
  });
  media.seeking = true;
  controller.sync(snapshot({ elapsed: 10, buffer: 8 }), true);
  for (let i = 0; i < 1000; i++) media.emit('canplay');
  assert.equal(seeks, 0);
  media.seeking = false; media.emit('seeked');
  for (let i = 0; i < 1000; i++) media.emit('canplaythrough');
  assert.equal(seeks, 1);
  assert.equal(position, 4.5);
});

test('repeated paused snapshots do not keep issuing native pause operations', async () => {
  const { media, controller } = create();
  controller.sync(snapshot(), true);
  const request = controller.unlock(); media.requests[0].resolve(); await request;
  controller.sync(snapshot(), false);
  const pauses = media.pauseCalls;
  for (let i = 0; i < 5000; i++) controller.sync(snapshot(), false);
  assert.equal(media.pauseCalls, pauses);
});

test('intentional OS pause does not schedule playback retries or show a retry error', async () => {
  const { media, controller, advance } = create();
  controller.sync(snapshot(), true);
  const request = controller.unlock();
  controller.sync(snapshot(), false);
  media.requests[0].reject('AbortError'); await request;
  for (let i = 0; i < 10; i++) { advance(500); controller.sync(snapshot(), false); }
  assert.equal(media.playCalls, 1);
  assert.equal(controller.status, 'ready');
  assert.equal(media.muted, true);
});

test('a late playing event after a media error remains silent and stops', async () => {
  const { media, controller } = create();
  controller.sync(snapshot(), true);
  const request = controller.unlock();
  media.emit('error');
  media.requests[0].resolve(); await request;
  controller.sync(snapshot(), true);
  media.paused = false; media.emit('playing');
  assert.equal(controller.status, 'error');
  assert.equal(media.muted, true);
  assert.equal(media.paused, true);
  assert.equal(media.playCalls, 1);
});

test('recovered music never replays a phrase when the simulation clock runs slower than audio', async () => {
  const { media, controller, advance } = create();
  controller.sync(snapshot({ elapsed: 12 }), true);
  const request = controller.unlock(); media.requests[0].resolve(); await request;
  media.currentTime = 5.4;
  controller.sync(snapshot({ elapsed: 12, buffer: 0 }), true);
  media.currentTime = 10;
  controller.sync(snapshot({ elapsed: 12, buffer: 8 }), true);
  assert.equal(media.currentTime, 5.4, 'Resume once at the last audible position.');
  for (let i = 1; i <= 10; i++) {
    const actualPosition = 5.4 + i * 3;
    media.currentTime = actualPosition;
    advance(3000);
    controller.sync(snapshot({ elapsed: 12 + i, buffer: 8 }), true);
    media.emit('canplay');
    assert.equal(media.currentTime, actualPosition, 'Normal playback must not be rewound by virtual time.');
    if (i % 3 === 0) {
      controller.sync(snapshot({ elapsed: 12 + i, buffer: 0 }), true);
      media.currentTime = actualPosition + 1;
      assert.equal(controller.positionSeconds, actualPosition, 'The displayed playhead holds during silence.');
      controller.sync(snapshot({ elapsed: 12 + i, buffer: 8 }), true);
      assert.equal(media.currentTime, actualPosition, 'Each recovery must use the latest audible position.');
    }
  }
});

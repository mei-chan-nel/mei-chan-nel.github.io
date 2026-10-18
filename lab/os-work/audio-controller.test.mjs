import test from 'node:test';
import assert from 'node:assert/strict';
import { RecordedAudioController } from './audio-controller.mjs';

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
        resolve: () => { this.paused = false; resolve(); },
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
  const controller = new RecordedAudioController({ media });
  return { media, controller };
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
  assert.ok(Math.abs(media.currentTime - 3.15) <= 0.9);
});

for (const reason of ['OS pause', 'app close', 'music pause', 'empty buffer']) {
  test(`${reason} silences a pending play, even if it later resolves`, async () => {
    const { media, controller } = create();
    controller.sync(snapshot(), true);
    const unlocked = controller.unlock();
    const next = {
      'OS pause': [snapshot(), false],
      'app close': [snapshot({ running: false, elapsed: 0 }), true],
      'music pause': [snapshot({ playing: false }), true],
      'empty buffer': [snapshot({ buffer: 0 }), true],
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

test('empty buffer pauses real sound and replenishment resumes the same recording', async () => {
  const { media, controller } = create();
  controller.sync(snapshot({ elapsed: 10 }), true);
  const unlocked = controller.unlock();
  media.requests[0].resolve();
  await unlocked;
  controller.sync(snapshot({ elapsed: 12, buffer: 0 }), true);
  assert.equal(media.paused, true);
  assert.equal(media.currentTime, 5.4);
  controller.sync(snapshot({ elapsed: 12, buffer: 8, cpu: 'photo', visible: 'web' }), true);
  assert.equal(media.playCalls, 2);
  media.requests[1].resolve();
  await settle();
  assert.equal(media.paused, false);
  assert.equal(media.currentTime, 5.4);
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
  assert.equal(media.paused, true);
  controller.sync(snapshot({ buffer: 8 }), true);
  media.requests[1].resolve();
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

test('virtual elapsed time sets position, corrects substantial drift and wraps at the recording end', async () => {
  const { media, controller } = create();
  controller.sync(snapshot({ elapsed: 100 }), true);
  const unlocked = controller.unlock();
  media.requests[0].resolve();
  await unlocked;
  assert.equal(media.currentTime, 45);
  media.currentTime = 45.5;
  controller.sync(snapshot({ elapsed: 100 }), true);
  assert.equal(media.currentTime, 45.5, 'Minor wall-clock drift does not cause constant seeking.');
  media.currentTime = 30;
  controller.sync(snapshot({ elapsed: 100 }), true);
  assert.equal(media.currentTime, 45);
  controller.sync(snapshot({ elapsed: 140 }), true);
  assert.equal(media.currentTime, 3);
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
  const { media, controller } = create();
  controller.sync(snapshot(), true);
  const first = controller.unlock();
  controller.sync(snapshot(), false);
  controller.sync(snapshot(), true);
  assert.equal(media.playCalls, 1);
  media.requests[0].reject('AbortError');
  assert.equal(await first, false);
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
  media.requests[2].resolve();
  await settle();
  assert.equal(media.currentTime, 2.7);
  controller.sync(snapshot({ elapsed: 7, buffer: 0 }), true);
  assert.equal(media.paused, true);
  controller.sync(snapshot({ elapsed: 7, buffer: 12 }), true);
  media.requests[3].resolve();
  await settle();
  assert.equal(media.currentTime, 3.15);
  assert.equal(media.paused, false);
  assert.equal(controller.status, 'ready');
});

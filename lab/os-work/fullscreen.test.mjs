import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initFullscreen } from './fullscreen.mjs';

function setup() {
  const doc = new EventTarget();
  const frames = [];
  const classes = () => {
    const items = new Set();
    return { toggle(key, value) { if (value) items.add(key); else items.delete(key); }, contains(key) { return items.has(key); } };
  };
  const element = () => Object.assign(new EventTarget(), {
    classList: classes(), disabled: false, attributes: {},
    setAttribute(key, value) { this.attributes[key] = value; },
    getClientRects() { return [1]; },
    focus() { doc.activeElement = this; },
  });
  const first = element(), button = element(), last = element();
  const controls = [first, button, last];
  const panel = Object.assign(element(), {
    querySelectorAll() { return controls; }, contains(node) { return controls.includes(node); },
  });
  doc.body = element();
  doc.fullscreenElement = null;
  doc.fullscreenEnabled = false;
  const win = {
    scrollX: 23, scrollY: 421, restored: null,
    requestAnimationFrame(fn) { frames.push(fn); },
    scrollTo(...position) { this.restored = position; },
  };
  const controller = initFullscreen({ panel, button, doc, win });
  const key = (key, shiftKey = false) => {
    const event = new Event('keydown', { cancelable: true });
    Object.assign(event, { key, shiftKey }); doc.dispatchEvent(event); return event;
  };
  const change = (node) => { doc.fullscreenElement = node; doc.dispatchEvent(new Event('fullscreenchange')); };
  const flush = () => { while (frames.length) frames.shift()(); };
  return { controller, doc, win, panel, button, first, last, controls, key, change, flush };
}

test('viewport fullscreen exits with the same button and restores scroll and focus', async () => {
  const s = setup();
  s.button.dispatchEvent(new Event('click'));
  assert.equal(s.controller.active, true);
  assert.equal(s.panel.classList.contains('is-fullscreen'), true);
  assert.equal(s.doc.body.classList.contains('has-fullscreen-card'), true);
  assert.equal(s.button.textContent, '全画面を終了');
  assert.equal(s.button.attributes['aria-pressed'], 'true');
  await s.controller.toggle(); s.flush();
  assert.equal(s.controller.active, false);
  assert.equal(s.panel.classList.contains('is-fullscreen'), false);
  assert.equal(s.doc.body.classList.contains('has-fullscreen-card'), false);
  assert.equal(s.button.textContent, '全画面');
  assert.equal(s.button.attributes['aria-pressed'], 'false');
  assert.deepEqual(s.win.restored, [23, 421]);
  assert.equal(s.doc.activeElement, s.button);
});

test('a denied native API retains usable viewport mode and Escape exits it', async () => {
  const s = setup(); s.doc.fullscreenEnabled = true;
  s.panel.requestFullscreen = async () => { throw new Error('embedded browser denial'); };
  await s.controller.toggle();
  assert.equal(s.controller.active, true);
  assert.equal(s.key('Escape').defaultPrevented, true); s.flush();
  assert.equal(s.controller.active, false);
  assert.deepEqual(s.win.restored, [23, 421]);
});

test('native entry and both button/browser exits synchronize the mode', async () => {
  const s = setup(); s.doc.fullscreenEnabled = true;
  s.panel.requestFullscreen = async () => s.change(s.panel);
  let exits = 0;
  s.doc.exitFullscreen = async () => { exits++; s.change(null); };
  await s.controller.toggle();
  assert.equal(s.doc.fullscreenElement, s.panel);
  await s.controller.toggle();
  assert.equal(exits, 1); assert.equal(s.controller.active, false);
  await s.controller.toggle();
  s.change(null); s.flush();
  assert.equal(s.controller.active, false);
  assert.equal(s.doc.activeElement, s.button);
});

for (const leave of ['second click', 'Escape']) {
  test(`a pending native entry cannot reopen a mode closed by ${leave}`, async () => {
    const s = setup(); s.doc.fullscreenEnabled = true;
    let resolve;
    s.panel.requestFullscreen = () => new Promise((done) => { resolve = done; });
    let exits = 0;
    s.doc.exitFullscreen = async () => { exits++; await Promise.resolve(); s.change(null); };
    const entering = s.controller.toggle();
    if (leave === 'Escape') s.key('Escape'); else await s.controller.toggle();
    s.change(s.panel); resolve();
    await entering; await Promise.resolve(); s.flush();
    assert.equal(exits, 1);
    assert.equal(s.doc.fullscreenElement, null);
    assert.equal(s.controller.active, false);
    assert.equal(s.button.textContent, '全画面');
  });
}

test('a refused native exit keeps the exit control and permits retry', async () => {
  const s = setup(); s.doc.fullscreenEnabled = true;
  s.panel.requestFullscreen = async () => s.change(s.panel);
  s.doc.exitFullscreen = async () => { throw new Error('exit refused'); };
  await s.controller.toggle(); await s.controller.toggle();
  assert.equal(s.controller.active, true);
  assert.equal(s.button.textContent, '全画面を終了');
  s.doc.exitFullscreen = async () => s.change(null);
  await s.controller.toggle(); assert.equal(s.controller.active, false);
});

test('fullscreen traps Tab within enabled, visible controls', async () => {
  const s = setup();
  await s.controller.toggle();
  s.last.focus(); assert.equal(s.key('Tab').defaultPrevented, true);
  assert.equal(s.doc.activeElement, s.first);
  s.first.focus(); s.key('Tab', true); assert.equal(s.doc.activeElement, s.last);
  s.last.disabled = true; s.first.getClientRects = () => [];
  s.doc.activeElement = null; s.key('Tab'); assert.equal(s.doc.activeElement, s.button);
  await s.controller.toggle();
  assert.equal(s.key('Tab').defaultPrevented, false);
});

test('entering never exits an unrelated native fullscreen element', async () => {
  const s = setup(); s.doc.fullscreenEnabled = true;
  const other = {}; s.doc.fullscreenElement = other;
  s.panel.requestFullscreen = async () => assert.fail('must not request native fullscreen');
  s.doc.exitFullscreen = async () => assert.fail('must not exit another panel');
  await s.controller.toggle(); await s.controller.toggle();
  assert.equal(s.doc.fullscreenElement, other);
});

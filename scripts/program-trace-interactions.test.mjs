import test from "node:test";
import assert from "node:assert/strict";
import { bindStepKeys } from "../program-trace/step-keys.js";
import { resizedPanelHeight, MIN_PANEL_HEIGHT, MAX_PANEL_HEIGHT } from "../program-trace/result-panels.js";

function keyboardHarness() {
  const status = { active: true, ready: true, modal: false, steps: 0 };
  const listeners = new Map(), next = { dataset: {} };
  const root = {
    querySelector: () => status.modal ? {} : null,
    addEventListener: (type, handler) => listeners.set(type, handler),
    removeEventListener: (type) => listeners.delete(type),
  };
  const remove = bindStepKeys({ root, isActive: () => status.active, canAdvance: () => status.ready,
    advance: () => status.steps++, nextButton: () => next });
  function key(key, options = {}) {
    const { control = null, ...fields } = options;
    const event = { key, code: key === " " ? "Space" : key, target: { closest: () => control },
      repeat: false, defaultPrevented: false, ...fields, preventDefault() { this.defaultPrevented = true; } };
    listeners.get("keydown")?.(event);
    return event;
  }
  return { status, key, next, remove };
}

test("SpaceとEnterは単押し・長押しの各キーイベントで1ステップだけ進む", () => {
  for (const key of [" ", "Enter"]) {
    const h = keyboardHarness();
    assert.equal(h.key(key).defaultPrevented, true);
    for (let count = 0; count < 20; count++) assert.equal(h.key(key, { repeat: true }).defaultPrevented, true);
    assert.equal(h.status.steps, 21);
    h.remove(); h.key(key); assert.equal(h.status.steps, 21);
  }
});

test("次へボタン上でもキーで進み、ネイティブのクリックによる二重実行を防ぐ", () => {
  const h = keyboardHarness();
  for (const control of [h.next, { dataset: { control: "next" } }]) {
    for (const key of [" ", "Enter"]) assert.equal(h.key(key, { control, repeat: true }).defaultPrevented, true);
  }
  assert.equal(h.status.steps, 4);
});

test("入力・他のボタン・パネルの高さ調整・IMEや修飾キーの操作は実行に変えない", () => {
  const h = keyboardHarness();
  for (const key of [" ", "Enter"]) {
    for (const control of [{ tagName: "INPUT" }, { tagName: "BUTTON" }, { role: "separator" }, { editable: true }]) {
      assert.equal(h.key(key, { control }).defaultPrevented, false);
    }
    for (const option of ["isComposing", "altKey", "ctrlKey", "metaKey", "shiftKey"]) {
      assert.equal(h.key(key, { [option]: true }).defaultPrevented, false);
    }
    h.key(key, { defaultPrevented: true });
  }
  assert.equal(h.status.steps, 0);
});

test("入力待ちのダイアログ・編集画面ではキー実行を止め、Worker待機中のイベントをためない", () => {
  const h = keyboardHarness();
  h.status.modal = true; assert.equal(h.key("Enter", { repeat: true }).defaultPrevented, false);
  h.status.modal = false; h.status.active = false; assert.equal(h.key(" ").defaultPrevented, false);
  h.status.active = true; h.status.ready = false;
  for (let count = 0; count < 10; count++) assert.equal(h.key("Enter", { repeat: true }).defaultPrevented, true);
  assert.equal(h.status.steps, 0);
  h.status.ready = true; assert.equal(h.status.steps, 0);
  h.key("Enter", { repeat: true }); assert.equal(h.status.steps, 1);
  h.status.ready = false; h.key("Enter", { repeat: true }); assert.equal(h.status.steps, 1);
});

test("ドラッグとキーによる高さ変更は同じ上下限で止まり、小数座標も整数の高さに収める", () => {
  assert.equal(resizedPanelHeight(230, 120), 350);
  assert.equal(resizedPanelHeight(230, -80), 150);
  assert.equal(resizedPanelHeight(230, -1000), MIN_PANEL_HEIGHT);
  assert.equal(resizedPanelHeight(230, 3000), MAX_PANEL_HEIGHT);
  assert.equal(resizedPanelHeight(230, 20.3), 250);
  for (const start of [MIN_PANEL_HEIGHT, 230, MAX_PANEL_HEIGHT]) for (const delta of [-5000, -20, 0, 20, 5000]) {
    const height = resizedPanelHeight(start, delta);
    assert.ok(height >= MIN_PANEL_HEIGHT && height <= MAX_PANEL_HEIGHT);
  }
});

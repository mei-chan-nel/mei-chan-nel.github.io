// Integration checks for viewport fallback, native API transitions and state preservation.
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { editRam, openRam } from "./cpu-memory-test-ui.mjs";
const require = createRequire(import.meta.url),
  { JSDOM } = require(process.env.LAB_JSDOM_MODULE || "jsdom");
const dom = new JSDOM(
  await readFile(new URL("../cpu-memory/index.html", import.meta.url), "utf8"),
  { url: "https://example.test/lab/cpu-memory/" },
);
for (const key of [
  "window",
  "document",
  "localStorage",
  "Event",
  "HTMLElement",
])
  globalThis[key] = dom.window[key];
dom.window.HTMLDialogElement.prototype.showModal = function () {
  this.open = true;
};
dom.window.HTMLDialogElement.prototype.close = function () {
  this.open = false;
};
const restored = [];
window.scrollTo = (options) => restored.push(options);
await import("../cpu-memory/app.mjs");
const $ = (id) => document.getElementById(id),
  click = (id) => {
    if (id !== "step") return $(id).click();
    const before = Number($("steps").textContent);
    for (
      let n = 0;
      n < 30 &&
      Number($("steps").textContent) === before &&
      !["終了", "エラー"].includes($("state").textContent);
      n++
    )
      $(id).click();
  },
  root = document.documentElement;
const surface = $("memory-lab"),
  row = document.querySelector("#ram-rows tr"),
  header = document.querySelector(".site-header");
header.inert = true;
assert.deepEqual(
  [...document.querySelectorAll(".memory-workspace > section")].map((n) =>
    n.getAttribute("aria-labelledby"),
  ),
  ["cpu-heading", "cache-heading", "ram-heading"],
);
assert.equal(
  row.querySelector(".ram-row-edit").textContent,
  "16 番地を読み出す",
);
assert.equal(document.querySelectorAll(".pad-button").length, 0);
assert.equal(document.querySelector(".run-buttons > button").id, "previous");
assert.equal($("previous").disabled, true);
assert.equal($("step").classList.contains("primary"), true);
assert.equal($("run").classList.contains("primary"), false);
click("step");
const snapshot = {
  ram: $("ram-rows").textContent,
  cache: $("cache-lines").textContent,
  steps: $("steps").textContent,
  time: $("total-time").textContent,
};
click("memory-fullscreen");
assert.equal(surface.classList.contains("is-fullscreen"), true);
assert.equal(root.classList.contains("memory-fullscreen"), true);
assert.equal($("experiment-setup").open, false);
assert.equal($("comparison-records").open, false);
assert.equal($("memory-fullscreen").getAttribute("aria-pressed"), "true");
assert.equal(document.querySelector("#ram-rows tr"), row);
assert.equal($("help-toggle").parentElement.inert, true);
click("step");
assert.equal($("acc").textContent, "12");
assert.equal($("steps").textContent, "2");
assert.equal(
  document.querySelector('tr[data-address="1"]').classList.contains("current"),
  true,
);
click("memory-fullscreen");
assert.equal(surface.classList.contains("is-fullscreen"), false);
assert.equal($("experiment-setup").open, true);
assert.equal($("comparison-records").open, true);
assert.equal($("acc").textContent, "12");
assert.equal(header.inert, true);
assert.equal($("help-toggle").parentElement.inert, undefined);
assert.equal(document.activeElement, $("memory-fullscreen"));
assert.equal(restored.length, 1);
// The fallback also supports execution, editing and record operations.
click("memory-fullscreen");
click("save-result");
assert.equal($("record-count").textContent, "1件");
$("comparison-records").open = true;
$("experiment-setup").open = true;
editRam(16, { arg: 9 });
assert.equal($("steps").textContent, "0");
assert.equal(surface.classList.contains("is-fullscreen"), true);
assert.equal(
  document.querySelector('[data-control="previous"]').disabled,
  true,
);
click("step");
assert.equal($("acc").textContent, "9");
const dialog = document.createElement("dialog");
dialog.setAttribute("open", "");
document.body.append(dialog);
window.dispatchEvent(
  new dom.window.KeyboardEvent("keydown", { key: "Escape", cancelable: true }),
);
assert.equal(surface.classList.contains("is-fullscreen"), true);
dialog.remove();
window.dispatchEvent(
  new dom.window.KeyboardEvent("keydown", { key: "Escape", cancelable: true }),
);
assert.equal(surface.classList.contains("is-fullscreen"), false);
assert.equal($("acc").textContent, "9");
// A denied native request keeps the viewport fallback usable.
root.requestFullscreen = async () => {
  throw new Error("not allowed in an embed");
};
click("memory-fullscreen");
await Promise.resolve();
assert.equal(surface.classList.contains("is-fullscreen"), true);
click("memory-fullscreen");
// Native browser exit restores the normal layout and preserves the machine.
let nativeElement = null;
Object.defineProperty(document, "fullscreenElement", {
  configurable: true,
  get: () => nativeElement,
});
document.exitFullscreen = async () => {
  nativeElement = null;
  document.dispatchEvent(new Event("fullscreenchange"));
};
root.requestFullscreen = async () => {
  nativeElement = root;
  document.dispatchEvent(new Event("fullscreenchange"));
};
click("memory-fullscreen");
await Promise.resolve();
assert.equal(nativeElement, root);
await document.exitFullscreen();
assert.equal(surface.classList.contains("is-fullscreen"), false);
assert.equal($("acc").textContent, "9");
// Exit before the native request resolves must not leave a hidden fullscreen page.
let resolveNative;
root.requestFullscreen = () =>
  new Promise((resolve) => {
    resolveNative = () => {
      nativeElement = root;
      document.dispatchEvent(new Event("fullscreenchange"));
      resolve();
    };
  });
click("memory-fullscreen");
click("memory-fullscreen");
resolveNative();
await new Promise((r) => setTimeout(r, 0));
assert.equal(nativeElement, null);
assert.equal(surface.classList.contains("is-fullscreen"), false);
// A quick exit/re-entry shares the pending request and leaves the new session usable.
click("memory-fullscreen");
click("memory-fullscreen");
click("memory-fullscreen");
resolveNative();
await new Promise((r) => setTimeout(r, 0));
assert.equal(surface.classList.contains("is-fullscreen"), true);
assert.equal(nativeElement, root);
click("memory-fullscreen");
await Promise.resolve();
assert.equal(nativeElement, null);
// Space/Enter step through instructions, while typing in inputs leaves execution alone.
const before = Number($("steps").textContent);
document.body.dispatchEvent(
  new dom.window.KeyboardEvent("keydown", {
    key: " ",
    bubbles: true,
    cancelable: true,
  }),
);
assert.equal(Number($("steps").textContent), before);
openRam(16);
const operand = $("ram-edit-operand");
const action = $("phase-kind").textContent;
operand.dispatchEvent(
  new dom.window.KeyboardEvent("keydown", {
    key: "Enter",
    bubbles: true,
    cancelable: true,
  }),
);
assert.equal(Number($("steps").textContent), before);
assert.equal($("phase-kind").textContent, action);
$("ram-edit-dialog").querySelector("[data-cancel]").click();
click("reset");
click("memory-fullscreen");
click("run");
assert.equal($("run").getAttribute("aria-pressed"), "true");
click("memory-fullscreen");
click("run");
assert.equal($("run").getAttribute("aria-pressed"), "false");
assert.equal($("steps").textContent, "0");
console.log(
  "Fullscreen integration passed: CPU/cache/RAM order, primary stepping, fallback and native fullscreen, editing, records, Escape, focus/inert restoration, pending-request races, keyboard input, automatic run/pause.",
);
dom.window.close();

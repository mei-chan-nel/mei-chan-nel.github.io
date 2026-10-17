import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url),
  { JSDOM } = require(process.env.LAB_JSDOM_MODULE || "jsdom");
const dom = new JSDOM(
  await readFile(new URL("../cpu-memory/index.html", import.meta.url), "utf8"),
  { url: "https://example.test/" },
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
window.scrollTo = () => {};
let blob, downloadName;
URL.createObjectURL = (value) => {
  blob = value;
  return "blob:test";
};
URL.revokeObjectURL = () => {};
dom.window.HTMLAnchorElement.prototype.click = function () {
  downloadName = this.download;
};
await import("../cpu-memory/app.mjs");
const { readPrograms } = await import("../cpu-memory/documents.mjs");
const $ = (id) => document.getElementById(id),
  click = (id) => $(id).click(),
  change = (input, value) => {
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  },
  submit = (id) =>
    $(id)
      .querySelector("form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
const confirmLoad = () =>
  $("program-confirm-dialog").querySelector(".document-primary").click();
const operand = () => document.querySelector('tr[data-address="16"] input');
change(operand(), "9");
click("save-program");
assert.equal($("program-save-dialog").open, true);
change($("program-save-name"), "加算A");
submit("program-save-dialog");
assert.equal(readPrograms(localStorage).length, 1);
assert.equal(readPrograms(localStorage)[0].document.initial[16].arg, 9);
change(operand(), "77");
click("load-program");
assert.equal(document.querySelectorAll("[data-preset]").length, 5);
$("saved-programs").querySelector("button").click();
assert.equal(operand().value, "77");
confirmLoad();
assert.equal(operand().value, "9");
assert.equal($("steps").textContent, "0");
assert.equal($("cache-lines").querySelectorAll(".cache-line").length, 0);
click("save-program");
assert.match($("program-save-submit").textContent, /上書き/);
change($("program-save-name"), "加算A改");
submit("program-save-dialog");
assert.equal(readPrograms(localStorage).length, 1);
assert.equal(readPrograms(localStorage)[0].document.name, "加算A改");
click("save-program");
click("program-save-copy");
assert.equal(readPrograms(localStorage).length, 2);
click("save-program");
click("export-program");
assert.equal($("program-export-dialog").open, true);
change($("program-export-name"), "my-experiment.json");
submit("program-export-dialog");
assert.equal(downloadName, "my-experiment.json");
const json = await blob.text(),
  saved = JSON.parse(json);
assert.equal(saved.initial[16].arg, 9);
assert.equal(saved.format, "interactive-lab-cpu-memory");
change(operand(), "88");
click("load-program");
Object.defineProperty($("program-file"), "files", {
  configurable: true,
  value: [{ size: json.length, text: async () => json }],
});
$("program-file").dispatchEvent(new Event("change"));
await new Promise((r) => setTimeout(r, 0));
assert.equal(operand().value, "88");
confirmLoad();
assert.equal(operand().value, "9");
click("load-program");
document.querySelector('[data-preset="loop"]').click();
confirmLoad();
assert.equal(operand().value, "5");
assert.equal($("experiment-name").value, "繰り返し処理");
// Speed controls use the same interval model as Program Trace.
click("speed-button");
assert.equal($("speed-panel").hidden, false);
click("speed-increase");
assert.equal($("speed-input").value, "0.6");
click("speed-decrease");
assert.equal($("speed-input").value, "0.5");
change($("speed-input"), "0.07");
assert.equal($("speed-value").textContent, "0.07秒");
change($("speed-input"), "-1");
assert.equal($("speed-error").hidden, false);
assert.equal($("speed-value").textContent, "0.07秒");
// In fullscreen the rail opens dialogs and speed settings without consuming rows.
click("memory-fullscreen");
assert.equal($("speed-panel").hidden, true);
document.querySelector('[data-control="speed"]').click();
assert.equal($("speed-panel").parentElement, $("memory-lab"));
assert.equal($("speed-panel").hidden, false);
document.body.dispatchEvent(
  new dom.window.KeyboardEvent("keydown", {
    key: "Escape",
    bubbles: true,
    cancelable: true,
  }),
);
assert.equal($("speed-panel").hidden, true);
assert.equal($("memory-lab").classList.contains("is-fullscreen"), true);
document.querySelector('[data-control="load"]').click();
assert.equal($("program-load-dialog").open, true);
document.querySelector('[data-preset="addition"]').click();
confirmLoad();
document.querySelector('[data-control="speed"]').click();
change($("speed-input"), "0.001");
click("speed-button");
document.querySelector('[data-control="play"]').click();
for (let n = 0; n < 100 && $("state").textContent !== "終了"; n++)
  await new Promise((r) => setTimeout(r, 5));
assert.equal($("state").textContent, "終了");
assert.equal($("total-time").textContent, "218ns");
assert.equal($("acc").textContent, "12");
assert.match($("phase-title").textContent, /終了/);
document.querySelector('[data-control="exit"]').click();
console.log(
  "Document/speed integration passed: browser save/copy/overwrite/load, five presets, JSON export/import confirmation, numeric speed and fullscreen rail actions.",
);
dom.window.close();

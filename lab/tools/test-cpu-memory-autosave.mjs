import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { editRam } from "./cpu-memory-test-ui.mjs";
const require = createRequire(import.meta.url),
  { JSDOM } = require(process.env.LAB_JSDOM_MODULE || "jsdom"),
  html = await readFile(
    new URL("../cpu-memory/index.html", import.meta.url),
    "utf8",
  ),
  key = "study-atlas-cpu-memory-v1";
let mounts = 0;
async function mount(draft) {
  const dom = new JSDOM(html, { url: "https://example.test/lab/cpu-memory/" });
  for (const k of [
    "window",
    "document",
    "localStorage",
    "Event",
    "HTMLElement",
  ])
    globalThis[k] = dom.window[k];
  dom.window.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  dom.window.HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  window.scrollTo = () => {};
  if (draft) localStorage.setItem(key, draft);
  await import(`../cpu-memory/app.mjs?autosave-test=${++mounts}`);
  return dom;
}
const $ = (id) => document.getElementById(id),
  click = (id) => $(id).click(),
  records = () => JSON.parse(localStorage.getItem(key)).records,
  finish = () => {
    for (
      let i = 0;
      i < 200 && !["終了", "エラー"].includes($("state").textContent);
      i++
    )
      click("step");
    assert.equal($("state").textContent, "終了");
  };
const dom = await mount();
assert.equal($("record-count").textContent, "0件");
click("step");
assert.equal($("record-count").textContent, "0件");
finish();
assert.equal(records().length, 1);
assert.equal(records()[0].halted, true);
assert.equal(records()[0].acc, 12);
assert.equal(records()[0].initial[18].arg, 0);
assert.equal(records()[0].ram[18].arg, 12);
assert.match($("notice").textContent, /自動保存/);
assert.equal($("save-result").disabled, true);
click("save-result");
click("previous");
finish();
click("memory-fullscreen");
click("memory-fullscreen");
assert.equal(records().length, 1);
click("reset");
finish();
assert.equal(records().length, 2);
$("cache-enabled").checked = false;
$("cache-enabled").dispatchEvent(new Event("change"));
$("speed-input").value = "0.001";
$("speed-input").dispatchEvent(new Event("change"));
click("run");
for (let i = 0; i < 200 && $("state").textContent !== "終了"; i++)
  await new Promise((resolve) => setTimeout(resolve, 5));
assert.equal($("state").textContent, "終了");
assert.equal(records().length, 3);
assert.equal(records()[2].config.enabled, false);
assert.equal(records()[2].stats.cpu + records()[2].stats.wait, 284);
editRam(0, { op: "data" });
for (let i = 0; i < 10 && $("state").textContent !== "エラー"; i++)
  click("step");
assert.equal($("state").textContent, "エラー");
assert.equal(records().length, 3);
editRam(0, { op: "load", arg: 16 });
click("step");
click("save-result");
assert.equal(records().length, 4);
assert.equal(records()[3].inProgress, true);
click("clear-results");
finish();
assert.equal(records().length, 1);
click("clear-results");
click("previous");
finish();
assert.equal(records().length, 0); // Explicit deletion stays deleted during replay.
editRam(0, { op: "halt", arg: 0 });
for (let i = 0; i < 13; i++) {
  click("reset");
  finish();
}
assert.equal(records().length, 12);
const stored = localStorage.getItem(key);
const setItem = window.Storage.prototype.setItem;
window.Storage.prototype.setItem = () => {
  throw Error("quota");
};
click("reset");
finish();
assert.match($("notice").textContent, /ブラウザに保存できません/);
assert.equal($("notice").classList.contains("error"), true);
window.Storage.prototype.setItem = setItem;
dom.window.close();
const reloaded = await mount(stored);
assert.equal($("record-count").textContent, "12件");
assert.equal($("state").textContent, "実行前");
assert.equal(records().length, 12);
reloaded.window.close();
console.log(
  "Autosave passed: completed step/automatic runs, replay deduplication, separate reruns, errors/partial runs, deletion, latest 12, reload and storage failure.",
);

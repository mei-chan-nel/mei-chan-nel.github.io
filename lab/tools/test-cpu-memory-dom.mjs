// DOM integration checks; uses no browser. Install jsdom separately and set LAB_JSDOM_MODULE.
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const { JSDOM } = require(process.env.LAB_JSDOM_MODULE || "jsdom");
const html = await readFile(
  new URL("../cpu-memory/index.html", import.meta.url),
  "utf8",
);
const dom = new JSDOM(html, { url: "https://example.test/lab/cpu-memory/" });
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
await import("../cpu-memory/app.mjs");
const $ = (id) => document.getElementById(id),
  click = (id) => $(id).click(),
  change = (node, value) => {
    node.value = value;
    node.dispatchEvent(new Event("input", { bubbles: true }));
    node.dispatchEvent(new Event("change", { bubbles: true }));
  };
const command = (i) => document.querySelector(`tr[data-address="${i}"] select`),
  operand = (i) => document.querySelector(`tr[data-address="${i}"] input`);
assert.equal($("ram-rows").children.length, 32);
assert.equal($("instruction-guide").children.length, 8);
click("step");
assert.equal($("acc").textContent, "7");
assert.equal($("access-events").children.length, 2);
assert.match($("access-reason").textContent, /16・17/);
$("access-events").children[0].click();
assert.equal($("cache-lines").querySelectorAll(".cache-line").length, 1);
assert.match($("access-reason").textContent, /0・1/);
click("step");
assert.equal($("acc").textContent, "12");
assert.match($("access-events").textContent, /HIT/);
click("step");
assert.equal(
  document.querySelector('tr[data-address="18"] .live-cell').textContent,
  "12",
);
click("step");
assert.equal($("state").textContent, "終了");
assert.equal($("total-time").textContent, "218ns");
click("save-result");
assert.equal($("result-rows").children.length, 1);
change(operand(16), "9");
assert.equal($("state").textContent, "実行前");
assert.equal($("acc").textContent, "0");
assert.equal($("cache-lines").querySelectorAll(".cache-line").length, 0);
assert.match($("result-rows").textContent, /異なる初期RAM/);
click("step");
assert.equal($("acc").textContent, "9");
$("result-rows").querySelector("button").click();
assert.equal(operand(16).value, "7");
assert.equal($("acc").textContent, "0");
$("cache-enabled").checked = false;
$("cache-enabled").dispatchEvent(new Event("change"));
click("step");
assert.equal($("wait-metric").textContent, "80");
assert.match($("access-reason").textContent, /OFF/);
click("reset");
click("compare-off");
for (let n = 0; n < 100 && $("compare-off").disabled; n++)
  await new Promise((r) => setTimeout(r, 5));
assert.equal($("result-rows").children.length, 3);
assert.match($("notice").textContent, /同じ初期条件/);
assert.match($("result-rows").textContent, /284 ns/);
assert.match($("result-rows").textContent, /218 ns/);
click("load-program");
assert.equal($("program-load-dialog").open,true);
document.querySelector('[data-preset="loop"]').click();
$("program-confirm-dialog").querySelector('.document-primary').click();
assert.equal(operand(16).value, "5");
for (let i = 0; i < 25; i++) click("step");
assert.equal($("state").textContent, "終了");
assert.equal($("acc").textContent, "0");
assert.equal(
  document.querySelector('tr[data-address="16"] .live-cell').textContent,
  "0",
);
click("reset");
click("run");
click("run");
const paused = $("steps").textContent;
await new Promise((r) => setTimeout(r, 80));
assert.equal($("steps").textContent, paused);
assert.equal($("state").textContent, "一時停止");
change(command(0), "data");
click("step");
assert.equal($("state").textContent, "エラー");
assert.match($("notice").textContent, /数値/);
change(command(0), "load");
assert.equal($("state").textContent, "実行前");
change(operand(0), "32");
click("step");
assert.match($("notice").textContent, /0〜31/);
assert.equal($("steps").textContent, "0");
change(operand(0), "16");
assert.equal(document.querySelectorAll(".pad-button").length, 0);
change(operand(16), "9");
assert.equal(operand(16).value, "9");
assert.equal($("steps").textContent, "0");
click("help-toggle");
assert.equal($("lab-guide").hidden, false);
assert.equal($("help-toggle").getAttribute("aria-expanded"), "true");
assert.equal(
  JSON.parse(localStorage.getItem("study-atlas-cpu-memory-v1")).initial[16].arg,
  9,
);
// Invalid imports must leave the existing experiment intact.
Object.defineProperty($("program-file"), "files", {
  configurable: true,
  value: [
    { size: 10, text: async () => JSON.stringify({ version: 1, initial: [] }) },
  ],
});
$("program-file").dispatchEvent(new Event("change"));
await new Promise((r) => setTimeout(r, 10));
assert.match($("notice").textContent, /読込できません/);
assert.equal(operand(16).value, "9");
Object.defineProperty($("program-file"), "files", {
  configurable: true,
  value: [
    {
      size: 10,
      text: async () =>
        JSON.stringify({
          version: 1,
          name: "再読込",
          initial: JSON.parse(localStorage.getItem("study-atlas-cpu-memory-v1"))
            .initial,
          config: {
            enabled: true,
            blocks: 4,
            cacheTime: 3,
            ramTime: 50,
            cpuTime: 2,
            start: 0,
          },
        }),
    },
  ],
});
$("program-file").dispatchEvent(new Event("change"));
await new Promise((r) => setTimeout(r, 10));
$("program-confirm-dialog").querySelector(".document-primary").click();
assert.equal($("capacity").value, "4");
assert.equal($("experiment-name").value, "再読込");
assert.equal($("steps").textContent, "0");
console.log(
  "DOM integration passed: editing, cache snapshots, execution, pause, all-op loop, comparison, restore, direct input, persistence, JSON validation.",
);
dom.window.close();

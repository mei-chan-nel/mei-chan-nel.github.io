// DOM integration checks; uses no browser. Install jsdom separately and set LAB_JSDOM_MODULE.
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { editRam, ramContent } from "./cpu-memory-test-ui.mjs";
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
  change = (node, value) => {
    node.value = value;
    node.dispatchEvent(new Event("input", { bubbles: true }));
    node.dispatchEvent(new Event("change", { bubbles: true }));
  };
assert.equal($("ram-rows").children.length, 32);
assert.equal(document.querySelectorAll(".ram-table thead th").length, 2);
assert.equal(
  document.querySelectorAll("#ram-rows input,#ram-rows select").length,
  0,
);
assert.equal($("instruction-guide").children.length, 8);
assert.equal(document.querySelectorAll(".time-track > span").length, 3);
assert.equal(document.querySelectorAll(".time-legend li").length, 3);
assert.equal($("cache-legend-value").textContent, "0 ns");
assert.equal($("ram-legend-value").textContent, "0 ns");
click("step");
assert.equal($("acc").textContent, "7");
assert.equal($("cpu-legend-value").textContent, "1 ns");
assert.equal($("cache-legend-value").textContent, "4 ns");
assert.equal($("ram-legend-value").textContent, "80 ns");
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
assert.equal($("cpu-legend-value").textContent, "4 ns");
assert.equal($("cache-legend-value").textContent, "14 ns");
assert.equal($("ram-legend-value").textContent, "200 ns");
assert.match(
  $("time-track").getAttribute("aria-label"),
  /CPU処理 4 ns、キャッシュ参照 14 ns、RAM転送 200 ns/,
);
const widths = ["cpu", "cache", "ram"].map((part) =>
  parseFloat($(`${part}-track`).style.width),
);
assert.ok(Math.abs(widths.reduce((a, b) => a + b, 0) - 100) < 1e-9);
click("save-result");
assert.equal($("result-rows").children.length, 1);
assert.equal(
  $("result-rows").children[0].children[4].textContent,
  "4 / 14 / 200",
);
editRam(16, { arg: 9 });
assert.equal($("state").textContent, "実行前");
assert.equal($("acc").textContent, "0");
assert.equal($("cache-lines").querySelectorAll(".cache-line").length, 0);
assert.match($("result-rows").textContent, /異なる初期RAM/);
click("step");
assert.equal($("acc").textContent, "9");
$("result-rows").querySelector("button").click();
assert.equal(ramContent(16), "7");
assert.equal($("acc").textContent, "0");
$("cache-enabled").checked = false;
$("cache-enabled").dispatchEvent(new Event("change"));
click("step");
assert.equal($("wait-metric").textContent, "80");
assert.equal($("cache-legend-value").textContent, "0 ns");
assert.equal($("ram-legend-value").textContent, "80 ns");
assert.match($("access-reason").textContent, /OFF/);
click("reset");
for (let n = 0; n < 10 && $("state").textContent !== "終了"; n++) click("step");
click("save-result");
$("cache-enabled").checked = true;
$("cache-enabled").dispatchEvent(new Event("change"));
for (let n = 0; n < 10 && $("state").textContent !== "終了"; n++) click("step");
click("save-result");
assert.equal($("result-rows").children.length, 3);
assert.match($("result-rows").textContent, /284 ns/);
assert.match($("result-rows").textContent, /218 ns/);
click("load-program");
assert.equal($("program-load-dialog").open, true);
document.querySelector('[data-preset="loop"]').click();
$("program-confirm-dialog").querySelector(".document-primary").click();
assert.equal(ramContent(16), "5");
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
editRam(0, { op: "data" });
click("step");
assert.equal($("state").textContent, "エラー");
assert.match($("notice").textContent, /数値/);
editRam(0, { op: "load" });
assert.equal($("state").textContent, "実行前");
editRam(0, { arg: 32 });
assert.equal($("ram-edit-dialog").open, true);
assert.match($("ram-edit-error").textContent, /0〜31/);
assert.equal($("steps").textContent, "0");
$("ram-edit-dialog").querySelector("[data-cancel]").click();
editRam(0, { arg: 16 });
assert.equal(document.querySelectorAll(".pad-button").length, 0);
editRam(16, { arg: 9 });
assert.equal(ramContent(16), "9");
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
assert.equal(ramContent(16), "9");
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
            start: 17,
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
assert.equal($("start"), null);
assert.equal($("pc").textContent, "0");
assert.equal($("steps").textContent, "0");
console.log(
  "DOM integration passed: editing, cache snapshots, execution, pause, all-op loop, comparison, restore, direct input, persistence, JSON validation.",
);
dom.window.close();

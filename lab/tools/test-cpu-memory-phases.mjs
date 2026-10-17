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
const $ = (id) => document.getElementById(id),
  list = document.querySelector(".ram-scroll");
const rect = (left, top, width, height) => ({
  left,
  top,
  right: left + width,
  bottom: top + height,
  width,
  height,
});
// Layout fixtures verify that the UI scrolls the real requested row and connects
// receiving fields; they do not claim to verify browser rendering or CSS sizing.
dom.window.HTMLElement.prototype.getBoundingClientRect = function () {
  if (this.matches(".memory-workspace")) return rect(0, 0, 1200, 600);
  if (this.matches(".cpu-panel")) return rect(0, 12, 220, 568);
  if (this.matches(".cache-panel")) return rect(250, 12, 300, 568);
  if (this.matches(".ram-panel")) return rect(580, 12, 620, 568);
  if (this.matches(".ram-scroll")) return rect(580, 100, 620, 300);
  if (this.matches("thead")) return rect(580, 100, 620, 30);
  if (this.matches("tr[data-address]"))
    return rect(
      580,
      130 + Number(this.dataset.address) * 45 - list.scrollTop,
      620,
      45,
    );
  if (this.matches(".live-cell"))
    return rect(
      1000,
      130 + Number(this.parentElement.dataset.address) * 45 - list.scrollTop,
      185,
      45,
    );
  if (this.matches(".cpu-value")) return rect(25, 150, 170, 60);
  if (this.id === "current-command") return rect(25, 280, 170, 35);
  if (this.id === "received-value") return rect(25, 340, 170, 35);
  if (this.matches(".cache-line,.cache-cell")) {
    const card = this.closest(".cache-line"),
      index = [...card.parentElement.children].indexOf(card);
    return this === card
      ? rect(260, 120 + index * 90, 280, 80)
      : rect(
          260 + (Number(this.dataset.address) % 2) * 140,
          145 + index * 90,
          140,
          55,
        );
  }
  return rect(0, 0, 0, 0);
};
await import("../cpu-memory/app.mjs");
const next = () => $("step").click(),
  title = () => $("phase-title").textContent,
  target = () => document.querySelector(".transfer-target");
next();
assert.match(title(), /命令 0番地.*ミス/);
assert.equal($("current-command").textContent, "—");
assert.equal($("acc").textContent, "0");
assert.equal(document.querySelectorAll(".cache-line").length, 0);
next();
assert.match(title(), /RAM 0・1番地/);
assert.equal(target().dataset.base, "0");
assert.equal($("current-command").textContent, "—");
next();
assert.equal($("current-command").textContent, "16 番地を読み出す");
assert.equal(target().id, "current-command");
assert.equal($("acc").textContent, "0");
assert.equal($("steps").textContent, "0");
next();
assert.match(title(), /命令を実行/);
assert.equal(target(), null);
assert.equal($("access-events").children.length, 1);
const before = list.scrollTop;
next();
assert.match(title(), /データ 16番地.*ミス/);
assert.ok(list.scrollTop > before + 400);
assert.equal(
  document
    .querySelector('tr[data-address="16"]')
    .classList.contains("requested"),
  true,
);
assert.equal(target(), null);
next();
assert.equal(target().dataset.base, "16");
assert.equal($("received-field").hidden, true);
assert.equal($("acc").textContent, "0");
next();
assert.equal(target().id, "received-value");
assert.equal($("received-value").textContent, "7");
assert.equal($("acc").textContent, "0");
assert.equal($("steps").textContent, "0");
assert.equal(document.querySelectorAll(".transfer-path").length, 1);
const endpoint = document.querySelector(".transfer-endpoint");
assert.equal(Number(endpoint.getAttribute("cx")), 190);
assert.equal(Number(endpoint.getAttribute("cy")), 357.5);
$("save-result").click();
assert.match($("result-rows").textContent, /命令の途中/);
next();
assert.equal($("acc").textContent, "7");
assert.equal($("steps").textContent, "1");
assert.equal(target(), null);
const savedScroll = list.scrollTop;
for (let n = 0; n < 20 && $("steps").textContent !== "2"; n++) next();
assert.equal(list.scrollTop, savedScroll);
assert.equal($("acc").textContent, "12");
assert.equal($("steps").textContent, "2");
for (let n = 0; n < 20 && !title().startsWith("CPU → キャッシュ"); n++) next();
assert.match(title(), /CPU → キャッシュ 18番地/);
assert.equal(
  document.querySelector('tr[data-address="18"] .live-cell').textContent,
  "0",
);
assert.equal(
  document.querySelector('.cache-cell[data-address="18"] span').textContent,
  "12",
);
assert.equal(target().dataset.address, "18");
next();
assert.match(title(), /CPU → RAM 18番地/);
assert.equal(target().classList.contains("live-cell"), true);
assert.equal(target().parentElement.dataset.address, "18");
assert.equal(target().textContent, "12");
const ramEnd = document.querySelector(".transfer-endpoint");
assert.equal(Number(ramEnd.getAttribute("cx")), 1005);
assert.match(
  document.querySelector(".transfer-path").getAttribute("d"),
  /L [^ ]+ 8 L/,
);
assert.equal($("steps").textContent, "2");
next();
assert.equal($("steps").textContent, "3");
$("memory-fullscreen").click();
assert.equal($("memory-lab").classList.contains("is-fullscreen"), true);
assert.match($("phase-title").textContent, /書き込み完了/);
$("reset").click();
assert.equal($("steps").textContent, "0");
assert.equal($("phase-kind").textContent, "実行前");
assert.equal(document.querySelectorAll(".cache-line").length, 0);
console.log(
  "Phase UI passed: fetch/decode/read/compute separation, scroll-before-RAM-access, cache-hit bypass, partial results, cache/RAM write ordering and exact receive-field arrow endpoints.",
);
dom.window.close();

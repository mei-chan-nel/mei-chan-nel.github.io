import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { openRam, editRam } from "./cpu-memory-test-ui.mjs";
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
  this.dispatchEvent(new Event("close"));
};
window.scrollTo = () => {};
const $ = (id) => document.getElementById(id),
  list = document.querySelector(".ram-scroll");
let cacheRequestTop = 75;
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
  if (this.id === "pc") return rect(25, 250, 170, 25);
  if (this.id === "cache-request-port")
    return rect(265, cacheRequestTop, 14, 14);
  if (this.id === "cache-ram-port") return rect(520, cacheRequestTop, 14, 14);
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
  title = () => $("notice").textContent,
  target = () => document.querySelector(".transfer-target"),
  popup = document.querySelector(".transfer-callout");
assert.equal(document.querySelector(".phase-panel"), null);
assert.equal(
  popup.parentElement,
  document.querySelector(".cache-request-content"),
);
assert.match($("previous").textContent, /←\s*前へ/);
assert.equal(popup.hidden, true);
assert.match(
  document.querySelector(".transfer-legend").textContent,
  /要求.*命令・データ/s,
);
next();
assert.match(title(), /命令 0番地.*ミス/);
assert.equal(target().id, "cache-request-port");
assert.equal(
  document
    .querySelector(".transfer-path")
    .classList.contains("transfer-request"),
  true,
);
assert.match($("access-events").textContent, /MISS/);
assert.equal($("wait-metric").textContent, "2");
assert.equal(popup.hidden, false);
assert.equal(popup.querySelector("strong").textContent, "キャッシュミス");
assert.equal($("previous").disabled, false);
$("previous").click();
assert.match(title(), /実行前/);
assert.equal($("previous").disabled, true);
next();
assert.match(title(), /命令 0番地.*ミス/);
assert.equal(target().id, "cache-request-port");
assert.equal(popup.hidden, false);
assert.equal(popup.querySelector("strong").textContent, "キャッシュミス");
assert.match(popup.textContent, /0番地.*ブロックなし/);
assert.equal(popup.classList.contains("is-miss"), true);
assert.equal(
  target().style.getPropertyValue("--transfer-color"),
  "var(--request-color)",
);
const requestPath = document.querySelector(".transfer-path").getAttribute("d"),
  lookupWait = $("wait-metric").textContent;
cacheRequestTop = 100;
window.dispatchEvent(new Event("resize"));
assert.notEqual(
  document.querySelector(".transfer-path").getAttribute("d"),
  requestPath,
);
assert.equal(popup.style.top, "");
assert.equal(popup.style.left, "");
assert.equal($("wait-metric").textContent, lookupWait);
cacheRequestTop = 75;
window.dispatchEvent(new Event("resize"));
$("memory-fullscreen").click();
assert.equal(popup.hidden, false);
assert.match(popup.textContent, /キャッシュミス/);
document.querySelector('[data-control="previous"]').click();
assert.equal(popup.hidden, true);
document.querySelector('[data-control="next"]').click();
assert.equal(popup.hidden, false);
assert.equal($("wait-metric").textContent, lookupWait);
$("memory-fullscreen").click();
assert.equal($("current-command").textContent, "—");
assert.equal($("acc").textContent, "0");
assert.equal(document.querySelectorAll(".cache-line").length, 0);
next();
assert.match(title(), /RAM 0番地へ読出要求/);
assert.equal(popup.hidden, true);
assert.equal(target().parentElement.dataset.address, "0");
assert.equal(document.querySelector(".transfer-source").id, "cache-ram-port");
next();
assert.match(title(), /RAM 0・1番地/);
assert.equal(target().dataset.base, "0");
assert.equal(
  target().style.getPropertyValue("--transfer-color"),
  "var(--value-color)",
);
assert.equal(
  document.querySelector(".transfer-path").getAttribute("marker-end"),
  "url(#transfer-value)",
);
assert.equal($("current-command").textContent, "—");
next();
assert.equal($("current-command").textContent, "16 番地を読み出す");
assert.equal(target().id, "current-command");
assert.equal($("acc").textContent, "0");
assert.equal($("steps").textContent, "0");
next();
assert.match(title(), /命令を実行/);
assert.equal(target(), null);
assert.equal($("current-command").classList.contains("is-executing"), true);
assert.equal($("access-events").children.length, 1);
const before = list.scrollTop;
next();
assert.equal($("current-command").classList.contains("is-executing"), false);
assert.equal(target().id, "cache-request-port");
assert.equal(list.scrollTop, before);
assert.match(title(), /データ 16番地.*ミス/);
assert.equal(list.scrollTop, before);
assert.equal(target().id, "cache-request-port");
assert.equal(popup.hidden, false);
assert.match(popup.textContent, /キャッシュミス.*16番地/s);
next();
assert.match(title(), /RAM 16番地へ読出要求/);
assert.ok(list.scrollTop > before + 400);
assert.equal(
  document
    .querySelector('tr[data-address="16"]')
    .classList.contains("requested"),
  true,
);
assert.equal(target().parentElement.dataset.address, "16");
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
next();
assert.equal(popup.hidden, false);
assert.equal(popup.querySelector("strong").textContent, "キャッシュヒット");
assert.match(popup.textContent, /1番地.*保持あり/);
assert.equal(popup.classList.contains("is-hit"), true);
assert.equal(popup.classList.contains("is-miss"), false);
assert.equal(
  target().style.getPropertyValue("--transfer-color"),
  "var(--request-color)",
);
$("previous").click();
assert.equal(popup.hidden, true);
next();
assert.equal(popup.hidden, false);
assert.match(popup.textContent, /キャッシュヒット/);
for (let n = 0; n < 20 && $("steps").textContent !== "2"; n++) next();
assert.equal(list.scrollTop, savedScroll);
assert.equal($("acc").textContent, "12");
assert.equal($("steps").textContent, "2");
for (let n = 0; n < 30 && !title().startsWith("CPU → キャッシュ 18番地"); n++)
  next();
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
assert.equal(
  target().style.getPropertyValue("--transfer-color"),
  "var(--value-color)",
);
assert.equal(
  document.querySelector(".transfer-path").getAttribute("marker-end"),
  "url(#transfer-value)",
);
assert.equal(popup.hidden, true);
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
const writeTime = $("total-time").textContent;
$("previous").click();
assert.match(title(), /CPU → キャッシュ 18番地/);
assert.equal(
  document.querySelector('tr[data-address="18"] .live-cell').textContent,
  "0",
);
assert.equal(
  document.querySelector('.cache-cell[data-address="18"] span').textContent,
  "12",
);
assert.equal($("wait-metric").textContent, "172");
next();
assert.equal(
  document.querySelector('tr[data-address="18"] .live-cell').textContent,
  "12",
);
assert.equal($("total-time").textContent, writeTime);
next();
assert.equal($("steps").textContent, "3");
$("memory-fullscreen").click();
assert.equal($("memory-lab").classList.contains("is-fullscreen"), true);
assert.match(title(), /書き込み完了/);
document.querySelector('[data-control="previous"]').click();
assert.match(title(), /CPU → RAM 18番地/);
document.querySelector('[data-control="next"]').click();
assert.match(title(), /書き込み完了/);
openRam(18);
assert.equal($("ram-edit-dialog").open, true);
assert.match($("ram-edit-current").textContent, /12/);
assert.equal($("ram-edit-operand").value, "0");
$("ram-edit-operand").value = "99";
$("ram-edit-dialog").querySelector("[data-cancel]").click();
assert.equal(
  document.activeElement,
  document.querySelector('tr[data-address="18"] .ram-row-edit'),
);
assert.equal(
  document.querySelector('tr[data-address="18"] .live-cell').textContent,
  "12",
);
assert.equal($("steps").textContent, "3");
editRam(18, { arg: 19 });
assert.equal(
  document.querySelector('tr[data-address="18"] .live-cell').textContent,
  "19",
);
assert.equal($("steps").textContent, "0");
assert.equal($("memory-lab").classList.contains("is-fullscreen"), true);
assert.equal(
  document.querySelector('[data-control="previous"]').disabled,
  true,
);
$("reset").click();
assert.equal($("steps").textContent, "0");
assert.match(title(), /初期RAM/);
assert.equal(popup.hidden, true);
assert.equal(document.querySelectorAll(".cache-line").length, 0);
console.log(
  "Phase UI passed: fetch/decode/read/compute separation, scroll-before-RAM-access, cache-hit bypass, partial results, cache/RAM write ordering and exact receive-field arrow endpoints.",
);
dom.window.close();

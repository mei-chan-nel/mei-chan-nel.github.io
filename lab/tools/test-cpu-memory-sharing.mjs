import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { editRam, ramContent } from "./cpu-memory-test-ui.mjs";
import { readPrograms, newProgram } from "../cpu-memory/documents.mjs";
import { encodeShare, decodeShare } from "../cpu-memory/sharing.mjs";
const require = createRequire(import.meta.url),
  { JSDOM } = require(process.env.LAB_JSDOM_MODULE || "jsdom"),
  html = await readFile(
    new URL("../cpu-memory/index.html", import.meta.url),
    "utf8",
  ),
  draftKey = "study-atlas-cpu-memory-v1";
let mountCount = 0;
async function mount(url, draft) {
  const dom = new JSDOM(html, { url });
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
  if (draft) localStorage.setItem(draftKey, JSON.stringify(draft));
  await import(`../cpu-memory/app.mjs?sharing-test=${++mountCount}`);
  return dom;
}
const $ = (id) => document.getElementById(id),
  click = (id) => $(id).click(),
  submit = (id) =>
    $(id)
      .querySelector("form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  confirmLoad = () =>
    $("program-confirm-dialog").querySelector(".document-primary").click();
const dom = await mount(
  "https://example.test/lab/cpu-memory/?temporary=discard",
);
click("save-program");
submit("program-save-dialog");
assert.equal(readPrograms(localStorage).length, 1);
for (let i = 0; i < 100 && $("state").textContent !== "終了"; i++)
  click("step");
click("save-result");
const records = JSON.parse(localStorage.getItem(draftKey)).records;
assert.equal(records.length, 1);
assert.equal(ramContent(18), "12");
click("share-program");
const sharedURL = $("program-share-url").value;
assert.equal($("program-share-dialog").open, true);
assert.equal(decodeShare(sharedURL).initial[18].arg, 0); // Share the initial RAM, not the runtime write.
assert.equal(new URL(sharedURL).search, "");
assert.equal($("program-native-share").hidden, true);
let copied;
Object.defineProperty(window.navigator, "clipboard", {
  configurable: true,
  value: {
    writeText: async (text) => {
      copied = text;
    },
  },
});
click("program-copy-url");
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(copied, sharedURL);
assert.match($("program-share-status").textContent, /コピーしました/);
Object.defineProperty(window.navigator, "clipboard", { value: undefined });
click("program-copy-url");
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(document.activeElement, $("program-share-url"));
assert.equal($("program-share-url").selectionEnd, sharedURL.length);
assert.match($("program-share-status").textContent, /URLを選択/);
$("program-share-dialog").querySelector(".document-close").click();
assert.equal($("state").textContent, "終了");
click("new-program");
$("program-new-dialog")
  .querySelector(".document-dialog-actions button")
  .click();
assert.equal($("state").textContent, "終了");
assert.equal(ramContent(18), "12");
click("new-program");
click("program-discard-and-new");
assert.equal($("experiment-name").value, "新しいプログラム");
assert.equal(ramContent(0), "終了");
assert.equal(ramContent(16), "0");
assert.equal(ramContent(18), "0");
assert.equal($("steps").textContent, "0");
assert.equal($("total-time").textContent, "0ns");
assert.equal($("previous").disabled, true);
assert.equal($("cache-lines").querySelectorAll(".cache-line").length, 0);
assert.deepEqual(JSON.parse(localStorage.getItem(draftKey)).records, records);
assert.equal(readPrograms(localStorage).length, 1);
// New programs must not overwrite the named program that was open before them.
editRam(16, { arg: 123 });
click("new-program");
click("program-save-and-new");
assert.equal($("program-save-dialog").open, true);
submit("program-save-dialog");
assert.equal(readPrograms(localStorage).length, 2);
assert.equal(readPrograms(localStorage)[0].document.initial[16].arg, 123);
assert.equal(ramContent(16), "0");
assert.equal($("program-new-dialog").open, false);
// Canceling the save-before-new flow must not create a program on a later ordinary save.
editRam(16, { arg: 77 });
click("new-program");
click("program-save-and-new");
$("program-save-dialog").querySelector(".document-close").click();
click("save-program");
submit("program-save-dialog");
assert.equal(ramContent(16), "77");
click("load-program");
assert.ok($("program-load-url").maxLength >= sharedURL.length);
$("program-load-url").value = sharedURL;
$("program-load-url")
  .closest("form")
  .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
assert.equal($("program-confirm-dialog").open, true);
assert.equal(ramContent(16), "77");
confirmLoad();
assert.equal(ramContent(16), "7");
assert.equal($("steps").textContent, "0");
assert.deepEqual(JSON.parse(localStorage.getItem(draftKey)).records, records);
dom.window.close();

const own = { ...newProgram(), records: [] };
own.initial[16].arg = 99;
const recipient = await mount(sharedURL, own);
assert.equal($("program-confirm-dialog").open, true);
assert.equal(ramContent(16), "99");
assert.equal(JSON.parse(localStorage.getItem(draftKey)).initial[16].arg, 99);
confirmLoad();
assert.equal(ramContent(16), "7");
assert.equal(window.location.hash, "");
assert.equal($("steps").textContent, "0");
assert.equal($("capacity").value, "2");
// A later hash navigation also asks before replacing the running program.
click("step");
const timeBefore = $("total-time").textContent;
window.history.replaceState(null, "", encodeShare(own, window.location.href));
window.dispatchEvent(new window.HashChangeEvent("hashchange"));
assert.equal($("program-confirm-dialog").open, true);
$("program-confirm-dialog")
  .querySelector(".document-dialog-actions button")
  .click();
assert.equal($("total-time").textContent, timeBefore);
assert.equal(ramContent(16), "7");
window.history.replaceState(null, "", "#cm1.invalid");
window.dispatchEvent(new window.HashChangeEvent("hashchange"));
assert.match($("notice").textContent, /共有URL/);
assert.equal(ramContent(16), "7");
recipient.window.close();
console.log(
  "New/share integration passed: cancel/save/discard, independent named saves, stable comparisons, initial-RAM sharing, clipboard fallback, and confirmed URL restoration.",
);

// Development-only: exercise persistence and sharing through the real UI.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import {
  parseDocument,
  DRAFT_KEY,
  SAVED_KEY,
} from "../logic-circuit/documents.mjs";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.LAB_PLAYWRIGHT_MODULE || "playwright");
const axePath = require.resolve(
  process.env.LAB_AXE_MODULE || "axe-core/axe.min.js",
);
const base = process.env.LAB_BASE_URL || "http://127.0.0.1:8773";
const browser = await chromium.launch({
  executablePath: process.env.LAB_CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const errors = [];
const until = async (page, selector) => page.waitForSelector(selector);
const stored = (page, key) =>
  page.evaluate((key) => localStorage.getItem(key), key);
const circuit = (page) => page.locator("#circuit-nodes").innerHTML();
async function audit(page) {
  // Let the modal and asynchronously enabled share actions finish painting.
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  const result = await page.evaluate(async () =>
    (
      await axe.run({
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
        },
      })
    ).violations.map((v) => ({
      id: v.id,
      targets: v.nodes.map((n) => n.target),
    })),
  );
  assert.deepEqual(result, []);
  assert.ok(
    !(await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    )),
  );
  const rect = await page.locator("dialog[open]").boundingBox();
  assert.ok(
    rect.x >= 0 && rect.x + rect.width <= page.viewportSize().width + 1,
  );
}
async function chooseFile(page, buffer) {
  const chooser = page.waitForEvent("filechooser");
  await page.locator("#import-circuit").click();
  await (
    await chooser
  ).setFiles({ name: "circuit.json", mimeType: "application/json", buffer });
}
async function loadExample(page, type, touch = false) {
  const press = async (selector) =>
    touch ? page.locator(selector).tap() : page.locator(selector).click();
  await press("#load-circuit");
  await press(`#circuit-example-list [data-example="${type}"]`);
  await press('#confirm-form button[type="submit"]');
}
async function newCircuit(page) {
  await page.locator("#new-circuit").click();
  if (await page.locator("#unsaved-dialog").isVisible())
    await page.locator("#discard-and-new").click();
}
let sharingURL, sharedDocument;
try {
  for (const width of [1280, 390, 320]) {
    const touch = width < 600;
    const context = await browser.newContext({
      viewport: { width, height: width === 1280 ? 900 : 844 },
      hasTouch: touch,
      reducedMotion: "reduce",
      permissions: ["clipboard-read", "clipboard-write"],
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    const press = async (selector) =>
      touch ? page.locator(selector).tap() : page.locator(selector).click();
    await page.goto(base + "/lab/logic-circuit/");
    await until(page, '.circuit-node[data-type="and"]');
    await page.addScriptTag({ path: axePath });
    assert.equal(await page.locator("#circuit-example").count(), 0);
    await press("#load-circuit");
    assert.equal(await page.locator("#circuit-example-list button").count(), 7);
    assert.equal(
      await page
        .locator(
          '#circuit-example-list [data-example="and"], #circuit-example-list [data-example="or"], #circuit-example-list [data-example="not"]',
        )
        .count(),
      0,
    );
    await audit(page);
    await press("#load-dialog [data-close-circuit-dialog]");
    await loadExample(page, "adder", touch);
    await page.locator("#circuit-name").fill(`半加算器 ${width}`);
    await press('tr[data-row="3"]');
    const initial = parseDocument(await stored(page, DRAFT_KEY));
    await press("#save-circuit");
    await audit(page);
    await press("#save-submit");
    assert.equal(JSON.parse(await stored(page, SAVED_KEY)).length, 1);
    assert.ok(!(await page.locator("#save-dialog").isVisible()));

    // An edit can overwrite the selected record; copying preserves the original.
    await page.locator('.circuit-node[data-type="not"] .node-body').focus();
    await page.keyboard.press("ArrowRight");
    await page.reload();
    await until(page, '.circuit-node[data-type="not"]');
    await page.addScriptTag({ path: axePath });
    await press("#save-circuit");
    assert.match(await page.locator("#save-submit").textContent(), /上書き/);
    await press("#save-submit");
    const overwritten = JSON.parse(await stored(page, SAVED_KEY));
    assert.equal(overwritten.length, 1);
    assert.notDeepEqual(
      overwritten[0].document.circuit.nodes,
      initial.circuit.nodes,
    );
    await press("#save-circuit");
    await page.locator("#save-name").fill(`半加算器のコピー ${width}`);
    await press("#save-copy");
    assert.equal(JSON.parse(await stored(page, SAVED_KEY)).length, 2);
    assert.equal(
      JSON.parse(await stored(page, SAVED_KEY)).find(
        (r) => r.id === overwritten[0].id,
      ).document.title,
      initial.title,
    );

    // The download contains a portable circuit document, not browser record IDs.
    await press("#save-circuit");
    await press("#export-circuit");
    await until(page, "#export-dialog[open]");
    await audit(page);
    await page.locator("#export-name").fill(`論理回路テスト-${width}`);
    const downloadEvent = page.waitForEvent("download");
    await press('#export-form button[type="submit"]');
    const download = await downloadEvent;
    assert.equal(
      download.suggestedFilename(),
      `論理回路テスト-${width}.circuit.json`,
    );
    const text = await readFile(await download.path(), "utf8"),
      exported = parseDocument(text);
    assert.deepEqual(exported, parseDocument(await stored(page, DRAFT_KEY)));
    assert.ok(!text.includes(overwritten[0].id));

    await newCircuit(page);
    const blank = await circuit(page);
    await press("#load-circuit");
    await audit(page);
    assert.equal(await page.locator(".saved-circuit-item").count(), 2);
    await page
      .locator(".saved-circuit-item")
      .filter({ hasText: exported.title })
      .locator("button")
      .first()
      .click();
    await until(page, "#confirm-dialog[open]");
    await audit(page);
    await page
      .locator("#confirm-dialog button[data-close-circuit-dialog]")
      .last()
      .click();
    assert.equal(await circuit(page), blank);

    // A JSON import, including the same file chosen twice, restores the whole layout.
    await press("#load-circuit");
    await chooseFile(page, Buffer.from(text));
    await until(page, "#confirm-dialog[open]");
    await press('#confirm-form button[type="submit"]');
    assert.deepEqual(parseDocument(await stored(page, DRAFT_KEY)), exported);
    assert.equal(JSON.parse(await stored(page, DRAFT_KEY)).recordId, null);
    assert.equal(
      await page.locator('.circuit-node[data-type="branch"]').count(),
      3,
    );
    assert.equal(
      await page.locator(".current-row").getAttribute("data-row"),
      "3",
    );
    const restored = await circuit(page),
      restoredDraft = await stored(page, DRAFT_KEY);
    await press("#load-circuit");
    await chooseFile(page, Buffer.from("{invalid"));
    await until(page, "#load-dialog .document-error:not([hidden])");
    assert.equal(await circuit(page), restored);
    assert.equal(await stored(page, DRAFT_KEY), restoredDraft);
    await chooseFile(page, Buffer.alloc(100001, 32));
    assert.match(
      await page.locator("#load-dialog .document-error").textContent(),
      /100KB/,
    );
    assert.equal(await circuit(page), restored);
    await chooseFile(page, Buffer.from(text));
    await until(page, "#confirm-dialog[open]");
    await press('#confirm-form button[type="submit"]');
    await page.reload();
    await until(page, '.circuit-node[data-type="not"]');
    assert.equal(
      await page.locator("#circuit-name").inputValue(),
      exported.title,
    );
    assert.equal(await circuit(page), restored);
    await page.addScriptTag({ path: axePath });

    // Native sharing is stubbed: the test does not send a message anywhere.
    await page.evaluate(() =>
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: async (data) => {
          window.__shared = data;
        },
      }),
    );
    await press("#share-circuit");
    await page.waitForFunction(
      () => document.getElementById("share-url").value !== "",
    );
    await page.waitForFunction(
      () => !document.getElementById("copy-url").disabled,
    );
    const url = await page.locator("#share-url").inputValue();
    assert.ok(new URL(url).hash.startsWith("#lc1."));
    await audit(page);
    await press("#copy-url");
    assert.equal(
      await page.evaluate(() => navigator.clipboard.readText()),
      url,
    );
    await press("#native-share");
    assert.deepEqual(await page.evaluate(() => window.__shared), {
      title: exported.title,
      url,
    });
    // A blocked clipboard still offers selected text for manual copying.
    await page.evaluate(() =>
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: undefined,
      }),
    );
    await press("#copy-url");
    assert.match(
      await page.locator("#share-status").textContent(),
      /URLを選択/,
    );
    assert.equal(
      await page
        .locator("#share-url")
        .evaluate((field) => field.selectionEnd - field.selectionStart),
      url.length,
    );
    await press("#share-dialog [data-close-circuit-dialog]");

    // Browser-list load and its two-click delete confirmation.
    await newCircuit(page);
    await press("#load-circuit");
    await page
      .locator(".saved-circuit-item")
      .filter({ hasText: exported.title })
      .locator("button")
      .first()
      .click();
    await press('#confirm-form button[type="submit"]');
    assert.deepEqual(parseDocument(await stored(page, DRAFT_KEY)), exported);
    await press("#load-circuit");
    const oldRow = page
      .locator(".saved-circuit-item")
      .filter({ hasText: initial.title });
    await oldRow.locator("button").last().click();
    assert.equal(JSON.parse(await stored(page, SAVED_KEY)).length, 2);
    await oldRow.locator("button").last().click();
    assert.equal(JSON.parse(await stored(page, SAVED_KEY)).length, 1);
    await press("#load-dialog [data-close-circuit-dialog]");
    sharingURL = url;
    sharedDocument = exported;
    // Identical name/content must not attach an example to an owned record.
    await loadExample(page, "xor", touch);
    await press("#save-circuit");
    assert.doesNotMatch(
      await page.locator("#save-submit").textContent(),
      /上書き/,
    );
    await press("#save-submit");
    const beforeExample = await stored(page, SAVED_KEY);
    const originalXor = JSON.parse(beforeExample).find(
      (record) => record.document.title === "排他的論理和",
    );
    await loadExample(page, "xor", touch);
    assert.equal(JSON.parse(await stored(page, DRAFT_KEY)).recordId, null);
    assert.deepEqual(
      parseDocument(await stored(page, DRAFT_KEY)),
      originalXor.document,
    );
    await page.reload();
    await press("#save-circuit");
    assert.doesNotMatch(
      await page.locator("#save-submit").textContent(),
      /上書き/,
    );
    await press("#save-dialog [data-close-circuit-dialog]");
    await press('tr[data-row="3"]');
    await page.reload();
    await press("#save-circuit");
    assert.doesNotMatch(
      await page.locator("#save-submit").textContent(),
      /上書き/,
    );
    await page.locator("#save-name").fill(`XORの実験 ${width}`);
    await press("#save-submit");
    const afterExample = JSON.parse(await stored(page, SAVED_KEY));
    assert.equal(afterExample.length, JSON.parse(beforeExample).length + 1);
    assert.deepEqual(
      afterExample.find((record) => record.id === originalXor.id),
      originalXor,
    );
    await loadExample(page, "xor", touch);
    assert.equal(
      await page.locator(".current-row").getAttribute("data-row"),
      "0",
    );
    assert.equal(await stored(page, SAVED_KEY), JSON.stringify(afterExample));
    await context.close();
    console.log(
      `PASS ${width}px: named save/overwrite/copy/delete, JSON download/import/cancel, example load/edit/reload/new save, preserved originals, copy fallback, native sharing and accessible dialogs`,
    );
  }

  // Opening or reloading someone else's URL must leave our draft and saves intact.
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/lab/logic-circuit/");
  await loadExample(page, "full-adder", true);
  await page.locator("#circuit-name").fill("自分の作業");
  await page.locator("#save-circuit").click();
  await page.locator("#save-submit").click();
  const ownDraft = await stored(page, DRAFT_KEY),
    ownSaves = await stored(page, SAVED_KEY);
  await page.goto(sharingURL);
  await until(page, "#shared-circuit:not([hidden])");
  assert.equal(
    await page.locator("#circuit-name").inputValue(),
    sharedDocument.title,
  );
  assert.equal(await stored(page, DRAFT_KEY), ownDraft);
  assert.equal(await stored(page, SAVED_KEY), ownSaves);
  await page.locator("#fit-circuit").tap();
  await page.locator("#zoom-out-circuit").tap();
  await page.reload();
  await until(page, "#shared-circuit:not([hidden])");
  assert.equal(await stored(page, DRAFT_KEY), ownDraft);
  await page.locator("#restore-own-circuit").tap();
  await page.locator('#confirm-form button[type="submit"]').tap();
  assert.equal(await page.locator("#circuit-name").inputValue(), "自分の作業");
  assert.equal(new URL(page.url()).hash, "");
  assert.equal(await stored(page, DRAFT_KEY), ownDraft);
  await page.goto(sharingURL);
  await until(page, "#shared-circuit:not([hidden])");
  await page.locator('tr[data-row="0"]').tap();
  assert.ok(await page.locator("#shared-circuit").isHidden());
  assert.equal(new URL(page.url()).hash, "");
  assert.notEqual(await stored(page, DRAFT_KEY), ownDraft);
  assert.equal(await stored(page, SAVED_KEY), ownSaves);
  const adoptedDraft = await stored(page, DRAFT_KEY);

  await page.locator("#load-circuit").tap();
  await page.locator(".document-url-load summary").tap();
  await page.locator("#load-url").fill(sharingURL);
  await page.locator("#load-url-submit").tap();
  await until(page, "#confirm-dialog[open]");
  await page.locator('#confirm-form button[type="submit"]').tap();
  assert.ok(await page.locator("#shared-circuit").isVisible());
  assert.equal(await stored(page, DRAFT_KEY), adoptedDraft);
  await page.locator("#load-circuit").tap();
  await page.locator("#load-url").fill("#lc1.d.broken");
  await page.locator("#load-url-submit").tap();
  await until(page, "#load-dialog .document-error:not([hidden])");
  assert.equal(await stored(page, DRAFT_KEY), adoptedDraft);
  await page.locator("#load-dialog [data-close-circuit-dialog]").tap();
  await page.goto(base + "/lab/logic-circuit/#lc9.j.e30");
  await page.waitForFunction(() =>
    document.getElementById("circuit-message").classList.contains("is-error"),
  );
  assert.equal(await stored(page, DRAFT_KEY), adoptedDraft);
  assert.equal(await stored(page, SAVED_KEY), ownSaves);
  console.log(
    "PASS shared URL open/reload/paste, recovery of own work, adoption only after editing and invalid-share preservation",
  );

  // A damaged save list remains untouched, and the file alternative stays usable.
  await page.evaluate((key) => localStorage.setItem(key, "damaged"), SAVED_KEY);
  await page.locator("#load-circuit").click();
  assert.match(
    await page.locator("#load-dialog .document-error").textContent(),
    /変更していません/,
  );
  await page.locator("#load-dialog [data-close-circuit-dialog]").click();
  await page.locator("#save-circuit").click();
  await page.locator("#save-submit").click();
  assert.match(
    await page.locator("#save-dialog .document-error").textContent(),
    /変更していません/,
  );
  assert.equal(await stored(page, SAVED_KEY), "damaged");
  await page.locator("#export-circuit").click();
  assert.ok(await page.locator("#export-dialog").isVisible());
  await context.close();

  const damagedContext = await browser.newContext();
  await damagedContext.addInitScript((key) => {
    if (localStorage.getItem(key) === null)
      localStorage.setItem(key, "damaged draft");
  }, DRAFT_KEY);
  const damagedPage = await damagedContext.newPage();
  damagedPage.on("pageerror", (e) => errors.push(e.message));
  await damagedPage.goto(base + "/lab/logic-circuit/");
  await damagedPage.waitForFunction(() =>
    document.getElementById("circuit-message").classList.contains("is-error"),
  );
  await damagedPage.evaluate(() => dispatchEvent(new Event("pagehide")));
  assert.equal(await stored(damagedPage, DRAFT_KEY), "damaged draft");
  await damagedPage.keyboard.press("Control+s");
  assert.ok(await damagedPage.locator("#save-dialog").isVisible());
  await damagedPage.keyboard.press("Escape");
  assert.ok(await damagedPage.locator("#save-dialog").isHidden());
  await damagedPage.reload();
  assert.equal(await stored(damagedPage, DRAFT_KEY), "damaged draft");
  await damagedPage.locator('tr[data-row="3"]').click();
  assert.ok(parseDocument(await stored(damagedPage, DRAFT_KEY)));
  await damagedContext.close();
  console.log(
    "PASS damaged drafts survive pagehide/reload until explicit editing; keyboard save and Escape",
  );

  // An opaque-origin standalone HTML supports export and URL paste without network.
  const offline = await browser.newPage({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  offline.on("pageerror", (e) => errors.push(e.message));
  const requests = [];
  offline.on("request", (r) => {
    if (!r.url().startsWith("data:") && !r.url().startsWith("blob:"))
      requests.push(r.url());
  });
  await offline.setContent(
    await readFile(
      "/workspace/interactive-lab-review/Interactive-Lab-logic-circuit.html",
      "utf8",
    ),
  );
  await offline.locator("#circuit-name").fill("オフラインの回路");
  await offline.locator("#share-circuit").click();
  await offline.waitForFunction(
    () => document.getElementById("share-url").value !== "",
  );
  assert.match(
    await offline.locator("#share-url").inputValue(),
    /^https:\/\/mei-chan-nel\.com\/lab\/logic-circuit\/#lc1\./,
  );
  assert.ok(await offline.locator("#share-offline-help").isVisible());
  await offline.locator("#share-dialog [data-close-circuit-dialog]").click();
  await offline.locator("#load-circuit").click();
  await offline.locator(".document-url-load summary").click();
  await offline.locator("#load-url").fill(sharingURL);
  await offline.locator("#load-url-submit").click();
  await until(offline, "#confirm-dialog[open]");
  await offline.locator('#confirm-form button[type="submit"]').click();
  assert.equal(
    await offline.locator("#circuit-name").inputValue(),
    sharedDocument.title,
  );
  assert.equal(
    await offline.locator('.circuit-node[data-type="branch"]').count(),
    3,
  );
  await offline.locator("#save-circuit").click();
  await offline.locator("#save-submit").click();
  assert.match(
    await offline.locator("#save-dialog .document-error").textContent(),
    /ファイルに書き出し/,
  );
  await offline.locator("#export-circuit").click();
  const event = offline.waitForEvent("download");
  await offline.locator('#export-form button[type="submit"]').click();
  assert.deepEqual(
    parseDocument(await readFile(await (await event).path(), "utf8")),
    sharedDocument,
  );
  assert.deepEqual(requests, []);
  assert.deepEqual(errors, []);
  console.log(
    "PASS unavailable browser storage, offline JSON export/URL restoration; no external requests or JavaScript errors",
  );
} finally {
  await browser.close();
}

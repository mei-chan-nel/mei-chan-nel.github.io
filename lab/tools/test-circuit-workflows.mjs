// Development-only: editing, explicit branching, unsaved-work protection and
// the asynchronous dialog-close regression reported during desktop use.
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
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const errors = [];
const terminal = (page, type, label) =>
  page.locator(`.circuit-node[data-type="${type}"][data-label="${label}"]`);
const press = async (locator, touch) =>
  touch ? locator.tap() : locator.click();
const draft = (page) =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key)), DRAFT_KEY);
async function load(page, id, touch = false) {
  await press(page.locator("#load-circuit"), touch);
  await press(page.locator(`[data-example="${id}"]`), touch);
  await press(page.locator('#confirm-form button[type="submit"]'), touch);
}
async function rename(page, type, label, name, touch) {
  await press(terminal(page, type, label).locator(".node-name"), touch);
  await page.locator("#terminal-name").fill(name);
  await press(page.locator('#terminal-form button[type="submit"]'), touch);
}
async function connect(page, from, to, fromPort = 0, toPort = 0) {
  await page
    .locator(
      `.port[data-node="${from}"][data-direction="out"][data-port="${fromPort}"]`,
    )
    .focus();
  await page.keyboard.press("Enter");
  await page
    .locator(
      `.port[data-node="${to}"][data-direction="in"][data-port="${toPort}"]`,
    )
    .focus();
  await page.keyboard.press("Enter");
}
async function audit(page) {
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  const violations = await page.evaluate(async () =>
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
  assert.deepEqual(violations, []);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    ),
    false,
  );
}
async function cancelThenReopen(page) {
  // Keep close and reopen in one event task; the old queued close event must
  // not erase the newly chosen circuit before the user confirms it.
  await page.evaluate(() => {
    document.getElementById("load-circuit").click();
    document.querySelector('[data-example="adder"]').click();
    document
      .querySelector("#confirm-dialog [data-close-circuit-dialog]")
      .click();
    document.getElementById("load-circuit").click();
    document.querySelector('[data-example="majority"]').click();
  });
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  await page.locator('#confirm-form button[type="submit"]').click();
  assert.equal(
    await page.locator('.circuit-node[data-type="input"]').count(),
    3,
  );
  assert.equal(await page.locator("#confirm-dialog").isVisible(), false);
}
try {
  for (const width of [1280, 390, 320]) {
    const touch = width < 600;
    const context = await browser.newContext({
      viewport: { width, height: touch ? 844 : 1100 },
      hasTouch: touch,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(base + "/lab/logic-circuit/");
    await page.waitForSelector(".circuit-node");
    const palette = await page.locator(".parts-bar").boundingBox(),
      board = await page.locator("#circuit-stage").boundingBox();
    if (!touch) {
      assert.ok(palette.x + palette.width < board.x);
      const first = await page.locator('[data-part="and"]').boundingBox(),
        second = await page.locator('[data-part="or"]').boundingBox();
      assert.ok(first.y + first.height < second.y);
    } else assert.ok(palette.y + palette.height < board.y);
    const handle = page.locator("#resize-circuit");
    await handle.focus();
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowDown");
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    let resized = await page.locator("#circuit-stage").boundingBox();
    assert.equal(Math.round(resized.width), Math.round(board.width - 16));
    assert.equal(Math.round(resized.height), Math.round(board.height + 16));
    await page.keyboard.press("Home");
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    if (!touch) {
      const grip = await handle.boundingBox();
      await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
      await page.mouse.down();
      await page.mouse.move(
        grip.x + grip.width / 2 - 90,
        grip.y + grip.height / 2 + 70,
        { steps: 8 },
      );
      await page.mouse.up();
      await page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          ),
      );
      resized = await page.locator("#circuit-stage").boundingBox();
      assert.equal(Math.round(resized.width), Math.round(board.width - 90));
      assert.equal(Math.round(resized.height), Math.round(board.height + 70));
      await handle.focus();
      await page.keyboard.press("Home");
    }
    await rename(page, "input", "A", "aの入力", touch);
    await rename(page, "output", "X", "結果", touch);
    await rename(page, "input", "A", "  ", touch);
    assert.equal(
      await terminal(page, "input", "A").locator(".node-title").textContent(),
      "aの入力",
    );
    assert.match(
      await page.locator("#circuit-truth thead").textContent(),
      /aの入力/,
    );
    await page.reload();
    await page.waitForSelector(".node-name");
    assert.equal(
      await terminal(page, "output", "X").locator(".node-title").textContent(),
      "結果",
    );
    const before = await draft(page);
    await press(page.locator("#new-circuit"), touch);
    await press(
      page.locator("#unsaved-dialog [data-close-circuit-dialog]").first(),
      touch,
    );
    assert.deepEqual((await draft(page)).circuit, before.circuit);
    await press(page.locator("#new-circuit"), touch);
    await press(page.locator("#save-and-new"), touch);
    await page.locator("#save-name").fill("名前をつけた回路");
    await press(page.locator("#save-submit"), touch);
    const saves = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)),
      SAVED_KEY,
    );
    assert.equal(saves.length, 1);
    assert.equal(
      saves[0].document.circuit.nodes.find((n) => n.label === "A").name,
      "aの入力",
    );
    assert.equal(
      await page.locator('.circuit-node[data-type="and"]').count(),
      0,
    );
    assert.equal((await draft(page)).recordId, null);
    await press(page.locator("#new-circuit"), touch);
    assert.equal(await page.locator("#unsaved-dialog").isVisible(), false);
    // A named save is clean until edited, including after an autosaved reload.
    const loadNamed = async () => {
      await press(page.locator("#load-circuit"), touch);
      await press(
        page.getByRole("button", {
          name: "名前をつけた回路を読込",
          exact: true,
        }),
        touch,
      );
      await press(page.locator('#confirm-form button[type="submit"]'), touch);
    };
    await loadNamed();
    await press(page.locator("#new-circuit"), touch);
    assert.equal(await page.locator("#unsaved-dialog").isVisible(), false);
    await loadNamed();
    await press(terminal(page, "input", "A").locator(".node-body"), touch);
    await page.reload();
    await page.waitForSelector(".node-name");
    await press(page.locator("#new-circuit"), touch);
    assert.equal(await page.locator("#unsaved-dialog").isVisible(), true);
    await press(page.locator("#save-and-new"), touch);
    assert.match(await page.locator("#save-submit").textContent(), /上書き/);
    await press(page.locator("#save-submit"), touch);
    const updatedSaves = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)),
      SAVED_KEY,
    );
    assert.equal(updatedSaves.length, 1);
    assert.equal(
      updatedSaves[0].document.circuit.nodes.find((n) => n.label === "A").value,
      1,
    );
    assert.equal((await draft(page)).recordId, null);
    // An outlet changes its destination, leaving the old consumer incomplete.
    await press(page.locator('[data-part="and"]'), touch);
    await press(page.locator('[data-part="output"]'), touch);
    const a = await terminal(page, "input", "A").getAttribute("data-id"),
      b = await terminal(page, "input", "B").getAttribute("data-id"),
      x = await terminal(page, "output", "X").getAttribute("data-id"),
      y = await terminal(page, "output", "Y").getAttribute("data-id"),
      and = await page
        .locator('.circuit-node[data-type="and"]')
        .getAttribute("data-id");
    await connect(page, a, and);
    await connect(page, b, and, 0, 1);
    await connect(page, and, x);
    await connect(page, and, y);
    assert.equal(await page.locator(`.wire[data-to="${x}"]`).count(), 0);
    assert.equal(await page.locator(`.wire[data-from="${and}"]`).count(), 1);
    assert.equal(
      await terminal(page, "output", "X").locator(".input-value").textContent(),
      "—",
    );
    await page.locator(`.wire[data-to="${y}"]`).focus();
    await page.keyboard.press("Enter");
    await press(page.locator('[data-part="branch"]'), touch);
    const branch = await page
      .locator('.circuit-node[data-type="branch"]')
      .getAttribute("data-id");
    await connect(page, branch, x, 1);
    await press(page.locator('tr[data-row="3"]'), touch);
    assert.equal(
      await terminal(page, "output", "X").locator(".input-value").textContent(),
      "1",
    );
    assert.equal(
      await terminal(page, "output", "Y").locator(".input-value").textContent(),
      "1",
    );
    // Each of the branch's two distinct outlets also permits only one wire.
    await connect(page, branch, x, 0);
    assert.equal(await page.locator(`.wire[data-to="${y}"]`).count(), 0);
    await press(page.locator("#new-circuit"), touch);
    await press(page.locator("#discard-and-new"), touch);
    assert.equal(
      await page.locator('.circuit-node[data-type="branch"]').count(),
      0,
    );
    await cancelThenReopen(page);
    await page.addScriptTag({ path: axePath });
    await audit(page);
    await rename(
      page,
      "input",
      "A",
      "とても長い端子名を変更しても読み上げは全文になります",
      touch,
    );
    await audit(page);
    await press(page.locator("#new-circuit"), touch);
    await audit(page);
    await press(page.locator("#save-and-new"), touch);
    await press(
      page.locator("#save-dialog [data-close-circuit-dialog]").first(),
      touch,
    );
    assert.equal(
      await page.locator('.circuit-node[data-type="input"]').count(),
      3,
    );
    assert.ok(
      !(await page.locator("main").textContent()).includes(
        "入力を切り替えて試せます。",
      ),
    );
    assert.ok(!(await page.locator("main").textContent()).includes("定常値"));
    console.log(
      `PASS ${width}px: palette placement, resize, terminal names, unsaved save/discard/cancel, strict outlets and dialog reopen`,
    );
    await context.close();
  }
  const page = await browser.newPage({
    viewport: { width: 1280, height: 1000 },
  });
  page.on("pageerror", (error) => errors.push(error.message));
  const requests = [];
  page.on("request", (request) => {
    if (/^https?:/.test(request.url())) requests.push(request.url());
  });
  await page.setContent(
    await readFile(
      "/workspace/interactive-lab-review/Interactive-Lab-logic-circuit.html",
      "utf8",
    ),
  );
  await cancelThenReopen(page);
  await rename(page, "input", "A", "ファイルに残す入力", false);
  await page.locator("#new-circuit").click();
  await page.locator("#save-and-new").click();
  await page.locator("#save-submit").click();
  assert.equal(await page.locator("#save-dialog").isVisible(), true);
  assert.equal(
    await page.locator('.circuit-node[data-type="input"]').count(),
    3,
  );
  await page.locator("#export-circuit").click();
  const downloadEvent = page.waitForEvent("download");
  await page.locator('#export-form button[type="submit"]').click();
  const exported = parseDocument(
    await readFile(await (await downloadEvent).path(), "utf8"),
  );
  assert.equal(
    exported.circuit.nodes.find((n) => n.label === "A").name,
    "ファイルに残す入力",
  );
  assert.equal(
    await page.locator('.circuit-node[data-type="input"]').count(),
    2,
  );
  assert.equal(await page.locator('.circuit-node[data-type="and"]').count(), 0);
  assert.deepEqual(requests, []);
  assert.deepEqual(errors, []);
  console.log(
    "PASS offline HTML: examples load, unavailable browser save keeps work, JSON save precedes new circuit; no external requests",
  );
} finally {
  await browser.close();
}

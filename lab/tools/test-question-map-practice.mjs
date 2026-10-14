import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.LAB_PLAYWRIGHT_MODULE || "playwright");
const base = process.env.LAB_BASE_URL || "http://127.0.0.1:8773";
const app = new URL("../../../info1-quiz-app/data/questions/", import.meta.url);
const questions = JSON.parse(await readFile(new URL("completed_questions.json", app)));
const coordinates = JSON.parse(await readFile(new URL("map_points.json", app))).points;
const byId = new Map(questions.map(q => [q.id, q]));
const browser = await chromium.launch({ executablePath: process.env.LAB_CHROMIUM_PATH || "/usr/bin/chromium", headless: true, args: ["--no-sandbox"] });
const errors = [];
async function candidates(page, central = false) {
  const { a, d, e, f, ratio, width, height } = await page.evaluate(() => window.mapTransform);
  const inset = central ? .2 : 0;
  return Object.entries(coordinates).filter(([, [x, y]]) => {
    const px = (a * x + e) / ratio, py = (d * y + f) / ratio;
    return px >= width * inset && px <= width * (1 - inset) && py >= height * inset && py <= height * (1 - inset);
  }).map(([id]) => id);
}
async function checkScope(page, central = false) {
  const ids = await candidates(page, central), href = await page.locator("#region-start").getAttribute("href");
  const selected = new URL(href, base).searchParams.get("challenge").split(",");
  assert.equal(selected.length, Math.min(10, ids.length));
  assert.equal(new Set(selected).size, selected.length);
  assert.ok(selected.every(id => ids.includes(id)), "Every selected question must belong to the indicated region");
  const label = await page.locator(central ? "#region-center-count" : "#region-viewport-count").textContent();
  assert.equal(Number(label.replace(/[^\d]/g, "")), ids.length);
  assert.equal(await page.locator("#region-start").textContent(), `${selected.length}問を解く ↗`);
  return selected;
}
try {
  for (const width of [1280, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, isMobile: width < 600, hasTouch: width < 600 });
    await context.route("**/*", route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.fulfill({ body: "" }));
    await context.addInitScript(() => {
      const original = CanvasRenderingContext2D.prototype.stroke;
      CanvasRenderingContext2D.prototype.stroke = function (...args) {
        if (this.canvas.id === "map-canvas" && args[0] instanceof Path2D) {
          const { a, d, e, f } = this.getTransform(), width = this.canvas.clientWidth, height = this.canvas.clientHeight;
          window.mapTransform = { a, d, e, f, width, height, ratio: this.canvas.width / width };
        }
        return original.apply(this, args);
      };
    });
    const page = await context.newPage(); page.on("pageerror", error => errors.push(error.message));
    await page.goto(base + "/lab/question-map/");
    await page.waitForSelector("#map-status[hidden]", { state: "attached" });
    await page.waitForFunction(() => !document.querySelector("#region-practice").disabled);
    const before = await page.evaluate(() => localStorage.getItem("info1LearningRecord:v1"));
    const row = await page.evaluate(() => ["#score-personal", "#score-global", "#region-practice"].map(s => {
      const r = document.querySelector(s).getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right };
    }));
    assert.ok(row[2].x - row[1].right >= 10, "Practice action has a gap after score controls");
    assert.equal(row[2].y, row[1].y, "Practice action stays on the same row, even at 320px");
    await page.locator("#region-practice").scrollIntoViewIfNeeded();
    const scrollBefore = await page.evaluate(() => scrollY);
    await page.locator("#region-practice").click();
    await page.waitForSelector("#region-dialog[open]");
    assert.equal(await page.locator("#region-viewport").getAttribute("aria-pressed"), "true");
    await checkScope(page);
    assert.ok((await candidates(page)).length > await page.locator(".map-card").count(), "Candidates include hidden cards");
    const fullPreview = await page.locator("#region-preview").screenshot();
    await page.locator("#region-center").click();
    await checkScope(page, true);
    assert.notDeepEqual(await page.locator("#region-preview").screenshot(), fullPreview, "Preview highlights the selected scope");
    if (process.env.LAB_AXE_MODULE) {
      await page.addScriptTag({ path: process.env.LAB_AXE_MODULE });
      const results = await page.evaluate(async () => (await axe.run(document.querySelector("#region-dialog"), { runOnly: ["wcag2a", "wcag2aa", "wcag21aa"] })).violations);
      assert.deepEqual(results.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })), []);
    }
    if (process.env.LAB_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.LAB_SCREENSHOT_DIR}/question-map-practice-${width}.png` });
    await page.keyboard.press("Escape");
    await page.waitForSelector("#region-dialog:not([open])", { state: "attached" });
    assert.ok(Math.abs(await page.evaluate(() => scrollY) - scrollBefore) <= 1);
    assert.equal(await page.evaluate(() => document.activeElement.id), "region-practice");
    assert.equal(await page.evaluate(() => localStorage.getItem("info1LearningRecord:v1")), before);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    // Zoom and pan, then compare the dialog against the actual transformed map.
    await page.locator("#zoom-in").click(); await page.locator("#zoom-in").click();
    await page.waitForTimeout(700);
    await page.locator("#map-viewport").focus(); await page.keyboard.press("ArrowRight"); await page.waitForTimeout(600);
    await page.locator("#region-practice").click(); await checkScope(page);
    await page.locator("#region-center").click();
    await checkScope(page, true);
    await page.locator("#region-close").click();
    await page.locator("#region-practice").click();
    assert.equal(await page.locator("#region-viewport").getAttribute("aria-pressed"), "true", "Every opening defaults to the visible range");
    await checkScope(page); await page.locator("#region-close").click();
    // Use the real app's challenge route and answer without resetting demo history.
    await page.locator("#region-practice").click(); await page.locator("#region-center").click();
    const appIds = await checkScope(page, true);
    const recordBefore = await page.evaluate(() => JSON.parse(localStorage.getItem("info1LearningRecord:v1") || '{"q":{}}'));
    await page.locator("#region-start").click(); await page.waitForSelector(".choice-button");
    assert.deepEqual(new URL(page.url()).searchParams.get("challenge").split(","), appIds);
    assert.equal(await page.locator("#progressText").textContent(), `1/${appIds.length}`);
    const question = byId.get(appIds[0]);
    const correct = question.choices.find(c => c.is_correct || c.choice_id === question.answer_choice_id);
    await page.locator(".choice-button").filter({ hasText: correct.text }).click();
    await page.waitForFunction(({ id, attempts }) => JSON.parse(localStorage.getItem("info1LearningRecord:v1")).q[id]?.[0] === attempts + 1,
      { id: question.id, attempts: recordBefore.q[question.id]?.[0] || 0 });
    const after = await page.evaluate(() => JSON.parse(localStorage.getItem("info1LearningRecord:v1")));
    for (const [id, record] of Object.entries(recordBefore.q)) if (id !== question.id) assert.deepEqual(after.q[id], record);
    assert.equal(after.q[question.id][1], (recordBefore.q[question.id]?.[1] || 0) + 1);
    await page.goto(base + "/lab/question-map/"); await page.waitForSelector("#map-status[hidden]", { state: "attached" });
    assert.equal(await page.evaluate(id => JSON.parse(localStorage.getItem("info1LearningRecord:v1")).q[id][0], question.id), after.q[question.id][0]);
    if (width === 1280) {
      // Pan to an empty corner at high magnification: a blank region must
      // never silently start a session using questions from elsewhere.
      for (let i = 0; i < 8; i++) await page.locator("#zoom-in").click();
      await page.locator("#map-viewport").evaluate(n => {
        for (const key of ["ArrowRight", "ArrowDown"]) for (let i = 0; i < 200; i++) n.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
      });
      await page.waitForTimeout(900);
      assert.equal((await candidates(page)).length, 0);
      assert.equal(await page.locator("#region-practice").isDisabled(), true);
      await page.locator("#map-home").click();
      await page.waitForFunction(() => !document.querySelector("#region-practice").disabled);
    }
    console.log(`PASS ${width}px: scope/count/membership, random 10, preview, keyboard/focus/scroll, real app answer and existing history`);
    await context.close();
  }
  assert.deepEqual(errors, []);
} finally { await browser.close(); }

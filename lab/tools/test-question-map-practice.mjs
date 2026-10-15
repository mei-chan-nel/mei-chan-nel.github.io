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
async function candidates(page, custom = false) {
  const { transform, circle } = await page.evaluate(custom => ({ transform: custom ? window.regionTransform : window.mapTransform, circle: window.regionCircle }), custom);
  const { a, d, e, f, ratio, width, height } = transform;
  return Object.entries(coordinates).filter(([, [x, y]]) => {
    const px = (a * x + e) / ratio, py = (d * y + f) / ratio;
    return custom ? (px - circle.x) ** 2 + (py - circle.y) ** 2 <= circle.radius ** 2 : px >= 0 && px <= width && py >= 0 && py <= height;
  }).map(([id]) => id);
}
async function checkScope(page, custom = false) {
  const ids = await candidates(page, custom), href = await page.locator("#region-start").getAttribute("href");
  const label = await page.locator(custom ? "#region-custom-count" : "#region-viewport-count").textContent();
  assert.equal(Number(label.replace(/[^\d]/g, "")), ids.length);
  if (!ids.length) {
    assert.equal(href, null); assert.equal(await page.locator("#region-start").getAttribute("aria-disabled"), "true");
    return [];
  }
  const selected = new URL(href, base).searchParams.get("challenge").split(",");
  assert.equal(selected.length, Math.min(5, ids.length));
  assert.equal(new Set(selected).size, selected.length);
  assert.ok(selected.every(id => ids.includes(id)), "Every selected question must belong to the indicated region");
  assert.equal(await page.locator("#region-start").textContent(), `${selected.length}問を解く ↗`);
  return selected;
}
const settle = page => page.waitForTimeout(100);
async function circleGeometry(page) {
  return page.evaluate(() => {
    const { a, d, e, f, ratio } = window.regionTransform, { x, y, radius } = window.regionCircle;
    return { x, y, radius, worldX: (x * ratio - e) / a, worldY: (y * ratio - f) / d, worldRadius: radius * ratio / a, scale: a / ratio };
  });
}
async function dragCircle(page, dx, dy, touch = false) {
  const box = await page.locator("#region-preview").boundingBox(), c = await circleGeometry(page);
  const x = box.x + c.x, y = box.y + c.y;
  if (touch) {
    const cdp = await page.context().newCDPSession(page);
    for (const [type, t] of [["touchStart", 0], ["touchMove", .5], ["touchMove", 1], ["touchEnd", null]]) {
      await cdp.send("Input.dispatchTouchEvent", { type, touchPoints: t === null ? [] : [{ x: x + dx * t, y: y + dy * t, id: 1 }] });
    }
    await cdp.detach();
  } else {
    await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + dx, y + dy, { steps: 5 }); await page.mouse.up();
  }
  await settle(page);
}
try {
  for (const width of [1280, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: width === 320 ? 667 : 1000 }, isMobile: width < 600, hasTouch: width < 600 });
    await context.route("**/*", route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.fulfill({ body: "" }));
    await context.addInitScript(() => {
      const original = CanvasRenderingContext2D.prototype.stroke, arc = CanvasRenderingContext2D.prototype.arc;
      CanvasRenderingContext2D.prototype.stroke = function (...args) {
        if (["map-canvas", "region-preview"].includes(this.canvas.id) && args[0] instanceof Path2D) {
          const { a, d, e, f } = this.getTransform(), width = this.canvas.clientWidth, height = this.canvas.clientHeight;
          window[this.canvas.id === "map-canvas" ? "mapTransform" : "regionTransform"] = { a, d, e, f, width, height, ratio: Math.min(devicePixelRatio || 1, 2) };
        }
        return original.apply(this, args);
      };
      CanvasRenderingContext2D.prototype.arc = function (x, y, radius, ...rest) {
        if (this.canvas.id === "region-preview" && radius > 10) window.regionCircle = { x, y, radius };
        return arc.call(this, x, y, radius, ...rest);
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
    await page.locator("#region-custom").click(); await settle(page);
    await checkScope(page, true);
    assert.equal(await page.locator("#region-custom").textContent().then(t => t.startsWith("地域を絞る")), true);
    assert.notDeepEqual(await page.locator("#region-preview").screenshot(), fullPreview, "Preview highlights the selected scope");
    const mainBefore = await page.evaluate(() => window.mapTransform), geometry = await circleGeometry(page);
    await dragCircle(page, 24, 16, width < 600);
    const moved = await circleGeometry(page); assert.ok(moved.x - geometry.x > 20 && moved.y - geometry.y > 12);
    await checkScope(page, true);
    await page.locator("#region-zoom-in").click(); await settle(page);
    const enlarged = await circleGeometry(page);
    assert.ok(enlarged.worldRadius < moved.worldRadius * .73);
    // Canvas exposes a float-rounded transform; tolerate a fraction of a pixel.
    assert.ok(Math.abs(enlarged.worldX - moved.worldX) < 1e-4 && Math.abs(enlarged.worldY - moved.worldY) < 1e-4);
    await checkScope(page, true);
    await page.locator("#region-zoom-out").click(); await settle(page);
    assert.ok(Math.abs((await circleGeometry(page)).worldRadius - moved.worldRadius) < 1e-4);
    const box = await page.locator("#region-preview").boundingBox();
    await page.mouse.move(box.x + moved.x, box.y + moved.y);
    const pageBeforeWheel = await page.evaluate(() => ({ y: scrollY, scale: visualViewport.scale }));
    await page.keyboard.down("Control"); await page.mouse.wheel(0, -150); await page.keyboard.up("Control"); await settle(page);
    assert.ok((await circleGeometry(page)).worldRadius < moved.worldRadius);
    assert.deepEqual(await page.evaluate(() => ({ y: scrollY, scale: visualViewport.scale })), pageBeforeWheel);
    await checkScope(page, true);
    if (width < 600) {
      const cdp = await context.newCDPSession(page), c = await circleGeometry(page);
      const cx = box.x + c.x, cy = box.y + c.y;
      for (const [type, spread] of [["touchStart", 20], ["touchMove", 30], ["touchMove", 40], ["touchEnd", null]]) {
        await cdp.send("Input.dispatchTouchEvent", { type, touchPoints: spread === null ? [] : [{ x: cx - spread, y: cy, id: 1 }, { x: cx + spread, y: cy, id: 2 }] });
        await page.waitForTimeout(40);
      }
      await cdp.detach(); await settle(page);
      assert.ok((await circleGeometry(page)).worldRadius < c.worldRadius * .6);
      await checkScope(page, true);
    }
    await page.locator("#region-preview").focus(); await page.keyboard.press("ArrowLeft"); await settle(page); await checkScope(page, true);
    assert.deepEqual(await page.evaluate(() => window.mapTransform), mainBefore, "Picker gestures leave the main map unchanged");
    if (process.env.LAB_AXE_MODULE) {
      await page.addScriptTag({ path: process.env.LAB_AXE_MODULE });
      const results = await page.evaluate(async () => (await axe.run(document.querySelector("#region-dialog"), { runOnly: ["wcag2a", "wcag2aa", "wcag21aa"] })).violations);
      assert.deepEqual(results.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })), []);
    }
    if (process.env.LAB_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.LAB_SCREENSHOT_DIR}/question-map-practice-${width}.png` });
    if (width === 1280) {
      const c = await circleGeometry(page), ids = await candidates(page, true);
      const nearest = ids.map(id => ({ id, xy: coordinates[id] })).sort((a, b) => (a.xy[0] - c.worldX) ** 2 + (a.xy[1] - c.worldY) ** 2 - (b.xy[0] - c.worldX) ** 2 - (b.xy[1] - c.worldY) ** 2)[0];
      await dragCircle(page, (nearest.xy[0] - c.worldX) * c.scale, (nearest.xy[1] - c.worldY) * c.scale);
      for (let i = 0; i < 15; i++) await page.locator("#region-zoom-in").click();
      await settle(page);
      const few = await checkScope(page, true);
      assert.ok(few.length > 0 && few.length <= 5, "A small circle passes only the available questions");
      const high = await circleGeometry(page), maxX = Math.max(...Object.values(coordinates).map(p => p[0]));
      const steps = Math.ceil((maxX + high.worldRadius * 2 - high.worldX) * high.scale / 16) + 1;
      await page.locator("#region-preview").evaluate((n, steps) => {
        for (let i = 0; i < steps; i++) n.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
      }, steps);
      await settle(page); assert.equal((await checkScope(page, true)).length, 0);
      await page.locator("#region-viewport").click(); await checkScope(page);
      await page.locator("#region-custom").click(); await settle(page);
      assert.equal((await checkScope(page, true)).length, 0, "An empty circle stays selectable without falling back to another area");
      await page.setViewportSize({ width: 390, height: 1000 }); await settle(page);
      for (let i = 0; i < 30; i++) await page.locator("#region-zoom-out").click();
      await settle(page); await dragCircle(page, 60, 0);
      const beforeResize = await circleGeometry(page), resizeIds = (await candidates(page, true)).sort();
      await page.setViewportSize({ width: 1280, height: 1000 }); await settle(page);
      const afterResize = await circleGeometry(page);
      assert.ok(Math.abs(afterResize.worldX - beforeResize.worldX) < 1e-4 && Math.abs(afterResize.worldY - beforeResize.worldY) < 1e-4);
      assert.ok(Math.abs(afterResize.worldRadius - beforeResize.worldRadius) < 1e-4);
      assert.deepEqual((await candidates(page, true)).sort(), resizeIds, "Resizing preserves the geographic circle and its candidates");
      await checkScope(page, true);
    }
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
    await page.locator("#region-custom").click(); await settle(page);
    await checkScope(page, true);
    await page.locator("#region-close").click();
    await page.locator("#region-practice").click();
    assert.equal(await page.locator("#region-viewport").getAttribute("aria-pressed"), "true", "Every opening defaults to the visible range");
    await checkScope(page); await page.locator("#region-close").click();
    // Use the real app's challenge route and answer without resetting demo history.
    await page.locator("#region-practice").click(); await page.locator("#region-custom").click(); await settle(page);
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
    console.log(`PASS ${width}px: circular scope/membership, drag and wheel/pinch/controls, random 5, keyboard/focus/scroll, real app answer and existing history`);
    await context.close();
  }
  assert.deepEqual(errors, []);
} finally { await browser.close(); }

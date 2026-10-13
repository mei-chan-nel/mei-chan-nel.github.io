// Browser QA against the portal's normal preview server and sibling app data.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fitCamera, project } from "../question-map/map-model.mjs";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.LAB_PLAYWRIGHT_MODULE || "playwright");
const base = process.env.LAB_BASE_URL || "http://127.0.0.1:8773";
const questions = JSON.parse(await readFile(new URL("../../../info1-quiz-app/data/questions/completed_questions.json", import.meta.url)));
const points = JSON.parse(await readFile(new URL("../../../info1-quiz-app/data/questions/map_points.json", import.meta.url))).points;
const byId = new Map(questions.map(q => [q.id, q]));
const browser = await chromium.launch({ executablePath: process.env.LAB_CHROMIUM_PATH || "/usr/bin/chromium", headless: true, args: ["--no-sandbox"] });
const errors = [];
async function setup(context) {
  await context.route("**/*", route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.fulfill({ body: "", contentType: "application/javascript" }));
  const page = await context.newPage(); page.on("pageerror", error => errors.push(error.message));
  await page.goto(`${base}/lab/question-map/`);
  await page.waitForSelector("#map-status[hidden]", { state: "attached" });
  await page.waitForFunction(() => document.querySelector("#visible-summary").textContent.includes("1,438"));
  await page.waitForTimeout(400); return page;
}
async function stage(page, value) {
  await page.locator(`[data-stage="${value}"]`).click();
  await page.waitForFunction(value => document.querySelector(`[data-stage="${value}"]`).hasAttribute("aria-current"), value);
  await page.waitForTimeout(600);
}
async function zoomReadout(page) { return Number((await page.locator("#zoom-readout").textContent()).match(/×([\d.]+)/)[1]); }
async function geometry(page) {
  return page.evaluate(() => {
    const map = document.querySelector("#map-viewport").getBoundingClientRect();
    const bounds = n => { const r = n.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, text: n.textContent }; };
    return { map: bounds(document.querySelector("#map-viewport")), labels: [...document.querySelectorAll(".map-label:not(.is-leaving)")].map(bounds),
      cards: [...document.querySelectorAll(".map-card:not(.is-leaving)")].map(bounds), width: innerWidth, scrollWidth: document.documentElement.scrollWidth };
  });
}
function checkGeometry(g) {
  assert.ok(g.scrollWidth <= g.width + 1, `Horizontal overflow at ${g.width}px`);
  const overlap = (a, b) => a.x < b.x + b.w - 1 && a.x + a.w - 1 > b.x && a.y < b.y + b.h - 1 && a.y + a.h - 1 > b.y;
  const items = [...g.labels, ...g.cards];
  for (let i = 0; i < items.length; i++) {
    const a = items[i];
    assert.ok(a.x >= g.map.x - 1 && a.x + a.w <= g.map.x + g.map.w + 1, `Clipped text: ${a.text}`);
    for (let j = i + 1; j < items.length; j++) assert.ok(!overlap(a, items[j]), `Overlapping map content at ${g.width}px: ${a.text} / ${items[j].text}`);
  }
}
try {
  for (const width of [1280, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 1000 }, hasTouch: width < 600, isMobile: width < 600 });
    const page = await setup(context);
    assert.ok(await page.locator(".map-label:not(.is-leaving)").count());
    assert.equal(await page.locator(".map-card").count(), 0);
    checkGeometry(await geometry(page));
    for (const value of [1, 2, 3, 4]) {
      await stage(page, value); checkGeometry(await geometry(page));
      if (value >= 2) {
        const card = page.locator(".map-card:not(.is-leaving)").first();
        assert.ok(await card.count());
        const id = new URL(await card.locator(".card-practice").getAttribute("href")).searchParams.get("challenge");
        const question = byId.get(id);
        assert.equal(await card.locator(".card-stem").textContent(), question.stem);
        assert.equal(await card.locator(".card-choices > li").count(), value >= 3 ? question.choices.length : 0);
        assert.equal(await card.locator(".card-explanation").count(), value === 4 ? 1 : 0);
        if (value === 4) assert.equal(await card.locator(".card-explanation > p").textContent(), question.explanation);
        if (value === 4) {
          const scroller = card.locator(".card-scroll");
          if (await scroller.evaluate(n => n.scrollHeight > n.clientHeight + 20)) {
            const zoomBefore = await zoomReadout(page);
            await scroller.scrollIntoViewIfNeeded();
            const rect = await scroller.boundingBox();
            if (width >= 600) {
              await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2); await page.mouse.wheel(0, 250);
            } else {
              const session = await context.newCDPSession(page), x = rect.x + rect.width / 2, y = rect.y + rect.height * .75;
              await session.send("Input.dispatchTouchEvent", {type:"touchStart",touchPoints:[{x,y,id:1}]});
              for (const dy of [10,30,60,90]) {
                await session.send("Input.dispatchTouchEvent", {type:"touchMove",touchPoints:[{x,y:y-dy,id:1}]}); await page.waitForTimeout(30);
              }
              await session.send("Input.dispatchTouchEvent", {type:"touchEnd",touchPoints:[]});
            }
            await page.waitForTimeout(300);
            assert.ok(await scroller.evaluate(n => n.scrollTop > 0), "Card should scroll independently from the map");
            assert.equal(await zoomReadout(page), zoomBefore);
          }
        }
      }
    }
    await stage(page, 0);
    assert.equal(await page.locator(".map-card:not(.is-leaving)").count(), 0);
    await page.locator("#search-query").fill("DNS"); await page.locator("#map-search").evaluate(form => form.requestSubmit());
    await page.locator("#search-results button").first().click(); await page.waitForTimeout(800);
    assert.ok((await page.locator(".map-card.is-selected .card-tags").textContent()).includes("DNS"));
    await page.locator("#map-home").click(); await page.waitForTimeout(800);
    await page.locator("#map-viewport").scrollIntoViewIfNeeded();
    const box = await page.locator("#map-viewport").boundingBox();
    if (width >= 600) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.wheel(0, -180); await page.waitForTimeout(800);
      assert.ok(await zoomReadout(page) > 1);
      await page.locator("#map-viewport").focus();
      await page.keyboard.press("+"); await page.waitForTimeout(500);
      const before = await page.locator(".map-label:not(.is-leaving)").allTextContents();
      await page.keyboard.press("ArrowRight"); await page.waitForTimeout(600);
      assert.ok(await page.locator(".map-label:not(.is-leaving)").count());
      await page.keyboard.press("Home"); await page.waitForTimeout(700);
      assert.equal(await zoomReadout(page), 1);
    } else {
      const session = await context.newCDPSession(page);
      const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
      const touch = async (type, spread) => session.send("Input.dispatchTouchEvent", { type, touchPoints: spread == null ? [] : [{ x: cx - spread, y: cy, id: 1 }, { x: cx + spread, y: cy, id: 2 }] });
      await touch("touchStart", 25);
      for (const spread of [35, 45, 55, 65]) await touch("touchMove", spread);
      await touch("touchEnd", null); await page.waitForTimeout(700);
      assert.ok(await zoomReadout(page) > 2, "Pinch should zoom around the gesture center");
      const oldLabels = await page.locator(".map-label:not(.is-leaving)").allTextContents();
      await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: cx, y: cy, id: 1 }] });
      for (const dx of [20, 45, 70, 90]) await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: cx + dx, y: cy, id: 1 }] });
      await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await page.waitForTimeout(700);
      const newLabels = await page.locator(".map-label:not(.is-leaving)").allTextContents();
      assert.notDeepEqual(newLabels, oldLabels, "Panning should select labels from the new viewport");
    }
    console.log(`PASS ${width}px: five stages, JSON content, collision/overflow, search, ${width < 600 ? "touch pinch/pan" : "wheel/keyboard"}`);
    await context.close();
  }
  // Answer-heavy regions on either side, unattempted questions in the middle.
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const page = await setup(context);
  assert.equal(await page.evaluate(() => localStorage.getItem("info1LearningRecord:v1")), null, "Exploring the map must not write history");
  await page.locator("#map-viewport").scrollIntoViewIfNeeded();
  const g = await geometry(page);
  const bounds = {minX:Math.min(...Object.values(points).map(p=>p[0])),maxX:Math.max(...Object.values(points).map(p=>p[0])),
    minY:Math.min(...Object.values(points).map(p=>p[1])),maxY:Math.max(...Object.values(points).map(p=>p[1]))};
  const camera = fitCamera(bounds,g.map.w,g.map.h);
  const hit = Object.entries(points).map(([id,xy])=>({id,...project({x:xy[0],y:xy[1]},camera,g.map.w,g.map.h)})).find(p=>
    !g.labels.some(l=>p.x+g.map.x>=l.x-5 && p.x+g.map.x<=l.x+l.w+5 && p.y+g.map.y>=l.y-5 && p.y+g.map.y<=l.y+l.h+5) &&
    Object.entries(points).filter(([,xy])=>Math.hypot(xy[0]-points[p.id][0],xy[1]-points[p.id][1])*camera.scale<16).length>1);
  assert.ok(hit);
  await page.mouse.click(g.map.x+hit.x,g.map.y+hit.y);
  await page.waitForSelector("#nearby-dialog[open]");
  assert.ok(await page.locator("#nearby-list button").count()>1);
  const chosenStem = await page.locator("#nearby-list button").last().locator("span").textContent();
  await page.locator("#nearby-list button").last().click(); await page.waitForTimeout(800);
  assert.equal(await page.locator(".map-card.is-selected .card-stem").textContent(), chosenStem);
  await stage(page,0);
  console.log("PASS dense-point picker and read-only exploration");
  const history = { v: 1, q: Object.fromEntries(Object.entries(points).filter(([,xy]) => Math.abs(xy[0]) > 35).map(([id,xy]) => [id, [4, xy[0] < 0 ? 0 : 4, 0, 0, "", 0]])) };
  const screenshot = () => page.locator("#map-canvas").screenshot();
  const initial = await screenshot();
  await page.evaluate(record => { localStorage.setItem("info1LearningRecord:v1", JSON.stringify(record)); dispatchEvent(new StorageEvent("storage", {key:"info1LearningRecord:v1"})); }, history);
  await page.waitForFunction(() => document.querySelector("#history-summary").textContent.includes("延べ")); await page.waitForTimeout(400);
  assert.notDeepEqual(await screenshot(), initial);
  await page.locator("#heat-toggle").uncheck(); await page.waitForTimeout(300);
  assert.notDeepEqual(await screenshot(), initial);
  await page.locator("#heat-toggle").check();
  await page.evaluate(() => { localStorage.setItem("info1LearningRecord:v1", JSON.stringify({v:1,q:{}})); dispatchEvent(new StorageEvent("storage",{key:"info1LearningRecord:v1"})); });
  await page.waitForFunction(() => document.querySelector("#history-summary").textContent.includes("まだ解答履歴"));
  await page.waitForTimeout(400); assert.deepEqual(await screenshot(), initial);
  const axePath = require.resolve(process.env.LAB_AXE_MODULE || "axe-core/axe.min.js");
  await page.addScriptTag({path:axePath});
  const axe = await page.evaluate(() => window.axe.run(document, {runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21aa"]}}));
  assert.deepEqual(axe.violations.map(v => ({id:v.id,nodes:v.nodes.map(n=>n.target)})), []);
  console.log("PASS history refresh/clear, heat toggle, WCAG automatic checks");
  await context.close();
  const failureContext = await browser.newContext();
  const failurePage = await failureContext.newPage();
  await failurePage.route("**/*", route => route.request().url().endsWith("/map_points.json") ? route.fulfill({status:404,body:"missing"}) : new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.fulfill({body:""}));
  await failurePage.goto(`${base}/lab/question-map/`);
  await failurePage.waitForSelector("#map-status button");
  assert.ok((await failurePage.locator("#map-status").textContent()).includes("map_points.json"));
  await failureContext.close();
  const changedContext = await browser.newContext();
  await changedContext.route("**/*", route => route.request().url().endsWith("/completed_questions.json") ? route.fulfill({contentType:"application/json",body:JSON.stringify(questions.map((q,i)=>i===0?{...q,stem:"Changed source"}:q))}) : new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.fulfill({body:""}));
  const changedPage = await changedContext.newPage(); await changedPage.goto(`${base}/lab/question-map/`);
  await changedPage.waitForSelector("#map-status button");
  assert.ok((await changedPage.locator("#map-status").textContent()).includes("本文が地図生成時から更新"));
  await changedContext.close();
  assert.deepEqual(errors, []);
  console.log("PASS missing-data recovery UI; no JavaScript errors");
} finally { await browser.close(); }

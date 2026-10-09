import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { DRAFT_KEY } from "../flowchart/documents.mjs";
const require = createRequire(import.meta.url),
  { chromium } = require(process.env.LAB_PLAYWRIGHT_MODULE || "playwright"),
  base = process.env.LAB_BASE_URL || "http://127.0.0.1:8773";
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const errors = [];
async function screen(p, point) {
  return p.locator("#flow-board").evaluate((el, point) => {
    const r = el.getBoundingClientRect(),
      v = el.viewBox.baseVal;
    return {
      x: r.left + ((point.x - v.x) * r.width) / v.width,
      y: r.top + ((point.y - v.y) * r.height) / v.height,
    };
  }, point);
}
async function tapPoint(p, point, touch = false) {
  const s = await screen(p, point);
  return touch ? p.touchscreen.tap(s.x, s.y) : p.mouse.click(s.x, s.y);
}
const stored = (p) =>
  p.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)).document.graph,
    DRAFT_KEY,
  );
async function drag(p, start, end) {
  const a = await screen(p, start),
    b = await screen(p, end);
  await p.mouse.move(a.x, a.y);
  await p.mouse.down();
  await p.mouse.move(b.x, b.y, { steps: 12 });
  return async () => p.mouse.up();
}
async function selectEdge(p, graph, source) {
  const edge = graph.edges.find((e) => e.from === source);
  await p.locator(`.flow-wire[data-edge="${edge.id}"]`).focus();
  await p.keyboard.press("Enter");
  assert.equal(await p.locator(".flow-edge-end").count(), 1);
  return edge;
}
async function editScore(p, score) {
  await p.locator('[data-id="n2"] .flow-node-body').click();
  await p.locator("#node-code").fill(`点数 = ${score}`);
  await p.locator('#node-form button[type="submit"]').click();
}
try {
  const context = await browser.newContext({
      viewport: { width: 1280, height: 1050 },
    }),
    p = await context.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(base + "/lab/flowchart/");
  await p.locator(".flow-node").first().waitFor();
  await p.locator("#circuit-stage").scrollIntoViewIfNeeded();
  // Drag an outlet onto a line, including the visible snapping indicator.
  let release = await drag(p, { x: 720, y: 490 }, { x: 400, y: 508 });
  assert.ok(await p.locator("#flow-join-preview").isVisible());
  assert.equal(await p.locator(".flow-wire.is-target").count(), 1);
  await release();
  let graph = await stored(p),
    junction = graph.nodes.find((n) => n.junction);
  assert.ok(junction);
  assert.ok(Math.abs(junction.y - 508) < 1);
  assert.equal(junction.x, 400);
  assert.equal(graph.edges.filter((e) => e.to === junction.id).length, 2);
  assert.equal(
    await p.locator(`[data-id="${junction.id}"] .flow-port`).count(),
    0,
  );
  const first = structuredClone(graph);
  // Grab a selected arrowhead and put it onto a different segment.
  await selectEdge(p, graph, "n5");
  release = await drag(p, junction, { x: 400, y: 590 });
  await release();
  graph = await stored(p);
  assert.equal(
    graph.nodes.filter((n) => n.junction).length,
    1,
    "remove the former junction and reconnect its original line",
  );
  junction = graph.nodes.find((n) => n.junction);
  assert.ok(Math.abs(junction.y - 590) < 1);
  const rewired = structuredClone(graph);
  // Reject an upwards line join and keep the original arrow and graph intact.
  await selectEdge(p, graph, "n5");
  release = await drag(p, junction, { x: 400, y: 115 });
  assert.ok(await p.locator("#flow-preview.is-invalid").count());
  await release();
  assert.match(await p.locator("#circuit-message").textContent(), /上方向/);
  assert.deepEqual(await stored(p), rewired);
  await p.keyboard.press("Control+z");
  assert.deepEqual(
    await stored(p),
    first,
    "a failed drop never adds an undo record",
  );
  await p.keyboard.press("Control+Shift+z");
  assert.deepEqual(await stored(p), rewired);
  // A direct backwards port connection is also rejected, as is dragging a node
  // through an attached arrow until the arrow would point upwards.
  await p.locator('.flow-port[data-node="n5"][data-direction="out"]').click();
  await p.locator('.flow-port[data-node="n2"][data-direction="in"]').click();
  assert.match(await p.locator("#circuit-message").textContent(), /上方向/);
  assert.deepEqual(await stored(p), rewired);
  const end = graph.nodes.find((n) => n.type === "end");
  release = await drag(p, end, { x: end.x, y: 220 });
  await release();
  assert.match(await p.locator("#circuit-message").textContent(), /上向き/);
  assert.deepEqual(await stored(p), rewired);
  // Each branch still executes exactly once; the join does not rerun a block.
  for (const [score, expected] of [
    [72, "合格"],
    [40, "再挑戦"],
  ]) {
    await editScore(p, score);
    await p.locator("#prepare-run").click();
    while (!(await p.locator("#next-button").isDisabled()))
      await p.locator("#next-button").click();
    assert.equal(await p.locator("#output-lines").textContent(), expected);
    await p.locator("#edit-button").click();
  }
  await p.reload();
  assert.equal(
    await p.locator('[data-junction="true"]').count(),
    1,
    "browser draft retains the exact junction",
  );
  // Keyboard users can join a chosen line with Enter after choosing an outlet.
  graph = await stored(p);
  const endWire = graph.edges.find((e) => e.to === "n7");
  await p.locator('.flow-port[data-node="n5"][data-direction="out"]').focus();
  await p.keyboard.press("Enter");
  await p.locator(`[data-edge="${endWire.id}"]`).focus();
  await p.keyboard.press("Enter");
  assert.match(await p.locator("#circuit-message").textContent(), /合流/);
  assert.equal((await stored(p)).nodes.filter((n) => n.junction).length, 1);
  await context.close();
  console.log(
    "PASS desktop: outlet/head drag, line snapping, undo, backwards ports and node moves, both branch executions, keyboard joins and draft recovery",
  );
  for (const width of [390, 320]) {
    const c = await browser.newContext({
        viewport: { width, height: 850 },
        hasTouch: true,
        isMobile: true,
      }),
      page = await c.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base + "/lab/flowchart/");
    await page.locator("#circuit-stage").scrollIntoViewIfNeeded();
    await page
      .locator('.flow-port[data-node="n5"][data-direction="out"]')
      .tap();
    await tapPoint(page, { x: 400, y: 507.5 }, true);
    const result = await stored(page),
      join = result.nodes.find((n) => n.junction);
    assert.ok(join, `tap a line to join at ${width}px`);
    assert.ok(Math.abs(join.y - 507.5) < 4);
    const before = structuredClone(result);
    await page
      .locator('.flow-port[data-node="n5"][data-direction="out"]')
      .tap();
    await page.locator('.flow-port[data-node="n2"][data-direction="in"]').tap();
    assert.deepEqual(await stored(page), before);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await c.close();
    console.log(
      `PASS touch ${width}px: tap outlet then line, exact join and upwards rejection`,
    );
  }
  const offline = await browser.newPage({
      viewport: { width: 1280, height: 1050 },
    }),
    requests = [];
  offline.on("pageerror", (e) => errors.push(e.message));
  offline.on("request", (r) => requests.push(r.url()));
  await offline.setContent(
    await readFile(
      "/workspace/interactive-lab-review/Interactive-Lab-flowchart.html",
      "utf8",
    ),
  );
  release = await drag(offline, { x: 720, y: 490 }, { x: 400, y: 508 });
  await release();
  assert.equal(await offline.locator('[data-junction="true"]').count(), 1);
  await offline.locator("#prepare-run").click();
  while (!(await offline.locator("#next-button").isDisabled()))
    await offline.locator("#next-button").click();
  assert.equal(await offline.locator("#output-lines").textContent(), "合格");
  assert.deepEqual(requests, []);
  await offline.close();
  assert.deepEqual(errors, []);
  console.log(
    "PASS standalone HTML: direct joins execute without external requests or browser storage",
  );
} finally {
  await browser.close();
}

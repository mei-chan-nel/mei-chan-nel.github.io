import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { DRAFT_KEY, SAVED_KEY } from "../flowchart/documents.mjs";
const require = createRequire(import.meta.url),
  { chromium } = require(process.env.LAB_PLAYWRIGHT_MODULE || "playwright");
const axePath = require.resolve(
  process.env.LAB_AXE_MODULE || "axe-core/axe.min.js",
);
const base = process.env.LAB_BASE_URL || "http://127.0.0.1:8773";
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const errors = [];
const press = (p, selector, touch = false) =>
  touch ? p.locator(selector).tap() : p.locator(selector).click();
async function audit(p) {
  await p.addScriptTag({ path: axePath });
  const violations = await p.evaluate(async () =>
    (
      await axe.run({
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
        },
      })
    ).violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  );
  assert.deepEqual(violations, []);
  assert.ok(
    await p.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  );
}
async function load(p, id, touch = false) {
  await press(p, "#load-circuit", touch);
  await press(p, `[data-example="${id}"]`, touch);
  await press(p, '#confirm-form button[type="submit"]', touch);
  await p.locator("#confirm-dialog").waitFor({ state: "hidden" });
}
async function connect(p, from, to, port = 0, touch = false) {
  await press(
    p,
    `.flow-port[data-node="${from}"][data-direction="out"][data-port="${port}"]`,
    touch,
  );
  await press(p, `.flow-port[data-node="${to}"][data-direction="in"]`, touch);
}
const stored = (p) =>
  p.evaluate((k) => JSON.parse(localStorage.getItem(k)).document, DRAFT_KEY);
try {
  const context = await browser.newContext({
      viewport: { width: 1280, height: 1100 },
    }),
    p = await context.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(base + "/lab/flowchart/");
  await p.locator(".flow-node").first().waitFor();
  const branchLayout = await p.evaluate(() => {
    const decision = document.querySelector('[data-type="decision"]'),
      port = (p) =>
        decision
          .querySelector(`[data-direction="out"][data-port="${p}"]`)
          .getAttribute("transform"),
      noWire = document.querySelector('[data-edge="w4"] .flow-wire-line'),
      join = document.querySelector('[data-type="connector"]');
    return {
      yes: port(0),
      no: port(1),
      noPath: noWire.getAttribute("d"),
      circles: join.querySelectorAll(".flow-node-body circle").length,
      junction: join.dataset.junction,
      joinPorts: join.querySelectorAll(".flow-port").length,
      mergeChoices: document.querySelectorAll('[data-part="connector"]').length,
    };
  });
  assert.equal(branchLayout.yes, "translate(0 60)");
  assert.equal(branchLayout.no, "translate(110 0)");
  assert.match(branchLayout.noPath, /^M[\d.]+ [\d.]+H[\d.]+V[\d.]+$/);
  assert.equal(branchLayout.circles, 0);
  assert.equal(branchLayout.junction, "true");
  assert.equal(branchLayout.joinPorts, 0);
  assert.equal(branchLayout.mergeChoices, 0);
  const align = await p.evaluate(() => ({
    left: document
      .querySelector('[data-part="process"]')
      .getBoundingClientRect().top,
    right: document.getElementById("circuit-stage").getBoundingClientRect().top,
  }));
  assert.ok(
    Math.abs(align.left - align.right) < 1,
    "palette aligns with canvas",
  );
  await audit(p);
  // Editing and exclusive outlet rewiring through actual pointer taps.
  await p.locator('.flow-node[data-id="n2"] .flow-node-body').click();
  assert.equal(await p.locator("#node-dialog[open]").count(), 0);
  assert.equal(
    await p.locator(".flow-node.is-selected").getAttribute("data-id"),
    "n2",
  );
  assert.equal(await p.locator("#delete-selected").isEnabled(), true);
  await p.locator('.flow-node[data-id="n4"] .flow-node-body').click();
  assert.equal(await p.locator("#node-dialog[open]").count(), 0);
  assert.equal(
    await p.locator(".flow-node.is-selected").getAttribute("data-id"),
    "n4",
  );
  await p.locator('.flow-node[data-id="n2"] .flow-node-body').click();
  assert.equal(await p.locator("#node-dialog[open]").count(), 0);
  await p.locator('.flow-node[data-id="n2"] .flow-node-body').click();
  assert.equal(await p.locator("#node-dialog[open]").count(), 1);
  await p.locator("#node-code").fill("点数 = 40");
  await p.locator('#node-form button[type="submit"]').click();
  await p.locator("#prepare-run").click();
  for (let i = 0; i < 4; i++) await p.locator("#next-button").click();
  assert.equal(await p.locator("#output-lines").textContent(), "再挑戦");
  assert.equal(
    await p.locator(".flow-node.is-current").getAttribute("data-id"),
    "n5",
  );
  assert.equal(await p.locator(".flow-wire.is-current").count(), 1);
  await p.locator("#next-button").click();
  assert.equal(
    await p.locator(".flow-node.is-current").getAttribute("data-type"),
    "connector",
  );
  assert.equal(
    await p
      .locator(".flow-node.is-current .flow-merge-hit")
      .evaluate((n) => getComputedStyle(n).stroke),
    "none",
  );
  await p.locator("#previous-button").click();
  await p.locator("#previous-button").click();
  assert.equal(await p.locator("#output-lines li").count(), 0);
  await p.locator("#reset-button").click();
  assert.match(await p.locator("#flow-step-count").textContent(), /^0 /);
  await p.locator("#edit-button").click();
  await p.locator("#new-circuit").click();
  assert.ok(await p.locator("#unsaved-dialog").isVisible());
  await p.locator("#unsaved-dialog [data-close-circuit-dialog]").last().click();
  assert.equal(await p.locator(".flow-node").count(), 7);
  // Protected examples, paired loops, and save copies.
  await load(p, "sum");
  assert.equal(await p.locator('[data-type="loopStart"]').count(), 1);
  assert.equal(await p.locator('[data-type="loopEnd"]').count(), 1);
  await p.locator("#save-circuit").click();
  assert.equal(await p.locator("#save-copy").isVisible(), false);
  await p.locator("#save-name").fill("合計の図");
  await p.locator("#save-submit").click();
  await p.locator("#save-circuit").click();
  assert.ok(await p.locator("#save-copy").isVisible());
  await p.locator("#save-name").fill("合計のコピー");
  await p.locator("#save-copy").click();
  assert.equal(
    await p.evaluate(
      (k) => JSON.parse(localStorage.getItem(k)).length,
      SAVED_KEY,
    ),
    2,
  );
  // Export/import JSON is an actual browser download and file selection.
  await p.locator("#save-circuit").click();
  await p.locator("#export-circuit").click();
  const download = p.waitForEvent("download");
  await p.locator('#export-form button[type="submit"]').click();
  const file = await (await download).path();
  assert.ok(JSON.parse(await readFile(file, "utf8")).graph.nodes.length);
  await load(p, "addition");
  await p.locator("#load-circuit").click();
  await p.locator("#circuit-file").setInputFiles(file);
  await p.locator('#confirm-form button[type="submit"]').click();
  assert.equal(await p.locator("#circuit-name").inputValue(), "合計のコピー");
  // Repeated loop execution, history and autoplay follow Trace controls.
  await p.locator("#prepare-run").click();
  await p.locator("#speed-input").fill("0.001");
  await p.locator("#speed-input").dispatchEvent("change");
  await p.locator("#play-button").click();
  await p.waitForFunction(() =>
    document.getElementById("flow-step-count").textContent.includes("終了"),
  );
  await p.waitForFunction(
    () => document.getElementById("next-button").disabled,
  );
  assert.equal(await p.locator("#output-lines").textContent(), "15");
  await p.locator("#previous-button").click();
  await p.locator("#edit-button").click();
  // Input validation stops at the input; bad input does not consume a step.
  await load(p, "input");
  await p.locator("#prepare-run").click();
  await p.locator("#next-button").click();
  await p.locator("#next-button").click();
  assert.ok(await p.locator("#input-dialog").isVisible());
  const before = await p.locator("#flow-step-count").textContent();
  await p.locator("#input-value").fill("no");
  await p.locator('#input-form button[type="submit"]').click();
  assert.equal(await p.locator("#flow-step-count").textContent(), before);
  await p.locator("#input-value").fill("5");
  await p.locator('#input-form button[type="submit"]').click();
  for (let i = 0; i < 2; i++) await p.locator("#next-button").click();
  assert.equal(await p.locator("#output-lines").textContent(), "奇数");
  await p.locator("#edit-button").click();
  // Keyboard/tap connections, add/delete/undo and both canvas edges.
  await p.locator("#new-circuit").click();
  const palette = await p.locator('[data-part="process"]').boundingBox(),
    wire = await p.locator(".flow-wire-line").boundingBox();
  await p.mouse.move(
    palette.x + palette.width / 2,
    palette.y + palette.height / 2,
  );
  await p.mouse.down();
  await p.mouse.move(wire.x, wire.y + wire.height / 2, { steps: 12 });
  await p.mouse.up();

  await p.locator("#node-code").fill("x = 9");
  await p.locator('#node-form button[type="submit"]').click();
  const d = await stored(p),
    id = d.graph.nodes.at(-1).id;
  await connect(p, "n1", id);
  await connect(p, id, "n2");
  assert.equal(
    (await stored(p)).graph.edges.filter((e) => e.from === "n1").length,
    1,
  );
  const beforeDrag = (await stored(p)).graph.nodes.find((n) => n.id === id),
    body = p.locator(`[data-id="${id}"] .flow-node-body`);
  await body.scrollIntoViewIfNeeded();
  const box = await body.boundingBox();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await p.mouse.down();
  await p.mouse.move(box.x + box.width / 2 + 48, box.y + box.height / 2 + 24, {
    steps: 6,
  });
  await p.mouse.up();
  const moved = (await stored(p)).graph.nodes.find((n) => n.id === id);
  assert.ok(moved.x !== beforeDrag.x);
  assert.equal(await p.locator("#node-dialog[open]").count(), 0);
  const box2 = await body.boundingBox();
  await p.mouse.move(box2.x + box2.width / 2, box2.y + box2.height / 2);
  await p.mouse.down();
  await p.mouse.move(box2.x + box2.width / 2 + 32, box2.y + box2.height / 2);
  await p.evaluate(() => dispatchEvent(new Event("blur")));
  await p.mouse.up();
  assert.equal(
    (await stored(p)).graph.nodes.find((n) => n.id === id).x,
    moved.x,
  );

  await p.locator("#prepare-run").click();
  for (let i = 0; i < 3; i++) await p.locator("#next-button").click();
  assert.match(await p.locator("#variable-rows").textContent(), /9/);
  await p.locator("#edit-button").click();
  await p.locator(`[data-id="${id}"] .flow-node-body`).focus();
  await p.keyboard.press("ArrowRight");
  await p.keyboard.press("Delete");
  assert.equal(await p.locator(".flow-node").count(), 2);
  await p.locator("#undo-circuit").click();
  assert.equal(await p.locator(".flow-node").count(), 3);
  for (const axis of ["width", "height"]) {
    const handle = p.locator(`[data-resize-axis="${axis}"]`);
    await handle.scrollIntoViewIfNeeded();
    const r = await handle.boundingBox(),
      old = await p.locator("#circuit-stage").boundingBox();
    await p.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
    await p.mouse.down();
    await p.mouse.move(
      r.x + r.width / 2 - (axis === "width" ? 60 : 0),
      r.y + r.height / 2 + (axis === "height" ? 60 : 0),
    );
    await p.mouse.up();
    const next = await p.locator("#circuit-stage").boundingBox();
    assert.ok(
      axis === "width" ? next.width < old.width : next.height > old.height,
    );
  }
  // Shared pages do not overwrite a different draft, including browser reload.
  await p.locator("#share-circuit").click();
  await p.waitForFunction(() =>
    document.getElementById("share-url").value.startsWith("http"),
  );
  const url = await p.locator("#share-url").inputValue();
  await p.locator("#share-dialog [data-close-circuit-dialog]").first().click();
  const beforeShare = await p.evaluate(
    (k) => localStorage.getItem(k),
    DRAFT_KEY,
  );
  await p.goto(url);
  await p.locator("#shared-circuit").waitFor();
  assert.equal(
    await p.evaluate((k) => localStorage.getItem(k), DRAFT_KEY),
    beforeShare,
  );
  await p.locator("#restore-own-circuit").click();
  await p.locator('#confirm-form button[type="submit"]').click();
  assert.equal(new URL(p.url()).hash, "");
  // Function steps enter the separate function diagram and return to main.
  await load(p, "function");
  await p.locator("#prepare-run").click();
  let entered = false;
  for (let i = 0; i < 15; i++) {
    if (await p.locator("#next-button").isDisabled()) break;
    await p.locator("#next-button").click();
    if ((await p.locator("#flow-scope").inputValue()) !== "main")
      entered = true;
  }
  assert.ok(entered);
  assert.equal(await p.locator("#output-lines").textContent(), "14");
  await p.locator("#edit-button").click();
  // Follow conversion links in both directions and execute the actual Studio Worker.
  await p.locator("#to-program").click();
  await p.locator("#open-program").waitFor();
  await p.locator("#open-program").click();
  await p.locator("#runner-view").waitFor();
  await p.waitForFunction(
    () => !document.getElementById("next-button").disabled,
  );
  for (let i = 0; i < 15; i++) {
    if (await p.locator("#next-button").isDisabled()) break;
    await p.locator("#next-button").click();
    await p.waitForTimeout(30);
  }
  assert.match(await p.locator("#output-lines").textContent(), /14/);
  await p.locator("#flowchart-button").click();
  await p
    .locator("dialog a")
    .filter({ hasText: "フローチャートで開く" })
    .click();
  await p.locator("#shared-circuit").waitFor();
  assert.equal(await p.locator("#flow-scope option").count(), 2);
  // Original Trace conversion captures edited initial values, not the sample defaults.
  await p.goto(base + "/program-trace/run.html#addition");
  await p.locator("#runner-view").waitFor();
  await p.locator("#edit-button").click();
  await p.locator("#parameter-fields input").first().fill("20");
  await p.locator('#values-form button[type="submit"]').click();
  await p.locator("#flowchart-button").click();
  await p
    .locator("dialog a")
    .filter({ hasText: "フローチャートで開く" })
    .click();
  await p.locator("#shared-circuit").waitFor();
  assert.match(await p.locator("#flow-nodes").textContent(), /20/);
  console.log(
    "PASS desktop: editing, execution, persistence, JSON, shared recovery, resizing and bidirectional conversion",
  );
  await context.close();
  for (const width of [390, 320]) {
    const c = await browser.newContext({
        viewport: { width, height: 850 },
        hasTouch: true,
        isMobile: true,
      }),
      page = await c.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base + "/lab/flowchart/");
    await audit(page);
    await load(page, "addition", true);
    await press(page, "#prepare-run", true);
    for (let i = 0; i < 5; i++) await press(page, "#next-button", true);
    assert.equal(await page.locator("#output-lines").textContent(), "7");
    await press(page, "#edit-button", true);
    await press(page, "#fit-circuit", true);
    const existing = '.flow-node[data-type="process"] .flow-node-body';
    await page.locator(existing).first().tap();
    assert.equal(await page.locator("#node-dialog[open]").count(), 0);
    await page.locator(existing).first().tap();
    assert.equal(await page.locator("#node-dialog[open]").count(), 1);
    await press(page, "#node-dialog .document-close", true);
    await page.keyboard.press("Escape");
    await page.locator(existing).first().tap();
    assert.equal(await page.locator("#node-dialog[open]").count(), 0);
    await press(page, "#new-circuit", true);
    await press(page, '[data-part="process"]', true);
    assert.ok(await page.locator("#node-dialog").isVisible());
    await page.locator("#node-code").fill("x = 4");
    await press(page, '#node-form button[type="submit"]', true);
    const diagram = await stored(page),
      n = diagram.graph.nodes.at(-1).id;
    await connect(page, "n1", n, 0, true);
    await connect(page, n, "n2", 0, true);
    assert.equal((await stored(page)).graph.edges.length, 2);
    await audit(page);
    await c.close();
    console.log(
      `PASS touch ${width}px: symbols, tap connections, examples, execution, no overflow and accessibility`,
    );
  }
  const c = await browser.newContext(),
    offline = await c.newPage(),
    requests = [];
  offline.on("pageerror", (e) => errors.push(e.message));
  offline.on("request", (r) => requests.push(r.url()));
  await offline.setContent(
    await readFile(
      "/workspace/interactive-lab-review/Interactive-Lab-flowchart.html",
      "utf8",
    ),
  );
  await offline.locator(".flow-node").first().waitFor();
  assert.equal(await offline.locator('[data-part="connector"]').count(), 0);
  await offline.locator('[data-id="n2"] .flow-node-body').click();
  assert.equal(await offline.locator("#node-dialog[open]").count(), 0);
  await offline.locator('[data-id="n2"] .flow-node-body').click();
  assert.equal(await offline.locator("#node-dialog[open]").count(), 1);
  await offline.keyboard.press("Escape");
  await load(offline, "sum");
  await offline.locator("#prepare-run").click();
  await offline.locator("#speed-input").fill("0.001");
  await offline.locator("#speed-input").dispatchEvent("change");
  await offline.locator("#play-button").click();
  await offline.waitForFunction(
    () => document.getElementById("next-button").disabled,
  );
  assert.equal(await offline.locator("#output-lines").textContent(), "15");
  assert.deepEqual(requests, []);
  await c.close();
  assert.deepEqual(errors, []);
  console.log(
    "PASS standalone HTML: no external requests; examples and shared runtime work without browser storage",
  );
} finally {
  await browser.close();
}

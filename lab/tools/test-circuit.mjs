// Development-only checks of real pointer, touch and keyboard interaction.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
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
const node = (page, type, label) =>
  page.locator(
    `.circuit-node[data-type="${type}"]${label ? `[data-label="${label}"]` : ""}`,
  );
const port = (page, id, direction, index = 0) =>
  page.locator(
    `.port[data-node="${id}"][data-direction="${direction}"][data-port="${index}"]`,
  );
async function values(page, id) {
  return page
    .locator(`#circuit-truth tbody td[data-column="${id}"]`)
    .allTextContents();
}
async function point(locator) {
  const r = await locator.boundingBox();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
}
async function activate(locator, touch) {
  if (touch) await locator.tap();
  else await locator.click();
}
async function loadExample(page, type, touch = false) {
  await activate(page.locator("#load-circuit"), touch);
  await activate(
    page.locator(`#circuit-example-list [data-example="${type}"]`),
    touch,
  );
  await activate(page.locator('#confirm-form button[type="submit"]'), touch);
}
async function newCircuit(page) {
  await page.locator("#new-circuit").click();
  if (await page.locator("#unsaved-dialog").isVisible())
    await page.locator("#discard-and-new").click();
}
async function wire(page, from, to, touch, fromPort = 0, toPort = 0) {
  await activate(port(page, from, "out", fromPort), touch);
  await activate(port(page, to, "in", toPort), touch);
}
async function drag(page, start, end, touch = false) {
  if (touch) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ ...start, id: 1, radiusX: 2, radiusY: 2, force: 1 }],
    });
    for (let i = 1; i <= 12; i++)
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          {
            x: start.x + ((end.x - start.x) * i) / 12,
            y: start.y + ((end.y - start.y) * i) / 12,
            id: 1,
            radiusX: 2,
            radiusY: 2,
            force: 1,
          },
        ],
      });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await cdp.detach();
  } else {
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 12 });
    await page.mouse.up();
  }
}
try {
  for (const width of [1280, 390, 320]) {
    const touch = width < 600,
      context = await browser.newContext({
        viewport: { width, height: width === 1280 ? 900 : 844 },
        hasTouch: touch,
        reducedMotion: "reduce",
      });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base + "/lab/");
    assert.equal(await page.locator(".lab-category").count(), 6);
    await page.locator('a[href="./logic-circuit/"]').click();
    await page.waitForSelector('.circuit-node[data-type="and"]');
    let a = await node(page, "input", "A").getAttribute("data-id"),
      b = await node(page, "input", "B").getAttribute("data-id"),
      x = await node(page, "output", "X").getAttribute("data-id");
    assert.deepEqual(await values(page, x), ["0", "0", "0", "1"]);
    await activate(node(page, "input", "A").locator(".node-body"), touch);
    await activate(node(page, "input", "B").locator(".node-body"), touch);
    assert.equal(
      await node(page, "output", "X").locator(".input-value").textContent(),
      "1",
    );
    assert.equal(
      await page.locator(".current-row").getAttribute("data-row"),
      "3",
    );
    await page.locator('tr[data-row="0"]').click();
    assert.equal(
      await node(page, "output", "X").locator(".input-value").textContent(),
      "0",
    );
    await page.locator('tr[data-row="3"]').focus();
    await page.keyboard.press("Space");
    assert.equal(
      await node(page, "output", "X").locator(".input-value").textContent(),
      "1",
    );
    await loadExample(page, "xor", touch);
    x = await node(page, "output", "X").getAttribute("data-id");
    assert.deepEqual(await values(page, x), ["0", "1", "1", "0"]);
    await loadExample(page, "full-adder", touch);
    x = await node(page, "output", "X").getAttribute("data-id");
    assert.deepEqual(await values(page, x), [
      "0",
      "1",
      "1",
      "0",
      "1",
      "0",
      "0",
      "1",
    ]);
    await newCircuit(page);
    assert.equal(await node(page, "and").count(), 0);
    x = await node(page, "output", "X").getAttribute("data-id");
    assert.deepEqual(await values(page, x), ["—", "—", "—", "—"]);
    await activate(page.locator('[data-part="and"]'), touch);
    await activate(page.locator('[data-part="not"]'), touch);
    const and = await node(page, "and").getAttribute("data-id"),
      not = await node(page, "not").getAttribute("data-id");
    a = await node(page, "input", "A").getAttribute("data-id");
    b = await node(page, "input", "B").getAttribute("data-id");
    await wire(page, a, and, touch);
    await wire(page, b, and, touch, 0, 1);
    await wire(page, and, not, touch);
    await wire(page, not, x, touch);
    assert.deepEqual(await values(page, x), ["1", "1", "1", "0"]);
    assert.deepEqual(await values(page, and), ["0", "0", "0", "1"]);
    assert.equal(await node(page, "and").getAttribute("data-number"), "1");
    assert.equal(await node(page, "not").getAttribute("data-number"), "2");
    // The last selected wire receives a branch without changing its result.
    await activate(page.locator('[data-part="branch"]'), touch);
    const branch = await node(page, "branch").getAttribute("data-id");
    assert.equal(await page.locator(".wire").count(), 5);
    assert.deepEqual(await values(page, x), ["1", "1", "1", "0"]);
    await activate(page.locator('[data-part="output"]'), touch);
    const y = await node(page, "output", "Y").getAttribute("data-id");
    await wire(page, branch, y, touch, 1);
    assert.deepEqual(await values(page, y), ["1", "1", "1", "0"]);
    const beforeCycle = await page.locator(".wire").count();
    // Keyboard wiring is available even when a large circuit is zoomed out.
    await port(page, not, "out").focus();
    await page.keyboard.press("Enter");
    await port(page, and, "in").focus();
    await page.keyboard.press("Enter");
    assert.match(await page.locator("#circuit-message").textContent(), /一周/);
    assert.equal(await page.locator(".wire").count(), beforeCycle);
    assert.deepEqual(await values(page, x), ["1", "1", "1", "0"]);
    await page.keyboard.press("Escape");
    const toX = page.locator(`.wire[data-to="${x}"]`);
    await toX.focus();
    await page.keyboard.press("Enter");
    await page.locator("#delete-selected").click();
    assert.deepEqual(await values(page, x), ["—", "—", "—", "—"]);
    assert.deepEqual(await values(page, y), ["1", "1", "1", "0"]);
    await page.locator("#undo-circuit").click();
    assert.deepEqual(await values(page, x), ["1", "1", "1", "0"]);
    await page.locator("#redo-circuit").click();
    assert.deepEqual(await values(page, x), ["—", "—", "—", "—"]);
    await page.locator("#undo-circuit").click();
    await page.reload();
    await page.waitForSelector(`.circuit-node[data-id="${branch}"]`);
    assert.deepEqual(await values(page, x), ["1", "1", "1", "0"]);
    await newCircuit(page);
    const palettePoint = await point(page.locator('[data-part="or"]')),
      boardBox = await page.locator("#circuit-board").boundingBox();
    await drag(
      page,
      palettePoint,
      {
        x: boardBox.x + boardBox.width * 0.5,
        y: boardBox.y + boardBox.height * 0.5,
      },
      touch,
    );
    assert.equal(await node(page, "or").count(), 1); // No second addition from the synthetic click after dropping.
    const or = await node(page, "or").getAttribute("data-id");
    a = await node(page, "input", "A").getAttribute("data-id");
    b = await node(page, "input", "B").getAttribute("data-id");
    x = await node(page, "output", "X").getAttribute("data-id");
    await drag(
      page,
      await point(port(page, a, "out")),
      await point(port(page, or, "in")),
      touch,
    );
    await wire(page, b, or, touch, 0, 1);
    await wire(page, or, x, touch);
    assert.deepEqual(await values(page, x), ["0", "1", "1", "1"]);
    const initialTransform = await node(page, "or").getAttribute("transform"),
      gatePoint = await point(node(page, "or").locator(".node-body"));
    await drag(
      page,
      gatePoint,
      { x: gatePoint.x + 24, y: gatePoint.y + 40 },
      touch,
    );
    assert.notEqual(
      await node(page, "or").getAttribute("transform"),
      initialTransform,
    );
    assert.deepEqual(await values(page, x), ["0", "1", "1", "1"]);
    await node(page, "or").locator(".node-body").focus();
    await page.keyboard.press("ArrowLeft");
    assert.equal(await page.locator(".wire").count(), 3);
    await page.locator('[data-part="input"]').click();
    await page.locator('[data-part="input"]').click();
    assert.equal(await page.locator("#circuit-truth tbody tr").count(), 16);
    assert.ok(await page.locator('[data-part="input"]').isDisabled());
    assert.ok(
      !(await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      )),
    );
    await page.addScriptTag({ path: axePath });
    const audit = await page.evaluate(async () => {
      const r = await axe.run({
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
        },
      });
      return r.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      }));
    });
    assert.deepEqual(audit, []);
    console.log(
      `PASS ${width}px: gates, truth table, numbered values, tap/drag wiring, branch insertion, fan-out, cycle rejection, delete/undo/redo, persistence, keyboard and accessibility`,
    );
    await context.close();
  }
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  page.on("pageerror", (e) => errors.push(e.message));
  const requests = [];
  page.on("request", (r) => {
    if (!r.url().startsWith("data:") && !r.url().startsWith("blob:"))
      requests.push(r.url());
  });
  await page.setContent(
    await readFile(
      "/workspace/interactive-lab-review/Interactive-Lab-logic-circuit.html",
      "utf8",
    ),
  );
  await page.waitForSelector('.circuit-node[data-type="and"]');
  await loadExample(page, "adder");
  const sum = await node(page, "output", "X").getAttribute("data-id"),
    carry = await node(page, "output", "Y").getAttribute("data-id");
  assert.deepEqual(await values(page, sum), ["0", "1", "1", "0"]);
  assert.deepEqual(await values(page, carry), ["0", "0", "0", "1"]);
  assert.equal(await node(page, "branch").count(), 3);
  assert.deepEqual(requests, []);
  assert.deepEqual(errors, []);
  console.log(
    "PASS offline standalone HTML and compound circuit; no JavaScript errors or external requests",
  );
} finally {
  await browser.close();
}

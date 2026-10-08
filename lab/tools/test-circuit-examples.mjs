// Development-only: domain checks of the compound examples through the UI.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { parseDocument, DRAFT_KEY } from "../logic-circuit/documents.mjs";
import { decodeShare } from "../logic-circuit/sharing.mjs";

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
const expected = {
  xor: ([a, b]) => [a ^ b],
  adder: ([a, b]) => [(a + b) % 2, Math.floor((a + b) / 2)],
  "full-adder": ([a, b, c]) => [(a + b + c) % 2, Math.floor((a + b + c) / 2)],
  "two-bit-adder": ([a, b, c, d]) => {
    const sum = 2 * a + b + 2 * c + d;
    return [Math.floor(sum / 4), Math.floor(sum / 2) % 2, sum % 2];
  },
  majority: ([a, b, c]) => [Number(a + b + c >= 2)],
  selector: ([a, b, c]) => [c ? b : a],
  parity: ([a, b, c]) => [a ^ b ^ c],
};
const node = (page, type, label) =>
  page.locator(`.circuit-node[data-type="${type}"][data-label="${label}"]`);
async function loadExample(page, id, touch) {
  const press = async (selector) =>
    touch ? page.locator(selector).tap() : page.locator(selector).click();
  await press("#load-circuit");
  await press(`#circuit-example-list [data-example="${id}"]`);
  await press('#confirm-form button[type="submit"]');
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
}
async function fitCheck(page) {
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  const viewBefore = (
    await page.locator("#circuit-board").getAttribute("viewBox")
  )
    .split(" ")
    .map(Number);
  await page.locator("#fit-circuit").click();
  const viewAfter = (
    await page.locator("#circuit-board").getAttribute("viewBox")
  )
    .split(" ")
    .map(Number);
  for (let i = 0; i < 4; i++)
    assert.ok(
      Math.abs(viewBefore[i] - viewAfter[i]) < 0.01,
      "Loading fits the new circuit without needing a second fit",
    );
  const clipped = await page.evaluate(() => {
    const board = document
      .getElementById("circuit-board")
      .getBoundingClientRect();
    return [...document.querySelectorAll(".node-body")]
      .filter((element) => {
        const box = element.getBoundingClientRect();
        return (
          box.left < board.left - 1 ||
          box.right > board.right + 1 ||
          box.top < board.top - 1 ||
          box.bottom > board.bottom + 1
        );
      })
      .map((element) => element.parentElement.dataset.id);
  });
  assert.deepEqual(clipped, []);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    ),
    false,
  );
}
async function verifyExample(page, id, touch) {
  await loadExample(page, id, touch);
  await fitCheck(page);
  const inputCount = await page
    .locator('.circuit-node[data-type="input"]')
    .count();
  const outputIds = [];
  for (const label of ["X", "Y", "Z"]) {
    const output = node(page, "output", label);
    if (await output.count())
      outputIds.push(await output.getAttribute("data-id"));
  }
  const rows = page.locator("#circuit-truth tbody tr");
  assert.equal(await rows.count(), 2 ** inputCount);
  for (let index = 0; index < 2 ** inputCount; index++) {
    const inputBits = index
      .toString(2)
      .padStart(inputCount, "0")
      .split("")
      .map(Number);
    const result = expected[id](inputBits);
    const row = page.locator(`#circuit-truth tr[data-row="${index}"]`);
    for (let i = 0; i < outputIds.length; i++)
      assert.equal(
        await row.locator(`td[data-column="${outputIds[i]}"]`).textContent(),
        String(result[i]),
      );
    assert.ok(!(await row.locator("td").allTextContents()).includes("—"));
    if (touch) await row.tap();
    else await row.click();
    assert.equal(
      await page.locator(".current-row").getAttribute("data-row"),
      String(index),
    );
    for (let i = 0; i < outputIds.length; i++)
      assert.equal(
        await page
          .locator(`.circuit-node[data-id="${outputIds[i]}"] .input-value`)
          .textContent(),
        String(result[i]),
      );
  }
}
try {
  for (const width of [1280, 390, 320]) {
    const touch = width < 600;
    const context = await browser.newContext({
      viewport: { width, height: width === 1280 ? 1100 : 844 },
      hasTouch: touch,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(base + "/lab/logic-circuit/");
    await page.waitForSelector(".circuit-node");
    for (const id of Object.keys(expected))
      await verifyExample(page, id, touch);
    await loadExample(page, "two-bit-adder", touch);
    await page.locator('tr[data-row="15"]').click();
    assert.equal(
      await page.locator("#circuit-calculation").textContent(),
      "a 11₂（3） ＋ b 11₂（3） → 110₂（6）",
    );
    const document = parseDocument(
      await page.evaluate((key) => localStorage.getItem(key), DRAFT_KEY),
    );
    assert.equal(
      document.circuit.nodes.filter((n) => n.type === "input" && n.meaning)
        .length,
      4,
    );
    await page.locator("#share-circuit").click();
    await page.waitForFunction(
      () =>
        document.getElementById("share-url").value &&
        !document.getElementById("copy-url").disabled,
    );
    const sharedURL = await page.locator("#share-url").inputValue();
    const shared = await decodeShare(new URL(sharedURL).hash);
    assert.deepEqual(shared, document);
    await page.locator("#share-dialog [data-close-circuit-dialog]").click();
    await page.reload();
    await page.waitForSelector(
      '.circuit-node[data-type="input"][data-label="D"]',
    );
    assert.equal(
      await page.locator("#circuit-calculation").textContent(),
      "a 11₂（3） ＋ b 11₂（3） → 110₂（6）",
    );
    await fitCheck(page);
    await page.addScriptTag({ path: axePath });
    await audit(page);
    await page.locator("#load-circuit").click();
    await audit(page);
    const recipient = await context.newPage();
    await recipient.goto(sharedURL);
    await recipient.waitForSelector(
      '.circuit-node[data-type="input"][data-label="D"]',
    );
    assert.equal(
      await recipient.locator("#circuit-calculation").textContent(),
      "a 11₂（3） ＋ b 11₂（3） → 110₂（6）",
    );
    assert.equal(
      await node(recipient, "input", "A").locator(".node-type").textContent(),
      "a：2の位",
    );
    console.log(
      `PASS ${width}px: seven compound circuits, every input, full view, captions, sharing and accessibility`,
    );
    await context.close();
  }
  const offline = await browser.newPage({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  const requests = [];
  offline.on("request", (request) => {
    if (/^https?:/.test(request.url())) requests.push(request.url());
  });
  offline.on("pageerror", (error) => errors.push(error.message));
  await offline.setContent(
    await readFile(
      "/workspace/interactive-lab-review/Interactive-Lab-logic-circuit.html",
      "utf8",
    ),
  );
  await verifyExample(offline, "two-bit-adder", true);
  assert.equal(
    await offline.locator("#circuit-calculation").textContent(),
    "a 11₂（3） ＋ b 11₂（3） → 110₂（6）",
  );
  assert.deepEqual(requests, []);
  assert.deepEqual(errors, []);
  console.log(
    "PASS standalone two-bit adder: sixteen combinations, no external resources or JavaScript errors",
  );
} finally {
  await browser.close();
}

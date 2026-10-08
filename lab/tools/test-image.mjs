// Optional development checks. Runtime pages have no external dependencies.
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
async function waitText(page, selector, text) {
  await page.waitForFunction(
    ({ selector, text }) =>
      document.querySelector(selector)?.textContent.includes(text),
    { selector, text },
  );
}
async function resolution(page, index) {
  await page.locator("#resolution").evaluate((el, index) => {
    el.value = index;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, index);
}
async function pixelValues(page) {
  return page
    .locator("#output-canvas")
    .evaluate((c) =>
      Array.from(c.getContext("2d").getImageData(0, 0, c.width, c.height).data),
    );
}
try {
  for (const width of [1280, 390, 320]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      hasTouch: width < 600,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await context.route("**/*", (route) => {
      const url = route.request().url();
      if (
        url.startsWith(base) ||
        url.startsWith("blob:") ||
        url.startsWith("data:")
      )
        route.continue();
      else {
        errors.push("External request: " + url);
        route.abort();
      }
    });
    await page.goto(base + "/lab/");
    assert.equal(await page.locator(".lab-category").count(), 6);
    assert.equal(
      await page.locator("#digital-representation .archive-field-card").count(),
      1,
    );
    await page.locator('a[href="./digital-image/"]').click();
    await waitText(page, "#metric-pixels", "4,096");
    const sourceBefore = await page
      .locator("#source-canvas")
      .evaluate((c) => c.toDataURL());
    if (width === 1280)
      await page.screenshot({
        path: "/tmp/lab-image-desktop.png",
        fullPage: true,
      });
    if (width === 390)
      await page.screenshot({
        path: "/tmp/lab-image-mobile.png",
        fullPage: true,
      });
    await resolution(page, 0);
    await waitText(page, "#metric-pixels", "16画素");
    await page.selectOption("#bits-r", "2");
    await waitText(page, "#metric-bits", "6 bit");
    assert.equal(await page.inputValue("#bits-g"), "2");
    assert.equal(await page.inputValue("#bits-b"), "2");
    await waitText(page, "#metric-size", "12 B");
    const low = pixelValues(page);
    for (const [i, v] of (await low).entries())
      if (i % 4 !== 3) assert.ok([0, 85, 170, 255].includes(v));
    await page.uncheck("#link-bits");
    await page.selectOption("#bits-r", "1");
    await page.selectOption("#bits-g", "4");
    await page.selectOption("#bits-b", "3");
    await waitText(page, "#metric-bits", "8 bit");
    await page.locator('label:has(input[name="channel"][value="r"])').click();
    await waitText(page, "#output-caption", "R表示");
    const reds = await pixelValues(page);
    for (let i = 0; i < reds.length; i += 4) {
      assert.equal(reds[i + 1], 0);
      assert.equal(reds[i + 2], 0);
    }
    await waitText(page, "#metric-size", "16 B");
    await page.locator('label:has(input[name="mode"][value="gray"])').click();
    await page.selectOption("#bits-gray", "3");
    await waitText(page, "#metric-levels", "8段階");
    const gray = await pixelValues(page);
    for (let i = 0; i < gray.length; i += 4) {
      assert.equal(gray[i], gray[i + 1]);
      assert.equal(gray[i], gray[i + 2]);
    }
    await waitText(page, "#metric-size", "6 B");
    assert.ok(await page.locator("#channel-control").isHidden());
    assert.equal(
      await page.locator("#source-canvas").evaluate((c) => c.toDataURL()),
      sourceBefore,
    );
    await page.locator("#output-canvas").click();
    assert.ok(
      (await page.locator("#pixel-inspector").getAttribute("open")) !== null,
    );
    await page.locator("#output-canvas").focus();
    await page.keyboard.press("ArrowRight");
    assert.equal(await page.locator("#pixel-values tr").count(), 1);
    assert.match(
      await page.locator("#pixel-values code").innerText(),
      /^[01]{3}$/,
    );
    await page.locator("#zoom-output").click();
    assert.ok(await page.locator("#image-zoom").isVisible());
    await page.keyboard.press("Escape");
    assert.ok(await page.locator("#image-zoom").isHidden());
    assert.ok(
      !(await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      )),
    );
    // Upload a known red/blue rectangle. The central square must preserve both halves.
    const fixture = await page.evaluate(() => {
      const c = document.createElement("canvas");
      c.width = 64;
      c.height = 32;
      const g = c.getContext("2d");
      g.fillStyle = "red";
      g.fillRect(0, 0, 32, 32);
      g.fillStyle = "blue";
      g.fillRect(32, 0, 32, 32);
      return c.toDataURL().split(",")[1];
    });
    await page
      .locator("#image-file")
      .setInputFiles({
        name: "red-blue.png",
        mimeType: "image/png",
        buffer: Buffer.from(fixture, "base64"),
      });
    await waitText(page, "#source-caption", "32 × 32");
    await page.locator('label:has(input[name="mode"][value="color"])').click();
    await page.locator('label:has(input[name="channel"][value="rgb"])').click();
    await page.check("#link-bits");
    await page.selectOption("#bits-r", "8");
    await waitText(page, "#metric-bits", "24 bit");
    await page.waitForFunction(() => {
      const c = document.querySelector("#output-canvas");
      return c.getContext("2d").getImageData(0, 0, 1, 1).data[0] === 255;
    });
    const uploaded = await pixelValues(page);
    assert.deepEqual(uploaded.slice(0, 4), [255, 0, 0, 255]);
    assert.deepEqual(uploaded.slice(12, 16), [0, 0, 255, 255]);
    await page
      .locator("#image-file")
      .setInputFiles({
        name: "invalid.png",
        mimeType: "image/png",
        buffer: Buffer.from("not an image"),
      });
    await waitText(page, "#image-error", "読み込めません");
    assert.deepEqual(await pixelValues(page), uploaded);
    await resolution(page, 14);
    await waitText(page, "#metric-pixels", "1,024画素");
    assert.ok(await page.locator("#resolution-up").isDisabled());
    await page.addScriptTag({ path: axePath });
    const result = await page.evaluate(() =>
      axe.run({
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
        },
      }),
    );
    assert.deepEqual(
      result.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
      [],
    );
    console.log(
      `PASS ${width}px: controls, RGB, grayscale, data size, inspection, zoom, image upload, accessibility`,
    );
    await context.close();
  }
  // The downloadable HTML must run from embedded resources alone.
  const page = await browser.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) =>
    errors.push("Standalone external request: " + r.url()),
  );
  await page.setContent(
    await readFile(
      "/workspace/interactive-lab-review/Interactive-Lab-digital-image.html",
      "utf8",
    ),
  );
  await waitText(page, "#metric-pixels", "4,096");
  await page.selectOption("#bits-b", "1");
  await waitText(page, "#metric-levels", "8色");
  assert.equal(
    await page.locator("script[src],link[rel=stylesheet]").count(),
    0,
  );
  await resolution(page, 14);
  await waitText(page, "#metric-pixels", "1,048,576画素");
  await waitText(page, "#metric-size", "384 KiB");
  await page.close();
  assert.deepEqual(errors, []);
  console.log(
    "PASS standalone HTML and maximum resolution; no JavaScript errors or external requests",
  );
} finally {
  await browser.close();
}

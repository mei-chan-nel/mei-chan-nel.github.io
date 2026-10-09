// Optional development checks. Runtime pages have no external dependencies.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolutions as sizes } from "../digital-image/pixels.mjs";
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
async function resolution(page, size) {
  const index = sizes.indexOf(size);
  assert.ok(index >= 0, `Unsupported resolution: ${size}`);
  await page.locator("#resolution").evaluate(
    (input, { index, sizes }) => {
      const max = sizes.findLastIndex(
        (n) => n <= document.querySelector("#source-canvas").width,
      );
      input.value = Math.round((Math.min(index, max) / max) * 1000) || 0;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    },
    { index, sizes },
  );
}
async function bits(page, channel, value) {
  for (let i = 0; i < 8; i++) {
    const current = parseInt(
      await page.locator("#bits-" + channel).innerText(),
    );
    if (current === value) return;
    await page
      .locator("#bits-" + channel + (current < value ? "-up" : "-down"))
      .click();
  }
}
async function pixelValues(page) {
  return page
    .locator("#output-canvas")
    .evaluate((c) =>
      Array.from(c.getContext("2d").getImageData(0, 0, c.width, c.height).data),
    );
}
try {
  for (const { width, height } of [
    { width: 1280, height: 720 },
    { width: 390, height: 844 },
    { width: 320, height: 740 },
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
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
      else if (
        url.startsWith("https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?")
      )
        route.fulfill({ contentType: "application/javascript", body: "" });
      else {
        errors.push("External request: " + url);
        route.abort();
      }
    });
    await page.goto(base + "/lab/");
    assert.equal(await page.locator(".lab-category").count(), 6);
    assert.equal(
      await page
        .locator('#digital-representation a[href="./digital-image/"]')
        .count(),
      1,
    );
    await page.locator('a[href="./digital-image/"]').click();
    await waitText(page, "#metric-pixels", "4,096");
    await page.waitForTimeout(100);
    const visible = await page.evaluate(() =>
      [".image-controls", ".image-comparison", ".image-metrics"].map((s) => ({
        selector: s,
        bottom: document.querySelector(s).getBoundingClientRect().bottom,
      })),
    );
    for (const r of visible)
      assert.ok(
        r.bottom <= height + 1,
        `${r.selector} below viewport at ${width}x${height}: ${r.bottom}`,
      );
    assert.ok(await page.locator("#show-grid").isChecked());
    assert.ok(
      await page.locator("#source-grid").evaluate((c) =>
        c
          .getContext("2d")
          .getImageData(0, 0, c.width, c.height)
          .data.some((v, i) => i % 4 === 3 && v > 0),
      ),
    );
    await page.uncheck("#show-grid");
    assert.ok(
      await page.locator("#source-grid").evaluate((c) =>
        c
          .getContext("2d")
          .getImageData(0, 0, c.width, c.height)
          .data.every((v, i) => i % 4 !== 3 || v === 0),
      ),
    );
    await page.check("#show-grid");
    const smoothPosition = String(
      Number(await page.locator("#resolution").inputValue()) + 1,
    );
    await page.locator("#resolution").evaluate((input, value) => {
      input.value = value;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }, smoothPosition);
    assert.equal(
      await page.locator("#resolution").inputValue(),
      smoothPosition,
    );
    await page.locator("#resolution").focus();
    await page.keyboard.press("ArrowRight");
    await waitText(page, "#metric-pixels", "4,624画素");
    assert.equal(
      await page.locator("#source-grid").getAttribute("data-cells"),
      "68",
    );
    await resolution(page, 8);
    await page.keyboard.press("ArrowRight");
    await waitText(page, "#metric-pixels", "81画素");
    assert.equal(
      await page.locator("#output-canvas").getAttribute("width"),
      "9",
    );
    assert.equal(
      await page.locator("#source-grid").getAttribute("data-cells"),
      "9",
    );
    await waitText(page, "#metric-size", "243 B");
    await resolution(page, 32);
    await page.keyboard.press("ArrowRight");
    await waitText(page, "#metric-pixels", "1,156画素");
    await resolution(page, 64);
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
    await resolution(page, 4);
    await waitText(page, "#metric-pixels", "16画素");
    assert.equal(
      await page.locator("#source-grid").getAttribute("data-cells"),
      "4",
    );
    await bits(page, "r", 2);
    await bits(page, "g", 2);
    await bits(page, "b", 2);
    await waitText(page, "#metric-bits", "6 bit");
    assert.match(await page.locator("#bits-g").innerText(), /^2/);
    assert.match(await page.locator("#bits-b").innerText(), /^2/);
    await waitText(page, "#metric-size", "12 B");
    const low = pixelValues(page);
    for (const [i, v] of (await low).entries())
      if (i % 4 !== 3) assert.ok([0, 85, 170, 255].includes(v));
    await bits(page, "r", 1);
    await bits(page, "g", 4);
    await bits(page, "b", 3);
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
    await bits(page, "gray", 3);
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
    assert.equal(
      await page
        .locator("#pixel-inspector, .image-notes, select, #link-bits")
        .count(),
      0,
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
    await page.locator("#reset-settings").click();
    await waitText(page, "#metric-bits", "24 bit");
    await waitText(page, "#metric-pixels", "4,096");
    assert.ok(
      await page.locator('input[name="mode"][value="color"]').isChecked(),
    );
    assert.ok(
      await page.locator('input[name="channel"][value="rgb"]').isChecked(),
    );
    assert.equal(
      await page.locator("#source-canvas").evaluate((c) => c.toDataURL()),
      sourceBefore,
    );
    // Hold, release outside the control, then verify that changes stop.
    const holdBox = await page.locator("#bits-r-down").boundingBox();
    await page.mouse.move(
      holdBox.x + holdBox.width / 2,
      holdBox.y + holdBox.height / 2,
    );
    await page.mouse.down();
    await page.waitForFunction(
      () => parseInt(document.querySelector("#bits-r").textContent) <= 5,
    );
    await page.mouse.move(0, 0);
    await page.mouse.up();
    const released = await page.locator("#bits-r").innerText();
    await page.waitForTimeout(250);
    assert.equal(await page.locator("#bits-r").innerText(), released);
    await page.locator("#reset-settings").click();
    await page.locator("#bits-r-down").focus();
    await page.keyboard.press("ArrowDown");
    assert.match(await page.locator("#bits-r").innerText(), /^7/);
    assert.match(await page.locator("#bits-g").innerText(), /^8/);
    if (width < 600) {
      await page.locator("#bits-g-down").tap();
      assert.match(await page.locator("#bits-g").innerText(), /^7/);
    }
    await resolution(page, 4);
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
    await page.locator("#image-file").setInputFiles({
      name: "red-blue.png",
      mimeType: "image/png",
      buffer: Buffer.from(fixture, "base64"),
    });
    await waitText(page, "#source-caption", "32 × 32");
    await page.locator('label:has(input[name="mode"][value="color"])').click();
    await page.locator('label:has(input[name="channel"][value="rgb"])').click();
    await bits(page, "r", 8);
    await bits(page, "g", 8);
    await bits(page, "b", 8);
    await waitText(page, "#metric-bits", "24 bit");
    await page.waitForFunction(() => {
      const c = document.querySelector("#output-canvas");
      return c.getContext("2d").getImageData(0, 0, 1, 1).data[0] === 255;
    });
    const uploaded = await pixelValues(page);
    assert.deepEqual(uploaded.slice(0, 4), [255, 0, 0, 255]);
    assert.deepEqual(uploaded.slice(12, 16), [0, 0, 255, 255]);
    await page.locator("#image-file").setInputFiles({
      name: "invalid.png",
      mimeType: "image/png",
      buffer: Buffer.from("not an image"),
    });
    await waitText(page, "#image-error", "読み込めません");
    assert.deepEqual(await pixelValues(page), uploaded);
    await resolution(page, 1024);
    await waitText(page, "#metric-pixels", "1,024画素");
    assert.equal(
      await page.locator("#output-canvas").getAttribute("width"),
      "32",
    );
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
      `PASS ${width}px: controls, RGB, grayscale, viewport fit, sampling grid, data size, hold/release, reset, keyboard/touch, zoom, image upload, accessibility`,
    );
    await context.close();
  }
  // The downloadable HTML must run from embedded resources alone.
  const page = await browser.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) =>
    r.url().startsWith("blob:") || r.url().startsWith("data:")
      ? undefined
      : errors.push("Standalone external request: " + r.url()),
  );
  await page.setContent(
    await readFile(
      "/workspace/interactive-lab-review/Interactive-Lab-digital-image.html",
      "utf8",
    ),
  );
  await waitText(page, "#metric-pixels", "4,096");
  await bits(page, "r", 1);
  await bits(page, "g", 1);
  await bits(page, "b", 1);
  await waitText(page, "#metric-levels", "8色");
  assert.equal(
    await page.locator("script[src],link[rel=stylesheet]").count(),
    0,
  );
  await resolution(page, 1024);
  await waitText(page, "#metric-pixels", "1,048,576画素");
  await waitText(page, "#metric-size", "384 KiB");
  await page.locator("#resolution").evaluate((input, sizes) => {
    const lastPosition = Math.round(
      (sizes.indexOf(8) / (sizes.length - 1)) * 1000,
    );
    for (const value of [0, 1000, 80, 850, lastPosition]) {
      input.value = value;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }, sizes);
  await waitText(page, "#metric-pixels", "64画素");
  assert.equal(
    await page.locator("#source-grid").getAttribute("data-cells"),
    "8",
  );
  assert.equal(await page.locator("#output-canvas").getAttribute("width"), "8");
  await page.close();
  assert.deepEqual(errors, []);
  console.log(
    "PASS standalone HTML and maximum resolution; no JavaScript errors or external requests",
  );
} finally {
  await browser.close();
}

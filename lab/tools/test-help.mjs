// Local regression suite. ChatGPT is intercepted; this does NOT test its service.
// Start scripts/preview_site.py first. Dependencies follow other Lab browser suites.
import { createRequire } from "node:module";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { composePrompt } from "../help/prompt.mjs";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.LAB_PLAYWRIGHT_MODULE || "playwright");
const origin = process.env.LAB_TEST_ORIGIN || "http://127.0.0.1:8773";
const output = resolve(process.env.LAB_HELP_REPORT_DIR || "work/lab-help-browser");
await mkdir(output, { recursive: true });
const data = new URL("../help/data/", import.meta.url);
const json = async p => JSON.parse(await readFile(new URL(p, data), "utf8"));
const manifest = await json("manifest.json"), common = await json("common.json");
const browser = await chromium.launch({ executablePath: process.env.LAB_CHROMIUM_PATH || "/usr/bin/chromium", args: ["--no-sandbox"], headless: true });
const results = [];
const viewports = [{ width: 1440, height: 1000 }, { width: 390, height: 844 }, { width: 320, height: 740 }];
async function context(viewport) {
  const c = await browser.newContext({ viewport, reducedMotion: "reduce" });
  // No real service requests, ads or analytics in local tests.
  await c.route(/^https?:\/\//, route => route.request().url().startsWith(origin + "/")
    ? route.continue() : route.fulfill({ status: 200,
      contentType: route.request().resourceType() === "script" ? "application/javascript" : "text/html",
      body: route.request().resourceType() === "script" ? "" : "<!doctype html><title>External test stub</title>" }));
  return c;
}
try {
  for (const viewport of viewports) {
    const c = await context(viewport);
    for (const [id, files] of Object.entries(manifest.pages)) {
      const page = await c.newPage();
      const errors = [];
      page.on("pageerror", e => errors.push(e.message));
      await page.goto(`${origin}/lab/${id}/`, { waitUntil: "networkidle" });
      const help = page.getByRole("button", { name: "ChatGPTに使い方を聞く", exact: true });
      assert.equal(await help.count(), 1, id);
      await help.waitFor({ state: "visible" });
      const box = await help.boundingBox();
      assert.ok(box.height >= 44 && box.x >= 0 && box.x + box.width <= viewport.width + 1, `${id}: button bounds`);
      const overlap = await page.evaluate(() => {
        const b = document.querySelector('.lab-help__button').getBoundingClientRect();
        const h = document.querySelector('main h1').getBoundingClientRect();
        return b.left < h.right && b.right > h.left && b.top < h.bottom && b.bottom > h.top;
      });
      assert.equal(overlap, false, `${id}: heading overlap`);
      const before = await page.evaluate(() => ({
        path: location.href,
        inputs: [...document.querySelectorAll('main input,main select,main textarea')].map(e => [e.id,e.value,e.checked]),
        stored: JSON.stringify(localStorage),
      }));
      const popupPromise = page.waitForEvent("popup");
      await help.focus();
      await help.press("Enter");
      const popup = await popupPromise;
      await popup.waitForURL("https://chatgpt.com/**");
      const prompt = composePrompt(common, await Promise.all(files.map(json)));
      assert.equal(new URL(popup.url()).searchParams.get("q"), prompt, id);
      assert.equal(await popup.evaluate(() => window.opener), null);
      await popup.close();
      assert.equal(await page.locator(".lab-help__recovery").getAttribute("open"), null);
      const after = await page.evaluate(() => ({
        path: location.href,
        inputs: [...document.querySelectorAll('main input,main select,main textarea')].filter(e => e.id !== 'lab-help-prompt').map(e => [e.id,e.value,e.checked]),
        stored: JSON.stringify(localStorage),
      }));
      before.inputs = before.inputs.filter(([id]) => id !== 'lab-help-prompt');
      assert.deepEqual(after, before, `${id}: learner state preserved`);
      await page.locator(".lab-help__recovery summary").click();
      assert.equal(await page.locator("#lab-help-prompt").inputValue(), prompt);
      if (["cpu-memory", "thinking-tools", "statistics/histogram"].includes(id)) {
        await page.locator(".lab-help__recovery summary").click();
        await page.screenshot({ path: resolve(output, `${id.replaceAll("/", "-")}-${viewport.width}.png`), fullPage: false });
      }
      // Inspect actual rendered controls for data review; never include learner data.
      const controls = await page.locator('main button,main label,main h1,main h2').allTextContents();
      results.push({ id, width: viewport.width, button: box, errors, controls: viewport.width === 1440 ? controls.map(s => s.trim()).filter(Boolean) : undefined });
      assert.equal(errors.length, 0, `${id}: ${errors.join('; ')}`);
      console.log(`PASS ${id} ${viewport.width}px`);
      await page.close();
    }
    await c.close();
  }

  const c = await context(viewports[1]);
  const page = await c.newPage();
  await page.addInitScript(() => { window.open = () => null; });
  await page.goto(`${origin}/lab/radix-conversion/?private=NEVER_SEND#NEVER_SEND`, { waitUntil: "networkidle" });
  await page.locator("#number-input").fill("12345");
  await page.getByRole("button", { name: "ChatGPTに使い方を聞く", exact: true }).click();
  await page.locator(".lab-help__recovery[open]").waitFor();
  assert.equal(await page.locator("#number-input").inputValue(), "12345");
  assert.ok(!(await page.locator("#lab-help-prompt").inputValue()).includes("NEVER_SEND"));
  await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable:true, value:{writeText:async()=>{throw Error("denied")}} }));
  await page.locator("[data-help-copy]").click();
  assert.ok((await page.locator(".lab-help__copy-status").textContent()).includes("自動コピーできません"));
  assert.equal(await page.locator("#lab-help-prompt").evaluate(e => e.selectionEnd - e.selectionStart), (await page.locator("#lab-help-prompt").inputValue()).length);
  await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable:true, value:{writeText:async text=>{window.copiedPrompt=text;}} }));
  await page.locator("[data-help-copy]").click();
  assert.equal(await page.evaluate(() => window.copiedPrompt), await page.locator("#lab-help-prompt").inputValue());
  results.push({ scenario: "popup blocked, private query/hash excluded, clipboard denied/manual selection, clipboard success", pass: true });

  let fail = true;
  await c.route("**/help/data/cpu-memory.json", route => fail ? route.fulfill({status:503,body:"unavailable"}) : route.continue());
  await page.goto(`${origin}/lab/cpu-memory/`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "ChatGPTに使い方を聞く", exact: true }).click();
  await page.getByText("案内データを読み込めませんでした。", {exact:false}).waitFor();
  fail = false;
  await page.getByRole("button", { name: "ChatGPTに使い方を聞く", exact: true }).click();
  await page.locator(".lab-help__recovery[open]").waitFor();
  assert.ok((await page.locator("#lab-help-prompt").inputValue()).includes("CPUと記憶装置"));
  const stepsBefore = await page.locator("#steps").textContent();
  await page.locator("#step").click();
  assert.ok(await page.locator("#state").textContent());
  results.push({ scenario: "guide fetch failure/retry; lab stepping remains available", pass: true, stepsBefore });
  await c.close();
} finally {
  await writeFile(resolve(output, "results.json"), JSON.stringify(results, null, 2) + "\n");
  await browser.close();
}

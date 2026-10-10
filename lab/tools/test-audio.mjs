// Development only: check actual Web Audio buffers and pointer/keyboard controls.
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
async function ready(page) {
  await page.waitForSelector('.audio-lab[aria-busy="false"]');
  await page.waitForFunction(
    () => !document.querySelector("#play-processed").disabled,
  );
}
async function observe(page) {
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.origin === new URL(base).origin) return route.continue();
    if (url.pathname.endsWith("/adsbygoogle.js"))
      return route.fulfill({ contentType: "application/javascript", body: "" });
    errors.push(`External request: ${url.origin}`);
    return route.abort();
  });
  await page.addInitScript(() => {
    window.audioChecks = { buffers: [], starts: [], contexts: 0 };
    const Native = window.AudioContext;
    window.AudioContext = class extends Native {
      constructor() {
        super();
        window.audioChecks.contexts++;
      }
      createBuffer(...args) {
        const buffer = super.createBuffer(...args),
          copy = buffer.copyToChannel.bind(buffer);
        buffer.copyToChannel = (values, ...rest) => {
          let peak = 0,
            energy = 0;
          for (const v of values) {
            peak = Math.max(peak, Math.abs(v));
            energy += v * v;
          }
          // Projection on the folded 500 Hz wave, away from clip boundaries.
          let error = 0;
          for (let n = 4800; n < 240000; n++)
            error +=
              (values[n] + 0.7 * Math.sin((2 * Math.PI * 500 * n) / 48000)) **
              2;
          window.audioChecks.buffers.push({
            length: buffer.length,
            rate: buffer.sampleRate,
            channels: buffer.numberOfChannels,
            peak,
            energy,
            aliasRms: Math.sqrt(error / 235200),
          });
          copy(values, ...rest);
        };
        return buffer;
      }
      createBufferSource() {
        const source = super.createBufferSource(),
          start = source.start.bind(source);
        source.start = (...args) => {
          window.audioChecks.starts.push(args);
          start(...args);
        };
        return source;
      }
    };
  });
}
async function rate(page, value) {
  await page.locator("#sample-rate").fill(String(value));
  await page.locator("#sample-rate").press("Tab");
  await ready(page);
}
async function axe(page) {
  await page.addScriptTag({ path: axePath });
  const result = await page.evaluate(() =>
    window.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
    }),
  );
  assert.deepEqual(
    result.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
    [],
  );
}
try {
  for (const [width, height] of [
    [1280, 720],
    [390, 844],
    [320, 740],
  ]) {
    const page = await browser.newPage({
      viewport: { width, height },
      hasTouch: width < 500,
    });
    await observe(page);
    await page.goto(`${base}/lab/digital-audio/`);
    await ready(page);
    assert.equal(
      await page.evaluate(() => window.audioChecks.contexts),
      0,
      "No playback before a gesture",
    );
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    const original = await page.locator("#original-wave").boundingBox(),
      processed = await page.locator("#processed-wave").boundingBox();
    assert.ok(Math.abs(original.y - processed.y) < 1, "Waveform axes line up");
    if (width === 1280)
      assert.ok(
        (await page.locator(".audio-metrics").boundingBox()).y +
          (await page.locator(".audio-metrics").boundingBox()).height <=
          height,
        "Controls, plots and results fit on desktop",
      );
    await axe(page);
    await page.locator("#bits-down").click();
    await ready(page);
    assert.match(await page.locator("#bits").innerText(), /^7/);
    await page.locator("#bits-up").focus();
    await page.keyboard.press("Enter");
    await ready(page);
    assert.match(
      await page.locator("#pcm-formula").innerText(),
      /48,000 バイト/,
    );
    await page.locator("[data-preset=quantize]").click();
    await ready(page);
    assert.match(await page.locator("#levels").innerText(), /^16$/);
    assert.match(
      await page.locator("#pcm-formula").innerText(),
      /24,000 バイト/,
    );
    await page.locator("#window-size").selectOption("0.0005");
    assert.match(
      await page.locator("#processed-wave").getAttribute("aria-label"),
      /標本点を表示/,
    );
    const detail = await page.locator("#sample-detail").innerText();
    await page.locator("#sample-next").click();
    assert.notEqual(await page.locator("#sample-detail").innerText(), detail);
    const at = await page.locator("#processed-wave").boundingBox();
    if (width < 500)
      await page.touchscreen.tap(at.x + at.width * 0.7, at.y + at.height * 0.5);
    else await page.mouse.click(at.x + at.width * 0.7, at.y + at.height * 0.5);
    assert.match(
      await page.locator("#sample-detail").innerText(),
      /→.*[01]{4}/,
    );
    await page.locator("#window-size").selectOption("6");
    assert.equal(await page.locator("#wave-position").isDisabled(), true);
    await page.locator("#window-size").selectOption("0.01");
    await page.locator("#wave-position").evaluate((el) => {
      el.value = 5000;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
    assert.match(await page.locator("#position-label").innerText(), /2\.995/);
    await page.locator("#sound-source").selectOption("ode");
    await ready(page);
    await page.locator("#play-original").click();
    await page.waitForFunction(
      () => document.querySelector("#play-original").dataset.playing === "true",
    );
    await page.waitForFunction(
      () =>
        parseFloat(document.querySelector("#playback-position").textContent) >
        0.1,
    );
    await page.locator("#play-processed").click();
    await page.waitForFunction(
      () =>
        document.querySelector("#play-processed").dataset.playing === "true",
    );
    assert.ok(
      await page.evaluate(() => window.audioChecks.starts.at(-1)[1] > 0.1),
      "A/B switch retains position",
    );
    const buffers = await page.evaluate(() => window.audioChecks.buffers);
    for (const buffer of buffers) {
      assert.equal(buffer.length, 288000);
      assert.equal(buffer.rate, 48000);
      assert.equal(buffer.channels, 1);
      assert.ok(buffer.energy > 0);
    }
    await page.locator("#stop-audio").click();
    await page.locator("[data-preset=alias]").click();
    await ready(page);
    assert.match(
      await page.locator("#alias-notice").innerText(),
      /1,000 Hz → 500 Hz/,
    );
    if (width === 1280) {
      const metrics = await page.locator(".audio-metrics").boundingBox();
      assert.ok(
        metrics.y + metrics.height <= height,
        "The pure tone controls also fit on desktop",
      );
    }
    await page.locator("#play-processed").click();
    await page.waitForFunction(
      () =>
        document.querySelector("#play-processed").dataset.playing === "true",
    );
    assert.ok(
      await page.evaluate(
        () => window.audioChecks.buffers.at(-1).aliasRms < 0.002,
      ),
      "The buffer played is the folded 500 Hz tone",
    );
    await page.locator("#stop-audio").click();
    await rate(page, 2000);
    assert.match(
      await page.locator("#alias-notice").innerText(),
      /2倍ちょうど/,
    );
    await page.locator("#play-processed").click();
    await page.waitForFunction(
      () =>
        document.querySelector("#play-processed").dataset.playing === "true",
    );
    assert.equal(
      await page.evaluate(() => window.audioChecks.buffers.at(-1).energy),
      0,
    );
    await page.locator("#stop-audio").click();
    // Rapid slider changes must finish with the most recent setting.
    await page.locator("#sample-rate-slider").evaluate((el) => {
      for (const value of [100, 800, 300, 950, 0]) {
        el.value = value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    await ready(page);
    assert.equal(await page.locator("#sample-rate").inputValue(), "500");
    assert.match(
      await page.locator("#sample-detail").innerText(),
      /0\.0000 → 0\.0000/,
    );
    await page.locator("#sample-rate").fill("999999");
    await page.locator("#sample-rate").press("Tab");
    await ready(page);
    assert.equal(await page.locator("#sample-rate").inputValue(), "48000");
    await page.locator("#reset-audio").click();
    await ready(page);
    assert.equal(await page.locator("#sound-source").inputValue(), "twinkle");
    assert.equal(await page.locator("#sample-rate").inputValue(), "8000");
    assert.match(await page.locator("#bits").innerText(), /^8/);
    assert.equal(await page.locator("#tone-control").isVisible(), false);
    await page.evaluate(() =>
      window.dispatchEvent(
        new PageTransitionEvent("pagehide", { persisted: true }),
      ),
    );
    await page.locator("#bits-down").click();
    await ready(page);
    await page.locator("#play-original").click();
    await page.waitForFunction(
      () => document.querySelector("#play-original").dataset.playing === "true",
    );
    await page.close();
    console.log(
      `Audio controls / PCM / Web Audio / accessibility: ${width}px passed`,
    );
  }
  const noAudio = await browser.newPage();
  await observe(noAudio);
  await noAudio.addInitScript(() => {
    window.AudioContext = undefined;
    window.webkitAudioContext = undefined;
    window.Worker = undefined;
  });
  await noAudio.goto(`${base}/lab/digital-audio/`);
  await ready(noAudio);
  await noAudio.locator("#play-original").click();
  assert.match(
    await noAudio.locator("#audio-status").innerText(),
    /波形の実験は続けられます/,
  );
  await noAudio.locator("[data-preset=alias]").click();
  await ready(noAudio);
  assert.match(await noAudio.locator("#alias-notice").innerText(), /500 Hz/);
  await noAudio.close();
  const offline = await browser.newPage({
    viewport: { width: 390, height: 844 },
  });
  await observe(offline);
  await offline.goto("about:blank");
  await offline.setContent(
    await readFile(
      process.env.LAB_AUDIO_HTML ||
        "/workspace/interactive-lab-review/Interactive-Lab-digital-audio.html",
      "utf8",
    ),
  );
  await ready(offline);
  await offline.locator("[data-preset=alias]").click();
  await ready(offline);
  await offline.locator("#play-processed").click();
  await offline.waitForFunction(
    () => document.querySelector("#play-processed").dataset.playing === "true",
  );
  assert.ok(
    await offline.evaluate(
      () => window.audioChecks.buffers.at(-1).aliasRms < 0.002,
    ),
  );
  await offline.close();
  assert.deepEqual(errors, []);
  console.log("Worker fallback / unsupported audio / standalone HTML passed");
} finally {
  await browser.close();
}

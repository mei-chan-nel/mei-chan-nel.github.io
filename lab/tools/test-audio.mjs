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
    window.audioChecks = {
      buffers: [],
      starts: [],
      contexts: 0,
      sources: [],
      rawBuffers: [],
    };
    window.drawChecks = [];
    for (const method of [
      "beginPath",
      "moveTo",
      "lineTo",
      "clearRect",
      "stroke",
      "fillText",
    ]) {
      const native = CanvasRenderingContext2D.prototype[method];
      CanvasRenderingContext2D.prototype[method] = function (...args) {
        if (this.canvas.id === "combined-wave") {
          if (method === "clearRect") window.drawChecks = [];
          if (method === "beginPath") this.testPath = [];
          if (method === "moveTo" || method === "lineTo")
            this.testPath?.push([method, ...args]);
          if (method === "stroke")
            window.drawChecks.push({
              color: this.strokeStyle,
              path: this.testPath?.slice(),
            });
          if (method === "fillText") window.drawChecks.push({ text: args[0] });
        }
        return native.apply(this, args);
      };
    }
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
          window.audioChecks.rawBuffers.push(Float32Array.from(values));
          copy(values, ...rest);
        };
        return buffer;
      }
      createBufferSource() {
        const source = super.createBufferSource(),
          start = source.start.bind(source);
        source.start = (...args) => {
          window.audioChecks.starts.push(args);
          source.testStart = args;
          start(...args);
        };
        const connect = source.connect.bind(source);
        source.connect = (next, ...args) => {
          source.testNext = next;
          return connect(next, ...args);
        };
        window.audioChecks.sources.push(source);
        return source;
      }
      createGain() {
        const gain = super.createGain(),
          connect = gain.connect.bind(gain);
        gain.testAutomation = [];
        gain.connect = (next, ...args) => {
          gain.testNext = next;
          return connect(next, ...args);
        };
        for (const method of ["setValueAtTime", "linearRampToValueAtTime"]) {
          const native = gain.gain[method].bind(gain.gain);
          gain.gain[method] = (...args) => {
            gain.testAutomation.push([method, ...args]);
            return native(...args);
          };
        }
        return gain;
      }
    };
    // Render the actual buffer and captured gain graph through the native Web Audio
    // engine, both at 48 kHz and at a device rate of 44.1 kHz. No mock audio nodes.
    window.checkPlaybackGraph = async (outputRate) => {
      const captured = window.audioChecks.sources.at(-1);
      const voice = captured.testNext,
        master = voice.testNext;
      const render = async (values) => {
        const offline = new OfflineAudioContext(1, outputRate * 6, outputRate);
        const source = offline.createBufferSource();
        source.buffer = offline.createBuffer(1, values.length, 48000);
        source.buffer.copyToChannel(values, 0);
        const fade = offline.createGain(),
          volume = offline.createGain();
        volume.gain.value = master.gain.value;
        for (const [method, value, time] of voice.testAutomation)
          fade.gain[method](value, Math.max(0, time - captured.testStart[0]));
        source.connect(fade);
        fade.connect(volume);
        volume.connect(offline.destination);
        source.start(0, captured.testStart[1] || 0);
        return (await offline.startRendering()).getChannelData(0);
      };
      const actual = await render(window.audioChecks.rawBuffers.at(-1));
      const original = await render(window.audioChecks.rawBuffers[0]);
      let error = 0,
        peak = 0,
        tail = 0;
      for (let i = Math.ceil(outputRate * 0.02); i < outputRate * 5.1; i++) {
        error += (actual[i] - original[i]) ** 2;
        peak = Math.max(peak, Math.abs(actual[i]));
      }
      for (let i = Math.ceil(outputRate * 5.3); i < actual.length; i++)
        tail = Math.max(tail, Math.abs(actual[i]));
      return {
        rms: Math.sqrt(error / (outputRate * 5.08)),
        peak,
        tail,
        channels: 1,
        rate: outputRate,
      };
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
async function bits(page, target) {
  while (parseInt(await page.locator("#bits").innerText()) !== target) {
    const current = parseInt(await page.locator("#bits").innerText());
    await page.locator(current < target ? "#bits-up" : "#bits-down").click();
  }
  await ready(page);
}
async function aliasSetup(page) {
  await page.locator("#sound-source").selectOption("sine");
  await ready(page);
  await rate(page, 1500);
  await bits(page, 16);
  await page.locator("#window-size").selectOption("0.01");
}
async function resizeWave(page, width) {
  const card = page.locator(".wave-card"),
    canvas = page.locator("#combined-wave");
  const original = await card.boundingBox(),
    graph = await canvas.boundingBox();
  await page.evaluate(() => {
    const r = document.querySelector(".wave-card").getBoundingClientRect();
    window.scrollTo({
      top: window.scrollY + r.bottom - innerHeight * 0.55,
      behavior: "instant",
    });
  });
  const drag = async (selector, dx, dy) => {
    const r = await page.locator(selector).boundingBox(),
      x = r.x + r.width / 2,
      y = r.y + r.height / 2;
    if (width < 500) {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x, y }],
      });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: x + dx, y: y + dy }],
      });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      await cdp.detach();
    } else {
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + dx, y + dy, { steps: 5 });
      await page.mouse.up();
    }
  };
  await drag(".wave-resize-bottom", 0, 140);
  const taller = await card.boundingBox(),
    tallerGraph = await canvas.boundingBox();
  assert.ok(
    Math.abs(taller.height - original.height - 140) < 1,
    "Bottom edge increases card height",
  );
  assert.ok(
    Math.abs(tallerGraph.height - graph.height - 140) < 1,
    "The graph uses the added height",
  );
  await page.waitForFunction(() => {
    const c = document.querySelector("#combined-wave"),
      ratio = Math.min(2, devicePixelRatio || 1);
    return c.height === Math.round(c.clientHeight * ratio);
  });
  const shrink = width < 500 ? 30 : 100;
  await drag(".wave-resize-right", -shrink, 0);
  const narrower = await card.boundingBox();
  assert.ok(
    Math.abs(narrower.width - original.width + shrink) < 1,
    "Right edge changes width",
  );
  assert.ok(
    Math.abs(narrower.height - taller.height) < 1,
    "Width resizing keeps card height",
  );
  await page.locator("#resize-wave").focus();
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowDown");
  assert.ok(
    Math.abs((await card.boundingBox()).height - original.height - 16) < 1,
  );
  await page.keyboard.press("Home");
  assert.ok(Math.abs((await card.boundingBox()).height - original.height) < 1);
  assert.ok(Math.abs((await card.boundingBox()).width - original.width) < 1);
  assert.equal(await page.locator("#sample-rate").inputValue(), "48000");
  assert.equal(
    await page.evaluate(() => window.audioChecks.contexts),
    0,
    "Resizing does not start audio",
  );
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
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
    const combined = await page.locator("#combined-wave").boundingBox();
    const visual = await page.locator(".audio-visuals").boundingBox();
    assert.ok(
      combined.width > visual.width * 0.85,
      "One wide waveform uses the available width",
    );
    const originalPlay = await page.locator("#play-original").boundingBox();
    const processedPlay = await page.locator("#play-processed").boundingBox();
    assert.ok(
      Math.abs(originalPlay.y - processedPlay.y) < 1,
      "A/B play buttons sit side by side",
    );
    assert.equal(
      await page
        .locator("#window-size")
        .evaluate((el) => !!el.closest(".wave-card")),
      true,
    );
    assert.equal(await page.locator("#show-reconstructed").isChecked(), false);
    const range = await page.locator(".wave-range").boundingBox(),
      layers = await page.locator(".wave-layers").boundingBox();
    assert.ok(
      layers.x >= range.x + range.width,
      "Display options sit to the right of the range selector",
    );
    if (width === 1280) {
      assert.ok(
        Math.abs(layers.y + layers.height / 2 - range.y - range.height / 2) < 1,
        "Range and display options share one row",
      );
      assert.ok(
        combined.height > 200,
        "The compact toolbar gives more height to the graph",
      );
      assert.ok(
        await page.evaluate(() =>
          window.drawChecks.some((s) => s.text === "42.5"),
        ),
        "The time-axis midpoint keeps its half millisecond",
      );
    }
    if (width === 1280) {
      const metrics = await page.locator(".audio-metrics").boundingBox();
      assert.ok(
        metrics.y + metrics.height <= height,
        "Controls, plots and data size fit on desktop",
      );
    }
    assert.equal(await page.locator("#audio-status").innerText(), "");
    const colors = await page.locator("#play-original").evaluate((el) => ({
      background: getComputedStyle(el).backgroundColor,
      color: getComputedStyle(el).color,
    }));
    assert.deepEqual(colors, {
      background: "rgb(24, 55, 79)",
      color: "rgb(255, 255, 255)",
    });
    await resizeWave(page, width);
    await axe(page);
    // A full-quality digitization must not introduce constant hiss in the buffer
    // or through the real browser audio graph, including device-rate conversion.
    await page.locator("#play-original").click();
    await page.waitForFunction(
      () => document.querySelector("#play-original").dataset.playing === "true",
    );
    await page.locator("#stop-audio").click();
    await page.locator("#play-processed").click();
    await page.waitForFunction(
      () =>
        document.querySelector("#play-processed").dataset.playing === "true",
    );
    const quality = await page.evaluate(() => {
      const [reference, processed] = window.audioChecks.rawBuffers;
      let error = 0,
        max = 0,
        tail = 0;
      for (let i = 0; i < reference.length; i++) {
        const delta = processed[i] - reference[i];
        error += delta * delta;
        max = Math.max(max, Math.abs(delta));
        if (i >= 250000) tail = Math.max(tail, Math.abs(processed[i]));
      }
      return { rms: Math.sqrt(error / reference.length), max, tail };
    });
    assert.ok(
      quality.rms < 0.00001 && quality.max < 0.0000154,
      "16-bit error stays within the PCM rounding bound",
    );
    assert.equal(quality.tail, 0, "No added sound in the silent tail");
    if (width === 1280) {
      for (const outputRate of [48000, 44100]) {
        const graph = await page.evaluate(
          (rate) => window.checkPlaybackGraph(rate),
          outputRate,
        );
        assert.ok(
          graph.rms < 0.000006,
          "The rendered audio graph does not add extra noise",
        );
        assert.ok(graph.peak < 0.25, "Playback stays below clipping");
        assert.equal(
          graph.tail,
          0,
          "The rendered graph has no noise during silence",
        );
        console.log(
          `Full-quality Web Audio render at ${outputRate} Hz: RMS error ${graph.rms}, silent tail ${graph.tail}`,
        );
      }
    }
    await page.locator("#stop-audio").click();
    for (const id of ["original", "samples", "quantized", "reconstructed"]) {
      const before = await page
        .locator("#combined-wave")
        .evaluate((el) => el.toDataURL());
      await page.locator("#show-" + id).click();
      const after = await page
        .locator("#combined-wave")
        .evaluate((el) => el.toDataURL());
      assert.notEqual(
        before,
        after,
        `${id} layer changes the actual plotted pixels`,
      );
    }
    await page.locator("#show-reconstructed").click();
    assert.match(
      await page.locator("#combined-wave").getAttribute("aria-label"),
      /座標軸のみ/,
    );
    for (const id of ["original", "samples", "quantized"])
      await page.locator("#show-" + id).click();
    assert.equal(await page.evaluate(() => window.audioChecks.contexts), 1);
    await rate(page, 8000);
    await page.locator("#rate-up").click();
    await ready(page);
    assert.equal(await page.locator("#sample-rate").inputValue(), "8500");
    await page.locator("#rate-down").click();
    await ready(page);
    assert.equal(await page.locator("#sample-rate").inputValue(), "8000");
    await page.locator("#sample-rate").focus();
    await page.keyboard.press("ArrowDown");
    await ready(page);
    assert.equal(await page.locator("#sample-rate").inputValue(), "7500");
    await rate(page, 8000);
    await bits(page, 4);
    assert.equal(await page.locator("#levels").innerText(), "16");
    assert.equal(await page.locator("#pcm-bytes").innerText(), "24,000 バイト");
    await page.locator("#window-size").selectOption("0.0005");
    assert.ok(
      await page.evaluate(
        (w) =>
          window.drawChecks.some(
            (s) => s.text === (w === 1280 ? "42.25" : "40.25"),
          ),
        width,
      ),
      "Quarter-millisecond ticks are not rounded to tenths",
    );
    assert.match(
      await page.locator("#combined-wave").getAttribute("aria-label"),
      /標本点を表示/,
    );
    await page.locator("#window-size").selectOption("6");
    assert.equal(await page.locator("#sample-density").isVisible(), true);
    assert.equal(
      await page.locator("#overview-wave").getAttribute("aria-disabled"),
      "true",
    );
    await page.locator("#window-size").selectOption("0.01");
    const at = await page.locator("#overview-wave").boundingBox();
    if (width < 500)
      await page.touchscreen.tap(at.x + at.width * 0.5, at.y + at.height * 0.5);
    else await page.mouse.click(at.x + at.width * 0.5, at.y + at.height * 0.5);
    assert.ok(
      Math.abs(
        Number(
          await page.locator("#overview-wave").getAttribute("aria-valuenow"),
        ) - 2995,
      ) < 20,
    );
    await page.locator("#overview-wave").focus();
    await page.keyboard.press("End");
    assert.equal(
      await page.locator("#overview-wave").getAttribute("aria-valuenow"),
      "5990",
    );
    await page.keyboard.press("Home");
    await page.keyboard.press("ArrowRight");
    assert.equal(
      await page.locator("#overview-wave").getAttribute("aria-valuenow"),
      "5",
    );
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
    await aliasSetup(page);
    const stairs = await page.evaluate(
      () => window.drawChecks.find((s) => s.color === "#a14908").path,
    );
    assert.ok(
      stairs.length > 20,
      "The graph contains sampled values over multiple periods",
    );
    for (let i = 1; i < stairs.length; i++)
      assert.ok(
        Math.abs(stairs[i][1] - stairs[i - 1][1]) < 1e-8 ||
          Math.abs(stairs[i][2] - stairs[i - 1][2]) < 1e-8,
        "Quantized values form horizontal holds and vertical transitions",
      );
    const layerOrder = await page.evaluate(() =>
      window.drawChecks.map((s) => s.color),
    );
    assert.ok(
      layerOrder.indexOf("#91a5ad") < layerOrder.indexOf("#a14908"),
      "The original curve is underneath the staircase",
    );
    assert.equal(
      await page.locator("#alias-warning").innerText(),
      "※ エイリアシングが発生",
    );
    assert.equal(
      await page
        .locator("#alias-warning")
        .evaluate((el) => el.closest(".sampling-panel") !== null),
      true,
    );
    if (width === 1280) {
      const metrics = await page.locator(".audio-metrics").boundingBox();
      assert.ok(metrics.y + metrics.height <= height);
    }
    await axe(page);
    await page.locator("#play-processed").click();
    await page.waitForFunction(
      () =>
        document.querySelector("#play-processed").dataset.playing === "true",
    );
    assert.ok(
      await page.evaluate(
        () => window.audioChecks.buffers.at(-1).aliasRms < 0.002,
      ),
      "The playback buffer is the folded 500 Hz tone",
    );
    await page.locator("#stop-audio").click();
    await rate(page, 2000);
    assert.match(
      await page.locator("#alias-warning").innerText(),
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
    await rate(page, 2001);
    assert.equal(await page.locator("#alias-warning").innerText(), "");
    // Preserve smooth, arbitrary slider values despite the coarse increment buttons.
    await page.locator("#sample-rate-slider").evaluate((el) => {
      for (const value of [100, 800, 300, 950, 601]) {
        el.value = value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    await ready(page);
    assert.equal(
      await page.locator("#sample-rate").inputValue(),
      String(Math.round(500 * 96 ** 0.601)),
    );
    await rate(page, 7951);
    await page.locator("#rate-up").click();
    await ready(page);
    assert.equal(await page.locator("#sample-rate").inputValue(), "8451");
    await rate(page, 500);
    assert.equal(await page.locator("#rate-down").isDisabled(), true);
    await page.locator("#sample-rate").fill("999999");
    await page.locator("#sample-rate").press("Tab");
    await ready(page);
    assert.equal(await page.locator("#sample-rate").inputValue(), "48000");
    assert.equal(await page.locator("#rate-up").isDisabled(), true);
    await page.locator("#reset-audio").click();
    await ready(page);
    assert.equal(await page.locator("#sound-source").inputValue(), "twinkle");
    assert.equal(await page.locator("#sample-rate").inputValue(), "48000");
    assert.match(await page.locator("#bits").innerText(), /^16/);
    for (const id of ["original", "samples", "quantized"])
      assert.equal(await page.locator("#show-" + id).isChecked(), true);
    assert.equal(await page.locator("#show-reconstructed").isChecked(), false);
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
  await aliasSetup(noAudio);
  assert.match(
    await noAudio.locator("#alias-warning").innerText(),
    /エイリアシング/,
  );
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
  await aliasSetup(offline);
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

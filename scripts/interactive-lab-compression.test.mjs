import test from "node:test";
import assert from "node:assert/strict";
import { Worker as NodeWorker } from "node:worker_threads";
import {
  defaults, formats, flatten, metrics, difference, ratio,
  encodeBmp, decodeBmp, encodePng, decodePng, encodeGif, decodeGif,
  canTarget, matchSize,
} from "../lab/image-compression/model.mjs";
import { sliderPosition, sliderSetting } from "../lab/image-compression/controls.mjs";
import { CompressionPool } from "../lab/image-compression/pool.mjs";

const width = 32, height = 24;
const image = { width, height, data: Uint8ClampedArray.from(
  { length: width * height * 4 }, (_, i) => i % 4 === 3
    ? [0, 64, 128, 255][Math.floor(i / 4) % 4]
    : (Math.floor(i / 4) * 37 + i % 4 * 53) % 256,
) };

async function convert(format, settings = {}) {
  const worker = new NodeWorker(new URL("./fixtures/image-compression-worker.mjs", import.meta.url));
  try {
    return await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`${format} timed out`)), 30_000);
      worker.on("error", (error) => { clearTimeout(timeout); reject(error); });
      worker.on("message", (message) => {
        if (message.type === "ready") {
          worker.postMessage({ format, image, settings: { ...defaults[format], ...settings },
            queuedAt: performance.timeOrigin + performance.now() });
        } else if (message.type === "result" || message.type === "error") {
          clearTimeout(timeout);
          if (message.type === "error") reject(new Error(message.message));
          else resolve(message);
        }
      });
    });
  } finally { await worker.terminate(); }
}

for (const format of formats) {
  test(`production Worker encodes and decodes a real ${format.toUpperCase()} file`, async () => {
    const result = await convert(format);
    assert.ok(result.bytes.length > 20);
    assert.equal(result.pixels.length, image.data.length);
    for (const key of ["waitMs", "setupMs", "encodeMs", "decodeMs"])
      assert.ok(Number.isFinite(result[key]) && result[key] >= 0, key);
    assert.ok(result.encodeMs > 0);
    assert.deepEqual(result.quality, metrics(image.data, result.pixels));
    const head = Buffer.from(result.bytes);
    if (format === "bmp") assert.equal(head.toString("ascii", 0, 2), "BM");
    if (format === "png") assert.deepEqual([...head.subarray(0, 8)], [137,80,78,71,13,10,26,10]);
    if (format === "gif") assert.equal(head.toString("ascii", 0, 3), "GIF");
    if (format === "jpeg") {
      assert.equal(head.readUInt16BE(0), 0xffd8);
      assert.equal(result.quality.alphaMae > 0, true);
    }
    if (format === "webp") {
      assert.equal(head.toString("ascii", 0, 4), "RIFF");
      assert.equal(head.toString("ascii", 8, 12), "WEBP");
    }
    if (format === "avif") assert.equal(head.toString("ascii", 4, 8), "ftyp");
    if (["bmp", "png"].includes(format)) assert.deepEqual(result.pixels, image.data);
  });
}
for (const format of ["webp", "avif"]) {
  test(`${format.toUpperCase()} lossless preserves every RGBA channel, including hidden RGB`, async () => {
    const result = await convert(format, { lossless: true });
    assert.deepEqual(result.pixels, image.data);
    assert.equal(result.quality.psnr, Infinity);
    assert.equal(result.quality.alphaMae, 0);
  });
}

test("BMP 24-bit mattes transparency to white; PNG settings never alter pixels", () => {
  assert.deepEqual(decodeBmp(encodeBmp(image, { alpha: false })).data, flatten(image.data));
  for (const level of [0, 1, 6, 9]) for (const filter of [false, true])
    assert.deepEqual(decodePng(encodePng(image, { level, filter })).data, image.data);
  assert.ok(ratio(encodeBmp(image, { alpha: true }).length, image.data.length) > 100);
});

test("GIF can preserve a small palette but reducing its colors changes pixels", () => {
  const palette = [[255,0,0,255], [0,255,0,255], [0,0,255,255], [255,255,0,255]];
  const sample = { width, height, data: Uint8ClampedArray.from(
    { length: width * height * 4 }, (_, i) => palette[Math.floor(i / 4) % 4][i % 4],
  ) };
  const full = decodeGif(encodeGif(sample, { colors: 4, threshold: 128 }));
  assert.deepEqual(full.data, sample.data);
  const reduced = decodeGif(encodeGif(sample, { colors: 2, threshold: 128 }));
  assert.equal(metrics(sample.data, reduced.data).exact, false);
});

test("PSNR and differences distinguish visible RGB, exact RGBA, and transparency", () => {
  const hiddenA = new Uint8ClampedArray([100,200,50,0]);
  const hiddenB = new Uint8ClampedArray([20,40,60,0]);
  assert.equal(metrics(hiddenA, hiddenB).psnr, Infinity);
  assert.equal(metrics(hiddenA, hiddenB).exact, false);
  assert.equal(metrics(hiddenA, new Uint8ClampedArray([100,200,50,255])).alphaMae, 255);
  assert.deepEqual([...difference(hiddenA, new Uint8ClampedArray([100,200,50,255]))], [255,255,255,255]);
});

test("size matching measures files, retains the nearest trial, and rejects fixed-quality modes", async () => {
  const measurements = [];
  const result = await matchSize("jpeg", defaults.jpeg, 450, async (s) => {
    const bytes = new Uint8Array(100 + s.quality * 10);
    measurements.push(bytes.length);
    return bytes;
  });
  assert.equal(result.bytes.length, 450);
  assert.equal(result.within, true);
  assert.equal(result.attempts, measurements.length);
  for (const format of ["bmp", "png", "webp", "avif"]) {
    assert.equal(canTarget(format, { ...defaults[format], lossless: true }), false);
    await assert.rejects(matchSize(format, { ...defaults[format], lossless: true }, 400, () => {}));
  }
});

test("slider direction round-trips codec values while moving right reduces quality or increases effort", () => {
  for (const [key, min, max] of [["quality",1,100], ["speed",6,10], ["level",0,9], ["method",0,6]])
    for (let value = min; value <= max; value++)
      assert.equal(sliderSetting(key, sliderPosition(key, value, min, max), min, max), value);
  assert.equal(sliderSetting("quality", 100, 1, 100), 1);
  assert.equal(sliderSetting("speed", 10, 6, 10), 6);
});

test("worker pool bounds concurrency, replaces only the selected format, and ignores stale results", () => {
  const workers = [], completed = [], errors = [];
  const prior = globalThis.Worker;
  globalThis.Worker = class {
    constructor() { workers.push(this); }
    postMessage(task) { this.task = task; }
    terminate() { this.terminated = true; }
  };
  const pool = new CompressionPool({ limit: 2, onState() {},
    onResult: (task) => completed.push(task.format), onError: (_, error) => errors.push(error) });
  try {
    for (const format of ["bmp", "png", "jpeg", "avif"]) pool.submit({ format });
    assert.equal(workers.length, 2);
    pool.cancel("png"); pool.pump();
    assert.equal(workers[1].terminated, true);
    assert.equal(workers[2].task.format, "jpeg");
    workers[1].onmessage({ data: { type: "result" } });
    assert.deepEqual(completed, []);
    workers[0].onmessage({ data: { type: "result" } });
    assert.equal(workers[3].task.format, "avif");
    assert.equal(pool.active.size, 2);
    assert.deepEqual(completed, ["bmp"]);
    assert.deepEqual(errors, []);
  } finally { pool.cancelAll(); globalThis.Worker = prior; }
});

import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import {
  aliasFrequency,
  createSignal,
  digitizeAudio,
  DURATION,
  pcmCode,
  pcmSize,
  PLAYBACK_RATE,
  quantizeAudio,
  reconstructAudio,
  referenceAudio,
  sampleAudio,
  samplingStatus,
} from "../lab/digital-audio/pcm.mjs";
import { audioWorkerSource } from "../lab/digital-audio/worker-source.mjs";
const sine = { source: "sine", tone: 1000, sampleRate: 1500, bits: 16 };
function rmsError(values, expected, first = 4800, last = 240000) {
  let sum = 0;
  for (let i = first; i < last; i++)
    sum += (values[i] - expected(i / PLAYBACK_RATE)) ** 2;
  return Math.sqrt(sum / (last - first));
}
test("符号付きPCM: 全ビット数で量子化間隔・上限・コード幅が一致する", () => {
  for (let bits = 1; bits <= 16; bits++) {
    const half = 2 ** (bits - 1),
      delta = 1 / half;
    assert.deepEqual(quantizeAudio(-1, bits), { code: -half, value: -1 });
    assert.deepEqual(quantizeAudio(1, bits), {
      code: half - 1,
      value: 1 - delta,
    });
    for (const input of [-0.95, -0.41, -0.125, 0, 0.17, 0.45, 0.9]) {
      const q = quantizeAudio(input, bits);
      assert.ok(q.code >= -half && q.code < half);
      assert.equal(q.value, q.code * delta);
      const code = pcmCode(q.code, bits);
      assert.equal(code.length, bits);
      const unsigned = parseInt(code, 2),
        signed = unsigned >= half ? unsigned - 2 ** bits : unsigned;
      assert.equal(signed, q.code);
      if (input <= 1 - delta / 2)
        assert.ok(Math.abs(input - q.value) <= delta / 2 + 1e-12);
    }
  }
  assert.equal(pcmCode(-1, 8), "11111111");
  assert.equal(pcmCode(-128, 8), "10000000");
  assert.deepEqual(quantizeAudio(-0.8, 1), { code: -1, value: -1 });
  assert.deepEqual(quantizeAudio(0.8, 1), { code: 0, value: 0 });
});
test("1,000 Hzを1,500 Hzで標本化すると500 Hzの信号と区別できない", () => {
  const sampled = sampleAudio(sine);
  for (let n = 0; n < sampled.raw.length; n += 7)
    assert.ok(
      Math.abs(
        sampled.raw[n] + 0.7 * Math.sin((2 * Math.PI * 500 * n) / 1500),
      ) < 1e-6,
    );
  assert.equal(aliasFrequency(1000, 1500), 500);
  const { processed } = digitizeAudio(sine);
  assert.ok(
    rmsError(processed, (t) => -0.7 * Math.sin(2 * Math.PI * 500 * t)) < 0.002,
  );
  assert.ok(
    rmsError(processed, (t) => 0.7 * Math.sin(2 * Math.PI * 1000 * t)) > 0.5,
  );
});
test("原音の周波数を保つ設定と、整数倍・2倍ちょうどの位相による消失", () => {
  const clear = digitizeAudio({ ...sine, sampleRate: 8000 });
  assert.ok(
    rmsError(clear.processed, (t) => 0.7 * Math.sin(2 * Math.PI * 1000 * t)) <
      0.002,
  );
  for (const sampleRate of [500, 1000, 2000]) {
    const samples = sampleAudio({ ...sine, sampleRate });
    assert.ok(samples.raw.every((v) => Math.abs(v) < 1e-10));
    assert.ok(samples.quantized.every((v) => v === 0));
  }
  assert.equal(aliasFrequency(1000, 2000), 1000);
  assert.equal(aliasFrequency(3900, 1500), 600);
});
test("標本化周波数やビット数を変えても再生の長さ・テンポは変わらない", () => {
  for (const sampleRate of [500, 11025, 44100, 48000]) {
    const result = digitizeAudio({ ...sine, sampleRate, bits: 3 });
    assert.equal(result.raw.length, sampleRate * DURATION);
    assert.equal(result.processed.length, PLAYBACK_RATE * DURATION);
    assert.ok(result.processed.every(Number.isFinite));
  }
});
test("sinc再構成は内部のDC成分と標本位置の値を保つ", () => {
  const dc = reconstructAudio(new Float32Array(3000).fill(0.25), 1500);
  for (let n = 1000; n < dc.length - 1000; n += 113)
    assert.ok(Math.abs(dc[n] - 0.25) < 1e-6);
  const sampled = sampleAudio(sine),
    restored = reconstructAudio(sampled.quantized, 1500);
  for (let n = 20; n < sampled.quantized.length - 20; n += 83)
    assert.ok(Math.abs(restored[n * 32] - sampled.quantized[n]) < 1e-7);
});
test("PCM理論値は秒数・チャンネル数・ビット数に比例し、保存単位は別に扱う", () => {
  assert.deepEqual(pcmSize(8000, 8), {
    samples: 48000,
    bitCount: 384000,
    bytes: 48000,
    packedBytes: 48000,
  });
  assert.equal(pcmSize(48000, 16).bytes, 576000);
  assert.equal(pcmSize(44100, 16, 6, 2).bytes, 1058400);
  assert.deepEqual(pcmSize(1, 1, 1), {
    samples: 1,
    bitCount: 1,
    bytes: 0.125,
    packedBytes: 1,
  });
});
test("ピアノ2音源をブラウザ内で生成し、飽和させず、6秒で演奏を終える", () => {
  const twinkle = referenceAudio({ source: "twinkle" }),
    ode = referenceAudio({ source: "ode" });
  for (const values of [twinkle, ode]) {
    assert.equal(values.length, 288000);
    assert.ok(values.some((v) => Math.abs(v) > 0.1));
    assert.ok(values.every((v) => Number.isFinite(v) && Math.abs(v) < 0.7));
  }
  assert.ok(twinkle.slice(250000).every((v) => v === 0));
  assert.ok(ode.slice(250000).some((v) => Math.abs(v) > 0.01));
  assert.equal(createSignal({ source: "ode" })(6), 0);
  // A low C is present in the chord arrangement, but not in the single melody.
  const amplitude = (values, frequency) => {
    let re = 0,
      im = 0,
      sum = 0;
    for (let i = 960; i < 14400; i++) {
      const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * (i - 960)) / 13440),
        phase = (2 * Math.PI * frequency * i) / 48000;
      re += values[i] * w * Math.cos(phase);
      im += values[i] * w * Math.sin(phase);
      sum += w;
    }
    return (2 * Math.hypot(re, im)) / sum;
  };
  const c3 = 440 * 2 ** ((48 - 69) / 12);
  assert.ok(amplitude(ode, c3) > 0.015);
  assert.ok(amplitude(twinkle, c3) < 0.001);
});
test("和音は旋律の全15音と、最後の保持音の末尾まで含まれる", () => {
  const values = referenceAudio({ source: "ode" });
  const roots = [48, 48, 41, 48, 48, 41, 48, 43, 48, 48, 43, 48, 48, 43, 43];
  const amplitude = (frequency, start, duration) => {
    let re = 0,
      im = 0,
      sum = 0;
    const first = Math.round(start * 48000),
      count = Math.round(duration * 48000);
    for (let n = 0; n < count; n++) {
      const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / count),
        phase = (2 * Math.PI * frequency * (first + n)) / 48000;
      re += values[first + n] * w * Math.cos(phase);
      im += values[first + n] * w * Math.sin(phase);
      sum += w;
    }
    return (2 * Math.hypot(re, im)) / sum;
  };
  for (const [index, midi] of roots.entries())
    assert.ok(
      amplitude(440 * 2 ** ((midi - 69) / 12), index * 0.375 + 0.012, 0.2) >
        0.012,
      `Chord at melody note ${index + 1}`,
    );
  assert.ok(amplitude(440 * 2 ** ((43 - 69) / 12), 5.8, 0.15) > 0.004);
});
test("標本化の注意表示は基音だけでなく曲全体の最高倍音で判定する", () => {
  assert.equal(
    samplingStatus({ ...sine, sampleRate: 1500 }).status,
    "aliasing",
  );
  assert.equal(
    samplingStatus({ ...sine, sampleRate: 2000 }).status,
    "boundary",
  );
  assert.equal(samplingStatus({ ...sine, sampleRate: 2001 }).status, "clear");
  assert.equal(
    samplingStatus({ ...sine, source: "twinkle", sampleRate: 10000 }).status,
    "aliasing",
  );
  assert.equal(
    samplingStatus({ ...sine, source: "twinkle", sampleRate: 10560 }).status,
    "boundary",
  );
  assert.equal(
    samplingStatus({ ...sine, source: "twinkle", sampleRate: 10561 }).status,
    "clear",
  );
  assert.equal(
    samplingStatus({ ...sine, source: "ode", sampleRate: 9000 }).status,
    "aliasing",
  );
  assert.equal(
    samplingStatus({ ...sine, source: "ode", sampleRate: 10000 }).status,
    "clear",
  );
});
test("不正な設定を拒否し、UIとWorkerが同じ計算モデルを使う", () => {
  for (const sampleRate of [499, 48001, 1000.5, NaN])
    assert.throws(() => sampleAudio({ ...sine, sampleRate }), RangeError);
  for (const bits of [0, 17, 2.5])
    assert.throws(() => sampleAudio({ ...sine, bits }), RangeError);
  assert.throws(() => createSignal({ source: "toString" }), RangeError);
  let result;
  const self = {
    postMessage: (message) => {
      result = message;
    },
  };
  vm.runInNewContext(audioWorkerSource, { self });
  self.onmessage({ data: { id: 42, config: sine } });
  assert.equal(result.id, 42);
  const direct = digitizeAudio(sine);
  assert.deepEqual(Array.from(result.processed), Array.from(direct.processed));
  assert.deepEqual(Array.from(result.codes), Array.from(direct.codes));
  self.onmessage({ data: { id: 43, config: { ...sine, bits: 4 } } });
  assert.equal(result.id, 43);
  assert.equal(result.config.bits, 4);
  self.onmessage({ data: { id: 44, config: { ...sine, bits: 99 } } });
  assert.match(result.error, /bit depth/);
  assert.equal(result.id, 44);
});

// A continuous mathematical signal is sampled directly, then quantized as
// signed PCM. Playback uses windowed-sinc reconstruction at a fixed 48 kHz;
// changing the experiment's Fs never changes the tune's tempo or duration.
export const PLAYBACK_RATE = 48000;
export const DURATION = 6;
export const SOURCES = Object.freeze({
  twinkle: "キラキラ星（旋律）",
  ode: "歓喜の歌（和音付き）",
  sine: "純音（実験用）",
});
const partials = [1, 0.32, 0.15, 0.075, 0.035, 0.018];
const partialSum = partials.reduce((a, b) => a + b, 0);
const midiHz = (note) => 440 * 2 ** ((note - 69) / 12);
function score(kind) {
  const beat = kind === "ode" ? 0.375 : 0.32;
  const melody =
    kind === "twinkle"
      ? [
          [72, 1],
          [72, 1],
          [79, 1],
          [79, 1],
          [81, 1],
          [81, 1],
          [79, 2],
          [77, 1],
          [77, 1],
          [76, 1],
          [76, 1],
          [74, 1],
          [74, 1],
          [72, 2],
        ]
      : [
          [76, 1],
          [76, 1],
          [77, 1],
          [79, 1],
          [79, 1],
          [77, 1],
          [76, 1],
          [74, 1],
          [72, 1],
          [72, 1],
          [74, 1],
          [76, 1],
          [76, 1],
          [74, 1],
          [74, 2],
        ];
  let time = 0;
  const notes = melody.map(([note, length]) => {
    const event = {
      start: time,
      duration: length * beat,
      frequency: midiHz(note),
      gain: kind === "twinkle" ? 0.65 : 0.38,
    };
    time += length * beat;
    return event;
  });
  if (kind === "ode") {
    // Re-strike a chord with every melody note so the accompaniment remains
    // audible throughout the phrase, including the held final note.
    const chords = { C: [48, 52, 55], F: [41, 45, 48], G: [43, 47, 50] };
    const harmony = [
      "C",
      "C",
      "F",
      "C",
      "C",
      "F",
      "C",
      "G",
      "C",
      "C",
      "G",
      "C",
      "C",
      "G",
      "G",
    ];
    for (const [index, event] of [...notes].entries())
      for (const note of chords[harmony[index]])
        notes.push({
          start: event.start,
          duration: event.duration,
          frequency: midiHz(note),
          gain: 0.08,
        });
  }
  return notes;
}
export function signalAt(notes, time) {
  let value = 0;
  for (const note of notes) {
    const age = time - note.start;
    if (age < 0 || age >= note.duration) continue;
    const envelope =
      Math.min(1, age / 0.004) * Math.min(1, (note.duration - age) / 0.04);
    for (let h = 1; h <= partials.length; h++)
      value +=
        ((note.gain * envelope * partials[h - 1]) / partialSum) *
        Math.exp(-age * (3 + 0.7 * (h - 1))) *
        Math.sin(2 * Math.PI * note.frequency * h * age);
  }
  return value;
}
export function createSignal({ source = "twinkle", tone = 1000 } = {}) {
  if (
    !Object.hasOwn(SOURCES, source) ||
    !Number.isFinite(tone) ||
    tone < 100 ||
    tone > 4000
  )
    throw new RangeError("Invalid sound source");
  if (source === "sine")
    return (time) => 0.7 * Math.sin(2 * Math.PI * tone * time);
  const notes = score(source);
  return (time) => signalAt(notes, time);
}
export function referenceAudio(config) {
  const signal = createSignal(config);
  return Float32Array.from({ length: PLAYBACK_RATE * DURATION }, (_, i) =>
    signal(i / PLAYBACK_RATE),
  );
}
export function quantizeAudio(value, bits) {
  if (!Number.isInteger(bits) || bits < 1 || bits > 16)
    throw new RangeError("Invalid bit depth");
  const half = 2 ** (bits - 1);
  const code = Math.max(-half, Math.min(half - 1, Math.round(value * half)));
  return { code: code || 0, value: code / half || 0 };
}
export function pcmCode(code, bits) {
  return (code < 0 ? code + 2 ** bits : code).toString(2).padStart(bits, "0");
}
export function aliasFrequency(frequency, sampleRate) {
  return Math.abs(frequency - Math.round(frequency / sampleRate) * sampleRate);
}
// Classification uses the deliberately synthesized tones, not the much smaller
// spectral tails introduced by attack/release envelopes. This is disclosed in UI.
export function samplingStatus(config) {
  createSignal(config);
  const highest =
    config.source === "sine"
      ? config.tone
      : Math.max(...score(config.source).map((note) => note.frequency)) *
        partials.length;
  return {
    highest,
    status:
      config.sampleRate < 2 * highest
        ? "aliasing"
        : config.sampleRate === 2 * highest
          ? "boundary"
          : "clear",
  };
}
export function sampleAudio(config) {
  const { sampleRate, bits } = config;
  if (
    !Number.isInteger(sampleRate) ||
    sampleRate < 500 ||
    sampleRate > PLAYBACK_RATE
  )
    throw new RangeError("Invalid sample rate");
  if (!Number.isInteger(bits) || bits < 1 || bits > 16)
    throw new RangeError("Invalid bit depth");
  const signal = createSignal(config);
  const count = sampleRate * DURATION;
  const raw = new Float32Array(count),
    quantized = new Float32Array(count),
    codes = new Int16Array(count);
  for (let i = 0; i < count; i++) {
    const value = signal(i / sampleRate);
    const q = quantizeAudio(value, bits);
    raw[i] = value;
    quantized[i] = q.value;
    codes[i] = q.code;
  }
  return { raw, quantized, codes };
}
// 32 taps, 1024 fractional phases. The window truncates ideal sinc interpolation;
// it is not an anti-alias filter before sampling. Zero is used beyond the clip.
let sincTable;
function kernels() {
  if (sincTable) return sincTable;
  sincTable = new Float32Array(1024 * 32);
  for (let phase = 0; phase < 1024; phase++) {
    let total = 0;
    for (let tap = 0; tap < 32; tap++) {
      const d = phase / 1024 - (tap - 15);
      const v =
        Math.abs(d) >= 16
          ? 0
          : Math.abs(d) < 1e-12
            ? 1
            : (Math.sin(Math.PI * d) / (Math.PI * d)) *
              (0.5 + 0.5 * Math.cos((Math.PI * d) / 16));
      sincTable[phase * 32 + tap] = v;
      total += v;
    }
    for (let tap = 0; tap < 32; tap++) sincTable[phase * 32 + tap] /= total;
  }
  return sincTable;
}
export function reconstructAudio(
  samples,
  sampleRate,
  outputRate = PLAYBACK_RATE,
) {
  if (sampleRate === outputRate) return samples.slice();
  const table = kernels(),
    result = new Float32Array(
      Math.round((samples.length / sampleRate) * outputRate),
    );
  for (let i = 0; i < result.length; i++) {
    const position = (i * sampleRate) / outputRate;
    let center = Math.floor(position),
      phase = Math.round((position - center) * 1024);
    if (phase === 1024) {
      center++;
      phase = 0;
    }
    let value = 0;
    for (let tap = 0; tap < 32; tap++) {
      const from = center + tap - 15;
      if (from >= 0 && from < samples.length)
        value += samples[from] * table[phase * 32 + tap];
    }
    result[i] = value;
  }
  return result;
}
export function digitizeAudio(config) {
  const sampled = sampleAudio(config);
  return {
    ...sampled,
    processed: reconstructAudio(sampled.quantized, config.sampleRate),
  };
}
export function pcmSize(sampleRate, bits, duration = DURATION, channels = 1) {
  const samples = Math.ceil(sampleRate * duration);
  const bitCount = samples * bits * channels;
  return {
    samples,
    bitCount,
    bytes: bitCount / 8,
    packedBytes: Math.ceil(bitCount / 8),
  };
}

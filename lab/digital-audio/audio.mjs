import {
  DURATION,
  PLAYBACK_RATE,
  aliasFrequency,
  digitizeAudio,
  pcmCode,
  pcmSize,
  referenceAudio,
} from "./pcm.mjs?v=1";
import { audioWorkerSource } from "./worker-source.mjs?v=1";
import { Waveforms } from "./waveform.mjs?v=1";
const $ = (id) => document.getElementById(id),
  fmt = (n) => n.toLocaleString("ja-JP");
const defaults = { source: "twinkle", tone: 1000, sampleRate: 8000, bits: 8 };
let config = { ...defaults },
  data,
  revision = 0,
  flight = false,
  timer,
  worker;
let audioContext,
  gain,
  node,
  playing = null,
  pendingResume = null,
  offset = 0,
  began = 0,
  playToken = 0,
  frame = 0;
const lab = document.querySelector(".audio-lab");
const defaultSpan = window.matchMedia("(max-width: 500px)").matches
  ? 0.002
  : 0.01;
const waves = new Waveforms({
  overview: $("overview-wave"),
  original: $("original-wave"),
  processed: $("processed-wave"),
  onWindow: setWindow,
  onSample: selectSample,
});
waves.span = defaultSpan;
$("window-size").value = String(defaultSpan);
function setWindow(start) {
  waves.start = Math.max(0, Math.min(DURATION - waves.span, start));
  $("wave-position").value = Math.round(
    (waves.start / Math.max(0.0001, DURATION - waves.span)) * 10000,
  );
  $("wave-position").disabled = waves.span === DURATION;
  $("window-label").textContent =
    `${(waves.start * 1000).toFixed(waves.span <= 0.002 ? 1 : 0)}–${((waves.start + waves.span) * 1000).toFixed(waves.span <= 0.002 ? 1 : 0)} ms`;
  $("position-label").textContent = `${waves.start.toFixed(3)} 秒`;
  waves.draw();
}
function selectSample(index) {
  if (!data || lab.getAttribute("aria-busy") === "true") return;
  waves.selected = Math.max(0, Math.min(data.raw.length - 1, index));
  const n = waves.selected,
    c = waves.config;
  $("sample-detail").textContent =
    `${((n / c.sampleRate) * 1000).toFixed(3)} ms：${data.raw[n].toFixed(4)} → ${data.quantized[n].toFixed(4)} ｜ ${data.codes[n]}（${pcmCode(data.codes[n], c.bits)}）`;
  $("sample-prev").disabled = n === 0;
  $("sample-next").disabled = n === data.raw.length - 1;
  waves.draw();
}
function moveSample(delta) {
  if (!data) return;
  const n = Math.max(0, Math.min(data.raw.length - 1, waves.selected + delta)),
    t = n / waves.config.sampleRate;
  if (t < waves.start || t > waves.start + waves.span)
    setWindow(t - waves.span / 2);
  selectSample(n);
}
function displaySettings() {
  const { sampleRate, bits, source, tone } = config;
  $("sound-source").value = source;
  $("tone-control").hidden = source !== "sine";
  $("tone").value = tone;
  $("tone-label").textContent = `${fmt(tone)} Hz`;
  $("sample-rate").value = sampleRate;
  $("sample-rate-slider").value = Math.round(
    (Math.log(sampleRate / 500) / Math.log(96)) * 1000,
  );
  $("sample-interval").textContent = `${(1000 / sampleRate).toFixed(3)} ms`;
  $("bits").innerHTML = `${bits} <small>bit</small>`;
  $("bits-up").disabled = bits === 16;
  $("bits-down").disabled = bits === 1;
  $("levels").textContent = fmt(2 ** bits);
  $("nyquist").textContent = `${fmt(sampleRate / 2)} Hz`;
  const size = pcmSize(sampleRate, bits);
  $("sample-count").textContent = fmt(size.samples);
  $("pcm-size").textContent =
    size.bytes >= 1000000
      ? `${(size.bytes / 1000000).toFixed(2)} MB`
      : `${(size.bytes / 1000).toFixed(1)} kB`;
  $("pcm-size").title = `${fmt(size.bitCount)} bit = ${fmt(size.bytes)} バイト`;
  $("pcm-formula").textContent =
    `${fmt(sampleRate)} Hz × 6秒 × ${bits} bit × 1ch ÷ 8 = ${fmt(size.bytes)} バイト`;
  let notice;
  if (source !== "sine")
    notice =
      "ピアノの音には基音と倍音が含まれます。標本化周波数を下げると、高い成分が折り返して音色が変わります。";
  else if (sampleRate === tone * 2)
    notice = `${fmt(tone)} Hzの2倍ちょうどです。この純音の位相では標本点がすべて0になり、元の波形を復元できません。`;
  else if (sampleRate > tone * 2)
    notice = `純音 ${fmt(tone)} Hz ＜ ナイキスト周波数 ${fmt(sampleRate / 2)} Hz：折り返しは起こりません。`;
  else {
    const alias = aliasFrequency(tone, sampleRate);
    notice = `純音 ${fmt(tone)} Hz → ${fmt(alias)} Hzに折り返します。${alias === 0 ? "この位相では標本点がすべて0になり、音が消えます。" : "標本点だけでは、この低い周波数の波と区別できません。"}`;
  }
  $("alias-notice").textContent = notice;
}
function playbackButtons() {
  const busy = lab.getAttribute("aria-busy") === "true";
  for (const kind of ["original", "processed"]) {
    const button = $("play-" + kind),
      active = playing === kind;
    button.dataset.playing = String(active);
    button.setAttribute("aria-pressed", String(active));
    button.textContent = `${active ? "■" : "▶"} ${kind === "original" ? "原音" : "加工後"}を${active ? "停止" : "再生"}`;
    button.disabled = !data || busy;
  }
  $("stop-audio").disabled = !playing && !pendingResume;
}
function currentOffset() {
  return playing
    ? Math.min(DURATION, offset + audioContext.currentTime - began)
    : offset;
}
function stop(clearResume = true) {
  const at = currentOffset();
  playToken++;
  cancelAnimationFrame(frame);
  if (node) {
    node.onended = null;
    const old = node;
    try {
      old.stop();
      old.disconnect();
    } catch {
      /* Already stopped. */
    }
    node = null;
  }
  playing = null;
  offset = 0;
  waves.playhead = null;
  waves.drawOverview();
  if (clearResume) pendingResume = null;
  $("playback-position").textContent = "0.00 / 6.00 秒";
  playbackButtons();
  return at;
}
async function play(kind, from = 0) {
  if (!data || lab.getAttribute("aria-busy") === "true") return;
  const token = ++playToken;
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio)
      throw new Error(
        "このブラウザでは音声を再生できません。波形の実験は続けられます。",
      );
    if (!audioContext) {
      audioContext = new Audio();
      gain = audioContext.createGain();
      gain.connect(audioContext.destination);
    }
    await audioContext.resume();
    if (token !== playToken || lab.getAttribute("aria-busy") === "true") return;
    if (audioContext.state !== "running")
      throw new Error("再生できませんでした。もう一度再生を押してください。");
    if (node) {
      node.onended = null;
      node.stop();
      node.disconnect();
    }
    const samples = kind === "original" ? data.reference : data.processed;
    const buffer = audioContext.createBuffer(1, samples.length, PLAYBACK_RATE);
    buffer.copyToChannel(samples, 0);
    node = audioContext.createBufferSource();
    node.buffer = buffer;
    node.connect(gain);
    offset = Math.max(0, Math.min(DURATION - 0.001, from));
    began = audioContext.currentTime;
    gain.gain.setValueAtTime(0, began);
    gain.gain.linearRampToValueAtTime(
      Number($("volume").value) / 100,
      began + 0.005,
    );
    playing = kind;
    pendingResume = null;
    node.onended = () => {
      if (token === playToken) {
        stop();
        $("audio-status").textContent = "再生が終わりました。";
      }
    };
    node.start(0, offset);
    $("audio-status").textContent =
      kind === "original" ? "原音を再生中" : "デジタル化後を再生中";
    playbackButtons();
    const tick = () => {
      if (!playing) return;
      const at = currentOffset();
      $("playback-position").textContent = `${at.toFixed(2)} / 6.00 秒`;
      waves.playhead = at;
      waves.drawOverview();
      frame = requestAnimationFrame(tick);
    };
    tick();
  } catch (error) {
    stop();
    $("audio-status").textContent = error.message;
  }
}
function fallback(message) {
  setTimeout(() => {
    try {
      receive({
        ...message,
        ...digitizeAudio(message.config),
        reference: referenceAudio(message.config),
      });
    } catch (error) {
      receive({ id: message.id, error: error.message });
    }
  }, 0);
}
function send() {
  clearTimeout(timer);
  if (flight) return;
  flight = true;
  const message = { id: revision, config: { ...config } };
  if (worker) worker.postMessage(message);
  else fallback(message);
}
function receive(result) {
  flight = false;
  if (result.id !== revision) {
    send();
    return;
  }
  if (result.error) {
    lab.setAttribute("aria-busy", "false");
    data = null;
    pendingResume = null;
    playbackButtons();
    $("audio-status").textContent = `計算できませんでした：${result.error}`;
    return;
  }
  data = result;
  lab.setAttribute("aria-busy", "false");
  waves.setData(data, result.config);
  selectSample(Math.round((waves.start + waves.span / 2) * config.sampleRate));
  $("audio-status").textContent = "原音と加工後を聞き比べられます。";
  playbackButtons();
  if (pendingResume) {
    const resume = pendingResume;
    pendingResume = null;
    void play(resume.kind, resume.from);
  }
}
try {
  const url = URL.createObjectURL(
    new Blob([audioWorkerSource], { type: "text/javascript" }),
  );
  try {
    worker = new Worker(url);
  } finally {
    URL.revokeObjectURL(url);
  }
  worker.onmessage = (event) => receive(event.data);
  worker.onerror = (event) => {
    event.preventDefault();
    worker.terminate();
    worker = null;
    flight = false;
    send();
  };
} catch {
  worker = null;
}
function update({ sourceChanged = false } = {}) {
  const kind = playing,
    at = currentOffset();
  if (kind) {
    stop(false);
    pendingResume = sourceChanged ? null : { kind, from: at };
  }
  if (sourceChanged) {
    stop();
    setWindow(0.04);
  }
  revision++;
  displaySettings();
  lab.setAttribute("aria-busy", "true");
  playbackButtons();
  $("audio-status").textContent = "波形を計算しています…";
  clearTimeout(timer);
  timer = setTimeout(send, 35);
}
$("sound-source").addEventListener("change", () => {
  config.source = $("sound-source").value;
  update({ sourceChanged: true });
});
$("tone").addEventListener("input", () => {
  config.tone = Number($("tone").value);
  update({ sourceChanged: true });
});
$("sample-rate-slider").addEventListener("input", () => {
  config.sampleRate = Math.round(
    500 * 96 ** (Number($("sample-rate-slider").value) / 1000),
  );
  update();
});
$("sample-rate").addEventListener("input", () => {
  if (!$("sample-rate").validity.valid || !$("sample-rate").value) return;
  config.sampleRate = Number($("sample-rate").value);
  update();
});
$("sample-rate").addEventListener("blur", () => {
  const value = Number($("sample-rate").value);
  config.sampleRate =
    Number.isFinite(value) && value
      ? Math.max(500, Math.min(PLAYBACK_RATE, Math.round(value)))
      : config.sampleRate;
  update();
});
for (const delta of [-1, 1])
  $(delta > 0 ? "bits-up" : "bits-down").addEventListener("click", () => {
    config.bits = Math.max(1, Math.min(16, config.bits + delta));
    update();
  });
for (const button of document.querySelectorAll("[data-preset]"))
  button.addEventListener("click", () => {
    const oldSource = config.source;
    if (button.dataset.preset === "clear")
      Object.assign(config, { sampleRate: 48000, bits: 16 });
    if (button.dataset.preset === "quantize")
      Object.assign(config, { sampleRate: 8000, bits: 4 });
    if (button.dataset.preset === "alias")
      Object.assign(config, {
        source: "sine",
        tone: 1000,
        sampleRate: 1500,
        bits: 16,
      });
    waves.span = button.dataset.preset === "alias" ? 0.01 : defaultSpan;
    $("window-size").value = String(waves.span);
    setWindow(0.04);
    update({ sourceChanged: oldSource !== config.source });
  });
$("reset-audio").addEventListener("click", () => {
  stop();
  config = { ...defaults };
  $("volume").value = 35;
  waves.span = defaultSpan;
  $("window-size").value = String(defaultSpan);
  setWindow(0.04);
  update();
});
$("window-size").addEventListener("change", () => {
  const center = waves.start + waves.span / 2;
  waves.span = Number($("window-size").value);
  setWindow(center - waves.span / 2);
});
$("wave-position").addEventListener("input", () =>
  setWindow(
    (Number($("wave-position").value) / 10000) * (DURATION - waves.span),
  ),
);
$("sample-prev").addEventListener("click", () => moveSample(-1));
$("sample-next").addEventListener("click", () => moveSample(1));
for (const kind of ["original", "processed"])
  $("play-" + kind).addEventListener("click", () => {
    if (playing === kind) {
      stop();
      $("audio-status").textContent = "停止しました。";
    } else void play(kind, playing ? currentOffset() : 0);
  });
$("stop-audio").addEventListener("click", () => {
  stop();
  $("audio-status").textContent = "停止しました。";
});
$("volume").addEventListener("input", () => {
  if (gain)
    gain.gain.setTargetAtTime(
      Number($("volume").value) / 100,
      audioContext.currentTime,
      0.01,
    );
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stop();
});
window.addEventListener("pagehide", (event) => {
  stop();
  // Keep resources usable when the browser restores this page from its back cache.
  if (event.persisted) return;
  worker?.terminate();
  waves.observer.disconnect();
  void audioContext?.close();
});
setWindow(0.04);
update();

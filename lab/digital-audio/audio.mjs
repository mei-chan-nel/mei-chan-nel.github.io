import {
  DURATION,
  PLAYBACK_RATE,
  digitizeAudio,
  pcmSize,
  referenceAudio,
  samplingStatus,
} from "./pcm.mjs?v=3";
import { audioWorkerSource } from "./worker-source.mjs?v=3";
import { Waveforms, formatMilliseconds } from "./waveform.mjs?v=4";
import { installCanvasResize } from "../shared/resize.mjs";
const $ = (id) => document.getElementById(id),
  fmt = (n) => n.toLocaleString("ja-JP");
const defaults = { source: "twinkle", tone: 1000, sampleRate: 48000, bits: 16 };
let config = { ...defaults },
  data,
  revision = 0,
  flight = false,
  timer,
  worker;
let audioContext,
  gain,
  voiceGain,
  node,
  playing = null,
  pendingResume = null,
  offset = 0,
  began = 0,
  playToken = 0,
  frame = 0;
const lab = document.querySelector(".audio-lab");
const waveCard = document.querySelector(".wave-card");
installCanvasResize(waveCard);
const defaultSpan = window.matchMedia("(max-width: 500px)").matches
  ? 0.001
  : 0.005;
const waves = new Waveforms({
  overview: $("overview-wave"),
  combined: $("combined-wave"),
  density: $("sample-density"),
  onWindow: setWindow,
});
waves.span = defaultSpan;
$("window-size").value = String(defaultSpan);
function setWindow(start) {
  waves.start = Math.max(0, Math.min(DURATION - waves.span, start));
  $("overview-wave").setAttribute("aria-valuenow", String(waves.start * 1000));
  $("overview-wave").setAttribute(
    "aria-valuemax",
    String((DURATION - waves.span) * 1000),
  );
  $("overview-wave").setAttribute(
    "aria-disabled",
    String(waves.span === DURATION),
  );
  $("window-label").textContent =
    `${formatMilliseconds(waves.start)}–${formatMilliseconds(waves.start + waves.span)} ms`;
  $("overview-wave").setAttribute(
    "aria-valuetext",
    $("window-label").textContent,
  );
  waves.draw();
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
  $("rate-up").disabled = sampleRate === PLAYBACK_RATE;
  $("rate-down").disabled = sampleRate === 500;
  $("bits").innerHTML = `${bits} <small>bit</small>`;
  $("bits-up").disabled = bits === 16;
  $("bits-down").disabled = bits === 1;
  $("levels").textContent = fmt(2 ** bits);
  const size = pcmSize(sampleRate, bits);
  const amount =
    size.bytes >= 1000000
      ? (size.bytes / 1000000).toFixed(2)
      : (size.bytes / 1000).toFixed(1);
  $("pcm-size").innerHTML =
    `<strong>${amount}</strong> <span>${size.bytes >= 1000000 ? "MB" : "kB"}</span>`;
  $("pcm-size").title = `${fmt(size.bitCount)} bit = ${fmt(size.bytes)} バイト`;
  $("pcm-formula").textContent =
    `${fmt(sampleRate)} Hz × 6秒 × ${bits} bit ÷ 8`;
  $("pcm-bytes").textContent = `${fmt(size.bytes)} バイト`;
  const { status } = samplingStatus(config);
  $("alias-warning").textContent =
    status === "aliasing"
      ? "※ エイリアシングが発生"
      : status === "boundary"
        ? "※ 2倍ちょうど（復元できない場合あり）"
        : "";
  $("alias-warning").dataset.status = status;
  $("alias-warning").title =
    source === "sine"
      ? "純音の周波数を基準に判定"
      : "合成する基音・倍音の周波数を基準に判定";
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
function retireVoice(now = audioContext?.currentTime) {
  if (!node) return;
  const old = node,
    oldGain = voiceGain;
  node = null;
  voiceGain = null;
  const disconnect = () => {
    old.disconnect();
    oldGain.disconnect();
  };
  if (audioContext.state !== "running") {
    old.stop();
    disconnect();
    return;
  }
  if (oldGain.gain.cancelAndHoldAtTime) oldGain.gain.cancelAndHoldAtTime(now);
  else {
    const value = oldGain.gain.value;
    oldGain.gain.cancelScheduledValues(now);
    oldGain.gain.setValueAtTime(value, now);
  }
  oldGain.gain.linearRampToValueAtTime(0, now + 0.006);
  old.stop(now + 0.006);
}
function stop(clearResume = true) {
  const at = currentOffset();
  playToken++;
  cancelAnimationFrame(frame);
  retireVoice();
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
      gain.gain.value = Number($("volume").value) / 100;
      gain.connect(audioContext.destination);
    }
    await audioContext.resume();
    if (token !== playToken || lab.getAttribute("aria-busy") === "true") return;
    if (audioContext.state !== "running")
      throw new Error("再生できませんでした。もう一度再生を押してください。");
    cancelAnimationFrame(frame);
    const now = audioContext.currentTime;
    retireVoice(now);
    const samples = kind === "original" ? data.reference : data.processed;
    const buffer = audioContext.createBuffer(1, samples.length, PLAYBACK_RATE);
    buffer.copyToChannel(samples, 0);
    const source = audioContext.createBufferSource(),
      envelope = audioContext.createGain();
    source.buffer = buffer;
    source.connect(envelope);
    envelope.connect(gain);
    offset = Math.max(0, Math.min(DURATION - 0.001, from));
    began = now;
    const end = began + DURATION - offset;
    const ramp = Math.min(0.006, (DURATION - offset) / 2);
    envelope.gain.setValueAtTime(0, began);
    envelope.gain.linearRampToValueAtTime(1, began + ramp);
    envelope.gain.setValueAtTime(1, end - ramp);
    envelope.gain.linearRampToValueAtTime(0, end);
    playing = kind;
    pendingResume = null;
    source.onended = () => {
      // Retired sources still need cleanup after a newer voice has started.
      source.disconnect();
      envelope.disconnect();
      if (node === source && token === playToken) {
        node = null;
        voiceGain = null;
        stop();
        $("audio-status").textContent = "";
      }
    };
    source.start(began, offset);
    node = source;
    voiceGain = envelope;
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
  $("audio-status").textContent = "";
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
  const next =
    Number.isFinite(value) && value
      ? Math.max(500, Math.min(PLAYBACK_RATE, Math.round(value)))
      : config.sampleRate;
  if (next !== config.sampleRate) {
    config.sampleRate = next;
    update();
  } else $("sample-rate").value = config.sampleRate;
});
for (const delta of [-1, 1])
  $(delta > 0 ? "bits-up" : "bits-down").addEventListener("click", () => {
    config.bits = Math.max(1, Math.min(16, config.bits + delta));
    update();
  });
function stepRate(delta) {
  config.sampleRate = Math.max(
    500,
    Math.min(PLAYBACK_RATE, config.sampleRate + delta * 500),
  );
  update();
}
$("rate-up").addEventListener("click", () => stepRate(1));
$("rate-down").addEventListener("click", () => stepRate(-1));
$("sample-rate").addEventListener("keydown", (event) => {
  if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
  event.preventDefault();
  stepRate(event.key === "ArrowUp" ? 1 : -1);
});
$("reset-audio").addEventListener("click", () => {
  stop();
  config = { ...defaults };
  $("volume").value = 35;
  syncVolume();
  waveCard.style.width = waveCard.style.height = "";
  waves.span = defaultSpan;
  $("window-size").value = String(defaultSpan);
  setWindow(0.04);
  for (const input of document.querySelectorAll(".wave-layers input"))
    input.checked = input.id !== "show-reconstructed";
  syncLayers();
  update();
});
function syncLayers() {
  for (const layer of ["original", "samples", "quantized", "reconstructed"])
    waves.layers[layer] = $("show-" + layer).checked;
  waves.draw();
}
for (const input of document.querySelectorAll(".wave-layers input"))
  input.addEventListener("change", syncLayers);
$("window-size").addEventListener("change", () => {
  const center = waves.start + waves.span / 2;
  waves.span = Number($("window-size").value);
  setWindow(center - waves.span / 2);
});
for (const kind of ["original", "processed"])
  $("play-" + kind).addEventListener("click", () => {
    if (playing === kind) {
      stop();
      $("audio-status").textContent = "";
    } else void play(kind, playing ? currentOffset() : 0);
  });
$("stop-audio").addEventListener("click", () => {
  stop();
  $("audio-status").textContent = "";
});
function syncVolume() {
  if (gain)
    gain.gain.setTargetAtTime(
      Number($("volume").value) / 100,
      audioContext.currentTime,
      0.01,
    );
}
$("volume").addEventListener("input", syncVolume);
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

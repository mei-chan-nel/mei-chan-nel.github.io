import {
  resolutions,
  integralImage,
  averagePixels,
  convertPixels,
} from "./pixels.mjs";
const $ = (id) => document.getElementById(id);
const source = $("source-canvas"),
  output = $("output-canvas");
const sourceContext = source.getContext("2d", { willReadFrequently: true });
const outputContext = output.getContext("2d");
const state = {
  mode: "color",
  bits: [8, 8, 8],
  grayBits: 8,
  channel: "rgb",
  index: 6,
};
let integral,
  averages,
  lastSize,
  lastFrame,
  announceTimer,
  imageVersion = 0,
  zoomKind,
  maxResolution = resolutions.length - 1;
const number = (v) => v.toLocaleString("ja-JP");
function makeSample() {
  source.width = source.height = 1024;
  const c = sourceContext,
    w = source.width;
  const gradient = c.createLinearGradient(0, 0, w, w);
  gradient.addColorStop(0, "#052c76");
  gradient.addColorStop(0.32, "#4b96d6");
  gradient.addColorStop(0.62, "#ddb674");
  gradient.addColorStop(1, "#e84963");
  c.fillStyle = gradient;
  c.fillRect(0, 0, w, w);
  for (let y = 0; y < 128; y++) {
    c.fillStyle = `rgb(${Math.round((255 * y) / 127)} ${Math.round((255 * y) / 127)} ${Math.round((255 * y) / 127)})`;
    c.fillRect(0, 768 + y * 2, 1024, 2);
  }
  for (const [x, y, color, radius] of [
    [220, 245, "#e64343", 155],
    [665, 280, "#35ac54", 180],
    [470, 635, "#345bea", 165],
  ]) {
    const g = c.createRadialGradient(x - 45, y - 60, 10, x, y, radius);
    g.addColorStop(0, "#fffef9");
    g.addColorStop(0.25, color);
    g.addColorStop(1, "#102f35");
    c.fillStyle = g;
    c.beginPath();
    c.arc(x, y, radius, 0, Math.PI * 2);
    c.fill();
  }
  c.save();
  c.beginPath();
  c.rect(790, 500, 200, 200);
  c.clip();
  c.strokeStyle = "#fffef9";
  c.lineWidth = 5;
  for (let i = -220; i < 450; i += 12) {
    c.beginPath();
    c.moveTo(790 + i, 500);
    c.lineTo(790 + i + 200, 700);
    c.stroke();
  }
  c.restore();
  $("source-caption").textContent = "サンプル画像 · 1024 × 1024";
  refreshSource();
}
function refreshSource() {
  integral = integralImage(
    sourceContext.getImageData(0, 0, source.width, source.height).data,
    source.width,
    source.height,
  );
  averages = undefined;
  lastSize = undefined;
  const max = resolutions.findLastIndex((n) => n <= source.width);
  maxResolution = max;
  state.index = Math.min(state.index, max);
  schedule();
}
function schedule() {
  if (lastFrame) cancelAnimationFrame(lastFrame);
  lastFrame = requestAnimationFrame(() => {
    lastFrame = undefined;
    render();
  });
}
function syncControls() {
  const gray = state.mode === "gray";
  $("resolution-label").textContent =
    `${resolutions[state.index]} × ${resolutions[state.index]}`;
  $("resolution-down").disabled = state.index === 0;
  $("resolution-up").disabled = state.index === maxResolution;
  $("color-bits").hidden = gray;
  $("gray-bits").hidden = !gray;
  $("channel-control").hidden = gray;
  for (const [key, bits] of [
    ["r", state.bits[0]],
    ["g", state.bits[1]],
    ["b", state.bits[2]],
    ["gray", state.grayBits],
  ]) {
    $("bits-" + key).innerHTML = `${bits} <small>bit</small>`;
    $("bits-" + key + "-down").disabled = bits === 1;
    $("bits-" + key + "-up").disabled = bits === 8;
  }
}
function render() {
  if (!integral) return;
  const size = resolutions[state.index];
  if (size !== lastSize || !averages) {
    averages = averagePixels(integral, size);
    lastSize = size;
  }
  const pixelData = convertPixels(averages, state);
  output.width = output.height = size;
  outputContext.putImageData(new ImageData(pixelData, size, size), 0, 0);
  syncControls();
  const gray = state.mode === "gray";
  const bits = gray ? state.grayBits : state.bits.reduce((a, b) => a + b, 0),
    pixels = size * size,
    bytes = (pixels * bits) / 8;
  $("output-caption").textContent =
    `${size} × ${size}画素 · ${gray ? state.grayBits + "ビット / " + 2 ** state.grayBits + "段階" : "R" + state.bits[0] + "・G" + state.bits[1] + "・B" + state.bits[2] + "ビット"}${!gray && state.channel !== "rgb" ? " · " + state.channel.toUpperCase() + "表示" : ""}`;
  $("metric-pixels").textContent = `${number(pixels)}画素`;
  $("levels-title").textContent = gray ? "明るさの段階数" : "表現できる色数";
  $("metric-levels").textContent =
    `${number(2 ** bits)}${gray ? "段階" : "色"}`;
  $("metric-bits").innerHTML =
    `${bits} bit${gray ? "" : `<small>R ${state.bits[0]} + G ${state.bits[1]} + B ${state.bits[2]}</small>`}`;
  const scaled =
    bytes >= 1048576
      ? `${(bytes / 1048576).toLocaleString("ja-JP", { maximumFractionDigits: 2 })} MiB`
      : bytes >= 1024
        ? `${(bytes / 1024).toLocaleString("ja-JP", { maximumFractionDigits: 2 })} KiB`
        : `${number(bytes)} B`;
  $("metric-size").innerHTML =
    `${scaled}<small>${number(pixels)} × ${bits} ÷ 8 = ${number(bytes)} B</small>`;
  if ($("image-zoom").open) drawZoom();
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => {
    $("image-status").textContent =
      `${size} × ${size}画素、${gray ? "グレースケール" : "カラー"}、1画素${bits}ビット、データ量${number(bytes)}バイト。`;
  }, 250);
}
function adjust(control, step) {
  if (control === "resolution")
    state.index = Math.max(0, Math.min(maxResolution, state.index + step));
  else if (control === "gray")
    state.grayBits = Math.max(1, Math.min(8, state.grayBits + step));
  else {
    const c = "rgb".indexOf(control);
    state.bits[c] = Math.max(1, Math.min(8, state.bits[c] + step));
  }
  syncControls();
  schedule();
}
// A short tap changes one step; holding repeats. Release/cancel/blur always stop.
let stopRepeat = () => {};
for (const button of document.querySelectorAll("button[data-control]")) {
  let timer,
    repeated = false;
  const stop = () => {
    clearTimeout(timer);
    timer = undefined;
  };
  const change = () =>
    adjust(button.dataset.control, Number(button.dataset.step));
  button.addEventListener("click", (event) => {
    if (repeated && event.detail > 0) {
      repeated = false;
      return;
    }
    repeated = false;
    change();
  });
  button.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    stopRepeat();
    repeated = false;
    stopRepeat = stop;
    button.setPointerCapture(event.pointerId);
    const repeat = () => {
      if (button.disabled || document.hidden || !button.getClientRects().length)
        return stop();
      repeated = true;
      change();
      timer = setTimeout(repeat, 110);
    };
    timer = setTimeout(repeat, 400);
  });
  button.addEventListener("pointerup", stop);
  button.addEventListener("pointercancel", stop);
  button.addEventListener("lostpointercapture", stop);
  button.addEventListener("keydown", (event) => {
    if (
      !["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft"].includes(event.key)
    )
      return;
    event.preventDefault();
    adjust(
      button.dataset.control,
      ["ArrowUp", "ArrowRight"].includes(event.key) ? 1 : -1,
    );
  });
}
window.addEventListener("blur", () => stopRepeat());
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopRepeat();
});
for (const radio of document.querySelectorAll('input[name="mode"]'))
  radio.addEventListener("change", () => {
    stopRepeat();
    state.mode = radio.value;
    syncControls();
    schedule();
  });
for (const radio of document.querySelectorAll('input[name="channel"]'))
  radio.addEventListener("change", () => {
    state.channel = radio.value;
    syncControls();
    schedule();
  });
$("reset-settings").onclick = () => {
  stopRepeat();
  Object.assign(state, {
    mode: "color",
    bits: [8, 8, 8],
    grayBits: 8,
    channel: "rgb",
    index: Math.min(6, maxResolution),
  });
  document.querySelector('input[name="mode"][value="color"]').checked = true;
  document.querySelector('input[name="channel"][value="rgb"]').checked = true;
  syncControls();
  schedule();
};
function drawZoom() {
  const canvas = $("zoom-canvas"),
    c = canvas.getContext("2d");
  c.imageSmoothingEnabled = zoomKind === "source";
  c.clearRect(0, 0, 1024, 1024);
  c.drawImage(zoomKind === "source" ? source : output, 0, 0, 1024, 1024);
  canvas.style.imageRendering = zoomKind === "source" ? "auto" : "pixelated";
}
function openZoom(kind) {
  zoomKind = kind;
  $("zoom-title").textContent = kind === "source" ? "元画像" : "デジタル化後";
  drawZoom();
  $("image-zoom").showModal();
}
$("zoom-source").onclick = () => openZoom("source");
$("zoom-output").onclick = () => openZoom("output");
$("close-zoom").onclick = () => $("image-zoom").close();
$("image-zoom").addEventListener("click", (e) => {
  if (e.target !== $("image-zoom")) return;
  const r = e.target.getBoundingClientRect();
  if (
    e.clientX < r.left ||
    e.clientX > r.right ||
    e.clientY < r.top ||
    e.clientY > r.bottom
  )
    e.target.close();
});
$("choose-image").onclick = () => $("image-file").click();
async function loadImage(url, name, version) {
  const image = new Image();
  image.src = url;
  await image.decode();
  if (version !== imageVersion) return;
  const crop = Math.min(image.naturalWidth, image.naturalHeight);
  if (crop < 4) throw new Error("4画素以上の画像を選んでください。");
  const size = Math.min(1024, crop);
  // Decode/draw offscreen first: an invalid source must not clear the current image.
  const staged = document.createElement("canvas");
  staged.width = staged.height = size;
  const c = staged.getContext("2d", { willReadFrequently: true });
  c.fillStyle = "white";
  c.fillRect(0, 0, size, size);
  c.drawImage(
    image,
    (image.naturalWidth - crop) / 2,
    (image.naturalHeight - crop) / 2,
    crop,
    crop,
    0,
    0,
    size,
    size,
  );
  const pixels = c.getImageData(0, 0, size, size);
  source.width = source.height = size;
  sourceContext.putImageData(pixels, 0, 0);
  $("source-caption").textContent =
    `${name} · ${size} × ${size}（中央を正方形に切り出し）`;
  refreshSource();
}
$("image-file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  e.target.value = "";
  const version = ++imageVersion;
  $("image-error").hidden = true;
  if (!file.type.startsWith("image/")) {
    $("image-error").textContent = "画像ファイルを選んでください。";
    $("image-error").hidden = false;
    return;
  }
  const url = URL.createObjectURL(file);
  try {
    await loadImage(url, file.name, version);
  } catch (error) {
    if (version === imageVersion) {
      $("image-error").textContent = error.message.includes("4画素")
        ? error.message
        : "画像を読み込めませんでした。JPEG・PNGなど別の画像を選んでください。";
      $("image-error").hidden = false;
    }
  } finally {
    URL.revokeObjectURL(url);
  }
});
makeSample();
const defaultImage = document.querySelector(".image-lab").dataset.sourceImage;
if (defaultImage)
  loadImage(defaultImage, "元画像", ++imageVersion).catch(() => {
    $("image-error").textContent =
      "元画像を読み込めませんでした。「画像を変更」から選んでください。";
    $("image-error").hidden = false;
  });

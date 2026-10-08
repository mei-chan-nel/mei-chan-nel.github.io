import {
  resolutions,
  quantize,
  grayValue,
  integralImage,
  averagePixels,
  convertPixels,
} from "./pixels.mjs";
const $ = (id) => document.getElementById(id);
const source = $("source-canvas"),
  output = $("output-canvas"),
  selection = $("selection-canvas");
const sourceContext = source.getContext("2d", { willReadFrequently: true });
const outputContext = output.getContext("2d");
const state = {
  mode: "color",
  bits: [8, 8, 8],
  grayBits: 8,
  channel: "rgb",
  index: 6,
  selected: [32, 32],
  touched: false,
};
let integral,
  averages,
  lastSize,
  lastFrame,
  announceTimer,
  imageVersion = 0,
  zoomKind;
const number = (v) => v.toLocaleString("ja-JP");
const options = Array.from(
  { length: 8 },
  (_, i) =>
    `<option value="${i + 1}" ${i === 7 ? "selected" : ""}>${i + 1} bit</option>`,
).join("");
for (const id of ["bits-r", "bits-g", "bits-b", "bits-gray"])
  $(id).innerHTML = options;
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
  $("resolution").max = max;
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
function inspect() {
  const size = resolutions[state.index],
    [x, y] = state.selected,
    p = (y * size + x) * 3;
  const rgb = Array.from(averages.slice(p, p + 3));
  const input = state.mode === "gray" ? [grayValue(...rgb)] : rgb;
  const bitValues = state.mode === "gray" ? [state.grayBits] : state.bits;
  const values = input.map((v, i) => quantize(v, bitValues[i]));
  $("selected-coordinate").textContent = `(${x + 1}, ${y + 1})`;
  $("average-swatch").style.background =
    state.mode === "gray"
      ? `rgb(${input[0]} ${input[0]} ${input[0]})`
      : `rgb(${rgb.join(" ")})`;
  const q = values.map((v) => v.display);
  $("quantized-swatch").style.background =
    state.mode === "gray"
      ? `rgb(${q[0]} ${q[0]} ${q[0]})`
      : `rgb(${q.join(" ")})`;
  $("pixel-values").innerHTML = values
    .map(
      (v, i) =>
        `<tr><th scope="row">${state.mode === "gray" ? "明るさ" : "RGB"[i]}</th><td>${input[i].toFixed(1)}</td><td>${v.code} <small>（0〜${2 ** bitValues[i] - 1}）</small></td><td><code>${v.binary}</code></td><td>${v.display}</td></tr>`,
    )
    .join("");
  const c = selection.getContext("2d");
  c.clearRect(0, 0, 1024, 1024);
  if (state.touched || $("pixel-inspector").open) {
    const cell = 1024 / size,
      px = x * cell,
      py = y * cell;
    c.strokeStyle = "white";
    c.lineWidth = 4;
    c.strokeRect(px, py, cell, cell);
    c.strokeStyle = "#102f35";
    c.lineWidth = 2;
    c.strokeRect(px, py, cell, cell);
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
  state.selected = state.selected.map((v) =>
    Math.min(size - 1, Math.max(0, v)),
  );
  $("resolution").value = state.index;
  $("resolution").setAttribute("aria-valuetext", `${size} × ${size}画素`);
  $("resolution-label").textContent = `${size} × ${size}`;
  $("resolution-down").disabled = state.index === 0;
  $("resolution-up").disabled = state.index === Number($("resolution").max);
  const gray = state.mode === "gray";
  $("color-bits").hidden = gray;
  $("gray-bits").hidden = !gray;
  $("channel-control").hidden = gray;
  $("channel-note").hidden = state.channel === "rgb";
  for (let i = 0; i < 3; i++) $("bits-" + "rgb"[i]).value = state.bits[i];
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
  inspect();
  if ($("image-zoom").open) drawZoom();
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => {
    $("image-status").textContent =
      `${size} × ${size}画素、${gray ? "グレースケール" : "カラー"}、1画素${bits}ビット、データ量${number(bytes)}バイト。`;
  }, 250);
}
function changeResolution(index) {
  const before = resolutions[state.index];
  state.index = Math.max(0, Math.min(Number($("resolution").max), index));
  const after = resolutions[state.index];
  state.selected = state.selected.map((v) =>
    Math.floor(((v + 0.5) * after) / before),
  );
  schedule();
}
$("resolution").addEventListener("input", (e) =>
  changeResolution(Number(e.target.value)),
);
$("resolution-down").onclick = () => changeResolution(state.index - 1);
$("resolution-up").onclick = () => changeResolution(state.index + 1);
for (const radio of document.querySelectorAll('input[name="mode"]'))
  radio.addEventListener("change", () => {
    state.mode = radio.value;
    schedule();
  });
for (let c = 0; c < 3; c++)
  $("bits-" + "rgb"[c]).addEventListener("change", (e) => {
    const bits = Number(e.target.value);
    if ($("link-bits").checked) state.bits.fill(bits);
    else state.bits[c] = bits;
    schedule();
  });
$("link-bits").addEventListener("change", () => {
  if ($("link-bits").checked) {
    state.bits.fill(state.bits[0]);
    schedule();
  }
});
$("bits-gray").addEventListener("change", (e) => {
  state.grayBits = Number(e.target.value);
  schedule();
});
for (const radio of document.querySelectorAll('input[name="channel"]'))
  radio.addEventListener("change", () => {
    state.channel = radio.value;
    schedule();
  });
output.addEventListener("click", (e) => {
  const box = output.getBoundingClientRect(),
    size = resolutions[state.index];
  state.selected = [
    Math.min(size - 1, Math.floor(((e.clientX - box.left) / box.width) * size)),
    Math.min(size - 1, Math.floor(((e.clientY - box.top) / box.height) * size)),
  ];
  state.touched = true;
  $("pixel-inspector").open = true;
  inspect();
});
output.addEventListener("keydown", (e) => {
  const deltas = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  };
  if (!deltas[e.key]) return;
  e.preventDefault();
  const size = resolutions[state.index];
  state.selected = state.selected.map((v, i) =>
    Math.max(0, Math.min(size - 1, v + deltas[e.key][i])),
  );
  state.touched = true;
  $("pixel-inspector").open = true;
  inspect();
});
$("pixel-inspector").addEventListener("toggle", () => {
  if (averages) inspect();
});
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
  state.touched = false;
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

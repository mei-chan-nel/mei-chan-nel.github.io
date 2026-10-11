import {
  resolutions,
  integralImage,
  averagePixels,
  convertPixels,
} from "./pixels.mjs?v=5";
import { renderWorkerSource } from "./render-source.mjs?v=5";
const $ = (id) => document.getElementById(id);
const source = $("source-canvas"),
  output = $("output-canvas");
const sourceContext = source.getContext("2d", { willReadFrequently: true });
const outputContext = output.getContext("2d");
const defaultIndex = resolutions.indexOf(64);
const state = {
  mode: "color",
  bits: [8, 8, 8],
  grayBits: 8,
  channel: "rgb",
  index: defaultIndex,
  slider: Math.round((defaultIndex / (resolutions.length - 1)) * 1000),
};
let integral,
  averages,
  lastSize,
  lastFrame,
  announceTimer,
  imageVersion = 0,
  zoomKind,
  maxResolution = resolutions.length - 1,
  renderedSize = 64,
  sourceVersion = 0,
  renderId = 0,
  busy = false,
  readyVersion = 0,
  pendingSource,
  pendingRender,
  worker;
let workerUrl;
try {
  workerUrl = URL.createObjectURL(
    new Blob([renderWorkerSource], { type: "text/javascript" }),
  );
  worker = new Worker(workerUrl);
  worker.onmessage = ({ data }) => {
    busy = false;
    if (data.type === "ready") {
      readyVersion = data.version;
      if (workerUrl) {
        URL.revokeObjectURL(workerUrl);
        workerUrl = undefined;
      }
    } else if (data.version === sourceVersion && data.id === renderId)
      applyFrame(data);
    pump();
  };
  worker.onerror = (event) => {
    event.preventDefault();
    worker.terminate();
    worker = undefined;
    if (workerUrl) URL.revokeObjectURL(workerUrl);
    integral = integralImage(
      sourceContext.getImageData(0, 0, source.width, source.height).data,
      source.width,
      source.height,
    );
    averages = undefined;
    lastSize = undefined;
    schedule();
  };
} catch {
  if (workerUrl) URL.revokeObjectURL(workerUrl);
}
function pump() {
  if (!worker || busy) return;
  if (pendingSource) {
    busy = true;
    worker.postMessage(pendingSource, [pendingSource.pixels.buffer]);
    pendingSource = undefined;
  } else if (pendingRender && readyVersion === sourceVersion) {
    busy = true;
    worker.postMessage(pendingRender);
    pendingRender = undefined;
  }
}
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
  // Clockwise hue order places each secondary color between its RGB primaries.
  const colors = [
    "#ff0000",
    "#ffff00",
    "#00ff00",
    "#00ffff",
    "#0000ff",
    "#ff00ff",
  ];
  for (const [index, color] of colors.entries()) {
    const angle = (index * Math.PI) / 3 - Math.PI / 2;
    const x = 432 + 248 * Math.cos(angle),
      y = 382 + 248 * Math.sin(angle),
      radius = 108;
    const g = c.createRadialGradient(
      x - radius * 0.28,
      y - radius * 0.35,
      radius * 0.06,
      x,
      y,
      radius,
    );
    g.addColorStop(0, "#fffef9");
    g.addColorStop(0.28, color);
    g.addColorStop(0.62, color);
    g.addColorStop(1, "#000000");
    c.fillStyle = g;
    c.beginPath();
    c.arc(x, y, radius, 0, Math.PI * 2);
    c.fill();
  }
  c.save();
  c.beginPath();
  c.rect(878, 36, 116, 704);
  c.clip();
  c.strokeStyle = "#fffef9";
  c.lineWidth = 5;
  for (let i = -704; i < 116; i += 12) {
    c.beginPath();
    c.moveTo(878 + i, 36);
    c.lineTo(878 + i + 704, 740);
    c.stroke();
  }
  c.restore();
  $("source-caption").textContent = "サンプル画像 · 1024 × 1024";
  refreshSource();
}
function refreshSource() {
  sourceVersion++;
  const pixels = sourceContext.getImageData(
    0,
    0,
    source.width,
    source.height,
  ).data;
  if (worker) {
    pendingSource = {
      type: "source",
      version: sourceVersion,
      pixels,
      width: source.width,
      height: source.height,
    };
    pump();
  } else integral = integralImage(pixels, source.width, source.height);
  averages = undefined;
  lastSize = undefined;
  maxResolution = resolutions.findLastIndex((n) => n <= source.width);
  state.index = Math.min(state.index, maxResolution);
  state.slider = Math.round((state.index / maxResolution) * 1000) || 0;
  syncControls();
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
  $("resolution").value = state.slider;
  $("resolution").disabled = maxResolution === 0;
  $("resolution").setAttribute(
    "aria-valuetext",
    `${resolutions[state.index]} × ${resolutions[state.index]}画素`,
  );
  $("color-bits").hidden = gray;
  $("gray-bits").hidden = !gray;
  $("channel-control").hidden = gray;
  for (const checkbox of document.querySelectorAll('input[name="channel"]'))
    checkbox.checked = state.channel.includes(checkbox.value);
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
  const size = resolutions[state.index];
  const settings = { ...state, bits: [...state.bits] };
  const request = {
    type: "render",
    id: ++renderId,
    version: sourceVersion,
    size,
    settings,
  };
  if (worker) {
    pendingRender = request;
    pump();
    return;
  }
  if (!integral) return;
  if (size !== lastSize || !averages) {
    averages = averagePixels(integral, size);
    lastSize = size;
  }
  applyFrame({ ...request, pixels: convertPixels(averages, settings) });
}
function applyFrame({ size, settings: state, pixels: pixelData }) {
  output.width = output.height = size;
  outputContext.putImageData(new ImageData(pixelData, size, size), 0, 0);
  renderedSize = size;
  drawSourceGrid();
  const gray = state.mode === "gray";
  const bits = gray ? state.grayBits : state.bits.reduce((a, b) => a + b, 0),
    pixels = size * size,
    bytes = (pixels * bits) / 8;
  $("output-caption").textContent =
    `${size} × ${size}画素 · ${gray ? state.grayBits + "ビット / " + 2 ** state.grayBits + "段階" : "R" + state.bits[0] + "・G" + state.bits[1] + "・B" + state.bits[2] + "ビット"}${!gray && state.channel !== "rgb" ? " · " + (state.channel.toUpperCase() || "黒") + "表示" : ""}`;
  $("metric-pixels").textContent = `${number(pixels)}画素`;
  $("levels-title").textContent = gray ? "明るさの段階数" : "表現できる色数";
  $("metric-levels").textContent =
    `${number(2 ** bits)}${gray ? "段階" : "色"}`;
  $("metric-bits").innerHTML = `${bits} bit`;
  const scaled =
    bytes >= 1048576
      ? `${(bytes / 1048576).toLocaleString("ja-JP", { maximumFractionDigits: 2 })} MiB`
      : bytes >= 1024
        ? `${(bytes / 1024).toLocaleString("ja-JP", { maximumFractionDigits: 2 })} KiB`
        : `${number(bytes)} B`;
  $("metric-size").textContent = scaled;
  $("metric-size").title =
    `${number(pixels)} × ${bits} ÷ 8 = ${number(bytes)} B`;
  if ($("image-zoom").open) drawZoom();
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => {
    $("image-status").textContent =
      `${size} × ${size}画素、${gray ? "グレースケール" : "カラー"}、1画素${bits}ビット、データ量${number(bytes)}バイト。`;
  }, 250);
}
function adjust(control, step) {
  if (control === "gray")
    state.grayBits = Math.max(1, Math.min(8, state.grayBits + step));
  else {
    const c = "rgb".indexOf(control);
    state.bits[c] = Math.max(1, Math.min(8, state.bits[c] + step));
  }
  syncControls();
  schedule();
}
$("resolution").addEventListener("input", (event) => {
  state.slider = Number(event.target.value);
  const index = Math.round((state.slider / 1000) * maxResolution);
  if (index !== state.index) {
    state.index = index;
    syncControls();
    schedule();
  }
});
$("resolution").addEventListener("keydown", (event) => {
  const steps = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 };
  if (!(event.key in steps) && !["Home", "End"].includes(event.key)) return;
  event.preventDefault();
  state.index =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? maxResolution
        : Math.max(0, Math.min(maxResolution, state.index + steps[event.key]));
  state.slider = Math.round((state.index / maxResolution) * 1000) || 0;
  syncControls();
  schedule();
});
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
for (const checkbox of document.querySelectorAll('input[name="channel"]'))
  checkbox.addEventListener("change", () => {
    state.channel = Array.from(
      document.querySelectorAll('input[name="channel"]:checked'),
      (input) => input.value,
    ).join("");
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
    index: Math.min(defaultIndex, maxResolution),
    slider:
      Math.round(
        (Math.min(defaultIndex, maxResolution) / maxResolution) * 1000,
      ) || 0,
  });
  document.querySelector('input[name="mode"][value="color"]').checked = true;
  syncControls();
  schedule();
};
function gridLines(context, physicalSize, displaySize) {
  if (!$("show-grid").checked || !renderedSize) return;
  const step = physicalSize / renderedSize;
  const density = Math.min(1, displaySize / renderedSize / 6);
  context.beginPath();
  for (let i = 1; i < renderedSize; i++) {
    const p = i * step;
    context.moveTo(p, 0);
    context.lineTo(p, physicalSize);
    context.moveTo(0, p);
    context.lineTo(physicalSize, p);
  }
  const scale = physicalSize / displaySize;
  context.lineWidth = 1.6 * scale;
  context.strokeStyle = `rgba(255,255,255,${0.38 * density})`;
  context.stroke();
  context.lineWidth = 0.7 * scale;
  context.strokeStyle = `rgba(16,47,53,${0.42 * density})`;
  context.stroke();
}
function drawSourceGrid() {
  const canvas = $("source-grid"),
    box = source.getBoundingClientRect(),
    width = box.width;
  if (!width) return;
  const pixels = Math.max(
    1,
    Math.round(width * Math.min(2, devicePixelRatio || 1)),
  );
  canvas.dataset.cells = renderedSize;
  canvas.width = canvas.height = pixels;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, pixels, pixels);
  gridLines(context, pixels, width);
}
$("show-grid").onchange = () => {
  drawSourceGrid();
  if ($("image-zoom").open) drawZoom();
};
function fitViewport() {
  const lab = document.querySelector(".image-lab"),
    comparison = document.querySelector(".image-comparison");
  const controls = document.querySelector(".image-controls"),
    metrics = document.querySelector(".image-metrics");
  const stacked = matchMedia("(max-width:820px)").matches;
  const chrome = Math.max(
    ...Array.from(
      comparison.querySelectorAll(".image-figure"),
      (figure) =>
        figure.querySelector("figcaption").getBoundingClientRect().height +
        figure.querySelector(".image-caption").getBoundingClientRect().height +
        10,
    ),
  );
  const top = lab.getBoundingClientRect().top + scrollY;
  const available =
    innerHeight -
    top -
    metrics.getBoundingClientRect().height -
    chrome -
    22 -
    (stacked ? controls.getBoundingClientRect().height + 10 : 0);
  const width =
    (comparison.getBoundingClientRect().width - (stacked ? 10 : 14)) / 2;
  const size = Math.round(
    Math.max(stacked ? 112 : 144, Math.min(width, available)),
  );
  const value = `${size}px`;
  if (lab.style.getPropertyValue("--picture-size") !== value)
    lab.style.setProperty("--picture-size", value);
}
new ResizeObserver(drawSourceGrid).observe(source);
let fitFrame;
const fitObserver = new ResizeObserver(() => {
  if (!fitFrame)
    fitFrame = requestAnimationFrame(() => {
      fitFrame = undefined;
      fitViewport();
    });
});
for (const selector of [
  ".image-controls",
  ".image-metrics",
  ".image-comparison",
])
  fitObserver.observe(document.querySelector(selector));
window.addEventListener("resize", fitViewport);
fitViewport();

function drawZoom() {
  const canvas = $("zoom-canvas"),
    c = canvas.getContext("2d");
  c.imageSmoothingEnabled = zoomKind === "source";
  c.clearRect(0, 0, 1024, 1024);
  c.drawImage(zoomKind === "source" ? source : output, 0, 0, 1024, 1024);
  canvas.style.imageRendering = zoomKind === "source" ? "auto" : "pixelated";
  if (zoomKind === "source")
    gridLines(c, 1024, canvas.getBoundingClientRect().width || 600);
}
function openZoom(kind) {
  zoomKind = kind;
  $("zoom-title").textContent = kind === "source" ? "元画像" : "デジタル化後";
  $("image-zoom").showModal();
  drawZoom();
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

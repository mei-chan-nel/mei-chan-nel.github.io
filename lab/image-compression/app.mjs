import {
  formats,
  labels,
  mime,
  defaults,
  bytesLabel,
  ratio,
  canTarget,
} from "./model.mjs";
import { presets, makePreset } from "./presets.mjs";
import { CompressionPool } from "./pool.mjs";
import { sliderPosition, sliderSetting, compressionMode } from "./controls.mjs";
import { initFullscreen } from "./fullscreen.mjs";
const $ = (id) => document.getElementById(id);
const settings = structuredClone(defaults),
  results = new Map(),
  states = new Map(),
  cards = new Map(),
  surfaces = new Map(),
  sequence = {},
  timers = new Map();
let image = null,
  sourceVersion = 0,
  sourceRequest = 0,
  currentPreset = "photo",
  currentFile = null,
  comparisonId = 0,
  comparisonWorker,
  targetRun = null,
  detailFormat = null;
let view = { zoom: 1, x: 0.5, y: 0.5 },
  diffSurface = null;
const limit = Math.max(
  1,
  Math.min(
    3,
    navigator.deviceMemory && navigator.deviceMemory <= 4
      ? 2
      : Math.floor((navigator.hardwareConcurrency || 4) / 2),
  ),
);
const time = (n) => `${n < 10 ? n.toFixed(1) : Math.round(n)} ms`;
const psnr = (n) => (Number.isFinite(n) ? `${n.toFixed(2)} dB` : "∞");
function announce() {
  const ready = formats.filter((f) => results.has(f)).length,
    busy = formats.filter((f) =>
      ["queued", "running", "matching", "pending"].includes(states.get(f)),
    ).length;
  $("run-status").textContent =
    `${ready} / 6 形式が完了${busy ? ` · ${limit}並列で処理中` : ""}`;
  $("cancel-jobs").disabled = busy === 0;
}
function showError(message) {
  $("error").textContent = message;
  $("error").hidden = !message;
}
function inputId(format, key, scope) {
  return `${scope === "detail" ? "detail-" : ""}${format}-${key}`;
}
function outputText(format, key) {
  const value = settings[format][key];
  return key === "quality"
    ? `${labels[format]}品質 ${value}`
    : key === "speed"
      ? `速度 ${value}`
      : String(value);
}
function range(format, key, label, min, max, scope) {
  const id = inputId(format, key, scope);
  const position = sliderPosition(key, settings[format][key], min, max);
  const ends =
    key === "quality"
      ? ["←画質を優先", "サイズを優先 →"]
      : ["level", "method", "speed"].includes(key)
        ? [
            key === "level" ? "←弱い" : "←速い",
            key === "level" ? "強い →" : "じっくり →",
          ]
        : ["←透明にしない", "透明にする範囲を広く →"];
  return `<div class="setting-control"><div class="setting-row"><label for="${id}">${label}</label><input id="${id}" data-key="${key}" type="range" min="${min}" max="${max}" step="1" value="${position}" aria-valuetext="${outputText(format, key)}" /><output for="${id}">${outputText(format, key)}</output></div><div class="range-guide" aria-hidden="true"><span>${ends[0]}</span><span>${ends[1]}</span></div></div>`;
}
function select(format, key, label, options, scope) {
  const id = inputId(format, key, scope);
  return `<div class="setting-row"><label for="${id}">${label}</label><select id="${id}" data-key="${key}">${options.map(([v, t]) => `<option value="${v}"${String(settings[format][key]) === String(v) ? " selected" : ""}>${t}</option>`).join("")}</select></div>`;
}
function controlContainers(format) {
  return [
    cards.get(format),
    detailFormat === format ? $("detail-controls") : null,
  ].filter(Boolean);
}
function bindControls(container, format) {
  container.querySelectorAll("[data-key]").forEach((input) => {
    input.addEventListener("input", () => {
      const key = input.dataset.key;
      settings[format][key] =
        typeof defaults[format][key] === "boolean"
          ? input.value === "true"
          : input.type === "range"
            ? sliderSetting(
                key,
                Number(input.value),
                Number(input.min),
                Number(input.max),
              )
            : Number(input.value);
      syncControls(format);
      clearTimeout(timers.get(format));
      invalidate(format);
      pool.cancel(format);
      pool.pump();
      setState(format, "pending");
      updateComparison();
      timers.set(
        format,
        setTimeout(() => {
          timers.delete(format);
          submit(format);
        }, 250),
      );
    });
    input.addEventListener("change", () => {
      if (timers.has(format)) {
        clearTimeout(timers.get(format));
        timers.delete(format);
        submit(format);
      }
    });
  });
}
const tips = {
  bmp: "非圧縮。24bitは透過を白に、32bitは透明度を保持。",
  png: "可逆。圧縮レベルを変えても画素は変わりません。",
  gif: "LZWは可逆。減色と半透明の変換では情報が失われます。",
  jpeg: "非可逆。写真向き。文字の周りのにじみに注目。透過は白へ。",
  webp: "可逆と非可逆を切り替えて、大きさと画素の一致を確認。",
  avif: "圧縮に時間がかかることも。写真とグラデーションで試そう。",
};
function controls(f, scope = "card") {
  const r = (key, label, min, max) => range(f, key, label, min, max, scope);
  const sel = (key, label, options) => select(f, key, label, options, scope);
  if (f === "bmp")
    return sel("alpha", "画素の保存", [
      [true, "32bit・透過あり"],
      [false, "24bit・白背景"],
    ]);
  if (f === "png")
    return (
      r("level", "圧縮レベル", 0, 9) +
      sel("filter", "行フィルタ", [
        [true, "自動選択"],
        [false, "なし"],
      ])
    );
  if (f === "gif")
    return (
      sel(
        "colors",
        "最大色数",
        [256, 128, 64, 32, 16, 8, 4, 2].map((n) => [n, `${n}色`]),
      ) + r("threshold", "透明のしきい値", 0, 255)
    );
  if (f === "jpeg")
    return (
      r("quality", "圧縮の強さ", 1, 100) +
      sel("chroma", "色差の解像度", [
        [0, "4:4:4"],
        [1, "4:2:2"],
        [2, "4:2:0"],
      ])
    );
  const mode = sel("lossless", "圧縮方式", [
    [false, "非可逆圧縮"],
    [true, "可逆圧縮"],
  ]);
  if (f === "webp")
    return (
      mode +
      r("quality", "圧縮の強さ", 1, 100) +
      r("method", "圧縮の努力量", 0, 6)
    );
  return (
    mode +
    r("quality", "圧縮の強さ", 1, 100) +
    r("speed", "圧縮の努力量", 6, 10) +
    sel("subsample", "色差の解像度", [
      [3, "4:4:4"],
      [1, "4:2:0"],
    ])
  );
}
const metricsMarkup = (includeOriginal = false) => `<dl class="format-metrics">${includeOriginal ? '<div><dt>元画像（非圧縮）</dt><dd data-metric="original">—</dd></div>' : ""}<div><dt>ファイルサイズ</dt><dd data-metric="size">—</dd></div><div><dt>圧縮率</dt><dd data-metric="ratio">—</dd></div><div><dt>圧縮時間</dt><dd data-metric="time">—</dd></div></dl>`;
const settingNotes = {
  bmp: [
    ["画素の保存", "32bitはRGB各8bitと透明度8bitを保存します。24bitは透明部分を白背景に合成し、透明度を省くぶん小さくなります。どちらも非圧縮で、24bitにすると元の透明度は戻せません。"],
  ],
  png: [
    ["圧縮レベル", "0は圧縮せず、1〜9はDEFLATEで圧縮します。右ほど時間をかけて小さくする設定です。画素・画質は変わらず、画像によってサイズの差は小さいこともあります。"],
    ["行フィルタ", "隣り合う画素との差などに置き換えてから圧縮します。「自動選択」は行ごとに適した方法を選び、「なし」は置き換えません。どちらも可逆で、サイズと処理時間に影響します。"],
  ],
  gif: [
    ["最大色数", "2〜256色のパレットで表します。少ないほど小さくなりやすい一方、写真の色やグラデーションに段差が出ます。透明色も1色分を使います。LZW圧縮の前の減色で情報が失われます。"],
    ["透明のしきい値", "元の透明度（0＝透明、255＝不透明）がこの値未満の画素を完全に透明にします。右ほど透明になる範囲が広がります。それ以外は白背景に合成した不透明色となり、半透明は保持できません。"],
  ],
  jpeg: [
    ["圧縮の強さ（JPEG品質）", "右ほど品質の数値が下がり、細かな模様や色の情報を減らして小さくします。輪郭のにじみや四角い模様が出やすくなります。品質100でも可逆にはなりません。"],
    ["色差の解像度", "明るさを保ち、色の細かさを変えます。4:4:4は色を間引かず、4:2:2は横方向、4:2:0は縦横方向を半分にします。間引くと小さくなりやすい一方、色付きの文字や輪郭がにじみやすくなります。"],
  ],
  webp: [
    ["圧縮方式", "可逆は元のRGBA画素を復元でき、非可逆は色の情報を減らして小さくします。どちらも透過に対応します。可逆では「圧縮の強さ」は使いません。"],
    ["圧縮の強さ（WebP品質）", "非可逆でのみ有効です。右ほど品質の数値が下がり、小ささを優先して細部が省かれます。JPEG・AVIFの同じ品質値と、同じ画質になるわけではありません。"],
    ["圧縮の努力量", "右ほど圧縮方法をじっくり探します。処理時間とサイズに影響し、可逆では画素を変えません。非可逆でも、画質を下げるための設定とは異なります。"],
  ],
  avif: [
    ["圧縮方式", "可逆は元のRGBA画素を復元でき、非可逆は情報を減らして小さくします。可逆では品質と色差の間引きを固定するため、その2つの操作は無効になります。透過はどちらも保持します。"],
    ["圧縮の強さ（AVIF品質）", "非可逆でのみ有効です。右ほど品質の数値が下がり、小さくなる一方で細部が失われやすくなります。品質の数値はAVIF固有の尺度です。"],
    ["圧縮の努力量", "左は速度10で速く、右は速度6でじっくり圧縮します。時間をかけると小さくなることがありますが、サイズや画質の変化は画像によります。"],
    ["色差の解像度", "4:4:4は色を間引かず、4:2:0は色の解像度を縦横とも半分にします。4:2:0は小さくなりやすい反面、色付きの文字や輪郭に影響します。可逆では4:4:4に固定されます。"],
  ],
};
function timingAndSettings(f) {
  return `<details class="timing"><summary>時間の内訳・設定の解説</summary><h4>時間の内訳</h4><dl class="timing-values"><dt>待機・Worker起動</dt><dd data-time="waitMs">—</dd><dt>コーデック準備</dt><dd data-time="setupMs">—</dd><dt>圧縮（実測）</dt><dd data-time="encodeMs">—</dd><dt>復号・指標計算</dt><dd data-time="decodeMs">—</dd><dt>全体の経過</dt><dd data-time="totalMs">—</dd></dl><p>待機は処理の順番待ちとWorker起動、準備はコーデックの読込などです。圧縮時間は符号化処理だけを実測します。端末の負荷や初回読込でも変わります。</p><h4>設定の解説</h4><dl class="setting-notes">${settingNotes[f].map(([name, explanation]) => `<div><dt>${name}</dt><dd>${explanation}</dd></div>`).join("")}</dl></details>`;
}
for (const f of formats) {
  const card = document.createElement("article");
  card.className = "format-card";
  card.dataset.format = f;
  card.innerHTML = `<header class="format-heading"><h3>${labels[f]}</h3><span class="format-kind"></span></header><div class="thumbnail checker"><canvas width="512" height="512" aria-label="${labels[f]}の変換結果"></canvas><div class="card-status">元画像を準備中</div></div>${metricsMarkup()}<p class="quality-result">元画像とのPSNR · —</p><fieldset class="format-settings"><legend>${labels[f]}の圧縮設定</legend>${controls(f)}</fieldset><p class="format-tip">${tips[f]}</p><p class="match-result" hidden></p><div class="card-actions"><button type="button" data-compare disabled>比較</button><button type="button" data-retry hidden>再試行</button><a class="download-link" hidden>保存 ↓</a></div>${timingAndSettings(f)}`;
  $("results").append(card);
  cards.set(f, card);
  bindControls(card, f);
  card.querySelector("[data-compare]").addEventListener("click", () => {
    $("compare-b").value = f;
    updateComparison();
    $("detail-heading").scrollIntoView({
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "start",
    });
  });
  card.querySelector("[data-retry]").addEventListener("click", () => submit(f));
  updateMode(f);
}
function updateMode(f) {
  const mode = compressionMode(f, settings[f]);
  for (const container of controlContainers(f)) {
    container.dataset.kind = mode.kind;
    const badge = container.querySelector(".format-kind");
    badge.textContent = mode.label;
    badge.dataset.kind = mode.kind;
    const quality = container.querySelector('[data-key="quality"]');
    if (quality) quality.disabled = !!settings[f].lossless;
    const subsample = container.querySelector('[data-key="subsample"]');
    if (subsample) subsample.disabled = !!settings[f].lossless;
  }
}
function renderDetailControls(f) {
  if (detailFormat !== f) {
    detailFormat = f;
    const panel = $("detail-controls");
    panel.dataset.format = f;
    panel.innerHTML = `<header class="format-heading"><h3>${labels[f]}の設定</h3><span class="format-kind"></span></header>${metricsMarkup(true)}<fieldset class="format-settings"><legend>${labels[f]}の圧縮設定</legend>${controls(f, "detail")}</fieldset><p class="format-tip">${tips[f]}</p><p class="detail-status" role="status"></p><div class="detail-retry"><button type="button" data-retry hidden>再試行</button></div>${timingAndSettings(f)}`;
    bindControls(panel, f);
    panel
      .querySelector("[data-retry]")
      .addEventListener("click", () => submit(f));
    syncControls(f);
  }
  updateDetailState(f);
}
function updateDetailState(f) {
  if (detailFormat !== f) return;
  const panel = $("detail-controls"),
    card = cards.get(f),
    done = states.get(f) === "done";
  const originalSize = panel.querySelector('[data-metric="original"]');
  originalSize.textContent = image ? bytesLabel(image.data.length) : "—";
  originalSize.title = image
    ? `${image.width} × ${image.height} px × RGBA 4バイト = ${image.data.length.toLocaleString()} B（圧縮率の基準）`
    : "圧縮率の基準となる非圧縮のRGBA画素データ量";
  for (const metric of ["size", "ratio", "time"])
    panel.querySelector(`[data-metric="${metric}"]`).textContent =
      card.querySelector(`[data-metric="${metric}"]`).textContent;
  for (const value of panel.querySelectorAll("[data-time]"))
    value.textContent = card.querySelector(`[data-time="${value.dataset.time}"]`).textContent;
  panel.querySelector(".detail-status").hidden = done;
  panel.querySelector(".detail-status").textContent =
    card.querySelector(".card-status").textContent;
  panel.querySelector("[data-retry]").hidden = states.get(f) !== "error";
}
function invalidate(f) {
  const result = results.get(f);
  if (result) URL.revokeObjectURL(result.url);
  results.delete(f);
  surfaces.delete(f);
  const card = cards.get(f);
  card.querySelectorAll("[data-compare]").forEach((b) => (b.disabled = true));
  card.querySelector(".download-link").hidden = true;
  card.querySelector(".quality-result").textContent = "元画像とのPSNR · —";
  card
    .querySelectorAll("[data-metric],[data-time]")
    .forEach((e) => (e.textContent = "—"));
  card.querySelector(".match-result").hidden = true;
  card.querySelector("[data-retry]").hidden = true;
}
function setState(f, state, progress) {
  states.set(f, state);
  const card = cards.get(f);
  card.setAttribute(
    "aria-busy",
    String(["queued", "running", "pending", "matching"].includes(state)),
  );
  const status = card.querySelector(".card-status");
  status.hidden = state === "done";
  if (state !== "error")
    status.textContent =
      state === "queued"
        ? "順番を待っています…"
        : state === "pending"
          ? "設定を変更中…"
          : state === "matching"
            ? `サイズ調整中 · ${progress.attempts}回試行`
            : "圧縮・復号しています…";
  updateDetailState(f);
  announce();
}
function finishTarget(f, result) {
  if (!targetRun?.pending.has(f)) return;
  targetRun.pending.delete(f);
  if (result?.match?.within) targetRun.within++;
  if (!result) targetRun.failed++;
  if (!targetRun.pending.size) {
    $("target-status").textContent =
      `サイズ調整が完了。${targetRun.count}形式中${targetRun.within}形式が目標の±10%以内${targetRun.failed ? `、${targetRun.failed}形式は中止またはエラー` : ""}。届かなかった形式は最も近い試行を表示しています。BMP・PNG・可逆モードは画質によるサイズ調整の対象外です。`;
    targetRun = null;
  }
}
const pool = new CompressionPool({
  limit,
  onState: setState,
  onResult: (task, result) => {
    const f = task.format;
    if (task.sourceVersion !== sourceVersion || task.request !== sequence[f])
      return;
    result.url = URL.createObjectURL(
      new Blob([result.bytes], { type: mime[f] }),
    );
    results.set(f, result);
    surfaces.set(f, makeSurface(result.pixels));
    const card = cards.get(f);
    drawThumbnail(card.querySelector("canvas"), result.pixels);
    card.querySelector('[data-metric="size"]').textContent = bytesLabel(
      result.bytes.length,
    );
    card.querySelector('[data-metric="size"]').title =
      `${result.bytes.length.toLocaleString()} B`;
    card.querySelector('[data-metric="ratio"]').textContent =
      `${ratio(result.bytes.length, image.data.length).toFixed(1)}%`;
    card.querySelector('[data-metric="time"]').textContent = time(
      result.encodeMs,
    );
    card.querySelector(".quality-result").textContent =
      `PSNR ${psnr(result.quality.psnr)} · ${result.quality.exact ? "画素が完全一致" : `α誤差 ${result.quality.alphaMae.toFixed(2)}`}`;
    for (const key of ["waitMs", "setupMs", "encodeMs", "decodeMs", "totalMs"])
      card.querySelector(`[data-time="${key}"]`).textContent = time(
        result[key],
      );
    const link = card.querySelector(".download-link");
    link.href = result.url;
    link.download = `study-atlas-${f}.${f === "jpeg" ? "jpg" : f}`;
    link.hidden = false;
    card
      .querySelectorAll("[data-compare]")
      .forEach((b) => (b.disabled = false));
    if (result.match) {
      Object.assign(settings[f], result.settings);
      syncControls(f);
      const m = result.match,
        e = card.querySelector(".match-result");
      e.hidden = false;
      e.textContent = `${m.within ? "目標±10%以内" : "目標に未達（最も近い試行）"} · ${m.attempts}回 · ${(100 * (result.bytes.length / m.target - 1)).toFixed(1)}%${m.target < m.minSize ? " · 最小の試行サイズを下回る目標" : m.target > m.maxSize ? " · 最大の試行サイズを上回る目標" : ""}`;
    }
    setState(f, "done");
    finishTarget(f, result);
    updateComparison();
  },
  onError: (task, message) => {
    if (
      task.sourceVersion !== sourceVersion ||
      task.request !== sequence[task.format]
    )
      return;
    const card = cards.get(task.format);
    card.querySelector(".card-status").textContent = message;
    card.querySelector("[data-retry]").hidden = false;
    setState(task.format, "error");
    finishTarget(task.format, null);
    updateComparison();
  },
});
function submit(f, target = null) {
  if (!image) return;
  if (!target) finishTarget(f, null);
  clearTimeout(timers.get(f));
  timers.delete(f);
  invalidate(f);
  pool.submit({
    format: f,
    image,
    settings: { ...settings[f] },
    sourceVersion,
    request: (sequence[f] = (sequence[f] || 0) + 1),
    target,
  });
  updateComparison();
}
function syncControls(f) {
  for (const container of controlContainers(f))
    container.querySelectorAll("[data-key]").forEach((input) => {
      const key = input.dataset.key;
      input.value = String(
        input.type === "range"
          ? sliderPosition(
              key,
              settings[f][key],
              Number(input.min),
              Number(input.max),
            )
          : settings[f][key],
      );
      if (input.nextElementSibling?.tagName === "OUTPUT")
        input.nextElementSibling.value = outputText(f, key);
      if (input.type === "range")
        input.setAttribute("aria-valuetext", outputText(f, key));
    });
  updateMode(f);
}
function makeSurface(data) {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  canvas
    .getContext("2d")
    .putImageData(
      new ImageData(new Uint8ClampedArray(data), image.width, image.height),
      0,
      0,
    );
  return canvas;
}
function drawThumbnail(canvas, data) {
  canvas.width = image.width;
  canvas.height = image.height;
  canvas
    .getContext("2d")
    .putImageData(
      new ImageData(new Uint8ClampedArray(data), image.width, image.height),
      0,
      0,
    );
}
function stopAll() {
  targetRun = null;
  pool.cancelAll();
  for (const timer of timers.values()) clearTimeout(timer);
  timers.clear();
  for (const f of formats)
    if (["queued", "pending", "running", "matching"].includes(states.get(f))) {
      sequence[f] = (sequence[f] || 0) + 1;
      cards.get(f).querySelector(".card-status").textContent =
        "処理を中止しました";
      cards.get(f).querySelector("[data-retry]").hidden = false;
      setState(f, "error");
    }
}
async function loadSource(file = null, preset = currentPreset) {
  const request = ++sourceRequest;
  showError("");
  try {
    const max = Number($("max-edge").value);
    let next,
      name,
      dimensions = "";
    if (file) {
      if (file.size > 20e6)
        throw new Error("20 MB以下の画像を選んでください。");
      if (
        !/^image\/(png|jpeg|webp|gif|bmp|avif|x-ms-bmp)$/.test(file.type) &&
        !/\.(png|jpe?g|webp|gif|bmp|avif)$/i.test(file.name)
      )
        throw new Error(
          "PNG・JPEG・WebP・GIF・BMP・AVIFの画像を選んでください。",
        );
      let bitmap;
      try {
        bitmap = await createImageBitmap(file);
      } catch {
        throw new Error(
          "画像を読み込めません。このブラウザで開ける画像を選んでください。",
        );
      }
      try {
        if (bitmap.width * bitmap.height > 40e6)
          throw new Error("4,000万画素以下の画像を選んでください。");
        const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height)),
          w = Math.max(1, Math.round(bitmap.width * scale)),
          h = Math.max(1, Math.round(bitmap.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d", {
          willReadFrequently: true,
          colorSpace: "srgb",
        });
        ctx.drawImage(bitmap, 0, 0, w, h);
        next = ctx.getImageData(0, 0, w, h);
        dimensions = `読込 ${bitmap.width}×${bitmap.height} → `;
      } finally {
        bitmap.close();
      }
      name = file.name;
    } else {
      next = await makePreset(
        preset,
        preset === "photo" ? Math.min(max, 512) : max,
      );
      name = presets.find((p) => p[0] === preset)[1];
    }
    if (request !== sourceRequest) return;
    stopAll();
    sourceVersion++;
    image = { width: next.width, height: next.height, data: next.data };
    currentFile = file;
    currentPreset = preset;
    for (const f of formats) invalidate(f);
    surfaces.clear();
    surfaces.set("original", makeSurface(image.data));
    drawThumbnail($("source-preview"), image.data);
    view = { zoom: 1, x: 0.5, y: 0.5 };
    diffSurface = null;
    $("source-meta").textContent =
      `${name} · ${dimensions}${image.width} × ${image.height} px · 共通の非圧縮データ ${bytesLabel(image.data.length)}（${image.data.length.toLocaleString()} B）`;
    $("experiment-hint").textContent = file
      ? "読み込んだ画像は端末内だけで処理。気になる部分を拡大して、画質とサイズを比べよう。"
      : presets.find((p) => p[0] === preset)[2];
    $("presets")
      .querySelectorAll("button")
      .forEach((b) =>
        b.setAttribute(
          "aria-pressed",
          String(!file && b.dataset.preset === preset),
        ),
      );
    for (const f of formats) submit(f);
    $("match-size").disabled = false;
    $("target-status").textContent =
      "JPEG・GIF・非可逆モードのWebP / AVIFが対象。BMPは固定長、PNGと可逆モードは画質を変えてサイズを合わせられません。";
  } catch (error) {
    if (request === sourceRequest) showError(error.message);
  }
}
for (const [id, name] of presets) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = name;
  b.dataset.preset = id;
  b.setAttribute("aria-pressed", String(id === currentPreset));
  b.addEventListener("click", () => loadSource(null, id));
  $("presets").append(b);
}
$("image-input").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) loadSource(file);
  e.target.value = "";
});
$("max-edge").addEventListener("change", () => loadSource(currentFile));
$("reset").addEventListener("click", () => {
  for (const f of formats) {
    settings[f] = { ...defaults[f] };
    syncControls(f);
    submit(f);
  }
  view = { zoom: 1, x: 0.5, y: 0.5 };
  drawViews();
});
for (const event of ["dragenter", "dragover"])
  $("drop-zone").addEventListener(event, (e) => {
    e.preventDefault();
    $("drop-zone").classList.add("is-dragging");
  });
$("drop-zone").addEventListener("dragleave", (e) => {
  if (!$("drop-zone").contains(e.relatedTarget))
    $("drop-zone").classList.remove("is-dragging");
});
$("drop-zone").addEventListener("drop", (e) => {
  e.preventDefault();
  $("drop-zone").classList.remove("is-dragging");
  const file = e.dataTransfer.files[0];
  if (file) loadSource(file);
});
$("compare-b").replaceChildren(
  ...formats.map((f) => {
    const option = document.createElement("option");
    option.value = f;
    option.textContent = labels[f];
    return option;
  }),
);
$("compare-b").value = "jpeg";
$("compare-b").addEventListener("change", updateComparison);
renderDetailControls("jpeg");
function settingSummary(f) {
  const s = results.get(f)?.settings;
  if (!s) return "";
  if (f === "png") return `レベル ${s.level}`;
  if (f === "gif") return `最大${s.colors}色`;
  if (f === "bmp") return s.alpha ? "32bit" : "24bit";
  return s.lossless ? "可逆" : `品質 ${s.quality}`;
}
function updateComparison() {
  const id = ++comparisonId;
  diffSurface = null;
  const b = $("compare-b").value;
  renderDetailControls(b);
  $("caption-a").textContent = "元画像";
  $("caption-b").textContent =
    `${labels[b]}${settingSummary(b) ? ` · ${settingSummary(b)}` : ""}${surfaces.has(b) ? "" : " · 結果を待っています"}`;
  $("diff-figure").hidden = !$("show-diff").checked;
  $("comparison-grid").classList.toggle(
    "has-difference",
    $("show-diff").checked,
  );
  drawViews();
  const ap = image?.data,
    bp = results.get(b)?.pixels;
  if (!ap || !bp || !$("show-diff").checked) return;
  try {
    if (!comparisonWorker) {
      comparisonWorker = new Worker(
        new URL("./comparison-worker.mjs", import.meta.url),
        { type: "module" },
      );
      comparisonWorker.onmessage = ({ data }) => {
        if (data.id !== comparisonId) return;
        if (data.pixels) {
          diffSurface = makeSurface(data.pixels);
          drawViews();
        }
      };
      comparisonWorker.onerror = () => {
        showError("差分を計算できません。ページを再読み込みしてください。");
      };
    }
    comparisonWorker.postMessage({
      id,
      a: ap,
      b: bp,
      gain: Number($("diff-gain").value),
      diff: $("show-diff").checked,
    });
  } catch {
    showError("差分表示用Workerを開始できません。");
  }
}
const views = [$("view-a"), $("view-b"), $("view-diff")];
function drawViews() {
  $("zoom").value = view.zoom;
  $("zoom-value").textContent =
    view.zoom === 1 ? "全体" : `${view.zoom.toFixed(2)}倍`;
  views.forEach((canvas, i) => {
    if (i === 2 && $("diff-figure").hidden) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.min(devicePixelRatio || 1, 2),
      w = Math.round(rect.width * dpr),
      h = Math.round(rect.height * dpr);
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, w, h);
    const source =
      i === 2
        ? diffSurface
        : surfaces.get(i === 0 ? "original" : $("compare-b").value);
    if (!source) return;
    const scale = Math.min(w / source.width, h / source.height) * view.zoom;
    ctx.imageSmoothingEnabled = view.zoom < 2;
    ctx.drawImage(
      source,
      w / 2 - view.x * source.width * scale,
      h / 2 - view.y * source.height * scale,
      source.width * scale,
      source.height * scale,
    );
  });
}
function zoomTo(value) {
  view.zoom = Math.max(1, Math.min(16, value));
  if (view.zoom === 1) {
    view.x = 0.5;
    view.y = 0.5;
  }
  drawViews();
}
for (const canvas of views) {
  const pointers = new Map();
  let previousPinch = 0;
  canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    canvas.focus({ preventScroll: true });
    if (pointers.size === 2) {
      const p = [...pointers.values()];
      previousPinch = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
    }
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId) || !image) return;
    const prev = pointers.get(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const p = [...pointers.values()],
        distance = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      if (previousPinch > 0) zoomTo((view.zoom * distance) / previousPinch);
      previousPinch = distance;
      return;
    }
    const rect = canvas.getBoundingClientRect(),
      scale =
        Math.min(rect.width / image.width, rect.height / image.height) *
        view.zoom;
    view.x = Math.max(
      0,
      Math.min(1, view.x - (e.clientX - prev.x) / scale / image.width),
    );
    view.y = Math.max(
      0,
      Math.min(1, view.y - (e.clientY - prev.y) / scale / image.height),
    );
    drawViews();
  });
  const release = (e) => {
    pointers.delete(e.pointerId);
    previousPinch = 0;
  };
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);
  canvas.addEventListener("lostpointercapture", release);
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      zoomTo(view.zoom * Math.exp(-e.deltaY * 0.002));
    },
    { passive: false },
  );
  canvas.addEventListener("keydown", (e) => {
    if (
      [
        "+",
        "=",
        "-",
        "Home",
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
      ].includes(e.key)
    ) {
      e.preventDefault();
      if (e.key === "+" || e.key === "=") zoomTo(view.zoom * 1.25);
      else if (e.key === "-") zoomTo(view.zoom / 1.25);
      else if (e.key === "Home") {
        view = { zoom: 1, x: 0.5, y: 0.5 };
        drawViews();
      } else {
        const step = 0.08 / view.zoom;
        if (e.key === "ArrowLeft") view.x -= step;
        if (e.key === "ArrowRight") view.x += step;
        if (e.key === "ArrowUp") view.y -= step;
        if (e.key === "ArrowDown") view.y += step;
        view.x = Math.max(0, Math.min(1, view.x));
        view.y = Math.max(0, Math.min(1, view.y));
        drawViews();
      }
    }
  });
}
$("zoom").addEventListener("input", (e) => zoomTo(Number(e.target.value)));
initFullscreen({
  panel: $("comparison-workspace"),
  button: $("fullscreen-toggle"),
  redraw: drawViews,
  onEnter: () => {
    $("detail-controls").scrollTop = 0;
  },
});
$("show-diff").addEventListener("change", updateComparison);
$("diff-gain").addEventListener("change", updateComparison);
const comparisonResize = new ResizeObserver(drawViews);
comparisonResize.observe($("comparison-workspace"));
views.forEach((canvas) => comparisonResize.observe(canvas));
$("match-size").addEventListener("click", () => {
  const target = Number($("target-kb").value) * 1000;
  if (!Number.isFinite(target) || target < 100 || target > 1e7) {
    $("target-kb").reportValidity();
    $("target-status").textContent = "目標は0.1〜10,000 kBで指定してください。";
    return;
  }
  const eligible = formats.filter((f) => canTarget(f, settings[f]));
  targetRun = {
    pending: new Set(eligible),
    count: eligible.length,
    within: 0,
    failed: 0,
  };
  $("target-status").textContent =
    `${eligible.map((f) => labels[f]).join("・")}を実測して調整中。結果カードに達成状況を表示します。BMP・PNG・可逆モードは設定を保持します。`;
  for (const f of eligible) submit(f, target);
});
$("cancel-jobs").addEventListener("click", () => {
  stopAll();
  $("target-status").textContent =
    "実行中と待機中の変換を中止しました。完了した結果は比較・保存できます。";
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted) return;
  pool.cancelAll();
  comparisonWorker?.terminate();
  for (const r of results.values()) URL.revokeObjectURL(r.url);
});
if (!window.Worker || !window.WebAssembly) {
  showError(
    "この教材にはWeb WorkerとWebAssemblyに対応したブラウザが必要です。",
  );
  $("match-size").disabled = true;
} else loadSource();

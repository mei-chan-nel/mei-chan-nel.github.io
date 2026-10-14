import { STAGES, STAGE_ZOOMS, clamp, stageAt, prepareMap, verifySourceText, fitCamera, project, unproject,
  viewBounds, zoomAbout, labelCandidates, placeLabels, historyRecords, rateColor, colorRate, heatField, coastContours, labelPresentation, surroundingQuestions, placeQuestionCards } from "./map-model.mjs?v=3";

import { loadQuestionStats } from "./question-stats.mjs?v=2";

const $ = selector => document.querySelector(selector);
const viewport = $("#map-viewport"), canvas = $("#map-canvas"), context = canvas.getContext("2d");
const labelLayer = $("#map-labels"), cardLayer = $("#map-cards"), status = $("#map-status");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const dataRoot = new URL("../../info1-quiz-app/data/questions/", location.href);
const state = { model: null, records: new Map(), width: 0, height: 0, fitScale: 1,
  camera: null, target: null, stage: -1, selected: null, heat: null, terrain: null, scoreSource: "personal", personalRecords: new Map(), globalRecords: null, globalRequest: null, globalError: "", personalUnavailable: false,
  labels: new Map(), labelMemory: new Map(), labelNodes: new Map(), cardNodes: new Map(), cardMeasurements: new Map(), frame: 0,
  lastLayout: 0, summaryTimer: 0, pointers: new Map(), gesture: null, inertia: null };

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

async function load() {
  status.hidden = false;
  status.textContent = "問題の地図を読み込んでいます…";
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 20000);
  try {
    const files = ["completed_questions.json", "map_points.json", "map_terms.json", "map_metadata.json"];
    let questionSource;
    const data = await Promise.all(files.map(async file => {
      const response = await fetch(new URL(file, dataRoot), { cache: "no-cache", signal: controller.signal });
      if (!response.ok) throw new Error(`${file} を読み込めません（HTTP ${response.status}）。`);
      const text = await response.text();
      if (file === "completed_questions.json") questionSource = text;
      return JSON.parse(text);
    }));
    const model = prepareMap(...data);
    if (await verifySourceText(questionSource, model.metadata.source_sha256) === false) {
      throw new Error("問題の本文が地図生成時から更新されています。地図データの更新後に再読み込みしてください。");
    }
    state.model = model;
    buildTerrain();
    resize(true);
    updateHistory();
    status.hidden = true;
    requestDraw(true);
  } catch (error) {
    controller.abort();
    status.replaceChildren(element("p", "", "地図を読み込めませんでした。"),
      element("p", "", error.name === "AbortError" ? "通信がタイムアウトしました。接続を確認して再読み込みしてください。" : error.message));
    const retry = element("button", "", "再読み込み");
    retry.type = "button"; retry.addEventListener("click", load); status.append(retry);
  } finally { clearTimeout(timer); }
}

function resize(reset = false) {
  state.width = viewport.clientWidth; state.height = viewport.clientHeight;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(state.width * dpr); canvas.height = Math.round(state.height * dpr);
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (!state.model || !state.width || !state.height) return;
  const fit = fitCamera(state.terrain.bounds, state.width, state.height);
  const oldFit = state.fitScale; state.fitScale = fit.scale;
  if (reset || !state.camera) state.camera = { ...fit };
  else if (oldFit !== state.fitScale) state.camera.scale *= state.fitScale / oldFit;
  if (oldFit && oldFit !== state.fitScale) {
    for (const memory of state.labelMemory.values()) memory.birthScale *= state.fitScale / oldFit;
    for (const entry of state.labelNodes.values()) entry.label.birthScale *= state.fitScale / oldFit;
  }
  state.target = { ...state.camera };
  requestDraw(true);
}
new ResizeObserver(() => resize()).observe(viewport);

function constrain(camera) {
  const bounds = state.model.bounds;
  camera.scale = clamp(camera.scale, state.fitScale, state.fitScale * 96);
  camera.x = clamp(camera.x, bounds.minX - state.width / camera.scale * .3, bounds.maxX + state.width / camera.scale * .3);
  camera.y = clamp(camera.y, bounds.minY - state.height / camera.scale * .3, bounds.maxY + state.height / camera.scale * .3);
  return camera;
}
function requestDraw(layout = false) {
  if (layout) state.lastLayout = 0;
  if (!state.frame && state.camera) state.frame = requestAnimationFrame(draw);
}
function setTarget(camera, immediate = false) {
  state.target = constrain(camera);
  if (immediate || reducedMotion.matches) state.camera = { ...state.target };
  requestDraw();
}
function draw(now) {
  state.frame = 0;
  const { width, height, camera, target, model } = state;
  if (!model) return;
  if (state.inertia && !state.pointers.size) {
    target.x += state.inertia.x; target.y += state.inertia.y;
    state.inertia.x *= .88; state.inertia.y *= .88; constrain(target);
    if (Math.hypot(state.inertia.x, state.inertia.y) * camera.scale < .1) state.inertia = null;
  }
  const delta = Math.abs(Math.log(target.scale / camera.scale)) + Math.hypot(target.x - camera.x, target.y - camera.y) * camera.scale / 100;
  const moving = delta > .0005;
  if (moving) {
    const t = reducedMotion.matches ? 1 : .28;
    camera.x += (target.x - camera.x) * t; camera.y += (target.y - camera.y) * t;
    camera.scale *= Math.exp(Math.log(target.scale / camera.scale) * t);
  } else Object.assign(camera, target);
  const zoom = camera.scale / state.fitScale;
  const stage = stageAt(zoom, state.stage);
  const changed = stage !== state.stage; state.stage = stage;
  context.clearRect(0, 0, width, height);
  drawTerrain();
  const visible = model.index.query(viewBounds(camera, width, height));
  const radius = clamp(1.6 + Math.log2(Math.max(1, zoom)) * .3, 1.6, 4.2);
  for (const point of visible) {
    const p = project(point, camera, width, height), record = state.records.get(point.id);
    context.beginPath(); context.arc(p.x, p.y, radius, 0, Math.PI * 2);
    context.fillStyle = `rgba(${rateColor(colorRate(record?.rate, state.heat?.colorRange)).join(",")},${record ? .95 : .6})`; context.fill();
    if (point.id === state.selected) {
      context.beginPath(); context.arc(p.x, p.y, radius + 5, 0, Math.PI * 2);
      context.strokeStyle = "#267765"; context.lineWidth = 2; context.stroke();
    }
  }
  viewport.classList.toggle("is-overview", stage < 0);
  updateNodePositions();
  if (changed || !state.lastLayout || now - state.lastLayout > 100) {
    layoutContent(visible); state.lastLayout = now;
    $("#zoom-readout").textContent = `×${zoom.toFixed(1)} · ${stage < 0 ? "地図" : STAGES[stage]}`;
    for (const button of document.querySelectorAll("[data-stage]")) {
      if (Number(button.dataset.stage) === stage) button.setAttribute("aria-current", "step");
      else button.removeAttribute("aria-current");
    }
    clearTimeout(state.summaryTimer);
    state.summaryTimer = setTimeout(() => {
      $("#visible-summary").textContent = `表示範囲 ${visible.length.toLocaleString()} / ${model.points.length.toLocaleString()}問`;
    }, moving ? 180 : 0);
  }
  if (moving || state.inertia || [...state.labelNodes.values(), ...state.cardNodes.values()].some(e => e.retiring)) requestDraw();
}

function buildTerrain() {
  const field = heatField(state.model, new Map(), 320, { spread: .014 }), path = new Path2D();
  const contours = coastContours(field, .8);
  for (const contour of contours) {
    const points = contour.slice(0, -1), first = points[0], last = points.at(-1);
    path.moveTo((first.x + last.x) / 2, (first.y + last.y) / 2);
    for (let i = 0; i < points.length; i++) {
      const current = points[i], next = points[(i + 1) % points.length];
      path.quadraticCurveTo(current.x, current.y, (current.x + next.x) / 2, (current.y + next.y) / 2);
    }
    path.closePath();
  }
  state.terrain = { bounds: field.bounds, path };
}
function drawTerrain() {
  const { camera, width, height, terrain, heat } = state;
  context.save();
  context.translate(width / 2 - camera.x * camera.scale, height / 2 - camera.y * camera.scale);
  context.scale(camera.scale, camera.scale);
  context.fillStyle = "#e5e8dd"; context.fill(terrain.path, "evenodd");
  if (heat) {
    context.save(); context.clip(terrain.path, "evenodd");
    context.drawImage(heat.canvas, heat.bounds.minX, heat.bounds.minY, heat.bounds.maxX - heat.bounds.minX, heat.bounds.maxY - heat.bounds.minY);
    context.restore();
  }
  context.strokeStyle = "#627e75"; context.lineWidth = 1.15 / camera.scale; context.stroke(terrain.path);
  context.restore();
}

function reservedBoxes() {
  return [{ x: 0, y: 0, w: 165, h: 65 }, { x: state.width - 70, y: 0, w: 70, h: 158 },
    { x: 0, y: state.height - 35, w: Math.min(300, state.width), h: 35 }];
}
function cardMetrics(point) {
  const fontSize = Math.round(clamp(14 + Math.log2(state.camera.scale / state.fitScale / 9) * 1.2, 14, 18) * 10) / 10;
  const w = Math.min(state.width < 600 ? 224 : 264, state.width - 30), maxLines = 7;
  const key = `${point.id}:${fontSize}:${w}`;
  if (state.cardMeasurements.has(key)) return state.cardMeasurements.get(key);
  context.font = `500 ${fontSize}px "Hiragino Sans", "Yu Gothic", Meiryo, sans-serif`;
  let lines = 1, lineWidth = 0;
  for (const char of point.question.stem) {
    const charWidth = context.measureText(char).width;
    if (char === "\n" || lineWidth + charWidth > w - 26) { lines++; lineWidth = char === "\n" ? 0 : charWidth; }
    else lineWidth += charWidth;
  }
  const metrics = { w, h: Math.ceil(Math.min(lines, maxLines) * fontSize * 1.6 + 26), fontSize };
  state.cardMeasurements.set(key, metrics);
  if (state.cardMeasurements.size > 1200) state.cardMeasurements.delete(state.cardMeasurements.keys().next().value);
  return metrics;
}
function layoutContent(visible) {
  const { model, camera, width, height, stage } = state;
  const occupied = reservedBoxes(), wantedCards = new Map();
  if (stage >= 2) {
    const priority = p => (p.id === state.selected ? -10000 : 0) +
      (state.cardNodes.has(p.id) && !state.cardNodes.get(p.id).retiring ? -90 : 0) +
      Math.hypot(p.x - camera.x, p.y - camera.y) * camera.scale;
    const sorted = [...visible].sort((a, b) => priority(a) - priority(b)).slice(0, 100);
    const candidates = sorted.map(point => ({ id: point.id, point, ...project(point, camera, width, height), ...cardMetrics(point) }));
    const previous = new Map([...state.cardNodes].filter(([, e]) => !e.retiring).map(([id, e]) => [id, e]));
    for (const item of placeQuestionCards(candidates, width, height, occupied, previous, width < 600 ? 3 : 9)) {
      wantedCards.set(item.id, item); occupied.push(item.box);
    }
  }
  reconcileCards(wantedCards);
  // Once a word is on the map, keep its anchor through zoom and let its
  // presentation fade it out. Growing boxes must not evict it abruptly.
  const retained = stage < 0 ? [] : [...state.labels.values()].filter(label => {
    const p = project(label.anchor, camera, width, height);
    return p.x > -100 && p.x < width + 100 && p.y > -100 && p.y < height + 100 &&
      labelPresentation(label.baseSize, label.birthScale, camera.scale, camera.scale / state.fitScale, label.kind).opacity > .015;
  }).map(label => {
    const p = project(label.anchor, camera, width, height);
    const view = labelPresentation(label.baseSize, label.birthScale, camera.scale, camera.scale / state.fitScale, label.kind);
    const w = (label.box.w - 6) * view.growth / label.growth + 6, h = view.size * 1.4 + 4;
    return { ...label, ...view, ...p, box: { x: p.x - w / 2, y: p.y - h / 2, w, h } };
  });
  const retainedKeys = new Set(retained.map(l => l.key));
  const candidates = stage < 0 ? [] : labelCandidates(visible, model, camera, width, height, Math.min(stage, 1), state.labels)
    .filter(label => !retainedKeys.has(label.key))
    .map(label => {
      const key = `${label.key}@${label.anchor.id}`;
      let memory = state.labelMemory.get(key);
      if (!memory) {
        memory = { baseSize: label.size, birthScale: state.fitScale * STAGE_ZOOMS[label.kind === "tag" ? 0 : 1] }; state.labelMemory.set(key, memory);
        if (state.labelMemory.size > 1200) state.labelMemory.delete(state.labelMemory.keys().next().value);
      }
      return { ...label, ...memory, ...labelPresentation(memory.baseSize, memory.birthScale, camera.scale, camera.scale / state.fitScale, label.kind) };
    }).filter(label => label.opacity > .04);
  const labels = placeLabels(candidates, width, height, (text, size, kind) => {
    context.font = `${kind === "tag" ? 700 : 500} ${size}px "Hiragino Sans", "Yu Gothic", Meiryo, sans-serif`;
    return context.measureText(text).width;
  }, [...occupied, ...retained.filter(l => l.opacity > .25).map(l => l.box)], Math.max(0, (width < 600 ? 16 : 36) - retained.length));
  state.labels = new Map([...retained, ...labels].map(label => [label.key, label]));
  reconcileLabels([...retained, ...labels]);
}

function retire(entry, entries, key) {
  if (entry.retiring) return;
  entry.retiring = true; entry.retireScale = state.camera.scale; entry.retireTime = performance.now();
  entry.retireOpacity = Number(entry.node.style.opacity || 1); entry.node.classList.add("is-leaving");
  if (!entry.label) entry.node.style.opacity = "0";
  entry.node.inert = true;
  entry.timer = setTimeout(() => {
    entry.node.remove(); entries.delete(key); requestDraw(true);
  }, reducedMotion.matches ? 0 : 650);
}
function revive(entry) {
  clearTimeout(entry.timer); entry.retiring = false;
  entry.node.inert = false; entry.node.classList.remove("is-leaving");
  entry.node.style.opacity = "";
}
function reconcileLabels(labels) {
  const wanted = new Set(labels.map(label => label.key));
  for (const [key, entry] of state.labelNodes) if (!wanted.has(key)) retire(entry, state.labelNodes, key);
  for (const label of labels) {
    let entry = state.labelNodes.get(label.key);
    if (!entry) {
      const node = element("button", `map-label${label.kind === "term" ? " is-term" : ""}`, label.text);
      node.type = "button";
      node.style.opacity = "0"; labelLayer.append(node);
      entry = { node, label }; state.labelNodes.set(label.key, entry);
      node.dataset.labelKey = label.key;
      node.addEventListener("click", event => {
        if (event.detail === 0) focusPoint(entry.label.anchor, Math.max(3, state.camera.scale / state.fitScale * 1.8));
      });
    }
    revive(entry); entry.label = label;
    entry.node.style.fontSize = `${label.baseSize}px`;
    entry.node.style.opacity = String(label.opacity);
    entry.node.setAttribute("aria-label", `${label.text} の問題に近づく`);
    positionLabel(entry);
  }
}
function reconcileCards(wanted) {
  for (const [id, entry] of state.cardNodes) if (!wanted.has(id)) retire(entry, state.cardNodes, id);
  for (const [id, item] of wanted) {
    let entry = state.cardNodes.get(id);
    if (!entry) {
      const node = element("button", "map-card", item.point.question.stem);
      node.type = "button"; node.dataset.questionId = id;
      node.setAttribute("aria-label", `問題の詳細：${item.point.question.stem}`);
      node.addEventListener("click", event => { if (event.detail === 0) showQuestion(item.point); });
      entry = { node, point: item.point, displayDx: item.dx, displayDy: item.dy };
      state.cardNodes.set(id, entry); cardLayer.append(node);
    }
    revive(entry); Object.assign(entry, item);
    entry.layoutScale = state.camera.scale;
    entry.node.classList.toggle("is-selected", id === state.selected);
    entry.node.style.width = `${item.w}px`;
    entry.node.style.fontSize = `${item.fontSize}px`;
    entry.node.style.opacity = String(clamp((state.camera.scale / state.fitScale - 6) / 1.5, 0, 1));
    positionCard(entry);
  }
}
function practiceLink(point) {
  const practice = element("a", "card-practice", "この周りの問題を解く ↗");
  const peers = surroundingQuestions(state.model, point, clamp(120 / state.camera.scale, 4, 10), 10);
  const ids = [point.id, ...peers.filter(p => p.id !== point.id).map(p => p.id)].slice(0, 10);
  const url = new URL("../../info1-quiz-app/app/", location.href);
  url.searchParams.set("challenge", ids.join(",")); practice.href = url.href;
  return practice;
}
function showQuestion(point) {
  state.selected = point.id; state.inertia = null; state.target = { ...state.camera }; requestDraw(true);
  const dialog = $("#question-dialog"), content = $("#question-detail"), question = point.question;
  dialog.dataset.questionId = point.id;
  const record = state.records.get(point.id), title = state.scoreSource === "global" ? "全体成績" : "個人成績";
  const stats = element("p", "detail-stats", record ? `${title} · ${record.attempts.toLocaleString()}回回答 · 正答率${Math.round(record.rate * 100)}%` :
    state.scoreSource === "global" && !state.globalRecords ? "全体成績は未取得" : `${title} · 未挑戦`);
  const stem = element("p", "card-stem", question.stem), choices = element("ol", "card-choices");
  for (const choice of question.choices) choices.append(element("li", "", choice.text));
  const explanation = element("details", "card-explanation");
  explanation.append(element("summary", "", "正解と解説を見る"));
  const answer = question.choices.find(c => c.choice_id === question.answer_choice_id || c.is_correct);
  if (answer) explanation.append(element("p", "choice-correct", `正解：${answer.text}`));
  if (question.explanation) explanation.append(element("p", "", question.explanation));
  question.choices.forEach((choice, index) => {
    if (choice.explanation) {
      const note = element("p", "choice-explanation");
      note.append(element("strong", "", `選択肢${index + 1}：`), document.createTextNode(choice.explanation)); explanation.append(note);
    }
  });
  content.replaceChildren(stats, stem, choices, explanation, practiceLink(point),
    element("p", "card-tags", question.tags.join(" · ")),
    element("p", "card-source", `${question.source_display || ""}${question["改題"] ? "（改題）" : ""}`));
  state.detailScroll = { x: scrollX, y: scrollY };
  document.documentElement.classList.add("question-detail-open");
  dialog.showModal(); content.scrollTop = 0;
  scrollTo({ left: state.detailScroll.x, top: state.detailScroll.y, behavior: "instant" });
}
function restoreDetailScroll() {
  if (!document.documentElement.classList.contains("question-detail-open")) return;
  document.documentElement.classList.remove("question-detail-open");
  viewport.focus({ preventScroll: true });
  if (state.detailScroll) scrollTo({ left: state.detailScroll.x, top: state.detailScroll.y, behavior: "instant" });
}
$("#question-close").addEventListener("click", () => { $("#question-dialog").close(); restoreDetailScroll(); });
$("#question-dialog").addEventListener("close", () => { if (!$("#question-dialog").open) restoreDetailScroll(); });
function positionCard(entry) {
  const p = project(entry.point, state.camera, state.width, state.height);
  entry.displayDx += (entry.dx - entry.displayDx) * .3;
  entry.displayDy += (entry.dy - entry.displayDy) * .3;
  const growth = state.camera.scale / entry.layoutScale;
  entry.node.style.transform = `translate(${p.x + entry.displayDx}px,${p.y + entry.displayDy}px) scale(${growth})`;
  entry.node.style.zIndex = entry.point.id === state.selected ? "3" : "1";
}
function positionLabel(entry) {
  const { label, node } = entry, p = project(label.anchor, state.camera, state.width, state.height);
  const view = labelPresentation(label.baseSize, label.birthScale, state.camera.scale, state.camera.scale / state.fitScale, label.kind);
  const w = (label.box.w - 6) * view.growth / label.growth + 6, h = view.size * 1.4 + 4;
  node.style.transform = `translate(${p.x - w / 2 + 3}px,${p.y - h / 2 + 2}px) scale(${view.growth})`;
  node.style.webkitTextStrokeWidth = `${1.4 / view.growth}px`;
  if (entry.retiring) {
    const remaining = clamp(1 - (performance.now() - entry.retireTime) / 650, 0, 1);
    node.style.opacity = String(Math.min(view.opacity, entry.retireOpacity * remaining));
  } else node.style.opacity = String(view.opacity);
  node.inert = entry.retiring || view.opacity < .06;
}
function updateNodePositions() {
  for (const entry of state.labelNodes.values()) positionLabel(entry);
  for (const entry of state.cardNodes.values()) positionCard(entry);
}

function updateHistory() {
  if (!state.model) return;
  let current, legacy, unavailable = false;
  try { current = JSON.parse(localStorage.getItem("info1LearningRecord:v1") || "null"); } catch { unavailable = true; }
  try { legacy = JSON.parse(localStorage.getItem("info1QuizStats:v4") || "null"); } catch { unavailable = true; }
  const records = historyRecords(current, legacy);
  for (const id of records.keys()) if (!state.model.byId.has(id)) records.delete(id);
  state.personalRecords = records; state.personalUnavailable = unavailable; updateScore();
}
function updateScore() {
  const records = state.scoreSource === "personal" ? state.personalRecords : state.globalRecords || new Map();
  const signature = state.scoreSource + JSON.stringify([...records]);
  if (signature !== state.historySignature) {
    state.historySignature = signature; state.records = records;
    const field = heatField(state.model, records, 320, { contrast: state.scoreSource === "global", spread: .014 });
    const heatCanvas = document.createElement("canvas"); heatCanvas.width = field.width; heatCanvas.height = field.height;
    heatCanvas.getContext("2d").putImageData(new ImageData(field.pixels, field.width, field.height), 0, 0);
    state.heat = { ...field, canvas: heatCanvas };
    const [min, max] = field.colorRange;
    $(".heat-min").textContent = `${Math.round(min * 100)}%`;
    $(".heat-max").textContent = `${Math.round(max * 100)}%`;
    $("#heat-note").hidden = state.scoreSource !== "global" || !records.size;
    requestDraw(true);
  }
  const attempts = [...records.values()].reduce((s, r) => s + r.attempts, 0);
  const correct = [...records.values()].reduce((s, r) => s + r.correct, 0);
  const title = state.scoreSource === "personal" ? "個人成績（このブラウザ）" : "全体成績";
  $("#history-summary").textContent = state.scoreSource === "global" && !state.globalRecords ? "全体成績はまだ取得できていません。" :
    state.scoreSource === "personal" && state.personalUnavailable ? "このブラウザの学習履歴を読み込めませんでした。" :
    attempts ? `${title}：${records.size.toLocaleString()}問に回答 · 延べ${attempts.toLocaleString()}回 · 正答率${Math.round(correct / attempts * 100)}%` :
    `${title}：まだ解答履歴がありません。`;
  for (const source of ["personal", "global"]) $("#score-" + source).setAttribute("aria-pressed", String(state.scoreSource === source));
  $("#score-status").textContent = state.scoreSource === "global" ? state.globalError : "";
  $("#score-retry").hidden = state.scoreSource !== "global" || !state.globalError;
}
async function loadGlobal() {
  if (!state.model || state.globalRequest) return;
  const controller = new AbortController(); state.globalRequest = controller; state.globalError = "";
  const timer = setTimeout(() => controller.abort(), 25000);
  $("#score-global").setAttribute("aria-busy", "true"); $("#score-retry").hidden = true;
  $("#score-status").textContent = "全体成績を取得中…";
  try {
    const records = await loadQuestionStats(state.model.points.map(p => p.id), new URL("../../info1-quiz-app/app/startup.js", location.href), {
      signal: controller.signal, onProgress: (done, total) => {
        if (state.scoreSource === "global") $("#score-status").textContent = `全体成績を取得中… ${done}/${total}`;
      },
    });
    state.globalRecords = records;
  } catch (error) {
    controller.abort();
    state.globalError = error.name === "AbortError" ? "取得がタイムアウトしました。再取得できます。" : "全体成績を取得できませんでした。再取得できます。";
  } finally {
    clearTimeout(timer); state.globalRequest = null; $("#score-global").removeAttribute("aria-busy"); updateScore();
  }
}
for (const source of ["personal", "global"]) $("#score-" + source).addEventListener("click", () => {
  if (!state.model) return;
  state.scoreSource = source; updateScore();
  if (source === "global" && !state.globalRecords) loadGlobal();
});
$("#score-retry").addEventListener("click", loadGlobal);
window.addEventListener("storage", event => { if (!event.key || ["info1LearningRecord:v1", "info1QuizStats:v4"].includes(event.key)) updateHistory(); });
window.addEventListener("pageshow", updateHistory);
window.addEventListener("focus", updateHistory);

function zoom(factor, anchor = { x: state.width / 2, y: state.height / 2 }) {
  if (!state.model) return;
  state.inertia = null;
  setTarget(zoomAbout(state.target, factor, anchor, state.width, state.height, state.fitScale, state.fitScale * 96));
}
function focusPoint(point, zoomLevel = 7) {
  state.selected = point.id; state.inertia = null;
  setTarget({ x: point.x, y: point.y, scale: state.fitScale * zoomLevel }); requestDraw(true);
}
function home() {
  if (!state.model) return;
  state.selected = null; state.inertia = null;
  setTarget(fitCamera(state.terrain.bounds, state.width, state.height));
}
$("#zoom-in").addEventListener("click", () => zoom(1.6));
$("#zoom-out").addEventListener("click", () => zoom(1 / 1.6));
$("#map-home").addEventListener("click", home);
for (const button of document.querySelectorAll("[data-stage]")) button.addEventListener("click", () => {
  if (!state.model) return;
  const stage = Number(button.dataset.stage);
  if (stage === -1) { home(); return; }
  const point = state.model.byId.get(state.selected) || nearest({ x: state.width / 2, y: state.height / 2 }, Infinity);
  if (point) focusPoint(point, STAGE_ZOOMS[stage]);
});
function localPoint(event) {
  const rect = viewport.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}
function nearest(screen, tolerance = 18) {
  if (!state.model) return null;
  const world = unproject(screen, state.camera, state.width, state.height);
  const candidates = Number.isFinite(tolerance) ? state.model.index.query({ minX: world.x - tolerance / state.camera.scale,
    maxX: world.x + tolerance / state.camera.scale, minY: world.y - tolerance / state.camera.scale, maxY: world.y + tolerance / state.camera.scale }) : state.model.points;
  let best = null, distance = tolerance;
  for (const p of candidates) {
    const d = Math.hypot(p.x - world.x, p.y - world.y) * state.camera.scale;
    if (d <= distance) { best = p; distance = d; }
  }
  return best;
}
function nearby(screen, radius = 18) {
  const world = unproject(screen, state.camera, state.width, state.height), r = radius / state.camera.scale;
  return state.model.index.query({ minX: world.x - r, maxX: world.x + r, minY: world.y - r, maxY: world.y + r })
    .filter(p => Math.hypot(p.x - world.x, p.y - world.y) <= r)
    .sort((a, b) => Math.hypot(a.x - world.x, a.y - world.y) - Math.hypot(b.x - world.x, b.y - world.y));
}
function showNearby(points) {
  const list = $("#nearby-list"), dialog = $("#nearby-dialog"); list.replaceChildren();
  $("#nearby-title").textContent = `この近くの問題 · ${points.length}問`;
  for (const point of points) {
    const button = element("button", ""); button.type = "button";
    button.append(element("small", "", point.tags.join(" · ")), element("span", "", point.question.stem));
    button.addEventListener("click", () => { dialog.close(); showQuestion(point); }); list.append(button);
  }
  dialog.showModal();
}
$("#nearby-close").addEventListener("click", () => $("#nearby-dialog").close());
viewport.addEventListener("wheel", event => {
  if (!state.model) return;
  event.preventDefault();
  const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? state.height : 1);
  zoom(Math.exp(-clamp(delta, -150, 150) * .0035), localPoint(event));
}, { passive: false });
viewport.addEventListener("dblclick", event => {
  if (event.target.closest("button,a,.map-card") || !state.model) return;
  event.preventDefault(); const p = localPoint(event), point = nearest(p);
  if (point) focusPoint(point, Math.max(7, state.camera.scale / state.fitScale * 2)); else zoom(2, p);
});

function gestureSnapshot() {
  const pointers = [...state.pointers.values()];
  const center = pointers.length > 1 ? { x: (pointers[0].x + pointers[1].x) / 2, y: (pointers[0].y + pointers[1].y) / 2 } : pointers[0];
  return { center, distance: pointers.length > 1 ? Math.hypot(pointers[0].x - pointers[1].x, pointers[0].y - pointers[1].y) : 0 };
}
function beginGesture(alreadyMoved = false) {
  const snapshot = gestureSnapshot();
  state.gesture = { ...snapshot, camera: { ...state.camera }, last: snapshot.center,
    lastTime: performance.now(), velocity: { x: 0, y: 0 }, moved: alreadyMoved || state.pointers.size > 1 };
}
viewport.addEventListener("pointerdown", event => {
  if (!state.model || event.button !== 0 || event.target.closest(".map-controls,a")) return;
  state.inertia = null; state.target = { ...state.camera };
  state.pointers.set(event.pointerId, localPoint(event)); viewport.setPointerCapture(event.pointerId);
  beginGesture(state.gesture?.moved);
  state.gesture.question = state.model.byId.get(event.target.closest(".map-card")?.dataset.questionId);
  state.gesture.label = state.labelNodes.get(event.target.closest(".map-label")?.dataset.labelKey)?.label;
  viewport.classList.add("is-dragging");
});
viewport.addEventListener("pointermove", event => {
  if (!state.pointers.has(event.pointerId)) return;
  state.pointers.set(event.pointerId, localPoint(event));
  const snapshot = gestureSnapshot(), gesture = state.gesture;
  const factor = gesture.distance > 0 ? snapshot.distance / gesture.distance : 1;
  const camera = zoomAbout(gesture.camera, factor, gesture.center, state.width, state.height, state.fitScale, state.fitScale * 96);
  camera.x -= (snapshot.center.x - gesture.center.x) / camera.scale;
  camera.y -= (snapshot.center.y - gesture.center.y) / camera.scale;
  const dt = Math.max(8, performance.now() - gesture.lastTime);
  gesture.velocity = { x: -(snapshot.center.x - gesture.last.x) / camera.scale * 16 / dt, y: -(snapshot.center.y - gesture.last.y) / camera.scale * 16 / dt };
  gesture.last = snapshot.center; gesture.lastTime = performance.now();
  if (Math.hypot(snapshot.center.x - gesture.center.x, snapshot.center.y - gesture.center.y) > 5 || state.pointers.size > 1) gesture.moved = true;
  setTarget(camera, true);
});
function endGesture(event) {
  if (!state.pointers.has(event.pointerId)) return;
  const gesture = state.gesture; state.pointers.delete(event.pointerId);
  if (state.pointers.size) { beginGesture(true); return; }
  viewport.classList.remove("is-dragging"); state.gesture = null;
  if (event.type === "pointercancel") return;
  if (!gesture.moved) {
    if (gesture.question) { showQuestion(gesture.question); return; }
    if (gesture.label) { focusPoint(gesture.label.anchor, Math.max(3, state.camera.scale / state.fitScale * 1.8)); return; }
    const points = nearby(localPoint(event));
    if (points.length > 1) showNearby(points);
    else if (points.length === 1) { if (state.stage >= 2) showQuestion(points[0]); else focusPoint(points[0], Math.max(7, state.camera.scale / state.fitScale)); }
  } else if (!reducedMotion.matches && performance.now() - gesture.lastTime < 80 && !gesture.distance) {
    state.inertia = gesture.velocity; requestDraw();
  }
}
viewport.addEventListener("pointerup", endGesture);
viewport.addEventListener("pointercancel", endGesture);
viewport.addEventListener("lostpointercapture", event => {
  if (state.pointers.has(event.pointerId)) endGesture({ ...event, pointerId: event.pointerId, type: "pointercancel" });
});
viewport.addEventListener("keydown", event => {
  if (event.target !== viewport || !state.model) return;
  const step = 90 / state.target.scale, camera = { ...state.target };
  if (event.key === "+" || event.key === "=") zoom(1.5);
  else if (event.key === "-") zoom(1 / 1.5);
  else if (event.key === "Home") home();
  else if (event.key === "Escape") { state.selected = null; requestDraw(true); }
  else if (event.key.startsWith("Arrow")) {
    if (event.key === "ArrowLeft") camera.x -= step;
    if (event.key === "ArrowRight") camera.x += step;
    if (event.key === "ArrowUp") camera.y -= step;
    if (event.key === "ArrowDown") camera.y += step;
    state.inertia = null; setTarget(camera);
  } else return;
  event.preventDefault();
});

load();

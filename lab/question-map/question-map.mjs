import { STAGES, STAGE_ZOOMS, clamp, stageAt, prepareMap, verifySourceText, fitCamera, project, unproject,
  viewBounds, zoomAbout, labelCandidates, placeLabels, overlaps, historyRecords, rateColor, heatField } from "./map-model.mjs";

const $ = selector => document.querySelector(selector);
const viewport = $("#map-viewport"), canvas = $("#map-canvas"), context = canvas.getContext("2d");
const labelLayer = $("#map-labels"), cardLayer = $("#map-cards"), status = $("#map-status");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const dataRoot = new URL("../../info1-quiz-app/data/questions/", location.href);
const state = { model: null, records: new Map(), width: 0, height: 0, fitScale: 1,
  camera: null, target: null, stage: 0, selected: null, heat: null, heatEnabled: true,
  labels: new Map(), labelNodes: new Map(), cardNodes: new Map(), frame: 0,
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
  const oldWidth = state.width;
  state.width = viewport.clientWidth; state.height = viewport.clientHeight;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(state.width * dpr); canvas.height = Math.round(state.height * dpr);
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (!state.model || !state.width || !state.height) return;
  const fit = fitCamera(state.model.bounds, state.width, state.height);
  const oldFit = state.fitScale; state.fitScale = fit.scale;
  if (reset || !state.camera) state.camera = { ...fit };
  else if (oldWidth !== state.width) state.camera.scale *= state.fitScale / oldFit;
  state.target = { ...state.camera };
  requestDraw(true);
}
new ResizeObserver(() => resize()).observe(viewport);

function constrain(camera) {
  const bounds = state.model.bounds;
  camera.scale = clamp(camera.scale, state.fitScale * .75, state.fitScale * 96);
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
  drawGrid();
  if (state.heatEnabled && state.heat) {
    const heat = state.heat, top = project({ x: heat.bounds.minX, y: heat.bounds.minY }, camera, width, height);
    context.drawImage(heat.canvas, top.x, top.y,
      (heat.bounds.maxX - heat.bounds.minX) * camera.scale, (heat.bounds.maxY - heat.bounds.minY) * camera.scale);
  }
  const visible = model.index.query(viewBounds(camera, width, height));
  const radius = clamp(1.6 + Math.log2(Math.max(1, zoom)) * .3, 1.6, 4.2);
  for (const point of visible) {
    const p = project(point, camera, width, height), record = state.records.get(point.id);
    context.beginPath(); context.arc(p.x, p.y, radius, 0, Math.PI * 2);
    context.fillStyle = `rgba(${rateColor(state.heatEnabled ? record?.rate : null).join(",")},${record && state.heatEnabled ? .95 : .65})`; context.fill();
    if (point.id === state.selected) {
      context.beginPath(); context.arc(p.x, p.y, radius + 5, 0, Math.PI * 2);
      context.strokeStyle = "#267765"; context.lineWidth = 2; context.stroke();
    }
  }
  updateNodePositions();
  if (changed || !state.lastLayout || now - state.lastLayout > 100) {
    layoutContent(visible); state.lastLayout = now;
    $("#zoom-readout").textContent = `×${zoom.toFixed(1)} · ${STAGES[stage]}`;
    for (const button of document.querySelectorAll("[data-stage]")) {
      if (Number(button.dataset.stage) === stage) button.setAttribute("aria-current", "step");
      else button.removeAttribute("aria-current");
    }
    clearTimeout(state.summaryTimer);
    state.summaryTimer = setTimeout(() => {
      $("#visible-summary").textContent = `表示範囲 ${visible.length.toLocaleString()} / ${model.points.length.toLocaleString()}問`;
    }, moving ? 180 : 0);
  }
  if (moving || state.inertia) requestDraw();
}

function drawGrid() {
  const { camera, width, height } = state;
  const size = 2 ** Math.ceil(Math.log2(65 / camera.scale));
  const bounds = viewBounds(camera, width, height);
  context.beginPath();
  for (let x = Math.ceil(bounds.minX / size) * size; x <= bounds.maxX; x += size) {
    const p = project({ x, y: camera.y }, camera, width, height); context.moveTo(p.x, 0); context.lineTo(p.x, height);
  }
  for (let y = Math.ceil(bounds.minY / size) * size; y <= bounds.maxY; y += size) {
    const p = project({ x: camera.x, y }, camera, width, height); context.moveTo(0, p.y); context.lineTo(width, p.y);
  }
  context.strokeStyle = "rgba(16,47,53,.045)"; context.lineWidth = 1; context.stroke();
}

function reservedBoxes() {
  return [{ x: 0, y: 0, w: 165, h: 65 }, { x: state.width - 70, y: 0, w: 70, h: 158 },
    { x: 0, y: state.height - 35, w: Math.min(300, state.width), h: 35 }];
}
function cardBox(point, index = 0) {
  const { width, height, stage, camera } = state;
  const p = project(point, camera, width, height);
  const w = Math.min(310, width - 30);
  const h = Math.min(stage === 2 ? 170 : stage === 3 ? 340 : 440, height - 105);
  return { x: clamp(p.x - w / 2, 12, width - w - 12), y: clamp(p.y + 12, 70, height - h - 30), w, h, index };
}
function layoutContent(visible) {
  const { model, camera, width, height, stage } = state;
  const occupied = reservedBoxes(), wantedCards = new Map();
  if (stage >= 2) {
    const sorted = [...visible].sort((a, b) =>
      (a.id === state.selected ? -1 : b.id === state.selected ? 1 :
      Math.hypot(a.x - camera.x, a.y - camera.y) - Math.hypot(b.x - camera.x, b.y - camera.y)));
    for (const point of sorted) {
      const box = cardBox(point);
      if (point.id !== state.selected && occupied.some(b => overlaps(box, b, 12))) continue;
      wantedCards.set(point.id, { point, box }); occupied.push(box);
      if (wantedCards.size >= (width < 600 ? 1 : 6)) break;
    }
  }
  reconcileCards(wantedCards);
  const candidates = labelCandidates(visible, model, camera, width, height, Math.min(stage, 1), state.labels);
  const labels = placeLabels(candidates, width, height, (text, size, kind) => {
    context.font = `${kind === "tag" ? 700 : 500} ${size}px "Hiragino Sans", "Yu Gothic", Meiryo, sans-serif`;
    return context.measureText(text).width;
  }, occupied, stage >= 2 ? 12 : width < 600 ? 16 : 36);
  state.labels = new Map(labels.map(label => [label.key, label]));
  reconcileLabels(labels);
}

function retire(entry, entries, key) {
  if (entry.retiring) return;
  entry.retiring = true; entry.node.classList.add("is-leaving");
  entry.node.inert = true;
  entry.timer = setTimeout(() => {
    entry.node.remove(); entries.delete(key); requestDraw(true);
  }, reducedMotion.matches ? 0 : 280);
}
function revive(entry) {
  clearTimeout(entry.timer); entry.retiring = false;
  entry.node.inert = false; entry.node.classList.remove("is-leaving");
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
      requestAnimationFrame(() => { node.style.opacity = ""; });
    }
    revive(entry); entry.label = label;
    entry.node.style.fontSize = `${label.size}px`;
    entry.node.setAttribute("aria-label", `${label.text} の問題に近づく`);
    entry.node.style.transform = `translate(${label.box.x}px,${label.box.y}px)`;
  }
}
function reconcileCards(wanted) {
  for (const [id, entry] of state.cardNodes) if (!wanted.has(id)) retire(entry, state.cardNodes, id);
  for (const [id, { point, box }] of wanted) {
    let entry = state.cardNodes.get(id);
    if (!entry) {
      entry = { node: element("article", "map-card"), point, stage: -1, selected: null, box };
      state.cardNodes.set(id, entry); cardLayer.append(entry.node);
      entry.node.addEventListener("wheel", event => event.stopPropagation(), { passive: true });
    }
    revive(entry); entry.box = box;
    if (entry.stage !== state.stage || entry.selected !== (id === state.selected)) buildCard(entry);
    positionCard(entry);
  }
}
function buildCard(entry) {
  const { point, node } = entry, question = point.question, record = state.records.get(point.id);
  const selected = point.id === state.selected;
  entry.stage = state.stage; entry.selected = selected;
  node.className = `map-card${selected ? " is-selected" : ""}`;
  node.setAttribute("aria-label", `問題：${question.tags.join("・")}`);
  const header = element("div", "card-header");
  header.append(element("span", "", record ? `${record.attempts}回回答 · 正答率${Math.round(record.rate * 100)}%` : "未挑戦"));
  const zoom = element("button", "", state.stage < 4 ? "もっと近くへ ↗" : selected ? "選択を解除" : "この問題へ");
  zoom.type = "button";
  zoom.addEventListener("click", () => {
    if (state.stage === 4 && selected) { state.selected = null; requestDraw(true); }
    else focusPoint(point, state.stage < 4 ? STAGE_ZOOMS[state.stage + 1] : state.camera.scale / state.fitScale);
  });
  header.append(zoom);
  const scroll = element("div", "card-scroll");
  scroll.tabIndex = 0; scroll.setAttribute("aria-label", "問題の内容（上下にスクロールできます）");
  scroll.append(element("p", "card-stem", question.stem));
  if (state.stage >= 3) {
    const choices = element("ol", "card-choices");
    for (const choice of question.choices) {
      const correct = choice.choice_id === question.answer_choice_id || choice.is_correct;
      const item = element("li", state.stage >= 4 && correct ? "choice-correct" : "", choice.text);
      if (state.stage >= 4) {
        if (correct) item.append(element("span", "", " 【正解】"));
        if (choice.explanation) item.append(element("span", "choice-explanation", choice.explanation));
      }
      choices.append(item);
    }
    scroll.append(choices);
  }
  if (state.stage >= 4) {
    const explanation = element("section", "card-explanation");
    explanation.append(element("h3", "", "解説"), element("p", "", question.explanation)); scroll.append(explanation);
  }
  scroll.append(element("p", "card-tags", question.tags.join(" · ")));
  const neighbors = nearby(project(point, state.camera, state.width, state.height), 24);
  if (neighbors.length > 1) {
    const choose = element("button", "nearby-link", `この近くの問題を選ぶ（${neighbors.length}問）`);
    choose.type = "button"; choose.addEventListener("click", () => showNearby(neighbors)); scroll.append(choose);
  }
  scroll.append(element("p", "card-source", `${question.source_display || ""}${question["改題"] ? "（改題）" : ""}`));
  const link = element("a", "card-practice", "学習アプリでこの問題を解く ↗");
  const url = new URL("../../info1-quiz-app/app/", location.href);
  url.searchParams.set("challenge", point.id); link.href = url.href; scroll.append(link);
  node.replaceChildren(header, scroll);
}
function positionCard(entry) {
  const box = cardBox(entry.point); entry.box = box;
  entry.node.style.transform = `translate(${box.x}px,${box.y}px)`;
  entry.node.style.width = `${box.w}px`;
  entry.node.querySelector(".card-scroll").style.maxHeight = `${Math.max(60, box.h - entry.node.querySelector(".card-header").offsetHeight - 42)}px`;
}
function updateNodePositions() {
  for (const entry of state.labelNodes.values()) {
    const p = project(entry.label.anchor, state.camera, state.width, state.height);
    const box = entry.label.box;
    entry.node.style.transform = `translate(${p.x - box.w / 2}px,${p.y - box.h / 2}px)`;
  }
  for (const entry of state.cardNodes.values()) positionCard(entry);
}

function updateHistory() {
  if (!state.model) return;
  let current, legacy, unavailable = false;
  try { current = JSON.parse(localStorage.getItem("info1LearningRecord:v1") || "null"); } catch { unavailable = true; }
  try { legacy = JSON.parse(localStorage.getItem("info1QuizStats:v4") || "null"); } catch { unavailable = true; }
  const records = historyRecords(current, legacy);
  for (const id of records.keys()) if (!state.model.byId.has(id)) records.delete(id);
  const signature = JSON.stringify([...records]);
  if (signature !== state.historySignature) {
    state.historySignature = signature; state.records = records;
    const field = heatField(state.model, records);
    const heatCanvas = document.createElement("canvas"); heatCanvas.width = field.width; heatCanvas.height = field.height;
    heatCanvas.getContext("2d").putImageData(new ImageData(field.pixels, field.width, field.height), 0, 0);
    state.heat = { ...field, canvas: heatCanvas };
    for (const entry of state.cardNodes.values()) entry.stage = -1;
    requestDraw(true);
  }
  const attempts = [...records.values()].reduce((s, r) => s + r.attempts, 0);
  const correct = [...records.values()].reduce((s, r) => s + r.correct, 0);
  $("#history-summary").textContent = unavailable ? "学習履歴を読み込めませんでした。利用できる履歴がない場所は未挑戦として表示します。" :
    attempts ? `このブラウザの履歴：${records.size.toLocaleString()}問に挑戦 · 延べ${attempts.toLocaleString()}回回答 · 正答率${Math.round(correct / attempts * 100)}%` :
      "まだ解答履歴がありません。未挑戦の地形を表示中です。学習アプリで解くと、この地図にも色がつきます。";
}
window.addEventListener("storage", event => { if (!event.key || ["info1LearningRecord:v1", "info1QuizStats:v4"].includes(event.key)) updateHistory(); });
window.addEventListener("pageshow", updateHistory);
window.addEventListener("focus", updateHistory);
$("#heat-toggle").addEventListener("change", event => { state.heatEnabled = event.target.checked; requestDraw(); });

function zoom(factor, anchor = { x: state.width / 2, y: state.height / 2 }) {
  if (!state.model) return;
  state.inertia = null;
  setTarget(zoomAbout(state.target, factor, anchor, state.width, state.height, state.fitScale * .75, state.fitScale * 96));
}
function focusPoint(point, zoomLevel = 7) {
  state.selected = point.id; state.inertia = null;
  setTarget({ x: point.x, y: point.y, scale: state.fitScale * zoomLevel }); requestDraw(true);
}
function home() {
  if (!state.model) return;
  state.selected = null; state.inertia = null;
  setTarget(fitCamera(state.model.bounds, state.width, state.height));
}
$("#zoom-in").addEventListener("click", () => zoom(1.6));
$("#zoom-out").addEventListener("click", () => zoom(1 / 1.6));
$("#map-home").addEventListener("click", home);
for (const button of document.querySelectorAll("[data-stage]")) button.addEventListener("click", () => {
  if (!state.model) return;
  const stage = Number(button.dataset.stage);
  if (stage === 0) { home(); return; }
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
    button.addEventListener("click", () => { dialog.close(); focusPoint(point, Math.max(7, state.camera.scale / state.fitScale)); }); list.append(button);
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
  if (!state.model || event.button !== 0 || event.target.closest(".map-controls,a,.map-card")) return;
  state.inertia = null; state.target = { ...state.camera };
  state.pointers.set(event.pointerId, localPoint(event)); viewport.setPointerCapture(event.pointerId);
  beginGesture(state.gesture?.moved);
  state.gesture.label = state.labelNodes.get(event.target.closest(".map-label")?.dataset.labelKey)?.label;
  viewport.classList.add("is-dragging");
});
viewport.addEventListener("pointermove", event => {
  if (!state.pointers.has(event.pointerId)) return;
  state.pointers.set(event.pointerId, localPoint(event));
  const snapshot = gestureSnapshot(), gesture = state.gesture;
  const factor = gesture.distance > 0 ? snapshot.distance / gesture.distance : 1;
  const camera = zoomAbout(gesture.camera, factor, gesture.center, state.width, state.height, state.fitScale * .75, state.fitScale * 96);
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
    if (gesture.label) { focusPoint(gesture.label.anchor, Math.max(3, state.camera.scale / state.fitScale * 1.8)); return; }
    const points = nearby(localPoint(event));
    if (points.length > 1) showNearby(points);
    else if (points.length === 1) focusPoint(points[0], Math.max(7, state.camera.scale / state.fitScale));
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

$("#map-search").addEventListener("submit", event => {
  event.preventDefault(); if (!state.model) return;
  const query = $("#search-query").value.trim().normalize("NFKC").toLocaleLowerCase("ja");
  const results = $("#search-results"); results.replaceChildren();
  if (!query) { results.hidden = true; return; }
  const normalize = s => s.normalize("NFKC").toLocaleLowerCase("ja");
  const matches = state.model.points.map(point => ({ point, score:
    point.tags.some(tag => normalize(tag) === query) ? 4 :
    point.tags.some(tag => normalize(tag).includes(query)) ? 3 :
    point.terms.some(term => normalize(term).includes(query)) ? 2 : normalize(point.question.stem).includes(query) ? 1 : 0 }))
    .filter(item => item.score).sort((a, b) => b.score - a.score);
  results.hidden = false;
  results.append(element("p", "", matches.length ? `${matches.length}問が見つかりました。${matches.length > 12 ? "先頭12問を表示します。" : ""}` : "見つかりませんでした。別の言葉で探してみましょう。"));
  for (const { point } of matches.slice(0, 12)) {
    const button = element("button", "", `${point.tags.slice(0, 2).join(" / ")} — ${point.question.stem.slice(0, 70)}${point.question.stem.length > 70 ? "…" : ""}`);
    button.type = "button"; button.addEventListener("click", () => { results.hidden = true; focusPoint(point, 7); viewport.focus({ preventScroll: true }); }); results.append(button);
  }
});
$("#search-query").addEventListener("input", event => { if (!event.target.value) $("#search-results").hidden = true; });
load();

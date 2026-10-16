import { regression, mean, fmt, clamp } from "../shared/math.mjs";
import { esc, metrics, table, svg, drag } from "../shared/ui.mjs";
import { readDataset } from "../shared/data.mjs";

const basePoints = () =>
  [
    [15, 40],
    [25, 48],
    [32, 44],
    [40, 59],
    [48, 54],
    [55, 66],
    [65, 62],
    [72, 76],
    [80, 73],
    [90, 86],
    [98, 81],
    [108, 94],
  ].map(([x, y], i) => ({ id: `p${i + 1}`, x, y }));

function baseState() {
  return {
    points: basePoints(),
    selectedId: "p12",
    mode: "move",
    manual: false,
    manualSlope: 0.35,
    manualIntercept: 35,
    showResiduals: false,
    showSquares: false,
    excludeSelected: false,
    predictionX: 75,
    xMin: 0,
    yMin: 0,
    xMax: 120,
    yMax: 110,
    xLabel: "1週間の復習時間（分）",
    yLabel: "確認テスト（点）",
    source: "架空の12人の学習記録",
  };
}

function initial() {
  const state = baseState();
  if (
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("dataset") === "project"
  ) {
    const data = readDataset();
    if (data.rows.length) {
      state.points = data.rows.map((p, i) => ({
        id: String(p.id ?? `project${i}`),
        x: Number(p.x),
        y: Number(p.y),
        group: p.group,
      }));
      state.selectedId = state.points.at(-1).id;
      state.xLabel = data.xLabel;
      state.yLabel = data.yLabel;
      state.source = data.name;
      state.xMin = Math.min(
        0,
        Math.floor((Math.min(...state.points.map((p) => p.x)) * 1.15) / 10) *
          10,
      );
      state.yMin = Math.min(
        0,
        Math.floor((Math.min(...state.points.map((p) => p.y)) * 1.15) / 10) *
          10,
      );
      state.xMax = Math.max(
        10,
        Math.ceil((Math.max(...state.points.map((p) => p.x)) * 1.15) / 10) * 10,
      );
      state.yMax = Math.max(
        10,
        Math.ceil((Math.max(...state.points.map((p) => p.y)) * 1.15) / 10) * 10,
      );
      state.predictionX = mean(state.points.map((p) => p.x));
    }
  }
  return state;
}

/** The inspected observation is kept out of fitting when testing a prediction. */
export function trainingPoints(state) {
  return state.points.filter(
    (p) => !state.excludeSelected || p.id !== state.selectedId,
  );
}

export function residualSummary(points, slope, intercept) {
  const residuals = points.map((p) => ({
    ...p,
    predicted: slope * p.x + intercept,
    residual: p.y - (slope * p.x + intercept),
  }));
  const sse = residuals.reduce((total, p) => total + p.residual ** 2, 0);
  return {
    residuals,
    sse,
    rmse: points.length ? Math.sqrt(sse / points.length) : NaN,
  };
}

function validFit(fit) {
  return Number.isFinite(fit.slope) && Number.isFinite(fit.intercept);
}
function equation(a, b) {
  const coefficient = (v, digits) =>
    v !== 0 && (Math.abs(v) < 0.001 || Math.abs(v) >= 1e5)
      ? v.toExponential(3)
      : fmt(v, digits);
  return `ŷ = ${coefficient(a, 3)}x ${b < 0 ? "−" : "+"} ${coefficient(Math.abs(b), 2)}`;
}

const colors = {
  data: "#207d79",
  selected: "#d98732",
  selectedEdge: "#9d4c15",
  prediction: "#815dab",
  residual: "#cc7435",
  reference: "#819090",
};
const coordinate = (value, span) => {
  if (value !== 0 && (Math.abs(value) >= 1e5 || Math.abs(value) < 0.001))
    return value.toExponential(2);
  return fmt(
    value,
    Math.max(0, Math.min(8, Math.ceil(-Math.log10(Math.abs(span) || 1)) + 3)),
  );
};
const pointId = (id) => `corr-point-${encodeURIComponent(String(id))}`;

export function visiblePrediction(
  state,
  slope,
  intercept,
  requested = state.predictionX,
) {
  if (!Number.isFinite(slope) || !Number.isFinite(intercept)) return null;
  let low = state.xMin,
    high = state.xMax;
  if (slope === 0) {
    if (intercept < state.yMin || intercept > state.yMax) return null;
  } else {
    const ends = [
      (state.yMin - intercept) / slope,
      (state.yMax - intercept) / slope,
    ].sort((a, b) => a - b);
    low = Math.max(low, ends[0]);
    high = Math.min(high, ends[1]);
  }
  if (low > high) return null;
  const x = clamp(
    Number.isFinite(requested) ? requested : (low + high) / 2,
    low,
    high,
  );
  return { x, y: slope * x + intercept, low, high };
}

export function normalizeCorrelation(state) {
  const next = {
    ...state,
    mode: "move",
    excludeSelected: state.points.length >= 3 && state.excludeSelected,
  };
  // Old slider-based saved lines have no on-chart handles. Keep the observations,
  // and start those saved experiments with their fitted regression line.
  if (next.manual && !next.lineAnchors) next.manual = false;
  const fit = regression(trainingPoints(next));
  const prediction = visiblePrediction(
    next,
    next.manual ? next.manualSlope : fit.slope,
    next.manual ? next.manualIntercept : fit.intercept,
  );
  if (prediction) next.predictionX = prediction.x;
  return next;
}

export function addRandomPoint(state, random = Math.random) {
  if (state.points.length >= 300) return null;
  let serial = state.points.length;
  while (state.points.some((p) => p.id === `added-${serial}`)) serial++;
  const id = `added-${serial}`;
  const value = (low, high) =>
    Number((low + (0.1 + random() * 0.8) * (high - low)).toPrecision(10));
  return {
    points: [
      ...state.points,
      {
        id,
        x: value(Math.max(-1e6, state.xMin), Math.min(1e6, state.xMax)),
        y: value(Math.max(-1e6, state.yMin), Math.min(1e6, state.yMax)),
      },
    ],
    selectedId: id,
  };
}

export function moveLineHandle(state, side, x, y) {
  const anchors = state.lineAnchors;
  if (!anchors) return null;
  const gap =
    state.lineHandleGap ||
    Math.max(
      Math.abs(anchors.right.x - anchors.left.x) * 0.02,
      Number.EPSILON *
        Math.max(1, Math.abs(anchors.left.x), Math.abs(anchors.right.x)) *
        8,
    );
  const moved = {
    x: clamp(
      x,
      side === "left" ? state.xMin : anchors.left.x + gap,
      side === "left" ? anchors.right.x - gap : state.xMax,
    ),
    y: clamp(y, state.yMin, state.yMax),
  };
  const next = { ...anchors, [side]: moved };
  const slope = (next.right.y - next.left.y) / (next.right.x - next.left.x);
  return {
    lineAnchors: next,
    manualSlope: slope,
    manualIntercept: next.left.y - slope * next.left.x,
  };
}

function render(root, ctx) {
  const s = ctx.state,
    points = s.points;
  const selected = points.find((p) => p.id === s.selectedId) || points[0];
  const train = trainingPoints(s),
    fit = regression(train),
    fitOK = validFit(fit);
  const slope = s.manual ? Number(s.manualSlope) : fit.slope;
  const intercept = s.manual ? Number(s.manualIntercept) : fit.intercept;
  const lineOK = Number.isFinite(slope) && Number.isFinite(intercept);
  const residuals = lineOK
    ? residualSummary(train, slope, intercept)
    : { residuals: [], sse: NaN, rmse: NaN };
  const prediction = visiblePrediction(s, slope, intercept);
  const xSpan = s.xMax - s.xMin,
    ySpan = s.yMax - s.yMin;
  const w = Math.max(
    260,
    root.clientWidth - (window.innerWidth <= 800 ? 30 : 42),
  );
  const h = w < 550 ? 340 : 460;
  const left = w < 550 ? 72 : 86,
    right = w - 30,
    top = 30,
    bottom = h - 58;
  const a = {
    x: (v) => left + ((v - s.xMin) / xSpan) * (right - left),
    y: (v) => bottom - ((v - s.yMin) / ySpan) * (bottom - top),
    ix: (v) => s.xMin + ((v - left) / (right - left)) * xSpan,
    iy: (v) => s.yMin + ((bottom - v) / (bottom - top)) * ySpan,
  };
  const axisLabel = (text, width) => {
    let short = "",
      used = 0;
    for (const ch of String(text)) {
      used += /[\u0000-\u007f]/.test(ch) ? 7 : 13;
      if (used > width - 14) return `<title>${esc(text)}</title>${esc(short)}…`;
      short += ch;
    }
    return esc(short);
  };
  let drawing = `<defs><clipPath id="corr-clip"><rect x="${left}" y="${top}" width="${right - left}" height="${bottom - top}"/></clipPath></defs>`;
  for (let i = 0; i <= 5; i++) {
    const x = s.xMin + (xSpan * i) / 5,
      y = s.yMin + (ySpan * i) / 5;
    drawing += `<line class="gridline" x1="${left}" x2="${right}" y1="${a.y(y)}" y2="${a.y(y)}"/>`;
    if (!prediction || Math.abs(a.x(x) - a.x(prediction.x)) > 38)
      drawing += `<text x="${a.x(x)}" y="${bottom + 20}" text-anchor="middle">${coordinate(x, xSpan)}</text>`;
    if (!prediction || Math.abs(a.y(y) - a.y(prediction.y)) > 17)
      drawing += `<text x="${left - 10}" y="${a.y(y) + 4}" text-anchor="end">${coordinate(y, ySpan)}</text>`;
  }
  drawing += `<path class="axis" d="M${left},${top}V${bottom}H${right}"/><text x="${(left + right) / 2}" y="${h - 5}" text-anchor="middle">${axisLabel(s.xLabel, 2 * Math.min((left + right) / 2, w - (left + right) / 2) - 10)}</text><text x="${left}" y="16">${axisLabel(s.yLabel, w - left - 8)}</text>`;
  if (lineOK) {
    drawing += '<g clip-path="url(#corr-clip)">';
    if (s.showResiduals)
      residuals.residuals.forEach((p) => {
        const x = a.x(p.x),
          y = a.y(p.y),
          py = a.y(p.predicted),
          size = Math.abs(y - py);
        if (s.showSquares)
          drawing += `<rect x="${x}" y="${Math.min(y, py)}" width="${size}" height="${size}" fill="#d9873218" stroke="#d9873266"><title>残差² = ${fmt(p.residual ** 2)}</title></rect>`;
        drawing += `<line data-residual="${esc(p.id)}" x1="${x}" x2="${x}" y1="${y}" y2="${py}" stroke="${colors.residual}" stroke-width="1.5" stroke-dasharray="4 3"/>`;
      });
    const segment = (m, b, attrs) => {
      const p = visiblePrediction(s, m, b, s.xMin),
        q = visiblePrediction(s, m, b, s.xMax);
      return p && q
        ? `<line ${attrs} x1="${a.x(p.x)}" x2="${a.x(q.x)}" y1="${a.y(p.y)}" y2="${a.y(q.y)}"/>`
        : "";
    };
    if (s.manual && fitOK)
      drawing += segment(
        fit.slope,
        fit.intercept,
        `data-fit-line stroke="${colors.reference}" stroke-width="2" stroke-dasharray="6 5"`,
      );
    drawing +=
      segment(
        slope,
        intercept,
        `data-current-line stroke="${s.manual ? colors.selectedEdge : colors.data}" stroke-width="2.5"`,
      ) + "</g>";
  }
  points.forEach((p, i) => {
    const chosen = p.id === selected?.id,
      held = s.excludeSelected && chosen;
    drawing += `<circle id="${esc(pointId(p.id))}" class="point corr-observation" data-id="${esc(p.id)}" data-corr-drag="observation" cx="${a.x(p.x)}" cy="${a.y(p.y)}" r="${chosen ? 9 : 7}" style="fill:${held ? "#fff" : chosen ? colors.selected : colors.data};stroke:${chosen ? colors.selectedEdge : "#fff"};stroke-width:${chosen ? 3 : 2}" tabindex="0" role="button" aria-pressed="${chosen}" aria-label="データ${i + 1}、x ${coordinate(p.x, xSpan)}、y ${coordinate(p.y, ySpan)}。Deleteキーで削除"><title>データ${i + 1}: (${coordinate(p.x, xSpan)}, ${coordinate(p.y, ySpan)})</title></circle>`;
  });
  if (s.manual && s.lineAnchors)
    for (const [side, p] of Object.entries(s.lineAnchors)) {
      drawing += `<g id="corr-line-${side}" data-corr-drag="line" data-side="${side}" class="corr-drag-handle" role="slider" tabindex="0" aria-label="調整中の直線の${side === "left" ? "左" : "右"}の取っ手" aria-valuemin="${s.yMin}" aria-valuemax="${s.yMax}" aria-valuenow="${p.y}" aria-valuetext="x ${coordinate(p.x, xSpan)}、y ${coordinate(p.y, ySpan)}"><circle cx="${a.x(p.x)}" cy="${a.y(p.y)}" r="18" fill="transparent"/><rect x="${a.x(p.x) - 6}" y="${a.y(p.y) - 6}" width="12" height="12" rx="2" fill="#fff" stroke="${colors.selectedEdge}" stroke-width="2"/></g>`;
    }
  if (prediction) {
    const x = a.x(prediction.x),
      y = a.y(prediction.y);
    drawing += `<g class="corr-projections" pointer-events="none"><line data-prediction-guide="x" x1="${x}" x2="${x}" y1="${y}" y2="${bottom}" stroke="${colors.prediction}" stroke-width="1.5" stroke-dasharray="5 4"/><line data-prediction-guide="y" x1="${left}" x2="${x}" y1="${y}" y2="${y}" stroke="${colors.prediction}" stroke-width="1.5" stroke-dasharray="5 4"/><rect x="${x - 34}" y="${bottom + 6}" width="68" height="22" rx="3" fill="#f3edf9"/><text data-prediction-axis="x" x="${x}" y="${bottom + 22}" text-anchor="middle" style="fill:${colors.prediction};font-weight:700">${coordinate(prediction.x, xSpan)}</text><rect x="${left - 70}" y="${y - 12}" width="64" height="23" rx="3" fill="#f3edf9"/><text data-prediction-axis="y" x="${left - 10}" y="${y + 4}" text-anchor="end" style="fill:${colors.prediction};font-weight:700">${coordinate(prediction.y, ySpan)}</text></g>`;
    drawing += `<g id="corr-prediction" class="corr-drag-handle" data-corr-drag="prediction" role="slider" tabindex="0" aria-label="予測点。左右に動かしてxを指定" aria-orientation="horizontal" aria-valuemin="${prediction.low}" aria-valuemax="${prediction.high}" aria-valuenow="${prediction.x}" aria-valuetext="x ${coordinate(prediction.x, xSpan)}、予測y ${coordinate(prediction.y, ySpan)}"><circle cx="${x}" cy="${y}" r="19" fill="transparent"/><circle data-prediction-point cx="${x}" cy="${y}" r="8" fill="${colors.prediction}" stroke="#fff" stroke-width="2"/><title>予測点: x ${coordinate(prediction.x, xSpan)}、ŷ ${coordinate(prediction.y, ySpan)}</title></g>`;
  }
  const key = (label, color, hollow = false, line = false) =>
    `<li><span class="${line ? "corr-line-key" : "corr-point-key"}" style="${line ? `border-color:${color};border-top-style:${/破線|点線/.test(label) ? "dashed" : "solid"}` : `background:${hollow ? "#fff" : color};border-color:${hollow || color === colors.selected ? colors.selectedEdge : "#fff"}`}" aria-hidden="true"></span>${label}</li>`;
  const selectedResidual =
    selected && lineOK ? selected.y - (slope * selected.x + intercept) : null;
  const error = !lineOK
    ? "回帰直線を求めるには、xの異なるデータが2点以上必要です。"
    : "";
  root.innerHTML = `${metrics([
    ["相関係数 r", Number.isFinite(fit.r) ? fmt(fit.r, 3) : "定義できない"],
    [
      s.manual ? "調整中の直線の方程式" : "回帰直線の方程式",
      lineOK ? equation(slope, intercept) : "計算できない",
    ],
  ]).replace('class="metrics"', 'class="metrics correlation-metrics"')}
  <section class="panel chart-panel correlation-canvas"><div class="correlation-toolbar"><button id="corr-add" type="button" ${points.length >= 300 ? 'disabled title="300点まで追加できます"' : ""}>点を追加</button><button id="corr-delete" type="button" ${points.length <= 2 ? 'disabled title="データは2点以上必要です"' : 'title="選択した点を削除（Delete）"'}>選択点を削除</button></div>
    ${svg(drawing, "散布図・直線。データ点と紫の予測点を直接動かせます", w, h).replace("<svg", '<svg id="corr-chart" style="touch-action:none"').replace('role="img"', 'role="group"')}
    ${error ? `<p class="error" role="status">${error}</p>` : ""}
    <ul class="corr-legend" aria-label="グラフの凡例">${key(s.excludeSelected ? "学習用データ" : "データ", colors.data)}${key(s.excludeSelected ? "検証用の選択点" : "選択中", colors.selected, s.excludeSelected)}${key("予測点", colors.prediction)}${key(s.manual ? "調整中の直線" : "回帰直線", s.manual ? colors.selectedEdge : colors.data, false, true)}${s.manual && fitOK ? key("回帰直線（破線）", colors.reference, false, true) : ""}${s.showResiduals ? key("残差（点線）", colors.residual, false, true) : ""}</ul>
    <details id="corr-details" class="corr-details" ${s.correlationDetailsOpen ? "open" : ""}><summary>残差・直線の調整を詳しく調べる</summary><div class="corr-detail-options"><label><input id="corr-manual" type="checkbox" ${s.manual ? "checked" : ""}> 直線を図の取っ手で調整</label><label><input id="corr-residuals" type="checkbox" ${s.showResiduals ? "checked" : ""}> 残差を表示</label><label><input id="corr-squares" type="checkbox" ${s.showSquares ? "checked" : ""}> 残差の二乗を表示</label><label><input id="corr-holdout" type="checkbox" ${s.excludeSelected ? "checked" : ""} ${points.length < 3 ? "disabled" : ""}> 選択点を回帰から外して予測を検証</label>${s.manual ? '<button id="corr-best" type="button">回帰直線に戻す</button>' : ""}</div>
    <p>残差平方和：<strong>${lineOK ? fmt(residuals.sse, 2) : "—"}</strong> ／ 最小値：${fitOK ? fmt(fit.sse, 2) : "—"} ／ 学習用RMSE：${lineOK ? fmt(residuals.rmse, 2) : "—"}</p>
    ${selectedResidual !== null ? `<p>選択点の残差：実測 ${coordinate(selected.y, ySpan)} − 予測 ${coordinate(slope * selected.x + intercept, ySpan)} = <strong>${coordinate(selectedResidual, ySpan)}</strong>${s.excludeSelected ? "（検証用のため、残差平方和・RMSEの計算には含めません）" : ""}</p>` : ""}
    <details class="corr-residual-table"><summary>実測値・予測値・残差の表</summary>${table(
      ["データ", "x", "実測 y", "予測 ŷ", "残差", "残差²"],
      residuals.residuals.map((p) => [
        points.findIndex((q) => q.id === p.id) + 1,
        coordinate(p.x, xSpan),
        coordinate(p.y, ySpan),
        coordinate(p.predicted, ySpan),
        coordinate(p.residual, ySpan),
        fmt(p.residual ** 2),
      ]),
    )}</details></details>
  </section>`;
  const chart = root.querySelector("#corr-chart");
  const focusPoint = (id) =>
    document.getElementById(pointId(id))?.focus({ preventScroll: true });
  const remove = (id) => {
    if (points.length <= 2) return;
    const index = points.findIndex((p) => p.id === id),
      remaining = points.filter((p) => p.id !== id);
    const nextId = remaining[Math.max(0, index - 1)]?.id || remaining[0]?.id;
    ctx.update({
      points: remaining,
      selectedId: nextId,
      excludeSelected: remaining.length >= 3 && s.excludeSelected,
    });
    focusPoint(nextId);
  };
  root.querySelector("#corr-add").onclick = () => {
    const patch = addRandomPoint(s);
    if (patch) {
      ctx.update(patch);
      focusPoint(patch.selectedId);
    }
  };
  root.querySelector("#corr-delete").onclick = () => remove(selected?.id);
  const updatePrediction = (x) => {
    const p = visiblePrediction(s, slope, intercept, x);
    if (p) ctx.update({ predictionX: p.x });
  };
  drag(chart, "[data-corr-drag]", (target, x, y) => {
    if (target.dataset.corrDrag === "prediction") {
      updatePrediction(a.ix(x));
      return;
    }
    if (target.dataset.corrDrag === "line") {
      const patch = moveLineHandle(s, target.dataset.side, a.ix(x), a.iy(y));
      if (patch) ctx.update(patch);
      return;
    }
    const id = target.dataset.id;
    ctx.update({
      selectedId: id,
      points: points.map((p) =>
        p.id === id
          ? {
              ...p,
              x: Number(
                clamp(
                  a.ix(x),
                  Math.max(-1e6, s.xMin),
                  Math.min(1e6, s.xMax),
                ).toPrecision(10),
              ),
              y: Number(
                clamp(
                  a.iy(y),
                  Math.max(-1e6, s.yMin),
                  Math.min(1e6, s.yMax),
                ).toPrecision(10),
              ),
            }
          : p,
      ),
    });
  });
  chart.addEventListener("pointerdown", (e) => {
    if (e.button > 0) return;
    const target = e.target.closest("[data-corr-drag]");
    if (!target) return;
    target.focus({ preventScroll: true });
    if (target.dataset.corrDrag === "observation")
      ctx.update({ selectedId: target.dataset.id });
  });
  chart.addEventListener("keydown", (e) => {
    const target = e.target.closest("[data-corr-drag]");
    if (!target) return;
    const type = target.dataset.corrDrag;
    if (type === "observation" && ["Delete", "Backspace"].includes(e.key)) {
      e.preventDefault();
      remove(target.dataset.id);
      return;
    }
    if (type === "observation" && ["Enter", " "].includes(e.key)) {
      e.preventDefault();
      ctx.update({ selectedId: target.dataset.id });
      return;
    }
    if (
      ![
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "Home",
        "End",
      ].includes(e.key)
    )
      return;
    e.preventDefault();
    const dx = xSpan * (e.shiftKey ? 0.05 : 0.01),
      dy = ySpan * (e.shiftKey ? 0.05 : 0.01);
    if (type === "prediction") {
      updatePrediction(
        e.key === "Home"
          ? prediction.low
          : e.key === "End"
            ? prediction.high
            : prediction.x +
              (["ArrowLeft", "ArrowDown"].includes(e.key) ? -dx : dx),
      );
    } else if (type === "line") {
      const p = s.lineAnchors[target.dataset.side];
      const patch = moveLineHandle(
        s,
        target.dataset.side,
        p.x + (e.key === "ArrowLeft" ? -dx : e.key === "ArrowRight" ? dx : 0),
        e.key === "Home"
          ? s.yMin
          : e.key === "End"
            ? s.yMax
            : p.y +
              (e.key === "ArrowUp" ? dy : e.key === "ArrowDown" ? -dy : 0),
      );
      if (patch) ctx.update(patch);
    } else {
      const id = target.dataset.id;
      ctx.update({
        selectedId: id,
        points: points.map((p) =>
          p.id === id
            ? {
                ...p,
                x: clamp(
                  p.x +
                    (e.key === "ArrowLeft"
                      ? -dx
                      : e.key === "ArrowRight"
                        ? dx
                        : 0),
                  Math.max(-1e6, s.xMin),
                  Math.min(1e6, s.xMax),
                ),
                y: clamp(
                  e.key === "Home"
                    ? s.yMin
                    : e.key === "End"
                      ? s.yMax
                      : p.y +
                        (e.key === "ArrowUp"
                          ? dy
                          : e.key === "ArrowDown"
                            ? -dy
                            : 0),
                  Math.max(-1e6, s.yMin),
                  Math.min(1e6, s.yMax),
                ),
              }
            : p,
        ),
      });
    }
  });
  root.querySelector("#corr-manual").onchange = (e) => {
    if (!e.target.checked) {
      ctx.update({ manual: false });
      return;
    }
    const clipped = visiblePrediction(
      s,
      fitOK ? fit.slope : 0,
      fitOK ? fit.intercept : mean(points.map((p) => p.y)),
    );
    if (!clipped) return;
    const x1 = clipped.low + (clipped.high - clipped.low) * 0.2,
      x2 = clipped.low + (clipped.high - clipped.low) * 0.8;
    const m = fitOK ? fit.slope : 0,
      b = fitOK ? fit.intercept : mean(points.map((p) => p.y));
    ctx.update({
      manual: true,
      manualSlope: m,
      manualIntercept: b,
      lineHandleGap: Math.max(
        (x2 - x1) * 0.02,
        Number.EPSILON * Math.max(1, Math.abs(x1), Math.abs(x2)) * 8,
      ),
      lineAnchors: {
        left: { x: x1, y: m * x1 + b },
        right: { x: x2, y: m * x2 + b },
      },
    });
  };
  for (const [id, key] of [
    ["corr-residuals", "showResiduals"],
    ["corr-squares", "showSquares"],
    ["corr-holdout", "excludeSelected"],
  ])
    root.querySelector(`#${id}`).onchange = (e) =>
      ctx.update({
        [key]: e.target.checked,
        ...(key === "showSquares" && e.target.checked
          ? { showResiduals: true }
          : {}),
        ...(key === "showResiduals" && !e.target.checked
          ? { showSquares: false }
          : {}),
      });
  root
    .querySelector("#corr-best")
    ?.addEventListener("click", () => ctx.update({ manual: false }));
  const details = root.querySelector("#corr-details");
  details.addEventListener("toggle", () => {
    if (details.open !== Boolean(s.correlationDetailsOpen))
      ctx.update({ correlationDetailsOpen: details.open });
  });
}

export default {
  id: "correlation",
  title: "散布図と相関・回帰",
  description: "点を動かし、関係の強さ・外れ値・予測の限界を調べる。",
  lead: "復習時間が長い人ほど得点は高い？ まず点を1つ動かしてみましょう。相関の強さと予測の確かさは、同じ意味ではありません。",
  initial,
  normalize: normalizeCorrelation,
  render,
  explanation: `<h2>相関と回帰で、何がわかる？</h2><p>散布図は2つの量の組を1点で表します。右上がりなら正の相関、右下がりなら負の相関。相関係数 r は −1〜1で、直線的な関係を測ります。r ≈ 0でも曲線の関係があることがあり、因果関係がないことを意味しません。</p><h3>残差を二乗する理由</h3><p>回帰直線 ŷ = ax + b の残差は y − ŷ。正負の残差を足すだけでは打ち消し合います。最小二乗法は二乗の合計を最小にします。傾き a = Σ(x−x̄)(y−ȳ) / Σ(x−x̄)²、切片 b = ȳ − ax̄ です。二乗は大きな誤差を強く重視するため、外れ値、とくにxの端にある点が直線を大きく動かす場合があります。</p><h3>予測と限界</h3><p>回帰は集団としての傾向です。同じ復習時間でも得点が違い、既習知識や睡眠など、この図にない要因もあります。学習に使わなかった点で誤差を確かめることが大切です。1点だけの検証で性能を判断せず、複数の点・別の時期でも比較しましょう。学習した範囲外への外挿や、得点の上限を超える予測には特に注意します。</p><h3>相関があっても、原因とは限らない</h3><p>「復習時間が長い人ほど高得点」は、「時間を増やしたから得点が上がった」という証明ではありません。学習意欲が両方に影響する、苦手な人が長く復習する、といった別の説明があります。原因を調べるには条件をそろえた比較や無作為化などが必要です。この教材は独自に作った架空データで、効果を主張する調査結果ではありません。</p><p>点が2つ未満、またはxがすべて同じなら傾きは定まりません。xかyの標準偏差が0ならrは未定義です。この教材のRMSEは記述用の √(SSE/n) で、回帰誤差の標準偏差の推定に使う √(SSE/(n−2)) とは区別します。</p>`,
  related: ["histogram", "summary", "projects", "hypothesis-test"],
};

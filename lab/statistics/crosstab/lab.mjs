import {
  academicExplanation,
  readingNotes,
} from "../shared/reading.mjs?v=20261024-proportional-area";
import { esc, svg } from "../shared/ui.mjs";

const METHOD = ["A方式", "B方式"];
const OUTCOME = ["達成", "未達成"];
import {
  aggregateRecords,
  areaDiagram,
  denominatorRegions,
  tableValues,
} from "./records.mjs?v=20261024-proportional-area";
const STRATA = ["初級課題", "応用課題"];
const MODES = [
  ["count", "人数"],
  ["row", "行比率：方式ごとの割合"],
  ["column", "列比率：結果ごとの割合"],
  ["cell", "セル比率：全体に占める割合"],
];
const pct = (v) =>
  v === null || !Number.isFinite(v) ? "—" : `${(100 * v).toFixed(1)}%`;
const bounded = (v, low, high) =>
  Math.min(high, Math.max(low, Number.isFinite(Number(v)) ? Number(v) : low));

export function makeInitial() {
  return {
    strata: [
      {
        counts: [
          [18, 2],
          [64, 16],
        ],
      },
      {
        counts: [
          [24, 56],
          [4, 16],
        ],
      },
    ],
    anchors: [
      [0.9, 0.8],
      [0.3, 0.2],
    ],
    mode: "row",
    view: "both",
    selectedScope: "all",
    selectedRow: 0,
    selectedCol: 0,
    equalShare: 50,
    showCounts: false,
  };
}

export function normalizeState(state = {}) {
  const base = makeInitial();
  const strata = base.strata.map((stratum, s) => ({
    counts: stratum.counts.map((row, r) =>
      row.map((value, c) => {
        const raw = state.strata?.[s]?.counts?.[r]?.[c];
        return raw === undefined
          ? value
          : Math.round(bounded(raw, 0, 100000000));
      }),
    ),
  }));
  return {
    ...base,
    ...state,
    strata: Array.isArray(state.records)
      ? aggregateRecords(
          state.records,
          state.dataInfo?.labels || {
            strata: STRATA,
            methods: METHOD,
            outcomes: OUTCOME,
          },
        )
      : strata,
    anchors: base.anchors.map((row, s) =>
      row.map((value, r) => bounded(state.anchors?.[s]?.[r] ?? value, 0, 1)),
    ),
    mode: MODES.some(([v]) => v === state.mode) ? state.mode : base.mode,
    view: ["both", "all", "strata"].includes(state.view)
      ? state.view
      : base.view,
    selectedScope: ["all", "0", "1"].includes(String(state.selectedScope))
      ? String(state.selectedScope)
      : "all",
    selectedRow: [-1, 0, 1].includes(state.selectedRow) ? state.selectedRow : 0,
    selectedCol: [-1, 0, 1].includes(state.selectedCol) ? state.selectedCol : 0,
    equalShare: bounded(state.equalShare ?? 50, 0, 100),
  };
}

export function matrixFor(strata, scope = "all") {
  if (scope !== "all")
    return strata[Number(scope)].counts.map((row) => [...row]);
  return [0, 1].map((r) =>
    [0, 1].map((c) =>
      strata.reduce((total, stratum) => total + stratum.counts[r][c], 0),
    ),
  );
}

export function cellSummary(matrix, row, col, mode) {
  const numerator = matrix.reduce(
    (sum, values, r) =>
      sum +
      values.reduce(
        (subtotal, value, c) =>
          subtotal +
          ((row < 0 || r === row) && (col < 0 || c === col) ? value : 0),
        0,
      ),
    0,
  );
  const all = matrix.flat().reduce((a, b) => a + b, 0);
  const denominator =
    mode === "row" && row >= 0
      ? matrix[row][0] + matrix[row][1]
      : mode === "column" && col >= 0
        ? matrix[0][col] + matrix[1][col]
        : all;
  return {
    numerator,
    denominator,
    ratio: denominator ? numerator / denominator : null,
    count: mode === "count",
  };
}

export function successRate(matrix, method) {
  const total = matrix[method][0] + matrix[method][1];
  return total ? matrix[method][0] / total : null;
}

export function equalCompositionRates(strata, easyShare = 0.5) {
  return [0, 1].map((r) => {
    const rates = strata.map((s) => successRate(s.counts, r));
    if (
      (easyShare > 0 && rates[0] === null) ||
      (easyShare < 1 && rates[1] === null)
    )
      return null;
    return (rates[0] ?? 0) * easyShare + (rates[1] ?? 0) * (1 - easyShare);
  });
}

// The rate anchors prevent rounding errors from accumulating during repeated slider moves.
export function setComposition(state, method, easyPercentage) {
  const next = normalizeState(state);
  const total = next.strata.reduce(
    (n, s) => n + s.counts[method][0] + s.counts[method][1],
    0,
  );
  const easy = Math.round((total * bounded(easyPercentage, 0, 100)) / 100);
  [easy, total - easy].forEach((count, s) => {
    const success = Math.round(count * next.anchors[s][method]);
    next.strata[s].counts[method] = [success, count - success];
  });
  delete next.records;
  return next;
}

export function editCount(state, stratum, method, outcome, value) {
  const next = normalizeState(state);
  const inputMaximum = Math.max(
    10000,
    next.strata[stratum].counts[method][outcome],
  );
  next.strata[stratum].counts[method][outcome] = Math.round(
    bounded(value, 0, inputMaximum),
  );
  const rate = successRate(next.strata[stratum].counts, method);
  if (rate !== null) next.anchors[stratum][method] = rate;
  delete next.records;
  return next;
}

function displayLabels(state) {
  const l = state.dataInfo?.labels;
  return {
    METHOD: l?.methods || METHOD,
    STRATA: l?.strata || STRATA,
    OUTCOME: l?.outcomes || OUTCOME,
  };
}
function dataTable(state, scope, title) {
  const { METHOD, OUTCOME } = displayLabels(state);
  const values = tableValues(matrixFor(state.strata, scope), state.mode);
  const display = (v) => (state.mode === "count" ? `${v}人` : pct(v));
  return `<section class="panel crosstab-table-panel" data-crosstab-table="${scope}"><h3>${esc(title)}</h3><table class="stat-table crosstab-table"><caption>${esc(title)}・${esc(MODES.find(([v]) => v === state.mode)[1])}</caption><thead><tr><th scope="col">方式</th>${[...OUTCOME, "合計"].map((v) => `<th scope="col">${esc(v)}</th>`).join("")}</tr></thead><tbody>${values.map((row, r) => `<tr><th scope="row">${esc(r < 2 ? METHOD[r] : "合計")}</th>${row.map((v) => `<td>${display(v)}</td>`).join("")}</tr>`).join("")}</tbody></table></section>`;
}
function reversalExplanation(state) {
  const { METHOD, STRATA, OUTCOME } = displayLabels(state),
    combined = matrixFor(state.strata);
  const rates = [0, 1].map((r) => successRate(combined, r));
  const winner = [0, 1].find((r) =>
    state.strata.every(
      (s) =>
        successRate(s.counts, r) !== null &&
        successRate(s.counts, 1 - r) !== null &&
        successRate(s.counts, r) > successRate(s.counts, 1 - r),
    ),
  );
  const share = (r) => {
    const n = combined[r][0] + combined[r][1];
    return n ? state.strata[0].counts[r].reduce((a, b) => a + b, 0) / n : null;
  };
  if (
    winner !== undefined &&
    rates.every((v) => v !== null) &&
    rates[winner] < rates[1 - winner]
  ) {
    const other = 1 - winner,
      easier = state.strata.findIndex((s) =>
        [0, 1].every(
          (r) =>
            successRate(s.counts, r) >
            successRate(state.strata[1 - state.strata.indexOf(s)].counts, r),
        ),
      );
    const easy = easier >= 0 ? easier : 0,
      shareEasy = (r) =>
        easy === 0 ? share(r) : share(r) === null ? null : 1 - share(r);
    return `合計では${METHOD[other]}の${OUTCOME[0]}率が高いのに、${STRATA[0]}と${STRATA[1]}に分けると、どちらも${METHOD[other]}の方が低くなります。${METHOD[other]}は${OUTCOME[0]}しやすい${STRATA[easy]}に取り組んだ人が${pct(shareEasy(other))}（${METHOD[winner]}は${pct(shareEasy(winner))}）と多いため、合計の率が高くなっています。このように合計と課題別で大小が逆転する現象を、シンプソンのパラドックスといいます。`;
  }
  return `合計の${OUTCOME[0]}率は、課題ごとの${OUTCOME[0]}率を、その課題に取り組んだ人数で重み付けした平均です。${STRATA[0]}と${STRATA[1]}の人数の偏りも合わせて比べましょう。`;
}
function comparisonChart(state) {
  const { METHOD, STRATA, OUTCOME } = displayLabels(state);
  const sections = [
    ["合計", matrixFor(state.strata)],
    ...state.strata.map((s, i) => [STRATA[i], s.counts]),
  ];
  const left = 145,
    width = 470;
  let content =
    '<defs><pattern id="ct-method-b" width="7" height="7" patternUnits="userSpaceOnUse"><rect width="7" height="7" fill="#b85614"/><path d="M-2 2L2-2M0 7L7 0M5 9L9 5" stroke="#fff" stroke-opacity=".45" stroke-width="1.5"/></pattern></defs>';
  for (const p of [0, 25, 50, 75, 100]) {
    const x = left + (width * p) / 100;
    content += `<line x1="${x}" x2="${x}" y1="20" y2="320" stroke="#dbe2e8"/><text x="${x}" y="345" text-anchor="middle">${p}%</text>`;
  }
  sections.forEach(([name, matrix], s) => {
    const y = 35 + s * 100;
    content += `<text x="8" y="${y + 18}" class="ct-section-label">${esc(name)}</text>`;
    for (const r of [0, 1]) {
      const rate = successRate(matrix, r),
        yy = y + r * 32;
      content += `<text x="135" y="${yy + 18}" text-anchor="end">${esc(METHOD[r])}</text><rect x="${left}" y="${yy}" width="${width}" height="23" rx="3" fill="#e7ecf0"/>`;
      if (rate !== null)
        content += `<rect x="${left}" y="${yy}" width="${width * rate}" height="23" rx="3" fill="${r ? "url(#ct-method-b)" : "#176660"}"/>`;
      content += `<text x="630" y="${yy + 18}">${pct(rate)}</text>`;
    }
  });
  return svg(content, `合計・${STRATA.join("・")}の${OUTCOME[0]}率`, 720, 365);
}
function denominatorDiagram(state) {
  const { METHOD, STRATA, OUTCOME } = displayLabels(state),
    matrix = matrixFor(state.strata, state.selectedScope);
  const { numerator, denominator, ratio } = cellSummary(
    matrix,
    state.selectedRow,
    state.selectedCol,
    state.mode,
  );
  const scope =
    state.selectedScope === "all"
      ? "全体"
      : STRATA[Number(state.selectedScope)];
  const describePeople = (method, outcome) => {
    const prefix = scope === "全体" ? "" : `${scope}の`;
    if (outcome < 0)
      return method < 0 ? `${prefix}全員` : `${prefix}${METHOD[method]}の全員`;
    return method < 0
      ? `${scope === "全体" ? "" : scope + "で"}${OUTCOME[outcome]}した人`
      : `${prefix}${METHOD[method]}で${OUTCOME[outcome]}した人`;
  };
  const numeratorText = describePeople(state.selectedRow, state.selectedCol);
  const base =
    state.mode === "row"
      ? describePeople(state.selectedRow, -1)
      : state.mode === "column"
        ? describePeople(-1, state.selectedCol)
        : describePeople(-1, -1);
  const regions = denominatorRegions(
    state.strata,
    state.selectedScope,
    state.selectedRow,
    state.selectedCol,
    state.mode,
  );
  const layout = areaDiagram(state.strata);
  const shortTask = (name) => name.replace(/課題$/, "");
  let content =
    '<defs><pattern id="ct-numerator" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#8d3c0b"/><path d="M-2 2L2-2M0 8L8 0M6 10L10 6" stroke="#fff" stroke-opacity=".3" stroke-width="1.5"/></pattern></defs>';
  for (const band of layout.methods)
    content += `<text x="68" y="${band.y + band.height / 2 + 5}" text-anchor="end" class="ct-method-label">${esc(METHOD[band.method])}</text>`;
  for (const box of layout.regions) {
    const {
      stratum: s,
      method: r,
      outcome: c,
      count,
      x,
      y,
      width,
      height,
    } = box;
    const region = regions.find(
      (part) => part.stratum === s && part.method === r && part.outcome === c,
    );
    const fill = region.inNumerator
      ? "url(#ct-numerator)"
      : region.inDenominator
        ? "#c9e6de"
        : "#edf0f2";
    const id = `${s},${r},${c}`,
      clip = `ct-region-clip-${s}-${r}-${c}`;
    const text = `${shortTask(STRATA[s])}・${OUTCOME[c]} ${count}人`;
    content += `<clipPath id="${clip}" clipPathUnits="userSpaceOnUse"><rect x="${x}" y="${y}" width="${width}" height="${height}"/></clipPath><rect x="${x}" y="${y}" width="${width}" height="${height}" data-ct-region="${id}" data-ct-count="${count}" data-ct-numerator="${region.inNumerator}" data-ct-denominator="${region.inDenominator}" fill="${fill}" stroke="#839b91" stroke-width="1" role="img" aria-label="${esc(METHOD[r])}・${esc(STRATA[s])}・${esc(OUTCOME[c])} ${count}人"><title>${esc(METHOD[r])}・${esc(STRATA[s])}・${esc(OUTCOME[c])} ${count}人（${region.inNumerator ? "分子・分母に含む" : region.inDenominator ? "分母に含む" : "分母に含まない"}）</title></rect><text x="${x + width / 2}" y="${y + height / 2 - 4}" data-ct-region-label="${id}" class="ct-area-label ${region.inNumerator ? "ct-area-selected" : ""}" text-anchor="middle" clip-path="url(#${clip})" aria-label="${esc(text)}">${esc(shortTask(STRATA[s]))}・${esc(OUTCOME[c])}</text><text x="${x + width / 2}" y="${y + height / 2 + 12}" data-ct-region-number="${id}" class="ct-area-label ${region.inNumerator ? "ct-area-selected" : ""}" text-anchor="middle" clip-path="url(#${clip})">${count}人</text>`;
  }
  const smallRegions = layout.regions.filter(
    (box) => box.width < 96 - 1e-8 || box.height < 36 - 1e-8,
  );
  const smallLabels = smallRegions
    .map(
      (box) =>
        `<span class="ct-small-region-label">${esc(METHOD[box.method])}・${esc(shortTask(STRATA[box.stratum]))}・${esc(OUTCOME[box.outcome])} ${box.count}人</span>`,
    )
    .join("");
  const calculation = denominator
    ? `${numerator}人 ÷ ${denominator}人 × 100 = ${pct(ratio)}`
    : "分母が0人のため割合は求められません";
  return `<section class="panel chart-panel crosstab-denominator"><h3>分子と分母</h3><div class="ct-formula"><span>分子：${esc(numeratorText)} <strong>${numerator}人</strong></span><span>分母：${esc(base)} <strong>${denominator}人</strong></span><strong>${calculation}</strong></div>${`<div class="ct-diagram-scroll" style="--ct-diagram-width:${layout.width}px;--ct-diagram-height:${layout.height}px" tabindex="0" role="region" aria-label="人数に面積が比例する分子と分母の図。スクロールできます。">${svg(content, `${METHOD[0]}と${METHOD[1]}の人数に面積が比例する図。初級は上、応用は下、達成は左、未達成は右。`, layout.width, layout.height)}</div>`}<div class="legend ct-area-legend"><span><i class="ct-key ct-key-numerator"></i>斜線＝分子</span><span><i class="ct-key ct-key-base"></i>斜線＋薄緑＝分母</span><span><i class="ct-key ct-key-excluded"></i>灰色＝分母の外</span>${smallLabels}</div></section>`;
}
function choices(id, label, options, value, key, numeric = false) {
  return `<fieldset class="ct-choice-group"><legend>${esc(label)}</legend><div class="ct-choice-options">${options.map(([v, text]) => `<label class="ct-choice"><input type="radio" id="${id}-${esc(v)}" name="${id}" value="${esc(v)}" data-ct-state="${key}" ${numeric ? "data-ct-number" : ""} ${String(v) === String(value) ? "checked" : ""}><span>${esc(text)}</span></label>`).join("")}</div></fieldset>`;
}
export default {
  id: "crosstab",
  title: "クロス集計",
  description:
    "1人ずつの記録から人数と割合を集計し、課題難度による違いを比べる。",
  lead: "1人ごとの課題難度・方式・結果を集計します。合計と課題別で達成率が逆転する理由も確かめましょう。",
  initial: makeInitial,
  normalize: normalizeState,
  render(root, ctx) {
    const state = normalizeState(ctx.state),
      view = ctx.view || 0,
      { METHOD, STRATA, OUTCOME } = displayLabels(state);
    const scopes = [
      ["all", "合計"],
      ...STRATA.map((name, i) => [String(i), name]),
    ];
    let toolbar = "",
      content = "";
    if (view === 0) {
      toolbar = choices(
        "ct-mode",
        "表の表示",
        [
          ["count", "人数"],
          ["row", "行比率"],
          ["column", "列比率"],
          ["cell", "セル比率"],
        ],
        state.mode,
        "mode",
      );
      content = `<div class="ct-tables"><div class="ct-table-grid">${scopes.map(([scope, title]) => dataTable(state, scope, title)).join("")}</div></div>`;
    } else if (view === 1) {
      content = `<section class="chart-panel"><h3>合計と課題別の${esc(OUTCOME[0])}率</h3>${comparisonChart(state)}<p class="annotation" role="status">${esc(reversalExplanation(state))}</p></section>`;
    } else {
      const ratioMode = state.mode === "count" ? "row" : state.mode;
      state.mode = ratioMode;
      toolbar =
        choices(
          "ct-scope",
          "課題難度",
          scopes.map(([value, label]) => [
            value,
            value === "all" ? "全体" : label,
          ]),
          state.selectedScope,
          "selectedScope",
        ) +
        choices(
          "ct-row",
          "方式",
          [["-1", "全体"], ...METHOD.map((name, i) => [String(i), name])],
          state.selectedRow,
          "selectedRow",
          true,
        ) +
        choices(
          "ct-col",
          "結果",
          [["-1", "全体"], ...OUTCOME.map((name, i) => [String(i), name])],
          state.selectedCol,
          "selectedCol",
          true,
        ) +
        choices(
          "ct-mode",
          "割合の分母",
          [
            ["cell", "全体"],
            ["row", "方式ごと"],
            ["column", "結果ごと"],
          ],
          ratioMode,
          "mode",
        );
      content = denominatorDiagram(state);
    }
    const notes = readingNotes("crosstab", view, state);
    root.innerHTML = `<div class="analysis-toolbar ct-controls" role="group" aria-label="このタブの操作">${toolbar}</div>${content}<details class="analysis-notes"><summary>解説</summary>${notes.map((t) => `<p>${esc(t)}</p>`).join("")}</details>`;
    root.querySelectorAll("input[data-ct-state]").forEach((input) => {
      input.addEventListener("change", () => {
        if (!input.checked) return;
        const view = root.ownerDocument.defaultView;
        const position = { left: view.scrollX, top: view.scrollY };
        const previousPlot = root.querySelector(".ct-diagram-scroll");
        const plotPosition = {
          left: previousPlot?.scrollLeft || 0,
          top: previousPlot?.scrollTop || 0,
        };
        const fullscreen = Boolean(
          root.closest(".statistics-fullscreen")?.open,
        );
        ctx.update({
          [input.dataset.ctState]: input.hasAttribute("data-ct-number")
            ? Number(input.value)
            : input.value,
        });
        const controls = root.querySelector(".ct-controls");
        const restorePosition = () => {
          // Ignore a stale frame after the user has already switched tabs.
          if (root.querySelector(".ct-controls") !== controls) return;
          const plot = root.querySelector(".ct-diagram-scroll");
          if (plot) {
            plot.scrollLeft = plotPosition.left;
            plot.scrollTop = plotPosition.top;
          }
          if (
            !fullscreen &&
            (view.scrollX !== position.left || view.scrollY !== position.top)
          )
            view.scrollTo({ ...position, behavior: "instant" });
        };
        restorePosition();
        view.requestAnimationFrame(restorePosition);
      });
    });
  },
  explanation: academicExplanation("crosstab"),
  related: ["sampling", "correlation", "hypothesis-test"],
};

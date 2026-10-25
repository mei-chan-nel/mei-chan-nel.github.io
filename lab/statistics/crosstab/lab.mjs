import {
  chartKey,
  groupPattern,
  esc,
  svg,
} from "../shared/ui.mjs?v=20261025-compact-test";
import {
  academicExplanation,
  readingNotes,
} from "../shared/reading.mjs?v=20261025-compact-test";

const METHOD = ["A方式", "B方式"];
const OUTCOME = ["達成", "未達成"];
import {
  aggregateRecords,
  areaDiagram,
  denominatorRegions,
  tableValues,
} from "./records.mjs?v=20261025-compact-test";
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
    selectedRow: state.selectedRow === 1 ? 1 : 0,
    selectedCol: state.selectedCol === 1 ? 1 : 0,
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
  return `<section class="panel crosstab-table-panel" data-crosstab-table="${scope}"><h3>${esc(title)}</h3><table class="stat-table crosstab-table"><caption>${esc(title)}・${esc(state.mode === "count" ? "人数" : state.mode === "row" ? "行比率" : state.mode === "column" ? "列比率" : "セル比率")}</caption><thead><tr><th scope="col">${esc(state.dataInfo?.labels?.fields?.[1] || "方式")}</th>${[...OUTCOME, "合計"].map((v) => `<th scope="col">${esc(v)}</th>`).join("")}</tr></thead><tbody>${values.map((row, r) => `<tr><th scope="row">${esc(r < 2 ? METHOD[r] : "合計")}</th>${row.map((v) => `<td>${display(v)}</td>`).join("")}</tr>`).join("")}</tbody></table></section>`;
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
    return `合計では${METHOD[other]}の${OUTCOME[0]}率が高いのに、${STRATA[0]}と${STRATA[1]}に分けると、どちらも${METHOD[other]}の方が低くなります。${METHOD[other]}は${OUTCOME[0]}しやすい${STRATA[easy]}に属する人が${pct(shareEasy(other))}（${METHOD[winner]}は${pct(shareEasy(winner))}）と多いため、合計の率が高くなっています。このように合計と区分別で大小が逆転する現象を、シンプソンのパラドックスといいます。`;
  }
  return `合計の${OUTCOME[0]}率は、区分ごとの${OUTCOME[0]}率を、その区分に属する人数で重み付けした平均です。${STRATA[0]}と${STRATA[1]}の人数の偏りも合わせて比べましょう。`;
}
function comparisonChart(state) {
  const { METHOD, STRATA, OUTCOME } = displayLabels(state);
  const sections = [
    ["合計", matrixFor(state.strata)],
    ...state.strata.map((s, i) => [STRATA[i], s.counts]),
  ];
  const left = 145,
    width = 470;
  let content = groupPattern("ct-method-b");
  for (const p of [0, 25, 50, 75, 100]) {
    const x = left + (width * p) / 100;
    content += `<line x1="${x}" x2="${x}" y1="20" y2="320" stroke="var(--chart-grid)"/><text x="${x}" y="345" text-anchor="middle">${p}%</text>`;
  }
  sections.forEach(([name, matrix], s) => {
    const y = 35 + s * 100;
    content += `<text x="98" y="${y + 18}" text-anchor="end" class="ct-section-label">${esc(name)}</text>`;
    for (const r of [0, 1]) {
      const rate = successRate(matrix, r),
        yy = y + r * 32;
      content += `<text x="135" y="${yy + 18}" text-anchor="end">${esc(METHOD[r])}</text><rect x="${left}" y="${yy}" width="${width}" height="23" rx="3" fill="var(--chart-context)"/>`;
      if (rate !== null)
        content += `<rect x="${left}" y="${yy}" width="${width * rate}" height="23" rx="3" fill="${r ? "url(#ct-method-b)" : "var(--chart-primary)"}"/>`;
      content += `<text x="630" y="${yy + 18}">${pct(rate)}</text>`;
    }
  });
  return svg(content, `合計・${STRATA.join("・")}の${OUTCOME[0]}率`, 720, 365);
}
export function simpsonComparison(input) {
  const state = normalizeState(input),
    labels = displayLabels(state);
  const scopes = [
    ["all", "合計"],
    ...labels.STRATA.map((name, i) => [String(i), name]),
  ];
  const rows = scopes.map(([scope, label]) => ({
    scope,
    label,
    methods: [0, 1].map((method) => {
      const matrix = matrixFor(state.strata, scope),
        achieved = matrix[method][0],
        total = matrix[method][0] + matrix[method][1];
      return { method, achieved, total, rate: total ? achieved / total : null };
    }),
  }));
  const composition = [0, 1].map((method) => {
    const counts = state.strata.map(
        (s) => s.counts[method][0] + s.counts[method][1],
      ),
      total = counts[0] + counts[1];
    return {
      method,
      counts,
      total,
      shares: counts.map((n) => (total ? n / total : null)),
    };
  });
  const withinWinner = [0, 1].find((method) =>
    rows
      .slice(1)
      .every(
        (row) =>
          row.methods.every((m) => m.rate !== null) &&
          row.methods[method].rate > row.methods[1 - method].rate,
      ),
  );
  const overallWinner =
    rows[0].methods.every((m) => m.rate !== null) &&
    rows[0].methods[0].rate !== rows[0].methods[1].rate
      ? rows[0].methods[0].rate > rows[0].methods[1].rate
        ? 0
        : 1
      : null;
  const reversed =
    withinWinner !== undefined &&
    overallWinner !== null &&
    withinWinner !== overallWinner;
  const easier = [0, 1].find((task) =>
    [0, 1].every(
      (method) =>
        rows[task + 1].methods[method].rate !== null &&
        rows[2 - task].methods[method].rate !== null &&
        rows[task + 1].methods[method].rate >
          rows[2 - task].methods[method].rate,
    ),
  );
  return {
    rows,
    composition,
    standardized: equalCompositionRates(state.strata, 0.5),
    withinWinner: withinWinner ?? null,
    overallWinner,
    reversed,
    easier: easier ?? null,
    labels,
  };
}

function countComparisonPanel(state, comparison) {
  const { METHOD, STRATA, OUTCOME } = comparison.labels;
  const tableRows = comparison.rows
    .map((row) => {
      const [a, b] = row.methods;
      return `<tr data-count-scope="${row.scope}" ${row.scope === state.selectedScope ? 'aria-current="true"' : ""}><th scope="row">${esc(row.label)}</th>${row.methods.map((m, i) => `<td data-count-method="${i}"><span>${m.achieved} / ${m.total}人</span><strong class="${m.rate !== null && row.methods[1 - i].rate !== null && m.rate > row.methods[1 - i].rate ? "ct-rate-ahead" : ""}">${pct(m.rate)}</strong></td>`).join("")}</tr>`;
    })
    .join("");
  const mixture = comparison.composition
    .map(
      (m) =>
        `<p class="ct-mix-detail" data-method-composition="${m.method}"><strong>${esc(METHOD[m.method])}</strong>：${STRATA.map((name, i) => `${esc(name)} ${m.counts[i]}人（${pct(m.shares[i])}）`).join(" ／ ")}</p>`,
    )
    .join("");
  let reason = `合計の率は、人数の多い区分の影響を強く受けます。`;
  if (comparison.easier !== null) {
    const easy = comparison.easier;
    reason = `${esc(STRATA[easy])}は両群とも${esc(OUTCOME[0])}率が高い区分です。${comparison.reversed ? `${esc(METHOD[comparison.overallWinner])}はこの区分の割合が${pct(comparison.composition[comparison.overallWinner].shares[easy])}と多いため、合計の率が高くなっています。` : "この区分に属する人の割合も合わせて比べましょう。"}`;
  }
  const equal = comparison.standardized
    .map((rate, i) => `${esc(METHOD[i])} ${pct(rate)}`)
    .join(" ／ ");
  return `<section class="ct-count-comparison" data-screen-nav-section="人数で比べる"><h3>人数で比べる</h3><table class="stat-table ct-comparison-table"><caption>${esc(OUTCOME[0])}した人数 / 対象人数・${esc(OUTCOME[0])}率（下線は高い方）</caption><thead><tr><th scope="col">範囲</th>${METHOD.map((name, i) => `<th scope="col">${chartKey(name, i ? "var(--chart-secondary)" : "var(--chart-primary)", i ? "diamond" : "point")}</th>`).join("")}</tr></thead><tbody>${tableRows}</tbody></table><div class="ct-composition"><h4>区分ごとの人数の偏り</h4>${mixture}<p class="ct-mix-reason">${reason}</p><p class="ct-equal-mix" data-equal-composition>${esc(STRATA[0])}と${esc(STRATA[1])}が両群とも半分ずつなら、<strong>${equal}</strong>（比較用の計算）。</p></div></section>`;
}

function denominatorDiagram(state) {
  const comparison = simpsonComparison(state),
    { METHOD, STRATA, OUTCOME } = comparison.labels;
  const scope =
    state.selectedScope === "all"
      ? "合計"
      : STRATA[Number(state.selectedScope)];
  const regions = denominatorRegions(
      state.strata,
      state.selectedScope,
      -1,
      0,
      "row",
    ),
    layout = areaDiagram(state.strata);
  const shortTask = (name) => name.replace(/課題$/, "");
  let content =
    groupPattern("ct-count-b-hit") +
    groupPattern("ct-count-b-base", {
      background: "var(--chart-secondary-pale)",
      opacity: 0.2,
    });
  for (const band of layout.methods)
    content += `<text x="68" y="${band.y + band.height / 2 + 5}" text-anchor="end" class="ct-method-label" data-ct-method-y="${band.y + band.height / 2}">${esc(METHOD[band.method])}</text>`;
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
    const fill = !region.inDenominator
      ? "var(--chart-context)"
      : r === 1
        ? c === 0
          ? "url(#ct-count-b-hit)"
          : "url(#ct-count-b-base)"
        : c === 0
          ? "var(--chart-primary)"
          : "var(--chart-primary-pale)";
    const id = `${s},${r},${c}`,
      clip = `ct-region-clip-${s}-${r}-${c}`,
      text = `${shortTask(STRATA[s])}・${OUTCOME[c]} ${count}人`;
    content += `<clipPath id="${clip}" clipPathUnits="userSpaceOnUse"><rect x="${x}" y="${y}" width="${width}" height="${height}"/></clipPath><rect x="${x}" y="${y}" width="${width}" height="${height}" data-ct-region="${id}" data-ct-x="${x}" data-ct-y="${y}" data-ct-width="${width}" data-ct-height="${height}" data-ct-count="${count}" data-ct-numerator="${region.inNumerator}" data-ct-denominator="${region.inDenominator}" data-chart-series="${r ? "B" : "A"}" fill="${fill}" stroke="var(--chart-axis)" stroke-width="1" role="img" aria-label="${esc(METHOD[r])}・${esc(STRATA[s])}・${esc(OUTCOME[c])} ${count}人"><title>${esc(METHOD[r])}・${esc(STRATA[s])}・${esc(OUTCOME[c])} ${count}人</title></rect><text x="${x + width / 2}" y="${y + height / 2 - 4}" data-ct-region-label="${id}" data-ct-label-name="${esc(shortTask(STRATA[s]))}・${esc(OUTCOME[c])}" class="ct-area-label ${region.inNumerator ? "ct-area-selected" : ""}" text-anchor="middle" clip-path="url(#${clip})" aria-label="${esc(text)}">${esc(shortTask(STRATA[s]))}・${esc(OUTCOME[c])}</text><text x="${x + width / 2}" y="${y + height / 2 + 12}" data-ct-region-number="${id}" class="ct-area-label ${region.inNumerator ? "ct-area-selected" : ""}" text-anchor="middle" clip-path="url(#${clip})">${count}人</text>`;
  }
  const boundaries = [
    ...new Set(
      layout.regions
        .filter((box) => box.outcome === 0)
        .map((box) => box.y + box.height),
    ),
  ].filter((y) => y > 12 + 1e-8 && y < 12 + layout.plotHeight - 1e-8);
  for (const y of boundaries)
    content += `<line data-ct-row-divider data-ct-line-y="${y}" x1="80" x2="${80 + layout.plotWidth}" y1="${y}" y2="${y}" stroke="var(--chart-reference)" stroke-width="${Math.abs(y - layout.methods[1].y) < 1e-8 ? 3 : 2}" vector-effect="non-scaling-stroke"/>`;
  const smallLabels = layout.regions
    .map(
      (box) =>
        `<span class="ct-small-region-label" data-ct-region-legend="${box.stratum},${box.method},${box.outcome}">${esc(METHOD[box.method])}・${esc(shortTask(STRATA[box.stratum]))}・${esc(OUTCOME[box.outcome])} ${box.count}人</span>`,
    )
    .join("");
  const description =
    state.selectedScope === "all"
      ? `各群の全員を分母にして、${OUTCOME[0]}した人数と割合を比べます。`
      : `${scope}に属する人を群ごとに分け、${OUTCOME[0]}した人数と割合を比べます。`;
  const figure = svg(
    content,
    `${METHOD[0]}と${METHOD[1]}を同時に比較する人数の面積図。${STRATA[0]}は上、${STRATA[1]}は下、${OUTCOME[0]}は左、${OUTCOME[1]}は右。`,
    layout.width,
    layout.height,
  ).replace(
    "<svg",
    `<svg style="aspect-ratio:${layout.width} / ${layout.height}" data-ct-mosaic data-ct-plot-width="${layout.plotWidth}" data-ct-plot-height="${layout.plotHeight}"`,
  );
  return `<section class="panel chart-panel crosstab-denominator"><h3>実数を比べる</h3><p class="ct-question-summary" role="status">${esc(description)}</p><div class="ct-diagram-scroll" tabindex="0" role="region" aria-label="${esc(METHOD.join("と"))}の人数を同時に比べる図">${figure}</div><div class="legend ct-area-legend">${chartKey(METHOD[0], "var(--chart-primary)", "point")}${chartKey(METHOD[1], "var(--chart-secondary)", "diamond")}<span>濃い色：${esc(OUTCOME[0])} ／ 薄い色：${esc(OUTCOME[1])}</span>${smallLabels}</div>${countComparisonPanel(state, comparison)}</section>`;
}
function choices(
  id,
  label,
  options,
  value,
  key,
  numeric = false,
  className = "",
) {
  return `<fieldset class="ct-choice-group ${className}"><legend>${esc(label)}</legend><div class="ct-choice-options">${options.map(([v, text]) => `<label class="ct-choice"><input type="radio" id="${id}-${esc(v)}" name="${id}" value="${esc(v)}" data-ct-state="${key}" ${numeric ? "data-ct-number" : ""} ${String(v) === String(value) ? "checked" : ""}><span>${esc(text)}</span></label>`).join("")}</div></fieldset>`;
}
export default {
  id: "crosstab",
  title: "クロス集計",
  description:
    "属性の組み合わせから人数と割合を集計し、区分による違いを比べる。",
  lead: "属性の組み合わせを集計します。合計と区分別で割合が逆転する理由も確かめましょう。",
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
      content = `<section class="chart-panel"><h3>合計と区分別の${esc(OUTCOME[0])}率</h3>${comparisonChart(state)}<p class="annotation" role="status">${esc(reversalExplanation(state))}</p></section>`;
    } else {
      toolbar = choices(
        "ct-scope",
        "比べる範囲",
        scopes,
        state.selectedScope,
        "selectedScope",
      );
      content = denominatorDiagram(state);
    }

    const notes = readingNotes("crosstab", view, state);
    root.innerHTML = `<div class="analysis-toolbar ct-controls" role="group" aria-label="このタブの操作">${toolbar}</div>${content}<details class="analysis-notes"><summary>解説</summary>${notes.map((t) => `<p>${esc(t)}</p>`).join("")}</details>`;
    root.querySelectorAll("input[data-ct-state]").forEach((input) => {
      input.addEventListener("change", () => {
        if (!input.checked) return;
        const page = root.ownerDocument.defaultView;
        const position = { left: page.scrollX, top: page.scrollY };
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
            (page.scrollX !== position.left || page.scrollY !== position.top)
          )
            page.scrollTo({ ...position, behavior: "instant" });
        };
        restorePosition();
        page.requestAnimationFrame(restorePosition);
      });
    });
  },
  explanation: academicExplanation("crosstab"),
  related: ["sampling", "correlation", "hypothesis-test"],
};

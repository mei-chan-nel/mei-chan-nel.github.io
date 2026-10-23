import { academicExplanation } from "../shared/reading.mjs?v=20261023-sampling-unified-notes";
import { esc, range, select, metrics, svg, bind } from "../shared/ui.mjs";

const METHOD = ["A方式", "B方式"];
const OUTCOME = ["到達", "未到達"];
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
    strata,
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
  const numerator = matrix[row][col];
  const all = matrix.flat().reduce((a, b) => a + b, 0);
  const denominator =
    mode === "row"
      ? matrix[row][0] + matrix[row][1]
      : mode === "column"
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
  return next;
}

function compositionPercentage(state, method) {
  const easy = state.strata[0].counts[method].reduce((a, b) => a + b, 0);
  const total =
    easy + state.strata[1].counts[method].reduce((a, b) => a + b, 0);
  return total ? (100 * easy) / total : 0;
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
  const { METHOD, STRATA, OUTCOME } = displayLabels(state);
  const matrix = matrixFor(state.strata, scope);
  const total = matrix.flat().reduce((a, b) => a + b, 0);
  return `<section class="panel"><h3>${esc(title)}</h3><p class="muted">数値のセルを選ぶと、「分子・分母」タブで割合の内訳を確認できます。</p><div style="overflow-x:auto"><table class="stat-table"><caption>${esc(title)}・${esc(MODES.find(([v]) => v === state.mode)[1])}</caption><thead><tr><th scope="col">方式</th><th scope="col">${esc(OUTCOME[0])}</th><th scope="col">${esc(OUTCOME[1])}</th><th scope="col">人数計</th></tr></thead><tbody>${matrix
    .map(
      (row, r) =>
        `<tr><th scope="row">${esc(METHOD[r])}</th>${row
          .map((value, c) => {
            const selected =
              state.selectedScope === String(scope) &&
              state.selectedRow === r &&
              state.selectedCol === c;
            const result = cellSummary(matrix, r, c, state.mode);
            const display =
              state.mode === "count" ? `${value}人` : pct(result.ratio);
            return `<td><button type="button" data-cell="${scope},${r},${c}" aria-pressed="${selected}" aria-label="${esc(title)}、${esc(METHOD[r])}、${esc(OUTCOME[c])}、${display}を選択" style="min-width:5.5rem;${selected ? "outline:3px solid var(--accent,#087f8c);outline-offset:1px;" : ""}">${display}</button></td>`;
          })
          .join("")}<td>${row[0] + row[1]}人</td></tr>`,
    )
    .join(
      "",
    )}<tr><th scope="row">人数計</th><td>${matrix[0][0] + matrix[1][0]}人</td><td>${matrix[0][1] + matrix[1][1]}人</td><td>${total}人</td></tr></tbody></table></div></section>`;
}

function denominatorDiagram(state) {
  const { METHOD, STRATA, OUTCOME } = displayLabels(state);
  const matrix = matrixFor(state.strata, state.selectedScope);
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
  const denominatorText =
    state.mode === "row"
      ? `${scope}の${METHOD[state.selectedRow]}の人数`
      : state.mode === "column"
        ? `${scope}で「${OUTCOME[state.selectedCol]}」の人数`
        : `${scope}の全人数`;
  const total = matrix.flat().reduce((a, b) => a + b, 0);
  let content = "";
  const left = 86,
    top = 35,
    width = 560,
    height = 200;
  let y = top;
  if (!total)
    content +=
      '<text x="360" y="125" text-anchor="middle" fill="currentColor" font-size="17">全員0人のため、人数の面積図を描けません</text>';
  for (let r = 0; total && r < 2; r++) {
    const rowTotal = matrix[r][0] + matrix[r][1];
    const h = total ? (height * rowTotal) / total : height / 2;
    content += `<text x="72" y="${y + h / 2 + 5}" text-anchor="end" fill="currentColor" font-size="15">${esc(METHOD[r])}</text>`;
    let x = left;
    for (let c = 0; c < 2; c++) {
      const w = rowTotal ? (width * matrix[r][c]) / rowTotal : width / 2;
      const selected = r === state.selectedRow && c === state.selectedCol;
      const inDenominator =
        state.mode === "row"
          ? r === state.selectedRow
          : state.mode === "column"
            ? c === state.selectedCol
            : true;
      const fill = selected ? "#c16620" : inDenominator ? "#167d8d" : "#d5dce3";
      if (h > 0 && w > 0)
        content += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="white" stroke-width="2"><title>${esc(METHOD[r])}・${esc(OUTCOME[c])} ${matrix[r][c]}人${selected ? "（分子）" : inDenominator ? "（分母に含む）" : "（分母に含まない）"}</title></rect>`;
      if (w > 70 && h > 28)
        content += `<text x="${x + w / 2}" y="${y + h / 2 + 5}" text-anchor="middle" fill="${inDenominator || selected ? "white" : "#344054"}" font-size="15">${esc(OUTCOME[c])} ${matrix[r][c]}</text>`;
      x += w;
    }
    y += h;
  }
  content += `<text x="366" y="270" text-anchor="middle" fill="currentColor" font-size="15">長方形の面積が人数に比例。橙＝選んだ人数、青緑＋橙＝分母</text>`;
  return `<section class="panel"><h3>選んだセルの分子・分母</h3><p><strong>${esc(scope)}・${esc(METHOD[state.selectedRow])}・${esc(OUTCOME[state.selectedCol])}</strong></p>${state.mode === "count" ? `<p>人数は <strong>${numerator}人</strong>。人数表示自体に分母はありません。図は全${total}人の中での位置を示しています。</p>` : `<p><strong>${numerator}人 ÷ ${denominator}人 ${denominator ? `= ${pct(ratio)}` : "→ 分母が0人なので割合を定義できません"}</strong><br><span class="muted">分母：${esc(denominatorText)}</span></p>`}${svg(content, `${esc(scope)}の人数と選択セルの分子・分母`, 720, 300)}<p class="hint">同じセルでも、「誰の中での割合か」を変えると答えが変わります。表を読む前に分母を言葉にしてみましょう。0人の区画には面積がありません。</p></section>`;
}

function comparisonChart(state) {
  const { METHOD, STRATA, OUTCOME } = displayLabels(state);
  const sections = [
    ...state.strata.map((s, i) => [STRATA[i], s.counts]),
    ["合計", matrixFor(state.strata)],
  ];
  let content = "";
  const left = 125,
    width = 500;
  [0, 25, 50, 75, 100].forEach((p) => {
    const x = left + (width * p) / 100;
    content += `<line x1="${x}" x2="${x}" y1="25" y2="330" stroke="#dbe2e8"/><text x="${x}" y="350" text-anchor="middle" font-size="13" fill="currentColor">${p}%</text>`;
  });
  sections.forEach(([name, matrix], s) => {
    const y = 40 + s * 100;
    content += `<text x="8" y="${y + 18}" font-size="15" fill="currentColor">${esc(name)}</text>`;
    [0, 1].forEach((r) => {
      const rate = successRate(matrix, r);
      const yy = y + r * 32;
      content += `<text x="115" y="${yy + 18}" text-anchor="end" font-size="14" fill="currentColor">${esc(METHOD[r])}</text><rect x="${left}" y="${yy}" width="${width}" height="23" rx="3" fill="#e7ecf0"/>`;
      if (rate !== null)
        content += `<rect x="${left}" y="${yy}" width="${width * rate}" height="23" rx="3" fill="${r ? "#c16620" : "#167d8d"}"/>`;
      content += `<text x="637" y="${yy + 18}" font-size="14" fill="currentColor">${pct(rate)}</text>`;
    });
  });
  return svg(
    content,
    "初級・応用・合計におけるA方式とB方式の到達率比較",
    720,
    375,
  );
}

function countsEditor(state) {
  const { METHOD, STRATA, OUTCOME } = displayLabels(state);
  return `<details id="ct-counts" ${state.showCounts ? "open" : ""}><summary>人数を直接編集する（架空の観測データ）</summary><p class="muted">直接入力は各セル0〜10,000人。再配分後は10,000人を超える場合があります。編集後の到達率を、以降の構成比操作の基準にします。</p>${state.strata.map((stratum, s) => `<h4>${esc(STRATA[s])}</h4><div style="overflow-x:auto"><table class="stat-table"><thead><tr><th>方式</th><th>到達</th><th>未到達</th></tr></thead><tbody>${stratum.counts.map((row, r) => `<tr><th scope="row">${esc(METHOD[r])}</th>${row.map((n, c) => `<td><input id="ct-count-${s}-${r}-${c}" data-count="${s},${r},${c}" type="number" min="0" max="${Math.max(10000, n)}" step="1" value="${n}" aria-label="${esc(STRATA[s])}・${esc(METHOD[r])}・${esc(OUTCOME[c])}の人数" style="width:6.5rem;max-width:100%"></td>`).join("")}</tr>`).join("")}</tbody></table></div>`).join("")}</details>`;
}

const aligned = setComposition(setComposition(makeInitial(), 0, 50), 1, 50);

export default {
  id: "crosstab",
  title: "クロス集計とデータの関係",
  description: "割合の分母を確かめ、集団の構成で結論が逆転する現象を探る。",
  lead: "架空の学習方法A・Bを比較します。初級と応用ではAの到達率が高いのに、全員を合計するとBが高い。表のセルと集団構成を操作して、理由を見つけましょう。",
  initial: makeInitial,
  render(root, ctx) {
    const state = normalizeState(ctx.state);
    const { METHOD, STRATA, OUTCOME } = displayLabels(state);
    const combined = matrixFor(state.strata);
    const rates = [0, 1].map((r) => successRate(combined, r));
    const conditional = state.strata.map((s) =>
      [0, 1].map((r) => successRate(s.counts, r)),
    );
    const difference = rates.some((r) => r === null)
      ? null
      : rates[0] - rates[1];
    const bothA = conditional.every(
      (row) => row.every((r) => r !== null) && row[0] > row[1],
    );
    const bothB = conditional.every(
      (row) => row.every((r) => r !== null) && row[0] < row[1],
    );
    const reversed =
      difference !== null &&
      ((bothA && difference < 0) || (bothB && difference > 0));
    const standardized = equalCompositionRates(
      state.strata,
      state.equalShare / 100,
    );
    root.innerHTML = `<div class="controls">${select("ct-mode", "表の表示", MODES, state.mode)}${select(
      "ct-view",
      "集団の分割・統合",
      [
        ["both", "合計と課題別を比べる"],
        ["all", "合計だけを見る"],
        ["strata", "課題別に分けて見る"],
      ],
      state.view,
    )}</div>
      ${metrics([
        [
          `${METHOD[0]}の${OUTCOME[0]}率（合計）`,
          pct(rates[0]),
          `${combined[0][0]} / ${combined[0][0] + combined[0][1]}人`,
        ],
        [
          `${METHOD[1]}の${OUTCOME[0]}率（合計）`,
          pct(rates[1]),
          `${combined[1][0]} / ${combined[1][0] + combined[1][1]}人`,
        ],
        [
          `${METHOD[0]} − ${METHOD[1]}（合計）`,
          difference === null
            ? "—"
            : `${(100 * difference).toFixed(1)}ポイント`,
          reversed ? "課題別と合計で優劣が逆転中" : "課題別の値とも比較しよう",
        ],
      ])}
      <div class="stat-grid"><div><section class="chart-panel"><h3>分けると見える、到達率の違い</h3>${comparisonChart(state)}<p class="annotation" role="status">${reversed ? "シンプソンのパラドックスが現れています。両方の課題で優位な方式が、合計では逆転しています。" : "合計の到達率は、各課題の到達率と、各課題に取り組んだ人数の組み合わせで決まります。"}</p></section>
      ${state.view !== "strata" ? dataTable(state, "all", "すべての課題を合計") : ""}${state.view !== "all" ? state.strata.map((_, s) => dataTable(state, String(s), STRATA[s])).join("") : ""}</div>
      <aside class="panel"><h3>集団構成だけを動かす</h3><p>方式ごとの総人数を保ち、${esc(STRATA[0])}と${esc(STRATA[1])}の人数を配分します。到達率は現在の基準を保って再計算します。</p>
      ${[0, 1].map((r) => range(`ct-share-${r}`, `${METHOD[r]}で${STRATA[0]}に属する人`, Number(compositionPercentage(state, r).toFixed(1)), 0, 100, 1, "%")).join("")}
      <p class="hint">到達者数は整数に丸めます。そのため課題別の到達率が少し変わる場合があります。人数0の課題では到達率を計算できません。</p>
      <h3>同じ構成で比べたら？</h3>${range("ct-equal-share", `共通の${STRATA[0]}の割合`, state.equalShare, 0, 100, 1, "%")}
      <p>現在の課題別到達率を共通の構成で重み付けすると、<strong>${esc(METHOD[0])} ${pct(standardized[0])} ／ ${esc(METHOD[1])} ${pct(standardized[1])}</strong>。</p><p class="muted">これは比較用の標準化した率です。観測された合計の率とは区別します。</p>
      <button type="button" id="ct-align" class="primary">両方式の人数構成をこの割合にそろえる</button><p class="muted">上の予測値と、整数の人数に配分した後の実際の率を比べましょう。</p>
      ${countsEditor(state)}</aside></div>${denominatorDiagram(state)}
      <section class="panel"><h3>この実験から判断できること</h3><p>到達率だけで学習方法の効果を断定できません。初期データではAに応用課題の参加者が多く、難易度が混ざっています。「同じ集団条件で比較したか」「学習前の力も同じか」を確かめる必要があります。架空データは構造を発見するためのもので、実在する学習法の効果を示すものではありません。</p></section>`;
    root
      .querySelector("#ct-mode")
      .addEventListener("change", (e) => ctx.update({ mode: e.target.value }));
    root.querySelector("#ct-view").addEventListener("change", (e) => {
      const view = e.target.value;
      const selectedScope =
        view === "all"
          ? "all"
          : view === "strata" && state.selectedScope === "all"
            ? "0"
            : state.selectedScope;
      ctx.update({ view, selectedScope });
    });
    root.querySelectorAll("[data-cell]").forEach((button) =>
      button.addEventListener("click", () => {
        const [selectedScope, r, c] = button.dataset.cell.split(",");
        ctx.update({
          selectedScope,
          selectedRow: Number(r),
          selectedCol: Number(c),
        });
      }),
    );
    [0, 1].forEach((r) =>
      bind(root, `ct-share-${r}`, (v) =>
        ctx.replace(setComposition(state, r, v)),
      ),
    );
    bind(root, "ct-equal-share", (v) => ctx.update({ equalShare: Number(v) }));
    root
      .querySelector("#ct-align")
      .addEventListener("click", () =>
        ctx.replace(
          setComposition(
            setComposition(state, 0, state.equalShare),
            1,
            state.equalShare,
          ),
        ),
      );
    root.querySelector("#ct-counts").addEventListener("toggle", (e) => {
      if (e.target.open !== Boolean(state.showCounts))
        ctx.update({ showCounts: e.target.open });
    });
    root.querySelectorAll("[data-count]").forEach((input) =>
      input.addEventListener("change", () => {
        const [s, r, c] = input.dataset.count.split(",").map(Number);
        ctx.replace(editCount(state, s, r, c, input.value));
      }),
    );
  },
  explanation: academicExplanation("crosstab"),
  related: ["sampling", "correlation", "hypothesis-test"],
};

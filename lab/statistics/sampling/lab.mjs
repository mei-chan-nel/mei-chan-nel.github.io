import { academicExplanation } from "../shared/reading.mjs?v=20261024-crosstab-layout";
import { mean, fmt } from "../shared/math.mjs";
import { esc, number, select, metrics, svg, bind } from "../shared/ui.mjs";
import {
  population,
  samplingSE,
  newExperiment,
  normalizeExperiment,
  addTrials,
  samplingDomain,
  experimentSummary,
  comparisonSettings,
  compareSampleSizes,
} from "./model.mjs?v=20261024-crosstab-layout";

const positions = new WeakMap();
const unitOf = (state) => (state.customPopulation ? "" : "分");
const axisLabel = (state, prefix) =>
  `${prefix}：${state.dataInfo?.columns?.[0] || (state.customPopulation ? "値" : "読書時間（分）")}`;
const axisValue = (v, tick) =>
  Math.abs(v) >= 1e5 || (v !== 0 && Math.abs(tick) < 0.001)
    ? v.toExponential(1)
    : fmt(v, Math.max(0, -Math.floor(Math.log10(tick))));
const xScale = (domain) => (v) =>
  56 + ((v - domain.xmin) / (domain.xmax - domain.xmin)) * 608;
function xTicks(domain, y, labelsY) {
  const x = xScale(domain);
  const ticks = [];
  for (
    let i = Math.ceil(domain.xmin / domain.tick);
    i * domain.tick <= domain.xmax + domain.tick * 1e-8;
    i++
  ) {
    const v = i * domain.tick || 0;
    ticks.push(
      `<line x1="${x(v)}" x2="${x(v)}" y1="${y}" y2="${y + 5}" stroke="#6b8279"/><text x="${x(v)}" y="${labelsY}" text-anchor="middle">${axisValue(v, domain.tick)}</text>`,
    );
  }
  return ticks.join("");
}
const chartAttributes = (markup, domain, attributes = "") =>
  markup.replace(
    "<svg",
    `<svg data-sampling-domain-min="${domain.xmin}" data-sampling-domain-max="${domain.xmax}" ${attributes}`,
  );

function populationChart(state) {
  const people = population(state.customPopulation),
    counts = new Map();
  state.last.forEach((id) => counts.set(id, (counts.get(id) || 0) + 1));
  const full = document.querySelector("#statistics-fullscreen")?.open;
  const available = Math.min(
    1000,
    window.innerWidth - (full && window.innerWidth >= 760 ? 330 : 80),
  );
  const columns = Math.max(6, Math.min(20, Math.floor(available / 36))),
    width = columns * 36 + 18,
    height = Math.ceil(people.length / columns) * 36 + 18;
  const drawing = people
    .map((person, i) => {
      const count = counts.get(person.id) || 0,
        x = 27 + (i % columns) * 36,
        y = 27 + Math.floor(i / columns) * 36;
      return `<g data-population-id="${person.id}" data-selected="${count > 0}" data-draw-count="${count}"><circle cx="${x}" cy="${y}" r="${count > 1 ? 16 : count ? 14 : 8}" fill="${count ? "#0d514f" : "#e0ece7"}" stroke="${count ? "#172f35" : "#b7c8bd"}" stroke-width="${count ? 2 : 1}"><title>${person.id + 1}番：${person.value}${unitOf(state)}・今回${count}回選択</title></circle>${count ? `<text class="sampling-value" x="${x}" y="${y + (count > 1 ? -5 : 0)}" ${count > 1 ? 'data-label-offset="-5"' : ""} dominant-baseline="central" fill="white" font-size="12" font-weight="700" text-anchor="middle">${esc(person.value)}</text>${count > 1 ? `<text class="sampling-repeat-count" x="${x}" y="${y + 8}" data-label-offset="8" dominant-baseline="central" text-anchor="middle">×${count}</text>` : ""}` : ""}</g>`;
    })
    .join("");
  return svg(
    drawing,
    `${people.length}人の母集団。濃い丸が今回選ばれた人。白い数字は値、×の数字は選ばれた回数。`,
    width,
    height,
  ).replace("<svg", "<svg data-sampling-population");
}

function distributionChart(state, domain) {
  const x = xScale(domain),
    top = 36,
    bottom = 252,
    width = (domain.xmax - domain.xmin) / 32;
  const bins = Array.from({ length: 32 }, (_, i) => ({
    lo: domain.xmin + i * width,
    hi: domain.xmin + (i + 1) * width,
    count: 0,
  }));
  for (const result of state.history)
    bins[
      Math.max(0, Math.min(31, Math.floor((result.mean - domain.xmin) / width)))
    ].count++;
  const peak = Math.max(1, ...bins.map((b) => b.count)),
    ystep = Math.max(1, Math.ceil(peak / 4)),
    ymax = ystep * 4;
  const y = (v) => bottom - (v / ymax) * (bottom - top);
  let drawing = "";
  for (let i = 0; i <= 4; i++)
    drawing += `<line class="gridline" x1="56" x2="664" y1="${y(i * ystep)}" y2="${y(i * ystep)}"/><text x="47" y="${y(i * ystep) + 4}" text-anchor="end">${i * ystep}</text>`;
  drawing += bins
    .filter((b) => b.count)
    .map(
      (b) =>
        `<rect class="bar" x="${x(b.lo) + 0.5}" y="${y(b.count)}" width="${Math.max(0.5, x(b.hi) - x(b.lo) - 1)}" height="${bottom - y(b.count)}"><title>${fmt(b.lo)}以上${fmt(b.hi)}未満：${b.count}回</title></rect>`,
    )
    .join("");
  drawing += `<path class="axis" d="M56,36V252H664"/>${xTicks(domain, 252, 273)}<text x="360" y="297" text-anchor="middle">${esc(axisLabel(state, "標本平均"))}</text><text x="56" y="17">回数</text><line data-sampling-truth x1="360" x2="360" y1="36" y2="252" stroke="#995b10" stroke-width="2" stroke-dasharray="6 4"/><text x="360" y="20" text-anchor="middle">母平均 ${fmt(domain.truth)}${unitOf(state)}</text>`;
  return chartAttributes(
    svg(
      drawing,
      `${state.trials}回の標本平均の分布。中央の破線は固定された母平均。`,
      720,
      305,
    ),
    domain,
  );
}

function sizeComparisonChart(state, comparison) {
  const { domain, series } = comparison,
    x = xScale(domain),
    binWidth = (domain.xmax - domain.xmin) / 32;
  const counts = series.map(({ history }) => {
    const bins = Array(32).fill(0);
    for (const result of history)
      bins[
        Math.max(
          0,
          Math.min(31, Math.floor((result.mean - domain.xmin) / binWidth)),
        )
      ]++;
    return bins;
  });
  const step = Math.max(1, Math.ceil(Math.max(...counts.flat()) / 4)),
    ymax = step * 4;
  let drawing = "";
  series.forEach(({ n }, index) => {
    const top = 35 + index * 180,
      bottom = top + 122,
      y = (count) => bottom - (count / ymax) * (bottom - top),
      color = index ? "#c5651c" : "#176660";
    drawing += `<g data-comparison-series="${index}" data-sample-size="${n}" data-y-max="${ymax}"><text x="56" y="${top - 13}" fill="${color}" font-weight="700">${index ? "◇" : "●"} 標本数 ${n} ・ ${comparison.trials}回</text>`;
    for (let i = 0; i <= 4; i++)
      drawing += `<line class="gridline" x1="56" x2="664" y1="${y(i * step)}" y2="${y(i * step)}"/><text x="47" y="${y(i * step) + 4}" text-anchor="end">${i * step}</text>`;
    counts[index].forEach((count, bin) => {
      if (!count) return;
      const lo = domain.xmin + bin * binWidth,
        hi = lo + binWidth;
      drawing += `<rect data-bin-count="${count}" x="${x(lo) + 0.5}" y="${y(count)}" width="${Math.max(0.5, x(hi) - x(lo) - 1)}" height="${bottom - y(count)}" fill="${index ? "#fffaf1" : color}" stroke="${color}" stroke-width="1.5" ${index ? 'stroke-dasharray="4 2"' : ""}><title>標本数${n}：${fmt(lo)}以上${fmt(hi)}未満 ${count}回</title></rect>`;
    });
    drawing += `<path class="axis" d="M56,${top}V${bottom}H664"/>${xTicks(domain, bottom, bottom + 21)}<line data-sampling-truth x1="360" x2="360" y1="${top}" y2="${bottom}" stroke="#995b10" stroke-width="2" stroke-dasharray="6 4"/></g>`;
  });
  drawing += `<text x="360" y="391" text-anchor="middle">${esc(axisLabel(state, "標本平均（共通の目盛り）"))}</text>`;
  return chartAttributes(
    svg(
      drawing,
      `標本数${series[0].n}と${series[1].n}で各${comparison.trials}回の平均を比較。横軸、階級、縦軸の目盛りは共通。上は塗り棒、下は破線の白抜き棒。`,
      720,
      400,
    ),
    domain,
    "data-sampling-comparison",
  );
}

function sampleNumber(id, label, value, max) {
  return `<label class="control sampling-size-control" for="${id}"><span>${label}</span><span class="sampling-stepper"><input id="${id}" type="number" min="1" max="${max}" step="1" value="${value}" inputmode="numeric"><span class="sampling-step-buttons"><button type="button" id="${id}-increase" data-sample-step="1" data-sample-input="${id}" aria-label="${label}を1増やす" ${value >= max ? "disabled" : ""}>▲</button><button type="button" id="${id}-decrease" data-sample-step="-1" data-sample-input="${id}" aria-label="${label}を1減らす" ${value <= 1 ? "disabled" : ""}>▼</button></span></span></label>`;
}

function intervalChart(state, domain, series) {
  const paired = series.length === 2,
    rowHeight = paired ? 52 : 26,
    height = Math.max(286, state.trials * rowHeight),
    x = xScale(domain);
  const axis = `<text x="360" y="16" text-anchor="middle">母平均 ${fmt(domain.truth)}${unitOf(state)}</text><line data-sampling-truth x1="360" x2="360" y1="24" y2="36" stroke="#995b10" stroke-width="2" stroke-dasharray="5 3"/><path class="axis" d="M56,36H664"/>${xTicks(domain, 36, 55)}<text x="360" y="74" text-anchor="middle">${esc(axisLabel(state, "母平均の推定区間"))}</text>`;
  let rows = "";
  for (let i = state.trials - 1; i >= 0; i--) {
    series.forEach(({ n, history }, index) => {
      const result = history[i],
        y = 14 + (state.trials - 1 - i) * rowHeight + index * 24,
        covers = result.low <= domain.truth && domain.truth <= result.high,
        color = paired
          ? index
            ? "#c5651c"
            : "#176660"
          : covers
            ? "#176660"
            : "#a63c42",
        dash = paired ? (index ? "1 5" : "") : covers ? "" : "5 3",
        cx = x(result.mean),
        fill = covers ? color : "white";
      const marker = index
        ? `<path data-marker-x="${cx}" data-marker-y="${y}" data-marker-radius="4" d="M${cx},${y - 4}L${cx + 4},${y}L${cx},${y + 4}L${cx - 4},${y}Z" fill="${fill}" stroke="${color}" stroke-width="2"/>`
        : `<circle cx="${cx}" cy="${y}" r="4" fill="${fill}" stroke="${color}" stroke-width="2"/>`;
      rows += `<g data-sampling-trial="${i + 1}" data-comparison-series="${index}" data-sample-size="${n}" data-covers="${covers}"><text class="sampling-trial-label" x="47" y="${y + 4}" text-anchor="end">${i + 1}${paired ? (index ? "②" : "①") : ""}</text><line data-interval-line x1="${x(result.low)}" x2="${x(result.high)}" y1="${y}" y2="${y}" stroke="${color}" stroke-width="3" ${paired && index ? 'stroke-linecap="round"' : ""} ${dash ? `stroke-dasharray="${dash}"` : ""}/><line x1="${x(result.low)}" x2="${x(result.low)}" y1="${y - 5}" y2="${y + 5}" stroke="${color}"/><line x1="${x(result.high)}" x2="${x(result.high)}" y1="${y - 5}" y2="${y + 5}" stroke="${color}"/>${marker}<title>第${i + 1}回・標本数${n}：${fmt(result.low)}〜${fmt(result.high)}${unitOf(state)}・母平均を${covers ? "含む" : "含まない"}</title></g>`;
    });
  }
  const key = `${state.signature}/${paired ? series[1].n : "single"}`;
  return `<div class="sampling-intervals">${chartAttributes(svg(axis, "共通の横軸。中央は母平均。", 720, 80), domain, "data-sampling-axis data-fixed-row-chart")}<div class="sampling-history-scroll" tabindex="0" role="region" aria-label="新しい順の推定区間。スクロールで過去の区間へ。" data-history-signature="${esc(key)}" data-history-trials="${state.trials}">${chartAttributes(svg(`<line data-sampling-truth x1="360" x2="360" y1="0" y2="${height}" stroke="#995b10" stroke-width="2" stroke-dasharray="5 4"/>` + rows, `${state.trials}回の推定区間${paired ? "を2種類の標本数で比較" : ""}。塗りつぶしは母平均を含む区間、白抜きは母平均を含まない区間です。`, 720, height), domain, `data-scroll-chart data-fixed-row-chart style="--sampling-history-height:${height}px"`)}</div></div>`;
}

export default {
  id: "sampling",
  title: "標本調査と推定",
  description: "標本数を変え、平均のぶれと信頼区間の幅を比べよう。",
  lead: "母集団の一部を選び、全体の平均を推定します。",
  initial: () => newExperiment(),
  render(root, ctx) {
    const previous = root.querySelector(".sampling-history-scroll");
    if (previous && !previous.closest("[hidden]"))
      positions.set(root, {
        signature: previous.dataset.historySignature,
        trials: Number(previous.dataset.historyTrials),
        offset: previous.scrollTop,
      });
    const state = normalizeExperiment(ctx.state),
      people = population(state.customPopulation),
      values = people.map((p) => p.value),
      truth = mean(values),
      unit = unitOf(state),
      summary = experimentSummary(state.history, truth),
      se = samplingSE(values, state.n, state.method),
      view = ctx.view || 0,
      graphical = view === 1 || view === 2,
      comparing = graphical && state.compareSamples === true,
      settings = comparisonSettings(state),
      comparison = comparing ? compareSampleSizes(state) : null,
      series = comparison?.series || [
        { n: state.n, history: state.history, summary, se },
      ],
      domain =
        comparison?.domain ||
        samplingDomain(values, state.n, state.history, state.method),
      latest = state.history.at(-1);
    const distributionMetrics = comparing
      ? metrics(
          series.map((s, i) => [
            `${i ? "◇ ②" : "● ①"} n=${s.n}：標本平均の標準偏差`,
            s.summary.spread === null
              ? "2回以上で表示"
              : `${fmt(s.summary.spread)}${unit}`,
            `標準誤差 ${fmt(s.se)}${unit} ・ 各${state.trials}回`,
          ]),
        )
      : metrics([
          [
            "推定値の平均",
            `${fmt(summary.center)}${unit}`,
            `母平均 ${fmt(truth)}${unit}`,
          ],
          [
            "推定値の標準偏差",
            summary.spread === null
              ? "2回以上で表示"
              : `${fmt(summary.spread)}${unit}`,
          ],
          ["理論上の標準誤差", `${fmt(se)}${unit}`],
        ]);
    const ratio =
      comparing &&
      series[0].summary.spread > 0 &&
      series[1].summary.spread !== null
        ? series[1].summary.spread / series[0].summary.spread
        : null;
    root.innerHTML = `<div class="stat-grid"><section class="panel chart-panel"><h2>標本数${state.n}の抽出結果</h2>${view === 0 ? populationChart(state) : ""}<p class="legend"><span>濃い丸：今回の標本</span><span>白い数字：値</span>${state.method === "with" ? "<span>×：選ばれた回数</span>" : ""}</p>${metrics(
      [
        ["今回の標本平均", `${fmt(latest.mean)}${unit}`],
        ["母平均", `${fmt(truth)}${unit}`],
        ["標本誤差", `${fmt(latest.mean - truth)}${unit}`, "標本平均 − 母平均"],
        ["選ばれた人数", `${new Set(state.last).size} / ${people.length}人`],
      ],
    )}</section><aside class="panel controls"><h2>調査を設計する</h2>${
      graphical
        ? select(
            "sample-compare-mode",
            "標本数の表示",
            [
              ["single", "1種類"],
              ["paired", "2種類"],
            ],
            comparing ? "paired" : "single",
          )
        : ""
    }${sampleNumber("sample-n", comparing ? "● ① 標本数" : "標本数 n", state.n, people.length)}${comparing ? sampleNumber("sample-compare-second", "◇ ② 標本数", settings.sizes[1], people.length) : ""}${select(
      "sample-method",
      "抽出方法",
      [
        ["without", "重複なし"],
        ["with", "重複あり"],
      ],
      state.method,
    )}${number("sample-seed", "乱数の種", state.seed, 0, 4294967295, 1)}<div class="actions"><button id="sample-one" class="primary" ${state.trials >= 2000 ? "disabled" : ""}>1回抽出</button><button id="sample-many" ${state.trials >= 2000 ? "disabled" : ""}>100回くり返す</button><button id="sample-replay">1回目に戻す</button></div><p class="sampling-reset-note" role="status">${comparing ? "2つの標本数で同じ回数ずつ抽出します。" : ""}条件を変えると、1回目からやり直します。</p></aside></div>
    <section class="panel chart-panel"><h2>${comparing ? `標本数${state.n}と${settings.sizes[1]}・各${state.trials}回` : `標本数${state.n}・${state.trials}回の平均`}</h2>${distributionMetrics}${view === 1 ? (comparing ? sizeComparisonChart(state, comparison) : distributionChart(state, domain)) : ""}<div class="legend sampling-comparison-legend">${comparing ? `<span>● ① n=${state.n}：塗り棒</span><span>◇ ② n=${settings.sizes[1]}：白抜き・破線棒</span>` : ""}<span>橙の破線：母平均 ${fmt(truth)}${unit}</span></div>${ratio === null ? "" : `<p class="annotation" data-size-comparison-reading>②の標本平均のばらつきは、①の${fmt(ratio, 2)}倍です。</p>`}</section>
    <section class="panel chart-panel sampling-interval-panel"><h2>${comparing ? `標本数${state.n}と${settings.sizes[1]}の区間・各${state.trials}回` : `95%信頼区間・${state.trials}回`}</h2>${metrics(
      comparing
        ? series.map((s, i) => [
            `${i ? "◇ ②" : "● ①"} n=${s.n}：母平均を含む割合`,
            `${fmt(s.summary.coverage * 100, 1)}%`,
            `${s.summary.covered}/${state.trials}回 ・ 含まない${fmt((1 - s.summary.coverage) * 100, 1)}% ・ 幅${fmt(3.92 * s.se)}${unit}`,
          ])
        : [
            [
              "母平均を含む区間",
              `${fmt(summary.coverage * 100, 1)}%`,
              `${summary.covered}/${state.trials}回`,
            ],
            [
              "母平均を含まない区間",
              `${fmt((1 - summary.coverage) * 100, 1)}%`,
              `${summary.missed}/${state.trials}回`,
            ],
          ],
    )}<div class="legend sampling-interval-legend">${comparing ? `<span>● ① n=${state.n}：緑の実線</span><span>◇ ② n=${settings.sizes[1]}：オレンジの点線</span>` : ""}<span>塗りつぶし：母平均を含む</span><span>白抜き：母平均を含まない</span><span>橙の縦破線：母平均</span><span>新しい順に表示。スクロールで過去の結果へ。</span></div>${view === 2 ? intervalChart(state, domain, series) : ""}</section>
    `;
    const reset = (patch) => {
      if (Object.entries(patch).some(([key, value]) => state[key] !== value))
        ctx.replace(newExperiment({ ...state, ...patch }));
    };
    const setSize = (id, key) =>
      bind(
        root,
        id,
        (n) =>
          reset({
            [key]: Math.max(1, Math.min(people.length, Math.trunc(n) || 1)),
          }),
        "change",
      );
    setSize("sample-n", "n");
    setSize("sample-compare-second", "compareN");
    for (const button of root.querySelectorAll("[data-sample-step]"))
      button.addEventListener("click", (event) => {
        event.preventDefault();
        const input = root.querySelector(`#${button.dataset.sampleInput}`),
          next = Math.max(
            1,
            Math.min(
              people.length,
              Number(input.value) + Number(button.dataset.sampleStep),
            ),
          );
        reset({ [input.id === "sample-n" ? "n" : "compareN"]: next });
      });
    bind(root, "sample-compare-mode", (mode) =>
      reset({ compareSamples: mode === "paired" }),
    );
    bind(root, "sample-method", (method) => reset({ method }));
    bind(root, "sample-seed", (seed) => reset({ seed }), "change");
    root.querySelector("#sample-one").onclick = () =>
      ctx.replace(addTrials(state, 1));
    root.querySelector("#sample-many").onclick = () =>
      ctx.replace(addTrials(state, 100));
    root.querySelector("#sample-replay").onclick = () =>
      ctx.replace(newExperiment(state));
    const viewport = root.querySelector(".sampling-history-scroll"),
      saved = positions.get(root);
    const offset =
      saved?.signature === viewport?.dataset.historySignature &&
      saved?.trials === state.trials
        ? saved.offset
        : 0;
    requestAnimationFrame(() => {
      if (viewport && root.contains(viewport) && !viewport.closest("[hidden]"))
        viewport.scrollTop = offset;
    });
    viewport?.addEventListener(
      "scroll",
      () =>
        positions.set(root, {
          signature: viewport.dataset.historySignature,
          trials: state.trials,
          offset: viewport.scrollTop,
        }),
      { passive: true },
    );
  },
  explanation: academicExplanation("sampling"),
  related: ["histogram", "probability", "hypothesis-test"],
};

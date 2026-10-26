import {
  chartKey,
  esc,
  number,
  svg,
  axes,
  line,
  bind,
} from "../shared/ui.mjs?v=20261026-final-upgrade";
import {
  academicExplanation,
  readingNotes,
} from "../shared/reading.mjs?v=20261026-final-upgrade";
import { mean, fmt } from "../shared/math.mjs?v=20261026-final-upgrade";
import {
  householdSeries,
  seriesValues,
  seriesMonths,
  seriesLength,
  movingAverageWindow,
  centeredMovingAverage,
  autocorrelations,
  seasonalDecomposition,
  seriesIndicator,
  indicatorScale,
  initialSeriesState,
  normalizeSeriesState,
} from "./model.mjs?v=20261026-final-upgrade";
export {
  centeredMovingAverage,
  movingAverageWindow,
  seriesIndicator,
  autocorrelations,
  linearDetrend,
  seasonalDecomposition,
  normalizeSeriesState,
} from "./model.mjs?v=20261026-final-upgrade";
export function monthLabel(i, state = {}) {
  return (seriesMonths(state)[i] || `${i + 1}か月目`).replace(
    /^(\d{4})-(\d{2})$/,
    (_, y, m) => `${y}年${+m}月`,
  );
}
const num = (v) =>
  v === null || !Number.isFinite(v) ? "—" : fmt(v, Number.isInteger(v) ? 0 : 1);
const signed = (v) =>
  v === null || !Number.isFinite(v) ? "—" : `${v > 0 ? "+" : ""}${fmt(v, 1)}`;
const unitOf = (s) =>
  s.customValues
    ? /[（(]([^）)]+)[）)]/.exec(s.customLabel || "")?.[1] || ""
    : householdSeries.unit;
const annualPeak = (acf) =>
  acf[12] !== null && acf[12] > 0.3 && acf[12] > acf[11] && acf[12] > acf[13];
const pct = (v) => (v === null ? "—" : `${signed(v)}%`);
function brokenLine(values, a, cls = "series") {
  let run = [],
    out = "";
  for (const [x, y] of values.entries()) {
    if (y === null || !Number.isFinite(y)) {
      if (run.length) out += line(run, a.x, a.y, cls);
      run = [];
    } else run.push({ x, y });
  }
  if (run.length) out += line(run, a.x, a.y, cls);
  return out;
}
function calendarAxes(
  values,
  state,
  { zero = true, height = 360, label, scale } = {},
) {
  const valid = values.filter((v) => v !== null && Number.isFinite(v)),
    min = Math.min(0, ...valid),
    max = Math.max(1, ...valid),
    span = Math.max(1, max - min);
  const a = axes({
    xmin: 0,
    xmax: seriesLength(state) - 1,
    ymin: scale ? scale.min : zero ? min : Math.min(...valid, 0) - span * 0.08,
    ymax: scale
      ? scale.max
      : !label && unitOf(state) === "件"
        ? Math.ceil((max + span * 0.12) / 5) * 5
        : max + span * 0.12,
    w: 760,
    h: height,
    ylabel: label || state.customLabel || householdSeries.label,
  });
  let markup = scale
    ? scale.ticks
        .map(
          (v) =>
            `<line class="gridline" x1="58" x2="736" y1="${a.y(v)}" y2="${a.y(v)}"/><text data-ts-y-tick="${v}" x="49" y="${a.y(v) + 4}" text-anchor="end">${esc(fmt(v, scale.digits))}${state.indicator === "index" ? "" : "%"}</text>`,
        )
        .join("") +
      `<path class="axis" d="M58,30V${height - 48}H736"/><text x="58" y="16">${esc(label)}</text>`
    : a.markup.replace(
        /<text x="[^"]+" y="[^"]+" text-anchor="middle">[^<]*<\/text>/g,
        "",
      );
  const n = seriesLength(state);
  markup += [
    ...new Set(
      Array.from({ length: 5 }, (_, i) => Math.round((i * (n - 1)) / 4)),
    ),
  ]
    .map(
      (i) =>
        `<text x="${a.x(i)}" y="${height - 16}" text-anchor="${i === 0 ? "start" : i === n - 1 ? "end" : "middle"}">${esc(monthLabel(i, state).replace("年", ".").replace("月", ""))}</text>`,
    )
    .join("");
  return { ...a, markup, height };
}
function monthPoints(
  values,
  a,
  state,
  { color = "var(--chart-primary)", missingValue = 0 } = {},
) {
  return values
    .map(
      (v, i) =>
        `<circle id="ts-month-${i}" data-month="${i}" cx="${a.x(i)}" cy="${a.y(v === null ? missingValue : v)}" r="${i === state.selected ? 6 : 4}" fill="${v === null ? "white" : color}" stroke="${i === state.selected ? "var(--chart-secondary)" : v === null ? "var(--chart-reference)" : "white"}" stroke-width="${i === state.selected ? 3 : 1.5}" tabindex="0" role="button" aria-pressed="${i === state.selected}" aria-label="${esc(monthLabel(i, state))}：${v === null ? "比較する月がありません" : num(v)}。選ぶと計算を表示"><title>${esc(monthLabel(i, state))}：${num(v)}</title></circle>`,
    )
    .join("");
}
function selectedGuide(a, state) {
  return `<line x1="${a.x(state.selected)}" x2="${a.x(state.selected)}" y1="30" y2="${a.y(0)}" stroke="var(--chart-reference)" stroke-dasharray="4 3"/>`;
}
const legend = (items) =>
  `<div class="legend">${items.map(([label, color, kind]) => chartKey(label, color, kind)).join("")}</div>`;
const panel = (title, body) =>
  `<section class="panel chart-panel ts-panel"><h2>${title}</h2>${body}</section>`;
const detail = (title, body) =>
  `<section class="ts-detail" data-screen-nav-section="${esc(title)}"><h3>${esc(title)}</h3>${body}</section>`;
function radio(id, label, options, value) {
  return `<fieldset class="ts-choice"><legend>${esc(label)}</legend><div>${options.map(([v, l]) => `<label><input type="radio" id="${id}-${v}" name="${id}" value="${v}" ${v === value ? "checked" : ""}><span>${esc(l)}</span></label>`).join("")}</div></fieldset>`;
}
function rollingView(s, values, unit) {
  const ma = centeredMovingAverage(values, s.period),
    i = s.selected,
    w = movingAverageWindow(values, s.period, i),
    a = calendarAxes(values, s),
    n = values.length;
  const shade = w.available
    ? `<rect data-ts-window data-start="${w.start}" data-end="${w.end}" x="${a.x(Math.max(0, w.start - 0.35))}" y="30" width="${a.x(Math.min(n - 1, w.end + 0.35)) - a.x(Math.max(0, w.start - 0.35))}" height="${a.y(0) - 30}" fill="var(--chart-purple-pale)"/>`
    : "";
  const even = s.period % 2 === 0;
  const formula = w.available
    ? values
        .slice(w.start, w.end + 1)
        .map((v, j) => (w.weights[j] === 0.5 ? `${num(v)} × 1/2` : num(v)))
        .join(" ＋ ")
    : "";
  const chart = svg(
    shade +
      a.markup +
      selectedGuide(a, s) +
      brokenLine(values, a) +
      brokenLine(ma, a, "moving-average") +
      monthPoints(values, a, s),
    "選んだ月を中心に、前後の月を使う中心移動平均。偶数月は2つの移動平均を平均して中心化。",
    760,
    360,
  );
  return panel(
    "前後の月で変動をならす",
    `<p class="ts-instruction">点を選ぶと、その月を中心に平均した範囲と計算が切り替わります。</p>${chart}${legend(
      [
        ["元の値", "var(--chart-primary)", "point"],
        [`${s.period}か月中心移動平均`, "var(--chart-purple)", "line-dashed"],
      ],
    )}${detail(monthLabel(i, s), `<dl><div><dt>元の値</dt><dd data-ts-current>${num(values[i])}${esc(unit)}</dd></div><div><dt>${s.period}か月中心移動平均</dt><dd data-ts-average>${num(ma[i])}${esc(unit)}</dd></div></dl><p data-ts-window-label>${w.available ? `${esc(monthLabel(w.start, s))}〜${esc(monthLabel(w.end, s))}を使用。${even ? "両端の月は1/2の重みです。" : ""}` : "前後の月が不足するため、この月の平均は計算しません。"}</p>${w.available ? `<details class="ts-calculation"><summary>この平均の計算</summary><p>（${formula}）÷ ${s.period} ＝ ${num(ma[i])}${esc(unit)}</p>${even ? `<p>偶数の${s.period}か月では、隣り合う2つの${s.period}か月平均をさらに平均し、中心をこの月にそろえます。</p>` : ""}</details>` : ""}<p>12か月周期の波は12か月でならせます。18か月など、周期に合わない幅では波が残ることがあります。</p>`)}`,
  );
}
function acfView(s, values) {
  const maxLag = Math.min(36, values.length - 1),
    acf = autocorrelations(values, maxLag),
    a = axes({
      xmin: 0.5,
      xmax: maxLag + 0.5,
      ymin: -1,
      ymax: 1,
      w: 760,
      h: 360,
      ylabel: "自己相関",
    });
  let drawing =
    a.markup.replace(
      /<text x="[^"]+" y="[^"]+" text-anchor="middle">[^<]*<\/text>/g,
      "",
    ) +
    `<line x1="${a.x(0.5)}" x2="${a.x(maxLag + 0.5)}" y1="${a.y(0)}" y2="${a.y(0)}" stroke="var(--chart-reference)"/>`;
  for (let lag = 1; lag <= maxLag; lag++) {
    const v = acf[lag],
      x = a.x(lag),
      w = (a.x(2) - a.x(1)) * 0.65;
    drawing += `<g id="ts-lag-${lag}" data-ts-lag="${lag}" tabindex="0" role="button" aria-pressed="${lag === s.lag}" aria-label="${lag}か月ずらす。自己相関${v === null ? "は計算できません" : fmt(v, 2)}"><rect x="${x - w / 2}" y="30" width="${w}" height="282" fill="transparent"/>${v === null ? "" : `<rect data-ts-acf-value="${v}" x="${x - w / 2}" y="${a.y(Math.max(0, v))}" width="${w}" height="${Math.abs(a.y(v) - a.y(0))}" fill="${lag === s.lag ? "var(--chart-secondary)" : "var(--chart-primary)"}"/>`}</g>`;
  }
  drawing +=
    [1, 6, 12, 18, 24, 30, 36]
      .filter((k) => k <= maxLag)
      .map(
        (k) => `<text x="${a.x(k)}" y="331" text-anchor="middle">${k}</text>`,
      )
      .join("") +
    '<text x="380" y="354" text-anchor="middle">何か月ずらすか</text>';
  return panel(
    "何か月ずらすと、似た動きになる？",
    `<p class="ts-instruction">長期的な増減を除いて比較します。棒を選ぶと、ずらす月数を確認できます。</p>${svg(drawing, "長期の直線的な増減を除いた自己相関", 760, 360)}${detail(`${s.lag}か月ずらした比較`, `<dl><div><dt>自己相関</dt><dd data-ts-acf>${acf[s.lag] === null ? "—" : fmt(acf[s.lag], 2)}</dd></div></dl><p>${acf[s.lag] === null ? "長期的な増減を除くと変動がないため、自己相関を計算できません。" : `${monthLabel(s.lag, s)}と${monthLabel(0, s)}など、${s.lag}か月離れた${values.length - s.lag}組の値を比べています。`}</p><p data-ts-annual-acf>12か月ずらした自己相関：${acf[12] === null ? "—" : fmt(acf[12], 2)}。${annualPeak(acf) ? "1年周期の手がかりがあります。12か月で平均すると、この繰り返しをならしやすくなります。" : "1年周期が明瞭か、グラフも合わせて確かめましょう。"}</p><p class="ts-small">自己相関だけで平均する月数が決まるわけではありません。ならしたい周期と、変化への反応を比べます。</p>`)}`,
  );
}
function adjustmentView(s, values, decomp, unit) {
  const i = s.selected,
    a = calendarAxes([...values, ...decomp.adjusted], s),
    effect = decomp.seasonal[i % 12];
  const main = svg(
    a.markup +
      selectedGuide(a, s) +
      brokenLine(values, a) +
      `<g stroke="var(--chart-secondary)" stroke-width="2.5" fill="none">${brokenLine(decomp.adjusted, a, "ts-adjusted-line")}</g>` +
      monthPoints(values, a, s),
    "元の値と、毎年繰り返す季節の影響を引いた季節調整後の値",
    760,
    360,
  );
  const max = Math.max(
      1,
      ...decomp.seasonal.filter((v) => v !== null).map(Math.abs),
    ),
    b = axes({
      xmin: -0.5,
      xmax: 11.5,
      ymin: -max * 1.25,
      ymax: max * 1.25,
      w: 760,
      h: 220,
      ylabel: `推定した季節の影響${unit ? "（" + unit + "）" : ""}`,
    });
  let bars = b.markup.replace(
    /<text x="[^"]+" y="[^"]+" text-anchor="middle">[^<]*<\/text>/g,
    "",
  );
  bars += decomp.seasonal
    .map(
      (v, m) =>
        `<rect x="${b.x(m) - 15}" y="${b.y(Math.max(0, v ?? 0))}" width="30" height="${Math.abs(b.y(v ?? 0) - b.y(0))}" fill="var(--chart-secondary)"/><text x="${b.x(m)}" y="193" text-anchor="middle">${esc(monthLabel(m, s).replace(/^\d{4}年/, ""))}</text>`,
    )
    .join("");
  return panel(
    "毎年繰り返す季節の影響を取り除く",
    `<p class="ts-instruction">点を選ぶと、元の値から何を引いたか確認できます。季節調整後は月同士の変化を比べやすくなります。</p>${main}${legend(
      [
        ["元の値", "var(--chart-primary)", "point"],
        ["季節調整後", "var(--chart-secondary)", "line"],
      ],
    )}${detail(monthLabel(i, s), `<dl><div><dt>元の値</dt><dd>${num(values[i])}${esc(unit)}</dd></div><div><dt>推定した季節の影響</dt><dd data-ts-seasonal>${signed(effect)}${esc(unit)}</dd></div><div><dt>季節調整後</dt><dd data-ts-adjusted>${num(decomp.adjusted[i])}${esc(unit)}</dd></div></dl><p data-ts-adjustment-formula>${num(values[i])} −（${signed(effect)}）＝ ${num(decomp.adjusted[i])}${esc(unit)}</p><p>季節の影響がマイナスの月は、その分を補って比較します。</p><p class="ts-small">12か月の中心移動平均との差から、月ごとの季節成分を推定する簡易的な加法モデルです。平均・調整後の値は計算値なので小数になります。</p>`)}<details class="ts-seasonal-detail"><summary>月ごとの季節の影響を見る</summary>${svg(bars, "各月に繰り返す上乗せ・下押し分の推定値。12か月の合計は0。", 760, 220)}</details>`,
  );
}
function indicatorView(s, values, decomp, unit) {
  const source = s.indicatorSource === "adjusted" ? decomp.adjusted : values,
    ind = seriesIndicator(source, s.indicator),
    i = s.selected,
    lag = s.indicator === "growth" ? 1 : 12,
    base = s.indicator === "index" ? 0 : i - lag,
    den = base >= 0 ? source[base] : null,
    v = ind[i],
    isIndex = s.indicator === "index",
    label = isIndex ? "指数（基準月＝100）" : "伸び率（%）",
    scale = indicatorScale(ind, s.indicator),
    a = calendarAxes(ind, s, { label, scale }),
    baseline = scale.baseline,
    referenceLabel = isIndex
      ? "100＝基準月と同じ（1倍）"
      : "0%＝増減なし（1倍）";
  const chart = svg(
    a.markup +
      `<line x1="${a.x(0)}" x2="${a.x(values.length - 1)}" y1="${a.y(baseline)}" y2="${a.y(baseline)}" stroke="var(--chart-reference)" stroke-width="2" stroke-dasharray="4 3"/>` +
      brokenLine(ind, a) +
      monthPoints(ind, a, s, { missingValue: baseline }) +
      `<text data-ts-reference="${baseline}" x="730" y="${a.y(baseline) - 9}" text-anchor="end" font-weight="700" fill="var(--chart-reference)" stroke="white" stroke-width="4" paint-order="stroke">${referenceLabel}</text>`,
    isIndex
      ? "最初の月を100とした各月の指数"
      : "前月または前年同月から、何パーセント増減したか",
    760,
    360,
  ).replace(
    "<svg",
    `<svg data-ts-domain-min="${scale.min}" data-ts-domain-max="${scale.max}"`,
  );
  let result =
    v === null
      ? "<p>比較する月がないか、基準の値が0以下のため計算できません。</p>"
      : isIndex
        ? `<strong class="ts-reading-value" data-ts-indicator>${num(v)}</strong><p>基準月の${fmt(v / 100, 2)}倍。${v >= 100 ? `${num(v - 100)}%多い` : `${num(100 - v)}%少ない`}値です。</p><p data-ts-indicator-formula>${num(source[i])} ÷ ${num(den)} × 100 ＝ ${num(v)}</p>`
        : `<strong class="ts-reading-value" data-ts-indicator>${pct(v)}</strong><p>${s.indicator === "growth" ? "前月" : "前年の同じ月"}より${num(Math.abs(v))}%${v >= 0 ? "増えました" : "減りました"}。</p><p data-ts-indicator-formula>（${num(source[i])} − ${num(den)}）÷ ${num(den)} × 100 ＝ ${pct(v)}</p>`;
  return panel(
    "何と比べた変化なのかを読む",
    `<p class="ts-instruction">点を選ぶと、比べた2か月の値と計算を表示します。</p>${chart}${legend(
      [
        [
          isIndex ? "基準月＝100の指数" : "比べる月からの伸び率",
          "var(--chart-primary)",
          "point",
        ],
        ...(ind.some((v) => v === null)
          ? [["白抜き：計算できない月", "var(--chart-reference)", "open"]]
          : []),
      ],
    )}${detail(monthLabel(i, s), `<p>${s.indicatorSource === "adjusted" ? "季節調整後の値" : "元の値"}で比較しています。</p><dl><div><dt>${base >= 0 ? esc(monthLabel(base, s)) : "比較する月"}</dt><dd>${num(den)}${esc(unit)}${isIndex ? "（基準）" : ""}</dd></div><div><dt>${esc(monthLabel(i, s))}</dt><dd>${num(source[i])}${esc(unit)}</dd></div></dl>${result}<p class="ts-small">${isIndex ? "指数100が基準と同じ大きさ。指数120は20%増を表します。" : "伸び率0%が増減なし。元の値の前月比には、季節の影響も含まれます。"}</p>`)}`,
  );
}
export default {
  id: "time-series",
  title: "時系列データの分析",
  description:
    "移動平均、自己相関、季節調整、伸び率・指数から月別の変化を読む。",
  lead: "時間順の月別データを、中心移動平均と季節の周期から読み取ります。",
  initial: initialSeriesState,
  normalize: normalizeSeriesState,
  related: ["correlation", "histogram", "sampling"],
  explanation: academicExplanation("time-series"),
  render(root, ctx) {
    const s = normalizeSeriesState(ctx.state),
      view = Math.min(3, Math.max(0, ctx.view || 0)),
      values = seriesValues(s),
      unit = unitOf(s),
      d = seasonalDecomposition(values);
    const toolbar =
      view === 0
        ? number(
            "period",
            "平均する月数",
            s.period,
            1,
            Math.min(36, values.length - 1),
            1,
          )
        : view === 3
          ? radio(
              "indicator",
              "比べる基準",
              [
                ["growth", "前月からの伸び率"],
                ["yoy", "前年同月からの伸び率"],
                ["index", `${monthLabel(0, s)}＝100の指数`],
              ],
              s.indicator,
            ) +
            radio(
              "ts-source",
              "使う値",
              [
                ["raw", "元の値"],
                ["adjusted", "季節調整後"],
              ],
              s.indicatorSource,
            )
          : "";
    const content =
      view === 0
        ? rollingView(s, values, unit)
        : view === 1
          ? acfView(s, values)
          : view === 2
            ? adjustmentView(s, values, d, unit)
            : indicatorView(s, values, d, unit);
    root.innerHTML = `<div class="analysis-toolbar ts-toolbar" role="group" aria-label="分析の操作">${toolbar}</div>${content}<details class="analysis-notes"><summary>解説</summary>${readingNotes(
      "time-series",
      view,
      s,
    )
      .map((t) => `<p>${esc(t)}</p>`)
      .join("")}</details>`;
    const update = (patch) => {
      const page = root.ownerDocument.defaultView;
      const position = { left: page.scrollX, top: page.scrollY };
      const fullscreen = Boolean(root.closest(".statistics-fullscreen")?.open);
      ctx.update(patch);
      const panel = root.querySelector(".ts-panel");
      const restore = () => {
        if (
          !fullscreen &&
          root.querySelector(".ts-panel") === panel &&
          (page.scrollX !== position.left || page.scrollY !== position.top)
        )
          page.scrollTo({ ...position, behavior: "instant" });
      };
      restore();
      page.requestAnimationFrame(restore);
    };
    bind(root, "period", (v) =>
      update({
        period: Math.max(
          1,
          Math.min(36, values.length - 1, Math.round(Number(v)) || 1),
        ),
      }),
    );
    root
      .querySelectorAll('input[name="indicator"],input[name="ts-source"]')
      .forEach((el) =>
        el.addEventListener("change", () => {
          if (el.checked)
            update({
              [el.name === "indicator" ? "indicator" : "indicatorSource"]:
                el.value,
            });
        }),
      );
    root.querySelectorAll("[data-month],[data-ts-lag]").forEach((el) => {
      const isMonth = el.hasAttribute("data-month"),
        key = isMonth ? "selected" : "lag",
        current = Number(isMonth ? el.dataset.month : el.dataset.tsLag),
        choose = (value = current) => update({ [key]: value });
      el.addEventListener("click", () => choose());
      el.addEventListener("keydown", (e) => {
        if (["Enter", " "].includes(e.key)) {
          e.preventDefault();
          choose();
        } else if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
          e.preventDefault();
          const value = Math.max(
            isMonth ? 0 : 1,
            Math.min(
              isMonth ? values.length - 1 : Math.min(36, values.length - 1),
              current + (e.key === "ArrowLeft" ? -1 : 1),
            ),
          );
          choose(value);
          root
            .querySelector(`#ts-${isMonth ? "month" : "lag"}-${value}`)
            ?.focus({ preventScroll: true });
        }
      });
    });
  },
};

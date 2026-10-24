import {
  chartKey,
  esc,
  number,
  svg,
  axes,
  line,
  bind,
} from "../shared/ui.mjs?v=20261024-monthly-series";
import {
  academicExplanation,
  readingNotes,
} from "../shared/reading.mjs?v=20261024-monthly-series";
import { mean, fmt } from "../shared/math.mjs";
import {
  SAMPLE_SOURCE,
  createMonthlySeries,
  trailingMovingAverage,
  autocorrelations,
  seasonalDecomposition,
  seriesIndicator,
  initialSeriesState,
  normalizeSeriesState,
} from "./model.mjs?v=20261024-monthly-series";
export {
  createMonthlySeries,
  trailingMovingAverage,
  seriesIndicator,
  autocorrelations,
  linearDetrend,
  seasonalDecomposition,
  normalizeSeriesState,
} from "./model.mjs?v=20261024-monthly-series";
export function monthLabel(i, state = {}) {
  if (state.monthLabels?.[i])
    return state.monthLabels[i].replace(
      /^(\d{4})-(\d{2})$/,
      (_, y, m) => `${y}年${+m}月`,
    );
  return state.customValues
    ? `${i + 1}か月目`
    : `${2022 + Math.floor(i / 12)}年${(i % 12) + 1}月`;
}
const num = (v) =>
  v === null || !Number.isFinite(v) ? "—" : fmt(v, Number.isInteger(v) ? 0 : 1);
const signed = (v) =>
  v === null || !Number.isFinite(v) ? "—" : `${v > 0 ? "+" : ""}${fmt(v, 1)}`;
const unitOf = (s) =>
  s.customValues
    ? /[（(]([^）)]+)[）)]/.exec(s.customLabel || "")?.[1] || ""
    : "件";
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
  { zero = true, height = 360, label } = {},
) {
  const valid = values.filter((v) => v !== null && Number.isFinite(v)),
    min = Math.min(0, ...valid),
    max = Math.max(1, ...valid),
    span = Math.max(1, max - min);
  const a = axes({
    xmin: 0,
    xmax: 47,
    ymin: zero ? min : Math.min(...valid, 0) - span * 0.08,
    ymax:
      !label && unitOf(state) === "件"
        ? Math.ceil((max + span * 0.12) / 5) * 5
        : max + span * 0.12,
    w: 760,
    h: height,
    ylabel: label || state.customLabel || "注文件数（件）",
  });
  let markup = a.markup.replace(
    /<text x="[^"]+" y="[^"]+" text-anchor="middle">[^<]*<\/text>/g,
    "",
  );
  markup += [0, 12, 24, 36, 47]
    .map(
      (i) =>
        `<text x="${a.x(i)}" y="${height - 16}" text-anchor="${i === 0 ? "start" : i === 47 ? "end" : "middle"}">${esc(monthLabel(i, state).replace("年", ".").replace("月", ""))}</text>`,
    )
    .join("");
  return { ...a, markup, height };
}
function monthPoints(
  values,
  a,
  state,
  { color = "var(--chart-primary)" } = {},
) {
  return values
    .map(
      (v, i) =>
        `<circle id="ts-month-${i}" data-month="${i}" cx="${a.x(i)}" cy="${a.y(v === null ? 0 : v)}" r="${i === state.selected ? 6 : 4}" fill="${v === null ? "white" : color}" stroke="${i === state.selected ? "var(--chart-secondary)" : "white"}" stroke-width="${i === state.selected ? 3 : 1.5}" tabindex="0" role="button" aria-pressed="${i === state.selected}" aria-label="${esc(monthLabel(i, state))}：${v === null ? "比較する月がありません" : num(v)}。選ぶと計算を表示"><title>${esc(monthLabel(i, state))}：${num(v)}</title></circle>`,
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
  const ma = trailingMovingAverage(values, s.period),
    i = s.selected,
    start = i - s.period + 1,
    a = calendarAxes(values, s),
    can = start >= 0;
  const window = can
    ? `<rect data-ts-window x="${a.x(Math.max(0, start - 0.35))}" y="30" width="${a.x(Math.min(47, i + 0.35)) - a.x(Math.max(0, start - 0.35))}" height="${a.y(0) - 30}" fill="var(--chart-purple-pale)"/>`
    : "";
  const chart = svg(
    window +
      a.markup +
      selectedGuide(a, s) +
      brokenLine(values, a) +
      brokenLine(ma, a, "moving-average") +
      monthPoints(values, a, s),
    "月ごとの値と、その月までの移動平均。薄紫の範囲が選んだ月の平均に使う期間。",
    760,
    360,
  );
  return panel(
    "月ごとの変動をならす",
    `<p class="ts-instruction">点を選ぶと、その月の平均に使った期間と計算が切り替わります。</p>${chart}${legend(
      [
        ["元の値", "var(--chart-primary)", "point"],
        [`${s.period}か月移動平均`, "var(--chart-purple)", "line-dashed"],
      ],
    )}${detail(
      monthLabel(i, s),
      `<dl><div><dt>元の値</dt><dd data-ts-current>${num(values[i])}${esc(unit)}</dd></div><div><dt>${s.period}か月移動平均</dt><dd data-ts-average>${num(ma[i])}${esc(unit)}</dd></div></dl><p data-ts-window-label>${can ? `${esc(monthLabel(start, s))}〜${esc(monthLabel(i, s))}の${s.period}か月を平均。` : "平均に必要な月数がまだありません。"}</p>${
        can
          ? `<details class="ts-calculation"><summary>この平均の計算</summary><p>（${values
              .slice(start, i + 1)
              .map(num)
              .join(
                " ＋ ",
              )}）÷ ${s.period} ＝ ${num(ma[i])}${esc(unit)}</p></details>`
          : ""
      }<p>期間を長くすると細かい変動は減りますが、最近の変化への反応は遅くなります。</p>`,
    )}`,
  );
}
function acfView(s, values) {
  const acf = autocorrelations(values),
    a = axes({
      xmin: 0.5,
      xmax: 24.5,
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
    `<line x1="${a.x(0.5)}" x2="${a.x(24.5)}" y1="${a.y(0)}" y2="${a.y(0)}" stroke="var(--chart-reference)"/>`;
  for (let lag = 1; lag <= 24; lag++) {
    const v = acf[lag],
      x = a.x(lag),
      w = (a.x(2) - a.x(1)) * 0.65;
    drawing += `<g id="ts-lag-${lag}" data-ts-lag="${lag}" tabindex="0" role="button" aria-pressed="${lag === s.lag}" aria-label="${lag}か月ずらす。自己相関${v === null ? "は計算できません" : fmt(v, 2)}"><rect x="${x - w / 2}" y="30" width="${w}" height="282" fill="transparent"/>${v === null ? "" : `<rect data-ts-acf-value="${v}" x="${x - w / 2}" y="${a.y(Math.max(0, v))}" width="${w}" height="${Math.abs(a.y(v) - a.y(0))}" fill="${lag === s.lag ? "var(--chart-secondary)" : "var(--chart-primary)"}"/>`}</g>`;
  }
  drawing +=
    [1, 6, 12, 18, 24]
      .map(
        (k) => `<text x="${a.x(k)}" y="331" text-anchor="middle">${k}</text>`,
      )
      .join("") +
    '<text x="380" y="354" text-anchor="middle">何か月ずらすか</text>';
  return panel(
    "何か月ずらすと、似た動きになる？",
    `<p class="ts-instruction">長期的な増減を除いて比較します。棒を選ぶと、ずらす月数を確認できます。</p>${svg(drawing, "長期の直線的な増減を除いた、1〜24か月ずらした自己相関", 760, 360)}${detail(`${s.lag}か月ずらした比較`, `<dl><div><dt>自己相関</dt><dd data-ts-acf>${acf[s.lag] === null ? "—" : fmt(acf[s.lag], 2)}</dd></div></dl><p>${acf[s.lag] === null ? "長期的な増減を除くと変動がないため、自己相関を計算できません。" : `同じデータを${s.lag}か月ずらし、重なる${48 - s.lag}組の値の動きが似ているかを調べています。`}</p><p data-ts-annual-acf>12か月ずらした自己相関：${acf[12] === null ? "—" : fmt(acf[12], 2)}。${annualPeak(acf) ? "1年周期の手がかりがあります。12か月で平均すると、この繰り返しをならしやすくなります。" : "1年周期が明瞭か、グラフも合わせて確かめましょう。"}</p><p class="ts-small">自己相関だけで平均する月数が決まるわけではありません。ならしたい周期と、変化への反応を比べます。</p>`)}`,
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
    a = calendarAxes(isIndex ? [...ind, 100] : ind, s, { label }),
    baseline = isIndex ? 100 : 0;
  const chart = svg(
    a.markup +
      `<line x1="${a.x(0)}" x2="${a.x(47)}" y1="${a.y(baseline)}" y2="${a.y(baseline)}" stroke="var(--chart-reference)" stroke-dasharray="4 3"/>` +
      brokenLine(ind, a) +
      monthPoints(ind, a, s),
    isIndex
      ? "最初の月を100とした各月の指数"
      : "前月または前年同月から、何パーセント増減したか",
    760,
    360,
  );
  let result =
    v === null
      ? "<p>比較する月がないか、基準の値が0以下のため計算できません。</p>"
      : isIndex
        ? `<strong class="ts-reading-value" data-ts-indicator>${num(v)}</strong><p>基準月の${fmt(v / 100, 2)}倍。${v >= 100 ? `${num(v - 100)}%多い` : `${num(100 - v)}%少ない`}値です。</p><p data-ts-indicator-formula>${num(source[i])} ÷ ${num(den)} × 100 ＝ ${num(v)}</p>`
        : `<strong class="ts-reading-value" data-ts-indicator>${pct(v)}</strong><p>${s.indicator === "growth" ? "前月" : "前年の同じ月"}より${num(Math.abs(v))}%${v >= 0 ? "増えました" : "減りました"}。</p><p data-ts-indicator-formula>（${num(source[i])} − ${num(den)}）÷ ${num(den)} × 100 ＝ ${pct(v)}</p>`;
  return panel(
    "何と比べた変化なのかを読む",
    `<p class="ts-instruction">点を選ぶと、比べた2か月の値と計算を表示します。</p>${chart}${detail(monthLabel(i, s), `<p>${s.indicatorSource === "adjusted" ? "季節調整後の値" : "元の値"}で比較しています。</p><dl><div><dt>${base >= 0 ? esc(monthLabel(base, s)) : "比較する月"}</dt><dd>${num(den)}${esc(unit)}${isIndex ? "（基準）" : ""}</dd></div><div><dt>${esc(monthLabel(i, s))}</dt><dd>${num(source[i])}${esc(unit)}</dd></div></dl>${result}<p class="ts-small">${isIndex ? "指数100が基準と同じ大きさ。指数120は20%増を表します。" : "伸び率0%が増減なし。元の値の前月比には、季節の影響も含まれます。"}</p>`)}`,
  );
}
function summaryView(s, values, d, unit) {
  const first = mean(values.slice(0, 12)),
    last = mean(values.slice(-12)),
    change = first > 0 ? (last / first - 1) * 100 : null,
    acf = autocorrelations(values),
    ma = trailingMovingAverage(values, s.period),
    a = calendarAxes([...values, ...d.adjusted], s),
    i = 47,
    yoy = seriesIndicator(values, "yoy")[i],
    mom = seriesIndicator(d.adjusted, "growth")[i];
  const chart = svg(
    a.markup +
      brokenLine(values, a) +
      brokenLine(ma, a, "moving-average") +
      `<g stroke="var(--chart-secondary)" stroke-width="2.5" fill="none">${brokenLine(d.adjusted, a, "ts-adjusted-line")}</g>`,
    "元の値、移動平均、季節調整後を重ねた全体のまとめ",
    760,
    360,
  );
  return panel(
    "同じデータを、4つの見方で読む",
    `${chart}${legend([
      ["元の値", "var(--chart-primary)", "line"],
      [`${s.period}か月移動平均`, "var(--chart-purple)", "line-dashed"],
      ["季節調整後", "var(--chart-secondary)", "line"],
    ])}${detail("このデータのまとめ", `<ol class="ts-summary"><li><strong>長期の動き</strong><p>最初の12か月の平均 ${num(first)}${esc(unit)} → 最後の12か月の平均 ${num(last)}${esc(unit)}（${pct(change)}）。</p></li><li><strong>繰り返し</strong><p>12か月ずらした自己相関は${acf[12] === null ? "—" : fmt(acf[12], 2)}。${annualPeak(acf) ? "1年周期の手がかりが見られます。" : "1年周期が明瞭とは限りません。"}</p></li><li><strong>季節の影響を分ける</strong><p>季節調整後の線で、毎年の繁閑を除いた動きを見ます。</p></li><li><strong>変化の基準</strong><p>${esc(monthLabel(i, s))}の元の値は前年同月から${pct(yoy)}。季節調整後は前月から${pct(mom)}です。</p></li></ol><p>長期の動き・季節の影響・比べる月を区別して、何が変わったかを読み取りましょう。</p>`)}`,
  );
}
export default {
  id: "time-series",
  title: "時系列データの分析",
  description:
    "移動平均、自己相関、季節調整、伸び率・指数から月別の変化を読む。",
  lead: SAMPLE_SOURCE,
  initial: initialSeriesState,
  normalize: normalizeSeriesState,
  related: ["correlation", "histogram", "sampling"],
  explanation: academicExplanation("time-series"),
  render(root, ctx) {
    const s = normalizeSeriesState(ctx.state),
      view = ctx.view || 0,
      values = s.customValues || createMonthlySeries(s),
      unit = unitOf(s),
      d = seasonalDecomposition(values);
    const toolbar =
      view === 0
        ? number("period", "平均する月数", s.period, 1, 24, 1)
        : view === 1
          ? '<button type="button" id="ts-try-annual">12か月移動平均を見る</button>'
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
            : view === 3
              ? indicatorView(s, values, d, unit)
              : summaryView(s, values, d, unit);
    root.innerHTML = `<div class="analysis-toolbar ts-toolbar" role="group" aria-label="分析の操作">${toolbar}</div><p class="ts-source">${esc(s.customValues ? `データ：${s.dataInfo?.name || s.customLabel || "読み込んだ月別データ"}（月次48件）` : SAMPLE_SOURCE)}</p>${content}<details class="analysis-notes"><summary>解説</summary>${readingNotes(
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
        period: Math.max(1, Math.min(24, Math.round(Number(v)) || 1)),
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
              isMonth ? 47 : 24,
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
    root.querySelector("#ts-try-annual")?.addEventListener("click", () => {
      update({ period: 12 });
      root.ownerDocument.querySelector("#view-0")?.click();
    });
  },
};

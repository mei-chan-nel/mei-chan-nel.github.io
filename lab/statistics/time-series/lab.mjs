import { academicExplanation } from "../shared/reading.mjs?v=20261024-guided-counts";
import { mean, rng, normal, fmt, clamp } from "../shared/math.mjs";
import {
  esc,
  range,
  select,
  metrics,
  table,
  svg,
  axes,
  line,
  bind,
} from "../shared/ui.mjs";

const MONTHS = 48;
const TRAIN = 36;
const METHODS = [
  ["last", "直近の値"],
  ["ma", "直近の移動平均"],
  ["trend", "直線トレンド"],
  ["seasonal", "前年同月＋年変化"],
];
const COLORS = {
  last: "#8a6d52",
  ma: "#8b5cf6",
  trend: "#db6a3b",
  seasonal: "#087f8c",
};

// Original, fully synthetic monthly demand. The random component is reproducible.
export function createMonthlySeries({
  trend = 2,
  seasonal = 32,
  noise = 16,
  seed = 1729,
} = {}) {
  const random = rng(seed);
  return Array.from({ length: MONTHS }, (_, i) =>
    Math.max(
      1,
      130 +
        trend * i +
        seasonal * Math.sin((2 * Math.PI * (i - 2)) / 12) +
        noise * normal(random),
    ),
  );
}

export function trailingMovingAverage(values, period) {
  const k = Math.max(1, Math.min(values.length, Math.floor(period)));
  return values.map((_, i) =>
    i + 1 < k ? null : mean(values.slice(i - k + 1, i + 1)),
  );
}

export function makeForecasts(training, horizon = 12, period = 6) {
  const n = training.length;
  if (!n) return { last: [], ma: [], trend: [], seasonal: [] };
  const xm = (n - 1) / 2;
  const ym = mean(training);
  const denominator = training.reduce((s, _, i) => s + (i - xm) ** 2, 0);
  const slope = denominator
    ? training.reduce((s, y, i) => s + (i - xm) * (y - ym), 0) / denominator
    : 0;
  const last = training[n - 1];
  const average = mean(training.slice(-Math.max(1, Math.floor(period))));
  const annualDifferences = training.slice(Math.max(12, n - 12)).map((y, j) => {
    const i = Math.max(12, n - 12) + j;
    return y - training[i - 12];
  });
  const annualChange = annualDifferences.length ? mean(annualDifferences) : 0;
  return {
    last: Array(horizon).fill(last),
    ma: Array(horizon).fill(average),
    trend: Array.from({ length: horizon }, (_, h) =>
      Math.max(0, ym + slope * (n + h - xm)),
    ),
    seasonal: Array.from({ length: horizon }, (_, h) =>
      n >= 12
        ? Math.max(
            0,
            training[n - 12 + (h % 12)] +
              annualChange * (1 + Math.floor(h / 12)),
          )
        : last,
    ),
  };
}

export function evaluateForecast(actual, predicted) {
  const count = Math.min(actual.length, predicted.length);
  if (!count) return { mae: null, rmse: null, bias: null };
  const errors = actual.slice(0, count).map((y, i) => predicted[i] - y);
  return {
    mae: mean(errors.map(Math.abs)),
    rmse: Math.sqrt(mean(errors.map((e) => e * e))),
    bias: mean(errors),
  };
}

export function seriesIndicator(values, mode) {
  if (mode === "index")
    return values.map((y) => (values[0] ? (y / values[0]) * 100 : null));
  const lag = mode === "growth" ? 1 : 12;
  return values.map((y, i) =>
    i >= lag && values[i - lag] !== 0 ? (y / values[i - lag] - 1) * 100 : null,
  );
}

function month(i, s = {}) {
  if (s.monthLabels?.[i]) return s.monthLabels[i];
  if (s.customValues) return `${i + 1}か月目`;
  return `${2022 + Math.floor(i / 12)}年${(i % 12) + 1}月`;
}
function monthlyAxes(axis) {
  // Replace generic numeric x ticks with calendar labels, retaining the y ticks.
  return axis.markup.replace(
    /<text x="[^"]+" y="[^"]+" text-anchor="middle">[^<]*<\/text>/g,
    "",
  );
}
function tickLabels(axis, h = 360, s = {}) {
  return [0, 12, 24, 36, 47]
    .map(
      (i) =>
        `<text x="${axis.x(i)}" y="${h - 15}" text-anchor="${i === 47 ? "end" : "middle"}" font-size="11">${esc(month(i, s).replace("年", ".").replace("月", ""))}</text>`,
    )
    .join("");
}

export default {
  id: "time-series",
  title: "時系列データの分析",
  description: "変動を分けて考え、学習に使わなかった期間で予測を検証する。",
  lead: "架空の「学習ノート注文数」48か月を実験。最初の36か月だけで次の12か月を予測し、実測値と比べます。",
  initial: () => ({
    trend: 2,
    seasonal: 32,
    noise: 16,
    period: 6,
    forecast: "seasonal",
    indicator: "yoy",
    selected: 41,
    seed: 1729,
  }),
  related: ["correlation", "summary", "sampling"],
  explanation: academicExplanation("time-series"),
  render(root, ctx) {
    const s = ctx.state;
    const values = s.customValues || createMonthlySeries(s);
    const valueUnit = s.customValues ? "" : "件";
    const ma = trailingMovingAverage(values, s.period);
    const forecasts = makeForecasts(values.slice(0, TRAIN), 12, s.period);
    const method = METHODS.some(([v]) => v === s.forecast)
      ? s.forecast
      : "seasonal";
    const prediction = forecasts[method];
    const score = evaluateForecast(values.slice(TRAIN), prediction);
    const selected = clamp(Math.round(s.selected), 0, 47);
    const all = [...values, ...Object.values(forecasts).flat()];
    const maximum = Math.ceil(Math.max(...all) / 50) * 50 + 20;
    const a = axes({
      xmin: 0,
      xmax: 47,
      ymin: 0,
      ymax: maximum,
      xlabel: "",
      ylabel: s.customLabel || "注文数（件）",
      w: 760,
      h: 370,
    });
    const points = values.map((y, x) => ({ x, y }));
    const marked = prediction.map((y, h) => ({ x: TRAIN + h, y }));
    const selectedForecast =
      selected >= TRAIN ? prediction[selected - TRAIN] : null;
    const chart = svg(
      `<rect x="${a.x(35.5)}" y="16" width="${a.x(47) - a.x(35.5)}" height="${a.y(0) - 16}" fill="#eef1f3"/>${monthlyAxes(a)}${line(points.slice(0, TRAIN), a.x, a.y)}<g style="stroke:#d96d39;stroke-dasharray:5 4;fill:none">${line(points.slice(TRAIN - 1), a.x, a.y, "warm")}</g><g style="stroke:#8b5cf6;fill:none;opacity:.65">${line(
        ma.map((y, x) => ({ x, y })).filter((p) => p.y !== null),
        a.x,
        a.y,
        "moving-average",
      )}</g><g style="stroke:${COLORS[method]};stroke-width:3;fill:none">${line([{ x: TRAIN - 1, y: values[TRAIN - 1] }, ...marked], a.x, a.y, "forecast-line")}</g>${points.map((p) => `<circle data-month="${p.x}" cx="${a.x(p.x)}" cy="${a.y(p.y)}" r="${p.x === selected ? 7 : 4}" fill="${p.x >= TRAIN ? "#d96d39" : "#087f8c"}" stroke="white" tabindex="0" role="button" aria-label="${esc(month(p.x, s))} ${fmt(p.y, 1)}${valueUnit}を詳しく見る"><title>${esc(month(p.x, s))}：${fmt(p.y, 1)}${valueUnit}</title></circle>`).join("")}${selectedForecast === null ? "" : `<line x1="${a.x(selected)}" y1="${a.y(values[selected])}" x2="${a.x(selected)}" y2="${a.y(selectedForecast)}" stroke="#ba4c26" stroke-width="4"/><rect x="${a.x(selected) - 4}" y="${a.y(selectedForecast) - 4}" width="8" height="8" fill="${COLORS[method]}"/>`}<text x="${a.x(36) + 5}" y="30" font-size="11">検証用12か月</text>${tickLabels(a, 370, s)}`,
      "月別の注文数、移動平均、訓練期間だけで作った12か月予測",
      760,
      370,
    );
    const indicators = seriesIndicator(values, s.indicator);
    const valid = indicators.filter((v) => v !== null);
    const low =
      s.indicator === "index"
        ? Math.min(100, ...valid) * 0.85
        : Math.min(0, ...valid) - 5;
    const high =
      Math.max(s.indicator === "index" ? 100 : 0, ...valid) +
      (s.indicator === "index" ? 20 : 5);
    const unit = s.indicator === "index" ? "指数" : "%";
    const b = axes({
      xmin: 0,
      xmax: 47,
      ymin: low,
      ymax: high,
      xlabel: "",
      ylabel: unit,
      w: 760,
      h: 245,
    });
    const baseline = s.indicator === "index" ? 100 : 0;
    const indicatorChart = svg(
      `${monthlyAxes(b)}<line x1="${b.x(0)}" x2="${b.x(47)}" y1="${b.y(baseline)}" y2="${b.y(baseline)}" stroke="#869198" stroke-dasharray="4 3"/>${line(
        indicators.map((y, x) => ({ x, y })).filter((p) => p.y !== null),
        b.x,
        b.y,
      )}${indicators[selected] === null ? "" : `<circle cx="${b.x(selected)}" cy="${b.y(indicators[selected])}" r="6" fill="#d96d39"/>`}${tickLabels(b, 245, s)}`,
      "同じ月別データを、選んだ比較基準で読み替えた折れ線",
      760,
      245,
    );
    const currentIndicator = indicators[selected];
    const lag = s.indicator === "growth" ? 1 : 12;
    const denominator =
      s.indicator === "index"
        ? values[0]
        : selected >= lag
          ? values[selected - lag]
          : null;
    const calculation =
      denominator === null
        ? "比較する過去の月がないため、この月の比率は計算できません。"
        : s.indicator === "index"
          ? `${fmt(values[selected], 1)} ÷ ${fmt(denominator, 1)} × 100 ＝ ${fmt(currentIndicator, 1)}`
          : `(${fmt(values[selected], 1)} ÷ ${fmt(denominator, 1)} − 1) × 100 ＝ ${fmt(currentIndicator, 1)}%`;
    root.innerHTML = `<div class="stat-grid"><div><section class="panel chart-panel"><h2>未来を隠して、予測を比べる</h2><p class="hint">${s.customValues ? "読み込んだ48か月のデータ。" : "2022〜2025年の架空データ。"}点を選ぶとその月の計算を確認できます。すべての値は小数のまま計算しています。</p>${chart}<div class="legend"><span>● 実測（訓練）</span><span style="color:#d96d39">● 実測（検証）</span><span style="color:#8b5cf6">─ 後方移動平均</span><span style="color:${COLORS[method]}">━ 選択した予測</span></div>${metrics(
      [
        [
          "12か月のMAE",
          `${fmt(score.mae, 1)}${valueUnit}`,
          "小さいほど絶対誤差が小さい",
        ],
        ["RMSE", `${fmt(score.rmse, 1)} 件`, "大きな誤差を強く評価"],
        ["平均誤差", `${fmt(score.bias, 1)} 件`, "予測 − 実測"],
      ],
    )}</section><section class="panel"><h2>同じデータ、違う比較基準</h2>${select(
      "indicator",
      "変化の読み方",
      [
        ["growth", "前月比"],
        ["yoy", "前年同月比"],
        ["index", "最初の月＝100の指数"],
      ],
      s.indicator,
    )}${indicatorChart}<p class="annotation"><strong>${esc(month(selected, s))}</strong>：${calculation}</p></section><section class="panel"><h2>4つの予測を同じ条件で評価</h2><p class="hint">${esc(month(35, s))}までの36か月だけを使用。残り12か月の実測値は、予測後の答え合わせに使います。</p>${table(
      ["方法", "MAE（件）", "RMSE（件）", "平均誤差（件）"],
      METHODS.map(([key, label]) => {
        const e = evaluateForecast(values.slice(TRAIN), forecasts[key]);
        return [
          label + (key === method ? " ◀ 選択中" : ""),
          fmt(e.mae, 1),
          fmt(e.rmse, 1),
          fmt(e.bias, 1),
        ];
      }),
    )}</section></div><aside><section class="panel controls"><h2>分析の操作</h2>${range("trend", "長期トレンド（月当たり）", s.trend, -2, 6, 0.5, "件")}${range("seasonal", "季節変動の振幅", s.seasonal, 0, 60, 2, "件")}${range("noise", "偶然変動の標準偏差", s.noise, 0, 30, 1, "件")}<p class="hint">スライダーを変えても乱数の並びは同じ。条件の影響を比べられます。</p><button id="resample">別の偶然変動を試す</button><p class="muted">再現用シード：${s.seed}</p><h3>分析方法</h3>${range("period", "移動平均の期間", s.period, 1, 12, 1, "か月")}${select("forecast", "グラフで見る予測", METHODS, method)}<p class="hint">直近の移動平均による予測も、この期間を使用します。</p><h3>1か月を詳しく調べる</h3>${range("selected", "注目する月（開始から）", selected + 1, 1, 48, 1, "か月目")}<p><strong>${esc(month(selected, s))}</strong><br>実測 ${fmt(values[selected], 1)}${valueUnit}<br>移動平均 ${ma[selected] === null ? "計算に必要な月数が不足" : `${fmt(ma[selected], 1)}${valueUnit}`}${selectedForecast === null ? "<br>訓練期間のため予測評価の対象外" : `<br>予測 ${fmt(selectedForecast, 1)}${valueUnit}<br>誤差（予測−実測）${fmt(selectedForecast - values[selected], 1)}${valueUnit}`}</p><details><summary>この月の移動平均の計算</summary><p>${
      ma[selected] === null
        ? `最初の${s.period - 1}か月は計算できません。`
        : `${values
            .slice(selected - s.period + 1, selected + 1)
            .map((v) => fmt(v, 1))
            .join(
              " ＋ ",
            )} の合計 ÷ ${s.period} ＝ ${fmt(ma[selected], 1)}${valueUnit}（表示前の値で計算）`
    }</p></details></section></aside></div>`;
    if (s.customValues)
      for (const key of ["trend", "seasonal", "noise", "resample"])
        root.querySelector("#" + key).disabled = true;
    for (const key of ["trend", "seasonal", "noise", "period"])
      bind(root, key, (v) => ctx.update({ [key]: Number(v) }));
    for (const key of ["forecast", "indicator"])
      bind(root, key, (v) => ctx.update({ [key]: v }), "change");
    bind(root, "selected", (v) => ctx.update({ selected: Number(v) - 1 }));
    root
      .querySelector("#resample")
      .addEventListener("click", () =>
        ctx.update({ seed: Number(s.seed) + 1 }),
      );
    root.querySelectorAll("[data-month]").forEach((el) => {
      const choose = () => ctx.update({ selected: Number(el.dataset.month) });
      el.addEventListener("click", choose);
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          choose();
        }
      });
    });
  },
};

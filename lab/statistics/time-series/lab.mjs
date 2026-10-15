import { mean, rng, normal, fmt, clamp } from "../shared/math.mjs";
import {
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

function month(i) {
  return `${2022 + Math.floor(i / 12)}年${(i % 12) + 1}月`;
}
function monthlyAxes(axis) {
  // Replace generic numeric x ticks with calendar labels, retaining the y ticks.
  return axis.markup.replace(
    /<text x="[^"]+" y="[^"]+" text-anchor="middle">[^<]*<\/text>/g,
    "",
  );
}
function tickLabels(axis, h = 360) {
  return [0, 12, 24, 36, 47]
    .map(
      (i) =>
        `<text x="${axis.x(i)}" y="${h - 15}" text-anchor="${i === 47 ? "end" : "middle"}" font-size="11">${2022 + Math.floor(i / 12)}.${(i % 12) + 1}</text>`,
    )
    .join("");
}

export default {
  id: "time-series",
  title: "時系列データの分析",
  description: "変動を分けて考え、未来を隠して予測を検証する。",
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
  missions: [
    {
      title: "売上は落ちた？ 季節の影響？",
      body: "季節変動を大きくし、減少した月を探そう。前月比と前年同月比で判断は同じ？ 増加トレンドの途中でも前月比が負になる理由を、比較した月に注目して説明しよう。",
      preset: {
        trend: 2,
        seasonal: 55,
        noise: 4,
        indicator: "growth",
        selected: 43,
      },
    },
    {
      title: "滑らかな線ほど予測に役立つ？",
      body: "移動平均を3・6・12か月に変えてみよう。季節変動が見えなくなる一方、増加への追従はどう変わる？ 予測誤差の表で「直近の移動平均」と「前年同月＋年変化」を比較し、分析目的ごとに期間を選ぼう。",
      preset: { trend: 3, seasonal: 40, noise: 8, period: 12, forecast: "ma" },
    },
    {
      title: "最良の予測方法はいつも同じ？",
      body: "季節変動ゼロ・大きな季節変動・強い偶然変動の3条件で、12か月のMAEを比較しよう。気に入った結果は比較用に保存。別のシードでも試し、1回の好成績だけで方法を決めてよいか考えよう。",
      preset: {
        trend: 1,
        seasonal: 0,
        noise: 18,
        forecast: "trend",
        seed: 1729,
      },
    },
  ],
  related: ["correlation", "summary", "sampling"],
  explanation: `<h2>時間の順序に意味があるデータ</h2><p>このラボの注文数は、130＋月当たりの増加量×月番号＋12か月周期の波＋偶然変動で独自に生成しています。注文数が負にならないよう下限を1にしています。季節は毎年繰り返す動き、トレンドは長期的な動きです。現実には制度変更、休日、欠品なども影響し、同じ式が続くとは限りません。</p><h3>移動平均の窓は過去だけ</h3><p>kか月移動平均は、その月を含む直近kか月の合計÷kです。最初のk−1か月は計算できません。このラボは後方移動平均を使うため、未来の値は使いません。長い窓は偶然変動を弱めますが、変化への反応が遅れます。12か月の窓は1年の波を平均化します。</p><h3>何と比べるかを決める</h3><p>前月比＝(当月÷前月−1)×100、前年同月比＝(当月÷12か月前−1)×100です。指数は最初の月を100とした当月÷最初の月×100。前月比は短期変化を捉えますが季節の影響を受けます。前年同月比も、前年に特殊な出来事があれば影響を受けます。分母が0なら比率は定義できません。率の単純平均は、全期間の伸び率と一般には一致しません。</p><h3>実測を隠して予測し、後で確かめる</h3><p>灰色の範囲にある最後の12か月は検証用です。どの方法も最初の36か月だけを使い、12か月先まで一括で予測します。「直近の値」は最後の観測値、「直近の移動平均」は最後のkか月の平均を固定します。「直線トレンド」は36点への最小二乗直線を延長。「前年同月＋年変化」は前年の同じ月に、訓練期間の最後の12個の前年比較の差を平均した値を加えます。後者は季節の形と年変化が続くという仮定です。負の予測値は0で打ち切ります。</p><p>MAEは絶対誤差の平均、RMSEは誤差を2乗して平均した平方根です。RMSEは大きな外れを強く評価します。平均誤差は「予測−実測」の平均で、正なら多めに予測した傾向を示します。平均誤差が0に近くても、過大と過小が相殺していることがあります。</p><p>4年間だけの人工データで勝った方法が、現実でも最適とは限りません。検証用データで方法を選び続けると、その期間にも適合しすぎます。別のシードや別の期間で確かめ、予測には不確実性があることを伝えましょう。</p>`,
  render(root, ctx) {
    const s = ctx.state;
    const values = createMonthlySeries(s);
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
      ylabel: "注文数（件）",
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
      )}</g><g style="stroke:${COLORS[method]};stroke-width:3;fill:none">${line([{ x: TRAIN - 1, y: values[TRAIN - 1] }, ...marked], a.x, a.y, "forecast-line")}</g>${points.map((p) => `<circle data-month="${p.x}" cx="${a.x(p.x)}" cy="${a.y(p.y)}" r="${p.x === selected ? 7 : 4}" fill="${p.x >= TRAIN ? "#d96d39" : "#087f8c"}" stroke="white" tabindex="0" role="button" aria-label="${month(p.x)} ${fmt(p.y, 1)}件を詳しく見る"><title>${month(p.x)}：${fmt(p.y, 1)}件</title></circle>`).join("")}${selectedForecast === null ? "" : `<line x1="${a.x(selected)}" y1="${a.y(values[selected])}" x2="${a.x(selected)}" y2="${a.y(selectedForecast)}" stroke="#ba4c26" stroke-width="4"/><rect x="${a.x(selected) - 4}" y="${a.y(selectedForecast) - 4}" width="8" height="8" fill="${COLORS[method]}"/>`}<text x="${a.x(36) + 5}" y="30" font-size="11">検証用12か月</text>${tickLabels(a, 370)}`,
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
      )}${indicators[selected] === null ? "" : `<circle cx="${b.x(selected)}" cy="${b.y(indicators[selected])}" r="6" fill="#d96d39"/>`}${tickLabels(b, 245)}`,
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
    root.innerHTML = `<div class="stat-grid"><div><section class="panel chart-panel"><h2>未来を隠して、予測を比べる</h2><p class="hint">2022〜2025年の架空データ。点を選ぶとその月の計算を確認できます。すべての値は小数のまま計算しています。</p>${chart}<div class="legend"><span>● 実測（訓練）</span><span style="color:#d96d39">● 実測（検証）</span><span style="color:#8b5cf6">─ 後方移動平均</span><span style="color:${COLORS[method]}">━ 選択した予測</span></div>${metrics(
      [
        [
          "12か月のMAE",
          `${fmt(score.mae, 1)} 件`,
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
    )}${indicatorChart}<p class="annotation"><strong>${month(selected)}</strong>：${calculation}</p></section><section class="panel"><h2>4つの予測を同じ条件で評価</h2><p class="hint">すべて2024年12月までのデータだけを使用。2025年の実測値は、予測後の答え合わせに使います。</p>${table(
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
    )}</section></div><aside><section class="panel controls"><h2>データを生み出す条件</h2>${range("trend", "長期トレンド（月当たり）", s.trend, -2, 6, 0.5, "件")}${range("seasonal", "季節変動の振幅", s.seasonal, 0, 60, 2, "件")}${range("noise", "偶然変動の標準偏差", s.noise, 0, 30, 1, "件")}<p class="hint">スライダーを変えても乱数の並びは同じ。条件の影響を比べられます。</p><button id="resample">別の偶然変動を試す</button><p class="muted">再現用シード：${s.seed}</p><h3>分析方法</h3>${range("period", "移動平均の期間", s.period, 1, 12, 1, "か月")}${select("forecast", "グラフで見る予測", METHODS, method)}<p class="hint">直近の移動平均による予測も、この期間を使用します。</p><h3>1か月を詳しく調べる</h3>${range("selected", "注目する月（開始から）", selected + 1, 1, 48, 1, "か月目")}<p><strong>${month(selected)}</strong><br>実測 ${fmt(values[selected], 1)}件<br>移動平均 ${ma[selected] === null ? "計算に必要な月数が不足" : `${fmt(ma[selected], 1)}件`}${selectedForecast === null ? "<br>訓練期間のため予測評価の対象外" : `<br>予測 ${fmt(selectedForecast, 1)}件<br>誤差（予測−実測）${fmt(selectedForecast - values[selected], 1)}件`}</p><details><summary>この月の移動平均の計算</summary><p>${
      ma[selected] === null
        ? `最初の${s.period - 1}か月は計算できません。`
        : `${values
            .slice(selected - s.period + 1, selected + 1)
            .map((v) => fmt(v, 1))
            .join(
              " ＋ ",
            )} の合計 ÷ ${s.period} ＝ ${fmt(ma[selected], 1)}件（表示前の値で計算）`
    }</p></details></section></aside></div>`;
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

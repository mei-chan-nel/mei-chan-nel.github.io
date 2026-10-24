import { academicExplanation } from "../shared/reading.mjs?v=20261024-fraction-labels";
import { mean, rng, fmt, clamp, binomialPMF } from "../shared/math.mjs";
import {
  esc,
  number,
  range,
  metrics,
  table,
  svg,
  axes,
  bind,
} from "../shared/ui.mjs";

export function sampleBinomial(n, probability, random) {
  let successes = 0;
  for (let i = 0; i < n; i++) if (random() < probability) successes++;
  return successes;
}

export function simulateDifferences(nA, nB, pA, pB, repetitions, seed) {
  const random = rng(seed);
  // Repeated Bernoulli draws are intuitive and inexpensive for small groups.
  // For larger groups invert the exact binomial CDF (not a normal approximation)
  // so the largest classroom experiment remains responsive on mobile devices.
  const sampler = (n, p) => {
    if (n <= 200) return () => sampleBinomial(n, p, random);
    const mass = binomialPMF(n, p),
      total = mass.reduce((a, b) => a + b, 0);
    let accumulated = 0;
    const cumulative = mass.map((v) => (accumulated += v / total));
    cumulative[n] = 1;
    return () => {
      const u = random();
      let lo = 0,
        hi = n;
      while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (cumulative[mid] <= u) lo = mid + 1;
        else hi = mid;
      }
      return lo;
    };
  };
  const drawA = sampler(nA, pA),
    drawB = sampler(nB, pB);
  return Array.from({ length: repetitions }, () => drawB() / nB - drawA() / nA);
}

export function monteCarloP(differences, observed) {
  const extreme = differences.reduce(
    (count, d) => count + (Math.abs(d) + 1e-12 >= Math.abs(observed) ? 1 : 0),
    0,
  );
  return { extreme, p: (extreme + 1) / (differences.length + 1) };
}

export function rejectionThreshold(
  differences,
  nA,
  nB,
  alpha,
  probability = null,
) {
  if (
    !differences.length ||
    1 / (differences.length + 1) > alpha ||
    probability === 0 ||
    probability === 1
  )
    return null;
  const sorted = differences.map(Math.abs).sort((a, b) => a - b);
  // At this value the inclusive tail is still too large. Ties require a
  // strictly larger result, not merely a value equal to the empirical quantile.
  const index = clamp(
    Math.ceil((1 - alpha) * (sorted.length + 1)) - 1,
    0,
    sorted.length - 1,
  );
  const nonRejecting = sorted[index];
  let smallest = Infinity;
  // Each achievable positive difference is kB/nB - kA/nA. For every kA,
  // inspect only the first kB giving a difference strictly above the cutoff.
  // Complementing both groups makes the attainable negative support symmetric.
  for (let kA = 0; kA <= nA; kA++) {
    const kB = Math.floor(nB * (kA / nA + nonRejecting + 1e-12)) + 1;
    if (kB >= 0 && kB <= nB) smallest = Math.min(smallest, kB / nB - kA / nA);
  }
  return Number.isFinite(smallest) &&
    monteCarloP(differences, smallest).p <= alpha
    ? smallest
    : null;
}

function lowerBound(values, target) {
  let lo = 0,
    hi = values.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (values[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function repeatedExperiments({
  nA,
  nB,
  base,
  effect,
  repetitions,
  trials,
  alpha,
  seed,
}) {
  // The true common rate is known in this synthetic world. A fresh reference
  // null distribution calibrates both repeated scenarios without a normal approximation.
  const reference = simulateDifferences(
    nA,
    nB,
    base,
    base,
    repetitions,
    seed + 11003,
  )
    .map(Math.abs)
    .sort((a, b) => a - b);
  const reject = (difference) =>
    (reference.length -
      lowerBound(reference, Math.abs(difference) - 1e-12) +
      1) /
      (reference.length + 1) <=
    alpha;
  const nullDifferences = simulateDifferences(
    nA,
    nB,
    base,
    base,
    trials,
    seed + 21011,
  );
  const alternativeDifferences = simulateDifferences(
    nA,
    nB,
    base,
    clamp(base + effect, 0, 1),
    trials,
    seed + 31013,
  );
  const falsePositives = nullDifferences.filter(reject).length;
  const detected = alternativeDifferences.filter(reject).length;
  return {
    falsePositives,
    detected,
    missed: trials - detected,
    trials,
    nullMean: mean(nullDifferences),
    alternativeMean: mean(alternativeDifferences),
  };
}

const percent = (value) => Math.round(value * 10000) / 100;
const memo = new Map();
function cached(key, factory) {
  if (!memo.has(key)) {
    if (memo.size > 12) memo.delete(memo.keys().next().value);
    memo.set(key, factory());
  }
  return memo.get(key);
}
function nullHistogram(values, max, count = 43) {
  const width = (2 * max) / count;
  const bins = Array.from({ length: count }, (_, i) => ({
    lo: -max + i * width,
    hi: -max + (i + 1) * width,
    count: 0,
  }));
  values.forEach(
    (v) => bins[clamp(Math.floor((v + max) / width), 0, count - 1)].count++,
  );
  return bins;
}

export default {
  id: "hypothesis-test",
  title: "統計的な判断と仮説検定",
  description: "A/Bテストの差は、偶然だけでどのくらい起こる？",
  lead: "架空の学習アプリで、案内AとBの登録率を比較。差の大きさ・人数・偶然の関係を、同じ実験の繰り返しから考えます。",
  initial: () => ({
    nA: 80,
    nB: 80,
    successA: 32,
    successB: 44,
    repetitions: 2000,
    alpha: 0.05,
    practical: 0.05,
    base: 0.4,
    effect: 0.1,
    trials: 400,
    seed: 2027,
  }),
  related: ["probability", "sampling", "crosstab"],
  explanation: academicExplanation("hypothesis-test"),
  render(root, ctx) {
    const s = ctx.state;
    const nA = clamp(Math.round(s.nA), 10, 1000),
      nB = clamp(Math.round(s.nB), 10, 1000);
    const successA = clamp(Math.round(s.successA), 0, nA),
      successB = clamp(Math.round(s.successB), 0, nB);
    const repetitions = clamp(Math.round(s.repetitions), 200, 5000);
    const trials = clamp(Math.round(s.trials), 100, 1500);
    const alpha = clamp(Number(s.alpha), 0.01, 0.1);
    const rateA = successA / nA,
      rateB = successB / nB,
      observed = rateB - rateA;
    const pooled = (successA + successB) / (nA + nB);
    const seed = Math.round(s.seed);
    const nullValues = cached(
      `null:${nA}:${nB}:${pooled}:${repetitions}:${seed}`,
      () => simulateDifferences(nA, nB, pooled, pooled, repetitions, seed),
    );
    const mc = monteCarloP(nullValues, observed);
    const critical = rejectionThreshold(nullValues, nA, nB, alpha, pooled);
    const maxAbs = Math.min(
      1.05,
      Math.max(
        0.12,
        Math.abs(observed) * 1.2,
        ...nullValues.map((v) => Math.abs(v) * 1.08),
      ),
    );
    const bins = nullHistogram(nullValues, maxAbs);
    const maxCount = Math.max(...bins.map((b) => b.count), 1) * 1.15;
    const a = axes({
      xmin: -maxAbs * 100,
      xmax: maxAbs * 100,
      ymin: 0,
      ymax: maxCount,
      xlabel: "登録率の差 B − A（ポイント）",
      ylabel: "回数",
      w: 760,
      h: 360,
    });
    const tailLeft =
      critical === null ? -maxAbs * 100 : Math.max(-maxAbs, -critical) * 100;
    const tailRight =
      critical === null ? maxAbs * 100 : Math.min(maxAbs, critical) * 100;
    const chart = svg(
      `<rect x="${a.x(-maxAbs * 100)}" y="16" width="${Math.max(0, a.x(tailLeft) - a.x(-maxAbs * 100))}" height="${a.y(0) - 16}" fill="#ede7fc"/><rect x="${a.x(tailRight)}" y="16" width="${Math.max(0, a.x(maxAbs * 100) - a.x(tailRight))}" height="${a.y(0) - 16}" fill="#ede7fc"/>${a.markup}${bins
        .map((b) => {
          const center = (b.lo + b.hi) / 2;
          const tail =
            Math.abs(center) + (b.hi - b.lo) / 2 >= Math.abs(observed);
          return `<rect x="${a.x(b.lo * 100) + 0.5}" y="${a.y(b.count)}" width="${Math.max(0, a.x(b.hi * 100) - a.x(b.lo * 100) - 1)}" height="${a.y(0) - a.y(b.count)}" fill="${tail ? "#d96d39" : "#087f8c"}"><title>${fmt(b.lo * 100, 1)}〜${fmt(b.hi * 100, 1)}ポイント：${b.count}回</title></rect>`;
        })
        .join(
          "",
        )}${[-1, 1].map((sign) => `<line x1="${a.x(sign * Math.abs(observed) * 100)}" x2="${a.x(sign * Math.abs(observed) * 100)}" y1="16" y2="${a.y(0)}" stroke="#b54d27" stroke-width="2" stroke-dasharray="5 3"/>${critical === null ? "" : `<line x1="${a.x(sign * critical * 100)}" x2="${a.x(sign * critical * 100)}" y1="16" y2="${a.y(0)}" stroke="#8054b4" stroke-width="1.5" stroke-dasharray="2 4"/>`}`).join("")}<text x="${a.x(observed * 100)}" y="30" text-anchor="${observed >= 0 ? "end" : "start"}" fill="#b54d27" font-size="12">今回 ${fmt(observed * 100, 1)} pt</text>`,
      "真の登録率に差がないと仮定したときの差の分布。橙は今回以上の絶対差、紫の背景は有意水準に対応する両側の裾。",
      760,
      360,
    );
    const base = clamp(Number(s.base), 0, 1),
      effect = clamp(Number(s.effect), -base, 1 - base);
    const repeated = cached(
      `rep:${nA}:${nB}:${base}:${effect}:${repetitions}:${trials}:${alpha}:${seed}`,
      () =>
        repeatedExperiments({
          nA,
          nB,
          base,
          effect,
          repetitions,
          trials,
          alpha,
          seed,
        }),
    );
    const repeatedRows = [
      {
        label: "真の差なし",
        count: repeated.falsePositives,
        negative: "正しく見送る",
        positive: "第1種の誤り",
      },
      {
        label: `真の差 ${fmt(effect * 100, 1)} pt`,
        count: repeated.detected,
        negative: effect === 0 ? "有意でない" : "見逃し（第2種の誤り）",
        positive: effect === 0 ? "第1種の誤り" : "検出",
      },
    ];
    const bands = svg(
      repeatedRows
        .map((row, i) => {
          const y = 25 + i * 91,
            w = (row.count / trials) * 650;
          return `<text x="32" y="${y}" font-size="14">${row.label}：有意 ${row.count} / ${trials}回（${fmt((row.count / trials) * 100, 1)}%）</text><rect x="32" y="${y + 13}" width="650" height="28" rx="4" fill="#dcebed"/>${w > 0 ? `<rect x="32" y="${y + 13}" width="${w}" height="28" rx="4" fill="${i === 0 || effect === 0 ? "#d96d39" : "#8054b4"}"/>` : ""}<text x="32" y="${y + 60}" font-size="11">色付き：${row.positive}　／　薄色：${row.negative}</text>`;
        })
        .join(""),
      "差なし・差ありの世界で同じ実験を繰り返したとき、有意と判定した割合",
      720,
      205,
    );
    const meaningful = Math.abs(observed) >= s.practical;
    const approximateMCse = Math.sqrt((mc.p * (1 - mc.p)) / repetitions);
    root.innerHTML = `<div class="stat-grid"><div><section class="panel chart-panel"><h2>観測された差は、どのくらい珍しい？</h2>${metrics(
      [
        ["Aの登録率", `${fmt(rateA * 100, 1)}%`, `${successA} / ${nA}人`],
        ["Bの登録率", `${fmt(rateB * 100, 1)}%`, `${successB} / ${nB}人`],
        [
          "B − A",
          `${fmt(observed * 100, 1)} ポイント`,
          "割合の差（相対的な伸び率ではない）",
        ],
      ],
    )}${chart}<div class="legend"><span style="color:#087f8c">■ 帰無仮説の分布</span><span style="color:#d96d39">■ 今回以上の絶対差</span><span style="color:#8054b4">■ αに対応する両側の裾</span></div>${metrics(
      [
        [
          "両側p値（推定）",
          fmt(mc.p, 4),
          `(${mc.extreme} ＋ 1) ÷ (${repetitions} ＋ 1)`,
        ],
        [
          "統計的な判断",
          mc.p <= alpha ? "有意" : "有意とはいえない",
          `事前の基準 α ＝ ${fmt(alpha, 2)}`,
        ],
        [
          "観測差の実用上の目安",
          meaningful ? "最小差以上" : "最小差未満",
          `最小差 ${fmt(s.practical * 100, 1)}ポイントと絶対差を比較`,
        ],
      ],
    )}<p class="hint">${critical === null ? "この条件の到達可能な差では、棄却域はありません。" : `p≤αになる到達可能な最小の絶対差：${fmt(critical * 100, 3)}ポイント（この値も棄却域に含む）。`}</p><p class="annotation">差のない世界を${repetitions}回試し、今回以上に大きな差は${mc.extreme}回。共通の成功確率は${fmt(pooled, 3)}です。</p><p class="hint">モンテカルロ誤差の標準誤差の目安：約${fmt(approximateMCse, 4)}。${Math.abs(mc.p - alpha) < 2 * approximateMCse ? "判定の境界に近いので反復数を増やし、結果のゆらぎを確かめましょう。" : "これはp値の推定誤差の目安であり、差の推定誤差とは異なります。"}</p>${pooled === 0 || pooled === 1 ? '<p class="hint">全員失敗／全員成功のため、推定された帰無分布は差0の1点に集中します。このデータだけで母集団の確率が完全に0／1だと断言はできません。</p>' : ""}</section><section class="panel"><h2>本当の差を知っている世界で、判断を試す</h2><p>各群の人数は上と同じ。Aの真の登録率を${fmt(base * 100, 1)}%、差ありのBを${fmt((base + effect) * 100, 1)}%として、それぞれ${trials}回の独立した実験を行います。</p>${bands}${metrics(
      [
        [
          "第1種の誤り率（実験値）",
          `${fmt((repeated.falsePositives / trials) * 100, 1)}%`,
          "真の差なしで有意",
        ],
        [
          "検出力（実験値）",
          effect === 0
            ? "真の差0では定義しない"
            : `${fmt((repeated.detected / trials) * 100, 1)}%`,
          "真の差ありで有意",
        ],
        [
          "第2種の誤り率（実験値）",
          effect === 0
            ? "真の差0では定義しない"
            : `${fmt((repeated.missed / trials) * 100, 1)}%`,
          "真の差ありで有意にならない",
        ],
      ],
    )}<p class="hint">独立に${repetitions}回生成した「共通確率${fmt(base, 2)}の差なし分布」で両側判定します。上の観測データから推定した確率は使いません。各回の結果は独立ですが、判定のための参照分布は共通です。</p>${table(
      ["世界", "差の実験平均（ポイント）", "真の差（ポイント）"],
      [
        ["差なし", fmt(repeated.nullMean * 100, 2), "0"],
        [
          "差ありの設定",
          fmt(repeated.alternativeMean * 100, 2),
          fmt(effect * 100, 2),
        ],
      ],
    )}</section></div><aside><section class="panel controls"><h2>A/Bの観測結果を変える</h2>${s.groupLabels ? `<p class="hint">A = ${esc(s.groupLabels[0])} ／ B = ${esc(s.groupLabels[1])}</p>` : ""}${number("nA", "Aの対象人数", nA, 10, 1000, 1)}${number("successA", "Aの登録人数", successA, 0, nA, 1)}${number("nB", "Bの対象人数", nB, 10, 1000, 1)}${number("successB", "Bの登録人数", successB, 0, nB, 1)}<div class="actions"><button id="double">割合を保って人数2倍</button><button id="halve">割合を保って人数半分</button></div><p class="hint">人数は各群10〜1,000人。登録人数は整数に丸めるため、割合が少し変わる場合があります。</p>${range("alpha", "有意水準 α", alpha, 0.01, 0.1, 0.01)}${range("practical", "実用上意味がある最小差", percent(s.practical), 1, 20, 1, "ポイント")}${range("repetitions", "帰無分布のシミュレーション回数", repetitions, 200, 5000, 200, "回")}<h3>反復実験の「真の世界」</h3>${range("base", "真のA登録率", percent(base), 20, 80, 5, "%")}${range("effect", "真の登録率差 B − A", percent(effect), -20, 20, 1, "ポイント")}${range("trials", "世界ごとの反復実験回数", trials, 100, 1500, 100, "回")}<p class="hint">真の確率は、上の観測結果を直接変更しません。反復実験専用の条件です。</p>${number("seed", "再現用シード", seed, 1, 999999, 1)}<div class="actions"><button id="same-seed">同じ条件を再現</button><button id="next-seed">別の乱数で再試行</button></div><p class="hint">条件とシードが同じなら全く同じ結果。反復数の変更では、同じ乱数列を使って計算します。</p></section></aside></div>`;
    bind(
      root,
      "nA",
      (v) => {
        const n = clamp(Math.round(Number(v)), 10, 1000);
        ctx.update({ nA: n, successA: Math.min(successA, n) });
      },
      "change",
    );
    bind(
      root,
      "nB",
      (v) => {
        const n = clamp(Math.round(Number(v)), 10, 1000);
        ctx.update({ nB: n, successB: Math.min(successB, n) });
      },
      "change",
    );
    bind(
      root,
      "successA",
      (v) => ctx.update({ successA: clamp(Math.round(Number(v)), 0, nA) }),
      "change",
    );
    bind(
      root,
      "successB",
      (v) => ctx.update({ successB: clamp(Math.round(Number(v)), 0, nB) }),
      "change",
    );
    for (const key of ["alpha", "repetitions", "trials"])
      bind(root, key, (v) => ctx.update({ [key]: Number(v) }));
    for (const key of ["base", "effect", "practical"])
      bind(root, key, (v) => ctx.update({ [key]: Number(v) / 100 }));
    bind(
      root,
      "seed",
      (v) => ctx.update({ seed: clamp(Math.round(Number(v)), 1, 999999) }),
      "change",
    );
    for (const [id, factor] of [
      ["double", 2],
      ["halve", 0.5],
    ])
      root.querySelector(`#${id}`).addEventListener("click", () => {
        const na = clamp(Math.round(nA * factor), 10, 1000),
          nb = clamp(Math.round(nB * factor), 10, 1000);
        ctx.update({
          nA: na,
          nB: nb,
          successA: Math.round(rateA * na),
          successB: Math.round(rateB * nb),
        });
      });
    root
      .querySelector("#same-seed")
      .addEventListener("click", () => ctx.update({ seed }));
    root
      .querySelector("#next-seed")
      .addEventListener("click", () => ctx.update({ seed: seed + 1 }));
  },
};

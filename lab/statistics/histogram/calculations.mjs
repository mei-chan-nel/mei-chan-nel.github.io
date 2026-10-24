import { esc, table } from "../shared/ui.mjs?v=20261025-remove-probability";
import {
  describe,
  oneWayAnova,
  quartileRanks,
} from "./descriptive.mjs?v=20261025-remove-probability";

const n = (value) =>
  value === null || value === undefined
    ? "—"
    : Number(value).toLocaleString("ja-JP", { maximumFractionDigits: 4 });
const groupName = (s, g) =>
  `${g === "A" ? "● A" : "◆ B"}${s.groupNames?.[g === "A" ? 0 : 1] && s.groupNames[g === "A" ? 0 : 1] !== g ? `：${s.groupNames[g === "A" ? 0 : 1]}` : ""}`;
const metric = (label, value, key, display = n(value)) =>
  `<div><small>${esc(label)}</small><strong data-stat="${key}" data-value="${value ?? ""}">${esc(display)}</strong></div>`;
function medianStep(values, offset = 0) {
  const length = values.length;
  if (!length) return "データがありません。";
  if (length % 2)
    return `${offset + (length + 1) / 2}番目の値 = <strong>${n(values[(length - 1) / 2])}</strong>`;
  return `${offset + length / 2}番目と${offset + length / 2 + 1}番目の平均 = (${n(values[length / 2 - 1])} ＋ ${n(values[length / 2])}) ÷ 2 = <strong>${n((values[length / 2 - 1] + values[length / 2]) / 2)}</strong>`;
}
function meanView(rows, d) {
  const terms = rows.map((r) => n(r.value));
  return `<section class="calculation-section"><h3>平均：合計をデータの個数で割る</h3><ol class="calculation-steps"><li>全ての値を足す：Σxᵢ = <strong>${n(d.sum)}</strong></li><li>個数を数える：n = <strong>${d.n}</strong></li><li class="calculation-formula">x̄ = Σxᵢ ÷ n = ${n(d.sum)} ÷ ${d.n} = <strong>${n(d.mean)}</strong></li></ol><div class="metrics">${metric("平均 x̄", d.mean, "mean")}${metric("合計 Σxᵢ", d.sum, "sum")}${metric("個数 n", d.n, "n")}</div><p>平均は外れ値の影響を受けます。端の値を変えて確かめましょう。</p><details><summary>全ての値と足し算を確認</summary><p class="calculation-formula">${terms.join(" ＋ ")} = ${n(d.sum)}</p>${table(
    ["元の番号", "群", "値 xᵢ"],
    rows.map((r) => [r.index + 1, r.group, n(r.value)]),
  )}</details></section>`;
}
function quartileView(d) {
  const h = Math.floor(d.n / 2),
    lower = d.sorted.slice(0, h),
    upper = d.sorted.slice(Math.ceil(d.n / 2));
  const ranks = quartileRanks(d.n);
  const labels = {
    q1: "第1四分位数 Q₁",
    q2: "中央値 Q₂",
    q3: "第3四分位数 Q₃",
  };
  const symbols = { q1: "Q₁", q2: "Q₂", q3: "Q₃" };
  const rankText = (key) =>
    `全体の${ranks[key].map((rank) => `${rank}番目`).join("と")}${ranks[key].length === 2 ? "の平均" : "の値"}`;
  const cards = ["q1", "q2", "q3"]
    .map(
      (key) =>
        `<section data-quartile-card="${key}"><h4><span class="quartile-badge" data-quartile="${key}">${symbols[key]}</span> ${labels[key].split(" ")[0]}</h4><p class="quartile-ranks">${rankText(key)}</p><p>${key === "q2" ? medianStep(d.sorted) : d.n === 1 ? "1件の表示規則として同じ値を使います。" : `${key === "q1" ? `下位${h}個` : `上位${h}個`}の中央を使います。<br>${medianStep(key === "q1" ? lower : upper, key === "q1" ? 0 : Math.ceil(d.n / 2))}`}</p></section>`,
    )
    .join("");
  const cells = (values, offset) =>
    `<ol class="ordered-values" start="${offset + 1}">${values
      .map((v, j) => {
        const rank = offset + j + 1;
        const keys = ["q1", "q2", "q3"].filter((key) =>
          ranks[key].includes(rank),
        );
        return `<li data-rank="${rank}" ${keys.length ? 'class="quartile-source"' : ""}><small>${rank}番目</small><strong>${n(v)}</strong><span class="quartile-markers">${keys.map((key) => `<span class="quartile-badge" data-quartile="${key}" aria-label="${labels[key]}の計算に使う値">${symbols[key]}</span>`).join("")}</span></li>`;
      })
      .join("")}</ol>`;
  const ordered =
    d.n === 1
      ? cells(d.sorted, 0)
      : `<section class="quartile-half"><h4>下位${h}個：全体の1〜${h}番目</h4>${cells(lower, 0)}</section>${d.n % 2 ? `<section class="quartile-half"><h4>中央の1個：上下の半分には含めません</h4>${cells([d.sorted[h]], h)}</section>` : ""}<section class="quartile-half"><h4>上位${h}個：全体の${Math.ceil(d.n / 2) + 1}〜${d.n}番目</h4>${cells(upper, Math.ceil(d.n / 2))}</section>`;
  return `<section class="calculation-section"><h3>中央値・四分位数：小さい順に並べて、中央を探す</h3><p>Q₁は下位半分の中央、Q₂は全体の中央、Q₃は上位半分の中央です。下の印は、計算に使う値そのものを示します。2個に同じ印があるときは、その2個の平均を取ります。</p><div class="quartile-calculations">${cards}</div>${ordered}<p>個数が奇数のときは中央の1個を上下の半分から除きます。</p><div class="metrics">${metric("第1四分位数 Q₁", d.q1, "q1")}${metric("中央値 Q₂", d.q2, "median")}${metric("第3四分位数 Q₃", d.q3, "q3")}${metric("四分位範囲 IQR", d.iqr, "iqr")}</div><p class="calculation-formula">IQR = Q₃ − Q₁ = ${n(d.q3)} − ${n(d.q1)} = ${n(d.iqr)}</p><p>箱ひげ図の箱はQ₁からQ₃、箱の中の線は中央値です。ひげの外に出す基準は ${n(d.lowerFence)} 未満、または ${n(d.upperFence)} 超。ひげ自体は基準値ではなく、その内側の実際の観測値まで伸ばします。</p></section>`;
}
function varianceView(rows, d, s) {
  const sample = !!s.varianceSample,
    denominator = d.n - (sample ? 1 : 0),
    v = sample ? d.sampleVariance : d.variance;
  return `<section class="calculation-section"><h3>分散：平均との差を二乗して平均する</h3><label class="histogram-axis-control" for="variance-definition"><span>分散の定義</span><select id="variance-definition"><option value="population" ${!sample ? "selected" : ""}>データ全体の分散（÷ n）</option><option value="sample" ${sample ? "selected" : ""}>母分散を推定する不偏分散（÷ n−1）</option></select></label><ol class="calculation-steps"><li>平均 x̄ = ${n(d.mean)} を求める。</li><li>各値の偏差 xᵢ − x̄ を求めて二乗する。</li><li>二乗の和 Σ(xᵢ − x̄)² = <strong>${n(d.ss)}</strong> を求める。</li><li class="calculation-formula">${sample ? "s²" : "σ²"} = ${n(d.ss)} ÷ ${denominator} = <strong>${n(v)}</strong></li></ol>${denominator <= 0 ? '<p role="status">1件では n−1 が0のため、不偏分散は定義できません。</p>' : ""}<div class="metrics">${metric(sample ? "不偏分散 s²" : "分散 σ²", v, "variance")}${metric(sample ? "標本標準偏差 s" : "標準偏差 σ", v === null ? null : Math.sqrt(v), "sd")}${metric("偏差平方和", d.ss, "ss")}</div><p class="calculation-formula">標準偏差 = √分散 = ${v === null ? "定義できない" : `√${n(v)} = ${n(Math.sqrt(v))}`}</p><p>分散の単位は元の単位の二乗、標準偏差は元のデータと同じ単位です。</p><details open><summary>1件ずつの偏差と二乗</summary>${table(
    ["元の番号", "群", "値 xᵢ", "偏差 xᵢ − x̄", "偏差の二乗"],
    rows.map((r) => [
      r.index + 1,
      r.group,
      n(r.value),
      n(r.value - d.mean),
      n((r.value - d.mean) ** 2),
    ]),
  )}<p>偏差の合計は丸め誤差を除いて0です。符号の打ち消し合いを避けるため、二乗してから足します。</p></details></section>`;
}
function anovaView(s) {
  const a = oneWayAnova(s.rows);
  const pText =
    a.p === null
      ? "—"
      : a.p === 0
        ? "< 1e−300"
        : a.p < 0.0001
          ? a.p.toExponential(4)
          : n(a.p);
  const interpretation = !a.available
    ? `<section class="anova-interpretation" data-anova-decision="unavailable"><h4>今回の結果の読み方</h4><p role="status">${esc(a.reason)} 検定の結論は出せません。</p></section>`
    : `<section class="anova-interpretation" data-anova-decision="${a.p < 0.05 ? "significant" : "not-significant"}"><h4>今回の結果（有意水準5%）</h4><p><strong>${a.p < 0.05 ? "p値が0.05未満なので、群の母平均に差があると判断します。" : "p値が0.05以上なので、今回のデータでは母平均の差を確認できません。"}</strong></p><p>F = ${n(a.f)}、p ${a.p === 0 ? "" : "= "}${esc(pText)}。群平均：${a.groups.map((g) => `${esc(groupName(s, g.group))} = ${n(g.mean)}`).join("、")}。</p></section>`;
  const groups = new Map(a.groups.map((g) => [g.group, g]));
  return `<section class="calculation-section anova-calculation"><h3>発展：群間・群内のばらつきから一元配置分散分析へ</h3><p>要因は「群」、観測値は「${esc(s.label || "値")}」。帰無仮説は「各群の母平均が等しい」です。同じ元データを、全体平均との差・群平均との差の2つの見方で調べます。</p><ol class="calculation-steps"><li>全体平均は個数で重み付けします：x̄ = Σ(nⱼ x̄ⱼ) ÷ N = <strong>${n(a.total.mean)}</strong>。</li><li class="calculation-formula">群間平方和 SS間 = Σ nⱼ(x̄ⱼ − x̄)² = <strong>${n(a.between)}</strong></li><li class="calculation-formula">群内平方和 SS内 = ΣΣ(xᵢⱼ − x̄ⱼ)² = <strong>${n(a.within)}</strong></li><li class="calculation-formula">全体平方和 SS全 = SS間 ＋ SS内<br>${n(a.total.ss)} = ${n(a.between)} ＋ ${n(a.within)}</li></ol><div class="metrics">${metric("群間平方和", a.between, "ss-between")}${metric("群内平方和", a.within, "ss-within")}${metric("全体平方和", a.total.ss, "ss-total")}</div>${table(
    ["群", "個数 nⱼ", "群平均 x̄ⱼ", "nⱼ(x̄ⱼ − x̄)²", "群内の偏差平方和"],
    a.groups.map((g) => [
      groupName(s, g.group),
      g.n,
      n(g.mean),
      n(g.n * (g.mean - a.total.mean) ** 2),
      n(g.ss),
    ]),
  )}<h4>自由度で割った平均平方を比べる</h4><p>N = ${a.n}、群数 k = ${a.k}。群間の自由度は k−1 = ${a.dfBetween}、群内の自由度は N−k = ${a.dfWithin} です。</p>${table(
    ["変動の要因", "平方和 SS", "自由度 df", "平均平方 MS"],
    [
      ["群間", n(a.between), a.dfBetween, n(a.msBetween)],
      ["群内（誤差）", n(a.within), a.dfWithin, n(a.msWithin)],
      ["全体", n(a.total.ss), a.dfTotal, "—"],
    ],
  )}<p class="calculation-formula">F = MS間 ÷ MS内 = ${n(a.msBetween)} ÷ ${n(a.msWithin)} = <strong>${n(a.f)}</strong></p><div class="metrics">${metric("F値", a.f, "f")}${metric("F分布の上側確率 p", a.p, "p", pText)}</div>${interpretation}<details class="anova-assumptions"><summary>計算の前提</summary><p>観測の独立性、各群の誤差の正規性、等分散性を仮定します。箱ひげ図で外れ値の位置も確かめましょう。</p></details><details><summary>全ての観測を使った平方和の内訳</summary>${table(
    [
      "元の番号",
      "群",
      "値",
      "全体平均との差²",
      "群平均との差²",
      "群平均と全体平均の差²",
    ],
    s.rows.map((r, i) => [
      i + 1,
      r.group,
      n(r.value),
      n((r.value - a.total.mean) ** 2),
      n((r.value - groups.get(r.group).mean) ** 2),
      n((groups.get(r.group).mean - a.total.mean) ** 2),
    ]),
  )}<p>偏差は xᵢⱼ−x̄ = (xᵢⱼ−x̄ⱼ)＋(x̄ⱼ−x̄) と分解できます。群内の偏差の合計が0なので、二乗の交差項が消え、平方和も分解できます。</p></details></section>`;
}

export function renderCalculations(root, ctx) {
  const s = ctx.state,
    kind = ["mean", "quartiles", "variance", "anova"].includes(s.calcKind)
      ? s.calcKind
      : "mean";
  const group =
    ["A", "B"].includes(s.calcGroup) &&
    s.rows.some((r) => r.group === s.calcGroup)
      ? s.calcGroup
      : "all";
  const rows = s.rows
    .map((r, index) => ({ ...r, index }))
    .filter((r) => group === "all" || r.group === group);
  const d = describe(rows.map((r) => r.value));
  root.innerHTML = `<section class="panel histogram-calculations"><header class="histogram-heading"><h2>代表値計算<small>同じ元データから計算</small></h2></header><nav class="calculation-tabs" aria-label="計算方法">${[
    ["mean", "平均"],
    ["quartiles", "中央値・四分位数"],
    ["variance", "分散・標準偏差"],
    ["anova", "発展：分散分析"],
  ]
    .map(
      ([id, label]) =>
        `<button type="button" data-calculation="${id}" aria-pressed="${kind === id}">${label}</button>`,
    )
    .join(
      "",
    )}</nav><div class="calculation-context"><label class="histogram-axis-control" for="calculation-group"><span>計算するデータ</span><select id="calculation-group" ${kind === "anova" ? "disabled" : ""}><option value="all" ${kind === "anova" || group === "all" ? "selected" : ""}>全体（${s.rows.length}件）</option>${[
    "A",
    "B",
  ]
    .filter((g) => s.rows.some((r) => r.group === g))
    .map(
      (g) =>
        `<option value="${g}" ${kind !== "anova" && group === g ? "selected" : ""}>${esc(groupName(s, g))}（${s.rows.filter((r) => r.group === g).length}件）</option>`,
    )
    .join(
      "",
    )}</select></label><p>表示は小数第4位まで。計算には丸める前の値を使います。${kind === "anova" ? "分散分析は全ての群を比較します。" : ""}</p></div>${kind === "anova" ? anovaView(s) : kind === "quartiles" ? quartileView(d) : kind === "variance" ? varianceView(rows, d, s) : meanView(rows, d)}</section>`;
  root
    .querySelectorAll("[data-calculation]")
    .forEach(
      (button) =>
        (button.onclick = () =>
          ctx.update({ calcKind: button.dataset.calculation })),
    );
  root.querySelector("#calculation-group").onchange = (e) =>
    ctx.update({ calcGroup: e.target.value });
  root
    .querySelector("#variance-definition")
    ?.addEventListener("change", (e) =>
      ctx.update({ varianceSample: e.target.value === "sample" }),
    );
}

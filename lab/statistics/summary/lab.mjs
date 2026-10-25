import {
  mean,
  variance,
  sd,
  median,
  quartiles,
  fmt,
  clamp,
} from "../shared/math.mjs";
import {
  esc,
  range,
  number,
  select,
  metrics,
  table,
  svg,
  bind,
  drag,
} from "../shared/ui.mjs?v=20261025-plain-copy";
import { readDataset } from "../shared/data.mjs?v=20261025-plain-copy";

const original = [40, 45, 50, 52, 58, 60, 60, 62, 68, 70, 75, 80];
const makePoints = (values) =>
  values.map((value, i) => ({ id: `s${i + 1}`, value }));
function baseState() {
  return {
    points: makePoints(original),
    selectedId: "s12",
    min: 0,
    max: 100,
    meanLocked: false,
    spreadBase: [...original],
    spreadFactor: 1,
    sample: false,
    showSD: true,
    label: "確認テスト（点）",
    source: "架空の12人の確認テスト",
  };
}
function initial() {
  const state = baseState();
  if (
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("dataset") === "project"
  ) {
    const data = readDataset();
    const field =
      new URLSearchParams(window.location.search).get("field") === "x"
        ? "x"
        : "y";
    if (data.rows.length) {
      const values = data.rows.map((p) => Number(p[field]));
      state.points = makePoints(values);
      state.spreadBase = [...values];
      state.min = Math.min(
        0,
        Math.floor((Math.min(...values) * 1.15) / 10) * 10,
      );
      state.max = Math.max(
        10,
        Math.ceil((Math.max(...values) * 1.15) / 10) * 10,
      );
      state.label = field === "x" ? data.xLabel : data.yLabel;
      state.source = data.name;
      state.selectedId = state.points.at(-1).id;
    }
  }
  return state;
}

/** Balance a moved observation against the others without changing their total. */
export function rebalance(values, index, requested, min = 0, max = 100) {
  if (values.length < 2) return [...values];
  const total = values.reduce((a, b) => a + b, 0);
  const target = clamp(
    requested,
    Math.max(min, total - max * (values.length - 1)),
    Math.min(max, total - min * (values.length - 1)),
  );
  const result = [...values];
  result[index] = target;
  let remaining = total - result.reduce((a, b) => a + b, 0);
  for (
    let step = 0;
    step < values.length + 1 && Math.abs(remaining) > 1e-9;
    step++
  ) {
    const eligible = result
      .map((v, i) =>
        i !== index && (remaining > 0 ? v < max - 1e-10 : v > min + 1e-10)
          ? i
          : -1,
      )
      .filter((i) => i >= 0);
    if (!eligible.length) break;
    const share = remaining / eligible.length;
    eligible.forEach((i) => {
      const next = clamp(result[i] + share, min, max);
      remaining -= next - result[i];
      result[i] = next;
    });
  }
  return result;
}

/** Scale all deviations together; limit the factor before bounds can break the mean. */
export function scaleSpread(values, requested, min = 0, max = 100) {
  const center = mean(values);
  let limit = Infinity;
  values.forEach((v) => {
    if (v > center) limit = Math.min(limit, (max - center) / (v - center));
    else if (v < center) limit = Math.min(limit, (center - min) / (center - v));
  });
  const factor = clamp(requested, 0, limit);
  return { factor, values: values.map((v) => center + (v - center) * factor) };
}

export function boxSummary(values, mode = "five") {
  const sorted = [...values].sort((a, b) => a - b),
    q = quartiles(values);
  const iqr = q.q3 - q.q1;
  const inner =
    mode === "iqr"
      ? sorted.filter((v) => v >= q.q1 - 1.5 * iqr && v <= q.q3 + 1.5 * iqr)
      : sorted;
  const lower = inner[0] ?? sorted[0] ?? null,
    upper = inner.at(-1) ?? sorted.at(-1) ?? null;
  return {
    ...q,
    lower,
    upper,
    outliers: sorted.filter((v) => v < lower || v > upper),
  };
}

function render(root, ctx) {
  const s = ctx.state;
  const values = s.points.map((p) => p.value),
    avg = mean(values),
    med = median(values);
  const q = quartiles(values),
    deviation = sd(values, s.sample),
    vari = variance(values, s.sample);
  const selected = s.points.find((p) => p.id === s.selectedId) || s.points[0];
  const sorted = [...values].sort((a, b) => a - b),
    iqr = q.q3 - q.q1;
  const { lower, upper, outliers } = boxSummary(values, s.boxMode);
  const span = s.max - s.min;
  const x = (v) => 55 + (625 * (v - s.min)) / span,
    ix = (px) => clamp(((px - 55) * span) / 625 + s.min, s.min, s.max);
  const ticks = Array.from(
    { length: 11 },
    (_, i) =>
      `<line x1="${x(s.min + (span * i) / 10)}" x2="${x(s.min + (span * i) / 10)}" y1="168" y2="174" stroke="var(--chart-axis)"/><text x="${x(s.min + (span * i) / 10)}" y="192" text-anchor="middle" fill="currentColor" font-size="12">${fmt(s.min + (span * i) / 10, 0)}</text>`,
  ).join("");
  let drawing = `<text x="55" y="23" fill="currentColor" font-size="14">1点 = 1件。点を左右に動かせます</text><line x1="55" x2="680" y1="168" y2="168" stroke="var(--chart-axis)"/>${ticks}`;
  if (s.showSD && Number.isFinite(deviation))
    drawing += `<rect x="${x(Math.max(s.min, avg - deviation))}" y="37" width="${x(Math.min(s.max, avg + deviation)) - x(Math.max(s.min, avg - deviation))}" height="113" fill="var(--chart-secondary-pale)"/><text x="367" y="49" text-anchor="middle" fill="var(--chart-secondary-dark)" font-size="11">平均 ± 標準偏差（目盛の範囲内）</text>`;
  drawing += `<line x1="${x(avg)}" x2="${x(avg)}" y1="48" y2="166" stroke="var(--chart-secondary)" stroke-width="2"/><line x1="${x(med)}" x2="${x(med)}" y1="48" y2="166" stroke="var(--chart-primary)" stroke-width="2" stroke-dasharray="5 4"/>`;
  const placed = [];
  s.points.forEach((p, i) => {
    const px = x(p.value);
    let row = 0;
    while (placed.some((d) => d.row === row && Math.abs(d.x - px) < 18)) row++;
    placed.push({ x: px, row });
  });
  const dotStep = Math.min(19, 85 / Math.max(1, ...placed.map((p) => p.row)));
  s.points.forEach((p, i) => {
    drawing += `<circle class="point" data-id="${esc(p.id)}" cx="${placed[i].x}" cy="${143 - placed[i].row * dotStep}" r="${Math.min(8, Math.max(3, dotStep / 2 - 1))}" style="fill:${p.id === selected?.id ? "var(--chart-secondary)" : "var(--chart-primary)"};stroke:${p.id === selected?.id ? "var(--chart-secondary-dark)" : "#fff"};stroke-width:2" tabindex="0" role="button" aria-label="データ${i + 1}、${fmt(p.value)}。選択して数値で編集可能"><title>データ${i + 1}: ${fmt(p.value)}</title></circle>`;
  });
  drawing += `<text x="55" y="226" fill="currentColor" font-size="14">${s.boxMode === "iqr" ? "発展：箱ひげ図（1.5IQR方式）" : "箱ひげ図（最小値〜最大値）"}</text><line x1="${x(lower)}" x2="${x(upper)}" y1="264" y2="264" stroke="var(--chart-primary-dark)" stroke-width="2"/><line x1="${x(lower)}" x2="${x(lower)}" y1="251" y2="277" stroke="var(--chart-primary-dark)" stroke-width="2"/><line x1="${x(upper)}" x2="${x(upper)}" y1="251" y2="277" stroke="var(--chart-primary-dark)" stroke-width="2"/><rect x="${x(q.q1)}" y="244" width="${Math.max(0, x(q.q3) - x(q.q1))}" height="40" fill="var(--chart-primary-pale)" stroke="var(--chart-primary)" stroke-width="2"/><line x1="${x(med)}" x2="${x(med)}" y1="244" y2="284" stroke="var(--chart-primary)" stroke-width="4"/>${outliers.map((v) => `<circle cx="${x(v)}" cy="264" r="5" fill="var(--chart-secondary)"><title>1.5IQRの範囲外: ${fmt(v)}</title></circle>`).join("")}<text x="${x(q.q1)}" y="310" text-anchor="end" fill="currentColor" font-size="12">Q₁</text><text x="${x(med)}" y="333" text-anchor="middle" fill="currentColor" font-size="12">中央値</text><text x="${x(q.q3)}" y="310" text-anchor="start" fill="currentColor" font-size="12">Q₃</text><text x="680" y="353" text-anchor="end" fill="currentColor" font-size="12">${esc(s.label)}</text>`;
  const selectedD = selected ? selected.value - avg : NaN;
  const denom = s.sample ? values.length - 1 : values.length;
  const sse = values.reduce((t, v) => t + (v - avg) ** 2, 0);
  root.innerHTML = `${metrics([
    ["平均値", fmt(avg), "合計を件数で等分"],
    ["中央値", fmt(med), "小さい順で中央"],
    [
      s.sample ? "標本標準偏差" : "標準偏差",
      Number.isFinite(deviation) ? fmt(deviation) : "定義できない",
      s.sample ? "分散の分母 n−1" : "分散の分母 n",
    ],
    ["四分位範囲", fmt(iqr), "Q₃ − Q₁：中央50%の広がり"],
  ])}
    <div class="stat-grid"><section class="panel chart-panel"><h2>中心と広がりを同時に見る</h2><p class="muted">${esc(s.dataInfo?.name || s.source)} ／ ${values.length}件</p>${svg(drawing, "点を直接動かせるドットプロットと箱ひげ図", 720, 365).replace("<svg", '<svg id="summary-chart" style="touch-action:none"')}<p class="legend">橙の縦線：平均　青緑の破線：中央値　薄い帯：平均±標準偏差</p><p class="hint">平均±標準偏差の帯に必ず一定割合の点が入るわけではありません。箱は第1〜第3四分位数の範囲です。${s.boxMode === "iqr" ? "橙の小点は1.5IQR方式のひげの外側にあり、データの誤りとは限りません。" : "基本のひげは最小値と最大値まで伸びます。"}</p></section>
    <section class="panel controls"><h2>1点を動かす、全体を広げる</h2>
      ${select(
        "summary-selected",
        "編集する点",
        s.points.map((p, i) => [p.id, `データ${i + 1}: ${fmt(p.value)}`]),
        selected?.id || "",
      )}
      ${selected ? number("summary-value", s.label, selected.value, s.min, s.max, 0.5) : ""}
      <label><input id="summary-lock" type="checkbox" ${s.meanLocked ? "checked" : ""}> 平均を固定して点を動かす</label><p class="hint">${s.meanLocked ? "選択点の増減をほかの点へ均等に配り、合計を保ちます。上下限に達した点を除いて再配分します。" : "点を1つ動かしたとき、平均・中央値・標準偏差のどれが変わるか予想しましょう。"}</p>
      ${range("summary-spread", "平均を保って、全体のばらつきを拡大", s.spreadFactor, 0, 2.5, 0.05, "倍")}
      <p class="hint">基準データの各偏差を同じ倍率にします。上限・下限を越える手前で止めるため、平均は変わりません。点を個別に編集すると、その状態が新しい基準になります。</p>
      <div class="actions"><button id="summary-outlier" type="button">選択点を上限へ</button><button id="summary-add" type="button" ${s.meanLocked || s.points.length >= 40 ? "disabled" : ""}>平均の点を追加</button><button id="summary-remove" type="button" ${s.meanLocked || s.points.length <= 2 ? "disabled" : ""}>選択点を削除</button></div>
      ${s.meanLocked ? '<p class="muted">件数の変更は平均固定を解除して行えます。</p>' : ""}
      ${select(
        "summary-box-mode",
        "箱ひげ図の方式",
        [
          ["five", "基本：最小値〜最大値のひげ"],
          ["iqr", "発展：1.5IQR方式・外側は点"],
        ],
        s.boxMode || "five",
      )}
      <label><input id="summary-sd" type="checkbox" ${s.showSD ? "checked" : ""}> 平均±標準偏差の帯を表示</label>
      ${select(
        "summary-denominator",
        "分散の定義",
        [
          ["population", "このデータ全体の分散（÷ n）"],
          ["sample", "母分散を推定する不偏分散（÷ n−1）"],
        ],
        s.sample ? "sample" : "population",
      )}
    </section></div>
    <div class="stat-grid"><section class="panel"><h2>偏差から分散・標準偏差へ</h2>
      <p>選択したデータ：${selected ? fmt(selected.value) : "—"} ／ 平均：${fmt(avg)}</p><p class="annotation">偏差 = ${selected ? fmt(selected.value) : "—"} − ${fmt(avg)} = <strong>${fmt(selectedD)}</strong><br>偏差の二乗 = <strong>${fmt(selectedD ** 2)}</strong></p>
      ${svg(`<line x1="55" x2="680" y1="70" y2="70" stroke="var(--chart-axis)"/><line x1="${x(avg)}" x2="${x(avg)}" y1="30" y2="105" stroke="var(--chart-secondary)" stroke-width="2"/><rect x="${x(Math.min(avg, selected?.value ?? avg))}" y="54" width="${Math.abs(x(selected?.value ?? avg) - x(avg))}" height="32" fill="var(--chart-primary-pale)"/><circle cx="${x(selected?.value ?? avg)}" cy="70" r="7" fill="var(--chart-primary)"/><text x="${clamp(x(avg), 110, 625)}" y="125" text-anchor="middle" font-size="12" fill="currentColor">平均 ${fmt(avg)}</text><text x="${clamp(x(selected?.value ?? avg), 110, 625)}" y="23" text-anchor="middle" font-size="12" fill="currentColor">選択点 ${fmt(selected?.value ?? avg)}</text>`, "選択した点と平均の距離、すなわち偏差", 720, 150)}
      <p>偏差の合計 = ${fmt(
        values.reduce((t, v) => t + v - avg, 0),
        6,
      )}。符号が打ち消し合うので、二乗して広がりを測ります。</p><p class="annotation">分散 = Σ(偏差²) ÷ ${s.sample ? "(n−1)" : "n"} = ${fmt(sse)} ÷ ${denom} = <strong>${Number.isFinite(vari) ? fmt(vari) : "定義できない"}</strong><br>標準偏差 = √分散 = <strong>${Number.isFinite(deviation) ? fmt(deviation) : "定義できない"}</strong></p><p class="muted">分散の単位は「${esc(s.label)}の二乗」。平方根を取ると、標準偏差は元のデータと同じ単位に戻ります。</p>
    </section><section class="panel"><h2>データの中身と、箱の境界</h2>
      ${table(["最小値", "第1四分位数", "中央値", "第3四分位数", "最大値"], [[fmt(sorted[0]), fmt(q.q1), fmt(med), fmt(q.q3), fmt(sorted.at(-1))]])}
      <p>${s.boxMode === "iqr" ? `発展の1.5IQR方式：境界 ${fmt(q.q1 - 1.5 * iqr)} 〜 ${fmt(q.q3 + 1.5 * iqr)} の内側にある実測値 ${fmt(lower)} 〜 ${fmt(upper)} までひげを伸ばし、外側は点で示します。` : `基本の5数要約方式：ひげは最小値 ${fmt(lower)} から最大値 ${fmt(upper)} まで。四分位数と中央値を合わせた5つの値で表します。`}</p>
      <details><summary>全員の値・偏差・二乗を見る</summary>${table(
        ["データ", s.label, "偏差", "偏差²"],
        s.points.map((p, i) => [
          i + 1,
          fmt(p.value),
          fmt(p.value - avg),
          fmt((p.value - avg) ** 2),
        ]),
      )}<p>合計 ${fmt(values.reduce((a, b) => a + b, 0))} ／ 偏差²の合計 ${fmt(sse)}</p></details>
      <p class="hint">並び順で中央をとる中央値と四分位数は、平均とは違う反応をします。表の値と図の位置を見比べましょう。</p>
    </section></div>`;

  const edit = (id, value) => {
    const index = s.points.findIndex((p) => p.id === id);
    if (index < 0) return;
    const next = s.meanLocked
      ? rebalance(values, index, value, s.min, s.max)
      : values.map((v, i) => (i === index ? clamp(value, s.min, s.max) : v));
    ctx.update({
      points: s.points.map((p, i) => ({ ...p, value: next[i] })),
      selectedId: id,
      spreadBase: next,
      spreadFactor: 1,
    });
  };
  bind(
    root,
    "summary-selected",
    (selectedId) => ctx.update({ selectedId }),
    "change",
  );
  bind(root, "summary-value", (value) => edit(selected.id, value));
  bind(root, "summary-spread", (requested) => {
    const next = scaleSpread(s.spreadBase, requested, s.min, s.max);
    ctx.update({
      points: s.points.map((p, i) => ({ ...p, value: next.values[i] })),
      spreadFactor: next.factor,
    });
  });
  bind(
    root,
    "summary-box-mode",
    (boxMode) => ctx.update({ boxMode }),
    "change",
  );
  bind(
    root,
    "summary-denominator",
    (choice) => ctx.update({ sample: choice === "sample" }),
    "change",
  );
  root
    .querySelector("#summary-lock")
    .addEventListener("change", (e) =>
      ctx.update({ meanLocked: e.target.checked }),
    );
  root
    .querySelector("#summary-sd")
    .addEventListener("change", (e) =>
      ctx.update({ showSD: e.target.checked }),
    );
  root
    .querySelector("#summary-outlier")
    .addEventListener("click", () => edit(selected.id, s.max));
  root.querySelector("#summary-add").addEventListener("click", () => {
    if (s.meanLocked || s.points.length >= 40) return;
    const id = `new-${Date.now()}`,
      next = [...s.points, { id, value: avg }];
    ctx.update({
      points: next,
      selectedId: id,
      spreadBase: next.map((p) => p.value),
      spreadFactor: 1,
    });
  });
  root.querySelector("#summary-remove").addEventListener("click", () => {
    if (s.meanLocked || s.points.length <= 2) return;
    const next = s.points.filter((p) => p.id !== selected.id);
    ctx.update({
      points: next,
      selectedId: next[0].id,
      spreadBase: next.map((p) => p.value),
      spreadFactor: 1,
    });
  });
  const chart = root.querySelector("#summary-chart");
  chart.querySelectorAll("[data-id]").forEach((el) => {
    el.addEventListener("click", () =>
      ctx.update({ selectedId: el.dataset.id }),
    );
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        ctx.update({ selectedId: el.dataset.id });
      }
    });
  });
  drag(chart, "[data-id]", (el, sx) =>
    edit(el.dataset.id, Math.round(ix(sx) * 2) / 2),
  );
}

export default {
  id: "summary",
  title: "代表値とばらつき",
  description:
    "同じ平均でも、データの姿は違う。点・偏差・箱ひげ図をつないで理解する。",
  lead: "このクラスの「ふつうの得点」は何点？ 1人の点を動かして、平均・中央値・広がりの変化を比べてみましょう。",
  initial,
  render,
  explanation: `<h2>中心の位置と、広がりを組み合わせる</h2><p>平均値は全員の合計を等しく分けた値です。すべての値を使うため、極端な値にも影響されます。中央値は並べ替えた中央の値で、人数が偶数なら中央の2値の平均。外側の値がさらに遠くへ動いても、中央の順位が変わらなければ中央値は変わりません。片方だけを「正しい代表値」とせず、分布の形や分析目的と一緒に選びます。</p><h3>分散と標準偏差</h3><p>偏差は各データと平均の差。偏差の合計は0になるため、その二乗を平均して分散を求めます。標準偏差は分散の平方根。偏差をk倍にすると、分散はk²倍、標準偏差は|k|倍になります。すべての値に同じ数を足しても、偏差・分散・標準偏差は変わりません。</p><p>このデータそのものを記述するときは二乗の合計をnで割ります。無作為標本から母分散を推定するときはn−1で割る不偏分散が使われます。その平方根（標本標準偏差）自体が母標準偏差の不偏推定量という意味ではありません。人数1ではn−1が0となり、定義できません。</p><h3>四分位数と箱ひげ図の約束</h3><p>この教材では、中央値を求め、人数が奇数なら中央の1値を除いた下半分・上半分それぞれの中央値をQ₁・Q₃とします。Q₃−Q₁が四分位範囲（IQR）。ソフトや教科書には補間など別の四分位数の定義があり、小さなデータでは数値が異なることがあります。</p><p>箱ひげ図はQ₁〜Q₃を箱、中央値を箱内の線として示します。基本表示は、最小値から最大値までひげを伸ばす5数要約方式です。「発展：1.5IQR方式」へ切り替えると、Q₁−1.5IQR〜Q₃+1.5IQRの内側の最小・最大の実測値までひげを伸ばし、外側は点で表示します。方式が違っても四分位数と元データは変わりません。外側の点が誤りとは限らず、理由を調べて判断します。</p><h3>読み取れないこともある</h3><p>平均と標準偏差が同じでも、左右対称か、山が2つあるか、外れ値があるかは決まりません。箱ひげ図だけでも山の数は読み取れません。ドットプロットやヒストグラムを併用して、値がどこに集まっているか確かめましょう。架空データは操作による発見のために独自に作成しています。</p>`,
  related: ["histogram", "correlation", "projects", "sampling"],
};

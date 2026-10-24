import { academicExplanation } from "../shared/reading.mjs?v=20261024-guided-counts";
import {
  sum,
  mean,
  median,
  gini,
  lorenz,
  fmt,
  clamp,
} from "../shared/math.mjs";
import {
  esc,
  number,
  select,
  metrics,
  table,
  svg,
  axes,
  line,
  bind,
  drag,
} from "../shared/ui.mjs";

const ORIGINAL = [8, 10, 12, 16, 20, 24, 30, 40, 60, 80];
export function redistribute(values, index, target, locked = true) {
  const total = sum(values),
    result = [...values];
  const next = clamp(Number(target) || 0, 0, locked ? total : 1000000);
  if (!locked) {
    result[index] = next;
    return result;
  }
  if (values.length < 2) return [...values];
  const remainder = total - next,
    otherTotal = total - values[index];
  result[index] = next;
  const others = values.map((_, i) => i).filter((i) => i !== index);
  let assigned = 0;
  others.forEach((i, j) => {
    result[i] =
      j === others.length - 1
        ? Math.max(0, remainder - assigned)
        : otherTotal > 0
          ? (remainder * values[i]) / otherTotal
          : remainder / others.length;
    assigned += result[i];
  });
  return result;
}
export function transfer(values, from, to, amount) {
  if (from === to) return [...values];
  const next = [...values],
    actual = clamp(Number(amount) || 0, 0, next[from]);
  next[from] -= actual;
  next[to] += actual;
  return next;
}
export function cumulativeRows(values) {
  const total = sum(values),
    sorted = values
      .map((value, id) => ({ value, id }))
      .sort((a, b) => a.value - b.value || a.id - b.id);
  let cumulative = 0,
    previous = 0;
  return sorted.map((r, i) => {
    cumulative += r.value;
    const share = total > 0 ? cumulative / total : null,
      area = share === null ? null : (previous + share) / (2 * values.length);
    previous = share || 0;
    return {
      ...r,
      rank: i + 1,
      population: (i + 1) / values.length,
      cumulative,
      share,
      area,
    };
  });
}
function initial() {
  return {
    incomes: [...ORIGINAL],
    locked: true,
    selected: 0,
    from: 9,
    to: 0,
    amount: 10,
    reference: null,
    message: "",
  };
}
function f(value, d = 2) {
  return value === null || !Number.isFinite(value)
    ? "定義できません"
    : fmt(value, d);
}
function person(i) {
  return i < 26 ? `${String.fromCharCode(65 + i)}さん` : `${i + 1}番`;
}
function render(root, ctx) {
  const unit = ctx.state.dataInfo?.origin === "user" ? "" : "万円";
  const s = ctx.state,
    values = s.incomes,
    total = sum(values),
    n = values.length,
    coeff = gini(values),
    curve = lorenz(values),
    data = cumulativeRows(values);
  const ref = s.reference,
    refGini = ref ? gini(ref) : null;
  const a = axes({
    xmin: 0,
    xmax: 1,
    ymin: 0,
    ymax: 1,
    w: 720,
    h: 360,
    xlabel: "所得の低い方からの累積人数比率",
    ylabel: "累積所得比率",
  });
  const equality = `<line x1="${a.x(0)}" y1="${a.y(0)}" x2="${a.x(1)}" y2="${a.y(1)}" stroke="#64748b" stroke-dasharray="6 5"/><text x="${a.x(0.57)}" y="${a.y(0.67)}" fill="#64748b" font-size="12">完全平等線</text>`;
  const shade =
    total > 0
      ? `<polygon points="${[{ x: 0, y: 0 }, { x: 1, y: 1 }, ...curve.slice().reverse()].map((p) => `${a.x(p.x)},${a.y(p.y)}`).join(" ")}" fill="#168b8718"/>`
      : "";
  const reference =
    ref && sum(ref) > 0 ? line(lorenz(ref), a.x, a.y, "series warm") : "";
  const current = total > 0 ? line(curve, a.x, a.y) : "";
  const dots =
    total > 0
      ? data
          .map(
            (r) =>
              `<circle data-person="${r.id}" tabindex="0" role="button" aria-label="${person(r.id)}までの累積所得${fmt(r.share * 100, 1)}%" cx="${a.x(r.population)}" cy="${a.y(r.share)}" r="${r.id === s.selected ? 6 : 3.5}" fill="${r.id === s.selected ? "#de7c35" : "#168b87"}"><title>${person(r.id)}まで: ${fmt(r.share * 100, 1)}%</title></circle>`,
          )
          .join("")
      : "";
  const dragMax = Math.max(total, 1),
    barHeight = 70 + n * 34;
  const bars = values
    .map((v, i) => {
      const x = 70 + (v / dragMax) * 535,
        y = 26 + i * 34;
      return `<text x="8" y="${y + 4}" font-size="13" fill="currentColor">${person(i)}</text><line x1="70" y1="${y}" x2="605" y2="${y}" stroke="#e2e8f0" stroke-width="16"/><line x1="70" y1="${y}" x2="${x}" y2="${y}" stroke="${i === s.selected ? "#de7c35" : "#168b87"}" stroke-width="16"/><circle class="income-handle" data-person="${i}" cx="${x}" cy="${y}" r="8" fill="${i === s.selected ? "#de7c35" : "#168b87"}" stroke="white" stroke-width="2" style="cursor:ew-resize;touch-action:none"><title>${person(i)} ${fmt(v)}${unit}。横にドラッグして変更</title></circle><text x="620" y="${y + 4}" font-size="13" fill="currentColor">${esc(fmt(v, 1))}${unit}</text>`;
    })
    .join("");
  const area = coeff === null ? null : (1 - coeff) / 2;
  const selected = data.find((r) => r.id === s.selected);
  const referenceMetrics = ref
    ? `<p class="annotation">比較用（橙）：総額 ${fmt(sum(ref))}${unit}、平均 ${fmt(mean(ref))}${unit}、ジニ係数 ${f(refGini, 3)}。現在との差 ${coeff !== null && refGini !== null ? fmt(coeff - refGini, 3) : "—"}。</p>`
    : "";
  root.innerHTML = `
  <div class="stat-grid"><section class="panel chart-panel"><h2>所得を分けると、曲線はどう動く？</h2><p class="muted">${s.dataInfo?.origin === "user" ? "読み込んだ" : "架空の"}${n}人の所得です。${unit ? "単位は万円。" : "項目名と単位はデータタブで確認できます。"}税や世帯人数を省いたモデルとして比較します。</p>
  ${metrics([
    ["所得総額", `${fmt(total)}${unit}`],
    ["平均", `${fmt(mean(values))}${unit}`],
    ["中央値", `${fmt(median(values))}${unit}`],
    ["ジニ係数", f(coeff, 3)],
  ])}
  ${svg(a.markup + shade + equality + reference + current + dots, "所得の分配とローレンツ曲線。破線は完全平等線", 720, 360)}
  <div class="legend"><span style="color:#168b87">● 現在の分配</span>${ref ? '　<span style="color:#de7c35">● 比較用の分配</span>' : ""}</div>
  ${total === 0 ? '<p class="annotation" role="status">所得総額が0なので所得比率、ローレンツ曲線、ジニ係数は定義できません。1人以上の所得を増やしてください。総額固定中は先に固定を解除してください。</p>' : `<p class="annotation">${person(selected.id)}までの ${selected.rank}/${n}人（${fmt(selected.population * 100, 1)}%）が持つ所得は ${fmt(selected.cumulative)} / ${fmt(total)}${unit}（${fmt(selected.share * 100, 1)}%）です。</p>`}
  ${referenceMetrics}
  <div class="actions"><button type="button" data-action="same-gini">同じ平均・同じジニの2分布</button>${ref ? '<button type="button" data-action="clear-reference">曲線を1本に戻す</button>' : ""}</div>
  <p class="hint">「同じ平均・同じジニ」は4人の別々の分布を重ねます。曲線の交わりと最低所得・最高所得を確認してください。</p>
  </section>
  <section class="panel controls"><h2>所得を直接動かす</h2><label><input id="lock-total" type="checkbox" ${s.locked ? "checked" : ""}> 所得総額を固定する</label><p class="hint">固定中は1人を増減すると、残りの人の所得比を保って調整します。残りがすべて0の場合は等分します。丸い取っ手は横にドラッグできます。数値欄でも操作できます。</p>
  <div data-income-chart>${svg(bars, "1人ずつの所得。丸い取っ手を横に動かして変更", 720, barHeight)}</div>
  <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.65rem">${values.map((v, i) => number(`income-${i}`, `${person(i)}${unit ? "（" + unit + "）" : ""}`, Number(v.toFixed(2)), 0, s.locked ? Math.max(total, 0) : 1000000, 0.1)).join("")}</div>
  <div class="actions"><button type="button" data-action="equal">全員に等分する</button><button type="button" data-action="concentrate">1人に集中する</button></div>
  <h3>2人の間で再分配する</h3>
  ${select(
    "from",
    "渡す人",
    values.map((_, i) => [String(i), person(i)]),
    String(s.from),
  )}
  ${select(
    "to",
    "受け取る人",
    values.map((_, i) => [String(i), person(i)]),
    String(s.to),
  )}
  ${number("transfer-amount", `移す所得${unit ? "（" + unit + "）" : ""}`, s.amount, 0, Math.max(total, 1), 0.1)}
  <button type="button" data-action="transfer" class="primary">所得を移す</button><p class="hint" role="status" aria-live="polite">${esc(s.message || "移転では、所得総額はいつも保たれます。")}</p>
  </section></div>
  <section class="panel"><h2>累積と面積の計算をたどる</h2><p>所得の小さい順に並べて、人数と所得を積み上げます。人の名前を並べ替えても分配が同じなら曲線は変わりません。</p><div style="overflow-x:auto"><table class="stat-table"><thead><tr><th>順位・人</th><th>所得</th><th>累積人数比率</th><th>累積所得</th><th>累積所得比率</th><th>この区間の台形面積</th></tr></thead><tbody>${data.map((r) => `<tr data-person="${r.id}" tabindex="0" role="button" aria-label="${person(r.id)}を選択" style="${r.id === s.selected ? "background:#168b871a" : ""}"><th>${r.rank}・${person(r.id)}</th><td>${fmt(r.value)}</td><td>${r.rank}/${n} = ${fmt(r.population * 100, 1)}%</td><td>${fmt(r.cumulative)}</td><td>${r.share === null ? "—" : `${fmt(r.cumulative)}/${fmt(total)} = ${fmt(r.share * 100, 1)}%`}</td><td>${r.area === null ? "—" : fmt(r.area, 4)}</td></tr>`).join("")}</tbody></table></div>
  <p class="annotation">${area === null ? "総額が0なので比率と面積は計算できません。" : `各区間の面積 =（左端の累積所得比率 + 右端の累積所得比率）× (1/${n}) ÷ 2。台形面積の合計 = ${fmt(area, 4)}。ジニ係数 = 1 − 2 × ${fmt(area, 4)} = ${fmt(coeff, 3)}（丸め前の値で計算）。`}</p></section>`;
  root.querySelector("#lock-total").onchange = (e) =>
    ctx.update({ locked: e.target.checked, message: "" });
  values.forEach((_, i) =>
    bind(
      root,
      `income-${i}`,
      (v) =>
        ctx.update({
          incomes: redistribute(values, i, v, s.locked),
          selected: i,
          message: s.locked
            ? "総額を保って、残りの人に比例配分しました。"
            : "所得総額も変化します。平均も確かめましょう。",
        }),
      "change",
    ),
  );
  root.querySelectorAll("[data-person]").forEach((el) => {
    if (el.classList.contains("income-handle")) return;
    const choose = () => ctx.update({ selected: Number(el.dataset.person) });
    el.onclick = choose;
    el.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        choose();
      }
    };
  });
  const incomeSVG = root.querySelector("[data-income-chart] svg");
  drag(incomeSVG, ".income-handle", (target, x) => {
    const i = Number(target.dataset.person),
      targetIncome = clamp((x - 70) / 535, 0, 1) * dragMax;
    ctx.update({
      incomes: redistribute(
        ctx.state.incomes,
        i,
        targetIncome,
        ctx.state.locked,
      ),
      selected: i,
      message: "",
    });
  });
  bind(
    root,
    "from",
    (v) => ctx.update({ from: Number(v), message: "" }),
    "change",
  );
  bind(root, "to", (v) => ctx.update({ to: Number(v), message: "" }), "change");
  bind(
    root,
    "transfer-amount",
    (v) => ctx.update({ amount: Math.max(0, v), message: "" }),
    "change",
  );
  root.querySelector('[data-action="transfer"]').onclick = () => {
    const amount = Math.min(Math.max(0, s.amount), values[s.from]);
    ctx.update({
      incomes: transfer(values, s.from, s.to, s.amount),
      selected: s.to,
      message:
        s.from === s.to
          ? "別々の2人を選んでください。"
          : `${person(s.from)}から${person(s.to)}へ${fmt(amount)}${unit}移しました。`,
    });
  };
  root.querySelector('[data-action="equal"]').onclick = () =>
    ctx.update({
      incomes: values.map(() => total / n),
      message: "総額を保って等分しました。ジニ係数を確認しましょう。",
    });
  root.querySelector('[data-action="concentrate"]').onclick = () =>
    ctx.update({
      incomes: values.map((_, i) => (i === n - 1 ? total : 0)),
      selected: n - 1,
      message:
        total > 0
          ? `${n}人で1人だけが所得を持つ場合、ジニ係数は (${n}−1)/${n} です。`
          : "総額が0なので、所得を移すこともジニ係数を計算することもできません。",
    });
  root
    .querySelector('[data-action="clear-reference"]')
    ?.addEventListener("click", () => ctx.update({ reference: null }));
  root.querySelector('[data-action="same-gini"]').onclick = () => {
    const t = total;
    if (t === 0) {
      ctx.update({
        message:
          "総額が0なので比較できません。総額固定を解除して所得を入力してください。",
      });
      return;
    }
    ctx.update({
      incomes: [0, t / 4, t / 4, t / 2],
      reference: [t / 8, t / 8, t / 8, (t * 5) / 8],
      selected: 0,
      from: 3,
      to: 0,
      message:
        "4人の2分布は総額・平均・ジニ係数（0.375）が同じですが、所得の組み合わせは異なります。",
    });
  };
}
export default {
  id: "lorenz",
  title: "格差とローレンツ曲線",
  description: "所得を再分配して、累積の曲線とジニ係数を調べる。",
  lead: "同じ総額をどのように分けるか。所得を動かし、格差を1つの数値にまとめる意味と限界を考えましょう。",
  initial,
  render,
  explanation: academicExplanation("lorenz"),
  related: ["summary", "histogram", "crosstab"],
};

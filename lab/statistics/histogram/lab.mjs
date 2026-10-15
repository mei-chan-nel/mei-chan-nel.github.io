import { histogram, mean, median, fmt, clamp } from "../shared/math.mjs";
import {
  esc,
  range,
  select,
  metrics,
  svg,
  axes,
  line,
  bind,
} from "../shared/ui.mjs";
import { readDataset } from "../shared/data.mjs";

const EXAMPLE = [
  ...[36, 39, 41, 42, 44, 45, 45, 47, 49, 50, 52, 55].map((value, i) => ({
    id: `a${i}`,
    value,
    group: "A",
  })),
  ...[58, 61, 64, 65, 67, 68, 70, 72, 73, 76, 79, 83].map((value, i) => ({
    id: `b${i}`,
    value,
    group: "B",
  })),
];
export function parseRows(text) {
  const lines = text
    .trim()
    .split(/\n/)
    .filter((x) => x.trim());
  if (!lines.length) throw new Error("データを1行以上入力してください。");
  if (lines.length > 300)
    throw new Error("操作しやすいよう300件まで入力できます。");
  return lines.map((s, i) => {
    const parts = s.trim().split(/[,、\t ]+/),
      value = Number(parts[0]);
    if (parts[0] === "" || !Number.isFinite(value) || Math.abs(value) > 1000000)
      throw new Error(
        `${i + 1}行目の数値を確認してください（±1,000,000以内）。`,
      );
    const group = (parts[1] || "A").toUpperCase();
    if (!["A", "B"].includes(group))
      throw new Error(`${i + 1}行目の集団は A または B にしてください。`);
    return { id: `row-${i}`, value, group };
  });
}
export function displayedRows(state) {
  return state.rows.map((r) => ({
    ...r,
    value: r.value + (r.group === "B" ? Number(state.shiftB || 0) : 0),
  }));
}
export function binIndex(value, width, start) {
  const q = (value - start) / width;
  return Math.floor(q + 8 * Number.EPSILON * Math.max(1, Math.abs(q)));
}
export function distribution(rows, width, start) {
  const bins = histogram(
    rows.map((r) => r.value),
    width,
    start,
  );
  return bins.map((b) => ({
    ...b,
    a: rows.filter(
      (r) =>
        r.group === "A" &&
        binIndex(r.value, width, start) === binIndex(b.lo, width, start),
    ).length,
    b: rows.filter(
      (r) =>
        r.group === "B" &&
        binIndex(r.value, width, start) === binIndex(b.lo, width, start),
    ).length,
  }));
}
function initial() {
  if (
    typeof location !== "undefined" &&
    new URLSearchParams(location.search).get("dataset") === "project"
  ) {
    const data = readDataset(),
      field =
        new URLSearchParams(location.search).get("field") === "x" ? "x" : "y";
    const groups = [
      ...new Set(data.rows.map((r) => String(r.group ?? "未指定"))),
    ];
    return {
      groupNames: [groups[0] || "A", groups.slice(1).join("・") || "B"],
      showEditor: false,
      rows: data.rows.map((r, i) => ({
        id: r.id || `p${i}`,
        value: r[field],
        group: String(r.group ?? "未指定") === groups[0] ? "A" : "B",
      })),
      width: 10,
      start: 0,
      mode: "combined",
      measure: "count",
      shiftB: 0,
      selected: -1,
      source: data.name,
      label: field === "x" ? data.xLabel : data.yLabel,
      error: "",
    };
  }
  return {
    groupNames: ["A", "B"],
    showEditor: false,
    rows: EXAMPLE.map((r) => ({ ...r })),
    width: 10,
    start: 0,
    mode: "combined",
    measure: "count",
    shiftB: 0,
    selected: -1,
    source: "架空の24人がクイズを解き終わるまでの時間",
    label: "所要時間（秒）",
    error: "",
  };
}
function render(root, ctx) {
  const s = ctx.state,
    rows = displayedRows(s),
    n = rows.length;
  const span =
    Math.max(...rows.map((r) => r.value)) -
    Math.min(...rows.map((r) => r.value));
  const width = Math.max(0.1, Number(s.width) || 10, span / 120),
    bins = distribution(rows, width, s.start);
  const xmin = bins[0]?.lo ?? 0,
    xmax = bins.at(-1)?.hi ?? 100;
  const cumulative = s.measure === "cumulative",
    relative = s.measure === "relative";
  const maxCount = Math.max(
    1,
    ...bins.map((b) => (s.mode === "split" ? Math.max(b.a, b.b) : b.count)),
  );
  const ymax = cumulative ? 1 : (relative ? maxCount / n : maxCount) * 1.15;
  const a = axes({
    xmin,
    xmax,
    ymin: 0,
    ymax,
    w: 720,
    h: 360,
    xlabel: s.label,
    ylabel: cumulative ? "累積相対度数" : relative ? "相対度数" : "度数（人）",
  });
  const sel = bins[s.selected];
  const groupN = {
    A: rows.filter((r) => r.group === "A").length,
    B: rows.filter((r) => r.group === "B").length,
  };
  const grid = bins
    .map((b, i) => {
      const x = a.x(b.lo),
        w = a.x(b.hi) - x,
        chosen = i === s.selected;
      if (cumulative)
        return `<rect data-bin="${i}" tabindex="0" role="button" aria-label="階級 ${fmt(b.lo)} 以上 ${fmt(b.hi)} 未満" x="${x}" y="${a.y(1)}" width="${w}" height="${a.y(0) - a.y(1)}" fill="${chosen ? "#0d948818" : "transparent"}" stroke="${chosen ? "#0d9488" : "none"}"/>`;
      const values =
        s.mode === "split"
          ? [
              ["A", b.a, "#168b87"],
              ["B", b.b, "#de7c35"],
            ]
          : [["全体", b.count, "#168b87"]];
      return values
        .map(([g, count, color], j) => {
          const value = relative ? count / n : count,
            bw = w / values.length;
          return `<rect data-bin="${i}" tabindex="0" role="button" aria-label="${g}、${fmt(b.lo)}以上${fmt(b.hi)}未満、${count}人" x="${x + j * bw + 1}" y="${a.y(value)}" width="${Math.max(0.5, bw - 2)}" height="${Math.max(0, a.y(0) - a.y(value))}" fill="${color}" opacity="${sel && !chosen ? ".42" : ".88"}" stroke="${chosen ? "#172f36" : "none"}" stroke-width="2"><title>${g}: ${count}人</title></rect>`;
        })
        .join("");
    })
    .join("");
  let cumline = "";
  if (cumulative) {
    if (s.mode === "split") {
      for (const [group, key, cls] of [
        ["A", "a", "series"],
        ["B", "b", "series warm"],
      ]) {
        let count = 0;
        if (groupN[group] > 0)
          cumline += line(
            [
              { x: xmin, y: 0 },
              ...bins.map((b) => ({
                x: b.hi,
                y: (count += b[key]) / groupN[group],
              })),
            ],
            a.x,
            a.y,
            cls,
          );
      }
    } else
      cumline = line(
        [{ x: xmin, y: 0 }, ...bins.map((b) => ({ x: b.hi, y: b.cumulative }))],
        a.x,
        a.y,
      );
  }
  const rawX = (v) => 60 + ((v - xmin) / (xmax - xmin)) * 630;
  const raw = rows
    .map((r, i) => {
      const highlighted =
        sel &&
        binIndex(r.value, width, s.start) === binIndex(sel.lo, width, s.start);
      return `<circle data-raw="${i}" tabindex="0" role="button" aria-label="集団${r.group} ${fmt(r.value)}" cx="${rawX(r.value)}" cy="${r.group === "A" ? 38 : 74}" r="${highlighted ? 6 : 4.5}" fill="${r.group === "A" ? "#168b87" : "#de7c35"}" opacity="${sel && !highlighted ? ".25" : ".9"}"><title>${r.group}: ${fmt(r.value)}</title></circle>`;
    })
    .join("");
  const selectedText = sel
    ? `${fmt(sel.lo)}以上 ${fmt(sel.hi)}未満：${sel.count}/${n}人 = ${fmt(sel.relative * 100, 1)}%。${fmt(sel.hi)}未満の累積は ${fmt(sel.cumulative * 100, 1)}%。`
    : "棒・点・表の行を選ぶと、集計した元データが対応して強調されます。";
  root.innerHTML = `
    <div class="stat-grid">
      <section class="panel chart-panel"><h2>区切り方で、分布の見え方は変わる？</h2><p class="muted">${esc(s.source)}。A・B は異なる集団です。${s.groupNames && s.groupNames.join("") !== "AB" ? `A＝${esc(s.groupNames[0])}、B＝${esc(s.groupNames[1])}。` : ""}すべて教材用の架空データです。</p>
      ${metrics([
        ["データ数", `${n}人`],
        ["平均", fmt(mean(rows.map((r) => r.value)))],
        ["中央値", fmt(median(rows.map((r) => r.value)))],
        ["選択した階級", sel ? `${sel.count}人` : "未選択"],
      ])}
      ${svg(a.markup + grid + cumline, "階級幅と開始位置で変わる度数分布", 720, 360)}
      <div class="legend"><span style="color:#168b87">● 集団A（${groupN.A}人）</span>　<span style="color:#de7c35">● 集団B（${groupN.B}人）</span></div>
      <h3>元のデータと集計を対応させる</h3>${svg(`<text x="16" y="42" fill="currentColor">A</text><text x="16" y="78" fill="currentColor">B</text><line x1="60" x2="690" y1="100" y2="100" stroke="#64748b"/>${raw}<text x="60" y="119" font-size="12" fill="currentColor">${esc(fmt(xmin))}</text><text x="650" y="119" font-size="12" fill="currentColor">${esc(fmt(xmax))}</text>`, "集団ごとの生データの点。階級の選択と連動します", 720, 125)}
      <p class="annotation" aria-live="polite">${esc(selectedText)}</p>
      ${relative && s.mode === "split" ? '<p class="hint">色別の相対度数も分母は全体の人数です。両色を足すと全体の相対度数になります。</p>' : ""}
      ${cumulative ? `<p class="hint">${s.mode === "split" ? "色別の折れ線は各集団の人数を分母にした累積比率です。表と選択の注記は全体を分母にしています。" : ""}折れ線の各点は階級の上端「未満」の累積です。点の間の線は見やすく結んだもので、階級内で一様に分布するとは限りません。</p>` : ""}
      </section>
      <section class="panel controls"><h2>集計を変える</h2>
      ${range("bin-width", "階級幅", width, Math.max(0.1, span / 120), Math.max(30, span + width), 0.1)}
      ${range("bin-start", "階級の基準位置", s.start, -50, 100, 0.5)}
      <p class="hint">基準位置を起点に左右へ等間隔に区切ります。各階級は「下端以上・上端未満」です。表示を約120階級以内に保つため、広い範囲のデータでは幅の下限を調整します。</p>
      ${select(
        "display-mode",
        "集団の見方",
        [
          ["combined", "A・Bを合わせる"],
          ["split", "A・Bを色別に比べる"],
        ],
        s.mode,
      )}
      ${select(
        "measure",
        "縦軸",
        [
          ["count", "度数（人数）"],
          ["relative", "相対度数（全体に占める割合）"],
          ["cumulative", "累積相対度数（折れ線）"],
        ],
        s.measure,
      )}
      ${range("shift-b", "集団Bの値を一斉にずらす", s.shiftB, -40, 40, 1, s.label.includes("秒") ? "秒" : "")}
      <p class="hint">集団Aの形と人数を保ち、Bの位置だけを動かします。合成した山はどう変わりますか。</p>
      <button type="button" data-action="clear-bin">階級の選択を解除</button>
      <details id="raw-details" ${s.showEditor ? "open" : ""}><summary>データを編集する（最大300件）</summary><p class="hint">1行に「数値,集団」。集団は A / B、省略すると A です。ここにはBの移動前の値を表示します。</p><label for="raw-editor">生データ</label><textarea id="raw-editor" rows="10" spellcheck="false" style="width:100%">${esc(s.rows.map((r) => `${r.value},${r.group}`).join("\n"))}</textarea><button type="button" data-action="apply-data" class="primary">データを反映</button><p class="hint" role="status">${esc(s.error || "")}</p></details>
      </section>
    </div>
    <section class="panel"><h2>度数分布表</h2><p class="hint">行を選ぶとグラフと元の点が連動します。相対度数の合計は丸め前では1です。</p><div style="overflow-x:auto"><table class="stat-table"><thead><tr><th>階級（以上〜未満）</th><th>A</th><th>B</th><th>度数</th><th>相対度数</th><th>累積相対度数</th></tr></thead><tbody>${bins.map((b, i) => `<tr data-bin="${i}" tabindex="0" role="button" aria-label="${fmt(b.lo)}以上${fmt(b.hi)}未満の階級を選択" style="${i === s.selected ? "background:#168b871a" : ""}"><th>${fmt(b.lo)}〜${fmt(b.hi)}</th><td>${b.a}</td><td>${b.b}</td><td>${b.count}</td><td>${fmt(b.relative * 100, 1)}%</td><td>${fmt(b.cumulative * 100, 1)}%</td></tr>`).join("")}</tbody></table></div></section>`;
  bind(root, "bin-width", (v) =>
    ctx.update({ width: Math.max(0.1, v), selected: -1 }),
  );
  bind(root, "bin-start", (v) => ctx.update({ start: v, selected: -1 }));
  bind(root, "display-mode", (v) => ctx.update({ mode: v }), "change");
  bind(root, "measure", (v) => ctx.update({ measure: v }), "change");
  bind(root, "shift-b", (v) => ctx.update({ shiftB: v, selected: -1 }));
  root.querySelectorAll("[data-bin]").forEach((el) => {
    const choose = () => ctx.update({ selected: Number(el.dataset.bin) });
    el.addEventListener("click", choose);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        choose();
      }
    });
  });
  root.querySelectorAll("[data-raw]").forEach((el) => {
    const choose = () => {
      const v = rows[Number(el.dataset.raw)].value;
      ctx.update({
        selected: bins.findIndex(
          (b) => binIndex(v, width, s.start) === binIndex(b.lo, width, s.start),
        ),
      });
    };
    el.addEventListener("click", choose);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        choose();
      }
    });
  });
  root.querySelector("#raw-details").addEventListener("toggle", (e) => {
    if (e.target.open !== Boolean(s.showEditor))
      ctx.update({ showEditor: e.target.open });
  });
  root.querySelector('[data-action="clear-bin"]').onclick = () =>
    ctx.update({ selected: -1 });
  root.querySelector('[data-action="apply-data"]').onclick = () => {
    try {
      ctx.update({
        rows: parseRows(root.querySelector("#raw-editor").value),
        selected: -1,
        error: "データを更新しました。",
        source: "自分で編集した架空データ",
        groupNames: ["A", "B"],
      });
    } catch (error) {
      const status = root.querySelector('[role="status"]');
      status.textContent = error.message;
    }
  };
}
export default {
  id: "histogram",
  title: "データの分布とヒストグラム",
  description: "階級の区切り方と集団の合成で、隠れていた分布を見つける。",
  lead: "同じデータでも、区切り方が変わると違う姿が見えてきます。まず階級幅を動かして、元の点と棒の関係を調べましょう。",
  initial,
  render,
  missions: [
    {
      title: "「みんな同じくらい」といえる？",
      body: "クイズの所要時間を説明するなら、幅5秒と幅30秒のどちらが適切でしょう。両方を試し、幅を広げると見えなくなる特徴、狭めると目立ちすぎる特徴を挙げてください。",
      preset: {
        width: 5,
        start: 0,
        mode: "combined",
        shiftB: 0,
        measure: "count",
        selected: -1,
      },
    },
    {
      title: "一つの山の中に二つの集団",
      body: "A・Bを色別に比べ、Bの位置を動かしてみましょう。全体の山が一つに見えるとき、集団差もなくなったといえますか。色を合わせた図と分けた図の両方を根拠に説明してください。",
      preset: {
        width: 10,
        start: 0,
        mode: "split",
        shiftB: -18,
        measure: "count",
        selected: -1,
      },
    },
    {
      title: "区切りを動かして結論を確かめる",
      body: "階級幅を10に固定し、基準位置を0〜9の間で動かしてください。最多の階級は変わりますか。累積相対度数も確認して、1枚のヒストグラムだけで言い切れることと言い切れないことを考えましょう。",
      preset: {
        width: 10,
        start: 0,
        mode: "combined",
        shiftB: 0,
        measure: "cumulative",
        selected: -1,
      },
    },
  ],
  explanation: `<h3>棒が表しているもの</h3><p>度数は階級に入るデータの個数です。相対度数は「その階級の個数 ÷ 全データ数」、累積相対度数は「その階級までの個数の合計 ÷ 全データ数」です。度数分布表の行を選ぶと、分子に入った点を確認できます。このラボは等しい階級幅を用いるため、棒の高さで度数を比較できます。幅の異なる階級を使う場合は、面積が度数に対応するよう度数密度を用います。</p><h3>集計によって失われる情報</h3><p>階級内のどこに値があるかは、ヒストグラムだけではわかりません。平均・中央値や生データも合わせて確かめましょう。階級の開始位置を変えるだけで山や谷の印象が変わることがあります。都合のよい区切りだけを選ばず、複数の幅と開始位置を比較すると読み取りの頑健さを検討できます。</p><h3>混ぜる前に、分けてみる</h3><p>二つの集団を合成すると、集団ごとにはない山や広がりが現れる場合があります。たとえば課題の経験の違う人を一緒に集計すると、個人差と集団差が混ざります。色別表示の相対度数は全体を分母とするため、集団人数が違うと棒の高さだけでは集団内の割合を比較できません。その場合は集団別に個数を数え、それぞれの人数で割る必要があります。</p><h3>境界と読み取りの注意</h3><p>各階級は下端を含み、上端を含みません。たとえば50以上60未満に60は入りません。基準位置より小さいデータも左側の階級に入り、すべてのデータが集計されます。割合は表示時だけ丸めるため、表示値の合計が100%からわずかにずれる場合があります。累積折れ線は階級の上端での値を示し、間を結ぶ線から個々の値を復元することはできません。</p>`,
  related: ["summary", "correlation", "projects"],
};

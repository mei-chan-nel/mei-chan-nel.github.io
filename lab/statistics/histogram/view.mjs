import { fmt } from "../shared/math.mjs";
import { esc, svg, bind } from "../shared/ui.mjs";
import {
  distribution,
  binIndex,
  stackedBars,
} from "./model.mjs?v=20261024-proportional-area";
import { describe } from "./descriptive.mjs?v=20261024-proportional-area";
import { renderCalculations } from "./calculations.mjs?v=20261024-proportional-area";

const colors = { A: "#168b87", B: "#de7c35", all: "#168b87" };
const value = (v) =>
  v === 0
    ? "0"
    : Math.abs(v) >= 1e5 || (v && Math.abs(v) < 0.001)
      ? v.toExponential(2)
      : v.toLocaleString("ja-JP", { maximumFractionDigits: 4 });
const interval = (b) => `${value(b.lo)}以上 ${value(b.hi)}未満`;

function point(group, x, y, r, attributes, title) {
  return group === "B"
    ? `<path data-marker-x="${x}" data-marker-y="${y}" data-marker-radius="${r}" d="M${x},${y - r}L${x + r},${y}L${x},${y + r}L${x - r},${y}Z" ${attributes}><title>${esc(title)}</title></path>`
    : `<circle cx="${x}" cy="${y}" r="${r}" ${attributes}><title>${esc(title)}</title></circle>`;
}
const groupLabel = (s, g) =>
  `${g === "A" ? "● A" : "◆ B"}${s.groupNames?.[g === "B" ? 1 : 0] && s.groupNames[g === "B" ? 1 : 0] !== g ? `：${s.groupNames[g === "B" ? 1 : 0]}` : ""}`;
const pattern = (id) =>
  `<defs><pattern id="${id}" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="${colors.B}"/><path d="M-2,2L2,-2M0,8L8,0M6,10L10,6" stroke="#513622" stroke-width="1.3"/></pattern></defs>`;
function boxPlots(s, bins) {
  const left = 66,
    right = 876,
    xmin = bins[0].lo,
    xmax = bins.at(-1).hi;
  const x = (v) => left + ((v - xmin) / (xmax - xmin)) * (right - left);
  const groups = ["A", "B"].filter((g) => s.rows.some((r) => r.group === g));
  const height = groups.length * 44;
  let drawing = pattern("boxplot-group-b-pattern");
  groups.forEach((g, j) => {
    const d = describe(s.rows.filter((r) => r.group === g).map((r) => r.value));
    const y = 22 + j * 44,
      dash = g === "B" ? 'stroke-dasharray="5 3"' : "";
    drawing += `<line x1="${x(d.lower)}" x2="${x(d.q1)}" y1="${y}" y2="${y}" stroke="${colors[g]}" stroke-width="2" ${dash}/><line x1="${x(d.q3)}" x2="${x(d.upper)}" y1="${y}" y2="${y}" stroke="${colors[g]}" stroke-width="2" ${dash}/><path d="M${x(d.lower)},${y - 9}V${y + 9}M${x(d.upper)},${y - 9}V${y + 9}" stroke="${colors[g]}" stroke-width="2"/><rect data-box-group="${g}" x="${x(d.q1)}" y="${y - 12}" width="${Math.max(0, x(d.q3) - x(d.q1))}" height="24" fill="${g === "B" ? "url(#boxplot-group-b-pattern)" : colors.A}" fill-opacity="0.3" stroke="${colors[g]}" stroke-width="2" ${dash}/><line x1="${x(d.q2)}" x2="${x(d.q2)}" y1="${y - 12}" y2="${y + 12}" stroke="#183b38" stroke-width="2.5"/>`;
    s.rows.forEach((r, i) => {
      if (r.group !== g || (r.value >= d.lowerFence && r.value <= d.upperFence))
        return;
      drawing += point(
        g,
        x(r.value),
        y,
        6,
        `data-raw="${i}" data-box-outlier="${g}" tabindex="0" role="button" aria-label="${esc(groupLabel(s, g))}、外れ値候補 ${value(r.value)}" fill="white" stroke="${colors[g]}" stroke-width="2"`,
        `${groupLabel(s, g)}：外れ値候補 ${value(r.value)}`,
      );
    });
  });
  return `<section class="histogram-boxplots" style="--boxplot-height:${height}px" aria-label="群別の箱ひげ図">${svg(drawing, "ヒストグラムと共通の横軸で比較するA・Bの箱ひげ図。ひげの外側の観測は個別の記号で表示。", 900, height).replace("<svg", "<svg data-fixed-row-chart")}</section>`;
}

function settings(s, tableView) {
  return `<div class="histogram-axis-controls" data-screen-group>
    ${!tableView ? `<label class="histogram-axis-control" for="measure"><span>縦軸</span><select id="measure"><option value="count" ${s.measure === "count" ? "selected" : ""}>度数（件数）</option><option value="relative" ${s.measure === "relative" ? "selected" : ""}>相対度数（%）</option></select></label>` : ""}
    <label class="histogram-axis-control" for="bin-width"><span>階級幅</span><input id="bin-width" type="number" min="0.1" step="any" value="${s.width}" inputmode="decimal"></label>
    <p id="bin-error" class="error" role="status" hidden></p>
  </div>`;
}

function rawDots(s, bins, width, selected, n) {
  const left = 66,
    right = 876,
    xmin = bins[0].lo,
    xmax = bins.at(-1).hi;
  const x = (v) => left + ((v - xmin) / (xmax - xmin)) * (right - left);
  const guides =
    bins
      .map(
        (b) =>
          `<line x1="${x(b.lo)}" x2="${x(b.lo)}" y1="3" y2="69" stroke="#d5e0db" stroke-dasharray="2 4"/>`,
      )
      .join("") +
    `<line x1="${right}" x2="${right}" y1="3" y2="69" stroke="#d5e0db" stroke-dasharray="2 4"/>`;
  const highlight = selected
    ? `<rect data-selected-range x="${x(selected.lo)}" y="0" width="${x(selected.hi) - x(selected.lo)}" height="72" fill="#175f55" fill-opacity="0.08"/>`
    : "";
  const drawing = s.rows
    .map((r, i) => {
      const chosen =
        selected &&
        binIndex(r.value, width, s.start) ===
          binIndex(selected.lo, width, s.start);
      return point(
        r.group,
        x(r.value),
        r.group === "B" ? 51 : 21,
        chosen ? 5 : 3.5,
        `data-raw="${i}" data-raw-value="${r.value}" data-raw-bin="${binIndex(r.value, width, s.start) - binIndex(xmin, width, s.start)}" tabindex="0" role="button" aria-label="${esc(groupLabel(s, r.group))}、${value(r.value)}" fill="${colors[r.group]}" opacity="${selected && !chosen ? 0.18 : 0.85}"`,
        `${groupLabel(s, r.group)}: ${value(r.value)}`,
      );
    })
    .join("");
  return `<div class="histogram-raw" data-screen-group>${svg(highlight + guides + drawing, "ヒストグラムと同じ横軸・階級の元データ。Aは丸、Bはひし形。", 900, 72).replace("<svg", "<svg data-fixed-row-chart")}<p class="histogram-selection" aria-live="polite" ${selected ? "" : "hidden"}>${selected ? `${interval(selected)}：${selected.count} / ${n}件（${fmt(selected.relative * 100, 1)}%）` : ""}</p></div>`;
}

function chart(s, bins, n) {
  const left = 66,
    right = 876,
    top = 14,
    bottom = 336;
  const xmin = bins[0].lo,
    xmax = bins.at(-1).hi,
    relative = s.measure === "relative";
  const peak = Math.max(1, ...bins.map((b) => b.count));
  const rough = peak / 5,
    magnitude = 10 ** Math.floor(Math.log10(rough));
  const tick = Math.max(
    1,
    [1, 2, 5, 10].map((m) => m * magnitude).find((v) => v >= rough),
  );
  const maxCount = Math.ceil(peak / tick) * tick;
  const ymax = relative ? maxCount / n : maxCount;
  const x = (v) => left + ((v - xmin) / (xmax - xmin)) * (right - left);
  const y = (v) => bottom - (v / ymax) * (bottom - top);
  let markup = pattern("histogram-group-b-pattern");
  for (let count = 0; count <= maxCount; count += tick) {
    const yy = y(relative ? count / n : count);
    markup += `<line class="gridline" x1="${left}" x2="${right}" y1="${yy}" y2="${yy}"/><text x="${left - 10}" y="${yy + 4}" text-anchor="end">${relative ? fmt((count / n) * 100, 1) + "%" : count}</text>`;
  }
  const maxLabels = Math.max(
    3,
    Math.floor(Math.min(window.innerWidth - 80, 1100) / 65),
  );
  const labelEvery = Math.max(1, Math.ceil(bins.length / maxLabels));
  for (let i = 0; i <= bins.length; i++) {
    const boundary = i === bins.length ? xmax : bins[i].lo,
      xx = x(boundary);
    markup += `<line x1="${xx}" x2="${xx}" y1="${bottom}" y2="${bottom + 5}" stroke="#647b73"/>`;
    if (i % labelEvery === 0 || i === bins.length)
      markup += `<text x="${xx}" y="${bottom + 22}" text-anchor="middle">${value(boundary)}</text>`;
  }
  for (const bar of stackedBars(bins, n, s.mode, s.measure)) {
    if (!bar.count) continue;
    markup += `<rect class="histogram-bar" data-bin="${bar.index}" data-group="${bar.group}" data-count="${bar.count}" data-bottom="${bar.bottom}" data-top="${bar.top}" tabindex="0" role="button" aria-label="${esc(interval(bins[bar.index]))}、${bar.group === "all" ? "全体" : esc(s.groupNames?.[bar.group === "B" ? 1 : 0] || bar.group)}、${bar.count}件" x="${x(bar.lo)}" y="${y(bar.top)}" width="${x(bar.hi) - x(bar.lo)}" height="${y(bar.bottom) - y(bar.top)}" fill="${bar.group === "B" ? "url(#histogram-group-b-pattern)" : colors[bar.group]}" stroke="${bar.group === "B" ? "#513622" : "#fff"}" ${bar.group === "B" ? 'stroke-dasharray="4 2"' : ""} stroke-width="0.7" opacity="${s.selected >= 0 && bar.index !== s.selected ? 0.3 : 0.9}"><title>${interval(bins[bar.index])}：${bar.count}件</title></rect>`;
  }
  const selected = bins[s.selected];
  if (selected)
    markup += `<rect x="${x(selected.lo)}" y="${top}" width="${x(selected.hi) - x(selected.lo)}" height="${bottom - top}" fill="none" stroke="#143b39" stroke-width="2" pointer-events="none"/>`;
  markup += `<path class="axis" d="M${left},${top}V${bottom}H${right}"/><text x="${(left + right) / 2}" y="382" text-anchor="middle">${esc(s.label)}</text>`;
  return svg(
    markup,
    `ヒストグラム：${relative ? "相対度数" : "度数"}、${s.mode === "split" ? "集団別の積み上げ" : "全体"}`,
    900,
    390,
  ).replace("<svg", '<svg id="histogram-chart"');
}

function reading(s, n) {
  const groups = ["A", "B"].filter((g) => s.rows.some((r) => r.group === g));
  const legend = groups
    .map(
      (g) =>
        `<span><i class="group-key group-key-${g.toLowerCase()}" aria-hidden="true"></i>${esc(groupLabel(s, g))}（${g === "A" ? "丸・無地・実線" : "ひし形・斜線・破線"}）</span>`,
    )
    .join("");
  return `<details class="analysis-notes histogram-reading"><summary>凡例・解説</summary><div class="histogram-legend">${legend}</div><p>箱の両端はQ₁とQ₃、中の線は中央値です。ひげの外の点は外れ値の候補です。</p><p>棒、箱ひげ図、元の値は同じ目盛りで描いています。${s.mode === "combined" && groups.length > 1 ? "棒は群を合算しています。" : s.mode === "split" && groups.length > 1 ? "棒は群を積み上げています。" : ""}山と箱の位置を比べましょう。相対度数は全${n}件に占める割合です。</p></details>`;
}

export function render(root, ctx) {
  if (ctx.view === 2) {
    renderCalculations(root, ctx);
    return;
  }
  const s = ctx.state,
    rows = s.rows,
    n = rows.length;
  const bins = distribution(rows, s.width, s.start),
    selected = bins[s.selected];
  const names = s.groupNames || ["A", "B"],
    multiple = rows.some((r) => r.group === "B");
  const tableView = (ctx.view || 0) === 0;
  const legend = multiple
    ? `<div class="histogram-legend"><span><i class="group-key group-key-a" aria-hidden="true"></i>${esc(groupLabel(s, "A"))}（無地・実線）</span><span><i class="group-key group-key-b" aria-hidden="true"></i>${esc(groupLabel(s, "B"))}（斜線・破線）</span>${!tableView ? `<small>${s.mode === "split" ? "同じ階級で積み上げ" : "棒は群を合算"}（割合の分母は全${n}件）</small>` : ""}</div>`
    : "";
  root.innerHTML = `<section class="panel histogram-panel ${tableView ? "" : "distribution-composite"}" data-screen-group>
    <div class="histogram-tools"><header class="histogram-heading"><h2>${tableView ? "度数分布表" : "分布と箱ひげ図"}<small>${n}件</small></h2>
    ${multiple ? `<label class="histogram-group-toggle"><input id="display-mode" type="checkbox" role="switch" ${s.mode === "split" ? "checked" : ""}><span>群別に表示</span></label>` : ""}</header>
    ${settings(s, tableView)}</div>
    ${tableView ? `<div class="histogram-frequency-table"><table class="stat-table"><thead><tr><th scope="col">階級<br>以上〜未満</th>${s.mode === "split" ? `<th scope="col">${esc(groupLabel(s, "A"))}</th><th scope="col">${esc(groupLabel(s, "B"))}</th>` : ""}<th scope="col">度数</th><th scope="col">相対度数</th><th scope="col">累積相対度数</th></tr></thead><tbody>${bins.map((b, i) => `<tr data-bin="${i}" tabindex="0" role="button" aria-label="${interval(b)}、${b.count}件" aria-selected="${i === s.selected}"><th scope="row">${value(b.lo)}〜${value(b.hi)}</th>${s.mode === "split" ? `<td>${b.a}</td><td>${b.b}</td>` : ""}<td>${b.count}</td><td>${fmt(b.relative * 100, 1)}%</td><td>${fmt(b.cumulative * 100, 1)}%</td></tr>`).join("")}</tbody><tfoot><tr><th>合計</th>${s.mode === "split" ? `<td>${rows.filter((r) => r.group === "A").length}</td><td>${rows.filter((r) => r.group === "B").length}</td>` : ""}<td>${n}</td><td>100%</td><td>—</td></tr></tfoot></table></div>` : chart(s, bins, n)}
    ${tableView ? legend : ""}
    ${tableView ? "" : boxPlots(s, bins)}
    ${tableView ? "" : rawDots(s, bins, s.width, selected, n)}
    ${tableView ? "" : reading(s, n)}
  </section>`;

  const invalid = (message) => {
    const note = root.querySelector("#bin-error");
    note.hidden = false;
    note.textContent = message;
  };
  bind(
    root,
    "bin-width",
    (width) => {
      const values = rows.map((r) => r.value),
        span = Math.max(...values) - Math.min(...values);
      if (
        !root.querySelector("#bin-width").value.trim() ||
        !Number.isFinite(width) ||
        width < 0.1 ||
        span / width > 120
      ) {
        invalid(
          `階級幅は${value(Math.max(0.1, span / 120))}以上にしてください（120階級以内）。`,
        );
        return;
      }
      ctx.update({ width, selected: -1 });
    },
    "change",
  );
  root
    .querySelector("#display-mode")
    ?.addEventListener("change", (e) =>
      ctx.update({ mode: e.target.checked ? "split" : "combined" }),
    );
  bind(root, "measure", (measure) => ctx.update({ measure }), "change");
  const choose = (el) => {
    const index =
      el.dataset.bin !== undefined
        ? Number(el.dataset.bin)
        : bins.findIndex(
            (b) =>
              binIndex(rows[Number(el.dataset.raw)].value, s.width, s.start) ===
              binIndex(b.lo, s.width, s.start),
          );
    ctx.update({ selected: index });
  };
  root.querySelectorAll("[data-bin],[data-raw]").forEach((el) => {
    el.addEventListener("click", () => choose(el));
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        choose(el);
      }
      if (e.key === "Escape") ctx.update({ selected: -1 });
    });
  });
}

import { fmt } from "../shared/math.mjs";
import { esc, svg, bind } from "../shared/ui.mjs";
import { distribution, binIndex, stackedBars } from "./model.mjs";

const colors = { A: "#168b87", B: "#de7c35", all: "#168b87" };
const value = (v) =>
  v === 0
    ? "0"
    : Math.abs(v) >= 1e5 || (v && Math.abs(v) < 0.001)
      ? v.toExponential(2)
      : v.toLocaleString("ja-JP", { maximumFractionDigits: 4 });
const interval = (b) => `${value(b.lo)}以上 ${value(b.hi)}未満`;

function settings(s, tableView) {
  return `<div class="histogram-axis-controls" data-screen-group>
    ${!tableView ? `<label class="histogram-axis-control" for="measure"><span>縦軸</span><select id="measure"><option value="count" ${s.measure === "count" ? "selected" : ""}>度数（件数）</option><option value="relative" ${s.measure === "relative" ? "selected" : ""}>相対度数（%）</option></select></label>` : ""}
    <label class="histogram-axis-control" for="bin-width"><span>階級幅</span><input id="bin-width" type="number" min="0.1" step="any" value="${s.width}" inputmode="decimal"></label>
    <p id="bin-error" class="error" role="status" hidden></p>
  </div>`;
}

function rawDots(s, bins, width, selected, n) {
  const left = 54,
    right = 880,
    xmin = bins[0].lo,
    xmax = bins.at(-1).hi;
  const x = (v) => left + ((v - xmin) / (xmax - xmin)) * (right - left);
  const names = s.groupNames || ["A", "B"];
  return `<div class="histogram-raw" data-screen-group><h3>階級に入った元の値</h3>${svg(
    ["A", "B"]
      .map(
        (g, j) => `<text x="8" y="${27 + j * 29}" font-size="12">${g}</text>`,
      )
      .join("") +
      s.rows
        .map((r, i) => {
          const chosen =
            selected &&
            binIndex(r.value, width, s.start) ===
              binIndex(selected.lo, width, s.start);
          return `<circle data-raw="${i}" tabindex="0" role="button" aria-label="${esc(names[r.group === "B" ? 1 : 0])}、${value(r.value)}" cx="${x(r.value)}" cy="${23 + (r.group === "B" ? 29 : 0)}" r="${chosen ? 5 : 3.5}" fill="${colors[r.group]}" opacity="${selected && !chosen ? 0.18 : 0.85}"><title>${esc(names[r.group === "B" ? 1 : 0])}: ${value(r.value)}</title></circle>`;
        })
        .join("") +
      `<line x1="${left}" x2="${right}" y1="72" y2="72" stroke="#8aa"/><text x="${left}" y="89" font-size="12">${value(xmin)}</text><text x="${right}" y="89" text-anchor="end" font-size="12">${value(xmax)}</text>`,
    "階級の選択と連動する元のデータ",
    900,
    94,
  )}
    <p class="histogram-selection" aria-live="polite">${selected ? `${interval(selected)}：${selected.count} / ${n}件（${fmt(selected.relative * 100, 1)}%）` : "階級・棒・点を選ぶと、対応する値を強調します。"}</p></div>`;
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
  let markup = "";
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
    markup += `<rect class="histogram-bar" data-bin="${bar.index}" data-group="${bar.group}" data-count="${bar.count}" data-bottom="${bar.bottom}" data-top="${bar.top}" tabindex="0" role="button" aria-label="${esc(interval(bins[bar.index]))}、${bar.group === "all" ? "全体" : esc(s.groupNames?.[bar.group === "B" ? 1 : 0] || bar.group)}、${bar.count}件" x="${x(bar.lo)}" y="${y(bar.top)}" width="${x(bar.hi) - x(bar.lo)}" height="${y(bar.bottom) - y(bar.top)}" fill="${colors[bar.group]}" stroke="#fff" stroke-width="0.7" opacity="${s.selected >= 0 && bar.index !== s.selected ? 0.3 : 0.9}"><title>${interval(bins[bar.index])}：${bar.count}件</title></rect>`;
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

export function render(root, ctx) {
  const s = ctx.state,
    rows = s.rows,
    n = rows.length;
  const bins = distribution(rows, s.width, s.start),
    selected = bins[s.selected];
  const names = s.groupNames || ["A", "B"],
    multiple = rows.some((r) => r.group === "B");
  const tableView = (ctx.view || 0) === 0;
  root.innerHTML = `<section class="panel histogram-panel" data-screen-group>
    <header class="histogram-heading"><h2>${tableView ? "度数分布表" : "ヒストグラム"}<small>${n}件</small></h2>
    ${multiple ? `<label class="histogram-group-toggle"><input id="display-mode" type="checkbox" role="switch" ${s.mode === "split" ? "checked" : ""}><span>集団別に色分け</span></label>` : ""}</header>
    ${settings(s, tableView)}
    ${tableView ? `<div class="histogram-frequency-table"><table class="stat-table"><thead><tr><th scope="col">階級<br>以上〜未満</th>${s.mode === "split" ? `<th scope="col">${esc(names[0])}</th><th scope="col">${esc(names[1])}</th>` : ""}<th scope="col">度数</th><th scope="col">相対度数</th><th scope="col">累積相対度数</th></tr></thead><tbody>${bins.map((b, i) => `<tr data-bin="${i}" tabindex="0" role="button" aria-label="${interval(b)}、${b.count}件" aria-selected="${i === s.selected}"><th scope="row">${value(b.lo)}〜${value(b.hi)}</th>${s.mode === "split" ? `<td>${b.a}</td><td>${b.b}</td>` : ""}<td>${b.count}</td><td>${fmt(b.relative * 100, 1)}%</td><td>${fmt(b.cumulative * 100, 1)}%</td></tr>`).join("")}</tbody><tfoot><tr><th>合計</th>${s.mode === "split" ? `<td>${rows.filter((r) => r.group === "A").length}</td><td>${rows.filter((r) => r.group === "B").length}</td>` : ""}<td>${n}</td><td>100%</td><td>—</td></tr></tfoot></table></div>` : chart(s, bins, n)}
    ${s.mode === "split" ? `<div class="histogram-legend"><span><i style="--series-color:${colors.A}"></i>${esc(names[0])}</span><span><i style="--series-color:${colors.B}"></i>${esc(names[1])}</span>${!tableView ? `<small>同じ階級で積み上げ（割合の分母は全${n}件）</small>` : ""}</div>` : ""}
    ${tableView ? "" : rawDots(s, bins, s.width, selected, n)}
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

import { fmt } from "./math.mjs?v=20261026-final-upgrade";
export const esc = (s) =>
  String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
export const range = (id, label, value, min, max, step = 1, unit = "") =>
  `<label class="control" for="${id}"><span>${esc(label)} <output>${esc(value)}${esc(unit)}</output></span><input id="${id}" type="range" value="${esc(value)}" min="${esc(min)}" max="${esc(max)}" step="${esc(step)}"></label>`;
export const number = (id, label, value, min, max, step = 1) =>
  `<label class="control" for="${id}"><span>${esc(label)}</span><input id="${id}" type="number" value="${esc(value)}" min="${esc(min)}" max="${esc(max)}" step="${esc(step)}"></label>`;
export const select = (id, label, options, value) =>
  `<label class="control" for="${id}"><span>${esc(label)}</span><select id="${id}">${options.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(value) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label>`;
export const metrics = (a) =>
  `<div class="metrics">${a.map(([l, v, d]) => `<div><small>${esc(l)}</small><strong>${esc(v)}</strong>${d ? `<span>${esc(d)}</span>` : ""}</div>`).join("")}</div>`;
export const table = (heads, rows) =>
  `<div class="table-scroll"><table class="stat-table"><thead><tr>${heads.map((h) => `<th scope="col">${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((v) => `<td>${esc(v)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
export const svg = (content, title, w = 720, h = 360) =>
  `<svg class="stat-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}">${content}</svg>`;
const axisNumber = (value, span) => {
  if (Math.abs(value) >= 1e5 || (value !== 0 && Math.abs(span) < 1e-5))
    return value.toExponential(1);
  return fmt(
    value,
    Math.max(1, Math.min(8, Math.ceil(-Math.log10(Math.abs(span) || 1)) + 1)),
  );
};
export function axes({
  xmin = 0,
  xmax = 100,
  ymin = 0,
  ymax = 100,
  w = 720,
  h = 360,
  xlabel = "",
  ylabel = "",
} = {}) {
  if (xmax === xmin) xmax = xmin + 1;
  if (ymax === ymin) ymax = ymin + 1;
  const left = 58,
    right = w - 24,
    top = 30,
    bottom = h - 48,
    x = (v) => left + ((v - xmin) / (xmax - xmin)) * (right - left),
    y = (v) => bottom - ((v - ymin) / (ymax - ymin)) * (bottom - top);
  let markup = "";
  for (let i = 0; i <= 5; i++) {
    const xv = xmin + ((xmax - xmin) * i) / 5,
      yv = ymin + ((ymax - ymin) * i) / 5;
    markup += `<line class="gridline" x1="${left}" x2="${right}" y1="${y(yv)}" y2="${y(yv)}"/><text x="${left - 9}" y="${y(yv) + 4}" text-anchor="end">${axisNumber(yv, ymax - ymin)}</text><text x="${x(xv)}" y="${bottom + 19}" text-anchor="middle">${axisNumber(xv, xmax - xmin)}</text>`;
  }
  markup += `<path class="axis" d="M${left},${top}V${bottom}H${right}"/><text x="${(left + right) / 2}" y="${h - 5}" text-anchor="middle">${esc(xlabel)}</text><text x="${left}" y="16">${esc(ylabel)}</text>`;
  return {
    x,
    y,
    ix: (v) => xmin + ((v - left) / (right - left)) * (xmax - xmin),
    iy: (v) => ymin + ((bottom - v) / (bottom - top)) * (ymax - ymin),
    markup,
  };
}
export const line = (points, x, y, cls = "series") =>
  `<polyline class="${cls}" fill="none" points="${points.map((p) => `${x(p.x)},${y(p.y)}`).join(" ")}"/>`;
export function bind(root, id, callback, event = "input") {
  const el = root.querySelector("#" + id);
  if (!el) return;
  if (el.type === "range" && event === "input")
    el.addEventListener("pointerdown", (e) => {
      if (e.button > 0) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect(),
        min = +el.min,
        max = +el.max,
        step = Number(el.step) || 1;
      let previous;
      const move = (ev) => {
        const raw =
            min +
            Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width)) *
              (max - min),
          v = Math.max(
            min,
            Math.min(max, min + Math.round((raw - min) / step) * step),
          );
        if (v !== previous) {
          previous = v;
          callback(v, ev);
        }
      };
      const up = () => {
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        document.removeEventListener("pointercancel", up);
      };
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up, { once: true });
      document.addEventListener("pointercancel", up, { once: true });
      move(e);
    });
  el.addEventListener(event, (e) => {
    const v = ["range", "number"].includes(el.type)
      ? Number(el.value)
      : el.value;
    callback(v, e);
  });
}
export function drag(el, selector, callback) {
  if (!el) return;
  el.addEventListener("pointerdown", (e) => {
    const t = e.target.closest(selector);
    if (!t || e.button > 0) return;
    e.preventDefault();
    const matrix = el.getScreenCTM();
    const inverse = matrix?.inverse();
    const move = (ev) => {
      const p = el.createSVGPoint();
      p.x = ev.clientX;
      p.y = ev.clientY;
      if (inverse) {
        const q = p.matrixTransform(inverse);
        callback(
          t,
          q.x / Number(el.dataset.scaleX || 1),
          q.y / Number(el.dataset.scaleY || 1),
          ev,
        );
      }
    };
    const up = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", up);
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up, { once: true });
    document.addEventListener("pointercancel", up, { once: true });
  });
}

export const chartKey = (
  label,
  color = "var(--chart-primary)",
  kind = "point",
) =>
  `<span class="chart-legend-key"><i class="chart-key chart-key-${kind}" style="--key-color:${esc(color)}" aria-hidden="true"></i>${esc(label)}</span>`;
export const groupPattern = (
  id,
  { background = "var(--chart-secondary)", opacity = 0.45 } = {},
) =>
  `<defs><pattern id="${esc(id)}" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="${background}"/><path d="M-2 2L2-2M0 8L8 0M6 10L10 6" stroke="var(--chart-secondary-dark)" stroke-opacity="${opacity}" stroke-width="1.3"/></pattern></defs>`;

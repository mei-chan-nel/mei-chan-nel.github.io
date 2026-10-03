import { formatValue } from "./values.js?v=20261003-video";
const svgNS = "http://www.w3.org/2000/svg";
export const MAX_VISIBLE_OUTPUTS = 30;

export function outputWindow(outputs, limit = MAX_VISIBLE_OUTPUTS) {
  const start = Math.max(0, outputs.length - limit);
  return { start, items: outputs.slice(start) };
}
function svgNode(tag, attributes, text) {
  const node = document.createElementNS(svgNS, tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  if (text !== undefined) node.textContent = text;
  return node;
}

/** 座標データをそのまま描く。描画のために乱数を生成しない。 */
export function plotView(output) {
  const svg = svgNode("svg", { viewBox: "0 0 400 230", role: "img", "aria-label": `${output.x.length}個の点の xy プロット`, class: "trace-plot" });
  const xmin = Math.min(...output.x), xmax = Math.max(...output.x);
  const ymin = Math.min(...output.y), ymax = Math.max(...output.y);
  const xspan = xmax - xmin || 1, yspan = ymax - ymin || 1;
  const x = (value) => 45 + (value - xmin) / xspan * 330;
  const y = (value) => 185 - (value - ymin) / yspan * 155;
  svg.append(svgNode("title", {}, `${output.x.length}個の座標を順に結んだ図`));
  for (let index = 0; index <= 4; index++) {
    const xx = 45 + 330 * index / 4, yy = 185 - 155 * index / 4;
    svg.append(svgNode("line", { x1: 45, x2: 375, y1: yy, y2: yy, class: "plot-grid" }));
    svg.append(svgNode("text", { x: xx, y: 203, "text-anchor": "middle" }, formatValue(Number((xmin + xspan * index / 4).toPrecision(4)))));
    svg.append(svgNode("text", { x: 37, y: yy + 4, "text-anchor": "end" }, formatValue(Number((ymin + yspan * index / 4).toPrecision(4)))));
  }
  svg.append(svgNode("text", { x: 382, y: 203 }, "x"), svgNode("text", { x: 29, y: 20 }, "y"));
  svg.append(svgNode("polyline", { points: output.x.map((value, index) => `${x(value)},${y(output.y[index])}`).join(" "), class: "plot-path", fill: "none" }));
  svg.append(svgNode("circle", { cx: x(output.x.at(-1)), cy: y(output.y.at(-1)), r: 3, class: "plot-end" }));
  return svg;
}

export function outputRow(output, index) {
  const row = document.createElement("li"); row.className = "output-line";
  const number = document.createElement("span"); number.className = "output-number"; number.textContent = String(index + 1).padStart(2, "0");
  const content = document.createElement("div"); content.className = "output-content";
  content.append(document.createTextNode(typeof output === "string" ? output : output.text));
  if (output.kind === "plot") { row.classList.add("output-plot"); content.append(plotView(output)); }
  row.append(number, content);
  return row;
}

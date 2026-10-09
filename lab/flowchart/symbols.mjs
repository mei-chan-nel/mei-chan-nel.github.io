export const esc = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
export function dimensions(type) {
  if (type === "connector") return { w: 40, h: 40 };
  if (["start", "end", "return"].includes(type)) return { w: 170, h: 52 };
  if (type === "decision") return { w: 220, h: 120 };
  if (["loopStart", "loopEnd"].includes(type)) return { w: 240, h: 80 };
  return { w: 220, h: 70 };
}
export function shape(type) {
  const { w, h } = dimensions(type),
    x = w / 2,
    y = h / 2;
  if (["start", "end", "return"].includes(type))
    return `<rect x="${-x}" y="${-y}" width="${w}" height="${h}" rx="${y}"/>`;
  if (type === "connector") return '<path d="M0 -20V20"/>';
  if (["input", "output"].includes(type))
    return `<path d="M${-x + 20} ${-y}H${x}L${x - 20} ${y}H${-x}Z"/>`;
  if (type === "decision") return `<path d="M0 ${-y}L${x} 0 0 ${y} ${-x} 0Z"/>`;
  if (type === "loopStart")
    return `<path d="M${-x + 22} ${-y}H${x - 22}L${x} ${-y + 22}V${y}H${-x}V${-y + 22}Z"/>`;
  if (type === "loopEnd")
    return `<path d="M${-x} ${-y}H${x}V${y - 22}L${x - 22} ${y}H${-x + 22}L${-x} ${y - 22}Z"/>`;
  return (
    `<rect x="${-x}" y="${-y}" width="${w}" height="${h}"/>` +
    (type === "call"
      ? `<path d="M${-x + 15} ${-y}V${y}M${x - 15} ${-y}V${y}"/>`
      : "")
  );
}
export function portPoint(n, direction, port = 0) {
  const { w, h } = dimensions(n.type);
  return {
    x:
      n.x +
      (direction === "out" && n.type === "decision" && port === 1 ? w / 2 : 0),
    y:
      n.y +
      (direction === "in"
        ? -h / 2
        : n.type === "decision" && port === 1
          ? 0
          : h / 2),
  };
}
export function linesOf(text, type) {
  const max =
      type === "decision"
        ? 8
        : type === "connector"
          ? 2
          : ["loopStart", "loopEnd"].includes(type)
            ? 14
            : 12,
    lines = [];
  let line = "",
    weight = 0;
  for (const c of text) {
    const size = /[ -~]/.test(c) ? 0.55 : 1;
    if (weight + size > max) {
      lines.push(line);
      line = "";
      weight = 0;
    }
    line += c;
    weight += size;
  }
  if (line) lines.push(line);
  const visible = lines.slice(0, type === "connector" ? 1 : 3);
  if (lines.length > visible.length)
    visible[visible.length - 1] = visible.at(-1).slice(0, -1) + "…";
  return visible;
}
export function mini(type) {
  const { w, h } = dimensions(type);
  if (type === "connector")
    return '<svg viewBox="-30 -25 60 50" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="3"><path d="M-16 -22V22M24 -22V0H-16M-10 -5L-16 0 -10 5"/></g></svg>';
  return `<svg viewBox="${-w / 2 - 5} ${-h / 2 - 5} ${w + 10} ${h + 10}" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="5">${shape(type)}</g></svg>`;
}

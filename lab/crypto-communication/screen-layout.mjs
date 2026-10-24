// Choose compositions rather than scaling text or clipping a long page.
export function screenLayout(width, height) {
  const wide = width >= 760 || (width >= 550 && width / height >= 1.25);
  const density =
    height < (wide ? 440 : 560)
      ? "tiny"
      : height < 760
        ? "compact"
        : "comfortable";
  return { layout: wide ? "wide" : "narrow", density };
}
export function paginateText(text, limit = 130) {
  const chars = Array.from(String(text));
  const result = [];
  for (let pos = 0; pos < chars.length;) {
    let end = Math.min(pos + limit, chars.length);
    if (end < chars.length) {
      for (let i = end - 1; i > pos + limit / 2; i--)
        if ("。！？\n".includes(chars[i])) {
          end = i + 1;
          break;
        }
    }
    result.push(chars.slice(pos, end).join(""));
    pos = end;
  }
  return result.length ? result : ["まだ記録はありません。"];
}

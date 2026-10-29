// CSV/TSV pasted from a spreadsheet or read as a UTF-8 file. Never drop invalid rows.
export function parseDelimited(text) {
  text = String(text)
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n");
  const first = text.split("\n")[0] || "",
    separator = first.includes("\t")
      ? "\t"
      : first.includes(",")
        ? ","
        : first.includes(";")
          ? ";"
          : null;
  if (!separator)
    return text
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => [l.trim()]);
  const rows = [];
  let row = [],
    field = "",
    quoted = false,
    closed = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else field += c;
      continue;
    }
    if (c === '"' && !field.trim() && !closed) {
      quoted = true;
      field = "";
      continue;
    }
    if (c === separator || c === "\n") {
      row.push(field.trim());
      field = "";
      closed = false;
      if (c === "\n") {
        if (row.some((v) => v !== "")) rows.push(row);
        row = [];
      }
      continue;
    }
    if (closed && c.trim())
      throw Error("閉じた引用符の後に区切り以外の文字があります。");
    field += c;
  }
  if (quoted) throw Error("閉じられていない引用符があります。");
  row.push(field.trim());
  if (row.some((v) => v !== "")) rows.push(row);
  return rows;
}
export function asNumber(value, row, column) {
  if (
    String(value ?? "").trim() === "" ||
    !Number.isFinite(Number(value)) ||
    Math.abs(Number(value)) > 1e6
  )
    throw Error(
      `${row}行目「${column}」は±1,000,000以内の数値を入力してください。`,
    );
  return Number(value);
}
export function serializeCSV(headers, rows) {
  const field = (v) => {
    const s = String(v ?? "");
    return /[",\n\r]/.test(s) ? '"' + s.replaceAll('"', '""') + '"' : s;
  };
  return [headers, ...rows].map((r) => r.map(field).join(",")).join("\n");
}

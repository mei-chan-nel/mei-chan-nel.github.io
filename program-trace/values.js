/** 表示と入力検証を共有する。入力された文字列をコードとして実行しない。 */
export function cloneValue(value) {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (value?.kind === "matrix") return { kind: "matrix", cells: { ...value.cells } };
  return value;
}

export function matrixAxes(value) {
  const keys = Object.keys(value.cells).map((key) => key.split(",").map(Number));
  const sorted = (axis) => [...new Set(keys.map((key) => key[axis]))].sort((a, b) => a - b);
  return { rows: sorted(0), columns: sorted(1) };
}

export function formatValue(value) {
  if (value === undefined) return "—";
  if (Array.isArray(value)) return `[${value.map(formatValue).join(", ")}]`;
  if (value?.kind === "matrix") {
    const { rows, columns } = matrixAxes(value);
    return `[${rows.map((row) => `[${columns.map((column) => formatValue(value.cells[`${row},${column}`])).join(", ")}]`).join(", ")}]`;
  }
  if (typeof value === "number" && !Number.isInteger(value)) return String(Number(value.toPrecision(10)));
  return String(value);
}

function integer(raw) {
  if (typeof raw === "string" && !/^[+-]?\d+(?:\.0+)?$/.test(raw.trim())) return NaN;
  if (!["string", "number"].includes(typeof raw)) return NaN;
  return Number(raw);
}

export function parseArray(raw) {
  if (Array.isArray(raw)) return [...raw];
  if (typeof raw !== "string") return null;
  let text = raw.trim().replace(/、/g, ",");
  if (text.startsWith("[") && text.endsWith("]")) text = text.slice(1, -1).trim();
  else if (/[\[\]]/.test(text)) return null;
  if (!text) return [];
  return text.includes(",") ? text.split(",").map((part) => part.trim()) : text.split(/\s+/);
}

export function fieldHelp(field) {
  if (field.type === "matrix") return `${field.minRows}〜${field.maxRows}行 · 添字は${field.start ?? 0}から`;
  if (field.type === "choice") return "選択肢から選んでください。";
  if (field.type === "text") return `文字列 · ${field.maxLength ?? 40}文字以内`;
  if (field.type === "array") return `${field.minLength}〜${field.maxLength}個${field.elementType === "text" || field.choices || field.columns ? "" : ` · 各要素は整数 ${field.min}〜${field.max}`}${field.sorted ? " · 小さい順（同じ値も可）" : ""}`;
  if (field.integer === false) return `数値 ${field.min}〜${field.max}`;
  return `整数 ${field.min}〜${field.max}`;
}

export function validateField(field, raw) {
  if (field.type === "choice") {
    const value = field.choices.find((choice) => String(choice) === String(raw));
    return value === undefined ? { error: "選択肢から選んでください。" } : { value };
  }
  if (field.type === "text") {
    const value = typeof raw === "string" ? raw : "";
    return value.length > (field.maxLength ?? 40) || (!value && !field.allowEmpty) ? { error: `文字列を${field.maxLength ?? 40}文字以内で入力してください。` } : { value };
  }
  if (field.type === "matrix") {
    const rows = raw?.kind === "matrix" ? (() => {
      const axes = matrixAxes(raw);
      return axes.rows.map((row) => axes.columns.map((column) => raw.cells[`${row},${column}`]));
    })() : raw;
    if (!Array.isArray(rows) || rows.length < field.minRows || rows.length > field.maxRows) return { error: `${field.minRows}〜${field.maxRows}行にしてください。` };
    const cells = {};
    for (let row = 0; row < rows.length; row++) {
      const result = validateField({ ...field, type: "array", minLength: field.columnCount, maxLength: field.columnCount }, rows[row]);
      if (result.error) return { error: `${row + (field.start ?? 0)}行：${result.error}` };
      result.value.forEach((value, column) => { cells[`${row + (field.start ?? 0)},${column + (field.start ?? 0)}`] = value; });
    }
    return { value: { kind: "matrix", cells } };
  }
  if (field.type === "array") {
    const items = parseArray(raw);
    if (!items) return { error: "配列の各要素を入力してください。" };
    if (items.length < field.minLength || items.length > field.maxLength) return { error: `要素数は ${field.minLength}〜${field.maxLength} 個にしてください。` };
    if (field.elementType === "text" || field.choices || field.columns) {
      const values = [];
      for (const [index, item] of items.entries()) {
        const elementField = field.columns?.[index] ?? (field.choices ? { type: "choice", choices: field.choices } : { type: "text", maxLength: field.textMaxLength ?? 20, allowEmpty: true });
        const result = validateField(elementField, item);
        if (result.error) return { error: `要素 [${index}]：${result.error}` };
        values.push(result.value);
      }
      return { value: values };
    }
    const values = items.map(integer);
    const invalid = values.findIndex((value) => !Number.isSafeInteger(value) || value < field.min || value > field.max);
    if (invalid >= 0) return { error: `要素 [${invalid}] は ${field.min}〜${field.max} の整数にしてください。` };
    if (field.sorted && values.some((value, index) => index > 0 && value < values[index - 1])) return { error: "小さい順に並んだ配列を入力してください。" };
    return { value: values };
  }
  const value = field.integer === false ? typeof raw === "number" || typeof raw === "string" && raw.trim() ? Number(raw) : NaN : integer(raw);
  if (field.integer === false ? !Number.isFinite(value) : !Number.isSafeInteger(value)) return { error: field.integer === false ? "数値を入力してください。" : "整数を入力してください。" };
  if (value < field.min || value > field.max) return { error: `${field.min}〜${field.max} の範囲で入力してください。` };
  return { value };
}

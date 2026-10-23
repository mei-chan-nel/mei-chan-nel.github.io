import { applyData } from "./data-model.mjs?v=20261024-fullscreen-navigation";
import { asNumber } from "./csv.mjs";

export function numericTableColumn(id, column) {
  if (id === "crosstab") return column >= 2;
  if (id === "hypothesis-test" || id === "time-series") return column > 0;
  if (["histogram", "sampling"].includes(id)) return column === 0;
  return column < 2 || id !== "correlation";
}

export function tableConstraint(id, state) {
  if (id === "time-series")
    return "分析には、時間順に並んだ連続する48か月分が必要です。値は0以上にします。";
  if (id === "crosstab")
    return "分析には2集団×2方式の4行が必要です。各組を1行ずつにし、人数は0以上の整数にします。";
  if (id === "hypothesis-test")
    return "分析にはA/Bの2行が必要です。対象数は各10〜1,000人、成功数は0〜対象数の整数にします。";
  if (id === "probability")
    return `1〜10,000行。${state.mode === "coin" ? "表=1・裏=0を試行順に入力します。" : state.mode === "binomial" ? `1セットの成功回数を0〜${state.n}の整数で入力します。` : "測定した数値を入力します。正規分布に従うことを保証するものではありません。"}`;
  if (id === "lorenz") return "2〜300行。所得は0以上の数値にします。";
  if (id === "sampling")
    return "2〜300行。1行が母集団の1人分です。数値を入力します。";
  if (id === "histogram")
    return "2〜300行。数値と、所属する集団名を入力します。集団は2種類まで使えます。";
  return "2〜300行。空欄を埋めてから分析へ進みます。";
}

// The table and CSV use the same parser and statistical domain checks. These
// indices describe currentData's canonical columns, not guessed CSV columns.
export function applyTableRows(id, state, data, rows, allowGroup = false) {
  rows.forEach((row, r) =>
    data.headers.forEach((header, c) => {
      if (numericTableColumn(id, c)) asNumber(row[c], r + 1, header);
      else if (!String(row[c] ?? "").trim())
        throw Error(`${r + 1}行目「${header}」を入力してください。`);
    }),
  );
  if (
    id === "hypothesis-test" &&
    rows.length === 2 &&
    String(rows[0][0]).trim() === String(rows[1][0]).trim()
  )
    throw Error("比較する2群には、異なる名前を付けてください。");
  const next = applyData(id, state, {
    headers: data.headers,
    rows,
    name: ["sample", "model", "project"].includes(data.origin)
      ? "表で編集したデータ"
      : data.name,
    filename: data.filename || "",
    x: id === "time-series" ? 1 : 0,
    y: 1,
    date: 0,
    group:
      id === "histogram" ? 1 : allowGroup && data.headers.length > 2 ? 2 : -1,
  });
  if (id === "histogram") next.width = state.width;
  next.dataInfo.tableEdited = true;
  return next;
}

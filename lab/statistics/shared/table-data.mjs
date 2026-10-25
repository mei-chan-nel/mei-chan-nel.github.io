import { applyData } from "./data-model.mjs?v=20261025-compact-test";
import { asNumber } from "./csv.mjs";

export function numericTableColumn(id, column) {
  if (id === "crosstab") return false;
  if (id === "hypothesis-test" || id === "time-series") return column > 0;
  if (["histogram", "sampling"].includes(id)) return column === 0;
  return column < 2 || id !== "correlation";
}

export function tableConstraint(id, state) {
  if (id === "time-series")
    return "分析には、時間順に並んだ連続する24〜300か月分が必要です。値は0以上にします。";
  if (id === "crosstab")
    return "1行が1人分です。3つの属性を入力します。各項目は2種類まで、1〜10,000人分を使えます。";
  if (id === "hypothesis-test")
    return "1行に1人分の「参加者番号・判定枚数・正答数」を入力します。2〜10,000人分。番号は重複させず、判定枚数は1〜10,000、正答数は0〜判定枚数の整数にします。";
  if (id === "probability")
    return `1〜10,000行。${state.mode === "coin" ? "表=1・裏=0を試行順に入力します。" : state.mode === "binomial" ? `1セットの成功回数を0〜${state.n}の整数で入力します。` : "測定した数値を入力します。正規分布に従うことを保証するものではありません。"}`;
  if (id === "lorenz") return "2〜300行。所得は0以上の数値にします。";
  if (id === "sampling")
    return "2〜300行。1行が母集団の1観測分です。数値を入力します。";
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
  if (state.dataInfo?.publicDataset) {
    next.dataInfo.publicDataset = state.dataInfo.publicDataset;
    next.dataInfo.publicDerived = true;
  }
  return next;
}

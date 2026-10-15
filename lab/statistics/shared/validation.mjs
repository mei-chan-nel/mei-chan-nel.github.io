export function validateState(value, template, depth = 0, key = "state") {
  if (depth > 14) throw Error("データ構造が深すぎます。");
  if (value === null) {
    if (template !== null && template !== undefined)
      throw Error(`${key}の形式が正しくありません。`);
    return;
  }
  if (template !== null && template !== undefined) {
    const wanted = Array.isArray(template) ? "array" : typeof template,
      actual = Array.isArray(value) ? "array" : typeof value;
    if (
      wanted !== actual &&
      !(
        /(^id$|Id$|selected$)/.test(key) &&
        ["string", "number"].includes(wanted) &&
        ["string", "number"].includes(actual)
      )
    )
      throw Error(`${key}の型が正しくありません。`);
  }
  if (
    typeof value === "number" &&
    (!Number.isFinite(value) || Math.abs(value) > 1e12)
  )
    throw Error("数値が正しくありません。");
  if (typeof value === "string" && value.length > 20000)
    throw Error("文字列が長すぎます。");
  if (Array.isArray(value)) {
    if (value.length > 10000) throw Error("データの件数が多すぎます。");
    value.forEach((v) =>
      validateState(
        v,
        Array.isArray(template) ? template[0] : undefined,
        depth + 1,
        key,
      ),
    );
    return;
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (["__proto__", "constructor", "prototype"].includes(k))
        throw Error("不正なキーです。");
      validateState(v, template?.[k], depth + 1, k);
    }
    if (template && typeof template === "object")
      for (const k of Object.keys(template))
        if (!(k in value)) throw Error("必要な項目がありません：" + k);
  }
  if (
    depth === 0 &&
    (!value || Array.isArray(value) || typeof value !== "object")
  )
    throw Error("保存データの形式が正しくありません。");
}
export function validateDocument(d, id, template) {
  if (d?.version !== 1 || d.id !== id)
    throw Error("このラボの保存ファイルを指定してください。");
  validateState(d.state, template);
  domain(d.state, id);
  if (d.snapshot !== null && d.snapshot !== undefined) {
    validateState(d.snapshot, template);
    domain(d.snapshot, id);
  }
  if (d.notes !== undefined) {
    if (!d.notes || typeof d.notes !== "object" || Array.isArray(d.notes))
      throw Error("記録の形式が正しくありません。");
    for (const [k, v] of Object.entries(d.notes)) {
      if (
        !/^([0-9]|done[0-9])$/.test(k) ||
        !["string", "boolean"].includes(typeof v) ||
        (typeof v === "string" && v.length > 20000)
      )
        throw Error("記録の形式が正しくありません。");
    }
  }
  return d;
}
function domain(s, id) {
  const need = (ok, msg) => {
    if (!ok) throw Error(msg);
  };
  const rows = (a, min = 1, max = 300) =>
    Array.isArray(a) && a.length >= min && a.length <= max;
  if (id === "correlation" || id === "summary") {
    need(rows(s.points, 2), "データは2〜300点にしてください。");
    need(
      s.points.some((p) => String(p.id) === String(s.selectedId)),
      "選択した点がデータにありません。",
    );
    if (id === "summary") {
      need(
        s.min < s.max && s.spreadBase.length === s.points.length,
        "分布の範囲と点の数を確認してください。",
      );
    } else
      need(
        s.xMin < s.xMax && s.yMin < s.yMax,
        "座標の範囲を確認してください。",
      );
  }
  if (id === "histogram") {
    need(rows(s.rows), "データは1〜300件にしてください。");
    need(s.width > 0, "階級幅は正の数にしてください。");
    need(
      s.rows.every((r) => ["A", "B"].includes(r.group)),
      "集団はAまたはBで指定してください。",
    );
  }
  if (id === "lorenz") {
    need(
      rows(s.incomes, 2) &&
        s.incomes.every((v) => typeof v === "number" && v >= 0),
      "所得は2〜300人の0以上の数値にしてください。",
    );
    need(
      [s.selected, s.from, s.to].every(
        (v) => Number.isInteger(v) && v >= 0 && v < s.incomes.length,
      ),
      "選択した人を確認してください。",
    );
    need(
      s.reference === null ||
        (rows(s.reference, 2) &&
          s.reference.every((v) => typeof v === "number" && v >= 0)),
      "比較用所得を確認してください。",
    );
  }
  if (id === "sampling") {
    need(
      Number.isInteger(s.n) && s.n >= 1 && s.n <= 120,
      "標本数は1〜120人にしてください。",
    );
    need(
      rows(s.history, 1, 2000) &&
        rows(s.last, 1, 120) &&
        s.last.every((v) => Number.isInteger(v) && v >= 0 && v < 120),
      "抽出履歴を確認してください。",
    );
  }
  if (id === "crosstab")
    need(
      s.strata.length === 2 &&
        s.strata.every(
          (g) =>
            g.counts.length === 2 &&
            g.counts.every(
              (r) =>
                r.length === 2 && r.every((v) => v >= 0 && Number.isInteger(v)),
            ),
        ),
      "クロス集計表は2集団の2×2の非負整数にしてください。",
    );
  if (id === "probability")
    need(
      s.p >= 0 && s.p <= 1 && s.sigma > 0,
      "確率は0〜1、標準偏差は正の数にしてください。",
    );
  if (id === "hypothesis-test")
    need(
      s.nA > 0 &&
        s.nB > 0 &&
        s.successA >= 0 &&
        s.successA <= s.nA &&
        s.successB >= 0 &&
        s.successB <= s.nB &&
        s.base >= 0 &&
        s.base <= 1 &&
        s.alpha > 0 &&
        s.alpha < 1,
      "人数・成功数・確率・有意水準を確認してください。",
    );
}

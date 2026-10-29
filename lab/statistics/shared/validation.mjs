import { participantScores } from "../hypothesis-test/mean-model.mjs?v=20261026-final-upgrade";
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
    (!Number.isFinite(value) ||
      (Math.abs(value) > 1e12 &&
        !["manualSlope", "manualIntercept"].includes(key)))
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
  if (s.dataInfo) {
    const d = s.dataInfo;
    need(
      typeof d === "object" &&
        !Array.isArray(d) &&
        typeof d.name === "string" &&
        d.name.length <= 160 &&
        ["sample", "user", "project", "model", "saved"].includes(d.origin),
      "データの出所を確認してください。",
    );
    need(
      Array.isArray(d.columns) &&
        d.columns.length <= 20 &&
        d.columns.every((v) => typeof v === "string" && v.length <= 100),
      "項目名を確認してください。",
    );
    need(
      Array.isArray(d.baseline) &&
        d.baseline.length <=
          (["probability", "crosstab", "hypothesis-test"].includes(id) ? 10000 : 300) &&
        d.baseline.every((r) => Array.isArray(r) && r.length <= 20),
      "元データの形式を確認してください。",
    );
    if (d.labels)
      need(
        ["methods", "strata", "outcomes"].every(
          (k) =>
            Array.isArray(d.labels[k]) &&
            d.labels[k].length === 2 &&
            d.labels[k].every((v) => typeof v === "string" && v.length <= 100),
        ),
        "課題難度・方式・結果のラベルを確認してください。",
      );
  }
  if (s.monthLabels)
    need(
      Array.isArray(s.monthLabels) &&
        s.monthLabels.length >= 24 &&
        s.monthLabels.length <= 300 &&
        (!s.customValues || s.monthLabels.length === s.customValues.length) &&
        s.monthLabels.every((v) => typeof v === "string" && v.length <= 40),
      "月のラベルを確認してください。",
    );
  if (id === "probability" && s.observed) {
    const o = s.observed;
    need(
      ["coin", "binomial", "normal"].includes(o.mode) &&
        rows(o.values, 1, 10000) &&
        typeof o.label === "string" &&
        o.label.length <= 100,
      "確率の読込データを確認してください。",
    );
    need(
      o.values.every(
        (v) =>
          Number.isFinite(v) &&
          Math.abs(v) <= 1e6 &&
          (o.mode !== "coin" || v === 0 || v === 1) &&
          (o.mode !== "binomial" ||
            (Number.isInteger(v) && v >= 0 && v <= s.n)),
      ),
      "試行結果の値を確認してください。",
    );
  }
  if (id === "correlation" || id === "summary") {
    need(rows(s.points, 2), "データは2〜300点にしてください。");
    need(
      (id === "correlation" && s.selectedId === "") ||
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
  if (s.customPopulation)
    need(
      Array.isArray(s.customPopulation) &&
        rows(s.customPopulation, 2) &&
        s.customPopulation.every(
          (p, i) =>
            p.id === i &&
            Number.isFinite(p.value) &&
            (p.frequent === undefined || typeof p.frequent === "boolean"),
        ),
      "母集団データを確認してください。",
    );
  if (s.customValues)
    need(
      Array.isArray(s.customValues) &&
        s.customValues.length >= 24 &&
        s.customValues.length <= 300 &&
        s.customValues.every((v) => Number.isFinite(v) && v >= 0),
      "月別データは0以上の数値24〜300件にしてください。",
    );
  if (id === "sampling") {
    if (s.compareSamples !== undefined)
      need(
        typeof s.compareSamples === "boolean",
        "標本数の表示方法を確認してください。",
      );
    if (s.compareN !== undefined)
      need(
        Number.isInteger(s.compareN) &&
          s.compareN >= 1 &&
          s.compareN <= (s.customPopulation?.length || 120),
        "2つ目の標本数を確認してください。",
      );
    if (s.sizeComparison !== undefined)
      need(
        s.sizeComparison &&
          Array.isArray(s.sizeComparison.sizes) &&
          s.sizeComparison.sizes.length === 2 &&
          s.sizeComparison.sizes.every(
            (n) =>
              Number.isInteger(n) &&
              n >= 1 &&
              n <= (s.customPopulation?.length || 120),
          ) &&
          Number.isInteger(s.sizeComparison.trials) &&
          s.sizeComparison.trials >= 2 &&
          s.sizeComparison.trials <= 2000,
        "比較する標本数と反復回数を確認してください。",
      );
    need(
      ["without", "with", "random", "biased"].includes(s.method),
      "抽出方法を確認してください。",
    );
    need(
      Number.isInteger(s.n) &&
        s.n >= 1 &&
        s.n <= (s.customPopulation?.length || 120),
      "標本数は1〜120人にしてください。",
    );
    need(
      rows(s.history, 1, 2000) &&
        rows(s.last, 1, s.customPopulation?.length || 120) &&
        s.last.every(
          (v) =>
            Number.isInteger(v) &&
            v >= 0 &&
            v < (s.customPopulation?.length || 120),
        ),
      "抽出履歴を確認してください。",
    );
  }
  if (id === "crosstab" && s.records) {
    need(
      rows(s.records, 1, 10000) &&
        s.records.every(
          (row) =>
            Array.isArray(row) &&
            row.length === 3 &&
            row.every(
              (v) =>
                typeof v === "string" && v.trim().length > 0 && v.length <= 100,
            ),
        ),
      "個人データは課題難度・方式・結果の3列で指定してください。",
    );
    for (let i = 0; i < 3; i++)
      need(
        new Set(s.records.map((row) => row[i])).size <= 2,
        "課題難度・方式・結果はそれぞれ2種類までにしてください。",
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
      "クロス集計表は2種類の課題難度と2方式の人数で指定してください。",
    );
  if (id === "probability")
    need(
      s.p >= 0 && s.p <= 1 && s.sigma > 0,
      "確率は0〜1、標準偏差は正の数にしてください。",
    );
  if (id === "hypothesis-test") {
    participantScores(s.participants);
    need(
      Number.isFinite(s.alpha) && s.alpha > 0 && s.alpha < 1 &&
      Number.isInteger(s.planN) && s.planN >= 30 && s.planN <= 1000 &&
      Number.isFinite(s.trueMean) && s.trueMean >= 0 && s.trueMean <= 1 &&
      Number.isFinite(s.reference) && s.reference > 0 && s.reference < 1 &&
      ["two-sided", "greater", "less"].includes(s.direction) &&
      typeof s.measureLabel === "string" && s.measureLabel.trim().length > 0 && s.measureLabel.length <= 40 &&
      typeof s.referenceReason === "string" && s.referenceReason.length <= 200 &&
      Number.isInteger(s.testStep) && s.testStep >= 0 && s.testStep <= 7 &&
      Number.isInteger(s.errorStep) && s.errorStep >= 0 && s.errorStep <= 2 &&
      typeof s.probabilityReady === "boolean" && Number.isInteger(s.binWidth) && s.binWidth >= 1 && s.binWidth <= 10 && Number.isInteger(s.selectedBin) && s.selectedBin >= -1 && s.selectedBin < Math.ceil(100/s.binWidth) &&
      ["data", "custom"].includes(s.sigmaMode) && Number.isFinite(s.planningSD) && s.planningSD > 0 && s.planningSD <= 1,
      "基準・検定の方向・学習段階・計画の設定を確認してください。",
    );
  }
}

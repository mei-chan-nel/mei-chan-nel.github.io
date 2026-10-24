// Each row records one person's task difficulty, method and outcome.
export const defaultLabels = {
  strata: ["初級課題", "応用課題"],
  methods: ["A方式", "B方式"],
  outcomes: ["達成", "未達成"],
  fields: ["課題難度", "方式", "結果"],
};
export function recordsFor(state) {
  if (Array.isArray(state.records)) return state.records.map((row) => [...row]);
  const labels = state.dataInfo?.labels || defaultLabels;
  const rows = [];
  for (let s = 0; s < 2; s++)
    for (let r = 0; r < 2; r++)
      for (let c = 0; c < 2; c++) {
        const count = state.strata[s].counts[r][c];
        if (
          !Number.isInteger(count) ||
          count < 0 ||
          rows.length + count > 10000
        )
          throw Error("個人データは1〜10,000人分にしてください。");
        for (let i = 0; i < count; i++)
          rows.push([labels.strata[s], labels.methods[r], labels.outcomes[c]]);
      }
  return rows;
}
export function aggregateRecords(rows, labels) {
  const strata = [
    {
      counts: [
        [0, 0],
        [0, 0],
      ],
    },
    {
      counts: [
        [0, 0],
        [0, 0],
      ],
    },
  ];
  for (const row of rows) {
    const s = labels.strata.indexOf(row[0]),
      r = labels.methods.indexOf(row[1]),
      c = labels.outcomes.indexOf(row[2]);
    if (s < 0 || r < 0 || c < 0)
      throw Error("課題難度・方式・結果を確認してください。");
    strata[s].counts[r][c]++;
  }
  return strata;
}
export function labelsForRecords(rows, previous = defaultLabels) {
  const labels = {};
  for (const [i, key] of ["strata", "methods", "outcomes"].entries()) {
    const values = [...new Set(rows.map((row) => row[i]))];
    if (values.length > 2)
      throw Error("課題難度・方式・結果は、それぞれ2種類までにしてください。");
    const known = previous[key] || defaultLabels[key];
    labels[key] = values.every((v) => known.includes(v))
      ? [...known]
      : [
          ...known.filter((v) => values.includes(v)),
          ...values.filter((v) => !known.includes(v)),
        ];
    for (const v of [...known, ...defaultLabels[key]])
      if (labels[key].length < 2 && !labels[key].includes(v))
        labels[key].push(v);
  }
  return labels;
}
// Margins use the same denominator rule as the interior cells.
export function tableValues(matrix, mode) {
  const rowTotals = matrix.map((row) => row[0] + row[1]);
  const colTotals = [matrix[0][0] + matrix[1][0], matrix[0][1] + matrix[1][1]];
  const total = rowTotals[0] + rowTotals[1];
  const counts = [
    ...matrix.map((row, r) => [...row, rowTotals[r]]),
    [...colTotals, total],
  ];
  return counts.map((row, r) =>
    row.map((n, c) => {
      const denominator =
        mode === "row"
          ? r < 2
            ? rowTotals[r]
            : total
          : mode === "column"
            ? c < 2
              ? colTotals[c]
              : total
            : total;
      return mode === "count" ? n : denominator ? n / denominator : null;
    }),
  );
}

// The full population stays in place; only membership in the fraction changes.
export function denominatorRegions(strata, scope, method, outcome, mode) {
  return strata.flatMap((stratum, s) =>
    stratum.counts.flatMap((row, r) =>
      row.map((count, c) => {
        const inScope = scope === "all" || Number(scope) === s;
        return {
          stratum: s,
          method: r,
          outcome: c,
          count,
          inNumerator: inScope && r === method && c === outcome,
          inDenominator:
            inScope &&
            (mode === "row"
              ? r === method
              : mode === "column"
                ? c === outcome
                : true),
        };
      }),
    ),
  );
}

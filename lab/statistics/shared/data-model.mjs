import {
  recordsFor,
  aggregateRecords,
  labelsForRecords,
} from "../crosstab/records.mjs?v=20261025-guided-test";
import { mean, sd, fmt } from "./math.mjs";
import { population } from "../sampling/model.mjs?v=20261025-guided-test";
import {
  seriesValues,
  seriesMonths,
  householdSeries,
} from "../time-series/model.mjs?v=20261025-guided-test";
import { observationValues } from "../probability/model.mjs";
import { asNumber } from "./csv.mjs";
import { participantScores } from "../hypothesis-test/mean-model.mjs?v=20261025-guided-test";
import { niceWidth } from "../histogram/model.mjs";
export const dataKinds = {
  correlation: "pairs",
  histogram: "groups",
  summary: "values",
  sampling: "population",
  crosstab: "records",
  "time-series": "series",
  "hypothesis-test": "participant-accuracy",
  lorenz: "incomes",
  probability: "probability",
};
export function currentData(id, s) {
  let headers,
    rows,
    name = s.source || s.label || "",
    operation = "";
  if (id === "correlation") {
    headers = [s.xLabel, s.yLabel];
    rows = s.points.map((p) => [p.x, p.y]);
    operation = s.excludeSelected
      ? `${Math.max(0, rows.length - 1)}組で回帰 → 選択した1組を予測`
      : s.manual
        ? "散布図 → 傾き・切片を手動で調整"
        : "散布図 → 最小二乗法で回帰直線を計算";
  }
  if (id === "histogram") {
    headers = [s.label || "値", s.groupLabel || "集団"];
    rows = s.rows.map((r) => [
      r.value + (r.group === "B" ? Number(s.shiftB || 0) : 0),
      s.groupNames?.[r.group === "B" ? 1 : 0] || r.group,
    ]);
    operation = `階級幅 ${fmt(s.width, 2)}で集計 → 度数分布表・分布と箱ひげ図・代表値計算`;
  }
  if (id === "summary") {
    headers = [s.label || "値"];
    rows = s.points.map((p) => [p.value]);
    operation = `${s.meanLocked ? "平均を保って値を再配分 → " : ""}平均・中央値・四分位数・分散（分母 ${s.sample ? "n−1" : "n"}）を計算`;
  }
  if (id === "sampling") {
    headers = [s.dataInfo?.columns?.[0] || "読書時間（分）"];
    const people = population(s.customPopulation);
    rows = people.map((r) => [r.value]);
    name = name || "生徒120人の読書時間";
    operation = `${people.length}件から${s.n}回、${s.method === "with" ? "重複あり" : "重複なし"}で抽出 → ${s.trials}組の標本平均`;
  }

  if (id === "lorenz") {
    headers = [s.incomeLabel || "所得（万円）"];
    rows = s.incomes.map((v) => [v]);
    name = name || "10人の月の所得";
    operation = `${s.locked ? "総額を固定して再配分 → " : ""}所得順に累積 → 曲線とジニ係数を計算`;
  }
  if (id === "time-series") {
    headers = [
      s.dataInfo?.columns?.[0] || "月",
      s.customLabel || householdSeries.label,
    ];
    const values = seriesValues(s),
      months = seriesMonths(s);
    rows = values.map((v, i) => [months[i], v]);
    name = name || householdSeries.name;
    operation = "中心移動平均 → 自己相関 → 季節調整 → 伸び率・指数";
  }
  if (id === "crosstab") {
    const l = s.dataInfo?.labels;
    headers = [
      l?.fields?.[0] || "課題難度",
      l?.fields?.[1] || "方式",
      l?.fields?.[2] || "結果",
    ];
    rows = recordsFor(s);
    name = name || "生徒ごとの課題難度・方式・結果";
    operation = `${headers.join("・")}で人数を数える → クロス集計表と割合を比較`;
  }
  if (id === "hypothesis-test") {
    headers = s.dataInfo?.columns || ["参加者番号", "判定枚数", "正答数"];
    rows = s.participants.map(p => [p.id, p.trials, p.correct]);
    name = name || "顔写真を見分ける実験の参加者別正答数";
    operation = `1人ごとに${s.measureLabel || "割合"}を計算 → 仮説と有意水準を決める → 平均を基準${fmt((s.reference ?? .5) * 100, 2)}%と比較 → 判断・解釈`;
  }
  if (id === "probability" && s.experiments?.some((e) => e.id === s.activeId)) {
    const e = s.experiments.find((e) => e.id === s.activeId);
    headers = ["セット", "表の回数"];
    rows = e.sets.map((row, i) => [i + 1, row.reduce((a, b) => a + b, 0)]);
    name = `コインのモデル実験 ${e.id}`;
    operation = "同じ結果を、相対度数・二項分布・正規近似・標準化で読む";
  } else if (id === "probability") {
    headers = [
      s.observed?.mode === s.mode
        ? s.observed.label
        : s.mode === "normal"
          ? "測定値"
          : s.mode === "binomial"
            ? "1セットの成功回数"
            : "結果（表=1・裏=0）",
    ];
    rows = observationValues(s).map((v) => [v]);
    name =
      s.observed?.mode === s.mode
        ? s.dataInfo?.name || "読込データ"
        : s.mode === "normal"
          ? "正規分布モデルから生成した200件"
          : s.mode === "binomial"
            ? "二項分布の反復実験"
            : "コイン試行";
    operation =
      s.mode === "normal"
        ? `平均 ${s.mu}・標準偏差 ${s.sigma} → ${s.low}〜${s.high}の区間確率`
        : s.mode === "binomial"
          ? `成功確率 ${s.p}・1セット${s.n}試行 → ${s.repetitions}セットの分布`
          : `表の確率 ${s.p} → コイン${s.tossCount}回の相対度数`;
  }
  const info =
    id === "probability" && s.observed?.mode !== s.mode ? null : s.dataInfo;
  let edits = 0;
  if (info?.baseline) {
    const before = info.baseline;
    edits =
      Math.max(rows.length, before.length) -
      rows.filter((r, i) => JSON.stringify(r) === JSON.stringify(before[i]))
        .length;
  }
  return {
    headers,
    rows,
    name: info?.name || name,
    origin: info?.origin || (id === "probability" ? "model" : "sample"),
    filename: info?.filename || "",
    operation,
    ...(id === "time-series" && !s.customValues
      ? {
          citation: {
            name: householdSeries.sourceName,
            href: householdSeries.sourceUrl,
          },
          population: householdSeries.population,
        }
      : {}),
    publicDataset: info?.publicDataset,
    edits,
  };
}
function bounds(values) {
  const lo = Math.min(...values),
    hi = Math.max(...values),
    pad = Math.max((hi - lo) * 0.12, 1);
  return [Math.min(0, lo - pad), Math.max(hi + pad, 1)];
}
export function applyData(
  id,
  base,
  { headers, rows, name, filename = "", x = 0, y = 1, group = -1, date = 0 },
) {
  const kind = dataKinds[id],
    number = (r, c, i) => asNumber(r[c], i + 2, headers[c] || "値");
  if (
    !Array.isArray(headers) ||
    headers.some((h) => typeof h !== "string" || h.length > 100)
  )
    throw Error("項目名は100文字以内にしてください。");
  if (
    !Array.isArray(rows) ||
    rows.length < 1 ||
    rows.length > (["probability", "crosstab", "hypothesis-test"].includes(id) ? 10000 : 300)
  )
    throw Error(
      id === "time-series"
        ? "月別データは、時間順に連続する24〜300か月分を指定してください。"
        : ["probability", "crosstab", "hypothesis-test"].includes(id)
          ? "1〜10,000行で指定してください。"
          : "1〜300行のデータを指定してください。",
    );
  const s = { ...base, dataInfo: null };
  let applied;
  if (kind === "probability") {
    const values = rows.map((r, i) => number(r, x, i));
    if (base.mode === "coin" && values.some((v) => v !== 0 && v !== 1))
      throw Error("コインの結果は表=1・裏=0で指定してください。");
    if (
      base.mode === "binomial" &&
      values.some((v) => !Number.isInteger(v) || v < 0 || v > base.n)
    )
      throw Error(`成功回数は0〜${base.n}の整数にしてください。`);
    s.observed = { mode: base.mode, values, label: headers[x] };
    if (base.mode === "normal") {
      s.mu = mean(values);
      s.sigma = sd(values) || 1;
      s.low = s.mu - s.sigma;
      s.high = s.mu + s.sigma;
    }
    s.dataInfo = null;
    if (base.mode === "coin") s.tossCount = values.length;
    if (base.mode === "binomial") s.repetitions = values.length;
  } else if (kind === "pairs") {
    if (rows.length < 2 || x === y)
      throw Error("異なる2列を選び、2行以上のデータを指定してください。");
    s.points = rows.map((r, i) => ({
      id: "u" + i,
      x: number(r, x, i),
      y: number(r, y, i),
      ...(group >= 0 ? { group: String(r[group]).slice(0, 40) } : {}),
    }));
    s.selectedId = s.points[0].id;
    [s.xMin, s.xMax] = bounds(s.points.map((p) => p.x));
    [s.yMin, s.yMax] = bounds(s.points.map((p) => p.y));
    s.xLabel = headers[x];
    s.yLabel = headers[y];
    s.predictionX = mean(s.points.map((p) => p.x));
    s.source = name;
    s.manual = false;
    s.excludeSelected = false;
  } else if (["groups", "values", "population", "incomes"].includes(kind)) {
    const values = rows.map((r, i) => number(r, x, i));
    if (values.length < 2) throw Error("2行以上のデータを指定してください。");
    if (kind === "groups") {
      s.groupLabel = group >= 0 ? headers[group] : "集団";
      const groups =
        group < 0
          ? ["全体"]
          : [...new Set(rows.map((r) => r[group] || "全体"))];
      if (groups.length > 2)
        throw Error("このラボでは集団は2種類までにしてください。");
      s.rows = values.map((v, i) => ({
        id: "u" + i,
        value: v,
        group: group < 0 || rows[i][group] === groups[0] ? "A" : "B",
      }));
      s.groupNames = [groups[0], groups[1] || "なし"];
      s.width = Math.max(
        0.1,
        niceWidth(Math.max(...values) - Math.min(...values)),
      );
      s.start = 0;
      s.shiftB = 0;
      s.selected = -1;
      s.label = headers[x];
    }
    if (kind === "values") {
      s.points = values.map((v, i) => ({ id: "u" + i, value: v }));
      s.selectedId = s.points[0].id;
      s.spreadBase = values;
      s.spreadFactor = 1;
      s.meanLocked = false;
      [s.min, s.max] = bounds(values);
      s.label = headers[x];
    }
    if (kind === "incomes") {
      if (values.some((v) => v < 0))
        throw Error("所得は0以上の数値にしてください。");
      s.incomes = values;
      s.incomeLabel = headers[x];
      s.selected = 0;
      s.from = values.length - 1;
      s.to = 0;
      s.reference = null;
      s.locked = true;
    }
    if (kind === "population") {
      s.dataInfo = { columns: [headers[x]] };
      s.customPopulation = values.map((value, id) => ({ id, value }));
      delete s.groupNames;
      delete s.groupLabel;
      delete s.shiftB;
      s.n = Math.min(20, values.length);
      s.signature = "";
      s.history = [];
      s.last = [];
      s.trials = 0;
    }
    s.source = name;
  } else if (kind === "series") {
    if (rows.length < 24 || rows.length > 300)
      throw Error(
        "月別データは、時間順に連続する24〜300か月分を指定してください。",
      );
    const values = rows.map((r, i) => number(r, x, i));
    if (values.some((v) => v < 0))
      throw Error("月別の値は0以上の数値を指定してください。");
    s.dataInfo = { columns: [date >= 0 ? headers[date] : "月", headers[x]] };
    if (
      values.length !==
      (base.customValues?.length || householdSeries.values.length)
    )
      s.selected = Math.floor(values.length / 2);
    s.customValues = values;
    s.customLabel = headers[x];
    s.monthLabels =
      date < 0 ? undefined : rows.map((r) => String(r[date]).slice(0, 40));
    if (
      s.monthLabels &&
      s.monthLabels.every(
        (v, i) => v === String(i + 1) || v === `${i + 1}か月目`,
      )
    )
      s.monthLabels = s.monthLabels.map((_, i) => `${i + 1}か月目`);
    else if (s.monthLabels) {
      const months = s.monthLabels.map((v) => {
        const m = /^(\d{4})[-\/](\d{1,2})(?:[-\/]01)?$/.exec(v);
        if (!m || +m[2] < 1 || +m[2] > 12)
          throw Error(
            "月のラベルはYYYY-MM形式にしてください。日付列を使わないこともできます。",
          );
        return +m[1] * 12 + (+m[2] - 1);
      });
      if (months.some((v, i) => i > 0 && v !== months[i - 1] + 1))
        throw Error(
          "月のデータは欠けや重複がないように、時間順に指定してください。",
        );
    }
    s.source = name;
  } else if (kind === "records" && headers.length === 3) {
    const records = rows.map((row, i) => {
      if (row.length !== 3)
        throw Error(
          `${i + 1}行目は「課題難度,方式,結果」の3列にしてください。`,
        );
      return row.map((value) => {
        const text = String(value ?? "").trim();
        if (!text || text.length > 100)
          throw Error(
            "課題難度・方式・結果は空欄にせず、100文字以内にしてください。",
          );
        return text;
      });
    });
    const labels = labelsForRecords(records, base.dataInfo?.labels);
    s.records = records;
    s.strata = aggregateRecords(records, labels);
    s.anchors = s.strata.map((g) =>
      g.counts.map(([a, b]) => (a + b ? a / (a + b) : 0)),
    );
    s.dataInfo = { labels: { ...labels, fields: headers.slice(0, 3) } };
    s.source = name;
  } else if (kind === "records") {
    if (rows.length !== 4 || rows.some((r) => r.length < 4))
      throw Error(
        "「課題難度,方式,結果」の3列で、1行に1人分を指定してください。",
      );
    const strata = [...new Set(rows.map((r) => r[0]))],
      methods = [...new Set(rows.map((r) => r[1]))];
    if ([...strata, ...methods].some((v) => String(v).length > 100))
      throw Error("課題難度と方式の名前は100文字以内にしてください。");
    if (strata.length !== 2 || methods.length !== 2)
      throw Error("課題難度と方式はそれぞれ2種類にしてください。");
    s.strata = strata.map((a) => ({
      counts: methods.map((b) => {
        const match = rows.filter((r) => r[0] === a && r[1] === b);
        if (match.length !== 1)
          throw Error(
            "旧形式の集計データは、各課題難度×方式の組を1行ずつ指定してください。",
          );
        return [2, 3].map((c) => {
          const v = asNumber(match[0][c], 1, headers[c]);
          if (v < 0 || !Number.isInteger(v))
            throw Error("人数は0以上の整数にしてください。");
          return v;
        });
      }),
    }));
    s.anchors = s.strata.map((g) =>
      g.counts.map(([a, b]) => (a + b ? a / (a + b) : 0)),
    );
    s.selectedScope = "all";
    s.selectedRow = 0;
    s.selectedCol = 0;
    s.showCounts = false;
    s.dataInfo = {
      labels: {
        strata,
        methods,
        outcomes: headers.slice(2, 4),
        fields: headers.slice(0, 2),
      },
    };
    delete s.records;
    s.records = recordsFor(s);
    s.source = name;
  } else if (kind === "participant-accuracy") {
    if (headers.length !== 3 || rows.some(r => r.length !== 3))
      throw Error("「参加者番号,判定枚数,正答数」の3列で、1行に1人分を指定してください。");
    const participants = rows.map((r, i) => ({
      id: String(r[0] ?? "").trim(), trials: number(r, 1, i), correct: number(r, 2, i),
    }));
    participantScores(participants);
    s.participants = participants;
    s.testStep = 0; s.errorStep = 0; s.selectedBin = -1;
    s.dataInfo = { columns: headers.slice(0, 3) };
    s.source = name;
  } else
    throw Error(
      "このページはデータの読込ではなく確率モデルの条件を設定します。",
    );
  applied = currentData(id, s);
  s.dataInfo = {
    ...(s.dataInfo || {}),
    name,
    origin: "user",
    filename,
    columns: applied.headers,
    baseline: applied.rows,
  };
  return s;
}

export function restoreInput(id, state, initial) {
  const d = state.dataInfo;
  if (!d?.baseline) return initial;
  const indexed = ["histogram", "sampling"].includes(id)
    ? { x: 0, group: 1 }
    : id === "time-series"
      ? { x: 1, date: 0 }
      : { x: 0, y: 1 };
  return applyData(id, initial, {
    name: d.name,
    filename: d.filename || "",
    headers: d.columns,
    rows: d.baseline,
    ...indexed,
  });
}

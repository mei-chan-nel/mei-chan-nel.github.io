// A small relational model. Projection keeps source values for hidden-column filters.
export const LIMITS = {
  tables: 8,
  columns: 12,
  rows: 100,
  occurrences: 12,
  relations: 16,
  filters: 10,
  result: 2000,
};
export const OPERATORS = {
  eq: "等しい",
  ne: "等しくない",
  contains: "含む",
  starts: "で始まる",
  gt: "より大きい",
  ge: "以上",
  lt: "より小さい",
  le: "以下",
  empty: "空欄である",
  filled: "空欄ではない",
};
export const clone = (value) => JSON.parse(JSON.stringify(value));
export const keyOf = (occurrence, column) => `${occurrence}/${column}`;
export function uid(prefix) {
  return `${prefix}_${globalThis.crypto.randomUUID().replaceAll("-", "")}`;
}
const fail = (message) => {
  throw new Error(message);
};
const validId = (id) =>
  typeof id === "string" && /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(id);
const nameOK = (name) =>
  typeof name === "string" && name.trim().length > 0 && name.length <= 40;
const bounded = (items, max, name) => {
  if (!Array.isArray(items) || items.length > max)
    fail(`${name}は${max}個までです。`);
};
const uniqueIds = (items) => {
  if (
    items.some((item) => !item || !validId(item.id)) ||
    new Set(items.map((item) => item.id)).size !== items.length
  )
    fail("識別番号が不正または重複しています。");
};
const uniqueNames = (items, label) => {
  if (items.some((item) => !nameOK(item.name)))
    fail(`${label}は1〜40文字で入力してください。`);
  if (new Set(items.map((item) => item.name.trim())).size !== items.length)
    fail(`${label}が重複しています。別の名前にしてください。`);
};
export function emptyDatabase() {
  return {
    version: 1,
    tables: [],
    occurrences: [],
    relations: [],
    query: {
      base: "",
      hidden: [],
      distinct: false,
      filters: [],
      match: "all",
      join: "left",
      order: [],
      sort: null,
    },
  };
}
export function coreDatabase() {
  const db = emptyDatabase();
  db.tables = [
    {
      id: "students",
      name: "学生",
      columns: [
        {
          id: "sid",
          name: "学生ID",
          type: "text",
          required: true,
          primary: true,
        },
        {
          id: "name",
          name: "氏名",
          type: "text",
          required: false,
          primary: false,
        },
      ],
      rows: [
        { id: "s1", values: { sid: "S01", name: "青木 太郎" } },
        { id: "s2", values: { sid: "S02", name: "伊藤 花子" } },
        { id: "s3", values: { sid: "S03", name: "加藤 翔太" } },
      ],
    },
    {
      id: "memberships",
      name: "部員",
      columns: [
        {
          id: "sid",
          name: "学生ID",
          type: "text",
          required: true,
          primary: true,
        },
        {
          id: "cid",
          name: "部活ID",
          type: "text",
          required: true,
          primary: true,
        },
      ],
      rows: [
        { id: "m1", values: { sid: "S01", cid: "C02" } },
        { id: "m2", values: { sid: "S02", cid: "C01" } },
        { id: "m3", values: { sid: "S02", cid: "C02" } },
        { id: "m4", values: { sid: "S03", cid: "C01" } },
      ],
    },
    {
      id: "clubs",
      name: "部活",
      columns: [
        {
          id: "cid",
          name: "部活ID",
          type: "text",
          required: true,
          primary: true,
        },
        {
          id: "name",
          name: "部活名",
          type: "text",
          required: false,
          primary: false,
        },
        {
          id: "advisor",
          name: "顧問",
          type: "text",
          required: false,
          primary: false,
        },
      ],
      rows: [
        { id: "c1", values: { cid: "C01", name: "将棋部", advisor: "高橋" } },
        { id: "c2", values: { cid: "C02", name: "科学部", advisor: "後藤" } },
      ],
    },
  ];
  db.occurrences = [
    { id: "student", table: "students", name: "学生", x: 24, y: 32 },
    { id: "membership", table: "memberships", name: "部員", x: 332, y: 64 },
    { id: "club", table: "clubs", name: "部活", x: 640, y: 32 },
  ];
  db.relations = [
    {
      id: "r1",
      left: "student",
      right: "membership",
      pairs: [{ left: "sid", right: "sid" }],
      mode: "left",
    },
    {
      id: "r2",
      left: "membership",
      right: "club",
      pairs: [{ left: "cid", right: "cid" }],
      mode: "left",
    },
  ];
  db.query.base = "student";
  return db;
}
// A fictional school dataset with multiple clubs per student.
function schoolDatabase() {
  const db = coreDatabase();
  {
    const names = [
      "佐藤 美咲",
      "鈴木 健太",
      "高橋 結衣",
      "田中 蓮",
      "渡辺 葵",
      "山本 陽菜",
      "中村 悠真",
      "小林 凛",
      "斎藤 大和",
      "森 さくら",
      "石井 優斗",
      "橋本 彩花",
      "池田 颯太",
      "阿部 七海",
      "山田 大輔",
      "松本 美月",
      "井上 拓海",
      "木村 心春",
      "林 航",
      "清水 桃子",
      "吉田 直樹",
    ];
    names.forEach((name, index) => {
      const number = index + 4;
      db.tables[0].rows.push({
        id: `s${number}`,
        values: { sid: `S${String(number).padStart(2, "0")}`, name },
      });
    });
    [
      ["吹奏楽部", "佐藤"],
      ["陸上部", "田中"],
      ["美術部", "鈴木"],
      ["写真部", "中村"],
    ].forEach(([name, advisor], index) => {
      const number = index + 3;
      db.tables[2].rows.push({
        id: `c${number}`,
        values: { cid: `C${String(number).padStart(2, "0")}`, name, advisor },
      });
    });
    for (let student = 4; student <= 24; student++) {
      const club = ((student - 4) % 6) + 1;
      for (const number of student <= 18 ? [club, (club % 6) + 1] : [club]) {
        db.tables[1].rows.push({
          id: `m${db.tables[1].rows.length + 1}`,
          values: {
            sid: `S${String(student).padStart(2, "0")}`,
            cid: `C${String(number).padStart(2, "0")}`,
          },
        });
      }
    }
  }
  db.query.hidden = ["membership/sid", "club/cid"];
  db.query.filters = [
    { id: "club_filter", key: "club/name", op: "eq", value: "将棋部" },
  ];
  return db;
}
export function learningPreset() {
  const db = schoolDatabase();
  const nonmembers = new Set(["S02", "S19", "S22"]);
  db.tables[1].rows = db.tables[1].rows.filter(
    (row) => !nonmembers.has(row.values.sid),
  );
  db.tables[2].rows.push({
    id: "c7",
    values: { cid: "C07", name: "文芸部", advisor: "山田" },
  });
  return db;
}
export function parseCell(input, column) {
  if (input === "" || input === null) return null;
  if (column.type === "text") return String(input);
  const value =
    typeof input === "number" ? input : Number(String(input).trim());
  if (String(input).trim() === "" || !Number.isFinite(value))
    fail(`「${column.name}」には有限の数値を入力してください。`);
  return value;
}
export function upgradeDatabase(db) {
  // Update only exact, unedited copies of the old samples; retain custom work.
  const latest = learningPreset();
  for (const sample of [coreDatabase(), schoolDatabase(), latest]) {
    const previous = clone(sample.tables);
    previous[1].name = "所属";
    previous[0].rows.forEach((row) => {
      row.values.name = row.values.name.split(" ")[0];
    });
    const savedTables = JSON.stringify(db.tables);
    if (
      savedTables !== JSON.stringify(previous) &&
      savedTables !== JSON.stringify(sample.tables)
    )
      continue;
    db.tables =
      sample.tables[0].rows.length === 3 ? sample.tables : latest.tables;
    for (const occurrence of db.occurrences) {
      if (
        occurrence.table === "memberships" &&
        occurrence.name === "所属" &&
        !db.occurrences.some(
          (other) => other.id !== occurrence.id && other.name === "部員",
        )
      )
        occurrence.name = "部員";
    }
    break;
  }
  db.query.join = "left";
  db.query.order ??= [];
  db.query.sort ??= null;
  return validateDatabase(db);
}
export function validateTable(table) {
  bounded(table.columns, LIMITS.columns, "列");
  if (!table.columns.length) fail("列を1つ以上定義してください。");
  uniqueIds(table.columns);
  uniqueNames(table.columns, "列名");
  bounded(table.rows, LIMITS.rows, "行");
  uniqueIds(table.rows);
  for (const col of table.columns) {
    if (
      !["text", "number"].includes(col.type) ||
      typeof col.required !== "boolean" ||
      typeof col.primary !== "boolean"
    )
      fail("列の型または制約が不正です。");
  }
  const primary = table.columns.filter((col) => col.primary),
    seen = new Set();
  for (const [index, row] of table.rows.entries()) {
    if (
      !row.values ||
      typeof row.values !== "object" ||
      Array.isArray(row.values)
    )
      fail("行データが不正です。");
    for (const col of table.columns) {
      const v = row.values[col.id];
      if (
        v === undefined ||
        (v !== null &&
          (col.type === "number"
            ? typeof v !== "number" || !Number.isFinite(v)
            : typeof v !== "string" || v.length > 200))
      )
        fail(
          `${index + 1}行目の「${col.name}」の値が不正です（文字は200字まで）。`,
        );
      if ((col.required || col.primary) && (v === null || v === ""))
        fail(
          `${index + 1}行目の「${col.name}」は${col.primary ? "主キーなので" : "必須なので"}空欄にできません。`,
        );
    }
    if (primary.length) {
      const key = JSON.stringify(primary.map((col) => row.values[col.id]));
      if (seen.has(key))
        fail(
          `${index + 1}行目の主キーが重複しています。${primary.length > 1 ? "主キーにした列の組合せ" : "主キーの値"}を変えてください。`,
        );
      seen.add(key);
    }
  }
}
export function resolveField(db, occurrenceId, columnId) {
  const occurrence = db.occurrences.find((o) => o.id === occurrenceId),
    table = db.tables.find((t) => t.id === occurrence?.table),
    column = table?.columns.find((c) => c.id === columnId);
  return column
    ? {
        occurrence,
        table,
        column,
        key: keyOf(occurrenceId, columnId),
        label: `${occurrence.name}・${column.name}`,
      }
    : null;
}
export function fields(db) {
  return db.occurrences.flatMap((o) =>
    db.tables
      .find((t) => t.id === o.table)
      .columns.map((c) => resolveField(db, o.id, c.id)),
  );
}
export function validateDatabase(db) {
  if (!db || db.version !== 1)
    fail("このラボのバージョン1のデータを読み込んでください。");
  for (const [key, label] of [
    ["tables", "テーブル"],
    ["occurrences", "テーブルのカード"],
    ["relations", "関係"],
  ]) {
    bounded(db[key], LIMITS[key], label);
    uniqueIds(db[key]);
  }
  uniqueNames(db.tables, "テーブル名");
  uniqueNames(db.occurrences, "カード名");
  db.tables.forEach(validateTable);
  for (const o of db.occurrences) {
    if (
      !db.tables.some((t) => t.id === o.table) ||
      !Number.isFinite(o.x) ||
      !Number.isFinite(o.y) ||
      o.x < 0 ||
      o.x > 2200 ||
      o.y < 0 ||
      o.y > 1600
    )
      fail("テーブルのカード情報が不正です。");
  }
  const parents = new Map(db.occurrences.map((o) => [o.id, o.id]));
  const root = (id) => {
    while (parents.get(id) !== id) id = parents.get(id);
    return id;
  };
  for (const r of db.relations) {
    if (
      !parents.has(r.left) ||
      !parents.has(r.right) ||
      r.left === r.right ||
      !["inner", "left"].includes(r.mode)
    )
      fail("異なる2つのカードと結合方法を選んでください。");
    bounded(r.pairs, LIMITS.columns, "対応する列");
    if (!r.pairs.length) fail("対応する列を1組以上選んでください。");
    const pairs = new Set();
    for (const pair of r.pairs) {
      const l = resolveField(db, r.left, pair.left),
        rr = resolveField(db, r.right, pair.right);
      if (!l || !rr) fail("関係に使う列が見つかりません。");
      if (l.column.type !== rr.column.type)
        fail(
          "関係には同じ型の列を選んでください（文字と数値は結合できません）。",
        );
      const k = `${pair.left}/${pair.right}`;
      if (pairs.has(k)) fail("同じ列の対応が重複しています。");
      pairs.add(k);
    }
    const a = root(r.left),
      b = root(r.right);
    if (a === b)
      fail(
        "関係が輪になります。同じテーブルの別のカードを追加してつないでください。",
      );
    parents.set(a, b);
  }
  const q = db.query;
  if (
    !q ||
    (q.base !== "" && !parents.has(q.base)) ||
    (!q.base && db.occurrences.length) ||
    typeof q.distinct !== "boolean" ||
    !["all", "any"].includes(q.match) ||
    (q.join !== undefined && !["left", "relations"].includes(q.join))
  )
    fail("取り出し方の設定が不正です。");
  bounded(q.hidden, LIMITS.occurrences * LIMITS.columns, "非表示の列");
  const available = new Map(fields(db).map((f) => [f.key, f]));
  if (
    q.hidden.some((key) => !available.has(key)) ||
    new Set(q.hidden).size !== q.hidden.length
  )
    fail("非表示の列の設定が不正です。");
  const order = q.order ?? [];
  bounded(order, LIMITS.occurrences * LIMITS.columns, "列の並び順");
  if (
    order.some((key) => !available.has(key)) ||
    new Set(order).size !== order.length
  )
    fail("列の並び順の設定が不正です。");
  const sorts = sortCriteria(q.sort);
  bounded(sorts, LIMITS.occurrences * LIMITS.columns, "整列する列");
  if (
    sorts.some(
      (sort) =>
        !sort ||
        typeof sort !== "object" ||
        Array.isArray(sort) ||
        !available.has(sort.key) ||
        !["asc", "desc"].includes(sort.direction),
    ) ||
    new Set(sorts.map((sort) => sort.key)).size !== sorts.length
  )
    fail("行の整列の設定が不正です。");
  bounded(q.filters, LIMITS.filters, "検索条件");
  uniqueIds(q.filters);
  for (const filter of q.filters) {
    if (
      !available.has(filter.key) ||
      !Object.hasOwn(OPERATORS, filter.op) ||
      typeof filter.value !== "string" ||
      filter.value.length > 200
    )
      fail("検索条件が不正です。");
    if (
      available.get(filter.key).column.type === "number" &&
      ["contains", "starts"].includes(filter.op)
    )
      fail("数値の列では文字の検索は使えません。");
  }
  return db;
}
// Only called after an intentional schema/card deletion, never for imported data.
export function reconcile(db) {
  db.occurrences = db.occurrences.filter((o) =>
    db.tables.some((t) => t.id === o.table),
  );
  db.relations = db.relations.filter((r) =>
    r.pairs.every((p) => {
      const l = resolveField(db, r.left, p.left),
        rr = resolveField(db, r.right, p.right);
      return l && rr && l.column.type === rr.column.type;
    }),
  );
  const keys = new Map(fields(db).map((f) => [f.key, f]));
  db.query.hidden = db.query.hidden.filter((key) => keys.has(key));
  if (db.query.order)
    db.query.order = db.query.order.filter((key) => keys.has(key));
  if (db.query.sort) {
    const sorts = sortCriteria(db.query.sort).filter((sort) =>
      keys.has(sort.key),
    );
    db.query.sort = sorts.length ? sorts : null;
  }
  db.query.filters = db.query.filters.filter(
    (f) =>
      keys.has(f.key) &&
      !(
        keys.get(f.key).column.type === "number" &&
        ["contains", "starts"].includes(f.op)
      ),
  );
  if (!db.occurrences.some((o) => o.id === db.query.base))
    db.query.base = db.occurrences[0]?.id ?? "";
  return db;
}
export function joinRows(db) {
  if (!db.query.base) return { columns: [], rows: [], used: [], steps: [] };
  const byId = new Map(db.occurrences.map((o) => [o.id, o])),
    used = [db.query.base],
    steps = [];
  const occurrenceFields = (id) =>
    db.tables
      .find((t) => t.id === byId.get(id).table)
      .columns.map((c) => resolveField(db, id, c.id));
  const materialize = (id) =>
    db.tables
      .find((t) => t.id === byId.get(id).table)
      .rows.map((row) =>
        Object.fromEntries(
          occurrenceFields(id).map((f) => [f.key, row.values[f.column.id]]),
        ),
      );
  let columns = occurrenceFields(db.query.base),
    rows = materialize(db.query.base);
  while (true) {
    const relation = db.relations.find(
      (r) => used.includes(r.left) !== used.includes(r.right),
    );
    if (!relation) break;
    const mode = db.query.join === "left" ? "left" : relation.mode;
    const forward = used.includes(relation.left),
      nextId = forward ? relation.right : relation.left,
      nextColumns = occurrenceFields(nextId),
      rightRows = materialize(nextId),
      output = [],
      before = rows.length;
    for (const row of rows) {
      let matched = false;
      for (const candidate of rightRows) {
        if (
          !relation.pairs.every((p) => {
            const a =
                row[
                  keyOf(
                    forward ? relation.left : relation.right,
                    forward ? p.left : p.right,
                  )
                ],
              b = candidate[keyOf(nextId, forward ? p.right : p.left)];
            return a !== null && b !== null && a === b;
          })
        )
          continue;
        matched = true;
        output.push({ ...row, ...candidate });
        if (output.length > LIMITS.result)
          fail(
            `結合結果が${LIMITS.result}行を超えました。表の行数や関係を減らしてください。`,
          );
      }
      if (!matched && mode === "left")
        output.push({
          ...row,
          ...Object.fromEntries(nextColumns.map((f) => [f.key, null])),
        });
      if (output.length > LIMITS.result)
        fail(
          `結合結果が${LIMITS.result}行を超えました。表の行数や関係を減らしてください。`,
        );
    }
    rows = output;
    columns.push(...nextColumns);
    used.push(nextId);
    steps.push({
      relation: relation.id,
      name: byId.get(nextId).name,
      before,
      after: rows.length,
      mode,
    });
  }
  return { columns: orderedFields(db, columns), rows, used, steps };
}
export function orderedFields(db, columns) {
  const order = new Map(
    (db.query.order ?? []).map((key, index) => [key, index]),
  );
  return columns
    .map((column, index) => ({
      column,
      rank: order.get(column.key) ?? order.size + index,
    }))
    .sort((a, b) => a.rank - b.rank)
    .map((item) => item.column);
}
export function distinctRows(rows, columns) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = JSON.stringify(columns.map((f) => row[f.key]));
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
export function relationCardinality(db, relation) {
  const left = resolveField(db, relation.left, relation.pairs[0].left).table
    .rows;
  const right = resolveField(db, relation.right, relation.pairs[0].right).table
    .rows;
  const matches = (a, b) =>
    relation.pairs.every(
      (p) =>
        a.values[p.left] !== null &&
        b.values[p.right] !== null &&
        a.values[p.left] === b.values[p.right],
    );
  const leftMany = right.some(
    (b) => left.filter((a) => matches(a, b)).length > 1,
  );
  const rightMany = left.some(
    (a) => right.filter((b) => matches(a, b)).length > 1,
  );
  return [leftMany ? "多" : "1", rightMany ? "多" : "1"];
}
export function queryRows(db) {
  const joined = joinRows(db),
    visible = joined.columns.filter((f) => !db.query.hidden.includes(f.key)),
    columnMap = new Map(joined.columns.map((f) => [f.key, f]));
  const predicates = db.query.filters
    .filter(
      (f) =>
        columnMap.has(f.key) &&
        (["empty", "filled"].includes(f.op) || f.value !== ""),
    )
    .map((f) => {
      const col = columnMap.get(f.key).column,
        value = ["empty", "filled"].includes(f.op)
          ? null
          : parseCell(f.value, col);
      return (row) => {
        const actual = row[f.key];
        if (f.op === "empty") return actual === null || actual === "";
        if (f.op === "filled") return actual !== null && actual !== "";
        if (actual === null) return false;
        switch (f.op) {
          case "eq":
            return actual === value;
          case "ne":
            return actual !== value;
          case "contains":
            return actual.includes(value);
          case "starts":
            return actual.startsWith(value);
          case "gt":
            return actual > value;
          case "ge":
            return actual >= value;
          case "lt":
            return actual < value;
          case "le":
            return actual <= value;
        }
      };
    });
  const selected = joined.rows.filter(
    (row) =>
      !predicates.length ||
      (db.query.match === "all"
        ? predicates.every((p) => p(row))
        : predicates.some((p) => p(row))),
  );
  const sorted = sortRows(selected, db.query.sort, joined.columns);
  return {
    joined,
    visible,
    projected: db.query.distinct
      ? distinctRows(joined.rows, visible)
      : joined.rows,
    selected,
    result: db.query.distinct ? distinctRows(sorted, visible) : sorted,
    activeFilters: predicates.length,
    inactiveFilters: db.query.filters.filter((f) => !columnMap.has(f.key))
      .length,
  };
}

const textOrder = new Intl.Collator("ja", {
  numeric: true,
  sensitivity: "variant",
});
export function sortRows(rows, sort, columns) {
  const criteria = sortCriteria(sort)
    .map((sort) => ({
      ...sort,
      field: columns.find((field) => field.key === sort.key),
    }))
    .filter((sort) => sort.field);
  if (!criteria.length) return rows;
  return rows.slice().sort((a, b) => {
    for (const sort of criteria) {
      const left = a[sort.key],
        right = b[sort.key];
      const leftEmpty = left === null || left === "",
        rightEmpty = right === null || right === "";
      const comparison =
        leftEmpty || rightEmpty
          ? Number(leftEmpty) - Number(rightEmpty)
          : (sort.direction === "desc" ? -1 : 1) *
            (sort.field.column.type === "number"
              ? left - right
              : textOrder.compare(left, right));
      if (comparison) return comparison;
    }
    return 0;
  });
}
export function sortCriteria(sort) {
  return sort == null ? [] : Array.isArray(sort) ? sort : [sort];
}

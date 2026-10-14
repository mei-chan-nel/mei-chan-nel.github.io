import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  coreDatabase,
  learningPreset,
  emptyDatabase,
  clone,
  validateDatabase,
  upgradeDatabase,
  validateTable,
  parseCell,
  fields,
  joinRows,
  queryRows,
  reconcile,
  relationCardinality,
} from "../lab/relational-database/model.mjs";

function preset() {
  const db = coreDatabase();
  db.query.join = "relations";
  db.relations.forEach((r) => (r.mode = "inner"));
  return db;
}

test("classroom example expands every table and applies the requested defaults", () => {
  const db = validateDatabase(learningPreset());
  assert.deepEqual(
    db.tables.map((t) => t.rows.length),
    [24, 36, 7],
  );
  assert.deepEqual(
    db.tables[0].rows.slice(0, 3),
    coreDatabase().tables[0].rows,
  );
  assert.deepEqual(
    db.tables[1].rows.slice(0, 2),
    coreDatabase().tables[1].rows.filter((row) => row.values.sid !== "S02"),
  );
  assert.deepEqual(
    db.tables[2].rows.slice(0, 2),
    coreDatabase().tables[2].rows,
  );
  const output = queryRows(db);
  assert.equal(output.joined.rows.length, 39);
  assert.deepEqual(
    output.visible.map((f) => f.key),
    [
      "student/sid",
      "student/name",
      "membership/cid",
      "club/name",
      "club/advisor",
    ],
  );
  assert.equal(output.result.length, 6);
  assert.ok(output.result.every((row) => row["club/name"] === "将棋部"));
  assert.equal(db.query.distinct, false);
  for (const row of db.tables[1].rows) {
    assert.ok(
      db.tables[0].rows.some(
        (student) => student.values.sid === row.values.sid,
      ),
    );
    assert.ok(
      db.tables[2].rows.some((club) => club.values.cid === row.values.cid),
    );
  }
  db.query.hidden = fields(db)
    .map((f) => f.key)
    .filter((key) => key !== "student/name");
  db.query.distinct = true;
  assert.equal(queryRows(db).projected.length, 24);
  db.query.filters[0].value = "科学部";
  assert.equal(queryRows(db).result.length, 8);
});

test("preset keeps three nonmembers in a student-based join, including S02", () => {
  const db = learningPreset();
  const nonmembers = joinRows(db).rows.filter(
    (row) => row["membership/sid"] === null,
  );
  assert.deepEqual(
    nonmembers.map((row) => row["student/sid"]),
    ["S02", "S19", "S22"],
  );
  assert.ok(
    nonmembers.every(
      (row) => row["membership/cid"] === null && row["club/name"] === null,
    ),
  );
  db.query.filters = [
    { id: "nonmembers", key: "club/name", op: "empty", value: "" },
  ];
  assert.equal(queryRows(db).result.length, 3);
  db.query.base = "membership";
  assert.equal(joinRows(db).rows.length, 36);
  assert.equal(queryRows(db).result.length, 0);
});
test("preset retains the empty literature club only when based on clubs", () => {
  const db = learningPreset();
  assert.ok(!db.tables[1].rows.some((row) => row.values.cid === "C07"));
  assert.ok(!joinRows(db).rows.some((row) => row["club/cid"] === "C07"));
  db.query.base = "club";
  const joined = joinRows(db);
  assert.equal(joined.rows.length, 37);
  const club = joined.rows.find((row) => row["club/cid"] === "C07");
  assert.equal(club["club/name"], "文芸部");
  assert.equal(club["membership/sid"], null);
  assert.equal(club["student/name"], null);
  db.query.filters = [
    { id: "empty_club", key: "student/sid", op: "empty", value: "" },
  ];
  assert.deepEqual(
    queryRows(db).result.map((row) => row["club/cid"]),
    ["C07"],
  );
});

test("seed database reproduces matching rows and the composite key", () => {
  const db = validateDatabase(preset()),
    output = queryRows(db);
  assert.deepEqual(relationCardinality(db, db.relations[0]), ["1", "多"]);
  assert.deepEqual(relationCardinality(db, db.relations[1]), ["多", "1"]);
  assert.equal(output.joined.columns.length, 7);
  assert.deepEqual(
    output.result.map((r) => [
      r["student/name"],
      r["club/name"],
      r["club/advisor"],
    ]),
    [
      ["青木 太郎", "科学部", "後藤"],
      ["伊藤 花子", "将棋部", "高橋"],
      ["伊藤 花子", "科学部", "後藤"],
      ["加藤 翔太", "将棋部", "高橋"],
    ],
  );
  assert.deepEqual(
    db.tables[1].columns.filter((c) => c.primary).map((c) => c.id),
    ["sid", "cid"],
  );
});
test("saved unedited samples upgrade while custom rows and query settings survive", () => {
  const old = learningPreset();
  old.tables[1].rows.push(
    { id: "m2", values: { sid: "S02", cid: "C01" } },
    { id: "m3", values: { sid: "S02", cid: "C02" } },
    { id: "m35", values: { sid: "S19", cid: "C04" } },
    { id: "m38", values: { sid: "S22", cid: "C01" } },
  );
  old.tables[1].rows.sort(
    (a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)),
  );
  old.tables[2].rows.pop();
  const previousNamed = clone(old);
  old.tables[1].name = "所属";
  old.occurrences[1].name = "所属";
  old.tables[0].rows.forEach((row) => {
    row.values.name = row.values.name.split(" ")[0];
  });
  delete old.query.join;
  delete old.query.order;
  old.query.base = "club";
  old.query.hidden = ["student/name"];
  const custom = clone(old);
  custom.tables[0].rows[0].values.name = "自分の名前";
  upgradeDatabase(old);
  assert.equal(old.tables[1].rows.length, 36);
  assert.equal(old.tables[2].rows.length, 7);
  assert.equal(old.tables[1].name, "部員");
  assert.equal(old.occurrences[1].name, "部員");
  assert.equal(old.tables[0].rows[0].values.name, "青木 太郎");
  assert.equal(old.query.base, "club");
  assert.deepEqual(old.query.hidden, ["student/name"]);
  assert.equal(old.query.join, "left");
  assert.deepEqual(old.query.order, []);
  upgradeDatabase(previousNamed);
  assert.equal(previousNamed.tables[1].rows.length, 36);
  assert.equal(
    joinRows(previousNamed).rows.find((row) => row["student/sid"] === "S02")[
      "club/name"
    ],
    null,
  );
  upgradeDatabase(custom);
  assert.equal(custom.tables[0].rows[0].values.name, "自分の名前");
  assert.equal(custom.tables[1].name, "所属");
});
test("projection preserves duplicate rows and hidden fields for selection", () => {
  const db = preset();
  db.query.hidden = fields(db)
    .map((f) => f.key)
    .filter((key) => key !== "student/name");
  assert.deepEqual(
    queryRows(db).projected.map((r) => r["student/name"]),
    ["青木 太郎", "伊藤 花子", "伊藤 花子", "加藤 翔太"],
  );
  db.query.filters = [
    { id: "f1", key: "club/name", op: "eq", value: "科学部" },
  ];
  assert.deepEqual(
    queryRows(db).result.map((r) => r["student/name"]),
    ["青木 太郎", "伊藤 花子"],
  );
  assert.equal(queryRows(db).visible.length, 1);
});
test("optional distinct uses displayed columns and does not discard hidden matches", () => {
  const db = preset();
  db.query.hidden = fields(db)
    .map((f) => f.key)
    .filter((key) => key !== "student/name");
  db.query.distinct = true;
  assert.equal(queryRows(db).projected.length, 3);
  // 伊藤's first row is 将棋部. Deduplicating before filtering would lose 科学部.
  db.query.filters = [
    { id: "f1", key: "club/name", op: "eq", value: "科学部" },
  ];
  assert.deepEqual(
    queryRows(db).result.map((r) => r["student/name"]),
    ["青木 太郎", "伊藤 花子"],
  );
  db.query.hidden = fields(db).map((f) => f.key);
  assert.equal(queryRows(db).result.length, 1);
});
test("no primary key permits duplicates; optional, composite and required constraints", () => {
  const table = clone(preset().tables[1]);
  assert.doesNotThrow(() => validateTable(table));
  table.rows.push({ id: "duplicate", values: { sid: "S02", cid: "C01" } });
  assert.throws(() => validateTable(table), /主キーが重複/);
  table.columns.forEach((c) => {
    c.primary = false;
    c.required = false;
  });
  assert.doesNotThrow(() => validateTable(table));
  table.rows[0].values.sid = null;
  assert.doesNotThrow(() => validateTable(table));
  table.columns[0].required = true;
  assert.throws(() => validateTable(table), /必須なので/);
  table.columns[0].primary = true;
  assert.throws(() => validateTable(table), /主キーなので/);
});
test("typed cells and schema names are validated without coercing stored data", () => {
  const c = { name: "得点", type: "number" };
  assert.equal(parseCell("-12.5", c), -12.5);
  assert.equal(parseCell("", c), null);
  for (const value of ["abc", "Infinity", "   "])
    assert.throws(() => parseCell(value, c), /有限/);
  const db = preset();
  db.tables[0].columns[1].name = "学生ID";
  assert.throws(() => validateDatabase(db), /列名が重複/);
  const number = preset();
  number.tables[0].columns[0].type = "number";
  assert.throws(() => validateDatabase(number), /値が不正/);
});
test("inner/outer joins treat null as missing and preserve departure rows", () => {
  const db = preset();
  db.tables[0].rows.push({ id: "s4", values: { sid: "S04", name: "田中" } });
  assert.equal(joinRows(db).rows.length, 4);
  db.relations.forEach((r) => (r.mode = "left"));
  assert.equal(joinRows(db).rows.length, 5);
  assert.equal(joinRows(db).rows.at(-1)["club/name"], null);
  db.query.filters = [{ id: "f1", key: "club/name", op: "empty", value: "" }];
  assert.deepEqual(
    queryRows(db).result.map((r) => r["student/name"]),
    ["田中"],
  );
  db.query.base = "club";
  assert.equal(joinRows(db).rows.length, 4);
  const nullable = preset();
  nullable.tables[0].columns[0].primary = false;
  nullable.tables[0].columns[0].required = false;
  nullable.tables[1].columns.forEach((c) => {
    c.primary = false;
    c.required = false;
  });
  nullable.tables[0].rows[0].values.sid = null;
  nullable.tables[1].rows[0].values.sid = null;
  assert.equal(joinRows(validateDatabase(nullable)).rows.length, 3);
});
test("multiple equality pairs support composite joins and repeated table occurrences", () => {
  const db = preset();
  db.occurrences.push({
    id: "copy",
    table: "memberships",
    name: "所属 2",
    x: 24,
    y: 300,
  });
  db.relations.push({
    id: "r3",
    left: "membership",
    right: "copy",
    mode: "inner",
    pairs: [
      { left: "sid", right: "sid" },
      { left: "cid", right: "cid" },
    ],
  });
  assert.equal(joinRows(validateDatabase(db)).rows.length, 4);
  db.relations[2].pairs.pop();
  assert.equal(joinRows(db).rows.length, 6);
  db.tables[1].rows[0].values.cid = "C01";
  assert.equal(joinRows(db).rows[0]["copy/cid"], "C01");
});
test("relations reject mismatched types, cycles, missing and repeated pairs", () => {
  const db = preset();
  db.relations.push({
    id: "r3",
    left: "student",
    right: "club",
    mode: "inner",
    pairs: [{ left: "sid", right: "cid" }],
  });
  assert.throws(() => validateDatabase(db), /輪/);
  const types = preset();
  types.tables[2].columns[1].type = "number";
  types.tables[2].rows.forEach((r) => (r.values.name = 1));
  types.relations[1].pairs[0].right = "name";
  assert.throws(() => validateDatabase(types), /同じ型/);
  const duplicate = preset();
  duplicate.relations[0].pairs.push({ left: "sid", right: "sid" });
  assert.throws(() => validateDatabase(duplicate), /対応が重複/);
  duplicate.relations[0].pairs = [{ left: "missing", right: "sid" }];
  assert.throws(() => validateDatabase(duplicate), /列が見つかりません/);
});
test("selection supports typed comparisons, text search, AND/OR and missing values", () => {
  const db = preset();
  db.tables[0].columns.push({
    id: "score",
    name: "得点",
    type: "number",
    required: false,
    primary: false,
  });
  [60, 80, null].forEach((v, i) => (db.tables[0].rows[i].values.score = v));
  db.query.filters = [
    { id: "f1", key: "student/score", op: "ge", value: "70" },
  ];
  assert.equal(queryRows(validateDatabase(db)).result.length, 2);
  db.query.filters.push({
    id: "f2",
    key: "club/name",
    op: "contains",
    value: "科学",
  });
  assert.equal(queryRows(db).result.length, 1);
  db.query.match = "any";
  assert.equal(queryRows(db).result.length, 3);
  db.query.filters = [
    { id: "f1", key: "student/score", op: "ne", value: "60" },
  ];
  assert.equal(queryRows(db).result.length, 2);
  db.query.filters[0].value = "";
  assert.equal(queryRows(db).result.length, 4);
  db.query.filters[0].value = "wrong";
  assert.throws(() => queryRows(db), /有限/);
  db.query.filters[0].op = "contains";
  assert.throws(() => validateDatabase(db), /文字の検索/);
});
test("disconnected occurrences and their conditions are explicitly excluded", () => {
  const db = preset();
  db.relations = [];
  db.query.filters = [
    { id: "f1", key: "club/name", op: "eq", value: "科学部" },
  ];
  const output = queryRows(db);
  assert.equal(output.result.length, 3);
  assert.equal(output.inactiveFilters, 1);
  assert.equal(output.activeFilters, 0);
});
test("intentional schema deletion reconciles references, but imports fail intact", () => {
  const db = preset();
  db.query.hidden = ["student/sid"];
  db.query.filters = [{ id: "f1", key: "student/sid", op: "eq", value: "S01" }];
  db.tables[0].columns.shift();
  assert.throws(() => validateDatabase(db), /列が見つかりません/);
  reconcile(db);
  validateDatabase(db);
  assert.equal(db.relations.length, 1);
  assert.deepEqual(db.query.hidden, []);
  assert.deepEqual(db.query.filters, []);
  db.tables = [];
  reconcile(db);
  const expected = emptyDatabase();
  expected.query.join = "relations";
  assert.deepEqual(validateDatabase(db), expected);
});
test("result overflow fails clearly and never returns a partial result", () => {
  const db = emptyDatabase();
  db.tables = [
    {
      id: "a",
      name: "A",
      columns: [
        {
          id: "k",
          name: "キー",
          type: "text",
          required: false,
          primary: false,
        },
      ],
      rows: Array.from({ length: 100 }, (_, i) => ({
        id: `r${i}`,
        values: { k: "same" },
      })),
    },
  ];
  db.occurrences = [
    { id: "a1", name: "A 1", table: "a", x: 0, y: 0 },
    { id: "a2", name: "A 2", table: "a", x: 300, y: 0 },
  ];
  db.query.base = "a1";
  db.relations = [
    {
      id: "r1",
      left: "a1",
      right: "a2",
      mode: "inner",
      pairs: [{ left: "k", right: "k" }],
    },
  ];
  validateDatabase(db);
  assert.throws(() => joinRows(db), /2000行を超え/);
});
test("file format rejects unsupported versions, dangerous identifiers and broken query state", () => {
  for (const mutation of [
    (db) => (db.version = 2),
    (db) => (db.tables[0].id = "__proto__"),
    (db) => (db.query.base = "missing"),
    (db) => (db.query.hidden = ["missing/key"]),
    (db) => (db.occurrences[0].x = -1),
    (db) =>
      (db.query.filters = [
        { id: "f1", key: "student/sid", op: "invented", value: "" },
      ]),
  ]) {
    const db = preset();
    mutation(db);
    assert.throws(() => validateDatabase(db));
  }
  assert.doesNotThrow(() =>
    validateDatabase(JSON.parse(JSON.stringify(preset()))),
  );
});
test("Lab, metadata and sitemap expose the new material", async () => {
  const base = new URL("../", import.meta.url),
    home = await readFile(new URL("lab/index.html", base), "utf8"),
    html = await readFile(
      new URL("lab/relational-database/index.html", base),
      "utf8",
    ),
    sitemap = await readFile(new URL("sitemap.xml", base), "utf8");
  assert.match(
    home,
    /id="data-database"[\s\S]*href="\.\/relational-database\/"/,
  );
  assert.match(html, /og:image/);
  assert.match(html, /after-interactive-lab-main/);
  assert.match(
    sitemap,
    /https:\/\/mei-chan-nel.com\/lab\/relational-database\//,
  );
});

test("layout base uses left joins and keeps unmatched rows when the base changes", () => {
  const db = learningPreset();
  db.query.filters = [];
  db.tables[0].rows.push({
    id: "s25",
    values: { sid: "S25", name: "小川 誠" },
  });
  const students = joinRows(validateDatabase(db));
  assert.equal(students.rows.length, 40);
  assert.equal(students.rows.at(-1)["membership/sid"], null);
  assert.equal(students.rows.at(-1)["club/name"], null);
  db.query.base = "club";
  const clubs = joinRows(db);
  assert.equal(clubs.rows.length, 37);
  assert.equal(clubs.columns[0].key, "club/cid");
  db.tables[2].rows.push({
    id: "c8",
    values: { cid: "C08", name: "書道部", advisor: "小川" },
  });
  assert.equal(joinRows(db).rows.length, 38);
  assert.equal(joinRows(db).rows.at(-1)["student/name"], null);
  db.query.base = "membership";
  assert.equal(joinRows(db).rows.length, 36);
});
test("column order survives projection, base changes, serialization and column removal", () => {
  const db = learningPreset();
  db.query.order = ["club/advisor", "student/name", "student/sid"];
  assert.deepEqual(
    joinRows(db)
      .columns.slice(0, 3)
      .map((f) => f.key),
    db.query.order,
  );
  assert.equal(queryRows(db).visible[0].key, "club/advisor");
  db.query.base = "club";
  assert.deepEqual(
    joinRows(db)
      .columns.slice(0, 3)
      .map((f) => f.key),
    db.query.order,
  );
  assert.deepEqual(
    queryRows(validateDatabase(JSON.parse(JSON.stringify(db))))
      .visible.slice(0, 3)
      .map((f) => f.key),
    db.query.order,
  );
  db.tables[2].columns = db.tables[2].columns.filter((c) => c.id !== "advisor");
  reconcile(db);
  validateDatabase(db);
  assert.deepEqual(db.query.order, ["student/name", "student/sid"]);
  db.query.order = ["student/name", "student/name"];
  assert.throws(() => validateDatabase(db), /並び順/);
  db.query.order = ["missing/key"];
  assert.throws(() => validateDatabase(db), /並び順/);
});

test("row sorting compares numbers, retains tied rows and places blanks last in either direction", () => {
  const db = coreDatabase();
  db.tables[0].columns.push({
    id: "score",
    name: "得点",
    type: "number",
    primary: false,
    required: false,
  });
  db.tables[0].rows.forEach(
    (row, index) => (row.values.score = [12, 2, null][index]),
  );
  db.tables[0].rows.push({
    id: "s4",
    values: { sid: "S04", name: "小川 誠", score: 2 },
  });
  db.query.sort = { key: "student/score", direction: "asc" };
  const original = clone(db.tables);
  const ascending = queryRows(validateDatabase(db)).result;
  assert.deepEqual(
    ascending.map((row) => row["student/score"]),
    [2, 2, 2, 12, null],
  );
  assert.deepEqual(
    ascending.slice(0, 3).map((row) => row["student/sid"]),
    ["S02", "S02", "S04"],
  );
  db.query.sort.direction = "desc";
  assert.deepEqual(
    queryRows(db).result.map((row) => row["student/score"]),
    [12, 2, 2, 2, null],
  );
  assert.deepEqual(db.tables, original);
  db.query.hidden = fields(db)
    .map((f) => f.key)
    .filter((key) => key !== "student/name");
  db.query.distinct = true;
  db.query.sort.direction = "asc";
  db.query.filters = [
    { id: "science", key: "club/name", op: "eq", value: "科学部" },
  ];
  assert.deepEqual(
    queryRows(db).result.map((row) => row["student/name"]),
    ["伊藤 花子", "青木 太郎"],
  );
});

test("row sorting uses natural text order and preserves saved settings and disconnected data", () => {
  const db = coreDatabase();
  db.query.sort = { key: "student/sid", direction: "asc" };
  db.tables[0].rows.forEach(
    (row, index) => (row.values.sid = ["学生2", "学生10", "学生1"][index]),
  );
  assert.deepEqual(
    queryRows(validateDatabase(db)).result.map((row) => row["student/sid"]),
    ["学生1", "学生2", "学生10"],
  );
  assert.deepEqual(
    validateDatabase(JSON.parse(JSON.stringify(db))).query.sort,
    db.query.sort,
  );
  db.query.base = "club";
  db.relations = [];
  assert.deepEqual(
    queryRows(db).result.map((row) => row["club/name"]),
    ["将棋部", "科学部"],
  );
  db.tables[0].columns.shift();
  reconcile(db);
  assert.equal(db.query.sort, null);
});

test("invalid sort imports fail and older saved files gain the unsorted default", () => {
  for (const sort of [
    { key: "missing/field", direction: "asc" },
    { key: "student/sid", direction: "other" },
    [null],
    "asc",
  ]) {
    const db = coreDatabase();
    db.query.sort = sort;
    assert.throws(() => validateDatabase(db), /行の整列/);
  }
  const old = coreDatabase();
  delete old.query.sort;
  assert.equal(upgradeDatabase(validateDatabase(old)).query.sort, null);
});

test("successive stable sorts keep the previous order inside the newest equal-value groups", () => {
  const db = coreDatabase();
  db.tables[0].columns.push(
    {
      id: "score",
      name: "得点",
      type: "number",
      required: false,
      primary: false,
    },
    { id: "group", name: "組", type: "text", required: false, primary: false },
  );
  db.tables[0].rows.forEach((row, index) =>
    Object.assign(row.values, {
      score: [30, 20, 20][index],
      group: ["A", "B", "A"][index],
    }),
  );
  db.tables[0].rows.push({
    id: "s4",
    values: { sid: "S04", name: "小川 誠", score: 10, group: "B" },
  });
  db.query.sort = [{ key: "student/score", direction: "desc" }];
  assert.deepEqual(
    queryRows(db).result.map((row) => row["student/sid"]),
    ["S01", "S02", "S02", "S03", "S04"],
  );
  db.query.sort.unshift({ key: "student/group", direction: "asc" });
  assert.deepEqual(
    queryRows(validateDatabase(db)).result.map((row) => row["student/sid"]),
    ["S01", "S03", "S02", "S02", "S04"],
  );
  const restored = validateDatabase(JSON.parse(JSON.stringify(db)));
  assert.deepEqual(queryRows(restored).result, queryRows(db).result);
  db.query.sort = null;
  assert.deepEqual(
    queryRows(db).result.map((row) => row["student/sid"]),
    ["S01", "S02", "S02", "S03", "S04"],
  );
  db.query.sort = [
    { key: "student/score", direction: "asc" },
    { key: "student/score", direction: "desc" },
  ];
  assert.throws(() => validateDatabase(db), /行の整列/);
  db.query.sort = [
    { key: "student/group", direction: "asc" },
    { key: "student/score", direction: "desc" },
  ];
  db.tables[0].columns = db.tables[0].columns.filter((c) => c.id !== "score");
  reconcile(db);
  assert.deepEqual(db.query.sort, [{ key: "student/group", direction: "asc" }]);
});

import {
  LIMITS,
  OPERATORS,
  clone,
  uid,
  keyOf,
  learningPreset,
  upgradeDatabase,
  emptyDatabase,
  parseCell,
  validateTable,
  validateDatabase,
  reconcile,
  resolveField,
  fields,
  joinRows,
  queryRows,
  distinctRows,
  sortCriteria,
  relationCardinality,
} from "./model.mjs";

const $ = (id) => document.getElementById(id);
const esc = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
const STORAGE = "study-atlas-relational-database-v1";
let db = learningPreset(),
  currentTable = "students",
  step = 1,
  selectedField = null,
  schemaTable = null,
  relationTarget = null,
  cardTarget = null;
let history = [],
  future = [],
  canStore = true;
let graphScale = 1;
let needsInitialLayout = true;
function status(message, error = false) {
  $("db-status").textContent = message;
  $("db-status").classList.toggle("is-error", error);
}
function errorAt(id, error) {
  $(id).textContent = error?.message ?? String(error ?? "");
  $(id).hidden = !error;
}
function save() {
  try {
    localStorage.setItem(STORAGE, JSON.stringify(db));
  } catch {
    canStore = false;
    status("自動保存が使えません。「保存」からファイルに書き出せます。", true);
  }
}
try {
  const saved = localStorage.getItem(STORAGE);
  if (saved) {
    db = upgradeDatabase(validateDatabase(JSON.parse(saved)));
    currentTable = db.tables[0]?.id ?? "";
    needsInitialLayout =
      db.occurrences.length === 3 &&
      db.occurrences.every(
        (o, i) => o.x === [24, 332, 640][i] && o.y === [32, 64, 32][i],
      );
    status("前の作業を復元しました。プリセットは「読み込み」から選べます。");
  }
} catch {
  status("前の作業を読み込めなかったため、プリセットを表示しています。", true);
}

function focusToken() {
  const el = document.activeElement;
  if (!el || el === document.body) return null;
  if (el.id) return { selector: `#${el.id}` };
  for (const attr of [
    "data-field",
    "data-handle",
    "data-projection",
    "data-table",
    "data-cell",
    "data-column-drag",
    "data-sort-column",
    "data-edit-relation",
  ])
    if (el.hasAttribute(attr))
      return {
        selector: `[${attr}="${el.getAttribute(attr)}"]${attr === "data-sort-column" ? `[data-direction="${el.dataset.direction}"]` : ""}`,
      };
  return null;
}
function commit(
  next,
  message = "変更を自動保存しました。",
  preserveFilters = false,
  preserveTable = false,
) {
  validateDatabase(next);
  const token = focusToken();
  history.push(clone(db));
  if (history.length > 50) history.shift();
  future = [];
  db = next;
  if (selectedField && !fields(db).some((f) => f.key === selectedField))
    selectedField = null;
  save();
  render(preserveFilters, preserveTable);
  if (canStore) status(message);
  if (token) {
    const target = document.querySelector(token.selector);
    target?.focus({ preventScroll: true });
  }
}
function attempt(fn) {
  try {
    fn();
  } catch (e) {
    status(e.message, true);
  }
}
function confirmChange(message, label = "変更する") {
  return new Promise((resolve) => {
    $("confirm-message").textContent = message;
    $("confirm-ok").textContent = label;
    const dialog = $("confirm-dialog");
    dialog.returnValue = "";
    dialog.addEventListener(
      "close",
      () => resolve(dialog.returnValue === "ok"),
      { once: true },
    );
    dialog.showModal();
  });
}
function options(items, value, label = (item) => item.name) {
  return items
    .map(
      (item) =>
        `<option value="${esc(item.id)}"${item.id === value ? " selected" : ""}>${esc(label(item))}</option>`,
    )
    .join("");
}
function cell(value) {
  return value === null
    ? '<span class="db-null" title="値なし（NULL）">空欄</span>'
    : esc(value);
}
function columnHandle(field) {
  return `<button type="button" class="db-column-drag" data-column-drag="${field.key}" aria-label="${esc(field.label)}の列を並べ替える" aria-describedby="result-reorder-hint" title="ドラッグ、または矢印キーで並べ替え"><svg viewBox="0 0 16 20" aria-hidden="true"><g fill="currentColor"><circle cx="5" cy="4" r="1.5"/><circle cx="11" cy="4" r="1.5"/><circle cx="5" cy="10" r="1.5"/><circle cx="11" cy="10" r="1.5"/><circle cx="5" cy="16" r="1.5"/><circle cx="11" cy="16" r="1.5"/></g></svg></button>`;
}
function rowSortButtons(field) {
  const sort = sortCriteria(db.query.sort).find(
    (sort) => sort.key === field.key,
  );
  return `<div class="db-header-sort" role="group" aria-label="${esc(field.label)}で行を整列">${["asc", "desc"].map((direction) => `<button type="button" data-sort-column="${field.key}" data-direction="${direction}" aria-label="${esc(field.label)}を${direction === "asc" ? "昇順" : "降順"}に整列" title="${direction === "asc" ? "昇順（小さい順）" : "降順（大きい順）"}" aria-pressed="${sort?.direction === direction}">${direction === "asc" ? "↑" : "↓"}</button>`).join("")}</div>`;
}
function displayTable(
  columns,
  rows,
  caption,
  editable = false,
  reorder = false,
  sortable = false,
) {
  if (!columns.length)
    return `<p class="db-empty">表示する列がありません。${rows.length}行のデータを保持しています。</p>`;
  const headings = columns
    .map(
      (f) =>
        `<th scope="col"${reorder ? ` data-column-slot="${f.key}" class="db-draggable-heading"` : sortable ? ' class="db-sortable-heading"' : ""}>${reorder || sortable ? '<div class="db-column-head"><span>' : ""}${esc(f.column.name)}${f.occurrence ? `<small>${esc(f.occurrence.name)}</small>` : ""}${reorder || sortable ? `</span>${reorder ? columnHandle(f) : rowSortButtons(f)}</div>` : ""}</th>`,
    )
    .join("");
  const body = rows
    .map(
      (row, index) =>
        `<tr>${columns
          .map((f) =>
            editable
              ? `<td class="db-editable-cell"><input class="db-cell-input" type="text" data-cell="${esc(row._id)}/${f.column.id}" data-row="${esc(row._id)}" data-column="${f.column.id}" value="${esc(row[f.key] ?? "")}" maxlength="200" placeholder="空欄" aria-label="${esc(caption)} ${index + 1}行目の${esc(f.column.name)}" aria-describedby="table-error"${f.column.type === "number" ? ' inputmode="decimal"' : ""} /></td>`
              : `<td>${cell(row[f.key])}</td>`,
          )
          .join(
            "",
          )}${editable ? `<td class="db-delete-column"><button type="button" class="db-row-delete" data-delete-row="${esc(row._id)}" aria-label="${index + 1}行目を削除" title="${index + 1}行目を削除">×</button></td>` : ""}</tr>`,
    )
    .join("");
  return `<table><caption class="visually-hidden">${esc(caption)}</caption><thead><tr>${headings}${editable ? '<th scope="col" class="db-delete-column"><span class="visually-hidden">行を削除</span></th>' : ""}</tr></thead><tbody>${body}</tbody></table>${rows.length ? "" : '<p class="db-empty">該当する行はありません。</p>'}`;
}
function renderTables() {
  if (!db.tables.some((t) => t.id === currentTable))
    currentTable = db.tables[0]?.id ?? "";
  $("table-list").innerHTML = db.tables
    .map(
      (t) =>
        `<button type="button" data-table="${t.id}" aria-pressed="${t.id === currentTable}">${esc(t.name)} <small>· ${t.rows.length}行</small></button>`,
    )
    .join("");
  $("add-table").disabled = db.tables.length >= LIMITS.tables;
  const table = db.tables.find((t) => t.id === currentTable);
  if (!table) {
    $("table-editor").innerHTML =
      '<p class="db-empty">「テーブルを作成」から、列を定義してみましょう。</p>';
    return;
  }
  const primary = table.columns.filter((c) => c.primary);
  $("table-editor").innerHTML =
    `<div class="db-section-heading"><div><h2>${esc(table.name)}</h2><p>${table.columns.length}列 · ${table.rows.length}行 · ${primary.length ? `主キー：${primary.map((c) => esc(c.name)).join(" ＋ ")}` : "主キーなし"}</p></div><div class="db-actions"><button type="button" id="edit-schema">列・主キーを定義</button><button type="button" id="delete-table" class="db-quiet-button" title="テーブルを削除">テーブルを削除</button><button type="button" id="add-row" class="db-primary"${table.rows.length >= LIMITS.rows ? " disabled" : ""}>＋ 行を追加</button></div></div><div class="db-definition">${table.columns.map((c) => `<span>${esc(c.name)} · ${c.type === "number" ? "数値" : "文字"}${c.primary ? " · 主キー" : c.required ? " · 必須" : ""}</span>`).join("")}</div><p id="table-error" class="db-error" role="alert" hidden></p><div class="db-table-scroll" tabindex="0" role="region" aria-label="${esc(table.name)}のデータ">${displayTable(
      table.columns.map((c) => ({ column: c, key: c.id })),
      table.rows.map((r) => ({ ...r.values, _id: r.id })),
      `${table.name}のデータ`,
      true,
    )}</div>`;
}
function arrangeCards(state) {
  const width = Math.max(924, $("graph-scroll").clientWidth);
  const count = Math.max(
    1,
    Math.min(state.occurrences.length, Math.floor((width - 48 + 64) / 302)),
  );
  const gap = count > 1 ? (width - 48 - 238) / (count - 1) : 0;
  const height = Math.max(
    166,
    ...state.tables.map((t) => 62 + t.columns.length * 38),
  );
  state.occurrences.forEach((o, index) => {
    o.x = Math.round(24 + (index % count) * gap);
    o.y = Math.min(1600, 32 + Math.floor(index / count) * (height + 70));
  });
}
function connectedCards() {
  const used = new Set(db.query.base ? [db.query.base] : []);
  let changed = true;
  while (changed) {
    changed = false;
    for (const r of db.relations) {
      if (used.has(r.left) !== used.has(r.right)) {
        used.add(used.has(r.left) ? r.right : r.left);
        changed = true;
      }
    }
  }
  return used;
}
function renderGraph() {
  if (needsInitialLayout && $("graph-scroll").clientWidth) {
    arrangeCards(db);
    needsInitialLayout = false;
  }
  const connected = new Set(
    db.relations.flatMap((r) =>
      r.pairs.flatMap((p) => [keyOf(r.left, p.left), keyOf(r.right, p.right)]),
    ),
  );
  $("occurrence-cards").innerHTML = db.occurrences
    .map((o) => {
      const t = db.tables.find((t) => t.id === o.table);
      return `<section class="db-card${o.id === db.query.base ? " is-base" : ""}" data-card="${o.id}" style="left:${o.x}px;top:${o.y}px" aria-label="${esc(o.name)}のカード"><div class="db-card-head"><button type="button" class="db-card-handle" data-handle="${o.id}" aria-label="${esc(o.name)}を移動（矢印キー）">${esc(o.name)}<span>元の表：${esc(t.name)} · ${t.rows.length}行${o.id === db.query.base ? " · 基準" : ""}</span></button><button type="button" class="db-card-action" data-rename-card="${o.id}" aria-label="${esc(o.name)}のカード名を変更">✎</button><button type="button" class="db-card-action" data-remove-card="${o.id}" aria-label="${esc(o.name)}のカードを削除">×</button></div>${t.columns
        .map((c) => {
          const key = keyOf(o.id, c.id);
          return `<button type="button" class="db-field${connected.has(key) ? " is-connected" : ""}" data-field="${key}" aria-pressed="${selectedField === key}"><span>${c.primary ? "🔑 " : ""}${esc(c.name)}</span><small>${c.type === "number" ? "数値" : "文字"}</small></button>`;
        })
        .join("")}</section>`;
    })
    .join("");
  sizeGraph();
  requestAnimationFrame(drawLines);
  $("field-selection").textContent = selectedField
    ? `${fields(db).find((f) => f.key === selectedField)?.label ?? ""}を選びました。もう片方の列を選んでください。同じ列で解除できます。`
    : "";
  $("relation-list").innerHTML = db.relations
    .map(
      (r) =>
        `<div class="db-relation"><span>${r.pairs.map((p) => `${esc(resolveField(db, r.left, p.left).label)} ＝ ${esc(resolveField(db, r.right, p.right).label)}`).join("<br />")}<small>一致する値で対応づける · 現在のデータ ${relationCardinality(db, r).join(" 対 ")}</small></span><div class="db-actions"><button type="button" data-edit-relation="${r.id}" aria-label="${esc(db.occurrences.find((o) => o.id === r.left).name)}と${esc(db.occurrences.find((o) => o.id === r.right).name)}の関係を編集">編集</button><button type="button" data-delete-relation="${r.id}" aria-label="関係${esc(r.id)}を削除">削除</button></div></div>`,
    )
    .join("");
}
function sizeGraph() {
  const width = Math.max(
    924,
    $("graph-scroll").clientWidth,
    ...db.occurrences.map((o) => o.x + 262),
  );
  const height = Math.max(
    278,
    ...db.occurrences.map(
      (o) =>
        o.y + 90 + db.tables.find((t) => t.id === o.table).columns.length * 40,
    ),
  );
  $("relation-graph").style.width = `${width}px`;
  $("relation-graph").style.height = `${height}px`;
  $("relation-graph").style.transform = `scale(${graphScale})`;
  $("graph-frame").style.width = `${width * graphScale}px`;
  $("graph-frame").style.height = `${height * graphScale}px`;
  $("graph-zoom").textContent = `${Math.round(graphScale * 100)}%`;
}
function drawLines() {
  const graph = $("relation-graph").getBoundingClientRect();
  if (!graph.width) return;
  $("relation-lines").innerHTML = db.relations
    .flatMap((r) =>
      r.pairs.map((p, index) => {
        const a = document
            .querySelector(`[data-field="${keyOf(r.left, p.left)}"]`)
            ?.getBoundingClientRect(),
          b = document
            .querySelector(`[data-field="${keyOf(r.right, p.right)}"]`)
            ?.getBoundingClientRect();
        if (!a || !b) return "";
        const rightward = (a.left + a.right) / 2 <= (b.left + b.right) / 2;
        const x1 = ((rightward ? a.right : a.left) - graph.left) / graphScale,
          x2 = ((rightward ? b.left : b.right) - graph.left) / graphScale,
          y1 = ((a.top + a.bottom) / 2 - graph.top) / graphScale,
          y2 = ((b.top + b.bottom) / 2 - graph.top) / graphScale,
          bend = Math.max(35, Math.abs(x2 - x1) / 2) * (rightward ? 1 : -1);
        const cardinality = relationCardinality(db, r),
          direction = rightward ? 1 : -1;
        return `<path class="db-wire" d="M${x1},${y1} C${x1 + bend},${y1} ${x2 - bend},${y2} ${x2},${y2}"/><circle cx="${x1}" cy="${y1}" r="3.5" fill="#805000"/><circle cx="${x2}" cy="${y2}" r="3.5" fill="#805000"/>${index === 0 ? `<text class="db-cardinality" x="${x1 + direction * 17}" y="${y1 - 10}" text-anchor="middle">${cardinality[0]}</text><text class="db-cardinality" x="${x2 - direction * 17}" y="${y2 - 10}" text-anchor="middle">${cardinality[1]}</text>` : ""}`;
      }),
    )
    .join("");
}
function renderFilters(columns) {
  $("filter-list").innerHTML =
    db.query.filters
      .map((f) => {
        const field = fields(db).find((c) => c.key === f.key),
          available = columns.some((c) => c.key === f.key);
        const choices = Object.entries(OPERATORS).filter(
          ([op]) =>
            field.column.type === "text" ||
            !["contains", "starts"].includes(op),
        );
        const unary = ["empty", "filled"].includes(f.op);
        return `<div class="db-filter${unary ? " is-unary" : ""}" data-filter-row="${f.id}"><label>検索する列<select data-filter="${f.id}" data-property="key">${fields(
          db,
        )
          .map(
            (c) =>
              `<option value="${c.key}"${c.key === f.key ? " selected" : ""}>${esc(c.label)}${db.query.hidden.includes(c.key) ? "（非表示）" : ""}${columns.some((x) => x.key === c.key) ? "" : "（未結合）"}</option>`,
          )
          .join(
            "",
          )}</select></label><label>条件<select data-filter="${f.id}" data-property="op">${choices.map(([op, label]) => `<option value="${op}"${op === f.op ? " selected" : ""}>${label}</option>`).join("")}</select></label><label${unary ? " hidden" : ""}>値<input data-filter="${f.id}" data-property="value" type="text" value="${esc(f.value)}" maxlength="200"${field.column.type === "number" ? ' inputmode="decimal"' : ""}${unary || !available ? " disabled" : ""} /></label><button type="button" data-delete-filter="${f.id}" aria-label="検索条件を削除">削除</button></div>`;
      })
      .join("") ||
    '<p class="db-empty">条件なし：すべての行を表示します。「条件を追加」から絞り込めます。</p>';
}
function render(preserveFilters = false, preserveTable = false) {
  $("tables-view").hidden = step !== 1;
  $("query-view").hidden = step === 1;
  $("undo").disabled = !history.length;
  $("redo").disabled = !future.length;
  if (!preserveTable) renderTables();
  for (const n of [1, 2, 3, 4]) {
    document
      .querySelector(`[data-step="${n}"]`)
      .setAttribute("aria-pressed", n === step);
    if (n > 1)
      $(
        ["", "", "join-panel", "projection-panel", "selection-panel"][n],
      ).hidden = step !== n;
  }
  $("query-base").innerHTML =
    options(db.occurrences, db.query.base, (o) => {
      const t = db.tables.find((t) => t.id === o.table);
      return o.name === t.name ? o.name : `${o.name}（${t.name}）`;
    }) || '<option value="">カードなし</option>';
  const previous = $("occurrence-table").value;
  $("occurrence-table").innerHTML =
    options(db.tables, previous) || '<option value="">テーブルなし</option>';
  $("add-occurrence").disabled =
    !db.tables.length || db.occurrences.length >= LIMITS.occurrences;
  for (const id of ["add-relation", "add-relation-after"])
    $(id).disabled =
      db.occurrences.length < 2 || db.relations.length >= LIMITS.relations;
  const usedCards = connectedCards();
  $("join-add-hint").textContent =
    db.occurrences.length && db.occurrences.every((o) => usedCards.has(o.id))
      ? "今あるカードはすでにつながっています。結合を増やすには、上で別の表、または同じ表のカードを追加してください。"
      : "カードを追加したら、「＋ 結合を追加」でつなぐ列を選びましょう。";
  renderGraph();
  let joined;
  try {
    joined = joinRows(db);
  } catch (e) {
    joined = { columns: [], rows: [], used: [], steps: [] };
    errorAt("query-error", e);
  }
  $("reset-order").hidden = step !== 3 || !db.query.order?.length;
  const visible = joined.columns.filter(
    (f) => !db.query.hidden.includes(f.key),
  );
  $("projection-columns").innerHTML =
    joined.used
      .map(
        (id) =>
          `<fieldset><legend>${esc(db.occurrences.find((o) => o.id === id).name)}</legend>${fields(
            db,
          )
            .filter(
              (f) =>
                f.occurrence.id === id &&
                joined.columns.some((column) => column.key === f.key),
            )
            .map(
              (f) =>
                `<label class="db-check"><input type="checkbox" data-projection="${f.key}" aria-label="${esc(f.label)}を表示"${db.query.hidden.includes(f.key) ? "" : " checked"}/>${esc(f.column.name)}</label>`,
            )
            .join("")}</fieldset>`,
      )
      .join("") ||
    '<p class="db-empty">「結合」で基準のテーブルを追加してください。</p>';
  $("distinct-rows").checked = db.query.distinct;
  $("filter-match").value = db.query.match;
  $("add-filter").disabled =
    !joined.columns.length || db.query.filters.length >= LIMITS.filters;
  if (!preserveFilters) renderFilters(joined.columns);
  const activeSorts = sortCriteria(db.query.sort).filter((sort) =>
    joined.columns.some((field) => field.key === sort.key),
  );
  $("result-sort-hint").hidden = step !== 4;
  $("reset-sort").hidden = step !== 4 || !sortCriteria(db.query.sort).length;
  $("result-reorder-hint").hidden = step !== 3;
  const disconnected = db.occurrences.length - joined.used.length;
  $("join-summary").textContent =
    `${joined.used.length}枚のカードから${joined.rows.length}行。${joined.steps.map((s) => `${s.name}を結合：${s.before} → ${s.after}行`).join(" ／ ")}${disconnected ? ` 基準のテーブルとつながらない${disconnected}枚は結果に含めません。` : ""}`;
  $("result-heading").textContent = [
    "",
    "",
    "結合した表",
    "表示する列を選んだ表",
    "条件で絞り込んだ表",
  ][step];
  try {
    // At earlier steps, an unfinished selection must not hide the join preview.
    const calculation =
      step === 4
        ? queryRows(db)
        : {
            joined,
            visible,
            projected: db.query.distinct
              ? distinctRows(joined.rows, visible)
              : joined.rows,
          };
    const rows =
      step <= 2
        ? calculation.joined.rows
        : step === 3
          ? calculation.projected
          : calculation.result;
    const columns = step <= 2 ? joined.columns : visible;
    // Re-evaluate the join so result overflow is shown even outside the join step.
    joinRows(db);
    errorAt("query-error", null);
    $("result-count").textContent = `${rows.length}行 × ${columns.length}列`;
    $("result-table").innerHTML = displayTable(
      columns,
      rows,
      $("result-heading").textContent,
      false,
      step === 3,
      step === 4,
    );
    $("result-note").textContent =
      step <= 2
        ? "共通する値で行を対応づけています。次の「射影」で表示する列を選びます。"
        : step === 3
          ? `元の${joined.rows.length}行を保持。${db.query.distinct ? "表示する列の値が同じ行をまとめています。" : "重複する行も残しています。"}`
          : `${calculation.activeFilters}個の条件で${joined.rows.length} → ${calculation.selected.length}行${db.query.distinct ? ` → 重複除去後${rows.length}行` : ""}。${activeSorts.length ? `整列：${activeSorts.map((sort) => `${joined.columns.find((field) => field.key === sort.key).label}の${sort.direction === "asc" ? "昇順" : "降順"}`).join(" → ")}。` : ""}${calculation.inactiveFilters ? `未結合の列の条件${calculation.inactiveFilters}個は使いません。` : ""}`;
  } catch (e) {
    errorAt("query-error", e);
    $("result-count").textContent = "設定を確認してください";
    $("result-table").innerHTML = "";
    $("result-note").textContent = "";
  }
}
function go(n) {
  selectedField = null;
  step = n;
  render();
  const heading = $(
    [
      "",
      "tables-heading",
      "join-heading",
      "projection-heading",
      "selection-heading",
    ][n],
  );
  heading.tabIndex = -1;
  heading.focus({ preventScroll: true });
  heading.scrollIntoView({ block: "start" });
  requestAnimationFrame(drawLines);
}
function zoom(scale) {
  graphScale = Math.max(0.12, Math.min(1.5, scale));
  sizeGraph();
  requestAnimationFrame(drawLines);
}
$("graph-fit").onclick = () => {
  zoom(
    Math.min(
      1,
      ($("graph-scroll").clientWidth - 2) /
        parseFloat($("relation-graph").style.width),
    ),
  );
  $("graph-scroll").scrollTo(0, 0);
};
$("graph-actual").onclick = () => zoom(1);
$("graph-zoom-in").onclick = () => zoom(graphScale + 0.15);
$("graph-zoom-out").onclick = () => zoom(graphScale - 0.15);
$("graph-arrange").onclick = () =>
  attempt(() => {
    const next = clone(db);
    arrangeCards(next);
    graphScale = 1;
    commit(next, "画面の横幅に合わせてカードを整列しました。");
  });
document
  .querySelectorAll("[data-step], [data-go]")
  .forEach(
    (el) => (el.onclick = () => go(Number(el.dataset.step ?? el.dataset.go))),
  );
document
  .querySelectorAll("[data-close]")
  .forEach((el) => (el.onclick = () => $(el.dataset.close).close()));
$("undo").onclick = () => {
  if (!history.length) return;
  future.push(clone(db));
  db = history.pop();
  selectedField = null;
  save();
  render();
  status("1つ前の状態に戻しました。");
};
$("redo").onclick = () => {
  if (!future.length) return;
  history.push(clone(db));
  db = future.pop();
  selectedField = null;
  save();
  render();
  status("変更をやり直しました。");
};
$("table-list").onclick = (event) => {
  const b = event.target.closest("[data-table]");
  if (b) {
    currentTable = b.dataset.table;
    renderTables();
  }
};

function schemaRows(columns) {
  $("schema-columns").innerHTML = columns
    .map(
      (c, i) =>
        `<tr data-column="${c.id}"><td><input type="text" data-schema="name" value="${esc(c.name)}" maxlength="40" aria-label="${i + 1}列目の列名" /></td><td><select data-schema="type" aria-label="${i + 1}列目の型"><option value="text"${c.type === "text" ? " selected" : ""}>文字</option><option value="number"${c.type === "number" ? " selected" : ""}>数値</option></select></td><td><input type="checkbox" data-schema="required"${c.required ? " checked" : ""} aria-label="${i + 1}列目を必須にする" /></td><td><input type="checkbox" data-schema="primary"${c.primary ? " checked" : ""} aria-label="${i + 1}列目を主キーにする" /></td><td><button type="button" data-remove-column="${c.id}" aria-label="${i + 1}列目を削除">×</button></td></tr>`,
    )
    .join("");
  $("add-column").disabled = columns.length >= LIMITS.columns;
}
function readSchema() {
  return [...$("schema-columns").querySelectorAll("tr")].map((row) => ({
    id: row.dataset.column,
    name: row.querySelector('[data-schema="name"]').value.trim(),
    type: row.querySelector('[data-schema="type"]').value,
    required: row.querySelector('[data-schema="required"]').checked,
    primary: row.querySelector('[data-schema="primary"]').checked,
  }));
}
function openSchema(table = null) {
  schemaTable = table?.id ?? null;
  $("schema-name").value = table?.name ?? "";
  $("schema-title").textContent = table
    ? "テーブルの定義を編集"
    : "テーブルを作成";
  schemaRows(
    table?.columns ?? [
      {
        id: uid("col"),
        name: "",
        type: "text",
        required: false,
        primary: false,
      },
    ],
  );
  errorAt("schema-error", null);
  $("schema-dialog").showModal();
}
$("add-table").onclick = () => openSchema();
$("add-column").onclick = () => {
  const columns = readSchema();
  if (columns.length < LIMITS.columns) {
    columns.push({
      id: uid("col"),
      name: "",
      type: "text",
      required: false,
      primary: false,
    });
    schemaRows(columns);
    $("schema-columns").lastElementChild.querySelector("input").focus();
  }
};
$("schema-columns").onclick = (event) => {
  const b = event.target.closest("[data-remove-column]");
  if (b)
    schemaRows(readSchema().filter((c) => c.id !== b.dataset.removeColumn));
};
$("schema-form").onsubmit = async (event) => {
  event.preventDefault();
  try {
    const next = clone(db),
      old = next.tables.find((t) => t.id === schemaTable),
      columns = readSchema();
    const table = {
      id: old?.id ?? uid("table"),
      name: $("schema-name").value.trim(),
      columns,
      rows: (old?.rows ?? []).map((r) => ({
        id: r.id,
        values: Object.fromEntries(
          columns.map((c) => [c.id, parseCell(r.values[c.id] ?? null, c)]),
        ),
      })),
    };
    validateTable(table);
    if (old) next.tables[next.tables.indexOf(old)] = table;
    else {
      next.tables.push(table);
      if (next.occurrences.length < LIMITS.occurrences)
        next.occurrences.push({
          id: uid("card"),
          table: table.id,
          name: uniqueCardName(table.name, next),
          x: 24 + (next.occurrences.length % 3) * 300,
          y: 32 + Math.floor(next.occurrences.length / 3) * 260,
        });
    }
    const beforeRelations = next.relations.length,
      beforeFilters = next.query.filters.length;
    reconcile(next);
    validateDatabase(next);
    const deleted = old?.columns.some(
      (c) => !columns.some((n) => n.id === c.id),
    );
    if (
      old &&
      (deleted ||
        beforeRelations !== next.relations.length ||
        beforeFilters !== next.query.filters.length)
    ) {
      if (
        !(await confirmChange(
          `列の削除や型の変更により、削除する列のデータ、使えなくなる関係${beforeRelations - next.relations.length}個と条件${beforeFilters - next.query.filters.length}個を取り除きます。定義を保存しますか。`,
          "定義を保存",
        ))
      )
        return;
    }
    currentTable = table.id;
    commit(next, "テーブルの定義を保存しました。");
    $("schema-dialog").close();
  } catch (e) {
    errorAt("schema-error", e);
  }
};
function uniqueCardName(name, state = db) {
  let result = name,
    n = 2;
  while (state.occurrences.some((o) => o.name === result))
    result = `${name.slice(0, 34)} ${n++}`;
  return result;
}
function openRow() {
  const table = db.tables.find((t) => t.id === currentTable);
  $("row-title").textContent = "行を追加";
  $("row-fields").innerHTML = table.columns
    .map(
      (c) =>
        `<label>${esc(c.name)}${c.primary ? "（主キー・必須）" : c.required ? "（必須）" : ""}<input data-row-column="${c.id}" type="text" maxlength="200"${c.type === "number" ? ' inputmode="decimal"' : ""} /></label>`,
    )
    .join("");
  errorAt("row-error", null);
  $("row-dialog").showModal();
}
$("row-form").onsubmit = (event) => {
  event.preventDefault();
  try {
    const next = clone(db),
      table = next.tables.find((t) => t.id === currentTable),
      row = {
        id: uid("row"),
        values: Object.fromEntries(
          table.columns.map((c) => [
            c.id,
            parseCell(
              $("row-fields").querySelector(`[data-row-column="${c.id}"]`)
                .value,
              c,
            ),
          ]),
        ),
      };
    table.rows.push(row);
    commit(
      next,
      "行を保存しました。参照しているすべてのカードに反映されます。",
    );
    $("row-dialog").close();
  } catch (e) {
    errorAt("row-error", e);
  }
};
function saveCell(input) {
  const table = db.tables.find((t) => t.id === currentTable),
    row = table?.rows.find((r) => r.id === input.dataset.row),
    column = table?.columns.find((c) => c.id === input.dataset.column);
  if (!row || !column) return false;
  try {
    const value = parseCell(input.value, column);
    input.setCustomValidity("");
    input.removeAttribute("aria-invalid");
    errorAt("table-error", null);
    if (value !== row.values[column.id]) {
      const next = clone(db);
      next.tables
        .find((t) => t.id === currentTable)
        .rows.find((r) => r.id === row.id).values[column.id] = value;
      commit(
        next,
        "セルの変更を保存しました。結合した表にも反映されます。",
        false,
        true,
      );
    }
    return true;
  } catch (error) {
    errorAt("table-error", error);
    input.setAttribute("aria-invalid", "true");
    input.setCustomValidity(error.message);
    input.reportValidity();
    status(`保存できませんでした：${error.message}`, true);
    return false;
  }
}
$("table-editor").addEventListener("focusout", (event) => {
  if (event.target.matches("[data-cell]")) saveCell(event.target);
});
$("table-editor").oninput = (event) => {
  if (event.target.matches("[data-cell]")) event.target.setCustomValidity("");
};
$("table-editor").onkeydown = (event) => {
  const input = event.target;
  if (!input.matches("[data-cell]")) return;
  if (event.key === "Escape") {
    event.preventDefault();
    const table = db.tables.find((t) => t.id === currentTable);
    input.value =
      table.rows.find((r) => r.id === input.dataset.row).values[
        input.dataset.column
      ] ?? "";
    input.setCustomValidity("");
    input.removeAttribute("aria-invalid");
    errorAt("table-error", null);
    return;
  }
  if (event.key === "Enter") {
    event.preventDefault();
    saveCell(input);
  }
  if (event.key === "Tab" && !saveCell(input)) {
    event.preventDefault();
    input.focus();
  }
};
$("table-editor").onclick = async (event) => {
  const table = db.tables.find((t) => t.id === currentTable),
    b = event.target.closest("button");
  if (!b) return;
  if (b.id === "edit-schema") openSchema(table);
  if (b.id === "add-row") openRow();
  if (
    b.dataset.deleteRow &&
    (await confirmChange(
      "この行を削除します。元に戻すことができます。",
      "行を削除",
    ))
  )
    attempt(() => {
      const next = clone(db);
      next.tables.find((t) => t.id === currentTable).rows = table.rows.filter(
        (r) => r.id !== b.dataset.deleteRow,
      );
      commit(next, "行を削除しました。");
    });
  if (
    b.id === "delete-table" &&
    (await confirmChange(
      `「${table.name}」と、その表のカード・関係・検索条件を削除します。元に戻すことができます。`,
      "テーブルを削除",
    ))
  )
    attempt(() => {
      const next = clone(db);
      next.tables = next.tables.filter((t) => t.id !== currentTable);
      reconcile(next);
      selectedField = null;
      commit(next, "テーブルを削除しました。");
    });
};
$("add-occurrence").onclick = () =>
  attempt(() => {
    const next = clone(db),
      table = next.tables.find((t) => t.id === $("occurrence-table").value);
    if (!table) return;
    next.occurrences.push({
      id: uid("card"),
      table: table.id,
      name: uniqueCardName(table.name),
      x: 24 + (next.occurrences.length % 3) * 300,
      y: 32 + Math.floor(next.occurrences.length / 3) * 260,
    });
    reconcile(next);
    commit(next, "元のテーブルを参照するカードを追加しました。");
  });
function reorderColumn(key, target, after = false) {
  if (step !== 3 || key === target) return;
  attempt(() => {
    const columns = joinRows(db).columns.map((f) => f.key),
      before = columns.join("|"),
      index = columns.indexOf(key);
    if (index < 0 || !columns.includes(target)) return;
    columns.splice(index, 1);
    columns.splice(columns.indexOf(target) + Number(after), 0, key);
    if (before === columns.join("|")) return;
    const next = clone(db);
    next.query.order = [
      ...columns,
      ...(next.query.order ?? []).filter((key) => !columns.includes(key)),
    ];
    const field = fields(db).find((f) => f.key === key);
    commit(
      next,
      `${field.label}を${columns.indexOf(key) + 1}番目に移動しました。`,
    );
  });
}
let columnDrag = null;
function dragTarget() {
  const drag = columnDrag;
  if (!drag?.started) return;
  drag.surface
    .querySelectorAll(".is-drop-before,.is-drop-after")
    .forEach((el) => el.classList.remove("is-drop-before", "is-drop-after"));
  const target = document
    .elementFromPoint(drag.x, drag.y)
    ?.closest("[data-column-slot]");
  drag.target = null;
  if (
    !target ||
    !drag.surface.contains(target) ||
    target.dataset.columnSlot === drag.key
  )
    return;
  const bounds = target.getBoundingClientRect();
  const horizontal =
    drag.surface.id === "result-table" ||
    getComputedStyle(drag.surface).gridTemplateColumns.split(" ").length > 1;
  drag.after = horizontal
    ? drag.x > bounds.x + bounds.width / 2
    : drag.y > bounds.y + bounds.height / 2;
  drag.target = target.dataset.columnSlot;
  target.classList.add(drag.after ? "is-drop-after" : "is-drop-before");
}
function trackColumnDrag() {
  const drag = columnDrag;
  if (!drag?.started) return;
  const bounds = drag.surface.getBoundingClientRect();
  if (
    drag.surface.id === "result-table" &&
    drag.y >= bounds.top &&
    drag.y <= bounds.bottom
  ) {
    if (drag.x < bounds.left + 32) drag.surface.scrollLeft -= 12;
    else if (drag.x > bounds.right - 32) drag.surface.scrollLeft += 12;
  }
  if (drag.y < 70) window.scrollBy(0, -10);
  else if (drag.y > innerHeight - 70) window.scrollBy(0, 10);
  dragTarget();
  drag.frame = requestAnimationFrame(trackColumnDrag);
}
function finishColumnDrag(save = false) {
  const drag = columnDrag;
  if (!drag) return;
  if (drag.frame) cancelAnimationFrame(drag.frame);
  drag.ghost?.remove();
  drag.surface
    .querySelectorAll(".is-dragging,.is-drop-before,.is-drop-after")
    .forEach((el) =>
      el.classList.remove("is-dragging", "is-drop-before", "is-drop-after"),
    );
  document.body.classList.remove("db-dragging-columns");
  columnDrag = null;
  if (drag.handle.hasPointerCapture(drag.pointer))
    drag.handle.releasePointerCapture(drag.pointer);
  if (save && drag.started && drag.target)
    reorderColumn(drag.key, drag.target, drag.after);
}
for (const surface of [$("result-table")]) {
  surface.addEventListener("pointerdown", (event) => {
    const handle = event.target.closest("[data-column-drag]");
    if (!handle || step !== 3 || event.button !== 0 || !event.isPrimary) return;
    event.preventDefault();
    finishColumnDrag();
    handle.focus({ preventScroll: true });
    handle.setPointerCapture(event.pointerId);
    columnDrag = {
      key: handle.dataset.columnDrag,
      handle,
      surface,
      pointer: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
      started: false,
    };
  });
  surface.addEventListener("pointermove", (event) => {
    const drag = columnDrag;
    if (!drag || drag.pointer !== event.pointerId) return;
    drag.x = event.clientX;
    drag.y = event.clientY;
    if (
      !drag.started &&
      Math.hypot(drag.x - drag.startX, drag.y - drag.startY) < 5
    )
      return;
    event.preventDefault();
    if (!drag.started) {
      drag.started = true;
      drag.handle.closest("[data-column-slot]").classList.add("is-dragging");
      document.body.classList.add("db-dragging-columns");
      drag.ghost = document.createElement("div");
      drag.ghost.className = "db-column-ghost";
      drag.ghost.setAttribute("aria-hidden", "true");
      drag.ghost.textContent = fields(db).find((f) => f.key === drag.key).label;
      document.body.append(drag.ghost);
      trackColumnDrag();
    }
    drag.ghost.style.left = `${Math.min(drag.x + 12, innerWidth - 190)}px`;
    drag.ghost.style.top = `${Math.min(drag.y + 12, innerHeight - 55)}px`;
    dragTarget();
  });
  surface.addEventListener("pointerup", (event) => {
    if (columnDrag?.pointer === event.pointerId) finishColumnDrag(true);
  });
  for (const type of ["pointercancel", "lostpointercapture"])
    surface.addEventListener(type, (event) => {
      if (columnDrag?.pointer === event.pointerId) finishColumnDrag();
    });
  surface.addEventListener("keydown", (event) => {
    const handle = event.target.closest("[data-column-drag]");
    if (!handle || step !== 3) return;
    if (event.key === "Escape") {
      finishColumnDrag();
      return;
    }
    const direction = {
      ArrowLeft: -1,
      ArrowUp: -1,
      ArrowRight: 1,
      ArrowDown: 1,
    }[event.key];
    if (!direction && !["Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const columns = joinRows(db)
      .columns.filter(
        (f) =>
          surface.id !== "result-table" || !db.query.hidden.includes(f.key),
      )
      .map((f) => f.key);
    const index = columns.indexOf(handle.dataset.columnDrag);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? columns.length - 1
          : index + direction;
    if (index >= 0 && next >= 0 && next < columns.length)
      reorderColumn(columns[index], columns[next], next > index);
  });
}
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && columnDrag) finishColumnDrag();
});
$("result-table").addEventListener("click", (event) => {
  const button = event.target.closest("[data-sort-column]");
  if (!button || step !== 4) return;
  attempt(() => {
    const next = clone(db),
      key = button.dataset.sortColumn;
    next.query.sort = [
      { key, direction: button.dataset.direction },
      ...sortCriteria(next.query.sort).filter((sort) => sort.key !== key),
    ];
    commit(next, "行を整列しました。同じ値の行は直前の順番を保ちます。");
  });
});
$("reset-sort").onclick = () =>
  attempt(() => {
    const next = clone(db);
    next.query.sort = null;
    commit(next, "行を元の並びに戻しました。");
  });
$("reset-order").onclick = () =>
  attempt(() => {
    const next = clone(db);
    next.query.order = [];
    commit(next, "基準のテーブルからの並び順に戻しました。");
  });
$("query-base").onchange = () =>
  attempt(() => {
    const next = clone(db);
    next.query.base = $("query-base").value;
    commit(next);
  });

function pairRows(pairs) {
  const left =
      db.tables.find(
        (t) =>
          t.id ===
          db.occurrences.find((o) => o.id === $("relation-left").value)?.table,
      )?.columns ?? [],
    right =
      db.tables.find(
        (t) =>
          t.id ===
          db.occurrences.find((o) => o.id === $("relation-right").value)?.table,
      )?.columns ?? [];
  $("relation-pairs").innerHTML = pairs
    .map(
      (p, i) =>
        `<div class="db-column-pair"><label>片方の列<select data-pair-left>${options(left, p.left)}</select></label><span aria-hidden="true">＝</span><label>対応する列<select data-pair-right>${options(right, p.right)}</select></label><button type="button" data-remove-pair="${i}" aria-label="列の対応${i + 1}を削除">×</button></div>`,
    )
    .join("");
  $("add-pair").disabled = pairs.length >= LIMITS.columns;
}
function readPairs() {
  return [...$("relation-pairs").querySelectorAll(".db-column-pair")].map(
    (row) => ({
      left: row.querySelector("[data-pair-left]").value,
      right: row.querySelector("[data-pair-right]").value,
    }),
  );
}
function openRelation(relation = null, from = null, to = null) {
  if (db.occurrences.length < 2) return;
  relationTarget = relation?.id ?? null;
  const [fromCard, fromCol] = from?.split("/") ?? [],
    [toCard, toCol] = to?.split("/") ?? [];
  $("relation-title").textContent = relation ? "結合を編集" : "結合を追加";
  $("relation-guide").textContent =
    "2枚のカードを選び、同じ値で対応する列を指定します。先にカードを追加すると、ここで新しい結合先を選べます。";
  const attached = connectedCards();
  const newCard = db.occurrences.find(
    (o) => !attached.has(o.id) && o.id !== db.query.base,
  );
  $("relation-left").innerHTML = options(
    db.occurrences,
    relation?.left ?? fromCard ?? db.query.base ?? db.occurrences[0].id,
  );
  const rightCard = relation?.right ?? toCard ?? newCard?.id ?? "";
  $("relation-right").innerHTML =
    '<option value="">結合するカードを選ぶ</option>' +
    options(db.occurrences, rightCard);
  $("relation-right").value = rightCard;
  pairRows(relation?.pairs ?? [{ left: fromCol, right: toCol }]);
  errorAt("relation-error", null);
  $("relation-dialog").showModal();
}
$("add-relation").onclick = () => openRelation();
$("add-relation-after").onclick = () => openRelation();
for (const id of ["relation-left", "relation-right"])
  $(id).onchange = () => pairRows([{ left: "", right: "" }]);
$("add-pair").onclick = () => {
  const pairs = readPairs();
  if (pairs.length < LIMITS.columns)
    pairRows([...pairs, { left: "", right: "" }]);
};
$("relation-pairs").onclick = (event) => {
  const b = event.target.closest("[data-remove-pair]");
  if (b)
    pairRows(readPairs().filter((_, i) => i !== Number(b.dataset.removePair)));
};
$("relation-form").onsubmit = (event) => {
  event.preventDefault();
  try {
    const next = clone(db),
      relation = {
        id: relationTarget ?? uid("relation"),
        left: $("relation-left").value,
        right: $("relation-right").value,
        mode: "left",
        pairs: readPairs(),
      };
    next.relations = next.relations.filter((r) => r.id !== relationTarget);
    next.relations.push(relation);
    selectedField = null;
    commit(next, "結合を保存しました。下の表で結果を確認できます。");
    $("relation-dialog").close();
  } catch (e) {
    errorAt("relation-error", e);
  }
};
$("relation-list").onclick = async (event) => {
  const b = event.target.closest("button");
  if (!b) return;
  if (b.dataset.editRelation)
    openRelation(db.relations.find((r) => r.id === b.dataset.editRelation));
  if (
    b.dataset.deleteRelation &&
    (await confirmChange(
      "この関係を削除します。つながらなくなったカードは結合結果に含めません。",
      "関係を削除",
    ))
  )
    attempt(() => {
      const next = clone(db);
      next.relations = next.relations.filter(
        (r) => r.id !== b.dataset.deleteRelation,
      );
      commit(next, "関係を削除しました。");
    });
};
let drag = null,
  suppressClick = false;
$("occurrence-cards").onclick = async (event) => {
  if (suppressClick) {
    suppressClick = false;
    return;
  }
  const b = event.target.closest("button");
  if (!b) return;
  if (b.dataset.field) {
    const key = b.dataset.field;
    if (!selectedField || selectedField === key) {
      selectedField = selectedField === key ? null : key;
      renderGraph();
      document
        .querySelector(`[data-field="${key}"]`)
        ?.focus({ preventScroll: true });
    } else if (selectedField.split("/")[0] === key.split("/")[0])
      status(
        "異なるカードの列を選んでください。同じ表なら別のカードを追加できます。",
        true,
      );
    else {
      const from = selectedField;
      selectedField = null;
      renderGraph();
      openRelation(null, from, key);
    }
  }
  if (b.dataset.renameCard) {
    cardTarget = b.dataset.renameCard;
    $("card-name").value = db.occurrences.find((o) => o.id === cardTarget).name;
    errorAt("card-error", null);
    $("card-dialog").showModal();
  }
  if (
    b.dataset.removeCard &&
    (await confirmChange(
      "このカードとカードにつながる関係を削除します。元のテーブルとデータは残ります。",
      "カードを削除",
    ))
  )
    attempt(() => {
      const next = clone(db);
      next.occurrences = next.occurrences.filter(
        (o) => o.id !== b.dataset.removeCard,
      );
      reconcile(next);
      selectedField = null;
      commit(next, "カードを削除しました。元のテーブルは残っています。");
    });
};
$("card-form").onsubmit = (event) => {
  event.preventDefault();
  try {
    const next = clone(db);
    next.occurrences.find((o) => o.id === cardTarget).name =
      $("card-name").value.trim();
    commit(next, "カード名を変更しました。");
    $("card-dialog").close();
  } catch (e) {
    errorAt("card-error", e);
  }
};
$("occurrence-cards").onpointerdown = (event) => {
  const handle = event.target.closest("[data-handle]");
  if (!handle || event.button !== 0) return;
  const occurrence = db.occurrences.find((o) => o.id === handle.dataset.handle);
  handle.focus({ preventScroll: true });
  handle.setPointerCapture(event.pointerId);
  drag = {
    id: occurrence.id,
    pointer: event.pointerId,
    handle,
    startX: event.clientX,
    startY: event.clientY,
    x: occurrence.x,
    y: occurrence.y,
    moved: false,
  };
};
$("occurrence-cards").onpointermove = (event) => {
  if (!drag || drag.pointer !== event.pointerId) return;
  const dx = (event.clientX - drag.startX) / graphScale,
    dy = (event.clientY - drag.startY) / graphScale;
  if (!drag.moved && Math.hypot(dx, dy) < 5) return;
  drag.moved = true;
  const card = document.querySelector(`[data-card="${drag.id}"]`);
  card.style.left = `${Math.max(0, Math.min(2200, drag.x + dx))}px`;
  card.style.top = `${Math.max(0, Math.min(1600, drag.y + dy))}px`;
  drawLines();
};
function finishDrag(event) {
  if (!drag || drag.pointer !== event.pointerId) return;
  const ended = drag;
  drag = null;
  if (!ended.moved) return;
  suppressClick = true;
  if (event.type === "pointercancel") {
    suppressClick = false;
    renderGraph();
    return;
  }
  attempt(() => {
    const card = document.querySelector(`[data-card="${ended.id}"]`),
      next = clone(db),
      o = next.occurrences.find((o) => o.id === ended.id);
    o.x = Math.round(parseFloat(card.style.left));
    o.y = Math.round(parseFloat(card.style.top));
    commit(next, "カードを移動しました。");
  });
  setTimeout(() => {
    suppressClick = false;
  }, 0);
}
$("occurrence-cards").onpointerup = finishDrag;
$("occurrence-cards").onpointercancel = finishDrag;
$("occurrence-cards").onkeydown = (event) => {
  const handle = event.target.closest("[data-handle]"),
    directions = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
  if (!handle || !directions[event.key]) return;
  event.preventDefault();
  const [x, y] = directions[event.key],
    distance = event.shiftKey ? 40 : 10;
  attempt(() => {
    const next = clone(db),
      o = next.occurrences.find((o) => o.id === handle.dataset.handle);
    o.x = Math.max(0, Math.min(2200, o.x + x * distance));
    o.y = Math.max(0, Math.min(1600, o.y + y * distance));
    commit(next, "カードを移動しました。");
  });
};
$("projection-columns").onchange = (event) => {
  const key = event.target.dataset.projection;
  if (key)
    attempt(() => {
      const next = clone(db);
      next.query.hidden = next.query.hidden.filter((k) => k !== key);
      if (!event.target.checked) next.query.hidden.push(key);
      commit(next);
    });
};
$("show-all").onclick = () =>
  attempt(() => {
    const next = clone(db);
    next.query.hidden = [];
    commit(next);
  });
$("hide-all").onclick = () =>
  attempt(() => {
    const next = clone(db);
    next.query.hidden = fields(db).map((f) => f.key);
    commit(next);
  });
$("distinct-rows").onchange = () =>
  attempt(() => {
    const next = clone(db);
    next.query.distinct = $("distinct-rows").checked;
    commit(next);
  });
$("add-filter").onclick = () =>
  attempt(() => {
    const next = clone(db),
      first = joinRows(db).columns[0];
    if (!first) return;
    next.query.filters.push({
      id: uid("filter"),
      key: first.key,
      op: "eq",
      value: "",
    });
    commit(next);
    $("filter-list").lastElementChild.querySelector("select").focus();
  });
$("filter-match").onchange = () =>
  attempt(() => {
    const next = clone(db);
    next.query.match = $("filter-match").value;
    commit(next);
  });
$("filter-list").onchange = (event) => {
  const { filter: id, property } = event.target.dataset;
  if (!id || property === "value") return;
  attempt(() => {
    const next = clone(db),
      f = next.query.filters.find((f) => f.id === id);
    f[property] = event.target.value;
    if (
      property === "key" &&
      fields(next).find((c) => c.key === f.key).column.type === "number" &&
      ["contains", "starts"].includes(f.op)
    )
      f.op = "eq";
    commit(next);
    document
      .querySelector(`[data-filter="${id}"][data-property="${property}"]`)
      ?.focus({ preventScroll: true });
  });
};
$("filter-list").oninput = (event) => {
  const { filter: id, property } = event.target.dataset;
  if (!id || property !== "value") return;
  attempt(() => {
    const next = clone(db);
    next.query.filters.find((f) => f.id === id).value = event.target.value;
    commit(next, "検索条件を更新しました。", true);
  });
};
$("filter-list").onclick = (event) => {
  const b = event.target.closest("[data-delete-filter]");
  if (b)
    attempt(() => {
      const next = clone(db);
      next.query.filters = next.query.filters.filter(
        (f) => f.id !== b.dataset.deleteFilter,
      );
      commit(next);
      $("add-filter").focus();
    });
};
async function replaceDatabase(next, message, arrange = false) {
  upgradeDatabase(validateDatabase(next));
  if (!(await confirmChange(message, "読み込む"))) return;
  selectedField = null;
  currentTable = next.tables[0]?.id ?? "";
  step = 1;
  needsInitialLayout = arrange;
  commit(next, "データを読み込みました。元に戻すこともできます。");
}
$("load-sample").onclick = () => {
  $("load-dialog").close();
  replaceDatabase(
    learningPreset(),
    "現在の作業を「学生・部員・部活」のプリセットに置き換えます。「保存」でファイルに残すこともできます。",
    true,
  );
};
$("new-db").onclick = async () => {
  if (
    await confirmChange(
      "現在の作業を空のデータベースに置き換えます。「保存」でファイルに残すこともできます。",
      "新規作成",
    )
  )
    attempt(() => {
      selectedField = null;
      step = 1;
      commit(
        emptyDatabase(),
        "新規作成しました。テーブルを定義してみましょう。",
      );
    });
};
$("export-db").onclick = () =>
  attempt(() => {
    const blob = new Blob([JSON.stringify(db, null, 2) + "\n"], {
        type: "application/json",
      }),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = "relational-database.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status("JSONファイルを書き出しました。「読込」で復元できます。");
  });
$("import-db").onclick = () => {
  errorAt("load-error", null);
  $("load-dialog").showModal();
};
$("import-json").onclick = () => {
  $("import-file").value = "";
  $("import-file").click();
};
$("import-file").onchange = async () => {
  const file = $("import-file").files[0];
  if (!file) return;
  try {
    if (file.size > 4 * 1024 * 1024)
      throw new Error("4MB以内のJSONファイルを読み込んでください。");
    const next = validateDatabase(JSON.parse(await file.text()));
    $("load-dialog").close();
    await replaceDatabase(
      next,
      "現在の作業をファイルの内容に置き換えます。「保存」で現在の作業を残せます。",
    );
  } catch (e) {
    errorAt("load-error", new Error(`読み込めませんでした：${e.message}`));
    status(`読み込めませんでした：${e.message}`, true);
  }
};
window.addEventListener("resize", () => {
  sizeGraph();
  requestAnimationFrame(drawLines);
});
render();

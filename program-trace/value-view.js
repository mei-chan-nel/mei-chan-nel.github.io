import { formatValue, matrixAxes } from "./values.js?v=20261003-video";

const element = (tag, className, text = null) => {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== null) node.textContent = text;
  return node;
};

/** 変化の描画を実画面と実行前のサイズ計測で共有する。 */
export function renderChange(container, change, sources = []) {
  container.replaceChildren();
  if (!change) { container.textContent = "—"; return; }
  const wasSource = sources.some((source) => source.name === change.name && (source.indices.length === 0 || source.indices.join(",") === (change.indices ?? []).join(",")));
  const beforeClass = (unset) => [unset ? "unset-before" : "", wasSource && !unset ? "is-assignment-source" : ""].filter(Boolean).join(" ");
  if (change.indices) {
    container.append(element("code", "changed-target", `${change.name}[${change.indices.join(", ")}]`));
    container.append(element("span", beforeClass(change.beforeElement === undefined), change.beforeElement === undefined ? "未代入" : formatValue(change.beforeElement)), element("span", "change-arrow", "→"), element("strong", "", formatValue(change.afterElement)));
  } else if (Array.isArray(change.after)) {
    container.append(element("span", beforeClass(change.before === undefined), change.before === undefined ? "未代入" : `${change.before.length}個の配列`), element("span", "change-arrow", "→"), element("strong", "", `${change.after.length}個の配列`));
  } else {
    container.append(element("span", beforeClass(change.before === undefined), change.before === undefined ? "未代入" : formatValue(change.before)), element("span", "change-arrow", "→"), element("strong", "", change.after === undefined ? "呼び出し終了" : formatValue(change.after)));
  }
}

/** 要素番号と値を並べ、変更した要素と参照した要素を区別する。 */
export function renderValue(container, name, value, changes = [], reads = [], shape = null, { full = false, columnLabels = [], sources = [], assignments = [] } = {}) {
  container.replaceChildren();
  const changed = (indices) => changes.some((change) => !change.indices || change.indices.join(",") === indices.join(","));
  const referenced = (indices) => reads.some((read) => read.name === name && read.indices.join(",") === indices.join(","));
  function mark(cell, indices, item) {
    cell.dataset.index = indices.join(",");
    cell.classList.toggle("is-changed-element", changed(indices));
    cell.classList.toggle("is-referenced", referenced(indices));
    const source = sources.some((source) => source.name === name && (source.indices.length === 0 || source.indices.join(",") === indices.join(",")));
    const target = assignments.some((assignment) => assignment.name === name && (!assignment.indices?.length || assignment.indices.join(",") === indices.join(",")));
    cell.classList.toggle("is-assignment-source", source);
    cell.classList.toggle("is-assignment-target", target);
    cell.setAttribute("aria-label", `${name}[${indices.join(", ")}]：${formatValue(item)}${source ? "（代入元）" : ""}${target ? "（代入先）" : ""}`);
  }
  if (Array.isArray(value)) {
    const array = element("div", "array-value");
    const compact = !full && !!container.closest(".fullscreen-workspace");
    array.classList.toggle("is-compact", compact);
    array.classList.toggle("is-text-array", value.some((item) => typeof item === "string" && item.length >= 3));
    array.setAttribute("aria-label", `${name} の要素（番号は0から）`);
    const references = [...reads, ...sources, ...assignments].filter((read) => read.name === name);
    const indices = compact
      ? compactArrayIndices(value.length, Math.floor((container.clientWidth + 12) / 48), [...changes, ...references])
      : visibleArrayIndices(value.length, changes, references, full);
    function omit(count) {
      const omitted = element(compact ? "button" : "span", "array-ellipsis", compact ? "……" : `… ${count}個 …`);
      if (compact) {
        omitted.type = "button";
        omitted.dataset.inspectArray = name;
        omitted.setAttribute("aria-label", `${count}要素を省略。${name} の全${value.length}要素を見る`);
        omitted.title = `${name} の全${value.length}要素を見る`;
      }
      array.append(omitted);
    }
    let previous = -1;
    indices.forEach((index) => {
      const item = value[index];
      if (index > previous + 1) omit(index - previous - 1);
      const cell = element("span", "array-element");
      cell.append(element("span", "element-index", `[${index}]`), element("strong", "element-value", formatValue(item)));
      mark(cell, [index], item);
      array.append(cell);
      previous = index;
    });
    if (compact && previous < value.length - 1) omit(value.length - previous - 1);
    array.style.setProperty("--array-columns", Math.max(1, array.children.length));
    container.append(array);
    if (!full && !compact && value.length > 40) {
      const button = element("button", "array-inspect", `全${value.length}要素を見る`);
      button.type = "button";
      button.dataset.inspectArray = name;
      container.append(button);
    }
  } else if (value?.kind === "matrix") {
    let { rows, columns } = matrixAxes(value);
    if (shape) {
      rows = Array.from({ length: shape.rows }, (_, index) => index + shape.start);
      columns = Array.from({ length: shape.columns }, (_, index) => index + shape.start);
    }
    const scroller = element("div", "matrix-scroll");
    const table = element("table", "matrix-value");
    table.setAttribute("aria-label", `${name} の二次元配列`);
    const head = element("thead", "");
    const header = element("tr", "");
    header.append(element("th", "matrix-axis", "i ＼ j"));
    for (const column of columns) {
      const text = columnLabels[columns.indexOf(column)];
      const label = element("th", "matrix-axis", `${column}${text ? `\n${text}` : ""}`);
      label.scope = "col";
      header.append(label);
    }
    head.append(header);
    const body = element("tbody", "");
    for (const row of rows) {
      const tr = element("tr", "");
      const label = element("th", "matrix-axis", String(row));
      label.scope = "row";
      tr.append(label);
      for (const column of columns) {
        const item = value.cells[`${row},${column}`];
        const cell = element("td", "matrix-element", formatValue(item));
        mark(cell, [row, column], item);
        if (item === undefined) cell.classList.add("is-unset");
        tr.append(cell);
      }
      body.append(tr);
    }
    table.append(head, body);
    scroller.append(table);
    container.append(scroller);
  } else container.textContent = formatValue(value);
}

export function visibleArrayIndices(length, changes = [], reads = [], full = false) {
  if (full || length <= 40) return Array.from({ length }, (_, index) => index);
  const indices = new Set([...Array.from({ length: 8 }, (_, index) => index), ...Array.from({ length: 24 }, (_, index) => length - 24 + index)]);
  for (const item of [...changes, ...reads]) if (item.indices?.length === 1) {
    const focus = item.indices[0];
    for (const index of [focus - 1, focus, focus + 1]) if (index >= 0 && index < length && indices.size < 40) indices.add(index);
  }
  return [...indices].sort((a, b) => a - b);
}

/** 省略記号も1マスと数え、代入・参照する要素を残した1行分のプレビュー。 */
export function compactArrayIndices(length, capacity = 6, references = []) {
  if (!length) return [];
  const selected = new Set(references.filter((item) => item.indices?.length === 1)
    .map((item) => item.indices[0]).filter((index) => Number.isInteger(index) && index >= 0 && index < length));
  const slots = Math.max(3, capacity);
  const slotCount = (indices) => {
    const sorted = [...indices].sort((a, b) => a - b);
    if (!sorted.length) return 0;
    return sorted.length + Number(sorted[0] > 0) + Number(sorted.at(-1) < length - 1)
      + sorted.slice(1).filter((index, position) => index > sorted[position] + 1).length;
  };
  const candidates = new Set([0, length - 1, ...[...selected].flatMap((index) => [index - 1, index + 1])]);
  for (let index = 0; index < Math.min(length, slots); index++) {
    candidates.add(index); candidates.add(length - index - 1);
  }
  const limit = Math.max(slots, slotCount(selected));
  for (const index of candidates) {
    if (index < 0 || index >= length || selected.has(index)) continue;
    const proposed = new Set([...selected, index]);
    if (slotCount(proposed) <= limit) selected.add(index);
  }
  return [...selected].sort((a, b) => a - b);
}

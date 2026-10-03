import { formatValue, matrixAxes } from "./values.js?v=20261003-video";

const element = (tag, className, text = null) => {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== null) node.textContent = text;
  return node;
};

/** 変化の描画を実画面と実行前のサイズ計測で共有する。 */
export function renderChange(container, change) {
  container.replaceChildren();
  if (!change) { container.textContent = "—"; return; }
  if (change.indices) {
    container.append(element("code", "changed-target", `${change.name}[${change.indices.join(", ")}]`));
    container.append(element("span", change.beforeElement === undefined ? "unset-before" : "", change.beforeElement === undefined ? "未代入" : formatValue(change.beforeElement)), element("span", "change-arrow", "→"), element("strong", "", formatValue(change.afterElement)));
  } else if (Array.isArray(change.after)) {
    container.append(element("span", "", change.before === undefined ? "未代入" : `${change.before.length}個の配列`), element("span", "change-arrow", "→"), element("strong", "", `${change.after.length}個の配列`));
  } else {
    container.append(element("span", change.before === undefined ? "unset-before" : "", change.before === undefined ? "未代入" : formatValue(change.before)), element("span", "change-arrow", "→"), element("strong", "", change.after === undefined ? "呼び出し終了" : formatValue(change.after)));
  }
}

/** 要素番号と値を並べ、変更した要素と参照した要素を区別する。 */
export function renderValue(container, name, value, changes = [], reads = [], shape = null, { full = false, columnLabels = [] } = {}) {
  container.replaceChildren();
  const changed = (indices) => changes.some((change) => !change.indices || change.indices.join(",") === indices.join(","));
  const referenced = (indices) => reads.some((read) => read.name === name && read.indices.join(",") === indices.join(","));
  function mark(cell, indices, item) {
    cell.dataset.index = indices.join(",");
    cell.classList.toggle("is-changed-element", changed(indices));
    cell.classList.toggle("is-referenced", referenced(indices));
    cell.setAttribute("aria-label", `${name}[${indices.join(", ")}]：${formatValue(item)}`);
  }
  if (Array.isArray(value)) {
    const array = element("div", "array-value");
    array.classList.toggle("is-text-array", value.some((item) => typeof item === "string" && item.length >= 3));
    array.setAttribute("aria-label", `${name} の要素（番号は0から）`);
    const indices = visibleArrayIndices(value.length, changes, reads.filter((read) => read.name === name), full);
    let previous = -1;
    indices.forEach((index) => {
      const item = value[index];
      if (index > previous + 1) array.append(element("span", "array-ellipsis", `… ${index - previous - 1}個 …`));
      const cell = element("span", "array-element");
      cell.append(element("span", "element-index", `[${index}]`), element("strong", "element-value", formatValue(item)));
      mark(cell, [index], item);
      array.append(cell);
      previous = index;
    });
    container.append(array);
    if (!full && value.length > 40) {
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

import {
  historyColumns,
  columnValues,
  applyHistoryGrid,
  migrateHistoryScopeFilter,
} from "../engine/history-grid.mjs";
import { isInterrupted } from "../engine/catalog.mjs";
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const button = (label, action, cls = "") => {
  const b = document.createElement("button");
  b.textContent = label;
  b.className = cls;
  b.onclick = action;
  return b;
};
const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
let menu, menuAnchor, menuPosition;
export function closeHistoryMenu() {
  if (menu?.open) menu.close();
}
function closeMovedMenu() {
  if (!menu?.open || !menuPosition) return;
  const a = menuAnchor.getBoundingClientRect();
  // A header may scroll into view just before opening. Its already queued
  // scroll/resize event must not immediately close the newly opened menu.
  if (
    Math.abs(a.left - menuPosition.left) > 0.5 ||
    Math.abs(a.top - menuPosition.top) > 0.5 ||
    innerWidth !== menuPosition.width ||
    innerHeight !== menuPosition.height
  )
    closeHistoryMenu();
}
function ensureMenu() {
  if (menu) return menu;
  menu = document.createElement("dialog");
  menu.id = "history-column-menu";
  menu.setAttribute("aria-label", "列の並び替えと絞り込み");
  document.body.append(menu);
  document.addEventListener("pointerdown", (e) => {
    if (
      menu.open &&
      !menu.contains(e.target) &&
      !menuAnchor?.contains(e.target)
    )
      closeHistoryMenu();
  });
  menu.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeHistoryMenu();
      menuAnchor?.focus({ preventScroll: true });
    }
  });
  window.addEventListener("resize", closeMovedMenu);
  window.addEventListener("scroll", closeMovedMenu, { passive: true });
  return menu;
}
function openMenu(column, anchor, rows, state, change) {
  const d = ensureMenu();
  closeHistoryMenu();
  menuAnchor = anchor;
  const values = columnValues(rows, column),
    current = state.filters?.[column.key] || {},
    selected = new Set(current.values || values.map((v) => v.key));
  d.innerHTML = `<h2>${esc(column.label)}</h2><div class="column-sort-actions"></div>${column.kind !== "text" ? `<fieldset class="column-range"><legend>${column.kind === "date" ? "日付の範囲" : "数値の範囲"}${column.unit ? "（" + column.unit + "）" : ""}</legend><input aria-label="下限" type="${column.kind === "date" ? "date" : "number"}" step="any" value="${esc(current.min ?? "")}"><span>〜</span><input aria-label="上限" type="${column.kind === "date" ? "date" : "number"}" step="any" value="${esc(current.max ?? "")}"></fieldset>` : ""}<input class="column-search" type="search" aria-label="値を検索" placeholder="値を検索"><label class="column-select-all"><input type="checkbox">すべて選択</label><div class="column-value-list"></div><p class="column-error" role="alert"></p><div class="column-menu-actions"></div><button class="column-clear">この列の絞り込みを解除</button>`;
  const commit = () => {
    closeHistoryMenu();
    change();
    document
      .querySelector(`[data-history-column="${column.key}"]`)
      ?.focus({ preventScroll: true });
  };
  for (const [direction, title] of [
    ["asc", "昇順"],
    ["desc", "降順"],
  ]) {
    const b = button(direction === "asc" ? "↑ " + title : "↓ " + title, () => {
      state.sort = { key: column.key, direction };
      commit();
    });
    b.setAttribute(
      "aria-pressed",
      String(
        state.sort?.key === column.key && state.sort?.direction === direction,
      ),
    );
    d.querySelector(".column-sort-actions").append(b);
  }
  const search = d.querySelector(".column-search"),
    list = d.querySelector(".column-value-list"),
    all = d.querySelector(".column-select-all input");
  const visible = () =>
    values.filter((v) =>
      v.label
        .normalize("NFKC")
        .toLowerCase()
        .includes(search.value.normalize("NFKC").toLowerCase()),
    );
  const syncAll = () => {
    const shown = visible(),
      n = shown.filter((v) => selected.has(v.key)).length;
    all.checked = shown.length > 0 && n === shown.length;
    all.indeterminate = n > 0 && n < shown.length;
    all.disabled = !shown.length;
  };
  const renderValues = () => {
    list.replaceChildren();
    for (const v of visible()) {
      const label = document.createElement("label"),
        input = document.createElement("input");
      input.type = "checkbox";
      input.checked = selected.has(v.key);
      input.value = v.key;
      input.onchange = () => {
        input.checked ? selected.add(v.key) : selected.delete(v.key);
        syncAll();
      };
      label.append(input, document.createTextNode(v.label));
      list.append(label);
    }
    if (!list.children.length) list.textContent = "一致する値がありません";
    syncAll();
  };
  search.oninput = renderValues;
  all.onchange = () => {
    for (const v of visible())
      all.checked ? selected.add(v.key) : selected.delete(v.key);
    renderValues();
  };
  renderValues();
  d.querySelector(".column-menu-actions").append(
    button(
      "適用",
      () => {
        const inputs = [...d.querySelectorAll(".column-range input")];
        if (inputs.some((input) => !input.reportValidity())) return;
        const [min, max] = inputs.map((input) => input.value),
          chosen = visible()
            .filter((v) => selected.has(v.key))
            .map((v) => v.key);
        if (
          min &&
          max &&
          (column.kind === "date" ? min > max : Number(min) > Number(max))
        ) {
          d.querySelector(".column-error").textContent =
            "下限は上限以下にしてください。";
          return;
        }
        const f = {
          values: chosen.length === values.length ? null : chosen,
          min: min || "",
          max: max || "",
        };
        state.filters ||= {};
        if (f.values === null && !f.min && !f.max)
          delete state.filters[column.key];
        else state.filters[column.key] = f;
        commit();
      },
      "primary",
    ),
    button("キャンセル", closeHistoryMenu),
  );
  d.querySelector(".column-clear").onclick = () => {
    delete state.filters[column.key];
    commit();
  };
  d.show();
  d.style.width = Math.min(330, innerWidth - 20) + "px";
  d.style.maxHeight = Math.min(620, innerHeight - 20) + "px";
  const a = anchor.getBoundingClientRect(),
    h = d.getBoundingClientRect().height,
    below = innerHeight - a.bottom - 8;
  menuPosition = {
    left: a.left,
    top: a.top,
    width: innerWidth,
    height: innerHeight,
  };
  d.style.left =
    Math.max(10, Math.min(a.left, innerWidth - d.offsetWidth - 10)) + "px";
  d.style.top =
    Math.max(
      10,
      Math.min(
        below >= h || a.top < below ? a.bottom + 6 : a.top - h - 6,
        innerHeight - h - 10,
      ),
    ) + "px";
  search.focus({ preventScroll: true });
}
export function renderHistoryGrid(
  root,
  { rows, state, onChange, onOpen, onDelete, onReset },
) {
  migrateHistoryScopeFilter(state, rows);
  const shown = applyHistoryGrid(rows, state),
    active = Object.keys(state.filters || {}).filter((k) => state.filters[k]);
  root.innerHTML = `<div class="history-grid-tools"><p class="history-row-count" role="status">${shown.length}件 / ${rows.length}件</p><button class="grid-reset">表示条件をリセット</button></div><div class="history-filter-chips"></div><div class="table-wrap"><table class="history-table"><thead><tr>${historyColumns.map((c) => `<th scope="col"><button data-history-column="${c.key}" aria-label="${c.label}の並び替え・絞り込み"><span>${c.label}</span><span class="column-indicator" aria-hidden="true">${state.sort?.key === c.key ? (state.sort.direction === "asc" ? "↑" : "↓") : ""}${active.includes(c.key) ? " ●" : " ▾"}</span></button></th>`).join("")}<th scope="col">操作</th></tr></thead><tbody id="history-list"></tbody></table></div><p id="history-empty" class="muted" ${shown.length ? "hidden" : ""}>該当する学習履歴はありません。</p>${rows.some((r) => r.derived) ? '<p class="history-time-note">通し受験から切り出した大問は、大問別の解答時間を記録していないため「—」で表示します。</p>' : ""}`;
  root.querySelector(".grid-reset").onclick = onReset;
  for (const column of historyColumns) {
    const b = root.querySelector(`[data-history-column="${column.key}"]`);
    b.classList.toggle("filtered", active.includes(column.key));
    b.closest("th").setAttribute(
      "aria-sort",
      state.sort?.key === column.key
        ? state.sort.direction === "asc"
          ? "ascending"
          : "descending"
        : "none",
    );
    b.onclick = () => openMenu(column, b, rows, state, onChange);
    if (active.includes(column.key))
      root.querySelector(".history-filter-chips").append(
        button(
          column.label + " ×",
          () => {
            delete state.filters[column.key];
            onChange();
          },
          "filter-chip",
        ),
      );
  }
  root
    .querySelector(".table-wrap")
    .addEventListener("scroll", closeMovedMenu, { passive: true });
  for (const r of shown) {
    const a = r.attempt,
      tr = document.createElement("tr");
    tr.dataset.attemptId = a.id;
    tr.dataset.rowKey = r.key;
    tr.dataset.sectionId = r.sectionId || "";
    tr.dataset.derived = String(r.derived);
    tr.innerHTML = `<td>${new Date(r.date).toLocaleString("ja-JP")}${a.isSample ? '<span class="sample-label">サンプル</span>' : ""}</td><th>No.${esc(r.exam)}</th><td>${esc(r.derived ? r.scope.slice(0, r.scope.indexOf("（")) : r.scope)}${r.derived ? `<small class="history-source">${esc(r.fullMode)}</small>` : ""}</td><td>${r.status}</td><td>${r.points === null ? "—" : r.points + " / " + r.maxPoints + "点"}</td><td>${r.rate === null ? "—" : r.rate.toFixed(1) + "%"}</td><td>${r.duration === null ? "—" : clock(r.duration)}</td><td><div class="actions history-row-actions"></div></td>`;
    for (const [title, enabled, action, cls] of [
      ["採点結果", !!a.result, () => onOpen(r, "result"), ""],
      ["復習", !!a.result, () => onOpen(r, "review"), ""],
      ["再開", isInterrupted(a), () => onOpen(r, "resume"), ""],
      ["削除", true, () => onDelete(r), "subtle-danger"],
    ]) {
      if (enabled) {
        const b = button(title, action, cls);
        if (r.derived && title === "再開")
          b.title = "元の通し受験をこの大問から再開";
        tr.querySelector(".actions").append(b);
      } else {
        const span = document.createElement("span");
        span.className = "action-placeholder";
        span.textContent = "—";
        span.setAttribute("aria-label", title + "なし");
        tr.querySelector(".actions").append(span);
      }
    }
    root.querySelector("#history-list").append(tr);
  }
}

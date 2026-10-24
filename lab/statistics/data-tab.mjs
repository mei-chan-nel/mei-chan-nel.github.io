import { esc } from "./shared/ui.mjs?v=20261024-monthly-series";
import { currentData } from "./shared/data-model.mjs?v=20261024-monthly-series";
import {
  applyTableRows,
  numericTableColumn,
  tableConstraint,
} from "./shared/table-data.mjs?v=20261024-monthly-series";
import {
  mountDataEditor,
  downloadCSV,
} from "./data-editor.mjs?v=20261024-monthly-series";
import { asNumber } from "./shared/csv.mjs";

// Align decimal positions inside a centered, fixed-width numeric block.
// Only padding changes: values, precision and native editing stay untouched.
const decimalParts = (value) => {
  const text = String(value).trim();
  if (!text) return null;
  if (text !== String(value)) return false;
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return false;
  const [integer, fraction = ""] = text.split(".");
  return {
    integer: integer.length,
    fraction: fraction.length,
    dot: text.includes(".") ? 1 : 0,
  };
};
export function renderDataTab(root, options) {
  const {
    id,
    state,
    sample,
    apply,
    analyze,
    nextLabel = "分析方法を選ぶ",
    update,
    allowGroup = false,
    dataOverride = null,
    ui = {},
  } = options;
  const data = dataOverride || currentData(id, state);
  const source = JSON.stringify([
    id,
    state.mode,
    data.headers,
    data.rows,
    data.name,
    data.origin,
    data.filename,
  ]);
  if (ui.dataDraft?.source !== source) {
    ui.dataDraft = {
      source,
      rows: data.rows.map((row) => row.map((value) => String(value ?? ""))),
      dirty: false,
    };
  }
  const draft = ui.dataDraft;
  const preferredSize = ui.dataPageSize || "all";
  const pageSize =
      preferredSize === "all"
        ? Math.max(1, draft.rows.length)
        : Number(preferredSize),
    limit = ["probability", "crosstab"].includes(id) ? 10000 : 300;
  if (ui.previousPageSize && ui.previousPageSize !== pageSize)
    ui.dataPage = Math.floor(
      ((ui.dataPage || 0) * ui.previousPageSize) / pageSize,
    );
  ui.previousPageSize = pageSize;
  const pageCount = Math.max(1, Math.ceil(draft.rows.length / pageSize));
  const page = Math.max(0, Math.min(ui.dataPage || 0, pageCount - 1)),
    from = page * pageSize;
  ui.dataPage = page;
  const redraw = () => renderDataTab(root, options);
  root.innerHTML = `<section class="data-view" aria-label="分析に使っているデータ">
    <div class="data-view-heading"><div><h2>${esc(data.name)}</h2><p>${state.dataInfo?.tableEdited ? "表で編集したデータ" : data.origin === "user" ? "自分のデータ" : "架空のサンプル（各タブで同じ値を使用）"} · <span id="data-row-count">${draft.rows.length}</span>行${data.filename ? ` · ${esc(data.filename)}` : ""}</p></div>
    <div class="actions data-file-actions"><button id="use-sample" type="button">サンプルを使用</button><button id="download-csv" type="button">CSVでダウンロード</button><button id="upload-csv" type="button">CSVでアップロード</button></div></div>
    ${id === "probability" ? `<label class="control probability-data-kind">データの種類<select id="probability-data-mode"><option value="coin" ${state.mode === "coin" ? "selected" : ""}>コインの結果（表=1・裏=0）</option><option value="binomial" ${state.mode === "binomial" ? "selected" : ""}>1セットの成功回数（0〜${state.n}）</option><option value="normal" ${state.mode === "normal" ? "selected" : ""}>連続した測定値</option></select></label>` : ""}
    <p class="data-edit-help" id="data-edit-help">セルに入力して編集できます。「変更を反映」または次のタブへ進むと、図表にも反映します。</p>
    <p class="data-constraint">${esc(tableConstraint(id, state))}</p>
    <div class="data-table"><table class="stat-table editable-data-table" data-columns="${data.headers.length}" aria-describedby="data-edit-help"><thead><tr><th scope="col">番号</th>${data.headers.map((h) => `<th scope="col">${esc(h)}</th>`).join("")}<th scope="col" class="data-row-action">削除</th></tr></thead><tbody>${
      draft.rows
        .slice(from, from + pageSize)
        .map((row, i) => {
          const r = from + i;
          return `<tr><th scope="row">${r + 1}<span class="data-row-number-label">行目</span></th>${row.map((value, c) => `<td data-label="${esc(data.headers[c])}"><input id="data-cell-${r}-${c}" class="data-cell" type="text" ${numericTableColumn(id, c) ? 'inputmode="decimal" maxlength="40"' : 'maxlength="100"'} data-row="${r}" data-column="${c}" aria-label="${r + 1}行目 ${esc(data.headers[c])}" value="${esc(value)}" spellcheck="false" autocomplete="off"></td>`).join("")}<td class="data-row-action"><button type="button" data-remove-row="${r}" aria-label="${r + 1}行目を削除" title="${r + 1}行目を削除">×</button></td></tr>`;
        })
        .join("") ||
      `<tr><td colspan="${data.headers.length + 2}">「行を追加」からデータを入力できます。</td></tr>`
    }</tbody></table></div>
    <div class="data-edit-actions"><button id="add-data-row" type="button" ${draft.rows.length >= limit ? "disabled" : ""}>＋ 行を追加</button><div class="actions"><button id="discard-data-edits" type="button" ${draft.dirty ? "" : "disabled"}>編集を取り消す</button><button id="apply-data-edits" type="button" ${draft.dirty ? "" : "disabled"}>変更を反映</button></div></div>
    <p id="data-message" class="data-edit-status" role="status" aria-live="polite">${draft.dirty ? "未反映の変更があります。" : esc(ui.dataNotice || "")}</p>
    <div class="data-pagination"><label for="data-page-size">表示行数 <select id="data-page-size">${[
      ["all", "すべて"],
      [100, "100行"],
      [300, "300行"],
    ]
      .map(
        ([v, label]) =>
          `<option value="${v}" ${String(v) === String(preferredSize) ? "selected" : ""}>${label}</option>`,
      )
      .join(
        "",
      )}</select></label>${pageCount > 1 ? `<button id="data-prev" type="button" ${page ? "" : "disabled"}>前へ</button>` : ""}<span>${draft.rows.length ? from + 1 : 0}〜${Math.min(draft.rows.length, from + pageSize)}行 / ${draft.rows.length}行</span>${pageCount > 1 ? `<button id="data-next" type="button" ${page + 1 < pageCount ? "" : "disabled"}>次へ</button>` : ""}</div>
    ${id === "histogram" ? `<details class="data-bulk-edit"><summary>集団の値をまとめて変える</summary><div class="data-bulk-controls"><label for="data-shift-group">集団<select id="data-shift-group">${[...new Set(draft.rows.map((r) => r[1]))].map((g) => `<option>${esc(g)}</option>`).join("")}</select></label><label for="data-shift-amount">各値に足す数<input id="data-shift-amount" type="number" step="any" value="0" inputmode="decimal"></label><button id="data-shift-apply" type="button">表の値を変更</button><span>負の数なら小さくなります。</span></div></details>` : ""}
    <p class="data-operation"><strong>このデータで行う分析：</strong>${esc(data.operation || "同じデータを分布・代表値・散布図で調べる")}</p><div class="data-next"><button id="analyze-data" type="button">次へ：${esc(nextLabel)} →</button></div><div id="data-upload" hidden></div></section>`;
  const alignNumbers = (column) => {
    if (!numericTableColumn(id, column)) return;
    const parts = draft.rows.map((row) => decimalParts(row[column]));
    const valid = parts.filter(Boolean);
    const integers = Math.max(0, ...valid.map((p) => p.integer));
    const fractions = Math.max(0, ...valid.map((p) => p.fraction));
    // Very long or exponential notation remains centered without squeezing.
    const aligned =
      !parts.includes(false) &&
      valid.some((p) => p.dot) &&
      integers + fractions + 1 <= 12;
    for (const input of root.querySelectorAll(
      `.data-cell[data-column="${column}"]`,
    )) {
      const p = parts[Number(input.dataset.row)];
      input.removeAttribute("data-decimal-aligned");
      for (const name of ["slots", "leading", "trailing"])
        input.style.removeProperty(`--decimal-${name}`);
      if (!aligned || !p) continue;
      const shift = integers - p.integer - (fractions - p.fraction) + p.dot - 1;
      input.setAttribute("data-decimal-aligned", "");
      input.style.setProperty(
        "--decimal-slots",
        String(integers + fractions + 1),
      );
      input.style.setProperty("--decimal-leading", `${Math.max(0, shift)}ch`);
      input.style.setProperty("--decimal-trailing", `${Math.max(0, -shift)}ch`);
    }
  };
  data.headers.forEach((_, column) => alignNumbers(column));
  const message = root.querySelector("#data-message");
  const mark = () => {
    draft.dirty =
      JSON.stringify(draft.rows) !==
      JSON.stringify(
        data.rows.map((row) => row.map((value) => String(value ?? ""))),
      );
    root.querySelector("#discard-data-edits").disabled = !draft.dirty;
    root.querySelector("#apply-data-edits").disabled = !draft.dirty;
    message.textContent = draft.dirty ? "未反映の変更があります。" : "";
    message.classList.remove("error");
    message.setAttribute("role", "status");
    ui.dataNotice = "";
  };
  const commit = () => {
    if (!draft.dirty) return true;
    try {
      const next = applyTableRows(id, state, data, draft.rows, allowGroup);
      ui.dataDraft = null;
      ui.dataNotice = "変更を反映しました。";
      apply(next);
      return true;
    } catch (e) {
      message.textContent = `変更を反映できません。${e.message}`;
      message.classList.add("error");
      message.setAttribute("role", "alert");
      message.scrollIntoView({ behavior: "smooth", block: "center" });
      return false;
    }
  };
  // Header tabs use this same guard, so changing tabs cannot silently use stale values.
  ui.commitData = commit;
  root.querySelector("#data-page-size").onchange = (e) => {
    ui.dataPageSize = e.target.value === "all" ? "all" : Number(e.target.value);
    redraw();
  };
  root.querySelector("#data-shift-apply")?.addEventListener("click", () => {
    try {
      const amount = asNumber(
        root.querySelector("#data-shift-amount").value,
        1,
        "各値に足す数",
      );
      const group = root.querySelector("#data-shift-group").value;
      const next = draft.rows.map((row, i) =>
        row[1] !== group
          ? [...row]
          : [
              String(
                asNumber(
                  String(asNumber(row[0], i + 1, data.headers[0]) + amount),
                  i + 1,
                  data.headers[0],
                ),
              ),
              ...row.slice(1),
            ],
      );
      draft.rows = next;
      mark();
      redraw();
    } catch (e) {
      message.textContent = e.message;
      message.classList.add("error");
      message.setAttribute("role", "alert");
    }
  });
  root.querySelectorAll(".data-cell").forEach((input) => {
    input.addEventListener("blur", () =>
      alignNumbers(Number(input.dataset.column)),
    );
    input.addEventListener("input", () => {
      draft.rows[Number(input.dataset.row)][Number(input.dataset.column)] =
        input.value;
      mark();
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.isComposing) {
        e.preventDefault();
        commit();
      }
    });
  });
  root.querySelector("#add-data-row").onclick = () => {
    draft.rows.push(data.headers.map(() => ""));
    draft.dirty = true;
    ui.dataNotice = "";
    ui.dataPage = Math.floor((draft.rows.length - 1) / pageSize);
    redraw();
    const cell = root.querySelector(`#data-cell-${draft.rows.length - 1}-0`);
    cell.focus({ preventScroll: true });
    cell.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  root.querySelectorAll("[data-remove-row]").forEach((button) => {
    button.onclick = () => {
      const index = Number(button.dataset.removeRow);
      draft.rows.splice(index, 1);
      mark();
      redraw();
      const focusRow = Math.min(index, draft.rows.length - 1);
      root
        .querySelector(`#data-cell-${focusRow}-0`)
        ?.focus({ preventScroll: true });
    };
  });
  root.querySelector("#apply-data-edits").onclick = commit;
  root.querySelector("#discard-data-edits").onclick = () => {
    ui.dataDraft = null;
    ui.dataNotice = "編集を取り消しました。";
    redraw();
  };
  root.querySelector("#use-sample").onclick = () => {
    ui.dataDraft = null;
    ui.dataPage = 0;
    ui.dataNotice = "";
    sample();
  };
  root.querySelector("#download-csv").onclick = () => {
    if (commit()) downloadCSV(`statistics-${id}.csv`, data.headers, draft.rows);
  };
  const open = () => {
    const container = root.querySelector("#data-upload");
    container.hidden = false;
    const editor = mountDataEditor(container, {
      id,
      state,
      allowGroup,
      dataOverride: { ...data, rows: draft.rows },
      apply: (next) => {
        ui.dataPage = 0;
        ui.dataDraft = null;
        ui.dataNotice = "";
        apply(next);
        root.scrollIntoView({ behavior: "smooth", block: "start" });
      },
    });
    container.scrollIntoView({ behavior: "smooth", block: "start" });
    editor.querySelector("#csv-file").click();
  };
  root.querySelector("#upload-csv").onclick = open;
  root.querySelector("#analyze-data").onclick = () => {
    if (commit()) analyze();
  };
  root
    .querySelector("#probability-data-mode")
    ?.addEventListener("change", (e) => {
      const mode = e.target.value;
      if (!commit()) {
        e.target.value = state.mode;
        return;
      }
      ui.dataPage = 0;
      ui.dataDraft = null;
      ui.dataNotice = "";
      update({ mode });
    });
  for (const [key, offset] of [
    ["prev", -1],
    ["next", 1],
  ])
    root.querySelector(`#data-${key}`)?.addEventListener("click", () => {
      ui.dataPage = page + offset;
      redraw();
    });
}

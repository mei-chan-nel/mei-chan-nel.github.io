import { fmt } from "./shared/math.mjs";
import { esc, table } from "./shared/ui.mjs";
import { currentData } from "./shared/data-model.mjs";
import { mountDataEditor, downloadCSV } from "./data-editor.mjs";
export function renderDataTab(
  root,
  {
    id,
    state,
    sample,
    apply,
    analyze,
    update,
    allowGroup = false,
    dataOverride = null,
    ui = {},
  },
) {
  const data = dataOverride || currentData(id, state);
  const pageSize = 20,
    pageCount = Math.max(1, Math.ceil(data.rows.length / pageSize));
  const page = Math.min(ui.dataPage || 0, pageCount - 1),
    from = page * pageSize;
  root.innerHTML = `<section class="data-view" aria-label="分析に使っているデータ"><div class="data-view-heading"><div><h2>${esc(data.name)}</h2><p>${data.origin === "user" ? "読み込んだデータ" : "毎回新しく生成する架空のサンプル"} · ${data.rows.length}行${data.filename ? ` · ${esc(data.filename)}` : ""}</p></div><div class="actions"><button id="use-sample" type="button">サンプルを使用</button><button id="download-csv" type="button">CSVでダウンロード</button><button id="upload-csv" type="button" class="primary">CSVでアップロード</button></div></div>${id === "probability" ? `<label class="control probability-data-kind">データの種類<select id="probability-data-mode"><option value="coin" ${state.mode === "coin" ? "selected" : ""}>コインの結果（表=1・裏=0）</option><option value="binomial" ${state.mode === "binomial" ? "selected" : ""}>1セットの成功回数（0〜${state.n}）</option><option value="normal" ${state.mode === "normal" ? "selected" : ""}>連続した測定値</option></select></label>` : ""}<div class="data-table">${table(
    ["番号", ...data.headers],
    data.rows
      .slice(from, from + pageSize)
      .map((row, i) => [
        from + i + 1,
        ...row.map((v) =>
          typeof v === "number" && !Number.isInteger(v) ? fmt(v, 4) : v,
        ),
      ]),
  )}</div>${pageCount > 1 ? `<div class="data-pagination"><button id="data-prev" type="button" ${page ? "" : "disabled"}>前の20行</button><span>${from + 1}〜${Math.min(data.rows.length, from + pageSize)}行 / ${data.rows.length}行</span><button id="data-next" type="button" ${page + 1 < pageCount ? "" : "disabled"}>次の20行</button></div>` : ""}<p class="data-operation"><strong>このデータで行う分析：</strong>${esc(data.operation || "同じデータを分布・代表値・散布図で調べる")}</p><div class="data-next"><button id="analyze-data" type="button">このデータで実験する →</button><button id="paste-data" type="button">表データを貼り付ける・列を選ぶ</button></div><div id="data-upload" hidden></div><p id="data-message" role="status"></p></section>`;
  root.querySelector("#use-sample").onclick = () => {
    ui.dataPage = 0;
    sample();
  };
  root.querySelector("#download-csv").onclick = () =>
    downloadCSV(`statistics-${id}.csv`, data.headers, data.rows);
  const open = (file) => {
    const container = root.querySelector("#data-upload");
    container.hidden = false;
    const editor = mountDataEditor(container, {
      id,
      state,
      allowGroup,
      dataOverride,
      apply: (next) => {
        ui.dataPage = 0;
        apply(next);
        root.scrollIntoView({ behavior: "smooth", block: "start" });
      },
    });
    if (file) editor.querySelector("#csv-file").click();
    else editor.querySelector("#csv-text").focus();
  };
  root.querySelector("#upload-csv").onclick = () => open(true);
  root.querySelector("#paste-data").onclick = () => open(false);
  root.querySelector("#analyze-data").onclick = analyze;
  root
    .querySelector("#probability-data-mode")
    ?.addEventListener("change", (e) => {
      ui.dataPage = 0;
      update({ mode: e.target.value });
    });
  for (const [key, offset] of [
    ["prev", -1],
    ["next", 1],
  ])
    root.querySelector(`#data-${key}`)?.addEventListener("click", () => {
      ui.dataPage = page + offset;
      renderDataTab(root, {
        id,
        state,
        sample,
        apply,
        analyze,
        update,
        allowGroup,
        dataOverride,
        ui,
      });
    });
}

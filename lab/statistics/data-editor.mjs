import { esc, table } from "./shared/ui.mjs";
import { parseDelimited, serializeCSV } from "./shared/csv.mjs";
import {
  currentData,
  dataKinds,
  applyData,
} from "./shared/data-model.mjs?v=20261023-sampling-unified-notes";
import { experiences } from "./experience.mjs?v=20261023-sampling-unified-notes";
export function mountDataEditor(
  container,
  { id, state, apply, allowGroup = false, dataOverride = null },
) {
  const data = dataOverride || currentData(id, state),
    kind = dataKinds[id];
  const dialog = document.createElement("section");
  dialog.className = "data-editor";
  dialog.innerHTML = `<h3>CSVの内容と使う列を確認</h3><p class="dialog-purpose">${esc(experiences[id].input)} → ${esc(experiences[id].result)}</p><div class="data-editor-grid"><section><div class="actions"><button type="button" id="csv-file-button">CSV・TSVファイルを選ぶ</button><input type="file" id="csv-file" accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values" hidden><button type="button" id="csv-download">現在のデータをCSV保存</button></div><label class="control" for="csv-text"><span>または、表計算ソフトのセルをここへ貼り付ける</span><textarea id="csv-text" rows="8" spellcheck="false">${esc(serializeCSV(data.headers, data.rows))}</textarea></label><label class="check-line"><input id="csv-header" type="checkbox" checked> 1行目は項目名</label><div id="csv-preview" class="csv-preview"></div></section><aside><label class="control" for="csv-name"><span>データの名前</span><input id="csv-name" type="text" maxlength="120" value="${esc(data.name)}"></label><div id="csv-columns"></div><p class="data-format">${kind === "probability" ? (state.mode === "coin" ? "1列に表=1・裏=0を試行順で指定。理論の確率pと読み込んだ結果を比較します。" : state.mode === "binomial" ? `1列に1セットの成功回数（0〜${state.n}の整数）。理論の二項分布と比較します。` : "1列に測定値。正規分布モデルと、実際に区間へ入った割合を比較します。正規分布への適合を保証するものではありません。") : kind === "series" ? "月別の値を48か月分。最初の36か月で予測し、最後の12か月を検証に使います。" : kind === "counts" ? "「集団,方式,成功数,不成功数」の4列。2集団×2方式を1行ずつ、合計4行。" : kind === "ab" ? "「群,対象数,成功数」の3列・2行。対象数は各10〜1,000人。" : kind === "population" ? "各行を母集団の1人分として使います。数値の列を1つ選びます。2〜300行。" : kind === "incomes" ? "2〜300人分。所得は0以上。読込後に総額を保って再分配できます。" : "2〜300行。空欄・文字列・読み込めない行は省略せず、エラーとしてお知らせします。"}</p><p class="muted">データはブラウザ内で処理します。</p><p id="csv-status" role="status"></p><button id="csv-apply" class="primary" type="button">このデータで分析する</button></aside></div>`;
  container.replaceChildren(dialog);
  let headers = [],
    rows = [],
    filename = "",
    selection = {};
  const opt = (label, key, none = false) =>
    `<label class="control" for="csv-${key}"><span>${label}</span><select id="csv-${key}">${none ? '<option value="-1">使わない</option>' : ""}${headers.map((h, i) => `<option value="${i}" ${selection[key] === i ? "selected" : ""}>${esc(h)}</option>`).join("")}</select></label>`;
  function parse(reset = false) {
    try {
      const all = parseDelimited(dialog.querySelector("#csv-text").value);
      if (!all.length) throw Error("データを入力してください。");
      const hasHeader = dialog.querySelector("#csv-header").checked;
      headers = hasHeader ? all[0] : all[0].map((_, i) => `項目${i + 1}`);
      rows = hasHeader ? all.slice(1) : all;
      const length = headers.length;
      if (rows.some((r) => r.length !== length))
        throw Error(
          "列数がそろっていません。空欄や余分な区切りを確認してください。",
        );
      if (!rows.length || rows.length > (id === "probability" ? 10000 : 300))
        throw Error(
          id === "probability"
            ? "データは1〜10,000行で指定してください。"
            : "データは1〜300行で指定してください。",
        );
      if (reset || !Object.keys(selection).length) {
        const numeric = headers
          .map((_, i) =>
            rows.every((r) => r[i] !== "" && Number.isFinite(Number(r[i])))
              ? i
              : -1,
          )
          .filter((i) => i >= 0);
        selection = {
          x:
            (kind === "series"
              ? numeric.find((i) => !/月|date|month/i.test(headers[i]))
              : numeric[0]) ??
            numeric[0] ??
            0,
          y: numeric[1] ?? Math.min(1, length - 1),
          group:
            allowGroup || kind === "groups"
              ? headers.findIndex((_, i) => !numeric.includes(i))
              : -1,
          date:
            kind === "series"
              ? headers.findIndex((_, i) => !numeric.includes(i)) >= 0
                ? headers.findIndex((_, i) => !numeric.includes(i))
                : headers.findIndex((h) => /月|date|month/i.test(h))
              : -1,
        };
      }
      dialog.querySelector("#csv-preview").innerHTML =
        `<p>${rows.length}行・${headers.length}列 <small>先頭${Math.min(6, rows.length)}行を表示</small></p>${table(headers, rows.slice(0, 6))}`;
      const controls = dialog.querySelector("#csv-columns");
      controls.innerHTML =
        kind === "pairs"
          ? opt("横軸 x に使う列", "x") +
            opt("縦軸 y に使う列", "y") +
            (allowGroup ? opt("集団を分ける列（任意）", "group", true) : "")
          : [
                "values",
                "incomes",
                "groups",
                "population",
                "series",
                "probability",
              ].includes(kind)
            ? opt(
                kind === "series" ? "月ごとの値に使う列" : "分析する数値の列",
                "x",
              ) +
              (kind === "groups"
                ? opt("集団を分ける列（任意）", "group", true)
                : kind === "series"
                  ? opt("月のラベルの列（任意）", "date", true)
                  : "")
            : "";
      controls.querySelectorAll("select").forEach((el) => {
        const key = el.id.replace("csv-", "");
        if (selection[key] === -1) el.value = "-1";
        el.onchange = () => {
          selection[key] = Number(el.value);
        };
      });
      dialog.querySelector("#csv-status").textContent = "";
      dialog.querySelector("#csv-apply").disabled = false;
    } catch (e) {
      dialog.querySelector("#csv-status").textContent = e.message;
      dialog.querySelector("#csv-apply").disabled = true;
    }
  }
  const inferHeader = () => {
    try {
      const first =
        parseDelimited(dialog.querySelector("#csv-text").value)[0] || [];
      dialog.querySelector("#csv-header").checked = !first.some(
        (v) => v !== "" && Number.isFinite(Number(v)),
      );
    } catch {}
  };
  dialog.querySelector("#csv-text").addEventListener("input", () => {
    inferHeader();
    parse(true);
  });
  dialog.querySelector("#csv-header").onchange = () => parse(true);
  dialog.querySelector("#csv-file-button").onclick = () =>
    dialog.querySelector("#csv-file").click();
  dialog.querySelector("#csv-file").onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      if (f.size > 1000000) throw Error("ファイルは1MB以内にしてください。");
      filename = f.name;
      dialog.querySelector("#csv-name").value = f.name.replace(/\.[^.]+$/, "");
      const text = await f.text();
      if (text.includes("\uFFFD"))
        throw Error(
          "文字を読み取れません。UTF-8形式のCSV・TSVとして保存してください。",
        );
      dialog.querySelector("#csv-text").value = text;
      inferHeader();
      parse(true);
      dialog.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      dialog.querySelector("#csv-status").textContent = error.message;
    }
  };
  dialog.querySelector("#csv-download").onclick = () =>
    downloadCSV("statistics-data.csv", data.headers, data.rows);
  dialog.querySelector("#csv-apply").onclick = () => {
    try {
      const next = applyData(id, state, {
        headers,
        rows,
        name: dialog.querySelector("#csv-name").value.trim() || "自分のデータ",
        filename,
        ...selection,
      });
      apply(next);
      container.hidden = true;
    } catch (e) {
      dialog.querySelector("#csv-status").textContent = e.message;
    }
  };
  parse(true);
  return dialog;
}
export function downloadCSV(name, headers, rows) {
  const url = URL.createObjectURL(
      new Blob(["\uFEFF" + serializeCSV(headers, rows)], {
        type: "text/csv;charset=utf-8",
      }),
    ),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

import { readDataset, saveDataset, defaultDataset } from "./shared/data.mjs";
import { esc, table } from "./shared/ui.mjs";
import { mean, median, sd, regression, fmt } from "./shared/math.mjs";
import { openDataEditor, downloadCSV } from "./data-editor.mjs";
import correlation from "./correlation/lab.mjs";
const root = document.querySelector("#project-root");
let dataset = readDataset();
const start = new URLSearchParams(location.search).get("start");
let active =
  start === "data" ? "data" : start === "records" ? "records" : "analysis";
let notes = {};
try {
  notes = JSON.parse(
    localStorage.getItem("study-atlas-statistics-project-notes-v1") || "{}",
  );
} catch {}
function draw() {
  document.querySelector(".workspace-heading>div>p").textContent =
    dataset.origin === "sample"
      ? "学習時間が長いほど高得点か。分布・代表値・相関の3方向で確かめる。"
      : "同じデータを分布・代表値・相関で調べ、根拠を持って結論をまとめる。";
  document.querySelector(".workspace-intro").textContent =
    dataset.origin === "sample"
      ? "学習時間が長い人ほど高得点でしょうか。まず架空の24人のデータを確認し、問いに合うラボを選んで調べます。結果を持ち帰って見比べ、データから言えること・言えないことを整理しましょう。自分の2列の数値データでも取り組めます。"
      : `「${dataset.xLabel}」と「${dataset.yLabel}」には、どのような特徴や関係があるでしょうか。同じデータを各ラボへ引き継ぎ、分布・代表値・相関のうち、問いに合う方法で調べます。結果を記録し、根拠と限界を含めた結論をまとめましょう。`;
  let records = {};
  try {
    records = JSON.parse(
      localStorage.getItem("study-atlas-statistics-results-v1") || "{}",
    );
  } catch {}
  const r = regression(dataset.rows),
    ys = dataset.rows.map((p) => p.y),
    origin =
      dataset.origin === "sample"
        ? "教材サンプル・架空"
        : dataset.origin === "user"
          ? "自分のデータ"
          : "保存したデータ";
  root.innerHTML = `<section class="data-summary"><div><strong>${origin}：${esc(dataset.name)}</strong><p>${dataset.rows.length}行 ／ ${esc(dataset.xLabel)} ・ ${esc(dataset.yLabel)} ／ 集団：${esc([...new Set(dataset.rows.map((r) => r.group))].join("・"))}</p></div><div class="actions"><button id="project-import" class="primary">自分のCSV・表データを使う</button><button id="project-reset">サンプルに戻す</button></div></section><p class="analysis-flow">処理：共通の2列を選ぶ → 分布・代表値・相関で分析 → 結果を記録して結論をまとめる</p><nav class="view-tabs project-tabs" aria-label="分析課題の手順">${[
    ["data", "1. データを確認"],
    ["analysis", "2. 分析方法を選ぶ"],
    ["records", "3. 記録・結論"],
  ]
    .map(
      ([id, label]) =>
        `<button data-project-tab="${id}" aria-pressed="${id === active}">${label}</button>`,
    )
    .join("")}</nav><section class="project-workspace">${
    active === "data"
      ? `<div class="project-data-grid"><section class="project-surface"><h2>使用するデータ</h2><p>同じ行の2つの数値が対応するデータです。項目名・単位は読み込んだ列をそのまま使います。</p>${table(
          ["番号", dataset.xLabel, dataset.yLabel, "集団"],
          dataset.rows.map((r, i) => [i + 1, r.x, r.y, r.group]),
        )}</section><aside class="project-surface"><h2>読み込んだ後、何ができる？</h2><ol><li>各項目がどこに集まるかを分布で見る</li><li>平均・中央値とばらつきを比べる</li><li>2項目の関係を散布図と回帰で調べる</li></ol><p class="annotation">各ラボへは、この表と項目名を引き継ぎます。ラボ内で点を動かしても、ここにある元データは変わりません。</p><div class="actions"><button id="project-next" class="primary">このデータで分析を選ぶ</button><button id="project-csv">共通データをCSV保存</button></div><p class="muted">2〜300行。任意の2つの数値列と、集団列（任意）を選択できます。</p></aside></div>`
      : active === "analysis"
        ? `<div class="analysis-choices"><article><h2>分布を調べる</h2><p>山が1つか、集団で違いがあるか。階級幅を変えて、全体像を確かめます。</p><dl><dt>入力</dt><dd>${esc(dataset.yLabel)} ${dataset.rows.length}件</dd><dt>結果</dt><dd>ヒストグラム・度数分布表</dd></dl><a class="button primary" href="../histogram/?dataset=project&field=y">${esc(dataset.yLabel)}の分布を見る</a><a class="text-link" href="../histogram/?dataset=project&field=x">${esc(dataset.xLabel)}で調べる</a></article><article><h2>代表値とばらつきを比べる</h2><p>「ふつう」を平均だけで説明できるか。中央値・標準偏差と合わせて読みます。</p><dl><dt>入力</dt><dd>${esc(dataset.yLabel)} ${dataset.rows.length}件</dd><dt>現在</dt><dd>平均 ${fmt(mean(ys))} ／ 中央値 ${fmt(median(ys))}<br>標準偏差 ${fmt(sd(ys))}</dd></dl><a class="button primary" href="../summary/?dataset=project&field=y">${esc(dataset.yLabel)}の代表値を見る</a><a class="text-link" href="../summary/?dataset=project&field=x">${esc(dataset.xLabel)}で調べる</a></article><article><h2>2つの量の関係を調べる</h2><p>点の並びと外れ値を確かめ、直線による予測と誤差を比較します。</p><dl><dt>入力</dt><dd>${esc(dataset.xLabel)} × ${esc(dataset.yLabel)}</dd><dt>現在</dt><dd>相関係数 r = ${fmt(r.r, 3)}</dd></dl><a class="button primary" href="../correlation/?dataset=project">散布図・回帰で調べる</a></article></div><p class="project-caution">分析で見えるのは、このデータ内の特徴です。関連があっても因果関係の証明にはなりません。各ラボの「記録・保存」から分析結果を記録できます。</p>`
        : `<div class="project-record-grid"><section class="project-surface"><h2>問い・根拠・限界・結論を残す</h2><div class="project-note-grid">${[
            ["purpose", "調べたいこと・予想"],
            ["evidence", "結果と根拠"],
            ["limits", "言えないこと・追加で必要な情報"],
            ["decision", "結論とその理由"],
          ]
            .map(
              ([id, label]) =>
                `<label class="control" for="note-${id}"><span>${label}</span><textarea id="note-${id}" data-project-note="${id}" rows="3">${esc(notes[id] || "")}</textarea></label>`,
            )
            .join(
              "",
            )}</div><button id="download-report" class="primary">分析レポートを保存</button></section><aside class="project-surface"><div class="record-heading"><h2>ラボで記録した結果</h2><button id="refresh-results">更新</button></div>${
            Object.values(records).length
              ? Object.values(records)
                  .map(
                    (v) =>
                      `<details class="analysis-record"><summary>${esc(v.title)}</summary>${v.data ? `<p><strong>${esc(v.data.name)}</strong><br>${v.data.rows.length}行：${esc(v.data.headers.join("・"))}</p><p>処理：${esc(v.data.operation)}</p>${v.data.edits ? `<p>元データから${v.data.edits}行を変更した実験です。</p>` : ""}` : "<p>以前の記録です。使用データは記録されていません。</p>"}<p>${(v.metrics || []).map((m) => esc(m).replaceAll("\n", "：")).join("<br>")}</p><p>${esc(v.note || "")}</p></details>`,
                  )
                  .join("")
              : "<p>各ラボの「記録・保存」→「分析課題に記録」で、使用したデータ・処理・結果がここに表示されます。</p>"
          }<button id="clear-results">分析結果の記録を消す</button></aside></div>`
  }</section><p id="project-status" class="stat-status" role="status">${active === "data" ? "読み込みはファイル選択・コピーしたセルの貼り付けに対応しています。" : "データと記録は、このブラウザ内に保存します。"}</p>`;
  root.querySelectorAll("[data-project-tab]").forEach(
    (b) =>
      (b.onclick = () => {
        active = b.dataset.projectTab;
        draw();
      }),
  );
  root.querySelector("#project-import").onclick = () => {
    const state = {
      ...correlation.initial(),
      points: dataset.rows.map((r, i) => ({ ...r, id: "u" + i })),
      selectedId: "u0",
      xLabel: dataset.xLabel,
      yLabel: dataset.yLabel,
      source: dataset.name,
    };
    openDataEditor({
      id: "correlation",
      state,
      allowGroup: true,
      dataOverride: {
        name: dataset.name,
        headers: [dataset.xLabel, dataset.yLabel, "集団"],
        rows: dataset.rows.map((r) => [r.x, r.y, r.group]),
      },
      apply: (next) => {
        dataset = saveDataset({
          name: next.dataInfo.name,
          origin: "user",
          xLabel: next.xLabel,
          yLabel: next.yLabel,
          rows: next.points.map((r) => ({ ...r, group: r.group || "全体" })),
        });
        active = "data";
        draw();
      },
    });
  };
  root.querySelector("#project-reset").onclick = () => {
    try {
      dataset = saveDataset(defaultDataset());
      draw();
    } catch (e) {
      root.querySelector("#project-status").textContent = e.message;
    }
  };
  root.querySelector("#project-csv")?.addEventListener("click", () =>
    downloadCSV(
      "analysis-data.csv",
      [dataset.xLabel, dataset.yLabel, "集団"],
      dataset.rows.map((r) => [r.x, r.y, r.group]),
    ),
  );
  root.querySelector("#project-next")?.addEventListener("click", () => {
    active = "analysis";
    draw();
  });
  root.querySelector("#refresh-results")?.addEventListener("click", draw);
  root.querySelector("#clear-results")?.addEventListener("click", () => {
    localStorage.removeItem("study-atlas-statistics-results-v1");
    draw();
  });
  root.querySelectorAll("[data-project-note]").forEach(
    (el) =>
      (el.oninput = () => {
        notes[el.dataset.projectNote] = el.value;
        try {
          localStorage.setItem(
            "study-atlas-statistics-project-notes-v1",
            JSON.stringify(notes),
          );
        } catch {}
      }),
  );
  root.querySelector("#download-report")?.addEventListener("click", () => {
    const text = `データ分析レポート\n使用データ：${dataset.name}\n項目：${dataset.xLabel}・${dataset.yLabel}\n${dataset.rows.length}行\n\n${[
      ["purpose", "問い・予想"],
      ["evidence", "結果・根拠"],
      ["limits", "限界"],
      ["decision", "結論"],
    ]
      .map(([id, label]) => `${label}\n${notes[id] || ""}`)
      .join("\n\n")}\n\n${Object.values(records)
      .map(
        (v) =>
          `${v.title}\n${v.data ? "使用データ：" + v.data.name + "\n処理：" + v.data.operation + "\n" : ""}${v.metrics.join("\n")}\n${v.note || ""}`,
      )
      .join("\n\n")}`;
    const url = URL.createObjectURL(
        new Blob(["\uFEFF" + text], { type: "text/plain;charset=utf-8" }),
      ),
      a = document.createElement("a");
    a.href = url;
    a.download = "analysis-report.txt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}
document.querySelector("#lab-picker").onchange = (e) =>
  (location.href = `../${e.target.value}/`);
draw();
if (start === "data") root.querySelector("#project-import").click();

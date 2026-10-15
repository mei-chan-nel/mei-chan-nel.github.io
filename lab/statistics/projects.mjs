import { readDataset, saveDataset, defaultDataset } from "./shared/data.mjs";
import { esc, table } from "./shared/ui.mjs";
import { mean, regression, fmt } from "./shared/math.mjs";
const root = document.querySelector("#project-root");
let dataset = readDataset(),
  error = "";
let notes = {};
try {
  notes = JSON.parse(
    localStorage.getItem("study-atlas-statistics-project-notes-v1") || "{}",
  );
} catch {}
function draw() {
  const r = regression(dataset.rows);
  let records = {};
  try {
    records = JSON.parse(
      localStorage.getItem("study-atlas-statistics-results-v1") || "{}",
    );
  } catch {}
  root.innerHTML = `<section class="panel"><h2>まず、問いをはっきりさせる。</h2><p>ある学年の${dataset.rows.length}人に、1週間の学習時間と確認テストの得点を調べたとします。<b>「学習時間が長い人ほど得点が高い」と言えるでしょうか。</b>また、学習時間を増やせば誰でも得点が上がると結論できるでしょうか。</p><p class="hint">すべて教材用の架空データです。A組・B組は、習熟度や授業条件が異なる可能性のある集団です。無作為抽出や無作為割付を行った実際の調査ではありません。</p><div class="annotation">平均だけで判断する前に分布を、相関だけで判断する前に集団や外れ値を確かめよう。操作で作った変化は、現実の因果関係を証明しません。</div></section><div class="stat-grid"><section class="panel"><h2>1. 共通データを準備する</h2><p>${esc(dataset.name)}</p><p class="hint">1行に「学習時間, 得点, 組」を入力。2〜300行。データを変更したら「このデータを使う」でラボに引き継ぎます。</p><label class="control" for="dataset-text"><span>共通データ（時間, 得点, 組）</span><textarea id="dataset-text" rows="10" spellcheck="false">${esc(dataset.rows.map((r) => `${r.x}, ${r.y}, ${r.group}`).join("\n"))}</textarea></label><div class="actions" style="margin-top:12px"><button id="apply-dataset" class="primary">このデータを使う</button><button id="restore-dataset">初期データに戻す</button><button id="download-dataset">CSV書き出し</button></div><p id="project-status" class="${error ? "error" : "hint"}" role="status">${esc(error || "入力データはブラウザ内だけで扱います。")}</p></section><aside class="panel"><h2>データの概要</h2>${table(
    ["項目", "値"],
    [
      ["人数", dataset.rows.length],
      ["平均学習時間", fmt(mean(dataset.rows.map((d) => d.x))) + " 時間"],
      ["平均得点", fmt(mean(dataset.rows.map((d) => d.y))) + " 点"],
      ["相関係数 r", fmt(r.r, 3)],
      ["集団", [...new Set(dataset.rows.map((d) => d.group))].join("・")],
    ],
  )}<p class="hint">この数値だけでは分布の形・例外的な点・集団の違いがわかりません。ラボで見えるようにしましょう。</p></aside></div><h2>2. 目的に合った分析を選ぶ</h2><div class="project-steps"><article class="panel"><p class="eyebrow">DISTRIBUTION</p><h3>得点は、どこに集まる？</h3><p>階級幅を変え、組ごとの分布も調べる。平均の周辺に全員が集まっている？</p><a class="button primary" href="./../histogram/?dataset=project&field=y">分布を調べる →</a><p><a href="../histogram/?dataset=project&field=x">学習時間の分布も見る</a></p></article><article class="panel"><p class="eyebrow">SUMMARY</p><h3>代表値で、何が伝わる？</h3><p>平均・中央値・四分位数・ばらつきを比べる。外れ値で評価は変わる？</p><a class="button primary" href="../summary/?dataset=project&field=y">代表値を調べる →</a><p><a href="../summary/?dataset=project&field=x">学習時間の代表値も見る</a></p></article><article class="panel"><p class="eyebrow">RELATIONSHIP</p><h3>2つの量に、関係はある？</h3><p>散布図で点の位置を確かめる。回帰予測の誤差や、集団の違いも検討する。</p><a class="button primary" href="../correlation/?dataset=project">相関・回帰を調べる →</a></article></div><section class="panel"><h2>3. 証拠を持ち寄り、判断する</h2><p>各ラボの「分析課題に記録」で、その時点の統計量とミッションの記録をここに残せます。ラボでの自由な変更は、共通の元データには反映されません。</p><button id="refresh-results">分析記録を更新</button><div style="margin-top:16px">${
    Object.keys(records).length
      ? Object.values(records)
          .map(
            (v) =>
              `<details class="panel" open><summary>${esc(v.title)}</summary><p class="hint">${esc(new Date(v.time).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }))}</p><p>${(v.metrics || []).map((m) => esc(m).replaceAll("\n", "：")).join(" ／ ")}</p><p style="white-space:pre-wrap">${esc(v.note || "ミッションの記録なし")}</p></details>`,
          )
          .join("")
      : '<p class="hint">まだ分析記録はありません。必要なラボから調べてみよう。</p>'
  }</div><div class="project-notes">${[
    ["purpose", "予想・調べたいこと"],
    ["evidence", "分析でわかったこと（統計量・グラフを根拠に）"],
    ["limits", "言えないこと・追加で必要なデータ"],
    ["decision", "結論と、その理由"],
  ]
    .map(
      ([id, label]) =>
        `<label for="note-${id}">${label}<textarea id="note-${id}" data-project-note="${id}" rows="3">${esc(notes[id] || "")}</textarea></label>`,
    )
    .join(
      "",
    )}</div><div class="actions"><button id="download-report" class="primary">分析レポートを書き出す</button><button id="clear-results">分析記録を消去</button></div><p class="hint">ミッション：①分析前の予想を記録する。②組別と全体で分布を比較する。③代表値・相関の両方を根拠にして、因果関係についての限界も説明する。</p></section><p><a class="button" href="../">← 統計ラボ一覧</a></p>`;
  root.querySelector("#apply-dataset").onclick = () => {
    try {
      const lines = root
          .querySelector("#dataset-text")
          .value.trim()
          .split(/\n/),
        rows = lines.map((line, i) => {
          const fields = line.split(/[,\t]/).map((s) => s.trim());
          if (fields.length < 2 || fields[0] === "" || fields[1] === "")
            throw Error(`${i + 1}行目を確認してください。`);
          return {
            x: Number(fields[0]),
            y: Number(fields[1]),
            group: fields[2] || "全体",
          };
        });
      dataset = saveDataset({
        ...dataset,
        name: `自分で編集した学習時間と確認テスト（架空の${rows.length}人）`,
        rows,
      });
      error = "";
      draw();
      root.querySelector("#project-status").textContent =
        "共通データを更新しました。各ラボのリンクから読み込めます。";
    } catch (e) {
      error = e.message;
      root.querySelector("#project-status").textContent = error;
    }
  };
  root.querySelector("#restore-dataset").onclick = () => {
    try {
      dataset = saveDataset(defaultDataset());
      error = "";
      draw();
    } catch (e) {
      error = e.message;
      draw();
    }
  };
  root.querySelector("#download-dataset").onclick = () =>
    download(
      "statistics-project.csv",
      "学習時間,得点,組\n" +
        dataset.rows
          .map((r) => `${r.x},${r.y},"${r.group.replaceAll('"', '""')}"`)
          .join("\n"),
      "text/csv",
    );
  root.querySelector("#refresh-results").onclick = draw;
  root.querySelector("#clear-results").onclick = () => {
    try {
      localStorage.removeItem("study-atlas-statistics-results-v1");
      draw();
    } catch {}
  };
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
  root.querySelector("#download-report").onclick = () =>
    download(
      "statistics-analysis-report.txt",
      `統計・データ分析レポート\n${dataset.name}\n\n${Object.entries(notes)
        .map(
          ([k, v]) =>
            `${{ purpose: "問いと予想", evidence: "根拠", limits: "限界", decision: "結論" }[k]}\n${v}`,
        )
        .join("\n\n")}\n\n分析記録\n${Object.values(records)
        .map((v) => v.title + "\n" + v.metrics.join("\n") + "\n" + v.note)
        .join("\n\n")}`,
      "text/plain",
    );
}
function download(name, text, type) {
  const url = URL.createObjectURL(
      new Blob(["\uFEFF" + text], { type: type + ";charset=utf-8" }),
    ),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
draw();

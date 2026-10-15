import { esc } from "./shared/ui.mjs";
import { validateDocument } from "./shared/validation.mjs";
import { currentData, restoreInput } from "./shared/data-model.mjs";
import { composeWorkbench } from "./workbench.mjs";
import { openDataEditor } from "./data-editor.mjs";
import { normalizeExperiment } from "./sampling/model.mjs";
import { readDataset } from "./shared/data.mjs";
import { experiences } from "./experience.mjs";
import { renderAcademicExplanation } from "./shared/explanation.mjs";
import { fitWorkspaceCharts } from "./shared/chart-layout.mjs";
const id = document.body.dataset.statLab;
const config = (await import(`./${id}/lab.mjs?v=20261015-ui3`)).default;
const clone = (x) => JSON.parse(JSON.stringify(x));
const ui = { view: 0, openSections: {} };
function prepare(next) {
  if (id === "sampling") next = normalizeExperiment(next);
  if (!next.dataInfo) {
    const data = currentData(id, next);
    const projectData = project ? readDataset() : null;
    next.dataInfo = {
      name: data.name,
      origin: project
        ? projectData.origin === "user"
          ? "user"
          : "project"
        : restoredLegacy
          ? "saved"
          : data.origin,
      columns: data.headers,
      baseline: clone(data.rows),
    };
  }
  return next;
}
const key = `study-atlas-statistics-${id}-v1`,
  project = new URLSearchParams(location.search).get("dataset") === "project";
let restoredLegacy = false;
let state = config.initial(),
  snapshot = null,
  notes = {};
try {
  const saved = JSON.parse(localStorage.getItem(key));
  if (saved && !project) {
    validateDocument(saved, id, config.initial());
    state = saved.state;
    restoredLegacy = !saved.state.dataInfo;
    snapshot = saved.snapshot || null;
    notes = saved.notes || {};
  }
} catch {}
state = prepare(state);
restoredLegacy = false;
const root = document.querySelector("#experiment"),
  status = document.querySelector("#stat-status");
const statusText = (s) => {
  status.textContent = s;
};
function persist() {
  try {
    localStorage.setItem(
      key,
      JSON.stringify({ version: 1, id, state, snapshot, notes }),
    );
    statusText("操作と記録は、このブラウザに自動保存されます。");
  } catch {
    statusText("ブラウザ保存を利用できません。「JSON保存」で実験を残せます。");
  }
}
function draw() {
  const active = document.activeElement,
    focus =
      active && root.contains(active)
        ? {
            id: active.id,
            start: active.selectionStart,
            end: active.selectionEnd,
          }
        : null;
  try {
    config.render(root, {
      state,
      update: (patch) => {
        state = prepare({ ...state, ...patch });
        persist();
        draw();
      },
      replace: (next) => {
        state = prepare(next);
        persist();
        draw();
      },
    });
    const views = composeWorkbench(root, id, ui, draw) || [];
    fitWorkspaceCharts(root.querySelector(".workbench-display"));
    const tabs = document.querySelector("#view-tabs");
    tabs.innerHTML = views
      .map(
        (v, i) =>
          `<button type="button" data-view="${i}" aria-pressed="${v.active}">${esc(v.label)}</button>`,
      )
      .join("");
    tabs
      .querySelectorAll("button")
      .forEach((b, i) => (b.onclick = views[i].choose));
    const data = currentData(id, state);
    const origin =
      {
        sample: "教材サンプル・架空",
        user: "自分のデータ",
        project: "横断課題の共通データ",
        model: "確率モデル",
      }[data.origin] || "保存したデータ";
    document.querySelector("#data-name").textContent =
      `${origin}：${data.origin === "sample" ? data.name.replace(/^架空の/, "") : data.name}`;
    document.querySelector("#reset").textContent =
      data.origin === "user"
        ? "読み込み直後に戻す"
        : project
          ? "課題の元データに戻す"
          : "初期化";
    document.querySelector("#data-description").textContent =
      id === "probability"
        ? state.mode === "normal"
          ? "右の平均・標準偏差・区間の条件から、理論分布を描きます。"
          : "右の確率・試行回数の条件から、実験データを生成します。"
        : (id === "probability"
            ? ""
            : `${data.rows.length}${id === "correlation" ? "組" : "行"} ／ `) +
          data.headers.join(" ・ ") +
          (id === "hypothesis-test"
            ? ` ／ A＝${data.rows[0][0]}・B＝${data.rows[1][0]}`
            : "") +
          (data.edits ? ` ／ 元データから${data.edits}行を変更` : "") +
          (data.filename ? ` ／ ${data.filename}` : "");
    document.querySelector("#lab-lead").textContent =
      data.origin === "sample" ? config.lead : experiences[id].firstTry;
    document.querySelector("#analysis-flow").textContent =
      "処理：" + data.operation;
    if (focus?.id) {
      const target = document.getElementById(focus.id);
      if (target) {
        target.focus({ preventScroll: true });
        if (
          typeof target.setSelectionRange === "function" &&
          focus.start !== null
        )
          try {
            target.setSelectionRange(focus.start, focus.end);
          } catch {}
      }
    }
  } catch (e) {
    root.innerHTML = `<div class="panel error">実験データを表示できません。「初期化」で初期データに戻せます。<p>${esc(e.message)}</p></div>`;
    console.error(e);
  }
  drawSnapshot();
}
function drawSnapshot() {
  const box = document.querySelector("#comparison");
  box.hidden = !snapshot;
  document.querySelector("#comparison-empty").hidden = Boolean(snapshot);
  if (!snapshot) return;
  box.innerHTML =
    '<h2>比較のために残した実験</h2><p class="hint">操作前の条件と結果です。上の実験を変えて見比べてください。</p><div class="frozen"></div>';
  try {
    config.render(box.querySelector(".frozen"), {
      state: clone(snapshot),
      update: () => {},
      replace: () => {},
    });
    composeWorkbench(
      box.querySelector(".frozen"),
      id,
      { view: ui.view, openSections: {} },
      () => {},
    );
    fitWorkspaceCharts(box.querySelector(".workbench-display"));
    const ids = new Map(
      [...box.querySelectorAll("[id]")].map((el) => [
        el.id,
        "snapshot-" + el.id,
      ]),
    );
    box.querySelectorAll("[id]").forEach((el) => (el.id = ids.get(el.id)));
    box.querySelectorAll("*").forEach((el) => {
      for (const attr of [...el.attributes]) {
        let v = attr.value;
        for (const [before, after] of ids) {
          v = v.replaceAll("url(#" + before + ")", "url(#" + after + ")");
          if (
            [
              "for",
              "aria-controls",
              "aria-labelledby",
              "aria-describedby",
            ].includes(attr.name)
          )
            v = v
              .split(" ")
              .map((t) => (t === before ? after : t))
              .join(" ");
          if (v === "#" + before) v = "#" + after;
        }
        if (v !== attr.value) el.setAttribute(attr.name, v);
      }
    });
    box.querySelectorAll("button,input,select,textarea,a").forEach((el) => {
      el.tabIndex = -1;
      el.setAttribute("disabled", "");
    });
  } catch {
    box.innerHTML = "<p>保存した比較データは表示できません。</p>";
  }
}
function drawMissions() {
  document.querySelector("#mission-list").innerHTML = (config.missions || [])
    .map(
      (m, i) =>
        `<article class="mission-card"><span class="mission-no">0${i + 1}</span><h3>${esc(m.title)}</h3><p>${esc(m.body)}</p>${m.preset ? `<button type="button" data-mission="${i}">教材サンプルをセット</button>` : ""}<label>予想と、実験からわかったこと<textarea data-note="${i}" placeholder="予想 → 操作 → 結果 → その理由">${esc(notes[i] || "")}</textarea></label><label><span><input type="checkbox" data-done="${i}" ${notes["done" + i] ? "checked" : ""}> 結果を比べ、理由を記録した</span></label></article>`,
    )
    .join("");
  document.querySelectorAll("[data-mission]").forEach(
    (b) =>
      (b.onclick = () => {
        state = prepare({
          ...config.initial(),
          ...clone(config.missions[+b.dataset.mission].preset),
          dataInfo: null,
        });
        ui.view = 0;
        persist();
        draw();
        root.scrollIntoView({ behavior: "smooth", block: "start" });
      }),
  );
  document.querySelectorAll("[data-note]").forEach(
    (t) =>
      (t.oninput = () => {
        notes[t.dataset.note] = t.value;
        persist();
      }),
  );
  document.querySelectorAll("[data-done]").forEach(
    (t) =>
      (t.onchange = () => {
        notes["done" + t.dataset.done] = t.checked;
        persist();
      }),
  );
}
renderAcademicExplanation(
  document.querySelector("#explanation-body"),
  config.explanation,
);
document.querySelector("#reset").onclick = () => {
  state = prepare(
    state.dataInfo?.origin === "user"
      ? restoreInput(id, state, config.initial())
      : config.initial(),
  );
  ui.view = 0;
  persist();
  draw();
};
document.querySelector("#capture").onclick = () => {
  snapshot = clone(state);
  persist();
  drawSnapshot();
  statusText("現在の条件と結果を比較欄へ残しました。");
};
document.querySelector("#clear-compare").onclick = () => {
  snapshot = null;
  persist();
  drawSnapshot();
};
document.querySelector("#record").onclick = () => {
  try {
    const records = JSON.parse(
      localStorage.getItem("study-atlas-statistics-results-v1") || "{}",
    );
    records[id] = {
      title: config.title,
      data: currentData(id, state),
      metrics: [...root.querySelectorAll(".metrics>div")].map(
        (el) => el.innerText,
      ),
      note: Object.values(notes)
        .filter((v) => typeof v === "string")
        .join("\n"),
      time: new Date().toISOString(),
    };
    localStorage.setItem(
      "study-atlas-statistics-results-v1",
      JSON.stringify(records),
    );
    statusText(
      "分析課題に結果を記録しました。課題ページの「分析記録」で確認できます。",
    );
  } catch {
    statusText(
      "ブラウザ保存が利用できないため記録できません。JSON保存を利用してください。",
    );
  }
};
document.querySelector("#export").onclick = () => {
  const blob = new Blob(
      [JSON.stringify({ version: 1, id, state, snapshot, notes }, null, 2)],
      { type: "application/json" },
    ),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = `statistics-${id}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
document.querySelector("#import").onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    if (file.size > 1000000) throw Error("ファイルは1MB以内にしてください。");
    const d = JSON.parse(await file.text());
    validateDocument(d, id, config.initial());
    state = prepare(d.state);
    snapshot = d.snapshot || null;
    notes = d.notes && typeof d.notes === "object" ? d.notes : {};
    persist();
    draw();
    drawMissions();
    statusText("実験を読み込みました。");
  } catch (err) {
    statusText("読込できません：" + err.message);
  }
  e.target.value = "";
};

document.querySelector("#lab-picker").onchange = (e) =>
  (location.href = `../${e.target.value}/`);
document.querySelector("#open-data").onclick = () => {
  if (id === "probability") {
    root
      .querySelector(".workbench-controls input")
      ?.focus({ preventScroll: true });
    return;
  }
  openDataEditor({
    id,
    state,
    apply: (next) => {
      state = prepare(next);
      ui.view = 0;
      persist();
      draw();
      statusText(
        "データを読み込みました。使用中の列と処理を上部で確認できます。",
      );
    },
  });
};
if (id === "probability")
  document.querySelector("#open-data").textContent = "モデルの条件を変える";
document.querySelector("#show-tools").onclick = () =>
  document.querySelector("#tools-dialog").showModal();
document.querySelector("#show-comparison").onclick = () => {
  const panel = document.querySelector("#comparison-panel");
  panel.hidden = false;
  panel.open = true;
  drawSnapshot();
  panel.scrollIntoView({ behavior: "smooth", block: "start" });
};
document.querySelector("#import-button").onclick = () =>
  document.querySelector("#import").click();
drawMissions();
draw();
statusText(
  project
    ? "横断課題のデータを読み込みました。ラボでの変更は課題の元データに影響しません。"
    : "開いた直後から自由に実験できます。操作はブラウザに自動保存されます。",
);

let layoutTimer;
window.addEventListener("resize", () => {
  clearTimeout(layoutTimer);
  layoutTimer = setTimeout(draw, 120);
});

import { esc } from "./shared/ui.mjs";
import { validateDocument } from "./shared/validation.mjs";
const id = document.body.dataset.statLab;
const config = (await import(`./${id}/lab.mjs`)).default;
const clone = (x) => JSON.parse(JSON.stringify(x));
const key = `study-atlas-statistics-${id}-v1`,
  project = new URLSearchParams(location.search).get("dataset") === "project";
let state = config.initial(),
  snapshot = null,
  notes = {};
try {
  const saved = JSON.parse(localStorage.getItem(key));
  if (saved && !project) {
    validateDocument(saved, id, config.initial());
    state = saved.state;
    snapshot = saved.snapshot || null;
    notes = saved.notes || {};
  }
} catch {}
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
        state = { ...state, ...patch };
        persist();
        draw();
      },
      replace: (next) => {
        state = next;
        persist();
        draw();
      },
    });
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
  if (!snapshot) return;
  box.innerHTML =
    '<h2>比較のために残した実験</h2><p class="hint">操作前の条件と結果です。上の実験を変えて見比べてください。</p><div class="frozen"></div>';
  try {
    config.render(box.querySelector(".frozen"), {
      state: clone(snapshot),
      update: () => {},
      replace: () => {},
    });
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
        `<article class="mission-card"><span class="mission-no">0${i + 1}</span><h3>${esc(m.title)}</h3><p>${esc(m.body)}</p>${m.preset ? `<button type="button" data-mission="${i}">実験の条件をセット</button>` : ""}<label>予想と、実験からわかったこと<textarea data-note="${i}" placeholder="予想 → 操作 → 結果 → その理由">${esc(notes[i] || "")}</textarea></label><label><span><input type="checkbox" data-done="${i}" ${notes["done" + i] ? "checked" : ""}> 結果を比べ、理由を記録した</span></label></article>`,
    )
    .join("");
  document.querySelectorAll("[data-mission]").forEach(
    (b) =>
      (b.onclick = () => {
        state = {
          ...state,
          ...clone(config.missions[+b.dataset.mission].preset),
        };
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
document.querySelector("#explanation-body").innerHTML = config.explanation;
document.querySelector("#lab-lead").textContent = config.lead;
document.querySelector("#reset").onclick = () => {
  state = config.initial();
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
    state = d.state;
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

drawMissions();
draw();
statusText(
  project
    ? "横断課題のデータを読み込みました。ラボでの変更は課題の元データに影響しません。"
    : "開いた直後から自由に実験できます。操作はブラウザに自動保存されます。",
);

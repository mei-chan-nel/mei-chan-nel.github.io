import {
  grade,
  normalize,
  validateExam,
  correctPatterns,
  referenceStats,
} from "./engine/scoring.mjs";
import {
  AttemptStore,
  createAttempt,
  elapsed,
  pause,
  resume,
  submit,
  startReview,
  gradeReview,
  restoreAttempt,
} from "./engine/attempt.mjs";
import { queueSubmission, sendPending } from "./engine/outbox.mjs";
import { fetchStats, fetchSubmissionConfig } from "./engine/stats.mjs";
import { mountChallenge } from "./engine/challenge.mjs";
let disposeChallenge = () => {};
const $ = (s) => document.querySelector(s),
  app = $("#app"),
  store = new AttemptStore();
let catalog = [],
  exam,
  base,
  attempt,
  sectionId,
  reviewing = false,
  solution = false,
  frame,
  selectedField,
  frameObserver,
  releaseLock,
  uiSequence = 0;
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const button = (text, fn, cls = "") => {
  const b = document.createElement("button");
  b.textContent = text;
  b.className = cls;
  b.onclick = fn;
  return b;
};
const time = (ms) => {
  const n = Math.floor(ms / 1000);
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
};
let noticeTimer;
function notify(text) {
  clearTimeout(noticeTimer);
  $("#notice").textContent = text;
  if (text === "このブラウザに保存しました")
    noticeTimer = setTimeout(() => {
      $("#notice").textContent = "";
    }, 1600);
}
function persist() {
  try {
    attempt.updatedAt = Date.now();
    store.save(attempt);
    notify("このブラウザに保存しました");
    return true;
  } catch {
    notify(
      "保存できません。履歴を書き出してから容量やブラウザの設定を確認してください。",
    );
    return false;
  }
}
function download(name, content, type = "application/json") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function entryFor(id, version) {
  const current = catalog.find((e) => e.id === id && e.version === version);
  if (current) return current;
  for (const e of catalog.filter((e) => e.id === id)) {
    const old = e.versions?.find((v) => v.version === version);
    if (old) return { ...e, ...old };
  }
  return null;
}
async function loadExam(entry) {
  base = new URL(entry.manifest, location.href);
  exam = await fetch(base).then((r) => {
    if (!r.ok) throw Error("問題データを読み込めません");
    return r.json();
  });
  validateExam(exam);
  base = new URL(".", base);
}
function ask(title, choices) {
  const d = $("#action-dialog");
  $("#action-title").textContent = title;
  $("#action-options").replaceChildren(
    ...choices.map(([t, fn]) =>
      button(t, () => {
        d.close();
        fn();
      }),
    ),
  );
  d.showModal();
}
$("#close-figure").onclick = () => $("#figure-dialog").close();
$("#close-action").onclick = () => $("#action-dialog").close();
$("#close-answer").onclick = () => $("#answer-dialog").close();
async function lockAttempt(id) {
  if (releaseLock) {
    releaseLock();
    releaseLock = null;
  }
  if (!navigator.locks) {
    notify("この受験は同時に複数のタブで開かないでください。");
    return true;
  }
  return new Promise((resolve) =>
    navigator.locks.request(
      "study-atlas-mock-" + id,
      { ifAvailable: true },
      async (lock) => {
        if (!lock) {
          resolve(false);
          return;
        }
        await new Promise((done) => {
          releaseLock = done;
          resolve(true);
        });
      },
    ),
  );
}
function leave() {
  frameObserver?.disconnect();
  if (attempt?.status === "active" && !reviewing) {
    pause(attempt);
    persist();
  }
  releaseLock?.();
  releaseLock = null;
  attempt = null;
  reviewing = false;
  solution = false;
  location.hash = "";
  renderCatalog();
}
async function renderCatalog() {
  disposeChallenge();
  uiSequence++;
  app.innerHTML =
    '<section class="intro"><p class="eyebrow">PRACTICE / INFORMATION I</p><h1>実戦で、理解を確かめる。</h1><p>60分で一回分に挑む。気になる大問を集中的に解く。<br>採点のあとも、自分のペースで解き直せる情報Ⅰの実戦模試です。</p></section><div id="exam-list"></div><section class="history-card"><h2>このブラウザの学習履歴</h2><p class="muted">履歴はこの端末に保存されます。ブラウザのデータ削除に備えて書き出して保管できます。</p><div class="actions" id="history-actions"></div><div id="history-list"></div></section>';
  $("#history-actions").append(
    button("履歴を書き出す", () =>
      download("study-atlas-mock-history.json", store.export()),
    ),
  );
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";
  input.hidden = true;
  input.onchange = async () => {
    try {
      const data = JSON.parse(await input.files[0].text());
      if (data.schemaVersion !== 1 || !Array.isArray(data.attempts))
        throw Error();
      for (const raw of data.attempts) {
        const entry = entryFor(raw.examId, raw.examVersion);
        if (!entry) throw Error();
        await loadExam(entry);
        const a = restoreAttempt(exam, raw);
        const old = store.load(a.id);
        if (!old || a.updatedAt > old.updatedAt) {
          a.startedAt = null;
          a.status = a.result ? "graded" : "paused";
          store.save(a);
        }
      }
      renderCatalog();
      notify("履歴を読み込みました");
    } catch {
      notify("履歴ファイルを読み込めませんでした。");
    }
  };
  $("#history-actions").append(
    button("履歴を読み込む", () => input.click()),
    input,
  );
  let history = [];
  try {
    history = store.list();
  } catch {
    notify("ブラウザ保存を利用できません。設定を確認してください。");
  }
  for (const entry of [...catalog].sort((a, b) => b.id.localeCompare(a.id))) {
    const runs = history.filter((a) => a.examId === entry.id),
      latest = runs[0];
    const status = !latest
      ? "未受験"
      : runs.length > 1
        ? "再受験 " + runs.length + "回"
        : latest.result
          ? "採点済み"
          : "解答途中";
    const card = document.createElement("section");
    card.className = "exam-card";
    card.innerHTML = `<p class="exam-number">No.${esc(entry.id)} · ${status}</p><h2>${esc(entry.title)}</h2><p class="muted">全5区分 · 100点 · 目安60分</p><div class="actions modes"></div><details><summary>大問を選んで解く</summary><div class="section-grid"></div></details><div class="actions print-actions"></div>`;
    card.querySelector(".modes").append(
      button("60分で受験する", () => begin(entry, "timed"), "primary"),
      button("時間制限なしで解く", () => begin(entry, "untimed")),
    );
    if (latest)
      card
        .querySelector(".modes")
        .append(button("前回の受験を開く", () => openAttempt(latest.id)));
    for (const [id, title] of [
      ["q1", "第1問"],
      ["q2a", "第2問A"],
      ["q2b", "第2問B"],
      ["q3", "第3問"],
      ["q4", "第4問"],
    ])
      card
        .querySelector(".section-grid")
        .append(button(title, () => begin(entry, "section", id)));
    for (const [kind, title] of [
      ["problem", "問題冊子 PDF"],
      ["solution", "正答・解説 PDF"],
    ]) {
      const a = document.createElement("a");
      a.className = "mock-button";
      a.href = new URL(
        kind + ".pdf",
        new URL(".", new URL(entry.manifest, location.href)),
      ).href;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = title;
      card.querySelector(".print-actions").append(a);
    }
    $("#exam-list").append(card);
  }
  if (!history.length)
    $("#history-list").innerHTML =
      '<p class="muted">まだ受験記録がありません。</p>';
  for (const a of history) {
    const row = document.createElement("div");
    row.className = "actions";
    row.append(
      document.createTextNode(
        `No.${a.examId}　${new Date(a.createdAt).toLocaleString("ja-JP")}　${a.result ? `${a.result.points}/${a.result.maxPoints}点` : "解答途中"}　${a.mode === "section" ? "大問別" : a.mode === "timed" ? "60分" : "時間制限なし"}　`,
      ),
      button("開く", () => openAttempt(a.id)),
    );
    $("#history-list").append(row);
  }
}
async function begin(entry, mode, sid) {
  await loadExam(entry);
  attempt = createAttempt(exam, mode, sid);
  await lockAttempt(attempt.id);
  reviewing = false;
  solution = false;
  sectionId = attempt.sectionIds[0];
  persist();
  location.hash = attempt.id;
  renderWorkspace();
}
async function openAttempt(id) {
  const a = store.load(id);
  if (!a) return notify("受験記録が見つかりません。");
  const entry = entryFor(a.examId, a.examVersion);
  if (!entry)
    return notify("この履歴に対応する問題バージョンが見つかりません。");
  await loadExam(entry);
  if (!(await lockAttempt(id)))
    return notify(
      "この受験は別のタブで開かれています。先にそちらを中断してください。",
    );
  try {
    attempt = restoreAttempt(exam, a);
  } catch {
    return notify(
      "受験記録の形式を確認できません。バックアップを確認してください。",
    );
  }
  reviewing = false;
  solution = false;
  sectionId = a.sectionIds[0];
  location.hash = id;
  if (attempt.result) renderResults();
  else {
    if (attempt.status !== "active") resume(attempt);
    persist();
    renderWorkspace();
  }
}
function visibleFields() {
  return exam.fields.filter((f) => attempt.sectionIds.includes(f.sectionId));
}
function answers() {
  return reviewing ? attempt.review.answers : attempt.answers;
}
function isLocked(id) {
  return reviewing && attempt.review.locked.includes(id);
}
function renderWorkspace() {
  disposeChallenge();
  const seq = ++uiSequence;
  frameObserver?.disconnect();
  app.innerHTML = `<div class="topline"><div><p class="eyebrow">No.${esc(exam.id)} / ${reviewing ? "REVIEW" : "PRACTICE"}</p><h1>${reviewing ? "間違えたところを、もう一度。" : esc(exam.title)}</h1></div><button id="back-list">一覧へ</button></div><div class="workspace"><div class="book"><nav class="book-nav" aria-label="大問を選ぶ"></nav><iframe title="問題冊子" sandbox="allow-same-origin"></iframe></div><aside class="sidebar"><p>${reviewing ? "復習モード" : attempt.mode === "timed" ? "残り時間" : "解答時間"}</p><div class="timer" id="timer"></div><div class="actions" id="run-actions"></div><details ${innerWidth > 850 ? "open" : ""}><summary>解答状況・見直し</summary><p class="muted">— 未回答 / ● 回答済み / ☆ 見直し</p><div id="answer-status"></div></details><button id="export-active">履歴を書き出す</button></aside></div>`;
  $("#back-list").onclick = () => requestPause(true);
  $("#export-active").onclick = () => {
    let all = [];
    try {
      all = store.list();
    } catch {}
    all = all.filter((a) => a.id !== attempt.id);
    all.unshift(attempt);
    download(
      "mock-history.json",
      JSON.stringify(
        { schemaVersion: 1, exportedAt: Date.now(), attempts: all },
        null,
        2,
      ),
    );
  };
  for (const s of exam.sections.filter((s) =>
    attempt.sectionIds.includes(s.id),
  )) {
    const b = button(s.title, () => {
      sectionId = s.id;
      solution = false;
      renderWorkspace();
    });
    b.setAttribute("aria-current", String(s.id === sectionId && !solution));
    $(".book-nav").append(b);
  }
  if (attempt.result) {
    $(".book-nav").append(
      button(solution ? "問題に戻る" : "解説", () => {
        solution = !solution;
        renderWorkspace();
      }),
      button("採点結果", () => {
        if (!reviewing && attempt.status === "active") {
          pause(attempt);
          persist();
        }
        renderResults();
      }),
    );
  }
  $("#run-actions").append(
    button(
      reviewing ? "復習を採点する" : "採点する",
      () => doGrade(),
      "primary",
    ),
    button("中断", () => requestPause(false)),
  );
  frame = $("iframe");
  frame.src = new URL(
    `${sectionId}${solution ? "-solution" : ""}.html`,
    base,
  ).href;
  frame.onload = () => {
    if (seq !== uiSequence) return;
    const d = frame.contentDocument;
    // External links cannot navigate the application frame.
    d.querySelectorAll('a[href^="http"]').forEach((a) => {
      a.target = "_blank";
      a.rel = "noopener";
    });
    d.querySelectorAll("table").forEach((t) => {
      if (t.parentElement.classList.contains("table-scroll")) return;
      const w = d.createElement("div");
      w.className = "table-scroll";
      t.before(w);
      w.append(t);
    });
    d.querySelectorAll("[data-zoom]").forEach((b) => {
      b.onclick = () => {
        const source = d.getElementById(b.dataset.zoom);
        const visual = source?.matches("svg,img")
          ? source
          : source?.querySelector("svg,img");
        if (!visual) return;
        const clone = visual.cloneNode(true);
        if (clone.tagName === "IMG") clone.src = visual.src;
        $("#figure-dialog .figure-stage").replaceChildren(clone);
        $("#figure-dialog").showModal();
      };
    });
    if (!solution) {
      d.querySelectorAll("[data-field]").forEach((e) => {
        e.tabIndex = 0;
        e.setAttribute("role", "button");
        e.onclick = () => openField(e.dataset.field, e);
        e.onkeydown = (ev) => {
          if (["Enter", " "].includes(ev.key)) {
            ev.preventDefault();
            openField(e.dataset.field, e);
          }
        };
      });
      d.querySelectorAll("[data-choice-fields]").forEach((e) => {
        e.tabIndex = 0;
        e.setAttribute("role", "button");
        const choose = () => {
          const ids = e.dataset.choiceFields.split(" "),
            available = ids.filter((id) => !isLocked(id));
          if (!available.length) return;
          let id = available.includes(selectedField)
            ? selectedField
            : available.find((id) => !answers()[id]);
          if (!id && ids.length > 1) {
            ask(
              "どの解答欄に入れますか",
              available.map((id) => [
                exam.fields.find((f) => f.id === id).label,
                () => setAnswer(id, e.dataset.choiceValue),
              ]),
            );
            return;
          }
          setAnswer(id || available[0], e.dataset.choiceValue);
        };
        e.onclick = choose;
        e.onkeydown = (ev) => {
          if (["Enter", " "].includes(ev.key)) {
            ev.preventDefault();
            choose();
          }
        };
      });
      syncBook();
    }
    const resize = () => {
      frame.style.height =
        Math.ceil(d.documentElement.getBoundingClientRect().height) + "px";
    };
    frameObserver = new ResizeObserver(resize);
    frameObserver.observe(d.body);
    d.fonts.ready.then(resize);
    resize();
  };
  renderStatus();
  tick();
}
function renderStatus() {
  const out = $("#answer-status");
  if (!out) return;
  out.replaceChildren();
  for (const s of exam.sections.filter((s) =>
    attempt.sectionIds.includes(s.id),
  )) {
    const h = document.createElement("h3");
    h.textContent = s.title;
    out.append(h);
    const g = document.createElement("div");
    g.className = "answer-grid";
    for (const f of exam.fields.filter((f) => f.sectionId === s.id)) {
      const val = answers()[f.id] || "",
        flag = attempt.flags.includes(f.id);
      const b = button(
        `${f.label} ${flag ? "☆" : val ? "●" : "—"}\n${val}`,
        async () => {
          if (sectionId !== f.sectionId || solution) {
            sectionId = f.sectionId;
            solution = false;
            renderWorkspace();
            await new Promise((resolve) =>
              frame.addEventListener("load", resolve, { once: true }),
            );
          }
          const el = frame.contentDocument.querySelector(
            `[data-field="${f.id}"]`,
          );
          if (el) {
            el.scrollIntoView({ block: "center" });
            el.focus({ preventScroll: true });
          }
          openField(f.id, el);
        },
        `${val ? "answered" : ""} ${flag ? "flagged" : ""}`,
      );
      b.setAttribute(
        "aria-label",
        `${s.title} ${f.label} ${val ? "回答 " + val : "未回答"}${flag ? " 見直し" : ""}`,
      );
      g.append(b);
    }
    out.append(g);
  }
}
function displayValue(f, value, e) {
  if (!value) return e?.dataset.original || f.label;
  if (f.type === "text") return value;
  const c = f.choices.find((c) => c.value === value);
  if (e?.dataset.part !== undefined)
    return c?.parts?.[Number(e.dataset.part)] || value;
  if (e?.dataset.display === "content") return c?.text || value;
  return c?.text.length <= 14
    ? `${"⓪①②③④⑤⑥⑦⑧⑨"[Number(value)] || value} ${c.text}`
    : "⓪①②③④⑤⑥⑦⑧⑨"[Number(value)] || value;
}
function syncBook() {
  const d = frame?.contentDocument;
  if (!d || solution) return;
  const result = reviewing ? attempt.review.result : attempt.result;
  for (const e of d.querySelectorAll("[data-field]")) {
    const f = exam.fields.find((f) => f.id === e.dataset.field);
    if (!f) continue;
    const value = answers()[f.id] || "";
    e.textContent = displayValue(f, value, e);
    e.dataset.filled = String(!!value);
    e.dataset.locked = String(isLocked(f.id));
    e.setAttribute("aria-label", `解答欄${f.label}: ${value || "未回答"}`);
    e.setAttribute("aria-disabled", String(isLocked(f.id)));
    delete e.dataset.verdict;
    if ((reviewing || attempt.showCorrectness) && result) {
      const u = result.units.find((u) => u.fields.includes(f.id));
      if (u && u.answers.every((v, i) => v === (answers()[u.fields[i]] || "")))
        e.dataset.verdict = u.correct ? "correct" : "incorrect";
    }
  }
  for (const e of d.querySelectorAll("[data-position]")) {
    let label = e.querySelector(".mock-insert");
    if (!label) {
      label = d.createElement("span");
      label.className = "mock-insert";
      e.append(label);
    }
    label.textContent =
      answers()["q3-コ"] === e.dataset.position ? " kakuteisu = 0" : "";
  }
  for (const e of d.querySelectorAll("[data-choice-fields]")) {
    const selected = e.dataset.choiceFields
      .split(" ")
      .some((id) => answers()[id] === e.dataset.choiceValue);
    e.dataset.selected = String(selected);
    e.setAttribute("aria-pressed", String(selected));
  }
}
function setAnswer(id, value) {
  if (isLocked(id)) return;
  const f = exam.fields.find((f) => f.id === id);
  try {
    answers()[id] = normalize(f, value);
  } catch {
    return;
  }
  persist();
  syncBook();
  renderStatus();
  if (selectedField === id && $("#answer-dialog").open) renderEditor();
}
function openField(id, anchor) {
  if (isLocked(id)) return notify("この欄は復習で正答済みです。");
  selectedField = id;
  const f = exam.fields.find((f) => f.id === id);
  if (!f) return;
  renderEditor();
  const d = $("#answer-dialog");
  if (!d.open) d.showModal();
  if (anchor && innerWidth <= 850) {
    const top =
      frame.getBoundingClientRect().top +
      anchor.getBoundingClientRect().top +
      scrollY;
    window.scrollTo({
      top: Math.max(0, top - innerHeight * 0.18),
      behavior: "smooth",
    });
  }
}
function renderEditor() {
  const f = exam.fields.find((f) => f.id === selectedField),
    value = answers()[f.id] || "";
  $("#answer-title").textContent =
    `${exam.sections.find((s) => s.id === f.sectionId).title}　解答欄 ${f.label}`;
  const out = $("#answer-options");
  out.replaceChildren();
  if (f.type === "text") {
    const display = document.createElement("div");
    display.className = "key-display";
    display.textContent = value || "—";
    display.setAttribute("aria-live", "polite");
    out.append(display);
    const keys = document.createElement("div");
    keys.className = "keypad";
    for (const c of "0123456789ABCDEF") {
      const b = button(c, () =>
        setAnswer(f.id, (value + c).slice(-f.maxLength)),
      );
      b.disabled = !f.allowed.includes(c);
      keys.append(b);
    }
    out.append(
      keys,
      button("1文字削除", () => setAnswer(f.id, value.slice(0, -1))),
    );
  } else {
    for (const c of f.choices) {
      const b = button(
        `${c.value === value ? "✓ " : ""}${"⓪①②③④⑤⑥⑦⑧⑨"[Number(c.value)] || c.value} ${c.text}`,
        () => {
          setAnswer(f.id, c.value);
          $("#answer-dialog").close();
        },
      );
      b.setAttribute("aria-pressed", String(c.value === value));
      out.append(b);
    }
  }
  $("#flag-answer").textContent = attempt.flags.includes(f.id)
    ? "★ 見直しを解除"
    : "☆ 見直し";
}
$("#clear-answer").onclick = () => setAnswer(selectedField, "");
$("#flag-answer").onclick = () => {
  const i = attempt.flags.indexOf(selectedField);
  if (i < 0) attempt.flags.push(selectedField);
  else attempt.flags.splice(i, 1);
  persist();
  renderEditor();
  renderStatus();
};
$("#next-answer").onclick = () => {
  const fs = visibleFields(),
    i = fs.findIndex((f) => f.id === selectedField),
    next = fs.slice(i + 1).find((f) => !isLocked(f.id));
  if (next) openField(next.id);
  else $("#answer-dialog").close();
};
$("#answer-dialog").addEventListener("keydown", (e) => {
  const f = exam.fields.find((f) => f.id === selectedField);
  if (f?.type !== "text" || e.ctrlKey || e.metaKey || e.altKey) return;
  let value = answers()[f.id] || "";
  if (e.key === "Backspace") {
    e.preventDefault();
    setAnswer(f.id, value.slice(0, -1));
  } else if (e.key.length === 1 && f.allowed.includes(e.key.toUpperCase())) {
    e.preventDefault();
    setAnswer(f.id, (value + e.key.toUpperCase()).slice(-f.maxLength));
  } else if (e.key === "Enter") {
    $("#answer-dialog").close();
  }
});
function requestPause(toList) {
  if (reviewing) {
    persist();
    return toList ? leave() : renderResults();
  }
  ask("中断のしかたを選ぶ", [
    [
      "採点せずに中断",
      () => {
        pause(attempt);
        persist();
        leave();
      },
    ],
    ["ここまでを採点して中断", () => doGrade()],
  ]);
}
function doGrade() {
  if ($("#answer-dialog").open) $("#answer-dialog").close();
  if (reviewing) {
    gradeReview(exam, attempt);
    persist();
    if (attempt.review.completed) {
      notify("すべて正解しました。復習完了です。");
      renderResults();
    } else {
      syncBook();
      renderStatus();
      ask("復習の採点結果", [
        [
          `${attempt.review.result.points}/${attempt.review.result.maxPoints}点 · 間違えた欄をもう一度`,
          () => {
            startReview(exam, attempt);
            persist();
            renderWorkspace();
          },
        ],
        ["結果へ戻る", () => renderResults()],
      ]);
    }
    return;
  }
  submit(exam, attempt);
  queueSubmission(exam, attempt);
  persist();
  renderResults();
}
function tick() {
  if (!attempt || !$("#timer")) return;
  const ms = elapsed(attempt);
  $("#timer").textContent = reviewing
    ? "成績には反映しません"
    : time(
        attempt.mode === "timed"
          ? Math.max(0, exam.durationSeconds * 1000 - ms)
          : ms,
      );
  if (
    !reviewing &&
    attempt.status === "active" &&
    attempt.mode === "timed" &&
    ms >= exam.durationSeconds * 1000
  ) {
    attempt.elapsedMs = exam.durationSeconds * 1000;
    attempt.startedAt = null;
    doGrade();
    notify("制限時間になったため採点しました。");
  }
}
setInterval(tick, 1000);
window.addEventListener("pagehide", () => {
  if (attempt) persist();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && attempt) persist();
});
async function renderResults() {
  disposeChallenge();
  const seq = ++uiSequence;
  frameObserver?.disconnect();
  const r = attempt.result;
  if (!r) return renderWorkspace();
  app.innerHTML = `<section class="results"><p class="eyebrow">No.${esc(exam.id)} / RESULT</p><h1>採点結果</h1><div class="score">${r.points}<small> / ${r.maxPoints}</small></div><p>得点率 ${((r.points / r.maxPoints) * 100).toFixed(1)}% · 解答時間 ${time(elapsed(attempt))}</p><div class="actions" id="result-actions"></div><div class="table-wrap"><table><thead><tr><th>大問</th><th>得点</th><th>得点率</th><th>参考平均</th><th>平均との差</th></tr></thead><tbody id="section-results"></tbody></table></div><p id="stat-total" class="stat-note">参考統計を取得しています…</p><div id="submission-status"><p class="muted">統計への送信はまだ有効になっていません。この受験の成績はブラウザ内に保存されています。</p></div><div id="comparison"></div><details open><summary>解答・採点単位ごとの結果</summary><div class="table-wrap"><table><thead><tr><th>欄</th><th>自分の回答</th><th>正答</th><th>得点</th><th>回答数 / 満点正答率 / 平均得点率</th></tr></thead><tbody id="unit-results"></tbody></table></div></details></section>`;
  setupSubmission();
  const a = $("#result-actions");
  a.append(
    button("続きから解く", () =>
      ask("正誤表示を選ぶ", [
        ["正誤表示あり", () => restart(true)],
        ["正誤表示なし", () => restart(false)],
      ]),
    ),
    button(
      attempt.review?.completed
        ? "復習完了 · もう一度確認"
        : "間違えたところを復習",
      () => {
        reviewing = true;
        startReview(exam, attempt);
        persist();
        solution = false;
        renderWorkspace();
      },
      "primary",
    ),
    button("最初から解き直す", () =>
      begin(
        entryFor(exam.id, exam.version),
        attempt.mode,
        attempt.sectionIds[0],
      ),
    ),
    button("問題・解説", () => {
      reviewing = true;
      startReview(exam, attempt);
      solution = true;
      renderWorkspace();
    }),
    button("一覧へ", leave),
  );
  if (attempt.mode === "section") {
    const next =
      [...catalog]
        .sort((a, b) => a.id.localeCompare(b.id))
        .find((e) => e.id > exam.id) || catalog.find((e) => e.id !== exam.id);
    if (next)
      a.append(
        button(`No.${next.id}の同じ大問へ`, () =>
          begin(next, "section", attempt.sectionIds[0]),
        ),
      );
  }
  for (const s of r.sections) {
    $("#section-results").insertAdjacentHTML(
      "beforeend",
      `<tr><td>${esc(s.title)}</td><td>${s.points}/${s.maxPoints}点</td><td>${((s.points / s.maxPoints) * 100).toFixed(1)}%</td><td id="avg-${s.id}">—</td><td id="diff-${s.id}">—</td></tr>`,
    );
  }
  for (const u of r.units) {
    const def = exam.scoring.find((x) => x.id === u.id),
      correct = correctPatterns(def.rule)
        .map((p) => p.join("・"))
        .join(" / ");
    $("#unit-results").insertAdjacentHTML(
      "beforeend",
      `<tr><th>${esc(exam.sections.find((s) => s.id === u.sectionId).title)} ${u.fields.map((id) => esc(exam.fields.find((f) => f.id === id).label)).join("・")}</th><td>${u.answers.map((v) => esc(v || "—")).join("・")}</td><td>${esc(correct)}${def.rule.kind === "unordered" ? "（順不同）" : ""}</td><td class="${u.correct ? "correct" : "incorrect"}">${u.correct ? "○" : "×"} ${u.points}/${u.maxPoints}</td><td id="stat-${u.id}">—</td></tr>`,
    );
  }
  const runs = store
    .list()
    .filter(
      (a) =>
        a.examId === attempt.examId &&
        a.examVersion === attempt.examVersion &&
        a.mode === attempt.mode &&
        a.sectionIds.join() === attempt.sectionIds.join() &&
        a.result &&
        a.createdAt <= attempt.createdAt,
    )
    .sort((a, b) => a.createdAt - b.createdAt);
  if (runs.length > 1) {
    const initial = runs[0],
      prev = runs.at(-2);
    $("#comparison").innerHTML =
      `<h2>得点の変化</h2><p>初回 ${initial.result.points}点 → 前回 ${prev.result.points}点 → 今回 ${r.points}点</p><p>${r.sections.map((s) => `${esc(s.title)}：${initial.result.sections.find((x) => x.id === s.id)?.points} → ${prev.result.sections.find((x) => x.id === s.id)?.points} → ${s.points}点`).join(" / ")}</p>`;
  }
  try {
    const stats = referenceStats(exam, await fetchStats(exam));
    if (seq !== uiSequence) return;
    const relevant = stats.units.filter((u) =>
      attempt.sectionIds.includes(u.sectionId),
    );
    const ready = relevant.every((u) => u.count);
    $("#stat-total").textContent =
      `参考平均：${ready ? relevant.reduce((n, u) => n + u.average, 0).toFixed(1) + " / " + r.maxPoints + "点" : "集計データ不足"}。回答された採点単位ごとの平均を合計した参考値です。大問別・再受験・途中採点も含むため、通し受験者の平均ではありません。`;
    for (const s of r.sections) {
      const v = stats.sections[s.id].points;
      $(`#avg-${s.id}`).textContent =
        v === null
          ? "未集計"
          : `${v.toFixed(1)}点 (${((v / s.maxPoints) * 100).toFixed(1)}%)`;
      $(`#diff-${s.id}`).textContent =
        v === null
          ? "—"
          : `${s.points - v >= 0 ? "+" : ""}${(s.points - v).toFixed(1)}点`;
    }
    for (const u of stats.units) {
      const el = $(`#stat-${u.id}`);
      if (el)
        el.textContent = u.count
          ? `${u.count} / ${(u.fullRate * 100).toFixed(1)}% / ${((u.average / u.maxPoints) * 100).toFixed(1)}%`
          : "未集計";
    }
  } catch {
    if (seq === uiSequence)
      $("#stat-total").textContent =
        "参考統計を取得できませんでした。個人の採点結果は保存されています。";
  }
}
async function setupSubmission() {
  disposeChallenge();
  const target = $("#submission-status"),
    current = attempt,
    seq = uiSequence;
  const visible = () =>
    seq === uiSequence && attempt === current && target.isConnected;
  if (!current.pendingSubmission) {
    target.textContent =
      current.statsAcknowledgedRevision === current.revision
        ? "統計送信済み"
        : "この採点は統計に送信されていません。再採点すると送信対象になります。";
    return;
  }
  const retry = (message) => {
    if (!visible()) return;
    disposeChallenge();
    target.textContent = message;
    target.append(button("再送する", setupSubmission));
  };
  target.textContent = "参考統計への接続を確認しています…";
  try {
    // Persist the token and exact snapshot before sending anything remotely.
    store.save(current);
    const config = await fetchSubmissionConfig();
    if (!visible()) return;
    target.innerHTML =
      '<p>参考統計への送信待ちです。</p><div class="stats-challenge"></div>';
    const host = target.querySelector(".stats-challenge");
    let sending = false;
    const cleanup = await mountChallenge(host, config, {
      failure: () =>
        retry("送信の確認に失敗しました。採点結果は保存されています。"),
      success: async (token) => {
        if (!visible() || sending) return;
        sending = true;
        try {
          await sendPending(current, config, token);
          const latest = store.load(current.id);
          if (latest && latest.revision === current.revision) {
            latest.pendingSubmission = current.pendingSubmission;
            latest.statsAcknowledgedRevision =
              current.statsAcknowledgedRevision;
            store.save(latest);
          }
          if (visible()) {
            disposeChallenge();
            // Refresh statistics after the committed acknowledgement.
            await renderResults();
          }
        } catch (e) {
          retry(e.message);
        }
      },
    });
    if (!visible()) cleanup();
    else disposeChallenge = cleanup;
  } catch (e) {
    retry(e.message);
  }
}

function restart(show) {
  reviewing = false;
  solution = false;
  if (
    attempt.mode === "timed" &&
    elapsed(attempt) >= exam.durationSeconds * 1000
  ) {
    ask("制限時間後の継続", [
      [
        "時間制限を外して同じ受験を続ける",
        () => {
          attempt.continuedAfterDeadline = true;
          attempt.originalMode ||= attempt.mode;
          attempt.mode = "untimed";
          resume(attempt, show);
          persist();
          renderWorkspace();
        },
      ],
    ]);
  } else {
    resume(attempt, show);
    persist();
    renderWorkspace();
  }
}
try {
  catalog = await fetch("catalog.json").then((r) => r.json());
  if (location.hash.slice(1) && store.load(location.hash.slice(1)))
    await openAttempt(location.hash.slice(1));
  else await renderCatalog();
} catch (e) {
  app.innerHTML = `<p class="error-note">読み込みに失敗しました。${esc(e.message)}</p>`;
}

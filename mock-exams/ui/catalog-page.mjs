// The same catalog renderer is used by the fast entry page and the full app.
import {
  catalogSections,
  catalogProgress,
  sortCatalog,
} from "../engine/catalog.mjs";
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const defaultCatalogView = () => ({
  mode: "full",
  timeMode: "timed",
  sectionId: "q1",
  order: "recommended",
});
const pressed = (a, b) => String(a === b);
export function catalogMarkup(
  catalog,
  history = [],
  catalogView = defaultCatalogView(),
  pageURL = "https://mei-chan-nel.com/mock-exams/",
) {
  const modes = [
    [
      "full",
      "回ごとに受験する",
      "60分・100点の本番形式で実力を確かめる。",
      "1回分を通して",
    ],
    [
      "section",
      "大問ごとに演習する",
      "取り組みたい大問を選んで重点的に練習する。",
      "大問を選んで",
    ],
  ]
    .map(
      ([value, title, description, meta]) =>
        `<button class="mode-choice" data-mode="${value}" aria-pressed="${pressed(catalogView.mode, value)}"><span class="mode-meta">${meta}</span><strong>${title}</strong><span>${description}</span></button>`,
    )
    .join("");
  const times = [
    ["timed", "60分で受験する"],
    ["untimed", "時間制限なしで解く"],
  ]
    .map(
      ([value, title]) =>
        `<button data-time="${value}" aria-pressed="${pressed(catalogView.timeMode, value)}">${title}</button>`,
    )
    .join("");
  const sections = catalogSections
    .map(
      ([value, title]) =>
        `<button data-section="${value}" aria-pressed="${pressed(catalogView.sectionId, value)}">${title}</button>`,
    )
    .join("");
  const sectionTitle = catalogSections.find(
    ([id]) => id === catalogView.sectionId,
  )[1];
  const context =
    catalogView.mode === "section"
      ? `${sectionTitle}の演習`
      : `回ごとに受験 · ${catalogView.timeMode === "timed" ? "60分" : "時間制限なし"}`;
  const cards = sortCatalog(
    catalog,
    history,
    catalogView.mode,
    catalogView.sectionId,
    catalogView.order,
  )
    .map((entry) => {
      const progress = catalogProgress(
        entry,
        history,
        catalogView.mode,
        catalogView.sectionId,
      );
      const statusClass =
        progress.status === "中断中"
          ? "in-progress"
          : progress.status === "採点済み"
            ? "completed"
            : "";
      const fresh = `<button class="primary" data-start="${esc(entry.id)}">${progress.resume ? "最初から解く" : "選択"}</button>`;
      const resume = progress.resume
        ? `<button class="primary" data-resume="${esc(progress.resume.id)}">再開</button>`
        : "";
      const links = [
        ["problem", "問題冊子PDF"],
        ["solution", "解答解説PDF"],
      ]
        .map(
          ([kind, title]) =>
            `<a href="${esc(pageURL ? new URL(kind + ".pdf", new URL(".", new URL(entry.manifest, pageURL))).href : entry.manifest.replace("exam.json", kind + ".pdf"))}" download="情報Ⅰ_実戦演習_No.${esc(entry.id)}_${title}.pdf">${title}</a>`,
        )
        .join("");
      return `<article class="exam-card catalog-exam" data-exam-id="${esc(entry.id)}"><div><div class="exam-card-title"><h3>No.${esc(entry.id)}${catalogView.mode === "section" ? "の" + esc(sectionTitle) : ""}</h3><span class="exam-status ${statusClass}">${progress.status}</span></div><p>${catalogView.mode === "section" ? esc(sectionTitle) + "の演習" : "1回分・全大問"}${entry.publishedAt ? " · " + esc(entry.publishedAt.slice(0, 7).replace("-", "年")) + "月" : ""}</p></div><div class="actions exam-card-actions">${resume}${fresh}<div class="pdf-links">${links}</div></div></article>`;
    })
    .join("");
  return `
    <div class="catalog-page">
      <section class="intro catalog-intro">
        <p class="eyebrow">PRACTICE / INFORMATION I</p>
        <h1>情報Ⅰ 実戦演習</h1>
        <p>大学入学共通テスト「情報Ⅰ」のオリジナル模試。<br>1回分を通して解くことも、大問ごとに練習することもできます。</p>
      </section>
      <nav id="exam-modes" class="mode-choices" aria-label="受験方式を選ぶ">${modes}</nav>
      <section id="time-picker" class="section-picker" aria-labelledby="time-picker-title" ${catalogView.mode === "full" ? "" : "hidden"}>
        <h2 id="time-picker-title">受験時間を選ぶ</h2>
        <div class="time-options" id="catalog-time" role="group" aria-label="受験時間">${times}</div>
      </section>
      <section id="section-picker" class="section-picker" aria-labelledby="section-picker-title" ${catalogView.mode === "section" ? "" : "hidden"}>
        <h2 id="section-picker-title">大問を選ぶ</h2>
        <div class="section-grid" id="catalog-sections" role="group" aria-label="演習する大問">${sections}</div>
      </section>
      <section class="exam-picker" aria-labelledby="exam-picker-title">
        <div class="catalog-list-heading">
          <div><p class="eyebrow" id="catalog-context">${context}</p><h2 id="exam-picker-title">模試No.を選ぶ</h2></div>
          <label class="catalog-sort">並び順<select id="catalog-sort"><option value="recommended" ${catalogView.order === "recommended" ? "selected" : ""}>おすすめ順</option><option value="newest" ${catalogView.order === "newest" ? "selected" : ""}>新しい順</option><option value="number" ${catalogView.order === "number" ? "selected" : ""}>番号順</option></select></label>
        </div>
        <div id="exam-list">${cards}</div>
      </section>
      <div class="catalog-history-actions"><button id="open-history">学習履歴</button></div>
    </div>`;
}
export function renderCatalogContents({
  target,
  catalog,
  history,
  catalogView,
  onChange,
  onStart,
  onResume,
  onHistory,
  onError = () => {},
  pageURL = location.href,
}) {
  target.innerHTML = catalogMarkup(catalog, history, catalogView, pageURL);
  const change = (key, value, focus) => {
    catalogView[key] = value;
    onChange();
    target.querySelector(focus)?.focus({ preventScroll: true });
  };
  const bind = (selector, fn) => {
    for (const b of target.querySelectorAll(selector))
      b.onclick = async () => {
        if (b.disabled) return;
        b.disabled = true;
        try {
          await fn(b);
        } catch (e) {
          onError(e);
        } finally {
          b.disabled = false;
        }
      };
  };
  bind("[data-mode]", (b) =>
    change("mode", b.dataset.mode, '#exam-modes [aria-pressed="true"]'),
  );
  bind("[data-time]", (b) =>
    change("timeMode", b.dataset.time, '#catalog-time [aria-pressed="true"]'),
  );
  bind("[data-section]", (b) =>
    change(
      "sectionId",
      b.dataset.section,
      '#catalog-sections [aria-pressed="true"]',
    ),
  );
  target.querySelector("#catalog-sort").onchange = (e) =>
    change("order", e.target.value, "#catalog-sort");
  bind("[data-start]", (b) =>
    onStart(
      catalog.find((e) => e.id === b.dataset.start),
      catalogView.mode === "section" ? "section" : catalogView.timeMode,
      catalogView.mode === "section" ? catalogView.sectionId : undefined,
    ),
  );
  bind("[data-resume]", (b) => onResume(b.dataset.resume));
  bind("#open-history", onHistory);
}

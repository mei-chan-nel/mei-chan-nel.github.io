import { esc } from "./shared/ui.mjs?v=20261024-probability-flow";
import { validateDocument } from "./shared/validation.mjs?v=20261024-probability-flow";
import {
  currentData,
  applyData,
} from "./shared/data-model.mjs?v=20261024-probability-flow";
import { composeWorkbench } from "./workbench.mjs?v=20261024-probability-flow";
import { renderDataTab } from "./data-tab.mjs?v=20261024-probability-flow";
import { sampleState } from "./shared/samples.mjs?v=20261024-probability-flow";
import { normalizeExperiment } from "./sampling/model.mjs?v=20261024-probability-flow";
import { readDataset } from "./shared/data.mjs?v=20261024-probability-flow";
import {
  dataStep,
  learningViews,
  renderStepNavigation,
} from "./learning.mjs?v=20261024-probability-flow";
import { fitWorkspaceCharts } from "./shared/chart-layout.mjs?v=20261024-probability-flow";
import { normalizeHistogram } from "./histogram/model.mjs?v=20261024-probability-flow";
import { setupFullscreen } from "./fullscreen.mjs?v=20261024-probability-flow";
import { renderSources } from "./shared/sources.mjs?v=20261024-probability-flow";
const id = document.body.dataset.statLab;
const config = (await import(`./${id}/lab.mjs?v=20261024-probability-flow`))
  .default;
const ui = {
  view: 0,
  dataTab: true,
  openSections: {},
  dataPage: 0,
};
const key = `study-atlas-statistics-${id}-v1`;
const project =
  new URLSearchParams(location.search).get("dataset") === "project";
function prepare(next) {
  if (id === "histogram") next = normalizeHistogram(next);
  if (["correlation", "time-series", "probability"].includes(id))
    next = config.normalize(next);
  if (id === "sampling") next = normalizeExperiment(next);
  if (id === "crosstab") {
    if (!next.records) {
      next = { ...next, records: currentData(id, next).rows };
      // Migrate a saved aggregate baseline as well as its current counts.
      if (next.dataInfo?.baseline?.[0]?.length === 4) {
        const old = next.dataInfo;
        const migrated = applyData(id, config.initial(), {
          headers: old.columns,
          rows: old.baseline,
          name: old.name,
          filename: old.filename,
        });
        next.dataInfo = {
          ...old,
          columns: migrated.dataInfo.columns,
          baseline: migrated.dataInfo.baseline,
        };
      }
    }
    next = config.normalize(next);
  }
  if (!next.dataInfo) {
    const data = currentData(id, next),
      shared = project ? readDataset() : null;
    next.dataInfo = {
      name: data.name,
      origin: project
        ? shared.origin === "user"
          ? "user"
          : "project"
        : data.origin,
      columns: data.headers,
      baseline: data.rows,
      publicDataset: project ? shared.publicDataset : undefined,
    };
  }
  return next;
}
// Restore user data before generating a sample that would immediately be discarded.
let state;
try {
  const saved = JSON.parse(localStorage.getItem(key));
  if (
    saved &&
    !project &&
    (saved.state?.dataInfo?.origin === "user" ||
      (id === "probability" && saved.state?.experiments?.length))
  ) {
    if (["time-series", "probability"].includes(id))
      saved.state = config.normalize(saved.state);
    validateDocument(saved, id, config.initial());
    state = prepare(saved.state);
  }
} catch {}
if (!state)
  state = prepare(
    project ? config.initial() : sampleState(id, config.initial()),
  );
// The old summary page offers an explicit transfer; its saved original is kept.
if (
  id === "histogram" &&
  new URLSearchParams(location.search).get("legacy") === "summary"
) {
  try {
    const transferred = JSON.parse(
      sessionStorage.getItem("study-atlas-distribution-transfer"),
    );
    if (transferred) {
      state = prepare(applyData("histogram", config.initial(), transferred));
      persist();
      sessionStorage.removeItem("study-atlas-distribution-transfer");
    }
  } catch {}
}
const root = document.querySelector("#experiment");
const finding = document.querySelector("#experiment-insight");
function persist() {
  try {
    localStorage.setItem(key, JSON.stringify({ version: 1, id, state }));
    ui.persistenceError = false;
  } catch {
    if (id === "probability") ui.persistenceError = true;
  }
}
function replace(next) {
  if (id === "probability" && next.mode !== state.mode) ui.view = 0;
  state = prepare(next);
  persist();
  draw();
}
function update(patch) {
  replace({ ...state, ...patch });
}
function draw() {
  const active = document.activeElement;
  const focus =
    active && (root.contains(active) || active.closest("#view-tabs"))
      ? {
          id: active.id,
          start: active.selectionStart,
          end: active.selectionEnd,
        }
      : null;
  try {
    ui.state = state;
    const steps = [dataStep(id), ...learningViews(id, state)];
    ui.view = Math.max(0, Math.min(ui.view, steps.length - 2));
    // The data editor is the first screen. Do not construct and immediately
    // discard every graph, simulation and calculation behind it.
    let views;
    if (ui.dataTab) {
      views = steps.slice(1).map((lesson, i) => ({
        label: lesson.title,
        active: i === ui.view,
      }));
    } else {
      config.render(root, { state, update, replace, view: ui.view });
      views = composeWorkbench(root, id, ui, draw) || [];
    }
    const activate = (index, scroll = false) => {
      if (ui.dataTab && index > 0 && ui.commitData && !ui.commitData()) return;
      ui.dataTab = index === 0;
      if (index) {
        ui.view = index - 1;
      }
      draw();
      if (scroll) {
        document
          .querySelector("#view-tabs")
          .scrollIntoView({ behavior: "smooth", block: "start" });
        document
          .querySelector(index ? `#view-${index - 1}` : "#data-tab")
          .focus({ preventScroll: true });
      }
    };
    const tabs = document.querySelector("#view-tabs");
    tabs.innerHTML =
      `<button type="button" id="data-tab" aria-pressed="${ui.dataTab}">${id === "probability" ? "実験の準備" : "データ"}</button>` +
      views
        .map(
          (v, i) =>
            `<button type="button" id="view-${i}" data-view="${i}" ${id === "probability" && !state.experiments.length ? 'disabled title="実験の準備で実験してください"' : ""} aria-pressed="${!ui.dataTab && v.active}">${esc(v.label)}</button>`,
        )
        .join("");
    tabs.querySelector("#data-tab").onclick = () => activate(0);
    tabs
      .querySelectorAll("[data-view]")
      .forEach((b, i) => (b.onclick = () => activate(i + 1)));
    const index = ui.dataTab ? 0 : ui.view + 1;
    const lesson = steps[index];
    document.querySelector("#tab-progress").textContent =
      `${index + 1} / ${steps.length} · ${lesson.level}：${lesson.purpose}`;
    const navigation = document.querySelector("#step-navigation");
    navigation.hidden = ui.dataTab;
    if (!ui.dataTab)
      renderStepNavigation(navigation, steps, index, (next) =>
        activate(next, true),
      );
    const lead = document.querySelector("#lab-lead"),
      flow = document.querySelector("#analysis-flow");
    lead.hidden = !lesson.action || !!root.querySelector(".unified-workbench");
    lead.textContent = lesson.action;
    flow.hidden = true;
    finding.hidden = true;
    if (ui.dataTab && id === "probability") {
      ui.commitData = null;
      config.renderPreparation(root, {
        state,
        update,
        replace,
        analyze: () => activate(1, true),
      });
    } else if (ui.dataTab) {
      renderDataTab(root, {
        id,
        state,
        ui,
        update,
        sample: () => {
          const base = config.initial();
          if (id === "probability")
            Object.assign(base, {
              mode: state.mode,
              p: state.p,
              n: state.n,
              mu: state.mu,
              sigma: state.sigma,
              low: state.low,
              high: state.high,
            });
          replace(sampleState(id, base));
        },
        apply: replace,
        analyze: () => activate(1, true),
        nextLabel: steps[1].title,
      });
    } else {
      fitWorkspaceCharts(root.querySelector(".workbench-display"));
    }
    if (id === "probability" && ui.persistenceError) {
      const status = document.createElement("p");
      status.className = "annotation";
      status.setAttribute("role", "status");
      status.textContent =
        "ブラウザーに実験を保存できませんでした。画面の結果は残っています。実験の準備から必要な記録をCSVで保存してください。";
      root.prepend(status);
    }
    const provenance = document.querySelector("#data-provenance");
    if (provenance)
      provenance.innerHTML = renderSources(
        state.dataInfo?.publicDataset,
        state.dataInfo?.publicDerived || currentData(id, state).edits > 0,
      );
    if (focus?.id) {
      const target = document.getElementById(focus.id);
      if (target) {
        target.focus({ preventScroll: true });
        if (
          focus.start !== null &&
          typeof target.setSelectionRange === "function"
        )
          try {
            target.setSelectionRange(focus.start, focus.end);
          } catch {}
      }
    }
  } catch (e) {
    root.innerHTML = `<p class="error">表示できません。ページを開き直してください。${esc(e.message)}</p>`;
    console.error(e);
  }
}
document.querySelector("#lab-picker").onchange = (e) =>
  (location.href = `../${e.target.value}/`);
setupFullscreen(document.querySelector("#statistics-workspace"), draw);
draw();
// Let the editable first screen paint before fetching and laying out the
// lower-page explanation. Its independent failure must not break the editor.
requestAnimationFrame(() => {
  const explain = () =>
    import("./shared/explanation.mjs")
      .then(({ renderAcademicExplanation }) =>
        renderAcademicExplanation(
          document.querySelector("#explanation-body"),
          config.explanation,
        ),
      )
      .catch(() => {
        document.querySelector("#explanation-body").innerHTML =
          config.explanation;
      });
  if (window.requestIdleCallback)
    window.requestIdleCallback(explain, { timeout: 500 });
  else setTimeout(explain, 0);
});
if (id === "correlation") {
  document.addEventListener("pointerdown", (e) => {
    if (ui.dataTab || !state.selectedId || e.button > 0) return;
    // Controls act on the selected observation. Empty plot/page space clears it.
    if (
      e.target.closest(
        "[data-corr-drag], button, a, input, select, textarea, label, summary",
      )
    )
      return;
    if (document.activeElement?.matches(".corr-observation"))
      document.activeElement.blur();
    update({ selectedId: "", excludeSelected: false });
  });
}
if (id === "histogram") {
  document.addEventListener("pointerdown", (e) => {
    if (
      ui.dataTab ||
      state.selected < 0 ||
      e.button > 0 ||
      e.target.closest(
        "[data-bin], [data-raw], button, a, input, select, textarea, label, summary",
      )
    )
      return;
    update({ selected: -1 });
  });
}
let layoutTimer;
window.addEventListener("resize", () => {
  clearTimeout(layoutTimer);
  // The table reflows with CSS. Keep live inputs, drafts and scroll position.
  if (!ui.dataTab)
    layoutTimer = setTimeout(() => {
      if (!ui.dataTab) draw();
    }, 120);
});

import { esc } from "./shared/ui.mjs";
import { validateDocument } from "./shared/validation.mjs";
import { currentData } from "./shared/data-model.mjs";
import { composeWorkbench } from "./workbench.mjs";
import { renderDataTab } from "./data-tab.mjs";
import { sampleState } from "./shared/samples.mjs";
import { normalizeExperiment } from "./sampling/model.mjs";
import { readDataset } from "./shared/data.mjs";
import { experiences } from "./experience.mjs";
import { insight } from "./shared/insights.mjs";
import { renderAcademicExplanation } from "./shared/explanation.mjs";
import { fitWorkspaceCharts } from "./shared/chart-layout.mjs";
const id = document.body.dataset.statLab;
const config = (await import(`./${id}/lab.mjs?v=20261016-data`)).default;
const ui = {
  view: 0,
  dataTab: new URLSearchParams(location.search).get("view") === "data",
  openSections: {},
  dataPage: 0,
};
const key = `study-atlas-statistics-${id}-v1`;
const project =
  new URLSearchParams(location.search).get("dataset") === "project";
function prepare(next) {
  if (id === "sampling") next = normalizeExperiment(next);
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
    };
  }
  return next;
}
let state = prepare(
  project ? config.initial() : sampleState(id, config.initial()),
);
try {
  const saved = JSON.parse(localStorage.getItem(key));
  if (saved && !project && saved.state?.dataInfo?.origin === "user") {
    validateDocument(saved, id, config.initial());
    state = prepare(saved.state);
  }
} catch {}
const root = document.querySelector("#experiment");
const finding = document.querySelector("#experiment-insight");
function persist() {
  try {
    localStorage.setItem(key, JSON.stringify({ version: 1, id, state }));
  } catch {}
}
function replace(next) {
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
    config.render(root, { state, update, replace });
    const views = composeWorkbench(root, id, ui, draw) || [];
    const tabs = document.querySelector("#view-tabs");
    tabs.innerHTML =
      `<button type="button" id="data-tab" aria-pressed="${ui.dataTab}">データ</button>` +
      views
        .map(
          (v, i) =>
            `<button type="button" id="view-${i}" data-view="${i}" aria-pressed="${!ui.dataTab && v.active}">${esc(v.label)}</button>`,
        )
        .join("");
    tabs.querySelector("#data-tab").onclick = () => {
      ui.dataTab = true;
      draw();
    };
    tabs.querySelectorAll("[data-view]").forEach(
      (b, i) =>
        (b.onclick = () => {
          ui.dataTab = false;
          views[i].choose();
        }),
    );
    const lead = document.querySelector("#lab-lead"),
      flow = document.querySelector("#analysis-flow");
    lead.hidden = ui.dataTab;
    flow.hidden = ui.dataTab;
    finding.hidden = ui.dataTab;
    if (ui.dataTab) {
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
        analyze: () => {
          ui.dataTab = false;
          draw();
        },
      });
    } else {
      lead.textContent = experiences[id].firstTry;
      flow.textContent = "処理：" + currentData(id, state).operation;
      finding.textContent = insight(id, state);
      root.querySelector(".workbench-display").append(finding);
      fitWorkspaceCharts(root.querySelector(".workbench-display"));
    }
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
renderAcademicExplanation(
  document.querySelector("#explanation-body"),
  config.explanation,
);
document.querySelector("#lab-picker").onchange = (e) =>
  (location.href = `../${e.target.value}/`);
draw();
let layoutTimer;
window.addEventListener("resize", () => {
  clearTimeout(layoutTimer);
  layoutTimer = setTimeout(draw, 120);
});

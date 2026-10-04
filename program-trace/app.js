import { findProgram, defaultParameters, parameterText, sourceLines, lineLabel, validateParameters } from "./examples.js?v=20261003-perf";
import { compileProgram, createState, step, inputRequest } from "./interpreter.js?v=20261003-arrows";
import { createAutoplay, MIN_INTERVAL_MS, MAX_INTERVAL_MS, intervalSeconds, adjustInterval } from "./autoplay.js?v=20261003-video";
import { cloneValue, formatValue, validateField } from "./values.js?v=20261003-video";
import { createFieldEditor } from "./field-editor.js?v=20261003-video";
import { renderValue, renderChange } from "./value-view.js?v=20261004-mobile";
import { planWorkspace, sizeWorkspace } from "./workspace.js?v=20261004-mobile";
import { finishTrace } from "./trace-completion.js?v=20261003-video";
import { videoGroup, inputCandidate, navigationForProgram } from "./video-programs.js?v=20261003-perf";
import { outputRow, outputWindow } from "./output-view.js?v=20261003-video";
import { traceRedirect } from "./routing.js?v=20261003-seo";
import { createAssignmentFlow } from "./assignment-flow.js?v=20261004-fullscreen";
import { createFullscreen } from "./fullscreen.js?v=20261004-mobile";
import { createVariableScroll } from "./variable-scroll.js?v=20261004-scroll";

const $ = (id) => document.getElementById(id);
const ui = Object.fromEntries([
  "library-view", "runner-view", "example-grid", "runner-title", "runner-focus", "example-label",
  "next-button", "play-button", "play-label", "play-icon", "reset-button", "edit-button",
  "speed-control", "speed-button", "speed-value", "speed-panel", "speed-input", "speed-decrease", "speed-increase", "speed-error",
  "status-text", "status-dot", "current-line-label", "step-count", "program-lines", "variable-table", "variable-rows", "variables-body",
  "detail-label", "detail-title", "detail-explanation", "condition-result", "output-lines", "output-placeholder", "output-count",
  "completion-message", "error-message", "screen-reader-status", "values-dialog", "values-form", "parameter-fields",
  "values-preview", "form-error",
  "input-dialog", "input-form", "input-fields", "input-description", "call-stack", "call-stack-frames", "call-stack-note", "return-value", "variable-scope",
  "example-navigation", "program-variants", "trace-breadcrumb", "value-inspector", "inspector-title", "inspector-content",
  "output-history-button",
  "fullscreen-button", "fullscreen-surface", "fullscreen-workspace",
].map((id) => [id, $(id)]));

const settings = new Map();
const assignmentFlow = createAssignmentFlow(ui["variable-table"], ui["variable-rows"]);
const variableScroll = createVariableScroll(ui["variables-body"], ui["variable-rows"]);
const fullscreen = createFullscreen({
  runner: ui["runner-view"], surface: ui["fullscreen-surface"], mount: ui["fullscreen-workspace"], entryButton: ui["fullscreen-button"],
  controls: { next: ui["next-button"], reset: ui["reset-button"], edit: ui["edit-button"], play: ui["play-button"], speed: ui["speed-button"] },
  speedPanel: ui["speed-panel"], closeSpeed: closeSpeedPanel, onLayout: layoutWorkspace,
});
let example = null;
let parameters = null;
let compiled = null;
let state = null;
let paused = false;
const autoplay = createAutoplay({ advance: runOne });
let executionError = "";
let submitted = false;
let programRows = [];
let variableRows = new Map();
let parameterEditors = new Map();
let pendingInput = null;
let inputEditor = null;
let inputSubmitted = false;
let workspacePlan = null;

function element(tag, className = "", text = null) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== null) node.textContent = text;
  return node;
}

/** 色付けだけを行う。入力を HTML として挿入しない。 */
function highlighted(text) {
  const fragment = document.createDocumentFragment();
  const pattern = /"[^"]*"|-?\d+(?:\.\d+)?|\b[a-zA-Z_][a-zA-Z_0-9]*\b|そうでなくもし|そうでなければ|もし|ならば|繰り返す|の間|ずつ増やしながら|外部からの入力|要素数|定義する|返す|乱数|[｜⎿]/g;
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    fragment.append(document.createTextNode(text.slice(cursor, match.index)));
    const token = match[0];
    let type = "keyword";
    if (token.startsWith('"')) type = "string";
    else if (/^-?\d/.test(token)) type = "number";
    else if (/^[a-zA-Z_]/.test(token)) type = "variable";
    else if (/[｜⎿]/.test(token)) type = "branch";
    fragment.append(element("span", `token-${type}`, token));
    cursor = match.index + token.length;
  }
  fragment.append(document.createTextNode(text.slice(cursor)));
  return fragment;
}

function buildProgram() {
  programRows = [];
  ui["runner-view"].classList.toggle("has-functions", Object.values(compiled.lineKinds).includes("define"));
  ui["program-lines"].replaceChildren();
  for (const source of sourceLines(example, parameters)) {
    const section = example.lineSections?.[source.line];
    if (section) ui["program-lines"].append(element("li", "program-section", section));
    const row = element("li", "program-line");
    row.dataset.line = String(source.line);
    const content = element("code", "source-code");
    content.append(highlighted(source.text));
    const marker = element("span", "line-marker");
    row.append(element("span", "line-number", lineLabel(example, source.line)), content, marker);
    ui["program-lines"].append(row);
    programRows.push({ row, marker, line: source.line });
  }
}

function buildVariables() {
  variableRows = new Map();
  ui["variable-rows"].replaceChildren();
  for (const name of compiled.variableNames) {
    const row = element("div", "variable-row");
    row.setAttribute("role", "row");
    row.dataset.variable = name;
    const label = element("span", "variable-name", name);
    const value = element("div", "variable-value");
    const change = element("span", "variable-change");
    for (const node of [label, value, change]) node.setAttribute("role", "cell");
    row.append(label, value, change);
    ui["variable-rows"].append(row);
    variableRows.set(name, { row, value, change });
  }
}

function stop() {
  autoplay.stop();
}

function clearOutputs() {
  ui["output-lines"].replaceChildren();
  ui["screen-reader-status"].textContent = "";
}

function reset() {
  stop();
  closeInput();
  closeInspector();
  closeSpeedPanel();
  paused = false;
  executionError = "";
  state = createState(compiled, { seed: crypto.getRandomValues(new Uint32Array(1))[0] });
  clearOutputs();
  workspacePlan = planWorkspace(example, compiled, parameters);
  ui["output-lines"].style.setProperty("--output-columns", workspacePlan.outputColumns);
  render();
  sizeWorkspace(ui["runner-view"], workspacePlan);
}

function showExample(entry) {
  fullscreen.leave({ restoreHistory: false });
  stop();
  closeInput();
  closeInspector();
  if (ui["values-dialog"].open) ui["values-dialog"].close();
  example = entry;
  parameters = settings.get(example.id) ?? defaultParameters(example);
  settings.set(example.id, parameters);
  compileExample();
  ui["library-view"].hidden = true;
  ui["runner-view"].hidden = false;
  document.body.classList.add("is-tracing");
  ui["runner-title"].textContent = example.title;
  document.title = `${example.collection === "video" ? "Q" : "例"}${example.number} ${example.title}｜情報Ⅰ Study Atlas`;
  buildNavigation();
  buildProgram();
  buildVariables();
  reset();
  ui["runner-title"].focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

function showLibrary() {
  fullscreen.leave({ restoreHistory: false });
  stop();
  closeInput();
  closeInspector();
  closeSpeedPanel();
  if (ui["values-dialog"].open) ui["values-dialog"].close();
  ui["runner-view"].hidden = true;
  ui["library-view"].hidden = false;
  document.body.classList.remove("is-tracing");
  document.title = "プログラムトレース｜情報Ⅰ Study Atlas";
  buildBreadcrumb();
  $("library-title").focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

function compileExample() {
  compiled = compileProgram(example.program, { initialVariables: example.initialize?.(parameters) ?? {}, maxSteps: example.maxSteps });
}

function buildBreadcrumb(entry = null, origin = null) {
  const breadcrumb = ui["trace-breadcrumb"];
  breadcrumb.replaceChildren();
  const home = element("a", "", "Study Atlas");
  home.href = "../";
  breadcrumb.append(home, element("span", "", "/"));
  if (entry?.collection === "video" && origin?.primary.label === "問題へ戻る") {
    const video = element("a", "", "解説動画");
    video.href = origin.primary.href;
    breadcrumb.append(video, element("span", "", "/"));
  }
  breadcrumb.append(element("span", "", "プログラムトレース"));
}

function buildNavigation() {
  const origin = navigationForProgram(example, new URLSearchParams(location.search).get("from") ?? "");
  ui["example-navigation"].replaceChildren();
  for (const link of [origin.primary, origin.secondary].filter(Boolean)) {
    const anchor = element("a", "library-link", link.label);
    anchor.href = link.href;
    ui["example-navigation"].append(anchor);
  }
  buildBreadcrumb(example, origin);
  const group = videoGroup(example);
  const variants = group?.alternatives.length ? [group, ...group.alternatives] : [];
  ui["program-variants"].hidden = !variants.length;
  ui["program-variants"].replaceChildren();
  for (const variant of variants) {
    const anchor = element("a", "button", variant.variantLabel ?? group.variantLabel ?? "正しい式");
    anchor.href = `${location.search}#${variant.id}`;
    if (variant.id === example.id) anchor.setAttribute("aria-current", "true");
    ui["program-variants"].append(anchor);
  }
}

function route() {
  const id = location.hash.slice(1);
  const entry = findProgram(id);
  const redirect = traceRedirect(location.href, entry?.id);
  if (redirect) {
    location.replace(redirect);
    return;
  }
  if (entry) showExample(entry);
  else {
    const url = new URL(location.href);
    if (url.hash || url.searchParams.has("from")) {
      url.hash = "";
      url.searchParams.delete("from");
      history.replaceState(history.state, "", `${url.pathname}${url.search}`);
    }
    showLibrary();
  }
}

function render(animate = false) {
  const running = autoplay.running;
  const seconds = intervalSeconds(autoplay.interval);
  ui["runner-focus"].textContent = parameterText(example.focus, parameters);
  const defaults = defaultParameters(example);
  const modified = example.parameters.some((field) => JSON.stringify(parameters[field.key]) !== JSON.stringify(defaults[field.key]));
  ui["example-label"].textContent = `${example.collection === "video" ? `動画解説問題 Q${example.number}` : `例${example.number}`}${example.variantLabel ? ` · ${example.variantLabel}` : ""}${modified ? " · 値を変更済み" : ""}`;
  ui["edit-button"].disabled = !example.parameters.length || !!pendingInput;
  ui["next-button"].disabled = running || !!pendingInput || (state.completed && state.currentLine === null) || !!executionError;
  ui["play-button"].disabled = !!executionError || !!pendingInput;
  ui["play-label"].textContent = running ? "一時停止" : "自動実行";
  ui["play-icon"].setAttribute("d", running ? "M5 3h3v14H5zm7 0h3v14h-3z" : "m6 3 10 7-10 7Z");
  ui["play-button"].setAttribute("aria-pressed", String(running));
  ui["play-button"].classList.toggle("is-running", running);
  ui["play-button"].title = running
    ? `${seconds}秒ごとに実行中。クリックすると一時停止します。`
    : `${seconds}秒ごとに1ステップ実行します。${state.completed ? "最初から再実行します。" : ""}`;
  ui["speed-value"].textContent = `${seconds}秒`;
  ui["speed-button"].title = `1ステップ${seconds}秒。クリックで実行速度を調整します。`;
  ui["speed-decrease"].disabled = autoplay.interval === MIN_INTERVAL_MS;
  ui["speed-increase"].disabled = autoplay.interval === MAX_INTERVAL_MS;
  ui["status-text"].textContent = pendingInput ? "外部からの入力待ち" : executionError ? "実行を停止しました" : state.completed ? "実行完了" : running ? `自動実行中（${seconds}秒）` : paused ? "一時停止中" : state.steps ? "1行ずつ実行中" : "準備できました";
  ui["status-dot"].classList.toggle("running", running);
  ui["status-dot"].classList.toggle("complete", state.completed);
  const displayedLine = pendingInput?.line ?? state.currentLine;
  ui["current-line-label"].textContent = displayedLine === null ? "" : `${lineLabel(example, displayedLine)}行`;
  ui["step-count"].textContent = `${state.steps} ステップ`;

  for (const { row, marker, line } of programRows) {
    const current = line === displayedLine;
    row.classList.toggle("is-current", current);
    row.classList.toggle("is-skipped", state.skippedLines.includes(line));
    if (current) row.setAttribute("aria-current", "step");
    else row.removeAttribute("aria-current");
    marker.textContent = current ? "実行中" : state.skippedLines.includes(line) ? "スキップ" : "";
  }

  const sources = pendingInput ? [] : state.event?.sources ?? [];
  const assignments = pendingInput ? [] : state.event?.assignments ?? [];
  for (const [name, nodes] of variableRows) {
    const initialized = Object.hasOwn(state.variables, name);
    const value = state.variables[name];
    const changes = pendingInput ? [] : state.changes.filter((change) => change.name === name);
    const change = changes.at(-1);
    const shape = example.arrayShapes?.[name];
    const plannedValue = workspacePlan?.variables.get(name)?.value;
    nodes.row.classList.toggle("is-array", Array.isArray(value) || value?.kind === "matrix" || Array.isArray(plannedValue) || plannedValue?.kind === "matrix");
    renderValue(nodes.value, name, value, changes, pendingInput ? [] : state.reads, shape ? { rows: parameters[shape.rows], columns: parameters[shape.columns], start: shape.start } : null, { columnLabels: example.parameters.find((field) => field.key === name)?.columnLabels, sources, assignments });
    nodes.row.classList.toggle("is-source", sources.some((source) => source.name === name && source.indices.length === 0));
    const assigned = assignments.some((assignment) => assignment.name === name);
    nodes.row.classList.toggle("is-assignment-target", assigned);
    nodes.value.classList.toggle("is-unset", !initialized);
    if (animate) {
      nodes.row.classList.remove("is-changed");
      // 同じ変数が続けて更新された場合にも、変化のアニメーションを再開する。
      if (change) void nodes.row.offsetWidth;
    }
    nodes.row.classList.toggle("is-changed", !!change);
    renderChange(nodes.change, change, sources);
  }

  const event = pendingInput ? { line: pendingInput.line, title: "入力を待っています", explanation: `${pendingInput.name} に入れる値を入力してください。確定すると、この行の結果を反映します。` } : state.event;
  ui["detail-label"].textContent = event ? `実行中 · ${lineLabel(example, event.line)}行` : state.completed ? "実行完了" : "実行前";
  ui["detail-title"].textContent = event?.title ?? (state.completed ? "実行が終わりました" : "「次へ」で1行目を実行");
  ui["detail-explanation"].textContent = event?.explanation ?? (state.completed ? "「最初から」で、もう一度実行できます。" : "1行目から順に実行します。変数の値と出力は、緑の行の結果を示します。");
  const condition = event?.condition;
  ui["condition-result"].hidden = !condition;
  ui["condition-result"].replaceChildren();
  if (condition) {
    ui["condition-result"].classList.toggle("is-false", !condition.result);
    ui["condition-result"].append(element("code", "", condition.resolved.replace("<=", "≤")), element("span", "", "→"), element("strong", "", condition.result ? "真（成り立つ）" : "偽（成り立たない）"));
  }
  ui["return-value"].hidden = event?.returnValue === undefined;
  ui["return-value"].textContent = event?.returnValue === undefined ? "" : `返す値：${formatValue(event.returnValue)}`;
  ui["call-stack"].hidden = !state.callStack.length;
  ui["call-stack-frames"].replaceChildren();
  ui["call-stack-note"].textContent = "最後の呼び出しが実行中です。上の呼び出しは結果を待っています。";
  state.callStack.forEach((frame, index) => {
    const row = element("li", index === state.callStack.length - 1 ? "is-active-call" : "", `${frame.name}(${Object.values(frame.variables).map(formatValue).join(", ")})`);
    row.append(element("span", "", index === state.callStack.length - 1 ? "実行中" : "待機"));
    ui["call-stack-frames"].append(row);
  });
  const activeCall = state.callStack.at(-1);
  ui["variable-scope"].hidden = !activeCall;
  ui["variable-scope"].textContent = activeCall ? `${activeCall.name} の ${Object.entries(activeCall.variables).map(([name, value]) => `${name} = ${formatValue(value)}`).join(", ")} を表示しています。` : "";

  const outputList = ui["output-lines"];
  const outputView = outputWindow(state.output, workspacePlan?.outputLimit);
  if (outputList.dataset.firstOutput !== String(outputView.start)) outputList.replaceChildren();
  outputList.dataset.firstOutput = String(outputView.start);
  for (const row of outputList.children) row.classList.remove("is-new");
  while (outputList.children.length < outputView.items.length) {
    const index = outputView.start + outputList.children.length;
    const output = state.output[index];
    const row = outputRow(output, index);
    row.title = `${lineLabel(example, output.line)}行 · ステップ ${output.step}`;
    outputList.append(row);
  }
  if (["print", "plot"].includes(state.event?.kind)) outputList.lastElementChild?.classList.add("is-new");
  ui["output-placeholder"].hidden = state.output.length > 0;
  ui["output-count"].textContent = `${state.output.length} 件`;
  ui["output-history-button"].hidden = state.output.length <= (workspacePlan?.outputLimit ?? 30);
  ui["output-history-button"].textContent = `すべての出力を見る（${state.output.length}件）`;
  ui["completion-message"].hidden = !state.completed;
  ui["error-message"].hidden = !executionError;
  ui["error-message"].textContent = executionError;
  if (animate && state.event) {
    ui["screen-reader-status"].textContent = `${lineLabel(example, event.line)}行。${event.explanation}${state.completed ? "実行が終わりました。" : ""}`;
  }
  assignmentFlow.update(pendingInput || executionError ? null : state.event);
  variableScroll.update(pendingInput || executionError ? null : state.event);
  fullscreen.sync();
}

function runOne(options = {}) {
  if (!state || executionError || pendingInput || (state.completed && state.currentLine === null)) return false;
  if (state.completed) {
    stop();
    paused = false;
    state = finishTrace(state);
    render();
    return false;
  }
  const request = inputRequest(compiled, state);
  if (request && options.input === undefined) {
    openInput(request);
    return false;
  }
  try {
    state = step(compiled, state, parameters, options);
  } catch (error) {
    stop();
    executionError = error instanceof Error ? error.message : "実行中にエラーが起きました。最初から実行してください。";
  }
  render(true);
  return !executionError;
}

ui["next-button"].addEventListener("click", () => { paused = false; runOne(); });
ui["play-button"].addEventListener("click", () => {
  if (executionError) return;
  if (autoplay.running) {
    stop();
    paused = true;
    render();
  } else {
    paused = false;
    if (state.completed) reset();
    autoplay.start();
  }
});
ui["reset-button"].addEventListener("click", reset);

function closeSpeedPanel(focusButton = false) {
  ui["speed-panel"].hidden = true;
  ui["speed-button"].setAttribute("aria-expanded", "false");
  ui["speed-input"].value = intervalSeconds(autoplay.interval);
  ui["speed-input"].setAttribute("aria-invalid", "false");
  ui["speed-error"].hidden = true;
  if (focusButton) fullscreen.control("speed").focus();
  fullscreen.sync();
}

function applySpeedInput(showError = false) {
  const input = ui["speed-input"];
  const valid = input.value.trim() !== "" && input.validity.valid
    && Number.isInteger(Number((Number(input.value) * 1000).toFixed(6)))
    && autoplay.setInterval(Math.round(Number(input.value) * 1000));
  input.setAttribute("aria-invalid", String(showError && !valid));
  ui["speed-error"].hidden = valid || !showError;
  if (valid) render();
  return valid;
}

ui["speed-input"].max = String(MAX_INTERVAL_MS / 1000);
ui["speed-button"].addEventListener("click", () => {
  if (!ui["speed-panel"].hidden) { closeSpeedPanel(); return; }
  ui["speed-panel"].hidden = false;
  ui["speed-button"].setAttribute("aria-expanded", "true");
  ui["speed-input"].value = intervalSeconds(autoplay.interval);
  fullscreen.sync();
});
ui["speed-input"].addEventListener("input", () => applySpeedInput());
ui["speed-input"].addEventListener("keydown", (event) => {
  if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
  event.preventDefault();
  ui["speed-input"].value = intervalSeconds(adjustInterval(autoplay.interval, event.key === "ArrowUp" ? 1 : -1));
  applySpeedInput(true);
});
function commitSpeedInput() {
  if (applySpeedInput(true)) ui["speed-input"].value = intervalSeconds(autoplay.interval);
}
for (const eventName of ["change", "blur"]) ui["speed-input"].addEventListener(eventName, commitSpeedInput);
for (const [id, direction] of [["speed-decrease", -1], ["speed-increase", 1]]) {
  ui[id].addEventListener("click", () => {
    ui["speed-input"].value = intervalSeconds(adjustInterval(autoplay.interval, direction));
    applySpeedInput(true);
  });
}
document.addEventListener("click", (event) => {
  if (!ui["speed-panel"].hidden && !ui["speed-control"].contains(event.target) && !fullscreen.containsSpeedControl(event.target)) closeSpeedPanel();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !ui["speed-panel"].hidden) {
    event.preventDefault();
    closeSpeedPanel(true);
  }
});

function draftValues() {
  return Object.fromEntries([...parameterEditors].map(([key, editor]) => [key, editor.getValue()]));
}

function updatePreview(showErrors = false) {
  const result = validateParameters(example, draftValues());
  ui["values-preview"].textContent = result.valid ? sourceLines(example, result.values).map(({ line, text }) => `${lineLabel(example, line)}${text}`).join("\n") : "値を正しく入力すると、変更後のプログラムを確認できます。";
  for (const field of example.parameters) {
    const error = result.errors[field.key];
    parameterEditors.get(field.key).setError(showErrors ? error : null);
  }
  ui["form-error"].hidden = !showErrors || !result.formError;
  ui["form-error"].textContent = showErrors ? result.formError ?? "" : "";
  return result;
}

ui["edit-button"].addEventListener("click", () => {
  if (autoplay.running) { stop(); paused = true; render(); }
  submitted = false;
  parameterEditors = new Map();
  ui["parameter-fields"].replaceChildren();
  for (const field of example.parameters) {
    const editor = createFieldEditor(field, cloneValue(parameters[field.key]), { prefix: "param", onChange: () => updatePreview(submitted) });
    parameterEditors.set(field.key, editor);
    ui["parameter-fields"].append(editor.node);
  }
  $("values-description").textContent = `初期値や条件を変えて、動きを比べてみましょう。適用すると、出力と変数をリセットして最初から実行できます。${example.inputs.length ? "外部入力の設定は、実行時のダイアログに入力候補として反映されます。" : ""}`;
  updatePreview();
  ui["values-dialog"].showModal();
  parameterEditors.values().next().value?.focus();
});
ui["values-form"].addEventListener("submit", (event) => {
  event.preventDefault();
  submitted = true;
  const result = updatePreview(true);
  if (!result.valid) {
    ui["parameter-fields"].querySelector('[aria-invalid="true"]')?.focus();
    return;
  }
  parameters = result.values;
  settings.set(example.id, parameters);
  compileExample();
  buildProgram();
  buildVariables();
  reset();
  ui["values-dialog"].close();
  fullscreen.control("next").focus();
});
$("default-values").addEventListener("click", () => {
  const defaults = defaultParameters(example);
  for (const field of example.parameters) parameterEditors.get(field.key).setValue(defaults[field.key]);
  submitted = false;
  updatePreview();
});
for (const id of ["close-dialog", "cancel-values"]) $(id).addEventListener("click", () => ui["values-dialog"].close());
ui["values-dialog"].addEventListener("click", (event) => {
  if (event.target !== ui["values-dialog"]) return;
  const bounds = ui["values-dialog"].getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) ui["values-dialog"].close();
});

function closeInput() {
  pendingInput = null;
  inputEditor = null;
  if (ui["input-dialog"].open) ui["input-dialog"].close();
}

function checkInput(showError = false) {
  const result = validateField(pendingInput.field, inputEditor.getValue());
  inputEditor.setError(showError ? result.error : null);
  return result;
}

function openInput(request) {
  const resume = autoplay.running;
  stop();
  closeSpeedPanel();
  pendingInput = { ...request, resume };
  inputSubmitted = false;
  inputEditor = createFieldEditor(request.field, cloneValue(inputCandidate(example, request.field, state, parameters)), { prefix: "external", onChange: () => checkInput(inputSubmitted) });
  ui["input-fields"].replaceChildren(inputEditor.node);
  ui["input-description"].textContent = `${lineLabel(example, request.line)}行：${request.name} に入れる値を入力してください。${request.field.sorted ? "二分探索では、小さい順に並んだ配列を使います。" : ""}`;
  render();
  ui["input-dialog"].showModal();
  // 入力欄への自動フォーカスでスマホのキーボードを開かない。
  $("input-title").focus({ preventScroll: true });
}

function cancelInput() {
  const wasAutomatic = pendingInput?.resume;
  closeInput();
  paused = !!wasAutomatic || paused;
  render();
  fullscreen.control("next").focus();
}

ui["input-form"].addEventListener("submit", (event) => {
  event.preventDefault();
  inputSubmitted = true;
  const result = checkInput(true);
  if (result.error) { inputEditor.focus(); return; }
  const resume = pendingInput.resume;
  closeInput();
  paused = false;
  runOne({ input: result.value });
  if (resume && !executionError && !document.hidden) autoplay.start({ immediate: false });
  render();
  fullscreen.control(autoplay.running ? "play" : "next").focus();
});
for (const id of ["close-input", "cancel-input"]) $(id).addEventListener("click", cancelInput);
ui["input-dialog"].addEventListener("cancel", (event) => { event.preventDefault(); cancelInput(); });

window.addEventListener("hashchange", route);
function closeInspector() {
  if (ui["value-inspector"].open) ui["value-inspector"].close();
}
$("close-inspector").addEventListener("click", closeInspector);
ui["output-history-button"].addEventListener("click", () => {
  if (autoplay.running) { stop(); paused = true; render(); }
  ui["inspector-title"].textContent = "すべての出力";
  const list = element("ol", "output-lines output-lines-full");
  state.output.forEach((output, index) => list.append(outputRow(output, index)));
  ui["inspector-content"].replaceChildren(list);
  ui["value-inspector"].showModal();
});
ui["variable-rows"].addEventListener("click", (event) => {
  const button = event.target.closest("[data-inspect-array]");
  if (!button) return;
  if (autoplay.running) { stop(); paused = true; render(); }
  const name = button.dataset.inspectArray;
  ui["inspector-title"].textContent = `${name} のすべての要素`;
  renderValue(ui["inspector-content"], name, state.variables[name], state.changes.filter((change) => change.name === name), state.reads, null, { full: true, sources: state.event?.sources ?? [], assignments: state.event?.assignments ?? [] });
  ui["value-inspector"].showModal();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && autoplay.running) { stop(); paused = true; render(); }
});
document.addEventListener("keydown", (event) => {
  if (event.code !== "Space" || event.repeat || event.altKey || event.ctrlKey || event.metaKey || ui["runner-view"].hidden || document.querySelector("dialog[open]") || event.target.closest("button, input, select, a, textarea, [contenteditable]")) return;
  if (!autoplay.running && !(state.completed && state.currentLine === null) && !executionError) {
    event.preventDefault();
    paused = false;
    runOne();
  }
});
function layoutWorkspace() {
  if (workspacePlan && !ui["runner-view"].hidden) {
    sizeWorkspace(ui["runner-view"], workspacePlan);
    render();
    assignmentFlow.redraw();
    variableScroll.reveal();
  }
}
window.addEventListener("resize", () => { if (!fullscreen.active) layoutWorkspace(); });
route();

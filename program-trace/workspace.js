import { createState, step, inputRequest } from "./interpreter.js?v=20261003-sources";
import { formatValue } from "./values.js?v=20261003-video";
import { renderValue, renderChange } from "./value-view.js?v=20261003-sources";
import { inputCandidate } from "./video-programs.js?v=20261003-perf";
import { outputRow, outputWindow, MAX_VISIBLE_OUTPUTS } from "./output-view.js?v=20261003-video";

const initialEvent = {
  title: "「次へ」で1行目を実行",
  explanation: "1行目から順に実行します。変数の値と出力は、緑の行の結果を示します。",
};

function changeText(change) {
  if (change.indices) return `${change.name}[${change.indices.join(", ")}] ${formatValue(change.beforeElement)} → ${formatValue(change.afterElement)}`;
  if (Array.isArray(change.after)) return `未代入 → ${change.after.length}個の配列`;
  return `${change.before === undefined ? "未代入" : formatValue(change.before)} → ${change.after === undefined ? "呼び出し終了" : formatValue(change.after)}`;
}

/** 表示に必要な最大量を実行前に求める。入力候補と許容範囲も考慮する。 */
export function planWorkspace(example, compiled, parameters) {
  const variables = new Map(compiled.variableNames.map((name) => [name, { value: compiled.initialVariables?.[name], change: null }]));
  const events = new Map([["initial", initialEvent]]);
  const outputs = [];
  let calls = [];
  const inputs = example.inputs ?? [];
  const profiles = [{}];
  if (inputs.length && !example.scriptedInputPlan) {
    for (const boundary of ["min", "max"]) {
      profiles.push(Object.fromEntries(inputs.map((field) => [field.key, field.type === "array"
        ? Array.from({ length: field.maxLength }, (_, index) => boundary === "min" ? field.min : field.sorted
          ? Math.max(field.min, field.max - field.maxLength + 1 + index) : Math.max(field.min, field.max - index))
        : field[boundary]])));
    }
    for (const field of inputs) {
      if (field.choices && field.type !== "array") for (const choice of field.choices) profiles.push({ [field.key]: choice });
    }
  }
  for (const [name, limit] of Object.entries(example.displayArrayLimits ?? {})) {
    const record = variables.get(name);
    if (record) record.value = Array.from({ length: limit.length }, () => limit.fill);
  }
  for (const profile of profiles) {
    let sample = createState(compiled);
    try {
      while (!sample.completed) {
        const request = inputRequest(compiled, sample);
        sample = step(compiled, sample, parameters, request ? { input: profile[request.field.key] ?? inputCandidate(example, request.field, sample, parameters) } : {});
        for (const [name, value] of Object.entries(sample.variables)) {
          const record = variables.get(name);
          if (!record) continue;
          if (formatValue(value).length > formatValue(record.value).length || record.value === undefined) record.value = value;
        }
        for (const change of sample.changes) {
          const record = variables.get(change.name);
          const text = changeText(change);
          if (record && (!record.change || text.length > changeText(record.change).length)) record.change = change;
        }
        const event = sample.event;
        const key = `${event.kind}:${event.line}:${event.condition?.result}`;
        const score = (item) => item.title.length + item.explanation.length + (item.condition?.resolved.length ?? 0);
        if (!events.has(key) || score(event) > score(events.get(key))) events.set(key, event);
        if (sample.callStack.length > calls.length) calls = sample.callStack;
      }
      sample.output.forEach((output, index) => {
        if (output.kind === "plot") outputs[index] = output;
        else if (!outputs[index] || output.text.length > outputs[index].length) outputs[index] = output.text;
      });
    } catch {
      // 将来の例題で試算できない場合も、実行画面を開けるようにする。
    }
  }
  const outputLimit = Math.max(1, Math.min(MAX_VISIBLE_OUTPUTS, outputs.length));
  return { variables, events: [...events.values()], outputs, outputLimit, outputHistory: outputs.length > outputLimit || example.number === 290, calls, arrayShapes: example.arrayShapes ?? {}, columnLabels: Object.fromEntries(example.parameters.filter((field) => field.columnLabels).map((field) => [field.key, field.columnLabels])), parameters, outputColumns: example.outputColumns ?? 1 };
}

/** 隠した計測用のコピーで高さを決める。ステップ実行時には計測も変更もしない。 */
export function sizeWorkspace(runner, plan) {
  const column = runner.querySelector(".result-column");
  const probe = column.cloneNode(true);
  probe.classList.add("workspace-probe");
  probe.setAttribute("aria-hidden", "true");
  probe.inert = true;
  probe.style.width = `${column.getBoundingClientRect().width}px`;
  // コピーのidを除き、実画面のラベルや参照先と衝突させない。
  for (const node of probe.querySelectorAll("[id], [aria-labelledby]")) {
    if (node.id) node.dataset.measure = node.id;
    node.removeAttribute("id");
    node.removeAttribute("aria-labelledby");
  }
  for (const panel of probe.querySelectorAll(".panel")) panel.style.height = "auto";
  runner.append(probe);
  const find = (id) => probe.querySelector(`[data-measure="${id}"]`);
  const explanation = probe.querySelector(".explanation-panel");
  const detail = probe.querySelector(".step-detail");
  const condition = find("condition-result");
  const returned = find("return-value");
  const stack = find("call-stack");
  stack.hidden = true;
  let detailHeight = 0;
  for (const event of plan.events) {
    find("detail-label").textContent = "実行中 · （01）行";
    find("detail-title").textContent = event.title;
    find("detail-explanation").textContent = event.explanation;
    condition.hidden = !event.condition;
    condition.replaceChildren();
    if (event.condition) {
      for (const [tag, text] of [["code", event.condition.resolved], ["span", "→"], ["strong", "偽（成り立たない）"]]) {
        const child = document.createElement(tag);
        child.textContent = text;
        condition.append(child);
      }
    }
    returned.hidden = event.returnValue === undefined;
    returned.textContent = `返す値：${formatValue(event.returnValue)}`;
    detailHeight = Math.max(detailHeight, detail.getBoundingClientRect().height);
  }
  detail.style.minHeight = `${Math.ceil(detailHeight)}px`;
  stack.hidden = !plan.calls.length;
  find("call-stack-frames").replaceChildren();
  for (const frame of plan.calls) {
    const item = document.createElement("li");
    item.textContent = `${frame.name}(${Object.values(frame.variables).map(formatValue).join(", ")}) 実行中`;
    find("call-stack-frames").append(item);
  }
  const explanationHeight = explanation.getBoundingClientRect().height;
  const rows = find("variable-rows");
  for (const row of rows.children) {
    const name = row.dataset.variable;
    const record = plan.variables.get(name);
    const shape = plan.arrayShapes[name];
    row.classList.toggle("is-array", Array.isArray(record.value) || record.value?.kind === "matrix");
    const sizingChanges = Array.isArray(record.value) && record.value.length > 40 ? [12, 18, 24].map((index) => ({ name, indices: [index] })) : [];
    renderValue(row.querySelector(".variable-value"), name, record.value, sizingChanges, [], shape
      ? { rows: plan.parameters[shape.rows], columns: plan.parameters[shape.columns], start: shape.start } : null, { columnLabels: plan.columnLabels[name] });
    renderChange(row.querySelector(".variable-change"), record.change);
  }
  find("variable-scope").hidden = !plan.calls.length;
  const activeCall = plan.calls.at(-1);
  find("variable-scope").textContent = activeCall ? `${activeCall.name} の ${Object.entries(activeCall.variables).map(([name, value]) => `${name} = ${formatValue(value)}`).join(", ")} を表示しています。` : "";
  const variablesHeight = probe.querySelector(".variables-panel").getBoundingClientRect().height;
  const list = find("output-lines");
  list.replaceChildren();
  list.style.setProperty("--output-columns", plan.outputColumns);
  find("output-placeholder").hidden = !!plan.outputs.length;
  const window = outputWindow(plan.outputs, plan.outputLimit);
  window.items.forEach((output, index) => list.append(outputRow(output, index + window.start)));
  find("output-history-button").hidden = !plan.outputHistory;
  const outputHeight = Math.max(100, probe.querySelector(".output-panel").getBoundingClientRect().height);
  runner.style.setProperty("--explanation-height", `${Math.ceil(explanationHeight) + 2}px`);
  runner.style.setProperty("--variables-height", `${Math.ceil(variablesHeight) + 2}px`);
  runner.style.setProperty("--output-height", `${Math.ceil(outputHeight) + 2}px`);
  probe.remove();
}

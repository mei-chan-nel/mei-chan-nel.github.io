import { fieldHelp, matrixAxes } from "./values.js?v=20261003-video";

const node = (tag, className = "", text = null) => {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== null) element.textContent = text;
  return element;
};

/** 設定と外部入力で共有する。配列は各要素の入力・追加・削除に対応する。 */
export function createFieldEditor(field, initial, { prefix, onChange = () => {} }) {
  if (field.type === "matrix") return createMatrixEditor(field, initial, { prefix, onChange });
  const array = field.type === "array";
  const wrapper = node(array ? "fieldset" : "div", `parameter-field${array ? " array-field" : ""}`);
  const label = node(array ? "legend" : "label", "", field.label);
  const help = node("p", "field-help", fieldHelp(field));
  const error = node("p", "field-error");
  const id = `${prefix}-${field.key}`;
  help.id = `${id}-help`;
  error.id = `${id}-error`;
  error.hidden = true;
  wrapper.append(label);
  const numberInput = (value, inputId, inputLabel, schema = field) => {
    const choices = schema.choices;
    const text = schema.type === "text" || schema.elementType === "text";
    const input = node(choices ? "select" : "input");
    input.id = inputId;
    if (choices) for (const choice of choices) { const option = node("option", "", String(choice)); option.value = String(choice); input.append(option); }
    else if (text) { input.type = "text"; input.maxLength = schema.textMaxLength ?? schema.maxLength ?? 40; }
    else { input.type = "number"; input.step = schema.integer === false ? "any" : "1"; input.min = String(schema.min); input.max = String(schema.max); }
    input.required = !schema.allowEmpty;
    input.value = String(value);
    input.setAttribute("aria-label", inputLabel);
    input.setAttribute("aria-describedby", `${help.id} ${error.id}`);
    return input;
  };

  let scalar;
  let inputs = [];
  let cells;
  let count;
  let add;
  const cellValues = () => inputs.map((input) => input.value);
  function renderCells(values) {
    inputs = [];
    cells.replaceChildren();
    for (const [index, value] of values.entries()) {
      const cell = node("div", "array-editor-cell");
      const indexLabel = node("label", "", `[${index + (field.indexStart ?? 0)}]${field.columnLabels?.[index] ? ` ${field.columnLabels[index]}` : ""}`);
      indexLabel.htmlFor = `${id}-${index}`;
      const elementName = field.matrixName
        ? `${field.matrixName}[${field.rowIndex}, ${index + (field.indexStart ?? 0)}]`
        : `${field.key}[${index + (field.indexStart ?? 0)}]`;
      const input = numberInput(value, indexLabel.htmlFor, `${elementName}${field.columnLabels?.[index] ? ` ${field.columnLabels[index]}` : ""}`, field.columns?.[index] ?? field);
      const deleteButton = node("button", "array-remove", "×");
      deleteButton.type = "button";
      deleteButton.disabled = values.length <= field.minLength || !!field.columns;
      deleteButton.hidden = field.minLength === field.maxLength;
      deleteButton.setAttribute("aria-label", `${elementName} を削除`);
      deleteButton.addEventListener("click", () => {
        const next = cellValues();
        next.splice(index, 1);
        setValue(next);
        onChange();
        inputs[Math.min(index, inputs.length - 1)]?.focus();
      });
      input.addEventListener("input", onChange);
      cell.append(indexLabel, input, deleteButton);
      cells.append(cell);
      inputs.push(input);
    }
    count.textContent = `${values.length} 個`;
    add.disabled = values.length >= field.maxLength;
  }

  function setValue(value) {
    if (!array) { scalar.value = String(value); return; }
    renderCells(value);
  }

  if (array) {
    const controls = node("div", "array-length-controls");
    count = node("strong", "array-count");
    count.setAttribute("aria-live", "polite");
    add = node("button", "button array-count-button", "＋ 要素を追加する");
    add.type = "button";
    add.hidden = field.minLength === field.maxLength;
    add.setAttribute("aria-label", `${field.key} の要素を追加する`);
    add.addEventListener("click", () => {
      const values = cellValues();
      if (values.length >= field.maxLength) return;
      values.push(field.choices?.[0] ?? (field.elementType === "text" ? "" : field.sorted ? values.at(-1) ?? Math.max(0, field.min) : Math.max(0, field.min)));
      setValue(values);
      onChange();
      inputs.at(-1)?.focus();
    });
    controls.append(count, add);
    cells = node("div", "array-editor-cells");
    wrapper.append(help, controls, cells, error);
  } else {
    label.htmlFor = id;
    scalar = numberInput(initial, id, field.label);
    scalar.addEventListener("input", onChange);
    wrapper.append(scalar, help, error);
  }
  setValue(initial);

  return {
    node: wrapper,
    getValue: () => array ? cellValues() : scalar.value,
    setValue,
    setError(message) {
      error.textContent = message ?? "";
      error.hidden = !message;
      wrapper.setAttribute("aria-invalid", String(!!message));
      for (const input of array ? inputs : [scalar]) input.setAttribute("aria-invalid", String(!!message));
    },
    focus: () => (array ? inputs[0] ?? add : scalar).focus(),
  };
}

function createMatrixEditor(field, initial, { prefix, onChange }) {
  const wrapper = node("fieldset", "parameter-field array-field matrix-field");
  wrapper.append(node("legend", "", field.label), node("p", "field-help", fieldHelp(field)));
  const rows = node("div", "matrix-editor-rows");
  const add = node("button", "button array-count-button", "＋ 行を追加する");
  add.type = "button";
  const error = node("p", "field-error");
  error.hidden = true;
  wrapper.append(rows, add, error);
  let editors = [];
  const getValue = () => editors.map((editor) => editor.getValue());
  function setValue(value) {
    const values = value?.kind === "matrix" ? (() => { const axes = matrixAxes(value); return axes.rows.map((row) => axes.columns.map((column) => value.cells[`${row},${column}`])); })() : value;
    editors = [];
    rows.replaceChildren();
    values.forEach((row, index) => {
      const editor = createFieldEditor({ ...field, type: "array", key: `${field.key}_${index}`, matrixName: field.key, rowIndex: index + (field.start ?? 0), label: `${index + (field.start ?? 0)}行`, indexStart: field.start ?? 0, minLength: field.columnCount, maxLength: field.columnCount }, row, { prefix, onChange });
      editor.node.classList.add("matrix-editor-row");
      const remove = node("button", "matrix-row-remove", "×");
      remove.type = "button";
      remove.disabled = values.length <= field.minRows;
      remove.setAttribute("aria-label", `${field.key} の ${index + (field.start ?? 0)}行を削除`);
      remove.addEventListener("click", () => { const next = getValue(); next.splice(index, 1); setValue(next); onChange(); });
      editor.node.append(remove);
      editors.push(editor);
      rows.append(editor.node);
    });
    add.disabled = values.length >= field.maxRows;
  }
  add.addEventListener("click", () => {
    const next = getValue();
    next.push(Array.from({ length: field.columnCount }, (_, index) => field.columns?.[index]?.choices?.[0] ?? (field.columns?.[index]?.type === "text" ? "" : 0)));
    setValue(next); onChange();
  });
  setValue(initial);
  return { node: wrapper, getValue, setValue, setError(message) { error.textContent = message ?? ""; error.hidden = !message; }, focus() { editors[0]?.focus(); } };
}

import { OPS, SIZE, text, validateCell } from "./model.mjs";
import {
  field,
  selection,
} from "../../program-trace/studio/expression-editor.js?v=20261009-function-help3";

// Use Studio's row-dialog interaction and its shared input controls.
// The saved initial cell is edited separately from the execution's RAM copy.
export function createRamEditor({ apply }) {
  const dialog = document.createElement("dialog");
  dialog.id = "ram-edit-dialog";
  dialog.className = "memory-dialog row-dialog ram-edit-dialog";
  dialog.setAttribute("aria-labelledby", "ram-edit-heading");
  dialog.innerHTML = `<form id="ram-edit-form" novalidate>
    <div class="document-dialog-heading dialog-heading"><h2 id="ram-edit-heading"></h2><button type="button" class="document-close" data-cancel aria-label="閉じる">×</button></div>
    <p id="ram-edit-current" class="document-description"></p>
    <div id="ram-edit-fields"></div>
    <p id="ram-edit-preview" class="ram-edit-preview"></p>
    <p class="document-help">初期内容を編集します。反映すると、CPU・RAM・キャッシュと計測値を初期状態に戻します。</p>
    <p id="ram-edit-error" class="document-error form-error" role="alert" hidden></p>
    <div class="document-dialog-actions row-confirm-actions"><button type="button" data-cancel>キャンセル</button><button type="submit" class="document-primary">この番地に反映</button></div>
  </form>`;
  document.body.append(dialog);
  const find = (id) => dialog.querySelector(`#${id}`);
  let address, kind, operand, opener;
  dialog
    .querySelectorAll("[data-cancel]")
    .forEach((b) => b.addEventListener("click", () => dialog.close()));
  dialog.addEventListener("close", () =>
    opener?.focus({ preventScroll: true }),
  );
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (
      event.clientX < r.left ||
      event.clientX > r.right ||
      event.clientY < r.top ||
      event.clientY > r.bottom
    )
      dialog.close();
  });
  const cell = () => {
    if (kind.input.value !== "halt" && !operand.input.value.trim())
      throw new Error("値または対象番地を入力してください。");
    const result = {
      op: kind.input.value,
      arg: kind.input.value === "halt" ? 0 : Number(operand.input.value),
    };
    validateCell(result);
    return result;
  };
  function preview() {
    const value = ["data", "set"].includes(kind.input.value);
    operand.input.disabled = kind.input.value === "halt";
    operand.input.min = value ? String(Number.MIN_SAFE_INTEGER) : "0";
    operand.input.max = value
      ? String(Number.MAX_SAFE_INTEGER)
      : String(SIZE - 1);
    operand.node.firstChild.textContent = value ? "値" : "対象番地";
    try {
      find("ram-edit-preview").textContent = text(cell());
    } catch {
      find("ram-edit-preview").textContent = "入力を確認してください";
    }
    find("ram-edit-error").hidden = true;
  }
  find("ram-edit-form").addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      apply(address, cell());
      dialog.close();
    } catch (error) {
      find("ram-edit-error").textContent = error.message;
      find("ram-edit-error").hidden = false;
    }
  });
  return {
    open(index, initial, current, button) {
      address = index;
      opener = button;
      find("ram-edit-heading").textContent = `${index}番地を設定する`;
      find("ram-edit-current").textContent = `現在の内容：${text(current)}`;
      kind = selection(
        "種類",
        OPS.map(([op, label]) => [op, label]),
        initial.op,
      );
      operand = field("値", String(initial.arg), "number");
      kind.input.id = "ram-edit-kind";
      operand.input.id = "ram-edit-operand";
      kind.node.querySelector("label").htmlFor = kind.input.id;
      operand.node.querySelector("label").htmlFor = operand.input.id;
      operand.input.step = "1";
      find("ram-edit-fields").replaceChildren(kind.node, operand.node);
      kind.input.addEventListener("change", preview);
      operand.input.addEventListener("input", preview);
      preview();
      dialog.showModal();
      kind.input.focus();
    },
  };
}

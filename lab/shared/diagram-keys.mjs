const FORMAT = "interactive-lab-diagram-clipboard";

export function clipboardText(editor, data) {
  return JSON.stringify({ format: FORMAT, version: 1, editor, data });
}

export function clipboardData(editor, text) {
  // Ordinary text, files and parts from a different editor keep their native
  // paste behavior. Never fall back to a previous, stale clipboard value.
  if (!text || text.length > 100000) return null;
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (value?.format !== FORMAT || value.editor !== editor) return null;
  if (value.version !== 1 || !value.data || typeof value.data !== "object")
    throw Error("コピーした図形の形式を読み取れません。");
  return value.data;
}

export function editingText(event, root = document) {
  const editable = (element) =>
    element?.isContentEditable ||
    !!element?.closest?.("input, textarea, select, [role=textbox]");
  return (
    !!root.querySelector("dialog[open]") ||
    editable(event.target) ||
    editable(root.activeElement)
  );
}

export function bindDiagramKeys({
  editor,
  selected,
  cancel,
  remove,
  copy,
  paste,
  message,
  enabled = () => true,
  root = document,
}) {
  const available = (event) =>
    !event.defaultPrevented &&
    !event.isComposing &&
    enabled() &&
    !editingText(event, root);
  root.addEventListener("keydown", (event) => {
    if (!available(event) || event.ctrlKey || event.metaKey || event.altKey)
      return;
    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    } else if (["Delete", "Backspace"].includes(event.key) && selected()) {
      event.preventDefault();
      remove();
    }
  });
  root.addEventListener("copy", (event) => {
    if (
      !available(event) ||
      !event.clipboardData ||
      root.getSelection()?.toString()
    )
      return;
    try {
      const data = copy();
      if (!data) return;
      event.clipboardData.setData("text/plain", clipboardText(editor, data));
      event.preventDefault();
      message("図形をコピーしました。");
    } catch (error) {
      message(error.message || "コピーできませんでした。", true);
    }
  });
  root.addEventListener("paste", (event) => {
    if (!available(event) || !event.clipboardData) return;
    try {
      const data = clipboardData(
        editor,
        event.clipboardData.getData("text/plain"),
      );
      if (!data) return;
      event.preventDefault();
      paste(data);
      message("図形を貼り付けました。");
    } catch (error) {
      event.preventDefault();
      message(error.message || "貼り付けできませんでした。", true);
    }
  });
}

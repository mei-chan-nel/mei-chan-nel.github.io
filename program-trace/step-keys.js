/** キーの自動リピートを1回ずつ処理し、入力やボタン本来の操作は妨げない。 */
export function bindStepKeys({ isActive, canAdvance, advance, nextButton, root = document }) {
  function keydown(event) {
    if (!(event.code === "Space" || event.key === " " || event.key === "Enter") || event.isComposing
      || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || !isActive()
      || root.querySelector("dialog[open]")) return;
    const control = event.target?.closest?.("button, input, select, textarea, a, summary, [contenteditable], [role=button], [role=separator]");
    if (control && control !== nextButton() && control.dataset?.control !== "next") return;
    // Spaceのページスクロールと、Enter/Spaceによるボタンの二重実行を防ぐ。
    event.preventDefault();
    if (canAdvance()) advance();
  }
  root.addEventListener("keydown", keydown);
  return () => root.removeEventListener("keydown", keydown);
}

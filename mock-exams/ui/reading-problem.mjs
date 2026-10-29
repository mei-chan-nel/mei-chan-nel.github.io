// Extract from the same cached screen document, retaining original ancestors,
// figures and styles. Only the selected question and required context survive.
const fragments = new Map();
export function readingProblemHTML(source, unit) {
  const cached = fragments.get(source)?.get(unit.id);
  if (cached) return cached;
  const d = new DOMParser().parseFromString(source, "text/html");
  const selected = new Set(
    d.querySelectorAll(`[data-reading-for~="${unit.id}"]`),
  );
  if (!selected.size)
    throw Error("この設問の問題を表示できません。解説に戻ってください。");
  const ancestors = new Set();
  for (const e of selected)
    for (let parent = e; parent; parent = parent.parentElement)
      ancestors.add(parent);
  const prune = (node) => {
    if (selected.has(node)) return;
    for (const child of [...node.childNodes]) {
      if (child.nodeType === 1 && ancestors.has(child)) prune(child);
      else child.remove();
    }
  };
  prune(d.body);
  d.documentElement.setAttribute("data-reading-fragment", "");
  d.body.dataset.readingTarget = unit.id;
  for (const e of d.querySelectorAll("[data-field]"))
    if (unit.fields.includes(e.dataset.field)) e.dataset.readingFocus = "true";
  // Show the requested question immediately. Earlier shared material remains
  // available in a disclosure, so a later question does not start with pages
  // of context from previous questions.
  let start = d.querySelector(`[data-reading-units~="${unit.id}"]`);
  const firstField = d.querySelector('[data-reading-focus="true"]');
  const fieldBlock =
    firstField?.closest("figure") ||
    firstField?.closest("p,fieldset,table,.qtitle");
  if (
    fieldBlock &&
    (!start ||
      fieldBlock.compareDocumentPosition(start) &
        Node.DOCUMENT_POSITION_FOLLOWING)
  )
    start = fieldBlock;
  if (start) {
    const range = d.createRange();
    range.setStart(d.body, 0);
    range.setEndBefore(start);
    const context = range.cloneContents();
    if (
      context.textContent.trim().length >= 160 ||
      context.querySelector("table,figure,img,svg")
    ) {
      range.deleteContents();
      const details = d.createElement("details");
      details.className = "problem-context";
      const summary = d.createElement("summary");
      summary.textContent = "共通の文章・図表を見る";
      details.append(summary, context);
      d.body.prepend(details);
    }
  }
  const result = "<!doctype html>\n" + d.documentElement.outerHTML;
  if (!fragments.has(source)) fragments.set(source, new Map());
  fragments.get(source).set(unit.id, result);
  return result;
}

export function addProblemLinks(d, exam, open) {
  for (const anchor of d.querySelectorAll("[data-reading-units]")) {
    const ids = anchor.dataset.readingUnits.split(" ");
    const labels = ids
      .flatMap((id) => exam.scoring.find((u) => u.id === id)?.fields || [])
      .map((id) => exam.fields.find((f) => f.id === id)?.label)
      .filter(Boolean);
    const bar = d.createElement("div");
    bar.className = "unit-problem-actions";
    const label = d.createElement("span");
    label.textContent = labels.join("・");
    const button = d.createElement("button");
    button.type = "button";
    button.textContent = "問題を見る";
    button.dataset.readingProblem = ids[0];
    button.setAttribute("aria-label", labels.join("・") + "の問題を見る");
    button.onclick = () => open(ids);
    bar.append(label, button);
    anchor.before(bar);
  }
}

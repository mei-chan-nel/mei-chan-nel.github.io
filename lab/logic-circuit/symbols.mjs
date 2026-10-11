// Match the distinctive-shape symbols in LectureNote / digital-logic.
export function symbol(type) {
  if (type === "and")
    return '<path class="gate-shape" d="M-32-25H5C26-25 39-13 39 0S26 25 5 25H-32Z"/><path class="symbol-stub" d="M-48-13H-32M-48 13H-32M39 0H52"/>';
  if (type === "or")
    return '<path class="gate-shape" d="M-34-26Q8-28 39 0Q8 28-34 26Q-15 0-34-26Z"/><path class="symbol-stub" d="M-48-13H-27M-48 13H-27M39 0H52"/>';
  if (type === "not")
    return '<path class="gate-shape" d="M-30-26L22 0-30 26Z"/><circle class="gate-shape" cx="30" cy="0" r="7"/><path class="symbol-stub" d="M-48 0H-30M37 0H52"/>';
  if (type === "branch")
    return '<path class="symbol-stub" d="M-34 0H0M0-18V18M0-18H34M0 18H34"/><circle class="junction-dot" r="4"/>';
  return "";
}

export function portOffset(type, direction, port) {
  if (type === "input") return [44, 0];
  if (type === "output") return [-34, 0];
  if (type === "branch")
    return direction === "in" ? [-34, 0] : [34, port === 0 ? -18 : 18];
  return direction === "out"
    ? [52, 0]
    : [-48, type === "not" ? 0 : port === 0 ? -13 : 13];
}

export function miniSymbol(type) {
  return `<svg viewBox="-58 -34 122 68" aria-hidden="true">${symbol(type)}</svg>`;
}

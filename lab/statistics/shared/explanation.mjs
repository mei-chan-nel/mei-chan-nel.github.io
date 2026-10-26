// Turn the existing scholarly text into named, native disclosure sections.
// This changes presentation only; every paragraph, definition and caveat is retained.
export function renderAcademicExplanation(container, html) {
  const template = document.createElement("template");
  template.innerHTML = html;
  let content;
  container.replaceChildren();
  for (const node of [...template.content.childNodes]) {
    if (node.nodeType === Node.ELEMENT_NODE && /^H[23]$/.test(node.tagName)) {
      const details = document.createElement("details");
      details.className = "academic-section";
      const summary = document.createElement("summary");
      summary.textContent = node.textContent;
      content = document.createElement("div");
      content.className = "explanation-content";
      details.append(summary, content);
      container.append(details);
    } else {
      if (!content) {
        content = document.createElement("div");
        content.className = "explanation-intro";
        container.append(content);
      }
      content.append(node);
    }
  }
}

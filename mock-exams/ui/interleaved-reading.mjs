import { bookFrameSrcdoc } from "./book-srcdoc.mjs";
import { fitBookFrame } from "./book-frame.mjs";

// Partition by the same boundaries used for desktop alignment. Keep the
// problem's figures/context once, and isolate each explanation's source CSS.
export function interleavedProblemHTML(problemHTML) {
  const d = new DOMParser().parseFromString(problemHTML, "text/html");
  d.querySelectorAll(
    "header,footer,.book-source,.pagehead,.page-head,.page-foot,.page-footer,.footer,.running,.pagenum,.page-number,.version",
  ).forEach((e) => e.remove());
  const anchors = [...d.querySelectorAll("[data-reading-units]")];
  const boundaries = anchors.map((anchor, i) => {
    if (!i) return anchor;
    const previous = anchors[i - 1],
      currentIDs = anchor.dataset.readingUnits.split(" "),
      previousIDs = previous.dataset.readingUnits.split(" ");
    // Bring the next question's introductory text/figure with it, rather than
    // leaving that context above the preceding question's explanation.
    return (
      [...d.querySelectorAll("[data-reading-for]")].find((node) => {
        const units = node.dataset.readingFor.split(" ");
        return (
          !node.contains(previous) &&
          !!(
            previous.compareDocumentPosition(node) &
            Node.DOCUMENT_POSITION_FOLLOWING
          ) &&
          (node === anchor ||
            node.contains(anchor) ||
            !!(
              node.compareDocumentPosition(anchor) &
              Node.DOCUMENT_POSITION_FOLLOWING
            )) &&
          currentIDs.some((id) => units.includes(id)) &&
          !previousIDs.some((id) => units.includes(id))
        );
      }) || anchor
    );
  });
  const chunks = anchors
    .map((anchor, i) => {
      const range = d.createRange();
      if (i === 0) range.setStart(d.body, 0);
      else range.setStartBefore(boundaries[i]);
      if (anchors[i + 1]) range.setEndBefore(boundaries[i + 1]);
      else range.setEnd(d.body, d.body.childNodes.length);
      const section = d.createElement("section");
      section.className = "interleaved-problem";
      section.append(range.cloneContents());
      const explanation = d.createElement("section");
      explanation.className = "interleaved-explanation";
      explanation.dataset.explanationUnits = anchor.dataset.readingUnits;
      explanation.setAttribute("aria-label", "解説");
      return [section, explanation];
    })
    .flat();
  if (!anchors.length) throw Error("問題と解説の対応箇所がありません。");
  d.body.replaceChildren(...chunks);
  d.documentElement.setAttribute("data-interleaved-reading", "");
  return "<!doctype html>\n" + d.documentElement.outerHTML;
}

export function mountInterleavedExplanations(
  problemFrame,
  solutionHTML,
  solutionURL,
) {
  const d = problemFrame.contentDocument;
  const source = new DOMParser().parseFromString(solutionHTML, "text/html");
  const anchors = [...source.querySelectorAll("[data-reading-units]")];
  const observers = [],
    children = [],
    pending = [],
    ready = [];
  let closed = false;
  for (const box of d.querySelectorAll("[data-explanation-units]")) {
    const index = anchors.findIndex(
      (a) => a.dataset.readingUnits === box.dataset.explanationUnits,
    );
    if (index < 0) throw Error("対応する解説がありません。");
    const range = source.createRange();
    range.setStartBefore(anchors[index]);
    if (anchors[index + 1]) range.setEndBefore(anchors[index + 1]);
    else range.setEnd(source.body, source.body.childNodes.length);
    const part = source.cloneNode(true);
    part.body.replaceChildren(part.importNode(range.cloneContents(), true));
    const style = part.createElement("style");
    style.textContent = `html,body{margin:0!important;padding:0!important;background:transparent!important;overflow:visible!important}
      body{display:flow-root!important;font-family:system-ui,sans-serif!important}
      .sheet,.page,.solution,main,body[data-section] .sheet,body[data-section] .page,body[data-section] main.solution{width:100%!important;max-width:none!important;height:auto!important;min-height:0!important;margin:0!important;padding:0!important;border:0!important;box-shadow:none!important;background:transparent!important}
      .unit-problem-actions,.reading-spacer{display:none!important}`;
    part.head.append(style);
    const label = d.createElement("p");
    label.className = "interleaved-label";
    label.textContent = "解説";
    const frame = d.createElement("iframe");
    frame.title =
      "解説 " +
      ((anchors[index].matches("h2,h3")
        ? anchors[index]
        : anchors[index].querySelector("h2,h3")
      )?.textContent || "該当箇所");
    frame.setAttribute("sandbox", "allow-same-origin allow-scripts");
    let loaded;
    ready.push(
      new Promise((resolve) => {
        loaded = resolve;
        pending.push(resolve);
      }),
    );
    frame.onload = () => {
      if (closed) return;
      const content = frame.contentDocument;
      if (!content.querySelector("[data-reading-units]")) return;
      content.querySelectorAll("a[href]").forEach((a) => {
        a.target = "_blank";
        a.rel = "noopener";
      });
      const resize = () => {
        if (closed) return;
        fitBookFrame(frame);
        fitBookFrame(problemFrame);
      };
      const observer = new ResizeObserver(resize);
      observer.observe(content.body);
      observers.push(observer);
      Promise.resolve(content.fonts?.ready).then(() => {
        resize();
        loaded();
      });
      content
        .querySelectorAll("img")
        .forEach((img) => img.addEventListener("load", resize));
      resize();
    };
    box.append(label, frame);
    children.push(frame);
    frame.srcdoc = bookFrameSrcdoc(
      "<!doctype html>\n" + part.documentElement.outerHTML,
      solutionURL,
    );
  }
  const cleanup = () => {
    closed = true;
    pending.forEach((resolve) => resolve());
    observers.forEach((o) => o.disconnect());
    children.forEach((f) => {
      f.onload = null;
    });
  };
  cleanup.ready = Promise.all(ready);
  return cleanup;
}

import { fitBookFrame } from "./book-frame.mjs";
// Add space only to the shorter side at each corresponding question boundary.
// Both original documents keep their own tables, figures, styles and selection.
export function alignReadingPanes(problemFrame, solutionFrame) {
  const frames = [problemFrame, solutionFrame];
  const docs = frames.map((f) => f.contentDocument);
  if (docs.some((d) => !d?.body)) return () => {};
  const anchors = docs.map((d) => [
    ...d.querySelectorAll("[data-reading-units]"),
  ]);
  const pairs = anchors[0]
    .map((p) => [
      p,
      anchors[1].find((s) => s.dataset.readingUnits === p.dataset.readingUnits),
    ])
    .filter((pair) => pair[1]);
  if (!pairs.length) return () => {};
  const spacers = pairs.map((pair) =>
    pair.map((e, side) => {
      const spacer = e.ownerDocument.createElement("div");
      spacer.className = "reading-spacer";
      spacer.setAttribute("aria-hidden", "true");
      const note = e.ownerDocument.createElement("div");
      note.className = "reading-gap-note";
      note.hidden = true;
      const text = e.ownerDocument.createElement("span");
      text.textContent = "位置を合わせるための余白です。";
      note.append(text);
      spacer.append(note);
      e.before(spacer);
      return spacer;
    }),
  );
  docs.forEach((d) =>
    d.documentElement.setAttribute("data-paired-reading", ""),
  );
  let queued = false,
    closed = false;
  const align = () => {
    queued = false;
    if (closed || frames.some((f) => !f.isConnected)) return;
    spacers.flat().forEach((e) => {
      e.style.height = "0px";
      e.firstElementChild.hidden = true;
      e.setAttribute("aria-hidden", "true");
    });
    for (let i = 0; i < pairs.length; i++) {
      const tops = pairs[i].map(
        (e, side) =>
          frames[side].getBoundingClientRect().top +
          e.getBoundingClientRect().top,
      );
      const earlier = tops[0] < tops[1] ? 0 : 1;
      const delta = Math.abs(tops[0] - tops[1]);
      if (delta > 0.5) spacers[i][earlier].style.height = delta + "px";
      if (delta >= 160) {
        const spacer = spacers[i][earlier];
        spacer.firstElementChild.hidden = false;
        spacer.removeAttribute("aria-hidden");
      }
    }
    frames.forEach(fitBookFrame);
  };
  const schedule = () => {
    if (queued || closed) return;
    queued = true;
    requestAnimationFrame(align);
  };
  const observer = new ResizeObserver(schedule);
  docs.forEach((d) => {
    observer.observe(d.body);
    d.fonts?.ready.then(schedule);
    d.querySelectorAll("img").forEach((img) =>
      img.addEventListener("load", schedule),
    );
  });
  window.addEventListener("resize", schedule);
  align();
  return () => {
    closed = true;
    observer.disconnect();
    window.removeEventListener("resize", schedule);
    docs.forEach((d) =>
      d
        .querySelectorAll("img")
        .forEach((img) => img.removeEventListener("load", schedule)),
    );
  };
}

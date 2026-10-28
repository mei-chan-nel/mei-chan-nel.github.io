// Measure content, not the root viewport (which would prevent a frame shrinking).
// body is a flow root so page margins and floats are included in its size.
export function fitBookFrame(frame) {
  const body = frame.contentDocument?.body;
  if (!body) return;
  const rect = body.getBoundingClientRect();
  frame.style.height =
    Math.ceil(Math.max(rect.bottom, rect.top + body.scrollHeight)) + 1 + "px";
}

// Shared canvas resizing: right edge, bottom edge, corner, and keyboard fallback.
export function installCanvasResize(stage, { onStart = () => {} } = {}) {
  let drag;
  const resize = (width, height) => {
    const max = stage.parentElement.clientWidth;
    stage.style.width = `${Math.max(Math.min(260, max), Math.min(max, width))}px`;
    stage.style.height = `${Math.max(260, Math.min(1400, height))}px`;
  };
  const move = (e) => {
    if (drag?.pointer !== e.pointerId) return;
    resize(
      drag.width + (drag.axis === "height" ? 0 : e.clientX - drag.x),
      drag.height + (drag.axis === "width" ? 0 : e.clientY - drag.y),
    );
  };
  for (const handle of stage.querySelectorAll("[data-resize-axis]")) {
    handle.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || drag) return;
      e.preventDefault();
      onStart();
      const r = stage.getBoundingClientRect();
      drag = {
        pointer: e.pointerId,
        axis: handle.dataset.resizeAxis,
        x: e.clientX,
        y: e.clientY,
        width: r.width,
        height: r.height,
      };
      handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener("pointermove", move);
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
      handle.addEventListener(type, (e) => {
        if (drag?.pointer !== e.pointerId) return;
        if (type === "pointerup") move(e);
        drag = undefined;
      });
  }
  stage
    .querySelector('[data-resize-axis="both"]')
    .addEventListener("keydown", (e) => {
      if (e.key === "Home") {
        e.preventDefault();
        stage.style.width = stage.style.height = "";
        return;
      }
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key))
        return;
      e.preventDefault();
      const r = stage.getBoundingClientRect(),
        amount = e.shiftKey ? 64 : 16;
      resize(
        (parseFloat(stage.style.width) || r.width) +
          (e.key === "ArrowLeft"
            ? -amount
            : e.key === "ArrowRight"
              ? amount
              : 0),
        (parseFloat(stage.style.height) || r.height) +
          (e.key === "ArrowUp" ? -amount : e.key === "ArrowDown" ? amount : 0),
      );
    });
  window.addEventListener("blur", () => {
    drag = undefined;
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) drag = undefined;
  });
}

import {
  MIN_INTERVAL_MS,
  MAX_INTERVAL_MS,
  adjustInterval,
  intervalSeconds,
} from "../../program-trace/autoplay.js";
export function installSpeed({ autoplay, changed }) {
  const $ = (id) => document.getElementById(id),
    panel = $("speed-panel"),
    input = $("speed-input");
  input.max = String(MAX_INTERVAL_MS / 1000);
  function sync() {
    input.value = intervalSeconds(autoplay.interval);
    $("speed-value").textContent = intervalSeconds(autoplay.interval) + "秒";
    $("speed-decrease").disabled = autoplay.interval === MIN_INTERVAL_MS;
    changed();
  }
  function close(focus = false) {
    panel.hidden = true;
    $("speed-button").setAttribute("aria-expanded", "false");
    input.setAttribute("aria-invalid", "false");
    $("speed-error").hidden = true;
    sync();
    if (focus)
      (
        document.querySelector('.is-fullscreen [data-control="speed"]') ??
        $("speed-button")
      ).focus();
  }
  function apply(showError = false) {
    const valid =
      input.value.trim() !== "" &&
      input.validity.valid &&
      Number.isInteger(Number((Number(input.value) * 1000).toFixed(6))) &&
      autoplay.setInterval(Math.round(Number(input.value) * 1000));
    input.setAttribute("aria-invalid", String(showError && !valid));
    $("speed-error").hidden = valid || !showError;
    if (valid) {
      $("speed-value").textContent = intervalSeconds(autoplay.interval) + "秒";
      changed();
    }
    return valid;
  }
  $("speed-button").onclick = () => {
    if (!panel.hidden) {
      close();
      return;
    }
    panel.hidden = false;
    $("speed-button").setAttribute("aria-expanded", "true");
    sync();
  };
  input.oninput = () => apply();
  input.onchange = () => {
    if (apply(true)) sync();
  };
  input.onblur = () => {
    if (apply(true)) sync();
  };
  input.onkeydown = (e) => {
    if (!["ArrowUp", "ArrowDown"].includes(e.key)) return;
    e.preventDefault();
    input.value = intervalSeconds(
      adjustInterval(autoplay.interval, e.key === "ArrowUp" ? 1 : -1),
    );
    apply(true);
  };
  for (const [id, direction] of [
    ["speed-decrease", -1],
    ["speed-increase", 1],
  ])
    $(id).onclick = () => {
      input.value = intervalSeconds(
        adjustInterval(autoplay.interval, direction),
      );
      if (apply(true)) sync();
    };
  document.addEventListener("click", (e) => {
    if (
      !panel.hidden &&
      !$("speed-control").contains(e.target) &&
      !panel.contains(e.target) &&
      !e.target.closest('[data-control="speed"]')
    )
      close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panel.hidden) {
      e.preventDefault();
      close(true);
    }
  });
  return { close, sync };
}

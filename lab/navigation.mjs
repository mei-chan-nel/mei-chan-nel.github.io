// Lab pages keep their static navigation and independent canvas layout.
const header = document.querySelector(".site-header");
const offset = () =>
  document.documentElement.style.setProperty(
    "--lab-header-offset",
    `${header?.classList.contains("is-header-hidden") ? 0 : (header?.getBoundingClientRect().height ?? 0)}px`,
  );
if (header) new ResizeObserver(offset).observe(header);
offset();
const nav = header?.querySelector(".global-nav");
if (nav) {
  const wrapper = document.createElement("div");
  wrapper.className = "horizontal-scroll-cue horizontal-scroll-cue--global";
  nav.before(wrapper);
  wrapper.append(nav);
  for (const side of ["left", "right"]) {
    const cue = document.createElement("span");
    cue.className = `horizontal-scroll-cue__edge horizontal-scroll-cue__edge--${side}`;
    cue.setAttribute("aria-hidden", "true");
    wrapper.append(cue);
  }
  const update = () => {
    wrapper.classList.toggle(
      "has-overflow",
      nav.scrollWidth > nav.clientWidth + 2,
    );
    wrapper.classList.toggle("is-at-start", nav.scrollLeft <= 2);
    wrapper.classList.toggle(
      "is-at-end",
      nav.scrollLeft + nav.clientWidth >= nav.scrollWidth - 2,
    );
  };
  nav.addEventListener("scroll", update, { passive: true });
  nav.addEventListener("focusin", (event) => {
    const item = event.target;
    if (item instanceof HTMLElement)
      item.scrollIntoView({ block: "nearest", inline: "nearest" });
  });
  new ResizeObserver(update).observe(nav);
  update();
}
let last = window.scrollY;
window.addEventListener(
  "scroll",
  () => {
    const current = window.scrollY;
    if (Math.abs(current - last) < 8) return;
    header?.classList.toggle(
      "is-header-hidden",
      current > 180 &&
        current > last &&
        !header.contains(document.activeElement),
    );
    offset();
    last = current;
  },
  { passive: true },
);
header?.addEventListener("focusin", () => {
  header.classList.remove("is-header-hidden");
  offset();
});

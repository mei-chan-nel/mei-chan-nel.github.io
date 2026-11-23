// Site pages use the same compact navigation presentation as the learning app.
export function mountCompactNav(header) {
  const brand = header?.querySelector(".header-inner .brand");
  const links = header?.querySelector(".global-nav");
  if (!brand || !links || header.classList.contains("has-compact-nav")) return;

  const bar = document.createElement("div");
  bar.className = "app-mini-nav";
  bar.innerHTML = `
    <a class="app-mini-nav__brand" aria-label="情報Ⅰ Study Atlas トップへ">
      <span aria-hidden="true">I</span><strong>Study Atlas</strong>
    </a>
    <button class="app-mini-nav__toggle" type="button" aria-expanded="false" aria-controls="atlas-compact-menu">メニュー</button>
    <nav class="app-mini-nav__menu" id="atlas-compact-menu" aria-label="メインナビゲーション" hidden></nav>`;
  bar.querySelector("a").href = brand.href;
  const toggle = bar.querySelector("button");
  const menu = bar.querySelector("nav");
  for (const link of links.querySelectorAll("a[href]")) menu.append(link.cloneNode(true));
  header.append(bar);
  header.classList.add("has-compact-nav");

  const setOpen = (open) => {
    menu.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    if (open) menu.querySelector("a")?.focus();
  };
  toggle.addEventListener("click", () => setOpen(menu.hidden));
  bar.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || menu.hidden) return;
    event.preventDefault();
    setOpen(false);
    toggle.focus();
  });
  document.addEventListener("click", (event) => {
    if (!menu.hidden && (!bar.contains(event.target) || event.target.closest("nav a"))) setOpen(false);
  });
  window.addEventListener("pageshow", () => setOpen(false));
  window.matchMedia("(max-width: 767px)").addEventListener("change", () => setOpen(false));
}

// Keep small scroll adjustments from flickering the header.
export function bindHeaderScroll(header, { mobileOnly = false, onVisibilityChange } = {}) {
  if (!header) return;
  const viewport = window.matchMedia("(max-width: 767px)");
  const root = document.documentElement;
  const threshold = 10;
  const position = () => Math.max(0, window.scrollY);
  let last = position();
  let anchor = last;
  let direction = 0;
  let frame = 0;

  const setHidden = (hidden) => {
    const changed = header.classList.contains("is-header-hidden") !== hidden;
    header.classList.toggle("is-header-hidden", hidden);
    root.classList.toggle("header-is-hidden", hidden);
    if (changed) onVisibilityChange?.();
  };
  const reset = () => {
    anchor = last = position();
    direction = 0;
    setHidden(false);
  };
  const update = () => {
    frame = 0;
    const current = position();
    const nextDirection = Math.sign(current - last);
    const active = document.activeElement;
    const menuOpen = header.querySelector(".app-mini-nav__menu:not([hidden])");
    const keyboardFocus = header.contains(active) && active.matches(":focus-visible");
    const height = header.offsetHeight;

    if ((mobileOnly && !viewport.matches) || height === 0 ||
        current <= height || keyboardFocus || menuOpen) {
      reset();
      return;
    }
    if (nextDirection && nextDirection !== direction) {
      direction = nextDirection;
      anchor = last;
    }
    if (Math.abs(current - anchor) >= threshold) setHidden(direction > 0);
    last = current;
  };
  window.addEventListener("scroll", () => {
    if (!frame) frame = window.requestAnimationFrame(update);
  }, { passive: true });
  window.addEventListener("pageshow", reset);
  viewport.addEventListener("change", reset);
  header.addEventListener("focusin", reset);
}

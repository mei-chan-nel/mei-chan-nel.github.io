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

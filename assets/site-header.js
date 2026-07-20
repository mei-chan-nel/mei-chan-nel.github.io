(function () {
  "use strict";

  const header = document.querySelector(".site-header");
  if (!header) return;

  // Keep the shared brand wording and footer link in sync across every
  // static page.  The footer markup is intentionally upgraded here so pages
  // that use the common shell all receive the same accessible brand link.
  const headerSubtitle = header.querySelector(".brand small");
  if (headerSubtitle) headerSubtitle.textContent = "知識を、ひろげ、つなげる";

  const footerBrand = document.querySelector(".site-footer .footer-brand");
  const footerHome = document.querySelector('.site-footer nav[aria-label="フッターナビゲーション"] a');
  if (footerBrand && footerHome && footerBrand.tagName.toLowerCase() !== "a") {
    const footerCopy = footerBrand.parentElement?.querySelector(".footer-copy");
    const brandLink = document.createElement("a");
    brandLink.className = "brand footer-brand";
    brandLink.href = footerHome.getAttribute("href") || "./index.html";
    brandLink.setAttribute("aria-label", "情報Ⅰ Study Atlas トップ");
    brandLink.innerHTML = '<span><strong>情報Ⅰ Study Atlas</strong><small>知識を、ひろげ、つなげる</small></span>';
    footerBrand.replaceWith(brandLink);
    footerCopy?.remove();
  }

  const root = document.documentElement;
  const directionThreshold = 10;
  let lastY = Math.max(window.scrollY, 0);
  let directionAnchor = lastY;
  let direction = 0;
  let ticking = false;

  const showHeader = () => {
    header.classList.remove("is-header-hidden");
    root.classList.remove("header-is-hidden");
  };

  const hideHeader = () => {
    if (header.contains(document.activeElement)) return;
    header.classList.add("is-header-hidden");
    root.classList.add("header-is-hidden");
  };

  const updateHeader = () => {
    const currentY = Math.max(window.scrollY, 0);
    const delta = currentY - lastY;

    if (currentY <= header.offsetHeight) {
      showHeader();
      direction = 0;
      directionAnchor = currentY;
    } else if (delta > 0) {
      if (direction !== 1) {
        direction = 1;
        directionAnchor = currentY;
      }
      if (currentY - directionAnchor >= directionThreshold) hideHeader();
    } else if (delta < 0) {
      if (direction !== -1) {
        direction = -1;
        directionAnchor = currentY;
      }
      if (directionAnchor - currentY >= directionThreshold) showHeader();
    }

    lastY = currentY;
    ticking = false;
  };

  window.addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(updateHeader);
  }, { passive: true });

  header.addEventListener("focusin", showHeader);
  window.addEventListener("pageshow", showHeader);
})();

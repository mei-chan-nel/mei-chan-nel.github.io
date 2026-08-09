(() => {
  "use strict";

  const ADSENSE_CLIENT = "ca-pub-6257644709224446";
  const AD_SLOTS = Object.freeze({
    display: "7759620808",
    article: "7839511857",
  });
  const SLOT_PATTERN = /^\d+$/;
  const AD_STATUS_ATTRIBUTE = "data-ad-status";

  const hideSlot = (container) => {
    container.hidden = true;
    container.dataset.adState = "hidden";
  };

  const watchDeliveryStatus = (container, ad) => {
    const syncStatus = () => {
      const status = ad.getAttribute(AD_STATUS_ATTRIBUTE);
      if (status === "unfilled") {
        hideSlot(container);
      } else if (status === "filled") {
        container.dataset.adState = "filled";
      }
    };

    const observer = new MutationObserver(syncStatus);
    observer.observe(ad, { attributes: true, attributeFilter: [AD_STATUS_ATTRIBUTE] });
    syncStatus();
  };

  const buildAd = (kind, slot) => {
    const ad = document.createElement("ins");
    ad.className = "adsbygoogle";
    ad.style.display = "block";
    ad.dataset.adClient = ADSENSE_CLIENT;
    ad.dataset.adSlot = slot;

    if (kind === "article") {
      ad.style.textAlign = "center";
      ad.dataset.adLayout = "in-article";
      ad.dataset.adFormat = "fluid";
    } else {
      ad.dataset.adFormat = "auto";
      ad.dataset.fullWidthResponsive = "true";
    }

    return ad;
  };

  const initializeSlot = (container) => {
    if (container.dataset.adInitialized === "true") return;
    container.dataset.adInitialized = "true";

    const kind = container.dataset.manualAd;
    const slot = AD_SLOTS[kind];
    if (!slot || !SLOT_PATTERN.test(slot)) {
      container.dataset.adState = "unconfigured";
      return;
    }

    const ad = buildAd(kind, slot);
    container.replaceChildren(ad);
    container.hidden = false;
    container.dataset.adState = "loading";

    try {
      watchDeliveryStatus(container, ad);
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (error) {
      hideSlot(container);
      console.warn("AdSense unit initialization was skipped.", error);
    }
  };

  const initializeManualAds = () => {
    document.querySelectorAll("[data-manual-ad]").forEach(initializeSlot);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeManualAds, { once: true });
  } else {
    initializeManualAds();
  }
})();

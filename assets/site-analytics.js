(function () {
  "use strict";

  const GA_MEASUREMENT_ID = "G-JEG0V1ZZF2";
  // A second include must not queue another config (and automatic page_view).
  if (window.__studyAtlasGa4Initialized) return;
  window.__studyAtlasGa4Initialized = true;

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() {
    window.dataLayer.push(arguments);
  };
  window.gtag("js", new Date());
  const isProgramStudio = /\/program-trace\/studio(?:\/|$)/i.test(window.location.pathname);
  const isCpuMemory = /\/lab\/cpu-memory(?:\/|$)/i.test(window.location.pathname);
  // Shared source lives in the fragment; analytics only receives the page URL.
  window.gtag("config", GA_MEASUREMENT_ID, isProgramStudio || isCpuMemory ? {
    page_location: window.location.href.split("#")[0],
    page_referrer: document.referrer.split("#")[0],
  } : {});

  if (!document.querySelector(`script[data-site-analytics="ga4"][data-measurement-id="${GA_MEASUREMENT_ID}"]`)) {
    const analyticsScript = document.createElement("script");
    analyticsScript.async = true;
    analyticsScript.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_MEASUREMENT_ID)}`;
    analyticsScript.dataset.siteAnalytics = "ga4";
    analyticsScript.dataset.measurementId = GA_MEASUREMENT_ID;
    document.head.append(analyticsScript);
  }
})();

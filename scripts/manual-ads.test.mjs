import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";


const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(scriptDir, "..", "assets", "manual-ads.js");
const originalSource = fs.readFileSync(sourcePath, "utf8");
const sourceWithSlots = (displaySlot, articleSlot) => originalSource
  .replace(/(\bdisplay:\s*)"[^"]+"/, `$1"${displaySlot}"`)
  .replace(/(\barticle:\s*)"[^"]+"/, `$1"${articleSlot}"`);

class FakeElement {
  constructor(tagName = "div", kind = undefined) {
    this.tagName = tagName;
    this.className = "";
    this.style = {};
    this.dataset = {};
    this.hidden = true;
    this.children = [];
    this.attributes = new Map();
    if (kind) this.dataset.manualAd = kind;
  }

  replaceChildren(...children) {
    this.children = children;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

}

const runManualAds = ({ kinds = ["display"], configured = false, adsbygoogle = [] } = {}) => {
  const containers = kinds.map((kind) => new FakeElement("div", kind));
  const listeners = new Map();
  const observers = [];
  const warnings = [];
  const document = {
    readyState: "loading",
    addEventListener(name, callback) {
      listeners.set(name, callback);
    },
    querySelectorAll(selector) {
      assert.equal(selector, "[data-manual-ad]");
      return containers;
    },
    createElement(tagName) {
      return new FakeElement(tagName);
    },
  };
  class FakeMutationObserver {
    constructor(callback) {
      this.callback = callback;
      this.disconnected = false;
      observers.push(this);
    }

    observe() {}

    disconnect() {
      this.disconnected = true;
    }
  }
  const window = {
    adsbygoogle,
  };
  const source = configured
    ? sourceWithSlots("1234567890", "9876543210")
    : sourceWithSlots("REPLACE_WITH_DISPLAY_AD_SLOT", "REPLACE_WITH_IN_ARTICLE_AD_SLOT");
  vm.runInNewContext(source, {
    console: { warn: (...args) => warnings.push(args) },
    document,
    MutationObserver: FakeMutationObserver,
    window,
  }, { filename: sourcePath });
  const initialize = listeners.get("DOMContentLoaded");
  assert.equal(typeof initialize, "function");
  initialize();
  return { containers, initialize, observers, warnings, window };
};

test("placeholder slots create no manual ad element, push, or layout space", () => {
  const { containers, observers, window } = runManualAds({ kinds: ["display", "article"] });
  for (const container of containers) {
    assert.equal(container.hidden, true);
    assert.equal(container.dataset.adState, "unconfigured");
    assert.equal(container.children.length, 0);
  }
  assert.equal(observers.length, 0);
  assert.equal(window.adsbygoogle.length, 0);
});

test("configured display and in-article units use official responsive attributes once", () => {
  const result = runManualAds({ kinds: ["display", "article"], configured: true });
  const [displayContainer, articleContainer] = result.containers;
  const display = displayContainer.children[0];
  const article = articleContainer.children[0];
  assert.equal(displayContainer.hidden, false);
  assert.equal(display.className, "adsbygoogle");
  assert.equal(display.style.display, "block");
  assert.equal(display.dataset.adClient, "ca-pub-6257644709224446");
  assert.equal(display.dataset.adSlot, "1234567890");
  assert.equal(display.dataset.adFormat, "auto");
  assert.equal(display.dataset.fullWidthResponsive, "true");
  assert.equal(article.className, "adsbygoogle");
  assert.equal(article.style.display, "block");
  assert.equal(article.style.textAlign, "center");
  assert.equal(article.dataset.adClient, "ca-pub-6257644709224446");
  assert.equal(article.dataset.adSlot, "9876543210");
  assert.equal(article.dataset.adLayout, "in-article");
  assert.equal(article.dataset.adFormat, "fluid");
  assert.equal(result.window.adsbygoogle.length, 2);

  result.initialize();
  assert.equal(result.window.adsbygoogle.length, 2);
});

test("a blocked or failed push hides only its wrapper without escaping an exception", () => {
  const result = runManualAds({
    configured: true,
    adsbygoogle: { push() { throw new Error("blocked"); } },
  });
  assert.equal(result.containers[0].hidden, true);
  assert.equal(result.containers[0].dataset.adState, "hidden");
  assert.equal(result.warnings.length, 1);
});

test("unfilled units collapse their wrappers based on AdSense status", () => {
  const unfilled = runManualAds({ configured: true });
  const unfilledAd = unfilled.containers[0].children[0];
  unfilledAd.setAttribute("data-ad-status", "unfilled");
  unfilled.observers[0].callback();
  assert.equal(unfilled.containers[0].hidden, true);

  const filled = runManualAds({ configured: true });
  const filledAd = filled.containers[0].children[0];
  filledAd.setAttribute("data-ad-status", "filled");
  filled.observers[0].callback();
  assert.equal(filled.containers[0].hidden, false);
  assert.equal(filled.containers[0].dataset.adState, "filled");

  const optimized = runManualAds({ configured: true });
  const optimizedAd = optimized.containers[0].children[0];
  optimizedAd.setAttribute("data-ad-status", "unfill-optimized");
  optimized.observers[0].callback();
  assert.equal(optimized.containers[0].hidden, false);
  assert.equal(optimized.containers[0].dataset.adState, "loading");
});

test("delivery status handling has no timer or height heuristic", () => {
  assert.doesNotMatch(originalSource, /setTimeout|setInterval|getBoundingClientRect|offsetHeight/);
});

test("checked-in slot configuration is either two placeholders or two numeric IDs", () => {
  const display = originalSource.match(/\bdisplay:\s*"([^"]+)"/)?.[1];
  const article = originalSource.match(/\barticle:\s*"([^"]+)"/)?.[1];
  const placeholders = display === "REPLACE_WITH_DISPLAY_AD_SLOT"
    && article === "REPLACE_WITH_IN_ARTICLE_AD_SLOT";
  const configured = /^\d+$/.test(display ?? "") && /^\d+$/.test(article ?? "");
  assert.equal(placeholders || configured, true);
});

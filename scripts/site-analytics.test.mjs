import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const source = readFileSync(new URL("assets/site-analytics.js", root), "utf8");
const measurementId = "G-JEG0V1ZZF2";

function analyticsPage({
  href = "https://mei-chan-nel.com/lab/",
  referrer = "",
  scripts = [],
  globals = {},
} = {}) {
  const window = { location: new URL(href), ...globals };
  const document = {
    referrer,
    head: { append: (script) => scripts.push(script) },
    createElement(tag) {
      assert.equal(tag, "script");
      return { dataset: {} };
    },
    querySelector() {
      return scripts.find((script) =>
        script.dataset.siteAnalytics === "ga4" &&
        script.dataset.measurementId === measurementId
      ) ?? null;
    },
  };
  const context = vm.createContext({ window, document });
  const run = () => vm.runInContext(source, context);
  return { window, scripts, run };
}

test("a page without a header initializes GA4 once, even when included repeatedly", () => {
  const { window, scripts, run } = analyticsPage();
  run();
  run();
  run();
  const commands = window.dataLayer.map((args) => Array.from(args));
  assert.equal(commands.length, 2);
  assert.equal(commands[0][0], "js");
  assert.equal(commands[1][0], "config");
  assert.equal(commands[1][1], measurementId);
  assert.deepEqual(Object.keys(commands[1][2]), []);
  assert.equal(scripts.length, 1);
  assert.equal(scripts[0].async, true);
  assert.equal(scripts[0].src, `https://www.googletagmanager.com/gtag/js?id=${measurementId}`);
  window.gtag("event", "quiz_answer", { learning_context: "normal" });
  assert.equal(window.dataLayer.at(-1)[1], "quiz_answer");
});

test("existing event queues and gtag functions survive initialization", () => {
  const dataLayer = [{ event: "existing-event" }];
  const gtag = function () { dataLayer.push(arguments); };
  const { window, run } = analyticsPage({ globals: { dataLayer, gtag } });
  run();
  run();
  assert.equal(window.dataLayer, dataLayer);
  assert.equal(window.gtag, gtag);
  assert.equal(dataLayer[0].event, "existing-event");
  assert.equal(dataLayer.length, 3);
});

test("an existing loader for this measurement ID is reused", () => {
  const scripts = [{ dataset: { siteAnalytics: "ga4", measurementId } }];
  const { window, run } = analyticsPage({ scripts });
  run();
  run();
  assert.equal(scripts.length, 1);
  assert.equal(window.dataLayer.filter((args) => args[0] === "config").length, 1);
});

test("Studio page and referrer URLs omit shared fragments while retaining query parameters", () => {
  for (const path of ["index.html", "share.html", "guide.html", ""]) {
    const { window, run } = analyticsPage({
      href: `https://mei-chan-nel.com/program-trace/studio/${path}?from=library#p=shared-source`,
      referrer: "https://mei-chan-nel.com/program-trace/studio/share.html#p=previous-source",
    });
    run();
    const config = window.dataLayer.find((args) => args[0] === "config")[2];
    assert.equal(config.page_location, `https://mei-chan-nel.com/program-trace/studio/${path}?from=library`);
    assert.equal(config.page_referrer, "https://mei-chan-nel.com/program-trace/studio/share.html");
  }
});

test("CPU memory sharing keeps program content out of analytics URLs", () => {
  for (const path of ["", "index.html"]) {
    const { window, run } = analyticsPage({
      href: `https://mei-chan-nel.com/lab/cpu-memory/${path}?from=lab#cm1.program-content`,
      referrer: "https://mei-chan-nel.com/lab/cpu-memory/#cm1.previous-program",
    });
    run();
    const config = window.dataLayer.find((args) => args[0] === "config")[2];
    assert.equal(config.page_location, `https://mei-chan-nel.com/lab/cpu-memory/${path}?from=lab`);
    assert.equal(config.page_referrer, "https://mei-chan-nel.com/lab/cpu-memory/");
  }
  const html = readFileSync(new URL("lab/cpu-memory/index.html", root), "utf8");
  assert.match(html, /site-analytics\.js\?v=2026102001/u);
});

function* htmlPages(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || ["node_modules", "projects"].includes(entry.name)) continue;
    const file = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directory);
    if (entry.isDirectory()) yield* htmlPages(file);
    else if (entry.name.endsWith(".html")) yield file;
  }
}

test("mock exam analytics omits attempt fragments and query values", () => {
  const { window, run } = analyticsPage({
    href: "https://mei-chan-nel.com/mock-exams/?private=value#attempt-uuid",
    referrer: "https://mei-chan-nel.com/mock-exams/?private=previous#previous-uuid",
  });
  run();
  const config = window.dataLayer.find((args) => args[0] === "config")[2];
  assert.equal(config.page_location, "https://mei-chan-nel.com/mock-exams/");
  assert.equal(config.page_referrer, "https://mei-chan-nel.com/mock-exams/");
});

test("portal and mock app load analytics once; local statistics and embedded exam documents load none", () => {
  const analyticsFile = new URL("assets/site-analytics.js", root);
  for (const file of htmlPages(root)) {
    const html = readFileSync(file, "utf8");
    // Templates and Google's ownership verification are not content pages.
    if (!/<head\b/u.test(html)) continue;
    const tags = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/gu)];
    const analytics = tags.filter((match) => new URL(match[1], file).pathname === analyticsFile.pathname);
    if (["lab/statistics/", "mock-exams/"].some(path => file.pathname.startsWith(new URL(path, root).pathname)) && file.pathname !== new URL("mock-exams/index.html", root).pathname) {
      assert.equal(analytics.length, 0, file.pathname);
      assert.doesNotMatch(html, /googletagmanager|gtag\(/u, file.pathname);
      continue;
    }
    assert.equal(analytics.length, 1, file.pathname);
    const tag = analytics[0];
    assert.ok(tag.index < html.indexOf("</head>"), file.pathname);
    assert.match(tag[0], /\bdefer\b/u, file.pathname);
    assert.doesNotMatch(tag[0], /\basync\b/u, file.pathname);
    for (const header of tags.filter((match) => match[1].includes("assets/site-header.js"))) {
      assert.equal(new URL(header[1], file).searchParams.get("v"), "2026101201", file.pathname);
    }
  }
  const header = readFileSync(new URL("assets/site-header.js", root), "utf8");
  assert.doesNotMatch(header, /gtag|dataLayer|googletagmanager/u);
  const lab = readFileSync(new URL("lab/index.html", root), "utf8");
  assert.doesNotMatch(lab, /assets\/site-header\.js/u);
});

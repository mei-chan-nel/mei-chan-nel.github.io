import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");
const lectureDir = path.join(root, "LectureNote");
const fields = ["society", "digital", "network", "statistics", "programming"];
const checkOnly = process.argv.includes("--check");
const contentStartMarker = "<!-- lecture-content:generated:start -->";
const contentEndMarker = "<!-- lecture-content:generated:end -->";
const adsenseLoader = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6257644709224446";
const manualAdsLoader = "../assets/manual-ads.js?v=2026080901";
const manualAdPattern = /^[ \t]*<div class="manual-ad-slot manual-ad-slot--article" data-manual-ad="article" data-ad-after-section="\d+" hidden><\/div>\r?\n?/gm;

const decodeHtml = (value) => value
  .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
  .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (match, name) => ({
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    "#39": "'",
    nbsp: "\u00a0"
  }[name] ?? match));
const plainText = (value) => decodeHtml(value.replace(/<[^>]+>/g, "")).trim();

const occurrences = (text, needle) => text.split(needle).length - 1;

const normalizeManualAds = (field, html) => {
  const startMarkerIndex = html.indexOf(contentStartMarker);
  const endMarkerIndex = html.indexOf(contentEndMarker);
  if (startMarkerIndex < 0 || endMarkerIndex < 0 || endMarkerIndex <= startMarkerIndex) {
    throw new Error(`${field}: static lecture boundary markers are missing or out of order`);
  }

  const regionStart = startMarkerIndex + contentStartMarker.length;
  let region = html.slice(regionStart, endMarkerIndex).replace(manualAdPattern, "");
  const sectionStarts = [...region.matchAll(/^[ \t]*<section class="lecture-section"/gm)];
  const positions = [];
  for (let afterSection = 3; afterSection < sectionStarts.length; afterSection += 3) {
    positions.push(afterSection);
  }

  for (const afterSection of [...positions].reverse()) {
    const insertAt = sectionStarts[afterSection].index;
    const slot = `        <div class="manual-ad-slot manual-ad-slot--article" data-manual-ad="article" data-ad-after-section="${afterSection}" hidden></div>\n`;
    region = `${region.slice(0, insertAt)}${slot}${region.slice(insertAt)}`;
  }

  return `${html.slice(0, regionStart)}${region}${html.slice(endMarkerIndex)}`;
};

const validateManualAds = (field, html, sectionCount) => {
  if (occurrences(html, adsenseLoader) !== 1) {
    throw new Error(`${field}: AdSense common loader must appear exactly once`);
  }
  if (occurrences(html, manualAdsLoader) !== 1) {
    throw new Error(`${field}: manual ad initializer must appear exactly once`);
  }
  if (html.includes('<ins class="adsbygoogle"')) {
    throw new Error(`${field}: generated HTML must leave ad-unit creation to manual-ads.js`);
  }

  const startMarkerIndex = html.indexOf(contentStartMarker) + contentStartMarker.length;
  const endMarkerIndex = html.indexOf(contentEndMarker);
  const region = html.slice(startMarkerIndex, endMarkerIndex);
  const actualPositions = [...region.matchAll(/data-ad-after-section="(\d+)"/g)].map((match) => Number(match[1]));
  const expectedPositions = [];
  for (let afterSection = 3; afterSection < sectionCount; afterSection += 3) {
    expectedPositions.push(afterSection);
  }
  if (JSON.stringify(actualPositions) !== JSON.stringify(expectedPositions)) {
    throw new Error(`${field}: expected lecture ad positions ${expectedPositions.join(", ")}, found ${actualPositions.join(", ")}`);
  }
};

const readPageData = (field) => {
  const context = vm.createContext({ window: {} });
  const dataPath = path.join(lectureDir, `lecture-data-${field}.js`);
  vm.runInContext(fs.readFileSync(dataPath, "utf8"), context, { filename: dataPath });
  const page = context.window.LECTURE_CONTENT?.[field];
  if (!page || !Array.isArray(page.sections) || !Array.isArray(page.keywordGroups)) {
    throw new Error(`${field}: lecture metadata is missing`);
  }
  return page;
};

const validatePage = (field, page, html) => {
  for (const forbidden of ["html", "kicker", "lead"]) {
    if (page.sections.some((section) => Object.hasOwn(section, forbidden))) {
      throw new Error(`${field}: lecture body data remains in metadata: ${forbidden}`);
    }
  }
  const sectionMatches = [...html.matchAll(
    /<section class="lecture-section" id="([^"]+)"[\s\S]*?<h2 id="[^"]+">([\s\S]*?)<\/h2>/g
  )];
  const actualSections = sectionMatches.map((match) => ({ id: match[1], title: plainText(match[2]) }));
  const expectedSections = page.sections.map(({ id, title }) => ({ id, title }));
  if (JSON.stringify(actualSections) !== JSON.stringify(expectedSections)) {
    throw new Error(`${field}: static section order or titles disagree with metadata`);
  }
  const navMatch = html.match(/<div class="section-nav" id="section-nav">([\s\S]*?)<\/div>/);
  const navItems = navMatch
    ? [...navMatch[1].matchAll(/<a href="#([^"]+)"><span>\d+<\/span>\s*([\s\S]*?)<\/a>/g)]
      .map((match) => ({ id: match[1], short: plainText(match[2]) }))
    : [];
  const expectedNav = page.sections.map(({ id, short }) => ({ id, short }));
  if (JSON.stringify(navItems) !== JSON.stringify(expectedNav)) {
    throw new Error(`${field}: static section navigation disagrees with metadata`);
  }
  const keywordLinks = [...html.matchAll(/<a href="#([^"]+)" data-keyword-id="([^"]+)">([\s\S]*?)<\/a>/g)]
    .map((match) => ({ targetId: match[1], id: match[2], label: plainText(match[3]) }));
  const expectedKeywords = page.keywordGroups.flatMap((group) => group.keywords)
    .map(({ targetId, id, label }) => ({ targetId, id, label }));
  if (JSON.stringify(keywordLinks) !== JSON.stringify(expectedKeywords)) {
    throw new Error(`${field}: static keyword index disagrees with metadata`);
  }
  for (const keyword of page.keywordGroups.flatMap((group) => group.keywords)) {
    if ((html.match(new RegExp(`id="${keyword.targetId}"`, "g")) || []).length !== 1) {
      throw new Error(`${field}: keyword target must exist exactly once: ${keyword.targetId}`);
    }
  }
  if (!html.includes("lecture-content:generated:start") || !html.includes("lecture-content:generated:end")) {
    throw new Error(`${field}: static lecture boundary markers are missing`);
  }
  if (/\{\{[^{}]+\}\}/.test(html)) throw new Error(`${field}: unresolved cloze marker remains`);
  const ids = [...html.matchAll(/<[a-z][^>]*\sid="([^"]+)"[^>]*>/gi)].map((match) => match[1]);
  const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  if (duplicateIds.length) throw new Error(`${field}: duplicate IDs: ${duplicateIds.join(", ")}`);
};

for (const field of fields) {
  const page = readPageData(field);
  const htmlPath = path.join(lectureDir, `${field}.html`);
  const currentHtml = fs.readFileSync(htmlPath, "utf8");
  const html = normalizeManualAds(field, currentHtml);
  if (checkOnly && html !== currentHtml) {
    throw new Error(`${field}: manual ad positions are stale; run node scripts/build_lecture_pages.mjs`);
  }
  if (!checkOnly && html !== currentHtml) {
    fs.writeFileSync(htmlPath, html, "utf8");
  }
  validatePage(field, page, html);
  validateManualAds(field, html, page.sections.length);
}

console.log(`${checkOnly ? "Verified" : "Normalized and verified"} ${fields.length} authoritative static lecture pages against generated metadata and manual ad rules.`);

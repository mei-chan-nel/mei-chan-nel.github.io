import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");
const lectureDir = path.join(root, "LectureNote");
const fields = ["society", "digital", "network", "statistics", "programming"];
const checkOnly = process.argv.includes("--check");
const normalizeLineEndings = (value) => value.replace(/\r\n?/g, "\n");

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

const matchAll = (source, pattern) => {
  const matches = [];
  let match;
  while ((match = pattern.exec(source))) matches.push(match);
  return matches;
};

const parseSections = (field, html) => {
  const navMatch = html.match(/<div class="section-nav" id="section-nav">([\s\S]*?)<\/div>/);
  if (!navMatch) throw new Error(`${field}: static section navigation is missing`);
  const navItems = matchAll(navMatch[1], /<a href="#([^"]+)"><span>\d+<\/span>\s*([\s\S]*?)<\/a>/g)
    .map((match) => ({ id: match[1], short: plainText(match[2]) }));
  if (!navItems.length) throw new Error(`${field}: static section navigation is empty`);

  const sectionMatches = matchAll(
    html,
    /<section class="lecture-section" id="([^"]+)"[\s\S]*?<h2 id="[^"]+">([\s\S]*?)<\/h2>/g
  );
  const sections = sectionMatches.map((match) => ({
    id: match[1],
    short: navItems.find((item) => item.id === match[1])?.short || "",
    title: plainText(match[2]),
    position: match.index
  }));
  if (
    sections.length !== navItems.length
    || sections.some((section, index) => section.id !== navItems[index].id || !section.short || !section.title)
  ) {
    throw new Error(`${field}: section navigation and static lecture sections disagree`);
  }
  return sections;
};

const parseKeywordGroups = (field, html, sections) => {
  const start = html.indexOf('<div class="lecture-keyword-index__groups">');
  const end = html.indexOf("</details>", start);
  if (start < 0 || end < 0) throw new Error(`${field}: static keyword index is missing`);
  const groupSource = html.slice(start, end);
  const groups = matchAll(groupSource, /<section><h3>([\s\S]*?)<\/h3><div>([\s\S]*?)<\/div><\/section>/g)
    .map((groupMatch) => ({
      title: plainText(groupMatch[1]),
      keywords: matchAll(groupMatch[2], /<a href="#([^"]+)" data-keyword-id="([^"]+)">([\s\S]*?)<\/a>/g)
        .map((keywordMatch) => {
          const targetId = keywordMatch[1];
          const id = keywordMatch[2];
          const targetNeedle = `id="${targetId}"`;
          const targetPosition = html.indexOf(targetNeedle);
          if (targetPosition < 0 || html.indexOf(targetNeedle, targetPosition + targetNeedle.length) >= 0) {
            throw new Error(`${field}/${id}: expected exactly one static keyword target`);
          }
          const section = [...sections].reverse().find((item) => item.position < targetPosition);
          if (!section) throw new Error(`${field}/${id}: keyword target is outside a lecture section`);
          return {
            id,
            label: plainText(keywordMatch[3]),
            sectionId: section.id,
            targetId
          };
        })
    }));

  const keywords = groups.flatMap((group) => group.keywords);
  if (groups.some((group) => !group.title || group.keywords.length < 5 || group.keywords.length > 8)) {
    throw new Error(`${field}: expected titled keyword groups containing 5-8 keywords`);
  }
  if (keywords.length !== 24) throw new Error(`${field}: expected 24 lecture keywords, found ${keywords.length}`);
  const ids = keywords.flatMap((keyword) => [keyword.id, keyword.targetId]);
  if (new Set(ids).size !== ids.length) throw new Error(`${field}: duplicate keyword IDs`);
  if (keywords.some((keyword) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(keyword.id) || !keyword.label)) {
    throw new Error(`${field}: invalid keyword metadata`);
  }
  const sectionOrder = new Map(sections.map((section, index) => [section.id, index]));
  const destinations = keywords.map((keyword) => sectionOrder.get(keyword.sectionId));
  if (destinations.some((order, index) => index > 0 && order < destinations[index - 1])) {
    throw new Error(`${field}: keyword destinations move backward through lecture sections`);
  }
  return groups;
};

for (const field of fields) {
  const htmlPath = path.join(lectureDir, `${field}.html`);
  const html = normalizeLineEndings(fs.readFileSync(htmlPath, "utf8"));
  const parsedSections = parseSections(field, html);
  const page = {
    sections: parsedSections.map(({ position: _position, ...section }) => section),
    keywordGroups: parseKeywordGroups(field, html, parsedSections)
  };
  const output = `(function () {\n  "use strict";\n  window.LECTURE_CONTENT = window.LECTURE_CONTENT || {};\n  window.LECTURE_CONTENT[${JSON.stringify(field)}] = ${JSON.stringify(page)};\n})();\n`;
  const outputPath = path.join(lectureDir, `lecture-data-${field}.js`);
  if (checkOnly) {
    if (!fs.existsSync(outputPath) || normalizeLineEndings(fs.readFileSync(outputPath, "utf8")) !== output) {
      throw new Error(`Generated lecture metadata is stale: ${outputPath}`);
    }
  } else {
    fs.writeFileSync(outputPath, output, "utf8");
  }
}

console.log(`${checkOnly ? "Verified" : "Built"} ${fields.length} field-specific lecture metadata files from static HTML.`);

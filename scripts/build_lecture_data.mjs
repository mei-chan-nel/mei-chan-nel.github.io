import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");
const lectureDir = path.join(root, "LectureNote");
const sourceFiles = [
  "lecture-content.js",
  "guide-enrichment.js",
  "programming-content.js",
  "programming-enrichment.js",
  "lecture-keywords-source.js"
];
const fields = ["society", "digital", "network", "statistics", "programming"];
const context = vm.createContext({ window: {} });
const checkOnly = process.argv.includes("--check");
const normalizeLineEndings = (value) => value.replace(/\r\n?/g, "\n");

const imageDimensions = (filePath) => {
  const bytes = fs.readFileSync(filePath);
  if (filePath.endsWith(".png")) {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (filePath.endsWith(".gif")) {
    return { width: bytes.readUInt16LE(6), height: bytes.readUInt16LE(8) };
  }
  throw new Error(`Unsupported lecture image: ${filePath}`);
};

const prepareMedia = (html) => html.replace(/<img src="([^"]+)" alt="([^"]*)">/g, (_, src, alt) => {
  const cleanSrc = src.split("?")[0];
  const imagePath = path.resolve(lectureDir, cleanSrc);
  const { width, height } = imageDimensions(imagePath);
  const image = `<img src="${src}" alt="${alt}" width="${width}" height="${height}" loading="lazy" decoding="async">`;

  if (cleanSrc.endsWith(".gif")) {
    const baseSrc = cleanSrc.slice(0, -4);
    for (const extension of [".poster.png", ".webm", ".mp4"]) {
      const generatedPath = path.resolve(lectureDir, `${baseSrc}${extension}`);
      if (!fs.existsSync(generatedPath)) throw new Error(`Missing generated lecture media: ${generatedPath}`);
    }
    return `<video class="lecture-animation" width="${width}" height="${height}" preload="none" controls loop muted playsinline data-poster="${baseSrc}.poster.png" aria-label="${alt}"><source data-src="${baseSrc}.webm" type="video/webm"><source data-src="${baseSrc}.mp4" type="video/mp4">${image}</video>`;
  }

  const webpPath = imagePath.replace(/\.png$/i, ".webp");
  if (fs.existsSync(webpPath)) {
    const webpSrc = cleanSrc.replace(/\.png$/i, ".webp");
    return `<picture><source srcset="${webpSrc}" type="image/webp">${image}</picture>`;
  }
  return image;
});

for (const sourceFile of sourceFiles) {
  const sourcePath = path.join(lectureDir, sourceFile);
  const source = fs.readFileSync(sourcePath, "utf8");
  vm.runInContext(source, context, { filename: sourcePath });
}

const content = context.window.LECTURE_CONTENT;
const keywordGroups = context.window.LECTURE_KEYWORDS;
if (!content || fields.some((field) => !content[field])) {
  throw new Error("Lecture source files did not define all five fields.");
}
if (!keywordGroups || fields.some((field) => !Array.isArray(keywordGroups[field]))) {
  throw new Error("Lecture keyword source did not define all five fields.");
}

const keywordIds = new Set();
const keywordTargets = new Set();

const validateKeywords = (field, page, groups) => {
  const sectionById = new Map(page.sections.map((section) => [section.id, section]));
  const keywordCount = groups.reduce((total, group) => total + (Array.isArray(group.keywords) ? group.keywords.length : 0), 0);
  if (keywordCount < 20 || keywordCount > 35) {
    throw new Error(`${field}: expected 20-35 lecture keywords, found ${keywordCount}`);
  }

  return groups.map((group) => {
    if (typeof group.title !== "string" || !group.title.trim()) throw new Error(`${field}: keyword group title is empty`);
    if (!Array.isArray(group.keywords) || group.keywords.length < 5 || group.keywords.length > 8) {
      throw new Error(`${field}/${group.title}: expected 5-8 keywords`);
    }
    return {
      title: group.title,
      keywords: group.keywords.map((keyword) => {
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(keyword.id || "")) {
          throw new Error(`${field}: unsafe keyword id: ${keyword.id}`);
        }
        if (keywordIds.has(keyword.id)) throw new Error(`${field}: duplicate keyword id: ${keyword.id}`);
        keywordIds.add(keyword.id);
        if (typeof keyword.label !== "string" || !keyword.label.trim()) throw new Error(`${field}/${keyword.id}: label is empty`);
        if (typeof keyword.targetText !== "string" || !keyword.targetText) throw new Error(`${field}/${keyword.id}: target text is empty`);
        const section = sectionById.get(keyword.sectionId);
        if (!section) throw new Error(`${field}/${keyword.id}: section does not exist: ${keyword.sectionId}`);
        const plainSection = section.html.replace(/<[^>]*>/g, " ");
        const occurrences = plainSection.split(keyword.targetText).length - 1;
        const occurrence = Number.isInteger(keyword.occurrence) && keyword.occurrence >= 0 ? keyword.occurrence : 0;
        if (occurrences <= occurrence) {
          throw new Error(`${field}/${keyword.id}: target text not found in ${keyword.sectionId}: ${keyword.targetText}`);
        }
        const targetKey = `${field}:${keyword.sectionId}:${keyword.targetText}:${occurrence}`;
        if (keywordTargets.has(targetKey)) throw new Error(`${field}/${keyword.id}: duplicate keyword target: ${targetKey}`);
        keywordTargets.add(targetKey);
        return {
          id: keyword.id,
          label: keyword.label,
          sectionId: keyword.sectionId,
          targetId: `keyword-${keyword.id}`,
          targetText: keyword.targetText,
          occurrence
        };
      })
    };
  });
};

for (const field of fields) {
  const page = structuredClone(content[field]);
  page.keywordGroups = validateKeywords(field, page, keywordGroups[field]);
  page.sections.forEach((section) => { section.html = prepareMedia(section.html); });
  const output = `(function () {\n  "use strict";\n  window.LECTURE_CONTENT = window.LECTURE_CONTENT || {};\n  window.LECTURE_CONTENT[${JSON.stringify(field)}] = ${JSON.stringify(page)};\n})();\n`;
  const outputPath = path.join(lectureDir, `lecture-data-${field}.js`);
  if (checkOnly) {
    if (!fs.existsSync(outputPath) || normalizeLineEndings(fs.readFileSync(outputPath, "utf8")) !== output) {
      throw new Error(`Generated lecture data is stale: ${outputPath}`);
    }
  } else {
    fs.writeFileSync(outputPath, output, "utf8");
  }
}

console.log(`${checkOnly ? "Verified" : "Built"} ${fields.length} field-specific lecture data files.`);

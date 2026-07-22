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
  "programming-enrichment.js"
];
const fields = ["society", "digital", "network", "statistics", "programming"];
const context = vm.createContext({ window: {} });
const checkOnly = process.argv.includes("--check");

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
if (!content || fields.some((field) => !content[field])) {
  throw new Error("Lecture source files did not define all five fields.");
}

for (const field of fields) {
  const page = structuredClone(content[field]);
  page.sections.forEach((section) => { section.html = prepareMedia(section.html); });
  const output = `(function () {\n  "use strict";\n  window.LECTURE_CONTENT = window.LECTURE_CONTENT || {};\n  window.LECTURE_CONTENT[${JSON.stringify(field)}] = ${JSON.stringify(page)};\n})();\n`;
  const outputPath = path.join(lectureDir, `lecture-data-${field}.js`);
  if (checkOnly) {
    if (!fs.existsSync(outputPath) || fs.readFileSync(outputPath, "utf8") !== output) {
      throw new Error(`Generated lecture data is stale: ${outputPath}`);
    }
  } else {
    fs.writeFileSync(outputPath, output, "utf8");
  }
}

console.log(`${checkOnly ? "Verified" : "Built"} ${fields.length} field-specific lecture data files.`);

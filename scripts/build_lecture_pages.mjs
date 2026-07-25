import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");
const lectureDir = path.join(root, "LectureNote");
const fields = [
  { id: "society", label: "情報社会" },
  { id: "digital", label: "デジタル" },
  { id: "network", label: "ネットワーク" },
  { id: "statistics", label: "統計" },
  { id: "programming", label: "プログラミング" }
];
const checkOnly = process.argv.includes("--check");
const normalizeLineEndings = (value) => value.replace(/\r\n?/g, "\n");
const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (char) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "'": "&#39;",
  '"': "&quot;"
}[char]));
const clozeMarkup = (answer) => {
  const safe = escapeHtml(answer.trim());
  return `<button class="cloze" type="button" aria-expanded="true" aria-label="穴抜きの答えを隠す"><span class="cloze-answer">${safe}</span></button>`;
};
const renderMarkup = (markup) => markup.replace(/\{\{([^{}]+)\}\}/g, (_, answer) => clozeMarkup(answer));

const installKeywordTarget = (html, field, keyword) => {
  const needle = escapeHtml(keyword.targetText);
  const tokens = html.split(/(<[^>]+>)/g);
  let remaining = Number.isInteger(keyword.occurrence) ? keyword.occurrence : 0;
  let protectedDepth = 0;
  let installed = false;

  for (let index = 0; index < tokens.length && !installed; index += 1) {
    const token = tokens[index];
    if (token.startsWith("<")) {
      if (/^<span\b[^>]*class="[^"]*\bkeyword-target\b[^"]*"[^>]*>$/i.test(token)) protectedDepth += 1;
      else if (/^<\/span\s*>$/i.test(token) && protectedDepth) protectedDepth -= 1;
      continue;
    }
    if (protectedDepth) continue;

    let fromIndex = 0;
    let matchIndex = token.indexOf(needle, fromIndex);
    while (matchIndex >= 0) {
      if (remaining === 0) {
        const target = `<span id="${escapeHtml(keyword.targetId)}" class="keyword-target" tabindex="-1" data-keyword-id="${escapeHtml(keyword.id)}">${needle}</span>`;
        tokens[index] = `${token.slice(0, matchIndex)}${target}${token.slice(matchIndex + needle.length)}`;
        installed = true;
        break;
      }
      remaining -= 1;
      fromIndex = matchIndex + needle.length;
      matchIndex = token.indexOf(needle, fromIndex);
    }
  }
  if (!installed) throw new Error(`${field}: keyword target could not be generated: ${keyword.id}`);
  return tokens.join("");
};

const replaceElementContent = (html, tag, id, content) => {
  const pattern = new RegExp(`(<${tag}\\b[^>]*\\bid="${id}"[^>]*>)[\\s\\S]*?(</${tag}>)`);
  if (!pattern.test(html)) throw new Error(`Missing <${tag}>#${id}`);
  return html.replace(pattern, (_match, open, close) => `${open}${content}${close}`);
};

const renderSection = (field, section, index, keywords) => {
  let body = renderMarkup(section.html);
  for (const keyword of keywords) body = installKeywordTarget(body, field, keyword);
  return `
        <section class="lecture-section" id="${escapeHtml(section.id)}" aria-labelledby="${escapeHtml(section.id)}-title">
          <header class="section-heading">
            <span class="section-number">${String(index + 1).padStart(2, "0")}</span>
            <div>
              <p class="section-kicker">${escapeHtml(section.kicker)}</p>
              <h2 id="${escapeHtml(section.id)}-title">${escapeHtml(section.title)}</h2>
              <p class="section-lead">${escapeHtml(section.lead)}</p>
            </div>
            <button class="section-bookmark" type="button" data-section-bookmark="${escapeHtml(section.id)}" aria-pressed="false">しおりを挟む</button>
          </header>
          <div class="section-body">${body}</div>
        </section>`;
};

const renderCourseNav = (field, page) => fields.map((item) => {
  const link = `<a class="course-field-link" href="./${item.id}.html"${item.id === field ? ' aria-current="page"' : ""}>${item.label}</a>`;
  if (item.id !== field) return link;
  const sectionLinks = page.sections.map((section, index) => (
    `<a href="#${escapeHtml(section.id)}"><span>${String(index + 1).padStart(2, "0")}</span> ${escapeHtml(section.short || section.title)}</a>`
  )).join("");
  return `<div class="course-field-group is-current">${link}<div class="section-nav" id="section-nav">${sectionLinks}</div></div>`;
}).join("");

const renderLearningGuide = (field, page) => {
  const firstSection = page.sections[0];
  const keywordGroups = Array.isArray(page.keywordGroups) ? page.keywordGroups : [];
  return `    <!-- lecture-guide:generated:start -->
    <section class="lecture-learning-guide" aria-labelledby="lecture-learning-guide-title">
      <div class="lecture-learning-guide__heading">
        <p>READING GUIDE</p>
        <h2 id="lecture-learning-guide-title">学び方を選ぶ</h2>
      </div>
      <div class="lecture-learning-guide__choices">
        <a class="lecture-learning-choice" data-reading-bookmark href="#${escapeHtml(firstSection.id)}"><strong>しおりから読む</strong><span>${escapeHtml(fields.find((item) => item.id === field)?.label || field)}「${escapeHtml(firstSection.short || firstSection.title)}」</span></a>
      </div>
      <details class="lecture-keyword-index" id="lecture-keyword-index">
        <summary><span><strong>重要キーワード</strong><small>用語や仕組みを選んで、必要な部分だけ確認します</small></span></summary>
        <div class="lecture-keyword-index__groups">
          ${keywordGroups.map((group) => `<section><h3>${escapeHtml(group.title)}</h3><div>${group.keywords.map((keyword) => `<a href="#${escapeHtml(keyword.targetId)}" data-keyword-id="${escapeHtml(keyword.id)}">${escapeHtml(keyword.label)}</a>`).join("")}</div></section>`).join("")}
        </div>
      </details>
      <p class="lecture-reading-state" aria-live="polite">順番に読んでいます</p>
    </section>
    <!-- lecture-guide:generated:end -->
`;
};

const readPageData = (field) => {
  const context = vm.createContext({ window: {} });
  const dataPath = path.join(lectureDir, `lecture-data-${field}.js`);
  vm.runInContext(fs.readFileSync(dataPath, "utf8"), context, { filename: dataPath });
  const page = context.window.LECTURE_CONTENT?.[field];
  if (!page || !Array.isArray(page.sections) || !page.sections.length) {
    throw new Error(`${field}: lecture data is missing sections`);
  }
  return page;
};

const buildPage = (field, page, source) => {
  let html = normalizeLineEndings(source);
  html = replaceElementContent(html, "p", "hero-kicker", escapeHtml(page.kicker));
  html = replaceElementContent(html, "h1", "hero-title", escapeHtml(page.title));
  html = replaceElementContent(html, "p", "hero-lead", escapeHtml(page.lead));
  html = replaceElementContent(
    html,
    "div",
    "hero-meta",
    page.meta.map((item) => `<span>${escapeHtml(item)}</span>`).join("")
  );
  html = replaceElementContent(html, "nav", "lecture-course-nav", renderCourseNav(field, page));

  const guide = renderLearningGuide(field, page);
  const guidePattern = /    <!-- lecture-guide:generated:start -->[\s\S]*?    <!-- lecture-guide:generated:end -->\n?/;
  if (guidePattern.test(html)) {
    html = html.replace(guidePattern, () => guide);
  } else {
    const layoutMarker = '    <div class="page-layout">';
    if (!html.includes(layoutMarker)) throw new Error(`${field}: page layout marker is missing`);
    html = html.replace(layoutMarker, `${guide}\n${layoutMarker}`);
  }

  const keywords = (page.keywordGroups || []).flatMap((group) => group.keywords || []);
  const contentBlock = `<!-- lecture-content:generated:start -->${page.sections.map((section, index) => (
    renderSection(field, section, index, keywords.filter((keyword) => keyword.sectionId === section.id))
  )).join("")}
        <!-- lecture-content:generated:end -->`;
  const contentPattern = /<!-- lecture-content:generated:start -->[\s\S]*?<!-- lecture-content:generated:end -->/;
  if (contentPattern.test(html)) {
    html = html.replace(contentPattern, () => contentBlock);
  } else {
    html = replaceElementContent(html, "article", "lecture-content", `
        ${contentBlock}
      `);
  }
  return `${html.trimEnd().replace(/[ \t]+$/gm, "")}\n`;
};

const validatePage = (field, page, html) => {
  const sectionCount = (html.match(/class="lecture-section"/g) || []).length;
  if (sectionCount !== page.sections.length) {
    throw new Error(`${field}: expected ${page.sections.length} generated sections, found ${sectionCount}`);
  }
  for (const section of page.sections) {
    if (!html.includes(`id="${section.id}"`) || !html.includes(`id="${section.id}-title">${escapeHtml(section.title)}</h2>`)) {
      throw new Error(`${field}: generated section is missing or stale: ${section.id}`);
    }
  }
  if (/\{\{[^{}]+\}\}/.test(html)) throw new Error(`${field}: unresolved cloze marker remains`);
  const ids = [...html.matchAll(/<[a-z][^>]*\sid="([^"]+)"[^>]*>/gi)].map((match) => match[1]);
  const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  if (duplicateIds.length) throw new Error(`${field}: duplicate IDs: ${duplicateIds.join(", ")}`);
};

for (const { id: field } of fields) {
  const page = readPageData(field);
  const outputPath = path.join(lectureDir, `${field}.html`);
  const existing = fs.readFileSync(outputPath, "utf8");
  const output = buildPage(field, page, existing);
  validatePage(field, page, output);
  if (checkOnly) {
    if (normalizeLineEndings(existing) !== output) {
      throw new Error(`Generated lecture page is stale: ${outputPath}`);
    }
  } else {
    fs.writeFileSync(outputPath, output, "utf8");
  }
}

console.log(`${checkOnly ? "Verified" : "Built"} ${fields.length} static lecture pages.`);

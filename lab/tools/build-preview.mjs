// Development-only: export standalone HTMLs with styles and scripts embedded.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { contents } from "../catalog.mjs";
const require = createRequire(import.meta.url);
const { build } = require(process.env.LAB_ESBUILD_MODULE || "esbuild");
const repository = new URL("../../", import.meta.url);
const outputDirectory = resolve(
  process.argv[2] || "/workspace/interactive-lab-review",
);
await mkdir(outputDirectory, { recursive: true });
const pages = [
  { id: "", name: "Interactive-Lab-shell.html" },
  ...contents.map((c) => ({ id: c.id, name: `Interactive-Lab-${c.id}.html` })),
];
for (const { id, name } of pages) {
  const source = new URL(`lab/${id ? id + "/" : ""}index.html`, repository);
  let html = await readFile(source, "utf8");
  const imageSource = /data-source-image="([^"]+)"/.exec(html);
  if (imageSource && !imageSource[1].startsWith("data:")) {
    const path = new URL(imageSource[1], source);
    const extension = path.pathname.split(".").at(-1).toLowerCase();
    const mime = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
      gif: "image/gif",
      avif: "image/avif",
      svg: "image/svg+xml",
    }[extension];
    if (!mime) throw new Error(`Unsupported preview image: ${path.pathname}`);
    const encoded = Buffer.from(await readFile(path)).toString("base64");
    html = html.replace(
      imageSource[0],
      () => `data-source-image="data:${mime};base64,${encoded}"`,
    );
  }
  const styles = [];
  for (const match of html.matchAll(
    /<link rel="stylesheet" href="([^"]+)"[^>]*>/g,
  )) {
    styles.push(
      await readFile(new URL(match[1].split("?")[0], source), "utf8"),
    );
  }
  html = html.replace(/<link rel="stylesheet"[^>]*>/g, "");
  html = html.replace(
    "</head>",
    () => `<style>${styles.join("\n")}</style></head>`,
  );
  const scripts = [];
  for (const match of html.matchAll(
    /<script type="module" src="([^"]+)"><\/script>/g,
  )) {
    const entry = new URL(match[1].split("?")[0], source);
    scripts.push(
      (
        await build({
          entryPoints: [entry.pathname],
          bundle: true,
          format: "iife",
          write: false,
          minify: true,
        })
      ).outputFiles[0].text,
    );
  }
  html = html.replace(/<script type="module" src="[^"]+"><\/script>/g, "");
  html = html.replace(
    "</body>",
    () =>
      `<script>${scripts.join("\n").replace(/<\/script/gi, "<\\/script")}</script></body>`,
  );
  const icon = Buffer.from(
    await readFile(new URL("lab/icon.svg", repository)),
  ).toString("base64");
  html = html.replace(
    /<link rel="icon"[^>]*>/g,
    () =>
      `<link rel="icon" href="data:image/svg+xml;base64,${icon}" type="image/svg+xml" />`,
  );
  const base = `https://mei-chan-nel.com/lab/${id ? id + "/" : ""}`;
  html = html.replace(/href="([^"]+)"/g, (whole, href) => {
    if (href.startsWith("#") || href.startsWith("data:")) return whole;
    const url = new URL(href, base);
    const local = pages.find(
      (p) => url.pathname === `/lab/${p.id ? p.id + "/" : ""}`,
    );
    // Canonical metadata must keep the actual page URL.
    return `href="${local && !href.startsWith("https:") ? local.name : url.href}"`;
  });
  await writeFile(resolve(outputDirectory, name), html);
  console.log(`${name}: ${Buffer.byteLength(html)} bytes`);
}

import { execFileSync } from 'node:child_process';
import { readdir, readFile, mkdir, writeFile, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const project = new URL('../', import.meta.url);
const portal = new URL('../../', project);
const destination = new URL('program-trace/studio/', portal);
execFileSync(process.execPath, [fileURLToPath(new URL('node_modules/typescript/lib/tsc.js', project)), '-p', fileURLToPath(project)], { stdio: 'inherit' });
await mkdir(destination, { recursive: true });
for (const name of await readdir(new URL('dist/', project))) if (name.endsWith('.js')) {
  const source = await readFile(new URL(`dist/${name}`, project), 'utf8');
  // Keep the unchanged registry and value/error helpers at their canonical URL:
  // callers registering a builtin must share the same module instance.
  const versioned = source.replace(/(from ['"]\.\/)([^'"]+\.js)(['"])/g, (match, prefix, name, quote) =>
    ['builtins.js', 'errors.js', 'values.js'].includes(name) ? match : `${prefix}${name}?v=${name === 'flowchart-link.js' ? '20261009-flowchart2' : '20261009-function-help3'}${quote}`);
  await writeFile(new URL(name, destination), versioned, 'utf8');
}
const trace = await readFile(new URL('program-trace/index.html', portal), 'utf8');
const adjust = html => html.replaceAll('href="../', 'href="../../').replaceAll('href="./"', 'href="../"');
const header = adjust(trace.match(/<header class="site-header">[\s\S]*?<\/header>/)[0]);
const footer = adjust(trace.match(/<footer class="site-footer">[\s\S]*?<\/footer>/)[0]);
const shell = (await readFile(new URL('public/index.html.in', project), 'utf8'))
  .replace('<!--studio-file-spec-->', await readFile(new URL('public/file-spec.html.in', project), 'utf8'));
for (const name of ['index.html', 'share.html', 'guide.html']) {
  const shared = name === 'share.html';
  const guide = name === 'guide.html';
  const source = guide ? shell.slice(0, shell.indexOf('<body')).replace(/  <script type="module"[^\n]+\n/, '').replace('<title>プログラムトレース Studio｜', '<title>プログラムの作り方｜プログラムトレース Studio｜') + await readFile(new URL('public/guide.html.in', project), 'utf8') : shell;
  const html = source.replace('<!--site-header-->', header).replace('<!--site-footer-->', footer)
    .replaceAll('%%ROBOTS%%', shared ? 'noindex, follow' : 'index, follow')
    .replaceAll('%%CANONICAL%%', `https://mei-chan-nel.com/program-trace/studio/${shared ? 'share.html' : guide ? 'guide.html' : ''}`)
    .replaceAll('%%ENTRY%%', shared ? 'shared' : 'editor');
  await writeFile(new URL(name, destination), html, 'utf8');
}
for (const name of ['studio.css', 'ai-guide.md', 'ai-guide.json']) await copyFile(new URL(`public/${name}`, project), new URL(name, destination));
await mkdir(new URL('examples/', destination), { recursive: true });
for (const name of await readdir(new URL('public/examples/', project))) if (name.endsWith('.studio.json')) {
  await copyFile(new URL(`public/examples/${name}`, project), new URL(`examples/${name}`, destination));
}
// Snapshot the existing runner's design without importing its problem collection.
await copyFile(new URL('program-trace/styles.css', portal), new URL('trace-base.css', destination));
// Both runners use the same DOM-only interactions. Program interpretation stays
// independent, and these modules never import the original problem collection.
for (const name of ['assignment-flow.js', 'variable-scroll.js', 'fullscreen.js', 'result-panels.js', 'step-keys.js', 'flowchart-link.js']) {
  await copyFile(new URL(`program-trace/${name}`, portal), new URL(name, destination));
}
console.log('Built independent Studio → program-trace/studio/');

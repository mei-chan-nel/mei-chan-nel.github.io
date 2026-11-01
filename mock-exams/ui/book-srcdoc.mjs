// WebKit blocks parent-attached event handlers in a script-sandboxed srcdoc
// frame (https://bugs.webkit.org/show_bug.cgi?id=218086). The iframe must
// allow scripts for those handlers, while a CSP prevents embedded content
// from executing any of its own JavaScript.
export function bookFrameSrcdoc(html, url) {
  const safeUrl = url.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  const head = /<head\b[^>]*>/i;
  if (!head.test(html)) throw Error("問題文のHTMLにhead要素がありません。");
  return html.replace(
    head,
    (match) =>
      match +
      `<meta http-equiv="Content-Security-Policy" content="script-src 'none'; object-src 'none'"><base href="${safeUrl}">`,
  );
}

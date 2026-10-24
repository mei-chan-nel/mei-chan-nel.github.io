/** Copy the current example and settings into Studio's existing share format. */
export async function studioEditURL(example, parameters, baseURL) {
  const [{ traceDraft }, { encodeShare }] = await Promise.all([
    import("../lab/flowchart/bridge.mjs"),
    import("./studio/sharing.js?v=20261009-function-help3"),
  ]);
  let draft;
  try {
    draft = traceDraft(example, parameters);
  } catch (error) {
    throw new Error(error.message.replaceAll("フローチャート", "Studio"));
  }
  const url = new URL(await encodeShare(draft, new URL("./studio/", baseURL).href));
  url.searchParams.set("edit", "1");
  return url.href;
}

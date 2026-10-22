/** Shared DOM action for both Program Trace entry points. Interpretation is lazy. */
export function bindFlowchartConversion({ read, pause }) {
  const trigger = document.getElementById("flowchart-button");
  if (!trigger) return;
  const dialog = document.createElement("dialog");
  dialog.className = "values-dialog";
  dialog.setAttribute("aria-labelledby", "flowchart-conversion-heading");
  const heading = document.createElement("h2");
  heading.id = "flowchart-conversion-heading";
  heading.textContent = "フローチャートに変換";
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  const source = document.createElement("pre");
  source.style.cssText =
    "max-height:40vh;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere";
  const actions = document.createElement("div");
  actions.className = "dialog-actions";
  const link = document.createElement("a");
  link.className = "button button-primary";
  link.textContent = "フローチャートで開く →";
  const cancel = document.createElement("button");
  cancel.className = "button";
  cancel.type = "button";
  cancel.textContent = "キャンセル";
  actions.append(link, cancel);
  dialog.append(heading, status, source, actions);
  document.body.append(dialog);
  let generation = 0;
  cancel.onclick = () => {
    generation++;
    dialog.close();
  };
  dialog.addEventListener("cancel", () => {
    generation++;
  });
  trigger.addEventListener("click", async () => {
    pause();
    const token = ++generation;
    link.hidden = true;
    source.hidden = true;
    status.textContent = "変換しています…";
    dialog.showModal();
    try {
      const base = new URL(
        location.pathname.includes("/studio/")
          ? "../../lab/flowchart/"
          : "../lab/flowchart/",
        location.href,
      );
      const bridge = await import(new URL("bridge.mjs", base).href);
      const value = read(),
        draft = value.example
          ? bridge.traceDraft(value.example, value.parameters)
          : value;
      let url = await bridge.toFlowURL(draft, base.href);
      if (value.example?.collection === "video") {
        const { videoOrigin } = await import(
            new URL("video-entry.mjs", base).href
          ),
          origin = videoOrigin(
            value.example,
            new URLSearchParams(location.search).get("from") ?? "",
          ),
          target = new URL(url);
        target.searchParams.set("question", origin.question);
        target.searchParams.set("from", origin.from);
        url = target.href;
      }
      if (token !== generation) return;
      source.textContent = draft.source;
      source.hidden = false;
      link.href = url;
      link.hidden = false;
      status.textContent = "現在の内容を図記号へ変換して開きます。";
    } catch (e) {
      if (token === generation)
        status.textContent = e.message || "変換できませんでした。";
    }
  });
}

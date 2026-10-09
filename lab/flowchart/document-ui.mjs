import {
  FlowStorage,
  fingerprint,
  documentJSON,
  parseDocument,
  encodeShare,
  decodeShare,
  programURL,
} from "./documents.mjs";
import {
  flowDocument,
  emptyGraph,
  validateDocument,
  MAX_BYTES,
} from "./graph.mjs";
import { toProgram } from "./conversion.mjs";
import { examples, exampleDocument } from "./examples.mjs";
const $ = (id) => document.getElementById(id);
const errorText = (e) => e?.message || "操作できませんでした。";
const element = (tag, text) => {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  return e;
};
export function installDocuments({ read, replace, pause, message }) {
  let storage,
    recordId = null,
    baseline = null,
    shared = false,
    previous = null,
    corrupt = false,
    pendingNew = false,
    pendingLoad = null,
    pendingExport = null,
    generation = 0;
  try {
    storage = new FlowStorage(localStorage);
  } catch {}
  const current = () => flowDocument(read(), $("circuit-name").value);
  const error = (id, text) => {
    const e = $(id).querySelector(".document-error");
    e.textContent = text;
    e.hidden = !text;
  };
  function requireStorage() {
    if (!storage)
      throw Error(
        "ブラウザ内の保存を使えません。JSONファイルに書き出してください。",
      );
    return storage;
  }
  function showShare() {
    $("shared-circuit").hidden = !shared;
    $("restore-own-circuit").hidden = !previous;
  }
  function autosave() {
    if (shared || corrupt || !storage) return;
    try {
      storage.saveDraft(current(), recordId, baseline);
    } catch {}
  }
  function edited() {
    generation++;
    shared = false;
    previous = null;
    corrupt = false;
    showShare();
    if (location.hash) {
      try {
        history.replaceState(null, "", location.pathname + location.search);
      } catch {}
    }
    autosave();
  }
  function apply(
    d,
    {
      id = null,
      fromShare = false,
      clean,
      write = true,
      preserveLocation = false,
      sourceLabel = "共有されたフローチャート",
    } = {},
  ) {
    const checked = validateDocument(d);
    pause();
    generation++;
    if (fromShare && !shared) {
      try {
        previous = storage?.draft() ?? null;
      } catch {
        previous = null;
      }
    }
    shared = fromShare;
    if (!shared) {
      previous = null;
      if (location.hash && !preserveLocation) {
        try {
          history.replaceState(null, "", location.pathname + location.search);
        } catch {}
      }
    }
    recordId = id;
    baseline = clean === undefined ? fingerprint(checked) : clean;
    $("circuit-name").value = checked.title;
    replace(checked.graph);
    $("shared-circuit").querySelector("span").textContent = sourceLabel;
    showShare();
    if (write && !shared) {
      corrupt = false;
      autosave();
    }
  }
  function closeAll() {
    document
      .querySelectorAll(".circuit-dialog[open]")
      .forEach((d) => d.close());
  }
  function fresh() {
    pendingNew = false;
    closeAll();
    apply(flowDocument(emptyGraph()), { write: true });
    message("");
  }
  function cancelDialog(d) {
    if (["unsaved-dialog", "save-dialog", "export-dialog"].includes(d.id))
      pendingNew = false;
    if (d.id === "confirm-dialog") pendingLoad = null;
    if (d.id === "export-dialog") pendingExport = null;
    generation++;
  }
  for (const b of document.querySelectorAll("[data-close-circuit-dialog]"))
    b.onclick = () => {
      const d = b.closest("dialog");
      cancelDialog(d);
      d.close();
    };
  for (const d of document.querySelectorAll(".circuit-dialog"))
    d.addEventListener("cancel", () => cancelDialog(d));
  function openSave(forNew = false) {
    pause();
    pendingNew = forNew;
    $("save-name").value = current().title;
    $("save-copy").hidden = !recordId;
    $("save-submit").textContent = recordId
      ? "ブラウザ内に上書き保存"
      : "ブラウザ内に保存";
    error("save-dialog", "");
    $("save-dialog").showModal();
  }
  function save(copy = false) {
    try {
      const title = $("save-name").value.trim();
      if (!title) throw Error("名前を入力してください。");
      const record = requireStorage().save(
        flowDocument(read(), title),
        copy ? null : recordId,
      );
      recordId = record.id;
      $("circuit-name").value = record.document.title;
      baseline = fingerprint(record.document);
      edited();
      $("save-dialog").close();
      message("ブラウザ内に保存しました。");
      if (pendingNew) fresh();
    } catch (e) {
      error("save-dialog", errorText(e));
    }
  }
  function download(text, name, dialog) {
    const url = URL.createObjectURL(
        new Blob([text], { type: "application/json;charset=utf-8" }),
      ),
      a = element("a");
    a.href = url;
    a.download = name;
    dialog.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  const filename = (name, suffix = ".flowchart.json") => {
    let v = name
      .trim()
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
      .replace(/[. ]+$/, "");
    if (!v) throw Error("ファイル名を入力してください。");
    if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(v))
      v = "chart-" + v;
    return v.endsWith(".json") ? v : v + suffix;
  };
  function confirm(d, options = {}) {
    pause();
    const checked = validateDocument(d);
    closeAll();
    pendingLoad = { document: checked, options };
    $("confirm-copy").textContent =
      `「${checked.title}」を読み込みます。現在の図は置き換わります。`;
    error("confirm-dialog", "");
    $("confirm-dialog").showModal();
  }
  function loadList() {
    const list = $("saved-list");
    list.replaceChildren();
    error("load-dialog", "");
    try {
      const records = requireStorage().list();
      if (!records.length)
        list.append(element("p", "このブラウザに保存した図はありません。"));
      for (const r of records) {
        const row = element("div");
        row.className = "saved-circuit-item";
        const text = element("strong", r.document.title),
          actions = element("div");
        actions.className = "saved-circuit-actions";
        const load = element("button", "読込");
        load.type = "button";
        load.setAttribute("aria-label", r.document.title + "を読込");
        load.onclick = () => confirm(r.document, { id: r.id });
        const remove = element("button", "削除");
        remove.type = "button";
        remove.setAttribute("aria-label", r.document.title + "を削除");
        remove.onclick = () => {
          if (remove.dataset.confirm !== "yes") {
            remove.dataset.confirm = "yes";
            remove.textContent = "削除する";
            return;
          }
          try {
            storage.remove(r.id);
            if (recordId === r.id) recordId = null;
            loadList();
          } catch (e) {
            error("load-dialog", errorText(e));
          }
        };
        actions.append(load, remove);
        row.append(text, actions);
        list.append(row);
      }
    } catch (e) {
      error("load-dialog", errorText(e));
    }
  }
  $("circuit-name").addEventListener("input", edited);
  $("save-circuit").onclick = () => openSave();
  $("save-form").onsubmit = (e) => {
    e.preventDefault();
    save();
  };
  $("save-copy").onclick = () => save(true);
  $("new-circuit").onclick = () => {
    pause();
    if (baseline !== null && fingerprint(current()) === baseline) fresh();
    else $("unsaved-dialog").showModal();
  };
  $("discard-and-new").onclick = fresh;
  $("save-and-new").onclick = () => {
    $("unsaved-dialog").close();
    openSave(true);
  };
  $("export-circuit").onclick = () => {
    try {
      pendingExport = flowDocument(read(), $("save-name").value);
      $("export-name").value = filename(pendingExport.title);
      error("export-dialog", "");
      closeAll();
      $("export-dialog").showModal();
    } catch (e) {
      error("save-dialog", errorText(e));
    }
  };
  $("export-form").onsubmit = (e) => {
    e.preventDefault();
    try {
      if (!pendingExport) throw Error("書き出す図を選び直してください。");
      const d = pendingExport;
      download(
        documentJSON(d),
        filename($("export-name").value),
        $("export-dialog"),
      );
      $("circuit-name").value = d.title;
      baseline = fingerprint(d);
      edited();
      pendingExport = null;
      $("export-dialog").close();
      message("JSONファイルを書き出しました。");
      if (pendingNew) fresh();
    } catch (e) {
      error("export-dialog", errorText(e));
    }
  };
  $("load-circuit").onclick = () => {
    pause();
    loadList();
    $("load-dialog").showModal();
  };
  for (const e of examples) {
    const b = element("button", e.name);
    b.type = "button";
    b.dataset.example = e.id;
    b.onclick = () => {
      try {
        confirm(exampleDocument(e.id));
      } catch (e) {
        error("load-dialog", errorText(e));
      }
    };
    $("flow-example-list").append(b);
  }
  $("confirm-form").onsubmit = (e) => {
    e.preventDefault();
    try {
      if (!pendingLoad) throw Error("図を選び直してください。");
      const p = pendingLoad;
      pendingLoad = null;
      $("confirm-dialog").close();
      apply(p.document, p.options);
      message("図を読み込みました。");
    } catch (e) {
      error("confirm-dialog", errorText(e));
      if (!$("confirm-dialog").open) $("confirm-dialog").showModal();
    }
  };
  $("import-circuit").onclick = () => $("circuit-file").click();
  $("circuit-file").onchange = async () => {
    const file = $("circuit-file").files?.[0];
    $("circuit-file").value = "";
    if (!file) return;
    const token = ++generation;
    try {
      if (file.size > MAX_BYTES)
        throw Error("ファイルは300KB以内にしてください。");
      const d = parseDocument(await file.text());
      if (token === generation) confirm(d);
    } catch (e) {
      if (token === generation) error("load-dialog", errorText(e));
    }
  };
  $("load-url-form").onsubmit = async (e) => {
    e.preventDefault();
    const token = ++generation;
    $("load-url-submit").disabled = true;
    error("load-dialog", "");
    try {
      const d = await decodeShare($("load-url").value);
      if (token === generation) confirm(d, { fromShare: true });
    } catch (e) {
      if (token === generation) error("load-dialog", errorText(e));
    } finally {
      $("load-url-submit").disabled = false;
    }
  };
  $("share-circuit").onclick = async () => {
    pause();
    const token = ++generation;
    $("share-url").value = "";
    $("copy-url").disabled = true;
    $("native-share").hidden = true;
    error("share-dialog", "");
    $("share-status").textContent = "URLを作っています…";
    $("share-dialog").showModal();
    try {
      const url = await encodeShare(current(), location.href);
      if (token !== generation) return;
      $("share-url").value = url;
      $("copy-url").disabled = false;
      $("native-share").hidden = typeof navigator.share !== "function";
      $("share-status").textContent =
        url.length > 2000
          ? "長いURLは、途中で切れた場合にJSONファイルを使ってください。"
          : "図記号・矢印・配置・内容を含むURLです。";
    } catch (e) {
      if (token === generation) error("share-dialog", errorText(e));
    }
  };
  $("copy-url").onclick = async () => {
    try {
      await navigator.clipboard.writeText($("share-url").value);
      $("share-status").textContent = "URLをコピーしました。";
    } catch {
      $("share-url").focus();
      $("share-url").select();
      $("share-status").textContent = "選択したURLをコピーしてください。";
    }
  };
  $("native-share").onclick = async () => {
    try {
      await navigator.share({
        title: current().title,
        url: $("share-url").value,
      });
    } catch (e) {
      if (e.name !== "AbortError")
        $("share-status").textContent = "URLをコピーして共有してください。";
    }
  };
  $("restore-own-circuit").onclick = () => {
    if (previous)
      confirm(previous.document, { id: previous.id, clean: previous.baseline });
  };
  let converted = null;
  $("to-program").onclick = async () => {
    pause();
    converted = null;
    const token = ++generation;
    $("program-source").value = "";
    $("open-program").hidden = true;
    $("download-program").disabled = true;
    error("program-dialog", "");
    $("program-dialog").showModal();
    try {
      converted = toProgram(current());
      $("program-source").value = converted.source;
      $("download-program").disabled = false;
      let base = "https://mei-chan-nel.com/program-trace/studio/";
      if (/^https?:$/.test(location.protocol))
        base = new URL("../../program-trace/studio/", location.href).href;
      const url = await programURL(converted, base);
      if (token !== generation) return;
      $("open-program").href = url;
      $("open-program").hidden = false;
      $("offline-program-help").hidden = /^https?:$/.test(location.protocol);
    } catch (e) {
      if (token === generation) error("program-dialog", errorText(e));
    }
  };
  $("download-program").onclick = () => {
    if (converted)
      download(
        JSON.stringify({ format: "mei-program-studio", ...converted }, null, 2),
        filename(converted.title, ".studio.json"),
        $("program-dialog"),
      );
  };
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      if (!document.querySelector("dialog[open]")) openSave();
    }
  });
  window.addEventListener("pagehide", () => {
    pause();
    autosave();
  });
  async function receive() {
    if (!/^#(?:fc1|v1|v2)\./.test(location.hash)) return;
    const token = ++generation;
    try {
      const d = await decodeShare(location.hash);
      if (token === generation) apply(d, { fromShare: true, write: false });
    } catch (e) {
      message(errorText(e), true);
    }
  }
  window.addEventListener("hashchange", receive);
  return {
    edited,
    openExternal(d) {
      apply(d, {
        fromShare: true,
        write: false,
        sourceLabel: "動画のプログラム",
      });
    },
    start() {
      baseline = fingerprint(current());
      try {
        const d = storage?.draft();
        if (d) {
          apply(d.document, {
            id: d.id,
            clean: d.baseline,
            write: false,
            preserveLocation: true,
          });
          if (d.id && !storage.list().some((r) => r.id === d.id))
            recordId = null;
        }
      } catch (e) {
        corrupt = true;
        message(
          "前回の作業を読み取れません。保存一覧やJSONから読み込めます。",
          true,
        );
      }
      void receive();
    },
  };
}

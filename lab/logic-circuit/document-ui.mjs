import {
  CircuitStorage,
  circuitDocument,
  validateDocument,
  parseDocument,
  documentJSON,
  exportFilename,
  fingerprint,
  FILE_BYTES,
} from "./documents.mjs";
import { encodeShare, decodeShare, isCircuitShare } from "./sharing.mjs";

const $ = (id) => document.getElementById(id);
const errorText = (error) =>
  error instanceof Error ? error.message : "操作できませんでした。";
const element = (tag, className, text) => {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

export function installDocumentControls({ read, replace, cancel, message }) {
  let storage,
    storageError = "",
    savedId,
    shared = false,
    draftUnavailable = false,
    previousDraft;
  let pendingLoad,
    pendingExport,
    generation = 0;
  try {
    storage = new CircuitStorage(localStorage);
  } catch {
    storageError =
      "このブラウザでは保存を利用できません。ファイルに書き出して保存してください。";
  }
  const current = () => circuitDocument(read(), $("circuit-name").value);
  function requireStorage() {
    if (!storage) throw new Error(storageError);
    return storage;
  }
  function formError(dialog, text) {
    const field = $(dialog).querySelector(".document-error");
    field.textContent = text;
    field.hidden = !text;
  }
  function clearShareLocation() {
    if (!isCircuitShare(location.hash)) return;
    try {
      const url = new URL(location.href);
      url.hash = "";
      history.replaceState(null, "", url.href);
    } catch {
      /* Opaque-origin standalone previews may not permit history. */
    }
  }
  function showShared() {
    $("shared-circuit").hidden = !shared;
    $("restore-own-circuit").hidden = !previousDraft;
  }
  function autosave() {
    if (shared || !storage || draftUnavailable) return;
    try {
      storage.saveDraft(current());
    } catch {
      /* Named saves report storage failures; file export remains available. */
    }
  }
  function edited() {
    generation++;
    draftUnavailable = false;
    shared = false;
    previousDraft = undefined;
    clearShareLocation();
    showShared();
    autosave();
  }
  function apply(
    document,
    { id, fromShare = false, write = false, preserveLocation = false } = {},
  ) {
    const checked = validateDocument(document);
    cancel();
    if (fromShare && !shared) {
      try {
        previousDraft = storage?.draft() ?? null;
      } catch {
        previousDraft = null;
      }
    }
    shared = fromShare;
    if (!shared) {
      previousDraft = undefined;
      if (!preserveLocation) clearShareLocation();
    }
    savedId = id;
    $("circuit-name").value = checked.title;
    replace(checked.circuit);
    showShared();
    if (write) {
      draftUnavailable = false;
      autosave();
    }
  }
  function closeDialogs() {
    for (const dialog of document.querySelectorAll(".circuit-dialog[open]"))
      dialog.close();
  }
  function openSave() {
    cancel();
    $("save-name").value = current().title;
    $("save-copy").hidden = !savedId;
    $("save-submit").textContent = savedId
      ? "ブラウザ内に上書き保存"
      : "ブラウザ内に保存";
    formError("save-dialog", "");
    $("save-dialog").showModal();
  }
  function saveNamed(copy = false) {
    try {
      const title = $("save-name").value.trim();
      if (!title) throw new Error("回路名を入力してください。");
      const record = requireStorage().save(
        circuitDocument(read(), title),
        copy ? undefined : savedId,
      );
      savedId = record.id;
      $("circuit-name").value = record.document.title;
      edited();
      $("save-dialog").close();
      message(
        `「${record.document.title}」をこのブラウザに保存しました。`,
        false,
        true,
      );
    } catch (error) {
      formError("save-dialog", errorText(error));
    }
  }
  function openExport(document = current()) {
    cancel();
    const exported = {
      document: validateDocument(document),
      text: documentJSON(document),
    };
    $("export-name").value = exportFilename(document.title);
    formError("export-dialog", "");
    closeDialogs();
    pendingExport = exported;
    $("export-dialog").showModal();
  }
  function download(text, name) {
    const url = URL.createObjectURL(
      new Blob([text], { type: "application/json;charset=utf-8" }),
    );
    const link = element("a", "");
    link.href = url;
    link.download = name;
    // A modal makes the rest of the document inert. Activate within the dialog.
    $("export-dialog").append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  function confirmLoad(document, options = {}) {
    const checked = validateDocument(document);
    cancel();
    closeDialogs();
    pendingLoad = { document: checked, options };
    $("confirm-copy").textContent =
      `「${checked.title}」を読み込みます。現在の回路は置き換わります。`;
    $("confirm-dialog").showModal();
  }
  function renderSaved() {
    const container = $("saved-list");
    container.replaceChildren();
    formError("load-dialog", "");
    try {
      const records = requireStorage().list();
      if (!records.length)
        container.append(
          element(
            "p",
            "document-help",
            "このブラウザに保存した回路はありません。",
          ),
        );
      for (const record of records) {
        const row = element("div", "saved-circuit-item"),
          text = element("div", "saved-circuit-text");
        text.append(element("strong", "", record.document.title));
        const time = element(
          "time",
          "",
          new Date(record.updatedAt).toLocaleString("ja-JP"),
        );
        time.dateTime = new Date(record.updatedAt).toISOString();
        text.append(time);
        const actions = element("div", "saved-circuit-actions");
        const load = element("button", "", "読込");
        load.type = "button";
        load.setAttribute("aria-label", `${record.document.title}を読込`);
        load.onclick = () =>
          confirmLoad(record.document, { id: record.id, write: true });
        const remove = element("button", "", "削除");
        remove.type = "button";
        remove.setAttribute("aria-label", `${record.document.title}を削除`);
        remove.onclick = () => {
          if (remove.dataset.confirm !== "yes") {
            remove.dataset.confirm = "yes";
            remove.textContent = "削除する";
            remove.setAttribute(
              "aria-label",
              `${record.document.title}を削除する`,
            );
            return;
          }
          try {
            requireStorage().remove(record.id);
            if (savedId === record.id) savedId = undefined;
            renderSaved();
          } catch (error) {
            formError("load-dialog", errorText(error));
          }
        };
        actions.append(load, remove);
        row.append(text, actions);
        container.append(row);
      }
    } catch (error) {
      formError("load-dialog", errorText(error));
    }
  }
  async function receiveLocation() {
    if (!isCircuitShare(location.hash)) return;
    const token = ++generation;
    try {
      const decoded = await decodeShare(location.hash);
      if (token !== generation) return;
      closeDialogs();
      apply(decoded, { fromShare: true });
      message("共有された回路を読み込みました。", false, true);
    } catch (error) {
      if (token === generation) message(errorText(error), true);
    }
  }

  $("circuit-name").addEventListener("input", edited);
  $("save-circuit").onclick = openSave;
  $("save-form").onsubmit = (event) => {
    event.preventDefault();
    saveNamed();
  };
  $("save-copy").onclick = () => saveNamed(true);
  $("export-circuit").onclick = () => {
    try {
      openExport(circuitDocument(read(), $("save-name").value));
    } catch (error) {
      formError("save-dialog", errorText(error));
    }
  };
  $("export-form").onsubmit = (event) => {
    event.preventDefault();
    try {
      if (!pendingExport) return;
      const name = exportFilename($("export-name").value),
        exported = pendingExport;
      download(exported.text, name);
      $("circuit-name").value = exported.document.title;
      edited();
      $("export-dialog").close();
      message(`「${name}」を書き出しました。`, false, true);
    } catch (error) {
      formError("export-dialog", errorText(error));
    }
  };
  $("export-dialog").addEventListener("close", () => {
    pendingExport = undefined;
  });
  $("load-circuit").onclick = () => {
    cancel();
    renderSaved();
    $("load-dialog").showModal();
  };
  $("confirm-form").onsubmit = (event) => {
    event.preventDefault();
    if (!pendingLoad) return;
    generation++;
    apply(pendingLoad.document, pendingLoad.options);
    $("confirm-dialog").close();
    message("回路を読み込みました。", false, true);
  };
  $("confirm-dialog").addEventListener("close", () => {
    pendingLoad = undefined;
  });
  $("import-circuit").onclick = () => $("circuit-file").click();
  $("circuit-file").addEventListener("change", async () => {
    const file = $("circuit-file").files?.[0];
    $("circuit-file").value = "";
    if (!file) return;
    const token = ++generation;
    try {
      if (file.size > FILE_BYTES)
        throw new Error("ファイルが大きすぎます（100KB以内）。");
      const decoded = parseDocument(await file.text());
      if (token === generation) confirmLoad(decoded, { write: true });
    } catch (error) {
      if (token === generation) formError("load-dialog", errorText(error));
    }
  });
  $("load-url-form").onsubmit = async (event) => {
    event.preventDefault();
    const token = ++generation;
    $("load-url-submit").disabled = true;
    formError("load-dialog", "");
    try {
      const decoded = await decodeShare($("load-url").value);
      if (token === generation) confirmLoad(decoded, { fromShare: true });
    } catch (error) {
      if (token === generation) formError("load-dialog", errorText(error));
    } finally {
      $("load-url-submit").disabled = false;
    }
  };
  $("restore-own-circuit").onclick = () => {
    if (previousDraft) confirmLoad(previousDraft, { write: true });
  };
  $("share-circuit").onclick = async () => {
    cancel();
    const document = current(),
      token = ++generation;
    $("share-url").value = "";
    $("copy-url").disabled = true;
    $("native-share").hidden = true;
    $("share-status").textContent = "共有URLを作っています…";
    $("share-offline-help").hidden = ["http:", "https:"].includes(
      location.protocol,
    );
    formError("share-dialog", "");
    $("share-dialog").showModal();
    try {
      const url = await encodeShare(document, location.href);
      if (token !== generation || !$("share-dialog").open) return;
      $("share-url").value = url;
      $("copy-url").disabled = false;
      $("native-share").hidden = typeof navigator.share !== "function";
      $("share-status").textContent =
        url.length > 2000
          ? `${url.length.toLocaleString("ja-JP")}文字。長いURLは途中で切れる場合があります。ファイルでも共有できます。`
          : "部品・配線・配置・入力の値が含まれます。";
    } catch (error) {
      if (token === generation) formError("share-dialog", errorText(error));
    }
  };
  $("copy-url").onclick = async () => {
    const field = $("share-url");
    try {
      await navigator.clipboard.writeText(field.value);
      $("share-status").textContent = "共有URLをコピーしました。";
    } catch {
      field.focus();
      field.select();
      $("share-status").textContent =
        "URLを選択しました。コピーして共有してください。";
    }
  };
  $("native-share").onclick = async () => {
    try {
      await navigator.share({
        title: current().title,
        url: $("share-url").value,
      });
    } catch (error) {
      if (error?.name !== "AbortError")
        $("share-status").textContent =
          "URLをコピーするか、ファイルで共有してください。";
    }
  };
  $("share-export").onclick = () => {
    try {
      openExport();
    } catch (error) {
      formError("share-dialog", errorText(error));
    }
  };
  for (const button of document.querySelectorAll(
    "[data-close-circuit-dialog]",
  )) {
    button.onclick = () => button.closest("dialog").close();
  }
  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      if (!document.querySelector("dialog[open]")) openSave();
    }
  });
  window.addEventListener("hashchange", receiveLocation);
  window.addEventListener("pagehide", () => {
    cancel();
    autosave();
  });

  return {
    edited,
    start() {
      try {
        const draft = storage?.draft();
        if (draft) {
          apply(draft, { preserveLocation: true });
          try {
            savedId = storage
              .list()
              .find(
                (record) => fingerprint(record.document) === fingerprint(draft),
              )?.id;
          } catch {}
        }
      } catch (error) {
        draftUnavailable = true;
        message(errorText(error), true);
      }
      void receiveLocation();
    },
  };
}

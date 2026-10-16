import {
  programDocument,
  readPrograms,
  saveProgram,
  removeProgram,
} from "./documents.mjs";
import { presets } from "./presets.mjs";
const node = (tag, text, cls = "") => {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  n.className = cls;
  return n;
};
const button = (text, fn, cls = "") => {
  const n = node("button", text, cls);
  n.type = "button";
  n.onclick = fn;
  return n;
};
export function installProgramDocuments({
  read,
  replace,
  settings,
  pause,
  message,
}) {
  let savedId, pending, exported;
  const dialogs = [];
  function dialog(id, title) {
    const d = node("dialog", undefined, "memory-dialog");
    d.id = id;
    const h = node("div", undefined, "document-dialog-heading"),
      heading = node("h2", title);
    heading.id = id + "-heading";
    d.setAttribute("aria-labelledby", heading.id);
    h.append(
      heading,
      button("×", () => d.close(), "document-close"),
    );
    h.lastChild.setAttribute("aria-label", "閉じる");
    d.append(h);
    dialogs.push(d);
    document.body.append(d);
    return d;
  }
  function error(d, text = "") {
    let n = d.querySelector(".document-error");
    if (!n) {
      n = node("p", undefined, "document-error");
      n.setAttribute("role", "alert");
      d.append(n);
    }
    n.textContent = text;
    n.hidden = !text;
  }
  function show(d) {
    pause();
    dialogs.forEach((other) => {
      if (other.open) other.close();
    });
    error(d);
    d.showModal();
  }
  function field(label, id, value = "") {
    const wrap = node("label", undefined, "document-field"),
      input = node("input");
    input.id = id;
    input.value = value;
    input.maxLength = 120;
    input.autocomplete = "off";
    wrap.htmlFor = id;
    wrap.append(node("span", label), input);
    return wrap;
  }
  const save = dialog("program-save-dialog", "プログラムを保存"),
    saveForm = node("form");
  saveForm.append(field("プログラム名", "program-save-name"));
  saveForm.querySelector("input").required = true;
  saveForm.querySelector("input").maxLength = 60;
  const actions = node("div", undefined, "document-dialog-actions"),
    submit = node("button", "ブラウザ内に保存", "document-primary"),
    saveCopy = button("別の名前で保存", () => saveNamed(true));
  submit.type = "submit";
  submit.id = "program-save-submit";
  saveCopy.id = "program-save-copy";
  actions.append(saveCopy, submit);
  saveForm.append(actions);
  const fileArea = node("div", undefined, "document-file-action"),
    exportButton = button("JSONファイルに書出", () => {
      try {
        exported = programDocument({
          ...read(),
          name: document.getElementById("program-save-name").value,
        });
        document.getElementById("program-export-name").value =
          exported.name + ".json";
        show(exportDialog);
      } catch (e) {
        error(save, e.message);
      }
    });
  exportButton.id = "export-program";
  fileArea.append(node("span", "端末に保存"), exportButton);
  save.append(saveForm, fileArea);
  function saveNamed(asCopy = false) {
    try {
      const result = saveProgram(
        localStorage,
        { ...read(), name: document.getElementById("program-save-name").value },
        asCopy ? undefined : savedId,
      );
      savedId = result.id;
      document.getElementById("experiment-name").value = result.document.name;
      document
        .getElementById("experiment-name")
        .dispatchEvent(new Event("input", { bubbles: true }));
      save.close();
      message(`「${result.document.name}」をこのブラウザに保存しました。`);
    } catch (e) {
      error(save, e.message);
    }
  }
  saveForm.onsubmit = (e) => {
    e.preventDefault();
    saveNamed();
  };
  const exportDialog = dialog("program-export-dialog", "JSONファイルに書出"),
    exportForm = node("form");
  exportForm.append(field("ファイル名", "program-export-name"));
  const exportActions = node("div", undefined, "document-dialog-actions"),
    download = node("button", "書き出す", "document-primary");
  download.type = "submit";
  exportActions.append(
    button("キャンセル", () => exportDialog.close()),
    download,
  );
  exportForm.append(exportActions);
  exportDialog.append(exportForm);
  exportForm.onsubmit = (e) => {
    e.preventDefault();
    try {
      let filename = document
        .getElementById("program-export-name")
        .value.trim()
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_");
      if (!filename) throw new Error("ファイル名を入力してください。");
      if (!filename.endsWith(".json")) filename += ".json";
      const text = JSON.stringify(exported, null, 2);
      const url = URL.createObjectURL(
          new Blob([text], { type: "application/json;charset=utf-8" }),
        ),
        a = node("a");
      a.href = url;
      a.download = filename;
      exportDialog.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      exportDialog.close();
      message("プログラムをJSONファイルに書き出しました。");
    } catch (e) {
      error(exportDialog, e.message);
    }
  };
  const load = dialog("program-load-dialog", "プログラムを読み込む"),
    fileLoad = node("div", undefined, "document-file-action"),
    input = node("input"),
    importButton = button("JSONファイルから読込", () => input.click());
  importButton.id = "import-program";
  input.type = "file";
  input.id = "program-file";
  input.accept = ".json,application/json";
  input.hidden = true;
  fileLoad.append(node("span", "端末から"), importButton, input);
  load.append(fileLoad, node("h3", "プリセット", "document-section-title"));
  const examples = node("div", undefined, "program-example-list");
  load.append(
    examples,
    node("h3", "このブラウザに保存したプログラム", "document-section-title"),
  );
  const saved = node("div");
  saved.id = "saved-programs";
  load.append(saved);
  const confirm = dialog("program-confirm-dialog", "プログラムを読み込む"),
    copy = node("p", undefined, "document-description"),
    confirmActions = node("div", undefined, "document-dialog-actions");
  confirmActions.append(
    button("キャンセル", () => confirm.close()),
    button(
      "読み込む",
      () => {
        if (!pending) return;
        replace(pending.document);
        savedId = pending.id;
        pending = null;
        confirm.close();
      },
      "document-primary",
    ),
  );
  confirm.append(copy, confirmActions);
  function confirmLoad(value, id) {
    pending = { document: programDocument(value), id };
    copy.textContent = `「${pending.document.name}」を読み込みます。現在のプログラムは置き換わります。`;
    show(confirm);
  }
  presets.forEach((p) => {
    const b = button("", () =>
      confirmLoad({
        version: 1,
        name: p.name,
        initial: p.memory,
        config: { ...settings(), start: 0 },
      }),
    );
    b.dataset.preset = p.id;
    b.append(node("strong", p.name), node("small", p.hint));
    examples.append(b);
  });
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      if (file.size > 100000)
        throw new Error("100KB以下のJSONファイルを選んでください。");
      const value = JSON.parse(await file.text());
      confirmLoad(value);
    } catch (e) {
      error(load, e.message);
      message(`読込できませんでした：${e.message}`, true);
    }
    input.value = "";
  };
  function renderSaved() {
    saved.replaceChildren();
    try {
      const records = readPrograms(localStorage);
      if (!records.length)
        saved.append(
          node(
            "p",
            "このブラウザに保存したプログラムはありません。",
            "document-help",
          ),
        );
      for (const record of records) {
        const row = node("div", undefined, "saved-program"),
          text = node("div");
        text.append(
          node("strong", record.document.name),
          node("small", new Date(record.updatedAt).toLocaleString("ja-JP")),
        );
        const controls = node("div");
        controls.append(
          button("読込", () => confirmLoad(record.document, record.id)),
          button("削除", () => {
            try {
              if (!row.dataset.confirmDelete) {
                row.dataset.confirmDelete = "true";
                controls.lastElementChild.textContent = "削除する";
                return;
              }
              removeProgram(localStorage, record.id);
              if (savedId === record.id) savedId = undefined;
              renderSaved();
            } catch (e) {
              error(load, e.message);
            }
          }),
        );
        row.append(text, controls);
        saved.append(row);
      }
    } catch (e) {
      error(load, `ブラウザ内の保存を利用できません。${e.message}`);
    }
  }
  document.getElementById("save-program").onclick = () => {
    try {
      const value = read();
      document.getElementById("program-save-name").value = value.name;
      saveCopy.hidden = !savedId;
      submit.textContent = savedId
        ? "ブラウザ内に上書き保存"
        : "ブラウザ内に保存";
      show(save);
    } catch (e) {
      message(e.message, true);
    }
  };
  document.getElementById("load-program").onclick = () => {
    show(load);
    renderSaved();
  };
  return {
    close: () =>
      dialogs.forEach((d) => {
        if (d.open) d.close();
      }),
  };
}

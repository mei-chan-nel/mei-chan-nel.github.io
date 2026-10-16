import { createLab, rounds } from "./model.mjs";
import { describeSituation, describeItem } from "./presentation.mjs";
import { createDisplayController } from "./display.mjs";
import {
  compactStory,
  compactOutcome,
  paginateText,
} from "./screen-layout.mjs";
const lab = createLab();
const $ = (id) => document.getElementById(id);
const esc = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
const keyTypes = new Set(["symmetric", "public", "private", "verify"]);
const typeNames = {
  symmetric: "共通鍵",
  public: "公開鍵",
  private: "自分の秘密鍵",
  verify: "署名の検証用公開鍵",
  envelope: "鍵が入った暗号文",
  ciphertext: "本文が入った暗号文",
  signature: "電子署名",
};
const hints = [
  [
    "本文を開くために必要なものは何だろう。アリスが、その前に送っていたものを思い出そう。",
    "共通鍵は、本文を開く道具にも、本文を暗号化する道具にも使える。コピーしただけでは相手に届くデータは変わらない。",
  ],
  [
    "前の共通鍵は今回のものとは違う。公開鍵と秘密鍵は、誰の組み合わせなら開けるだろう？",
    "ボブの公開鍵は手元に残せる。アリスが受け取る公開鍵を変えると、鍵の入った封筒は誰の秘密鍵で開くようになるだろう。ボブにも共通鍵を届けるには？",
  ],
  [
    "前の作戦をもう一度試そう。読めることと、書き換えて受け付けられることは同じだろうか？",
    "本文を変えて元の署名を添える・署名を消す・チャーリーが署名する場合を比べよう。ボブが信頼しているのはアリスの検証用公開鍵だ。",
  ],
  [
    "公開鍵の持ち主を確認する設定を切り替え、同じすり替えを試してみよう。",
    "チャーリーの公開鍵にすり替えて届けたとき、共通鍵の配送まで進むだろうか。信頼済みの指紋との一致・不一致を観察しよう。",
  ],
];
const modeInfo = {
  decrypt: {
    prompt:
      "復号は、暗号文を鍵で開くこと。手元のデータと鍵を選び、組み合わせを試そう。",
    data: "開けたい暗号文",
    key: "開けるために試す鍵",
  },
  message: {
    prompt:
      "復号した本文を編集したり、自分で文を作ったりできる。共通鍵で暗号化すると、送れる暗号文が持ち物に増える。",
    key: "本文を暗号化する共通鍵",
  },
  wrap: {
    prompt:
      "公開鍵暗号は、共通鍵の配送に使う。共通鍵を公開鍵で包むと、対になる秘密鍵だけが開ける封筒になる。",
    data: "封筒に入れる共通鍵",
    key: "配送先として使う公開鍵",
  },
  replace: {
    prompt:
      "次に相手へ届けるデータを、持ち物の一つに入れ替える。まだ送信せず、通信画面で確認してから届けられる。",
    data: "相手に送るデータ",
  },
};
let selected = "",
  selectedKey = "",
  mode = "decrypt",
  createdId = null,
  started = false,
  lastAction = "",
  opener = null;
let resultHeading = "まだ行動していない。",
  feedbackText = "状況と目的を読んで、行動を一つ選んでみよう。",
  feedbackError = false;
let toolFeedback = "道具を選び、自由に組み合わせを試せます。";
let overviewActive = false,
  lastTool = "",
  briefPage = 0,
  decryptPage = 0;
let infoTopic = "situation",
  infoPage = 0,
  infoPages = [],
  infoOpener = null;
const visits = new Set();
const itemNotes = new Map();
let createdCount = 0;
function displayLabel(a) {
  const note = a && itemNotes.get(a.id);
  return a && !keyTypes.has(a.type) && note
    ? `${a.label}【${note}】`
    : a?.label || "";
}
function itemValue(a) {
  return a?.token || a?.fingerprint || typeNames[a?.type] || "";
}
function itemTarget(a) {
  if (mode === "replace" || (mode === "wrap" && a.type === "symmetric"))
    return "data";
  return keyTypes.has(a.type) ? "key" : "data";
}
function itemButton(a) {
  return `<button type="button" class="item-button ${a.current === false ? "old" : ""}" data-item="${a.id}" aria-pressed="${(itemTarget(a) === "key" ? selectedKey : selected) === a.id}" aria-label="${itemTarget(a) === "key" ? "使う鍵" : "操作するデータ"}に選択：${esc(displayLabel(a))}"><strong>${esc(displayLabel(a))}</strong><small>${esc(a.current === false ? "以前の通信の鍵" : typeNames[a.type])}</small></button>`;
}
function render() {
  const focusedItem = document.activeElement?.dataset?.item;
  const s = lab.snapshot(),
    r = rounds[s.round],
    story = overviewActive
      ? { ...describeSituation(s), ...compactStory(s) }
      : describeSituation(s),
    done = s.phase === "done";
  if (s.result) visits.add(s.round);
  document.querySelectorAll("[data-round]").forEach((b) => {
    const n = Number(b.dataset.round);
    if (n === s.round) b.setAttribute("aria-current", "step");
    else b.removeAttribute("aria-current");
    b.classList.toggle("visited", visits.has(n));
  });
  $("round-number").textContent =
    s.round === 3 ? "EXTRA EXPERIMENT" : `ROUND ${s.round + 1}`;
  $("round-title").textContent = r.title;
  $("round-description").textContent = r.description;
  $("auth-control").hidden = s.round !== 3;
  $("authenticate").checked = s.authenticate;
  $("stages").innerHTML = r.stages
    .map(
      (text, i) =>
        `<li class="${i < s.step ? "complete" : i === s.step ? "active" : ""}" ${i === s.step && !done ? 'aria-current="step"' : ""}><span>${i + 1}.</span>${esc(text)}</li>`,
    )
    .join("");
  $("scene-status").textContent = overviewActive
    ? done
      ? "■ 通信終了"
      : "Ⅱ 停止中"
    : done
      ? "■ この通信は終了"
      : "Ⅱ 相手に届く前で停止中";
  $("direction").textContent = overviewActive
    ? story.route.replace("あなたの中継機", "中継機")
    : story.route;
  $("scene").classList.toggle("reverse", s.phase === "public");
  $("alice-state").textContent = done
    ? "通信が終わったね"
    : s.phase === "public"
      ? "ボブの公開鍵を待ってるよ"
      : s.phase === "key"
        ? "共通鍵を届けたいな"
        : "暗号化した本文を送るよ";
  $("bob-state").textContent = s.result
    ? s.result.accepted
      ? "この本文を受け付けたよ"
      : "この通信は受け付けないよ"
    : s.phase === "public"
      ? "公開鍵を送るよ"
      : s.bobHasKey
        ? "鍵を持って、本文を待ってるよ"
        : "共通鍵を待ってるよ";
  const copied = s.inventory.some((a) => a.id === s.incoming.id);
  $("packet-short").textContent = story.packet;
  $("copy-indicator").textContent = done
    ? "通信終了"
    : copied
      ? "✓ 持ち物にコピー済み"
      : "到着・ここで停止";
  $("packet-sprite").classList.toggle("copied", copied);
  $("packet-title").textContent = s.incoming.label;
  $("packet-value").textContent = itemValue(s.incoming);
  $("situation-title").textContent = story.title;
  $("situation-text").textContent = story.text;
  $("goal-text").textContent = story.goal;
  $("capture").disabled =
    $("forward").disabled =
    $("open-replace").disabled =
      done;
  $("forward-label").textContent = done
    ? "この通信は終了"
    : `${story.recipient}に届ける`;
  $("forward-description").textContent = s.outgoing
    ? `すり替えたデータを${story.recipient}に送り、反応を見る。`
    : `中継機に届いた元のデータを${story.recipient}へ送る。`;
  $("outgoing-label").textContent = s.outgoing
    ? `${overviewActive ? s.outgoing.label : displayLabel(s.outgoing)}（すり替え中）`
    : `${s.incoming.label}（元のまま）`;
  $("restore").hidden = !s.outgoing || done;
  $("inventory-count").textContent = s.inventory.length;
  $("read-mark").textContent = s.read ? "✓" : "□";
  $("tamper-mark").textContent =
    s.result?.code === "attack-success" ? "✓" : "□";
  $("original-message").textContent = s.original || "未解読";
  const result = $("action-result");
  result.className = `action-result ${s.result ? (s.result.accepted ? "success" : "error") : feedbackError ? "error" : ""}`;
  const shortTitles = {
    "attack-success": s.read
      ? "盗聴・改ざんに成功"
      : "改ざんは受理・盗聴は未達成",
    "signature-rejected": "ボブが拒否：署名が不一致",
    authenticated: "公開鍵のすり替えを検出",
    "bad-public": "アリスが公開鍵を拒否",
    "bad-key": "ボブは共通鍵を取得できない",
    "bad-message": "ボブは本文を復号できない",
    "original-accepted": "ボブが本文を受理",
  };
  $("result-heading").textContent = overviewActive
    ? s.result
      ? shortTitles[s.result.code] || s.result.title
      : feedbackError
        ? "この操作はできなかった"
        : {
            copy: "中継機でコピーした！",
            replace: "送るデータを変更した",
            deliver: "相手にデータを届けた",
            tool: "道具を使った",
          }[lastAction] || "行動を選ぼう"
    : s.result?.title || resultHeading;
  $("feedback").textContent = overviewActive
    ? compactOutcome(s, lastAction, feedbackError)
    : s.result?.text || feedbackText;
  $("bob-result").innerHTML = s.result?.message
    ? `<p class="received" lang="en">${esc(overviewActive && Array.from(s.result.message).length > 12 ? Array.from(s.result.message).slice(0, 12).join("") + "…" : s.result.message)}</p>`
    : s.result?.hiddenMessage
      ? "<p>ボブは本文を読みましたが、あなたはまだ復号していないので表示されません。</p>"
      : "";
  $("result-tools").hidden = lastAction !== "copy";
  $("retry-result").hidden = !done;
  $("next-round").hidden = !done || s.round === 3;
  $("next-round").textContent =
    s.round === 2 ? "追加実験へ →" : "次のラウンドへ →";
  $("hint-text").textContent = hints[s.round][0];
  $("hint-detail").textContent = hints[s.round][1];
  $("log-count").textContent = `(${s.log.length})`;
  $("log-list").innerHTML = s.log
    .map((l) => `<li class="${l.kind}">${esc(l.text)}</li>`)
    .join("");
  renderTools(s);
  renderBriefPages();
  if (focusedItem)
    document
      .querySelector(`[data-item="${focusedItem}"]`)
      ?.focus({ preventScroll: true });
}
function renderTools(s) {
  Object.assign($("tools-dialog").dataset, {
    mode,
    round: String(s.round),
    lastTool,
    failed: String(feedbackError),
  });
  const keyItems = s.inventory.filter((a) => keyTypes.has(a.type)),
    dataItems = s.inventory.filter((a) => !keyTypes.has(a.type));
  if (!s.inventory.some((a) => a.id === selected)) selected = "";
  if (!keyItems.some((a) => a.id === selectedKey)) selectedKey = "";
  document.querySelector(".inventory-instruction").textContent =
    mode === "replace"
      ? "押すと、相手に送るデータとして選べます。"
      : mode === "wrap"
        ? "共通鍵は包む対象に、公開鍵は使う鍵に選べます。"
        : "暗号文は開く対象に、鍵は使う鍵に選べます。";
  $("key-count").textContent = `(${keyItems.length})`;
  $("data-count").textContent = `(${dataItems.length})`;
  $("keyring").innerHTML = keyItems.map(itemButton).join("");
  $("artifacts").innerHTML = dataItems.length
    ? dataItems.map(itemButton).join("")
    : '<p class="empty">まだありません。中継機に届いたデータをコピーすると、ここに残ります。</p>';
  const option = (a) =>
    `<option value="${a.id}">${esc(displayLabel(a))}${a.current === false ? "（以前の鍵）" : ""}</option>`;
  $("data-select").innerHTML =
    '<option value="">持ち物から選ぶ</option>' +
    s.inventory.map(option).join("");
  $("data-select").value = selected;
  $("key-select").innerHTML =
    '<option value="">使う鍵を選ぶ</option>' + keyItems.map(option).join("");
  $("key-select").value = selectedKey;
  const item = s.inventory.find((a) => a.id === selected);
  $("selected-description").textContent = describeItem(item);
  $("selected-preview").textContent = itemValue(item) || "まだ選んでいません。";
  document
    .querySelectorAll("[data-mode]")
    .forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.mode === mode)),
    );
  document
    .querySelectorAll("[data-tool-panel]")
    .forEach((p) => (p.hidden = p.dataset.toolPanel !== mode));
  $("tool-prompt").textContent = modeInfo[mode].prompt;
  $("data-field").hidden = mode === "message";
  $("key-field").hidden = mode === "replace";
  $("data-label").textContent = modeInfo[mode].data || "";
  $("key-label").textContent = modeInfo[mode].key || "";
  if ($("draft").value !== s.draft) $("draft").value = s.draft;
  $("signature-controls").hidden = s.round < 2;
  $("signature-choice").value = s.signatureChoice;
  $("signature-info").textContent = s.signature
    ? `手元にある署名：${s.signature.label}。本文を変えても、この署名は変わりません。`
    : "元の署名はまだ取り出していません。署名付きの本文を復号すると、署名も手元に残ります。";
  const plaintext = s.decryptResult
    ? s.decryptResult.kind === "key"
      ? `${s.decryptResult.label}を取得！ 持ち物の「鍵」に追加しました。`
      : s.decryptResult.label
    : "まだ復号していません。";
  const pageSize =
    $("game-console").dataset.layout === "narrow" &&
    $("game-console").dataset.density === "tiny"
      ? 30
      : 80;
  const pages = overviewActive
    ? paginateText(plaintext, pageSize)
    : [plaintext];
  decryptPage = Math.min(decryptPage, pages.length - 1);
  $("decrypt-result").textContent = pages[decryptPage];
  $("decrypt-pagination").hidden = pages.length < 2;
  $("decrypt-page-count").textContent = `${decryptPage + 1} / ${pages.length}`;
  $("decrypt-prev").disabled = decryptPage === 0;
  $("decrypt-next").disabled = decryptPage === pages.length - 1;
  $("edit-decrypted").hidden = s.decryptResult?.kind !== "message";
  const made = s.inventory.find((a) => a.id === createdId);
  $("created-card").hidden = !made;
  $("created-label").textContent = made ? displayLabel(made) : "";
  $("use-created").disabled = s.phase === "done";
  $("set-outgoing").disabled = s.phase === "done";
  $("tool-feedback").textContent = overviewActive
    ? $("game-console").dataset.density === "tiny"
      ? toolFeedback.split("。")[0] + "。"
      : paginateText(toolFeedback, 90)[0]
    : toolFeedback;
  $("tool-feedback").classList.toggle("error", feedbackError);
}
function setMode(value) {
  mode = value;
  setToolView("form");
  renderTools(lab.snapshot());
}
function showTools(value = "decrypt", source = document.activeElement) {
  opener = source;
  mode = value;
  setToolView("form");
  renderTools(lab.snapshot());
  const dialog = $("tools-dialog");
  if (!dialog.open) {
    if (typeof dialog.showModal === "function") dialog.showModal();
    else {
      dialog.setAttribute("open", "");
      dialog.classList.add("fallback-dialog");
      dialog.setAttribute("aria-modal", "true");
    }
  }
  document.body.classList.add("tools-open");
  $("feedback").setAttribute("aria-live", "off");
  $("close-tools").focus({ preventScroll: true });
}
function closeTools() {
  const dialog = $("tools-dialog");
  if (typeof dialog.close === "function") dialog.close();
  else dialog.removeAttribute("open");
  document.body.classList.remove("tools-open");
  $("feedback").setAttribute("aria-live", "polite");
  opener?.focus({ preventScroll: true });
}
function announceResult() {
  if (!overviewActive && !$("tools-dialog").open)
    $("action-result").scrollIntoView({ block: "nearest", behavior: "smooth" });
}
function act(
  operation,
  { heading = "行動してみた。", action = "tool", create = false, text } = {},
) {
  const response = operation(),
    s = lab.snapshot();
  feedbackError = response?.ok === false;
  feedbackText =
    text && !feedbackError ? text : response?.text || s.log.at(-1)?.text || "";
  toolFeedback = feedbackText;
  resultHeading = feedbackError
    ? "その組み合わせでは、うまくいかなかった。"
    : heading;
  lastAction = action;
  if (create && !response?.id) createdId = null;
  if (create && response?.id) {
    createdId = response.id;
    itemNotes.set(createdId, `自分で作成 ${++createdCount}`);
  }
  if ($("tools-dialog").open) {
    lastTool = mode;
    decryptPage = 0;
    setToolView("result");
  }
  render();
  announceResult();
  return response;
}
function restart(round, authenticate = $("authenticate").checked) {
  lab.start(round, authenticate);
  selected = "";
  selectedKey = "";
  createdId = null;
  itemNotes.clear();
  createdCount = 0;
  lastAction = "";
  lastTool = "";
  decryptPage = 0;
  feedbackError = false;
  resultHeading = "新しい通信が始まった。";
  feedbackText =
    "状況と目的を確かめて、行動を選ぼう。共通鍵は前の通信と別のものになった。";
  toolFeedback = "どの道具でも自由に試せます。";
  render();
}
function stageReplacement(id) {
  if (!id) {
    feedbackError = true;
    toolFeedback = "まず、相手に送るデータを持ち物から選んでください。";
    setToolView("result");
    renderTools(lab.snapshot());
    return;
  }
  const response = act(() => lab.setOutgoing(id), {
    heading: "送り出すデータを、入れ替えた。",
    action: "replace",
  });
  if (response?.ok) {
    closeTools();
    announceResult();
  }
}
$("start-game").addEventListener("click", () => {
  started = true;
  $("briefing").hidden = true;
  $("gameplay").hidden = false;
  $("round-title").focus({ preventScroll: true });
  if (!overviewActive)
    $("round-title").scrollIntoView({ block: "nearest", behavior: "smooth" });
});
$("help-button").addEventListener("click", () => {
  $("briefing").hidden = false;
  $("gameplay").hidden = true;
  $("start-game").textContent = started
    ? "▶ 通信画面に戻る"
    : "▶ 通信経路に入る";
  if (!overviewActive)
    $("briefing-title").scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
});
$("rounds").addEventListener("click", (e) => {
  const b = e.target.closest("[data-round]");
  if (b) restart(Number(b.dataset.round), true);
});
$("restart").addEventListener("click", () => restart(lab.snapshot().round));
$("retry-result").addEventListener("click", () => {
  restart(lab.snapshot().round);
  if (!overviewActive)
    $("round-title").scrollIntoView({ block: "nearest", behavior: "smooth" });
});
$("authenticate").addEventListener("change", () => restart(3));
$("capture").addEventListener("click", () => {
  const before = lab.snapshot();
  selected = before.incoming.id;
  itemNotes.set(selected, "経路からコピー");
  act(() => lab.capture(), {
    heading: "中継機のデータを、持ち物にコピーした！",
    action: "copy",
    text: `${before.incoming.label}を記録装置に写した。元のデータは中継機に残っていて、まだ相手には届いていない。「持ち物・道具」で調べられる。`,
  });
});
$("forward").addEventListener("click", () => {
  const before = lab.snapshot(),
    who = describeSituation(before).recipient;
  act(() => lab.forward(), {
    heading: `${who}にデータを届けた。`,
    action: "deliver",
  });
});
$("restore").addEventListener("click", () =>
  act(() => lab.setOutgoing(), {
    heading: "送るデータを、元のものに戻した。",
    action: "replace",
  }),
);
$("open-tools").addEventListener("click", () => showTools());
$("result-tools").addEventListener("click", () => showTools());
$("open-replace").addEventListener("click", () => showTools("replace"));
$("close-tools").addEventListener("click", closeTools);
$("tools-dialog").addEventListener("cancel", (e) => {
  e.preventDefault();
  closeTools();
});
$("tools-dialog").addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    closeTools();
    return;
  }
  if (e.key !== "Tab") return;
  const items = [
    ...$("tools-dialog").querySelectorAll(
      'button,select,textarea,summary,[tabindex="0"]',
    ),
  ].filter(
    (el) =>
      !el.disabled &&
      !el.closest("[hidden]") &&
      !el.closest("details:not([open]) :not(summary)"),
  );
  const first = items[0],
    last = items.at(-1);
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last?.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first?.focus();
  }
});
$("tool-modes").addEventListener("click", (e) => {
  const b = e.target.closest("[data-mode]");
  if (b) setMode(b.dataset.mode);
});
for (const id of ["keyring", "artifacts"])
  $(id).addEventListener("click", (e) => {
    const b = e.target.closest("[data-item]");
    if (b) {
      const item = lab
        .snapshot()
        .inventory.find((a) => a.id === b.dataset.item);
      if (itemTarget(item) === "key") selectedKey = item.id;
      else {
        selected = item.id;
        if (mode === "message") mode = "decrypt";
      }
      render();
    }
  });
$("data-select").addEventListener("change", (e) => {
  selected = e.target.value;
  renderTools(lab.snapshot());
});
$("key-select").addEventListener("change", (e) => {
  selectedKey = e.target.value;
});
$("decrypt").addEventListener("click", () =>
  act(() => lab.decrypt(selected, selectedKey), {
    heading: "選んだ鍵で、暗号文を開いてみた。",
  }),
);
$("edit-decrypted").addEventListener("click", () => {
  setMode("message");
  $("draft").focus();
});
$("wrap").addEventListener("click", () =>
  act(() => lab.wrapKey(selected, selectedKey), {
    heading: "共通鍵を包んだ、新しい暗号文を作った。",
    create: true,
  }),
);
$("encrypt").addEventListener("click", () =>
  act(() => lab.encryptMessage(selectedKey), {
    heading: "編集した本文を、暗号文にした。",
    create: true,
  }),
);
$("set-outgoing").addEventListener("click", () => stageReplacement(selected));
$("use-created").addEventListener("click", () => stageReplacement(createdId));
$("corrupt").addEventListener("click", () =>
  act(() => lab.corrupt(selected), {
    heading: "暗号文の一部を、直接書き換えた。",
    create: true,
  }),
);
$("draft").addEventListener("input", (e) => lab.edit(e.target.value));
$("signature-choice").addEventListener("change", (e) =>
  lab.chooseSignature(e.target.value),
);
$("next-round").addEventListener("click", () => {
  restart(Math.min(3, lab.snapshot().round + 1), true);
  if (!overviewActive)
    $("round-title").scrollIntoView({ block: "nearest", behavior: "smooth" });
});
function setToolView(view) {
  $("tools-dialog").dataset.view = view;
  $("tool-form-tab").setAttribute("aria-pressed", String(view === "form"));
  $("tool-result-tab").setAttribute("aria-pressed", String(view === "result"));
}
function renderBriefPages() {
  document
    .querySelectorAll("[data-brief-page]")
    .forEach((el) =>
      el.classList.toggle(
        "is-selected",
        Number(el.dataset.briefPage) === briefPage,
      ),
    );
  document
    .querySelectorAll("[data-brief]")
    .forEach((el) =>
      el.setAttribute(
        "aria-pressed",
        String(Number(el.dataset.brief) === briefPage),
      ),
    );
}
function infoContent() {
  const s = lab.snapshot(),
    story = describeSituation(s);
  return {
    situation: [
      story.text,
      story.goal,
      rounds[s.round].description,
      `中継機にあるもの：${s.incoming.label}\n${itemValue(s.incoming)}`,
    ],
    result: [
      ...(s.result?.message
        ? [`ボブが受理した本文：\n${s.result.message}`]
        : []),
      s.result?.text || feedbackText,
    ],
    hint: hints[s.round],
    log: s.log.map((entry, i) => `${i + 1}. ${entry.text}`),
    tool: [
      ...(s.decryptResult?.kind === "message" ? [s.decryptResult.label] : []),
      toolFeedback,
      modeInfo[mode].prompt,
      describeItem(s.inventory.find((a) => a.id === selected)),
    ],
  }[infoTopic];
}
function buildInfoPages() {
  const width =
    $("info-dialog").clientWidth || document.defaultView.innerWidth - 24;
  const height =
    $("info-dialog").clientHeight || document.defaultView.innerHeight - 24;
  const limit = Math.max(
    45,
    Math.min(
      160,
      Math.floor((width - 60) / 14) *
        Math.max(2, Math.floor((height - 190) / 24)),
    ),
  );
  infoPages = infoContent().flatMap((text) => paginateText(text, limit));
  infoPage = Math.min(infoPage, infoPages.length - 1);
  renderInfoPage();
}
function renderInfoPage() {
  $("info-title").textContent = {
    situation: "場面の詳しい説明",
    result: "結果と仕組み",
    hint: "考えるヒント",
    log: "行動の記録",
    tool: "道具の詳しい説明",
  }[infoTopic];
  $("info-text").textContent = infoPages[infoPage];
  $("info-count").textContent = `${infoPage + 1} / ${infoPages.length}`;
  $("info-prev").disabled = infoPage === 0;
  $("info-next").disabled = infoPage === infoPages.length - 1;
  document
    .querySelectorAll("[data-info]")
    .forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.info === infoTopic),
      ),
    );
}
function openInfo(topic) {
  infoOpener = document.activeElement;
  infoTopic = topic;
  infoPage = 0;
  const dialog = $("info-dialog");
  if (!dialog.open) {
    if (typeof dialog.showModal === "function") dialog.showModal();
    else {
      dialog.setAttribute("open", "");
      dialog.classList.add("fallback-dialog");
      dialog.setAttribute("aria-modal", "true");
    }
  }
  document.body.classList.add("tools-open");
  buildInfoPages();
  $("close-info").focus({ preventScroll: true });
}
function closeInfo() {
  const dialog = $("info-dialog");
  if (typeof dialog.close === "function") dialog.close();
  else dialog.removeAttribute("open");
  if (!$("tools-dialog").open) document.body.classList.remove("tools-open");
  infoOpener?.focus({ preventScroll: true });
}
$("brief-tabs").addEventListener("click", (event) => {
  const button = event.target.closest("[data-brief]");
  if (button) {
    briefPage = Number(button.dataset.brief);
    renderBriefPages();
  }
});
$("open-info").addEventListener("click", () => openInfo("situation"));
$("situation-details").addEventListener("click", () => openInfo("situation"));
$("result-details").addEventListener("click", () => openInfo("result"));
$("tool-details").addEventListener("click", () => openInfo("tool"));
$("close-info").addEventListener("click", closeInfo);
$("info-dialog").addEventListener("cancel", (event) => {
  event.preventDefault();
  closeInfo();
});
$("info-dialog").addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    closeInfo();
    return;
  }
  if (event.key !== "Tab") return;
  const items = [...$("info-dialog").querySelectorAll("button")].filter(
    (el) => !el.disabled,
  );
  if (event.shiftKey && document.activeElement === items[0]) {
    event.preventDefault();
    items.at(-1)?.focus();
  } else if (!event.shiftKey && document.activeElement === items.at(-1)) {
    event.preventDefault();
    items[0]?.focus();
  }
});
$("info-topics").addEventListener("click", (event) => {
  const button = event.target.closest("[data-info]");
  if (button) {
    infoTopic = button.dataset.info;
    infoPage = 0;
    buildInfoPages();
  }
});
$("info-prev").addEventListener("click", () => {
  if (infoPage > 0) {
    infoPage--;
    renderInfoPage();
  }
});
$("info-next").addEventListener("click", () => {
  if (infoPage < infoPages.length - 1) {
    infoPage++;
    renderInfoPage();
  }
});
$("tool-form-tab").addEventListener("click", () => setToolView("form"));
$("tool-result-tab").addEventListener("click", () => setToolView("result"));
$("back-tool-form").addEventListener("click", () => setToolView("form"));
$("decrypt-prev").addEventListener("click", () => {
  decryptPage = Math.max(0, decryptPage - 1);
  renderTools(lab.snapshot());
});
$("decrypt-next").addEventListener("click", () => {
  decryptPage++;
  renderTools(lab.snapshot());
});
createDisplayController({
  document,
  target: $("game-console"),
  button: $("fullscreen"),
  announce: (text) => ($("display-status").textContent = text),
  onChange: (active) => {
    overviewActive = active;
    render();
    if ($("info-dialog").open) buildInfoPages();
  },
});
render();

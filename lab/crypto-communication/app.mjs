import { createLab, rounds } from "./model.mjs";
import { describeSituation, describeItem } from "./presentation.mjs";
import { createDisplayController } from "./display.mjs";
import {
  introFrames,
  roundFrames,
  decisionFrame,
  forwardFrames,
  operationFrames,
  createStoryPlayer,
  packetName,
  englishNames,
} from "./storyboard.mjs";
import {
  compactStory,
  compactOutcome,
  paginateText,
} from "./screen-layout.mjs";
const lab = createLab();
const $ = (id) => document.getElementById(id);
function snapshot() {
  const raw = lab.snapshot();
  const item = (a) => (a ? { ...a, label: englishNames(a.label) } : a);
  return {
    ...raw,
    incoming: item(raw.incoming),
    outgoing: item(raw.outgoing),
    inventory: raw.inventory.map(item),
    publicForAlice: item(raw.publicForAlice),
    signature: item(raw.signature),
    decryptResult:
      raw.decryptResult?.kind === "key"
        ? { ...raw.decryptResult, label: englishNames(raw.decryptResult.label) }
        : raw.decryptResult,
    result: raw.result
      ? {
          ...raw.result,
          title: englishNames(raw.result.title),
          text: englishNames(raw.result.text),
        }
      : null,
    log: raw.log.map((entry) => ({ ...entry, text: englishNames(entry.text) })),
  };
}
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
  lastAction = "",
  opener = null;
let resultHeading = "まだ行動していない。",
  feedbackText = "状況と目的を読んで、行動を一つ選んでみよう。",
  feedbackError = false;
let toolFeedback = "道具を選び、自由に組み合わせを試せます。";
let overviewActive = false,
  lastTool = "",
  decryptPage = 0;
let infoTopic = "situation",
  infoPage = 0,
  infoPages = [],
  infoOpener = null;
const storyPlayer = createStoryPlayer();
let pendingToolFrames = [],
  draftEdited = false;
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
  const s = snapshot(),
    r = rounds[s.round],
    story = overviewActive
      ? { ...describeSituation(s), ...compactStory(s) }
      : describeSituation(s),
    done = s.phase === "done";
  if (
    s.result &&
    (!storyPlayer.active() || storyPlayer.current()?.revealOutcome)
  )
    visits.add(s.round);
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
  $("situation-text").textContent = englishNames(story.text);
  $("goal-text").textContent = englishNames(story.goal);
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
  $("hint-text").textContent = englishNames(hints[s.round][0]);
  $("hint-detail").textContent = englishNames(hints[s.round][1]);
  $("log-count").textContent = `(${s.log.length})`;
  $("log-list").innerHTML = s.log
    .map((l) => `<li class="${l.kind}">${esc(l.text)}</li>`)
    .join("");
  renderTools(s);
  renderNarrative(s);
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
  $("selected-description").textContent = englishNames(describeItem(item));
  $("selected-preview").textContent = itemValue(item) || "まだ選んでいません。";
  document
    .querySelectorAll("[data-mode]")
    .forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.mode === mode)),
    );
  document
    .querySelectorAll("[data-tool-panel]")
    .forEach((p) => (p.hidden = p.dataset.toolPanel !== mode));
  $("tool-prompt").textContent = englishNames(modeInfo[mode].prompt);
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
  renderTools(snapshot());
}
function showTools(value = "decrypt", source = document.activeElement) {
  opener = source;
  draftEdited = false;
  mode = value;
  setToolView("form");
  renderTools(snapshot());
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
  if (
    draftEdited &&
    !pendingToolFrames.some((frame) => frame.scene === "edit")
  ) {
    const base = decisionFrame(snapshot());
    pendingToolFrames.push({
      ...base,
      speaker: "charlie",
      text: "作業台の本文を書き換えた。まだ新しい暗号文にはしていない。送るものを変えるかは、これから決める。",
      scene: "edit",
      at: "charlie",
    });
  }
  draftEdited = false;
  if (pendingToolFrames.length) {
    storyPlayer.play(pendingToolFrames);
    pendingToolFrames = [];
    render();
    $("dialogue-next").focus({ preventScroll: true });
  } else opener?.focus({ preventScroll: true });
}
function announceResult() {
  if (!overviewActive && !$("tools-dialog").open)
    $("action-result").scrollIntoView({ block: "nearest", behavior: "smooth" });
}
function act(
  operation,
  { heading = "行動してみた。", action = "tool", create = false, text } = {},
) {
  const before = snapshot();
  const keyLabel =
    before.inventory.find((item) => item.id === selectedKey)?.label || "";
  const dataLabel =
    before.inventory.find((item) => item.id === selected)?.label || "";
  const response = operation(),
    s = snapshot();
  feedbackError = response?.ok === false;
  feedbackText =
    text && !feedbackError ? text : response?.text || s.log.at(-1)?.text || "";
  toolFeedback = englishNames(feedbackText);
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
  if (action === "deliver") storyPlayer.play(forwardFrames(before, s));
  else {
    const frames = operationFrames({
      before,
      after: s,
      action,
      mode,
      ok: response?.ok !== false,
      keyLabel,
      dataLabel,
    });
    if ($("tools-dialog").open) pendingToolFrames.push(...frames);
    else storyPlayer.play(frames);
  }
  render();
  announceResult();
  return response;
}
function restart(round, authenticate = $("authenticate").checked) {
  lab.start(round, authenticate);
  pendingToolFrames = [];
  draftEdited = false;
  storyPlayer.play(roundFrames(snapshot()));
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
    renderTools(snapshot());
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
$("help-button").addEventListener("click", () => {
  pendingToolFrames = [];
  storyPlayer.play([
    ...introFrames(),
    {
      ...decisionFrame(snapshot()),
      text: "導入はここまで。実験の状態は変えていない。今の通信に戻ろう。",
    },
  ]);
  render();
});
$("rounds").addEventListener("click", (e) => {
  const b = e.target.closest("[data-round]");
  if (b) restart(Number(b.dataset.round), true);
});
$("restart").addEventListener("click", () => restart(snapshot().round));
$("retry-result").addEventListener("click", () => {
  restart(snapshot().round);
  if (!overviewActive)
    $("round-title").scrollIntoView({ block: "nearest", behavior: "smooth" });
});
$("authenticate").addEventListener("change", () => restart(3));
$("capture").addEventListener("click", () => {
  const before = snapshot();
  selected = before.incoming.id;
  itemNotes.set(selected, "経路からコピー");
  act(() => lab.capture(), {
    heading: "中継機のデータを、持ち物にコピーした！",
    action: "copy",
    text: `${before.incoming.label}を記録装置に写した。元のデータは中継機に残っていて、まだ相手には届いていない。「持ち物・道具」で調べられる。`,
  });
});
$("forward").addEventListener("click", () => {
  const before = snapshot(),
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
      el.getClientRects().length > 0 &&
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
  renderTools(snapshot());
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
$("draft").addEventListener("input", (e) => {
  draftEdited = true;
  lab.edit(e.target.value);
});
$("signature-choice").addEventListener("change", (e) =>
  lab.chooseSignature(e.target.value),
);
$("next-round").addEventListener("click", () => {
  restart(Math.min(3, snapshot().round + 1), true);
  if (!overviewActive)
    $("round-title").scrollIntoView({ block: "nearest", behavior: "smooth" });
});
function setToolView(view) {
  $("tools-dialog").dataset.view = view;
  $("tool-form-tab").setAttribute("aria-pressed", String(view === "form"));
  $("tool-result-tab").setAttribute("aria-pressed", String(view === "result"));
}
function infoContent() {
  const s = snapshot(),
    story = describeSituation(s);
  const waitingForVerdict = Boolean(
    s.result && storyPlayer.active() && !storyPlayer.current()?.revealOutcome,
  );
  return {
    situation: [
      storyPlayer.current()?.text || englishNames(story.text),
      englishNames(story.goal),
      englishNames(rounds[s.round].description),
      `中継機にあるもの：${s.incoming.label}\n${itemValue(s.incoming)}`,
    ],
    result: waitingForVerdict
      ? [
          "まだ受信側が処理を進めているところです。「次へ」で会話を進めて結果を確かめましょう。",
        ]
      : [
          ...(s.result?.message
            ? [`ボブが受理した本文：\n${s.result.message}`]
            : []),
          s.result?.text || feedbackText,
        ],
    hint: hints[s.round].map(englishNames),
    log: waitingForVerdict
      ? ["会話が進むと、最新の受信結果も記録に表示されます。"]
      : s.log.map((entry, i) => `${i + 1}. ${entry.text}`),
    tool: [
      ...(s.decryptResult?.kind === "message" ? [s.decryptResult.label] : []),
      toolFeedback,
      englishNames(modeInfo[mode].prompt),
      englishNames(describeItem(s.inventory.find((a) => a.id === selected))),
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
  renderTools(snapshot());
});
$("decrypt-next").addEventListener("click", () => {
  decryptPage++;
  renderTools(snapshot());
});
function renderNarrative(s) {
  const talking = storyPlayer.active(),
    frame = storyPlayer.current() || decisionFrame(s);
  const position = storyPlayer.position(),
    names = {
      alice: "Alice",
      bob: "Bob",
      charlie: "Charlie",
      narrator: "ナレーション",
    };
  const scene = $("scene");
  Object.assign(scene.dataset, {
    frame: frame.scene,
    at: frame.at || "relay",
    connected: String(frame.connected !== false),
    speaker: frame.speaker,
  });
  $("game-console").dataset.talking = String(talking);
  const route =
    frame.route ||
    (frame.connected === false
      ? "Alice → Bob"
      : (frame.phase || s.phase) === "public" ||
          (s.phase === "done" && frame.at === "alice")
        ? "Bob → 中継機 → Alice"
        : "Alice → 中継機 → Bob");
  $("direction").textContent = route;
  scene.classList.toggle(
    "reverse",
    route.startsWith("Bob") || route.endsWith("Alice"),
  );
  $("scene-status").textContent = talking
    ? "▶ 会話に合わせて進行"
    : s.phase === "done"
      ? "■ 通信終了"
      : "Ⅱ ここで自由に介入";
  const kind = frame.kind || "none";
  const recorded =
    !talking && s.inventory.some((item) => item.id === s.incoming.id);
  $("packet-sprite").dataset.kind = kind;
  $("packet-short").textContent = frame.packetLabel || packetName(kind);
  $("packet-title").textContent =
    frame.packetLabel || packetName(kind) || "まだ送信していない";
  $("packet-value").textContent =
    !talking && frame.at === "relay"
      ? itemValue(s.outgoing || s.incoming)
      : "会話が進むと、経路上のデータを調べられます。";
  $("copy-indicator").textContent =
    frame.scene === "copy" || recorded
      ? "コピー済・相手へ未配達"
      : frame.at === "alice"
        ? "Aliceの手元"
        : frame.at === "bob"
          ? "Bobの手元"
          : frame.at === "charlie"
            ? "Charlieの作業台"
            : "中継機で停止";
  $("packet-sprite").classList.toggle(
    "copied",
    frame.scene === "copy" || recorded,
  );
  const phase = frame.phase || s.phase;
  const currentStep =
    phase === "done"
      ? s.step
      : s.round === 0
        ? phase === "message"
          ? 1
          : 0
        : phase === "public"
          ? 0
          : phase === "key"
            ? 1
            : 2;
  $("stages").innerHTML = rounds[s.round].stages
    .map(
      (label, index) =>
        `<li class="${index < currentStep ? "complete" : index === currentStep ? "active" : ""}"><span>${index + 1}.</span>${esc(label)}</li>`,
    )
    .join("");
  const titles = {
    direct: "AliceからBobへ、秘密の通信",
    watch: "Charlieのたくらみ",
    setup: "通信経路の中継機を掌握",
    relay: "中継機でできること",
    sign: "Aliceが本文に署名する",
    verify: "Bobが署名を確かめる",
    authenticate: "公開鍵の持ち主を確かめる",
    wrap:
      frame.speaker === "alice"
        ? "Aliceが共通鍵を包む"
        : "Charlieが鍵を包み直す",
    encrypt: "Aliceが本文を暗号化する",
    delivering: "Charlieが選んだデータを届ける",
    copy: "Charlieがデータをコピーする",
    decrypt:
      frame.at === "bob" ? "Bobが届いたデータを開く" : "Charlieが復号を試す",
    edit: "Charlieが本文・暗号文を編集",
    question: "この組み合わせでは開けない",
    accept: "受信結果：受理",
    reject: "受信結果：拒否",
    "alice-key": "Aliceが共通鍵を用意",
    "bob-key": "Bobが共通鍵を受け取る",
    "bob-public": "Bobが公開鍵を送る",
    inbound: "データが中継機に到着",
    intercept:
      phase === "public"
        ? "公開鍵をAliceへ届ける場面"
        : phase === "key"
          ? "共通鍵をBobへ届ける場面"
          : "本文をBobへ届ける場面",
  };
  $("situation-title").textContent = titles[frame.scene] || "通信を観察しよう";
  $("situation-text").textContent = frame.text;
  $("goal-text").textContent = frame.goal || englishNames(compactStory(s).goal);
  $("alice-state").textContent =
    frame.speaker === "alice"
      ? {
          sign: "秘密鍵で署名するよ",
          wrap: "公開鍵で鍵を包むよ",
          encrypt: "共通鍵で暗号化するよ",
          authenticate: "指紋を照合するよ",
        }[frame.scene] || "Bobにだけ送りたいな"
      : "Alice側の回線";
  $("bob-state").textContent =
    frame.speaker === "bob"
      ? {
          verify: "Aliceの鍵で署名を検証",
          decrypt: "届いた暗号文を復号",
          accept: "受け付けたよ",
          reject: "受け付けないよ",
          "bob-public": "僕の公開鍵を送るよ",
          "bob-key": "鍵を受け取ったよ",
        }[frame.scene] || "通信を待っているよ"
      : "Bob側の回線";
  $("charlie-state").textContent =
    {
      copy: "記録装置にコピー",
      decrypt: "手元の鍵で復号",
      edit: "作業台で編集",
      wrap: "公開鍵で包み直す",
      setup: "経路の中継機を掌握",
      intercept: "ここで時間を止める",
      watch: "秘密を盗み見たい",
    }[frame.scene] || "中継機を操作する";
  const heading = $("result-heading");
  heading.dataset.speaker = frame.speaker;
  const name = names[frame.speaker];
  heading.innerHTML =
    frame.speaker === "narrator"
      ? name
      : `<span class="name-initial">${name[0]}</span>${name.slice(1)}`;
  $("speaker-sprite").setAttribute("href", `./characters.svg#${frame.speaker}`);
  $("dialogue-label").textContent = talking ? "DIALOGUE" : "YOUR TURN";
  $("feedback").textContent = frame.text;
  $("action-result").className = "action-result dialogue-box";
  $("bob-result").hidden = !frame.revealOutcome;
  $("tamper-mark").textContent =
    frame.revealOutcome && s.result?.code === "attack-success" ? "✓" : "□";
  for (const id of ["capture", "open-tools", "open-replace", "forward"])
    $(id).disabled = talking || (s.phase === "done" && id !== "open-tools");
  $("restore").hidden = talking || !s.outgoing || s.phase === "done";
  if (talking)
    $("outgoing-label").textContent =
      frame.badge || "会話の後で、送り出すデータを選べます";
  $("command-label").textContent = talking
    ? "下の「次へ」で会話を進めよう"
    : "Charlieの行動を選ぶ";
  $("dialogue-position").textContent = talking
    ? `${position.index + 1} / ${position.total}`
    : s.phase === "done"
      ? "実験の結果"
      : "ここで自由に介入";
  $("dialogue-next").hidden = !talking && s.phase !== "done";
  $("dialogue-next").textContent = talking
    ? position.index + 1 < position.total
      ? "次へ ▶"
      : s.phase === "done"
        ? "結果を確認 ▶"
        : "行動を選ぶ ▶"
    : s.round < 3
      ? "次のラウンド ▶"
      : "もう一度 ▶";
  $("dialogue-previous").hidden = !talking;
  $("dialogue-previous").disabled = position.index === 0;
  $("skip-story").hidden = !talking;
  $("dialogue-retry").hidden = talking || s.phase !== "done";
  $("dialogue-next-round").hidden =
    talking || s.phase !== "done" || s.round === 3;
}
$("dialogue-next").addEventListener("click", () => {
  if (storyPlayer.active()) storyPlayer.next();
  else if (snapshot().phase === "done")
    restart(Math.min(3, snapshot().round + 1), true);
  render();
});
$("dialogue-previous").addEventListener("click", () => {
  storyPlayer.previous();
  render();
});
$("skip-story").addEventListener("click", () => {
  storyPlayer.skip();
  render();
});
$("dialogue-retry").addEventListener("click", () => restart(snapshot().round));
$("dialogue-next-round").addEventListener("click", () =>
  restart(Math.min(3, snapshot().round + 1), true),
);
$("game-console").addEventListener("keydown", (event) => {
  if (
    !storyPlayer.active() ||
    document.querySelector("dialog[open]") ||
    !["Enter", " "].includes(event.key) ||
    event.repeat
  )
    return;
  if (event.target.closest("button,input,textarea,select,summary,a")) return;
  event.preventDefault();
  storyPlayer.next();
  render();
});
storyPlayer.play([...introFrames(), ...roundFrames(snapshot())]);
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

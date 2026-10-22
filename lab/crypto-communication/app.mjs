import { createQuest } from "./quest.mjs?v=20";
import { rounds } from "./model.mjs?v=22";
import {
  frame,
  introFrames,
  roundFrames,
  createStoryPlayer,
  packetName,
  englishNames,
  lesson,
} from "./storyboard.mjs?v=19";
import { createDisplayController } from "./display.mjs";
import { createNarrationHistory } from "./narration-history.mjs?v=1";
import { explanations } from "./explanations.mjs?v=8";
const $ = (id) => document.getElementById(id);
const quest = createQuest(),
  story = createStoryPlayer();
const esc = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
let previousChoice = null,
  previousTrigger = null,
  infoTopic = "mechanism",
  infoOpener = null;
let keyPage = 0;
let shownKey = "未取得",
  shownCount = 0,
  shownOriginal = null;
// Narration pages include the situation and question beside the action choices.
// Back restores that page's protocol state so the learner can choose again.
const narrationHistory = createNarrationHistory({
  capture: captureScreen,
  restore: restoreScreen,
});
let storyBatch = 0,
  actionSequence = 0;
function captureScreen() {
  return {
    restore: quest.checkpoint(),
    story: story.checkpoint(),
    keyPage,
    shownKey,
    shownCount,
    shownOriginal,
    previousChoice,
    storyBatch,
    actionSequence,
  };
}
function restoreScreen(saved) {
  saved.restore();
  story.restore(saved.story);
  ({
    keyPage,
    shownKey,
    shownCount,
    shownOriginal,
    previousChoice,
    storyBatch,
    actionSequence,
  } = saved);
}
function visibleNarration(s = quest.view()) {
  if (story.active())
    return {
      key: "story:" + storyBatch + ":" + story.position().index,
    };
  if (s.selectingKey || s.pending) return null;
  if (s.feedback && !s.feedback.inline && s.feedback.explanation)
    return {
      key: "answer:" + actionSequence,
    };
  return {
    key: JSON.stringify([
      s.count,
      s.round,
      s.phase,
      s.state,
      s.incoming?.id,
      s.outgoing?.id,
      s.prompt,
      s.choices.map((choice) => choice.id),
    ]),
  };
}
function recordNarration(s) {
  narrationHistory.record(visibleNarration(s)?.key);
}
function canGoBack() {
  return narrationHistory.canGoBack(visibleNarration()?.key);
}
function goBack() {
  if (!narrationHistory.back(visibleNarration()?.key)) return;
  render();
  focusCurrentControl();
}
function focusCurrentControl() {
  const target = !$("dialogue-next").hidden
    ? $("dialogue-next")
    : document.querySelector("[data-key]") ||
      document.querySelector("[data-action]") ||
      (!$("key-picker").hidden ? $("key-back") : null);
  target?.focus({ preventScroll: true });
}
function execute() {
  actionSequence++;
  const action = quest.view().pending?.id;
  const frames = quest.confirm();
  if (frames.length) play(frames);
  else if (action === "continue" && playKeyPreparation()) return;
  else {
    render();
    focusCurrentControl();
  }
}
function play(frames) {
  storyBatch++;
  story.play(frames);
  render();
  $("dialogue-next").focus({ preventScroll: true });
}
function playKeyPreparation() {
  const s = quest.view();
  if (s.selectingKey?.stage !== "wrapping") return false;
  const key = s.payloadKey;
  play([
    frame(
      "Charlieは、" +
        englishNames(key.label) +
        "をBobへ" +
        (s.selectingKey.action === "inject-key" ? "送る" : "転送する") +
        "前に暗号化する。",
      "question",
      {
        at: "charlie",
        phase: "key",
        kind: "key",
        packet: key,
      },
    ),
  ]);
  return true;
}
function render() {
  const s = quest.view(),
    talking = story.active(),
    correctAnswer =
      !talking && Boolean(s.feedback?.correct && !s.feedback?.inline),
    f = story.current() || s.feedbackFrame || s.displayFrame;
  const done = s.phase === "done",
    visibleResult = done && (!talking || f.revealOutcome);
  const pending = Boolean(s.pending);
  const picking = Boolean(s.selectingKey);
  if (s.count !== shownCount) {
    shownCount = s.count;
    shownKey = "未取得";
    shownOriginal = null;
  }
  const recordVisible =
    !talking ||
    f.scene === "inbound" ||
    f.showPlaintext ||
    (["replace", "decrypt", "wrap", "question"].includes(f.scene) &&
      f.at !== "alice");
  if (s.read && (!talking || f.showPlaintext || f.revealOutcome))
    shownOriginal = s.original;
  if (!s.read) shownOriginal = null;
  const plaintextVisible = Boolean(shownOriginal);
  const tone = talking ? f.tone || "" : s.tone;
  $("action-result").dataset.tone = tone === "correct" ? "" : tone;
  document.querySelector(".command-box").dataset.tone = tone;
  Object.assign($("game-console").dataset, {
    talking: String(talking),
    pending: String(pending),
    pickingKey: String(picking),
    feedback: String(Boolean(s.feedback)),
  });
  document.querySelectorAll("[data-round]").forEach((button) => {
    if (Number(button.dataset.round) === s.round)
      button.setAttribute("aria-current", "step");
    else button.removeAttribute("aria-current");
  });
  $("round-number").textContent = "ROUND " + (s.round + 1);
  $("round-title").textContent = rounds[s.round].title;
  $("round-description").textContent = rounds[s.round].description;
  $("ca-authority").hidden = $("browser-trust").hidden = s.round < 2;
  $("ca-authority").dataset.active = String(
    ["ca-request", "ca-issue", "ca-response"].includes(f.scene),
  );
  $("browser-trust").dataset.active = String(
    ["trust-root", "ca-verify"].includes(f.scene),
  );
  const phase = f.phase || s.phase;
  const stages = rounds[s.round].stages;
  const step =
    f.stage ??
    (phase === "done"
      ? stages.length
      : ["signing-public", "signing-setup", "ca-setup"].includes(phase)
        ? 0
        : (s.round >= 2 ? 1 : 0) +
          (s.round === 0
            ? phase === "message"
              ? 1
              : 0
            : phase === "public"
              ? 0
              : phase === "key"
                ? 1
                : 2));
  $("stages").innerHTML = stages
    .map(
      (text, index) =>
        '<li class="' +
        (index < step ? "complete" : index === step ? "active" : "") +
        '"><span>' +
        (index + 1) +
        ".</span>" +
        esc(text) +
        "</li>",
    )
    .join("");
  Object.assign($("scene").dataset, {
    frame: f.scene,
    at: f.at,
    connected: String(f.connected !== false),
    speaker: f.speaker,
    ca: String(s.round >= 2),
  });
  const route =
    f.route ||
    (f.connected === false
      ? "Alice → Bob"
      : phase === "public"
        ? "Bob → 中継機 → Alice"
        : "Alice → 中継機 → Bob");
  $("direction").textContent = route;
  $("scene").classList.toggle("reverse", route.startsWith("Bob"));
  $("scene-status").textContent = talking
    ? "▶ 通信の様子"
    : done
      ? "■ 通信終了"
      : "Ⅱ 転送前で停止";
  const visiblePacket =
    f.packet || (!talking ? s.outgoing || s.incoming : null);
  const signatureOwner = Object.hasOwn(f, "signatureOwner")
    ? f.signatureOwner
    : s.round === 3 && f.kind === "wrapped-key"
      ? visiblePacket?.id === s.outgoing?.id
        ? s.outgoingSignature?.owner
        : visiblePacket?.id === s.incoming?.id
          ? s.incomingSignature?.owner
          : null
      : null;
  const signed =
    s.round === 3 &&
    f.kind === "wrapped-key" &&
    (Boolean(signatureOwner) || f.scene === "sign-key");
  const tagged =
    f.kind === "ciphertext" &&
    Boolean(
      f.authenticationTag ??
      (visiblePacket?.authenticated ||
        (visiblePacket?.id === s.outgoing?.id
          ? s.outgoingTag
          : visiblePacket?.id === s.incoming?.id
            ? s.incomingTag
            : false)),
    );
  const visualKind = f.kind;
  $("packet-sprite").dataset.kind = visualKind;
  $("packet-sprite").dataset.signed = String(signed);
  $("packet-sprite").dataset.tagged = String(tagged);
  $("signature-attachment").hidden = !signed;
  $("authentication-tag-attachment").hidden = !tagged;
  $("signature-note").textContent =
    f.scene === "sign-key"
      ? (signatureOwner === "charlie" ? "Charlie" : "Alice") + "の秘密鍵で作成"
      : "共通鍵の配送を認証";
  $("signature-owner").textContent =
    signatureOwner === "charlie" ? "Charlieの電子署名" : "Aliceの電子署名";
  $("packet-protection").hidden = !signed && !tagged;
  $("packet-protection").textContent = signed
    ? "鍵配送の署名"
    : tagged
      ? "本文の認証タグ"
      : "";
  $("packet-protection").title = signed
    ? $("signature-owner").textContent + "で鍵配送を認証"
    : tagged
      ? "認証タグで本文の変更を検出"
      : "";
  const shapes = {
    key: "key",
    public: "public",
    certificate: "certificate",
    "root-key": "browser-root",
    "verify-key": "public",
    "wrapped-key": "wrapped",
    ciphertext: "encrypted",
    letter: "message",
    signature: "signature",
  };
  $("packet-icon").setAttribute(
    "href",
    "./packets.svg?v=2#" + (shapes[visualKind] || "message"),
  );
  const packetLabel =
    f.packetLabel || englishNames(visiblePacket?.label) || packetName(f.kind);
  const keyName = englishNames(visiblePacket?.label) || packetLabel;
  const keyLabel = {
    key: keyName,
    public: keyName,
    certificate: keyName.replace("のCA登録済の公開鍵", "の公開鍵"),
    "verify-key": keyName.replace("の検証用公開鍵", "の公開鍵"),
    "wrapped-key": "共通鍵の暗号文",
  }[f.kind];
  $("packet-short").textContent = keyLabel || "";
  $("packet-sprite").dataset.keyLabel = String(Boolean(keyLabel));
  $("packet-title").textContent = packetLabel || "通信の準備中";
  $("packet-sprite").setAttribute(
    "aria-label",
    (packetLabel || "通信の準備中") +
      (signed ? "、" + $("signature-owner").textContent + "付き" : "") +
      (tagged ? "、認証タグ付き" : ""),
  );
  $("packet-context").textContent = f.at?.startsWith("ca-")
    ? "認証局 CAでの手続き"
    : f.at === "none" && f.scene === "trust-root"
      ? "ブラウザ内の信頼設定"
      : f.at === "alice"
        ? "Aliceの手元"
        : f.at === "bob"
          ? "Bobの手元"
          : "Charlieの中継機";
  $("packet-value").textContent =
    visiblePacket?.token ||
    visiblePacket?.fingerprint ||
    (f.kind === "letter" ? "本文は未解読" : packetLabel || "通信の準備中");
  $("packet-sprite").dataset.packetId = visiblePacket?.id || "";
  const actionHeading = picking
    ? s.selectingKey.title
    : done
      ? "通信の結果"
      : "Charlieの行動";
  $("command-label").textContent = talking
    ? "ナレーション"
    : s.feedback?.inline
      ? "○ 正解 · " + actionHeading
      : s.feedback
        ? s.feedback.correct
          ? "○ 正解"
          : "× 誤答"
        : actionHeading;
  $("answer-explanation").hidden = talking || !s.feedback?.explanation;
  $("answer-explanation").textContent =
    !talking && s.feedback ? s.feedback.explanation : "";
  $("key-operation-context").hidden =
    talking || !picking || !s.selectingKey.context;
  $("key-operation-context").textContent = picking
    ? s.selectingKey.context
    : "";
  $("key-back").textContent = "← 戻る";
  $("choice-list").hidden = talking || pending || picking || correctAnswer;
  $("key-picker").hidden = talking || pending || !picking;
  $("choice-list").innerHTML =
    talking || pending || picking || correctAnswer
      ? ""
      : s.choices
          .map(
            (action, index) =>
              '<button type="button" class="command" data-action="' +
              action.id +
              '"><span class="command-icon" aria-hidden="true">' +
              (index + 1) +
              "</span><span><strong>" +
              esc(action.label) +
              "</strong><small>" +
              esc(action.detail) +
              '</small></span><i aria-hidden="true">›</i></button>',
          )
          .join("");
  const size =
    $("game-console").classList.contains("is-viewport") &&
    ($("game-console").dataset.density === "tiny" ||
      ($("game-console").dataset.layout === "narrow" &&
        $("game-console").dataset.density === "compact"))
      ? 2
      : 6;
  const keys = s.selectingKey?.keys || [];
  const pageCount = Math.max(1, Math.ceil(keys.length / size));
  if (pending && s.selectingKey?.selectedId)
    keyPage = Math.floor(
      keys.findIndex((key) => key.id === s.selectingKey.selectedId) / size,
    );
  keyPage = Math.min(keyPage, pageCount - 1);
  $("key-list").innerHTML =
    !picking || talking || pending
      ? ""
      : keys
          .slice(keyPage * size, (keyPage + 1) * size)
          .map(
            (key) =>
              '<button type="button" class="key-card" data-key="' +
              key.id +
              '"><strong>' +
              esc(key.label) +
              "</strong><small>" +
              esc(key.detail) +
              "</small></button>",
          )
          .join("");
  $("key-page-count").textContent = keyPage + 1 + " / " + pageCount;
  $("key-prev").hidden =
    $("key-next").hidden =
    $("key-page-count").hidden =
      pageCount === 1;
  $("key-prev").disabled = keyPage === 0;
  $("key-next").disabled = keyPage + 1 >= pageCount;
  if (recordVisible) shownKey = s.keyLabel;
  $("key-record-label").textContent =
    s.selectingKey?.stage === "wrapping" ? "送る共通鍵" : "共通鍵";
  $("key-record").textContent =
    s.selectingKey?.stage === "wrapping" ? s.payloadKey.label : shownKey;
  $("original-message").textContent = shownOriginal || "未解読";
  const draftVisible = s.rewritten && (plaintextVisible || s.impersonating);
  $("edited-message").hidden = $("rewrite-arrow").hidden = !draftVisible;
  $("rewrite-arrow").textContent = s.impersonating ? "／ 偽の本文：" : "→";
  $("edited-message").textContent = draftVisible ? s.draft : "";
  $("outgoing-label").textContent = talking
    ? "通信の様子を確認中"
    : done
      ? s.deliveredKey
        ? "Bobに届けた暗号文 ← " + s.deliveredKey.label
        : "この通信は終了"
      : s.outgoingDescription;
  $("action-result").hidden =
    !talking &&
    (Boolean(s.feedback && !s.feedback.inline) || pending || picking);
  $("feedback").textContent = talking
    ? f.text
    : correctAnswer
      ? s.feedbackFrame?.text ||
        "Charlieは、予想を実際の通信で確かめようとしている。"
      : s.feedback && !s.feedback.inline
        ? s.feedback.explanation
        : done
          ? lesson(s)
          : picking
            ? s.selectingKey.title + "を選ぼう。"
            : s.prompt;
  $("bob-result").hidden = !visibleResult || !s.result.message;
  $("bob-result").textContent =
    visibleResult && s.result.message
      ? plaintextVisible || s.impersonating
        ? "Bobが受け取った本文：" + s.result.message
        : "Bobは共通鍵で復号し、本文を受け付けた。"
      : "";
  const position = story.position();
  $("dialogue-next").hidden = !talking && !correctAnswer;
  $("dialogue-next").textContent =
    correctAnswer || position.index + 1 < position.total
      ? "次へ ▶"
      : "行動を選ぶ ▶";
  $("dialogue-previous").hidden = false;
  $("dialogue-previous").textContent = "← 一つ前へ";
  recordNarration(s);
  $("dialogue-previous").disabled = !canGoBack();
  $("dialogue-position").textContent = talking
    ? position.index + 1 + " / " + position.total
    : correctAnswer
      ? ""
      : done
        ? "結果"
        : "行動を選ぶ";
}
function review(id, trigger = document.activeElement) {
  if (story.active()) return;
  if (!quest.select(id)) return;
  if (quest.view().pending) {
    execute();
    return;
  }
  previousChoice = id;
  previousTrigger = trigger;
  keyPage = 0;
  if (playKeyPreparation()) return;
  render();
  (document.querySelector("[data-key]") || $("key-back")).focus({
    preventScroll: true,
  });
}
$("choice-list").addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (button) review(button.dataset.action);
});
function cancel() {
  quest.cancel();
  render();
  const selected = quest.view().selectingKey?.selectedId;
  if (quest.view().selectingKey) {
    (
      document.querySelector('[data-key="' + selected + '"]') || $("key-back")
    ).focus({ preventScroll: true });
    return;
  }
  (
    document.querySelector('[data-action="' + previousChoice + '"]') ||
    document.querySelector("[data-action]") ||
    previousTrigger
  )?.focus({ preventScroll: true });
}
$("key-back").addEventListener("click", cancel);
$("key-list").addEventListener("click", (event) => {
  const button = event.target.closest("[data-key]");
  if (!button) return;
  const selected = quest.selectKey(button.dataset.key);
  if (!selected) return;
  execute();
});
$("key-prev").addEventListener("click", () => {
  if (keyPage > 0) {
    keyPage--;
    render();
    $("key-next").focus({ preventScroll: true });
  }
});
$("key-next").addEventListener("click", () => {
  keyPage++;
  render();
  $("key-prev").focus({ preventScroll: true });
});
$("game-console").addEventListener("keydown", (event) => {
  if (
    event.key === "Escape" &&
    !story.active() &&
    (quest.view().pending || quest.view().selectingKey)
  ) {
    event.preventDefault();
    event.stopPropagation();
    cancel();
  }
});
$("dialogue-next").addEventListener("click", () => {
  if (
    !story.active() &&
    quest.view().feedback?.correct &&
    !quest.view().feedback?.inline
  ) {
    review("continue");
    return;
  }
  if (!story.active()) return;
  story.next();
  render();
  if (!story.active()) focusCurrentControl();
});
$("dialogue-previous").addEventListener("click", () => {
  goBack();
});
$("rounds").addEventListener("click", (event) => {
  const button = event.target.closest("[data-round]");
  if (button) {
    play(quest.start(Number(button.dataset.round)));
  }
});
$("restart").addEventListener("click", () => {
  const requestedRound = quest.view().round;
  play(quest.start(requestedRound));
});
function buildInfo() {
  const s = quest.view();
  const sections =
    infoTopic === "log"
      ? [
          {
            title: "通信の記録",
            text: story.active()
              ? "通信の会話を終えると記録を確認できます。"
              : s.log
                  .map((entry, i) => i + 1 + ". " + englishNames(entry.text))
                  .join("\n"),
          },
        ]
      : explanations(s);
  $("info-title").textContent =
    infoTopic === "log" ? "通信の記録" : "このラウンドの仕組み";
  $("info-text").innerHTML = sections
    .map((part) => {
      const content =
        "<p>" +
        esc(part.text) +
        "</p>" +
        (part.links || [])
          .map(
            (link) =>
              '<a href="' +
              esc(link.url) +
              '" target="_blank" rel="noopener noreferrer">' +
              esc(link.label) +
              " ↗</a>",
          )
          .join(" · ");
      return part.collapsible
        ? '<details class="mechanism-detail"><summary>' +
            esc(part.title) +
            '</summary><div class="mechanism-detail-content">' +
            content +
            "</div></details>"
        : "<section><h3>" + esc(part.title) + "</h3>" + content + "</section>";
    })
    .join("");
  $("info-scroll").scrollTop = 0;
  document
    .querySelectorAll("[data-info]")
    .forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.info === infoTopic)),
    );
}
function openInfo() {
  infoOpener = document.activeElement;
  infoTopic = "mechanism";
  buildInfo();
  const dialog = $("info-dialog");
  if (typeof dialog.showModal === "function") dialog.showModal();
  else {
    dialog.setAttribute("open", "");
    dialog.classList.add("fallback-dialog");
  }
  document.body.classList.add("tools-open");
  $("close-info").focus({ preventScroll: true });
}
function closeInfo() {
  const dialog = $("info-dialog");
  if (typeof dialog.close === "function") dialog.close();
  else dialog.removeAttribute("open");
  document.body.classList.remove("tools-open");
  infoOpener?.focus({ preventScroll: true });
}
$("open-info").addEventListener("click", openInfo);
$("situation-details").addEventListener("click", openInfo);
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
  }
  if (event.key === "Tab") {
    const buttons = [
      ...$("info-dialog").querySelectorAll(
        'button, a[href], summary, [tabindex="0"]',
      ),
    ].filter((b) => {
      const closed = b.closest("details:not([open])");
      return (
        !b.disabled &&
        !b.closest("[hidden]") &&
        (!closed || closed.querySelector(":scope > summary") === b)
      );
    });
    if (event.shiftKey && document.activeElement === buttons[0]) {
      event.preventDefault();
      buttons.at(-1)?.focus();
    } else if (!event.shiftKey && document.activeElement === buttons.at(-1)) {
      event.preventDefault();
      buttons[0]?.focus();
    }
  }
});
$("info-topics").addEventListener("click", (event) => {
  const button = event.target.closest("[data-info]");
  if (button) {
    infoTopic = button.dataset.info;
    buildInfo();
  }
});
storyBatch++;
story.play([...introFrames(), ...roundFrames(quest.view())]);
createDisplayController({
  document,
  target: $("game-console"),
  button: $("fullscreen"),
  announce: (text) => {
    $("display-status").textContent = text;
  },
  onChange: () => {
    render();
    if ($("info-dialog").open) buildInfo();
  },
});
render();

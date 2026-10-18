import { createQuest } from "./quest.mjs?v=9";
import { rounds } from "./model.mjs";
import {
  introFrames,
  roundFrames,
  createStoryPlayer,
  packetName,
  englishNames,
  lesson,
} from "./storyboard.mjs?v=11";
import { createDisplayController } from "./display.mjs";
import { explanations } from "./explanations.mjs";
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
const history = [];
function remember() {
  history.push({
    restore: quest.checkpoint(),
    story: story.checkpoint(),
    keyPage,
    shownKey,
    shownCount,
    shownOriginal,
  });
}
function goBack() {
  const last = history.pop();
  if (!last) return;
  last.restore();
  story.restore(last.story);
  ({ keyPage, shownKey, shownCount, shownOriginal } = last);
  render();
}
function execute() {
  const frames = quest.confirm();
  if (frames.length) play(frames);
  else {
    render();
    const target = quest.view().feedback?.correct
      ? $("dialogue-next")
      : document.querySelector("[data-action]") ||
        document.querySelector("[data-key]") ||
        $("key-back");
    target?.focus({ preventScroll: true });
  }
}
function play(frames) {
  story.play(frames);
  render();
  $("dialogue-next").focus({ preventScroll: true });
}
function render() {
  const s = quest.view(),
    talking = story.active(),
    correctAnswer = !talking && Boolean(s.feedback?.correct),
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
  $("round-number").textContent =
    s.round === 3 ? "EXTRA" : "ROUND " + (s.round + 1);
  $("round-title").textContent = rounds[s.round].title;
  $("round-description").textContent = rounds[s.round].description;
  $("auth-control").hidden = s.round !== 3;
  $("signer-control").hidden = s.round !== 2;
  $("authenticate-signer").checked = s.authenticateSigner;
  $("comparison-note").hidden = s.round !== 2 || s.authenticateSigner;
  $("authenticate").checked = s.authenticate;
  const phase = f.phase || s.phase;
  const stages =
    s.round >= 2
      ? ["検証用公開鍵の確認", ...rounds[s.round].stages]
      : rounds[s.round].stages;
  const step =
    phase === "done"
      ? stages.length
      : phase === "signing-setup"
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
                : 2);
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
  });
  const route =
    f.route ||
    (f.connected === false
      ? "Alice → Bob"
      : phase === "public" || (done && f.at === "alice")
        ? "Bob → 中継機 → Alice"
        : "Alice → 中継機 → Bob");
  $("direction").textContent = route;
  $("scene").classList.toggle("reverse", route.startsWith("Bob"));
  $("scene-status").textContent = talking
    ? "▶ 通信の様子"
    : done
      ? "■ 通信終了"
      : "Ⅱ 転送前で停止";
  const signed =
    s.round >= 2 &&
    (f.kind === "ciphertext" || ["sign", "sign-charlie"].includes(f.scene));
  const visualKind = ["sign", "sign-charlie"].includes(f.scene)
    ? "letter"
    : signed
      ? "signed-message"
      : f.kind;
  $("packet-sprite").dataset.kind = visualKind;
  $("packet-sprite").dataset.signed = String(signed);
  $("signature-attachment").hidden = !signed;
  $("signature-note").textContent =
    f.scene === "sign" ? "Aliceの秘密鍵で作成" : "本文と一緒に暗号化";
  const charlieSignature =
    f.scene === "sign-charlie" ||
    (s.outgoingSignature?.owner === "charlie" && f.scene !== "sign") ||
    (["done", "message"].includes(phase) &&
      (visibleResult || ["verify", "delivering"].includes(f.scene)) &&
      s.deliveredSignature?.owner === "charlie");
  $("signature-owner").textContent = charlieSignature
    ? "Charlieの電子署名"
    : "Aliceの電子署名";
  if (f.scene === "sign-charlie")
    $("signature-note").textContent = "Charlieの秘密鍵で作成";
  const shapes = {
    key: "key",
    public: "public",
    "verify-key": "public",
    "wrapped-key": "wrapped",
    ciphertext: "encrypted",
    letter: "message",
    signature: "signature",
    "signed-message": "encrypted",
  };
  $("packet-icon").setAttribute(
    "href",
    "./packets.svg#" + (shapes[visualKind] || "message"),
  );
  $("packet-sprite").setAttribute(
    "aria-label",
    (signed ? "署名付き・" : "") + (f.packetLabel || packetName(f.kind)),
  );

  $("packet-short").textContent = f.packetLabel || packetName(f.kind);
  $("packet-title").textContent =
    f.packetLabel || packetName(f.kind) || "通信の準備中";
  $("packet-value").textContent =
    phase === "signing-setup"
      ? (f.packetLabel || "").startsWith("Charlie")
        ? s.substituteSigningPublic.fingerprint
        : s.signingPublic.fingerprint
      : recordVisible
        ? s.incoming.token ||
          s.incoming.fingerprint ||
          englishNames(s.incoming.label)
        : "通信の到着待ち";
  $("command-label").textContent =
    !talking && s.feedback
      ? s.feedback.correct
        ? "○ 正解"
        : "× 誤答"
      : talking
        ? "ナレーション"
        : pending
          ? "この操作で進める？"
          : picking
            ? s.selectingKey.title
            : done
              ? "通信の結果"
              : "Charlieの行動";
  $("answer-explanation").hidden = talking || !s.feedback;
  $("answer-explanation").textContent =
    !talking && s.feedback ? s.feedback.explanation : "";
  $("choice-list").hidden = talking || pending || picking || correctAnswer;
  $("key-picker").hidden = talking || pending || !picking;
  $("choice-confirm").hidden = talking || !pending;
  $("choice-list").innerHTML =
    talking || pending || picking || correctAnswer
      ? ""
      : s.choices
          .map(
            (action, index) =>
              '<button type="button" class="command' +
              (index === 0 ? " suggested" : "") +
              '" data-action="' +
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
  const keys = [
    ...(s.selectingKey?.keys || []),
    ...(s.selectingKey?.allowPass
      ? [
          {
            id: "pass",
            label: "そのまま送る",
            detail: "届いた元のデータを転送",
          },
        ]
      : []),
  ];
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
              '" aria-pressed="' +
              (s.selectingKey.selectedId === key.id) +
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
  $("choice-summary").textContent = s.pending?.summary || "";
  if (recordVisible) shownKey = s.keyLabel;
  $("key-record").textContent = shownKey;
  $("original-message").textContent = shownOriginal || "未解読";
  $("edited-message").hidden = $("rewrite-arrow").hidden =
    !plaintextVisible || !s.rewritten;
  $("edited-message").textContent =
    s.rewritten && plaintextVisible ? s.draft : "";
  $("outgoing-label").textContent = talking
    ? "通信の到着を待とう"
    : done
      ? s.deliveredKey
        ? "Bobに届けた暗号文 ← " + s.deliveredKey.label
        : "この通信は終了"
      : s.outgoingDescription;
  $("action-result").hidden =
    !talking && (Boolean(s.feedback) || pending || picking);
  $("feedback").textContent = talking
    ? f.text
    : correctAnswer
      ? s.feedbackFrame?.text ||
        "Charlieは、予想を実際の通信で確かめようとしている。"
      : s.feedback
        ? s.feedback.explanation
        : done
          ? lesson(s)
          : pending
            ? "「決定」で実行。「戻る」で選び直せる。"
            : picking
              ? s.selectingKey.title + "を選ぼう。"
              : s.prompt;
  $("bob-result").hidden = !visibleResult || !s.result.message;
  $("bob-result").textContent =
    visibleResult && s.result.message
      ? plaintextVisible
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
  $("dialogue-previous").disabled = history.length === 0;
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
  const direct = quest.view().choices.find((a) => a.id === id)?.direct;
  remember();
  if (!quest.select(id)) {
    history.pop();
    return;
  }
  if (direct) {
    execute();
    return;
  }
  previousChoice = id;
  previousTrigger = trigger;
  keyPage = 0;
  render();
  $(quest.view().pending ? "choice-back" : "key-back").focus({
    preventScroll: true,
  });
}
$("choice-list").addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (button) review(button.dataset.action);
});
function cancel() {
  remember();
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
    previousTrigger
  )?.focus({ preventScroll: true });
}
$("choice-back").addEventListener("click", cancel);
$("key-back").addEventListener("click", cancel);
$("key-list").addEventListener("click", (event) => {
  const button = event.target.closest("[data-key]");
  if (!button) return;
  remember();
  const selected =
    button.dataset.key === "pass"
      ? quest.selectPass()
      : quest.selectKey(button.dataset.key);
  if (!selected) {
    history.pop();
    return;
  }
  render();
  $("choice-back").focus({ preventScroll: true });
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
$("choice-commit").addEventListener("click", (event) => {
  if (event.detail > 1) return;
  remember();
  execute();
});
$("game-console").addEventListener("keydown", (event) => {
  if (
    event.key === "Escape" &&
    (quest.view().pending || quest.view().selectingKey)
  ) {
    event.preventDefault();
    event.stopPropagation();
    cancel();
  }
});
$("dialogue-next").addEventListener("click", () => {
  if (!story.active() && quest.view().feedback?.correct) {
    review("continue");
    return;
  }
  if (!story.active()) return;
  remember();
  story.next();
  render();
  if (!story.active())
    document.querySelector("[data-action]")?.focus({ preventScroll: true });
});
$("dialogue-previous").addEventListener("click", () => {
  goBack();
});
$("rounds").addEventListener("click", (event) => {
  const button = event.target.closest("[data-round]");
  if (button) {
    remember();
    play(quest.start(Number(button.dataset.round)));
  }
});
$("restart").addEventListener("click", () => {
  if (story.active()) {
    const s = quest.view();
    remember();
    play(quest.start(s.round, s.authenticate, s.authenticateSigner));
  } else review("restart");
});
$("authenticate").addEventListener("change", () => {
  remember();
  play(quest.start(3, $("authenticate").checked));
});
$("authenticate-signer").addEventListener("change", () => {
  remember();
  play(quest.start(2, true, $("authenticate-signer").checked));
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
    .map(
      (part) =>
        "<section><h3>" +
        esc(part.title) +
        "</h3><p>" +
        esc(part.text) +
        "</p></section>",
    )
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
      ...$("info-dialog").querySelectorAll('button, [tabindex="0"]'),
    ].filter((b) => !b.disabled);
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

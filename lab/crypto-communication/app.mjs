import { createQuest } from "./quest.mjs";
import { rounds } from "./model.mjs";
import {
  introFrames,
  roundFrames,
  createStoryPlayer,
  packetName,
  englishNames,
  lesson,
} from "./storyboard.mjs?v=6";
import { createDisplayController } from "./display.mjs";
import { paginateText } from "./screen-layout.mjs";
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
  infoPage = 0,
  infoPages = [],
  infoOpener = null;
let shownKey = "未取得",
  shownCount = 0,
  shownOriginal = null;
function play(frames) {
  story.play(frames);
  render();
  $("dialogue-next").focus({ preventScroll: true });
}
function render() {
  const s = quest.view(),
    talking = story.active(),
    f = story.current() || s.displayFrame;
  const done = s.phase === "done",
    visibleResult = done && (!talking || f.revealOutcome);
  const pending = Boolean(s.pending);
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
  const plaintextVisible = Boolean(shownOriginal);
  Object.assign($("game-console").dataset, {
    talking: String(talking),
    pending: String(pending),
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
  $("authenticate").checked = s.authenticate;
  const phase = f.phase || s.phase;
  const step =
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
  $("packet-sprite").dataset.kind = f.kind;
  $("packet-short").textContent = f.packetLabel || packetName(f.kind);
  $("packet-title").textContent =
    f.packetLabel || packetName(f.kind) || "通信の準備中";
  $("copy-indicator").textContent = recordVisible
    ? "自動で記録済み"
    : f.at === "alice"
      ? "Aliceの手元"
      : f.at === "bob"
        ? "Bobの手元"
        : "";
  $("packet-value").textContent = recordVisible
    ? s.incoming.token ||
      s.incoming.fingerprint ||
      englishNames(s.incoming.label)
    : "通信の到着待ち";
  $("alice-state").textContent =
    {
      sign: "秘密鍵で署名",
      wrap: "公開鍵で共通鍵を暗号化",
      encrypt: "共通鍵で本文を暗号化",
      authenticate: "Bobの公開鍵を確認",
    }[f.scene] || "Bobへ秘密の通信";
  $("bob-state").textContent = visibleResult
    ? s.result.accepted
      ? "本文を受理"
      : "通信を拒否"
    : f.scene === "verify"
      ? "Aliceの署名を検証"
      : "Aliceの通信を待つ";
  $("charlie-state").textContent =
    f.scene === "idea"
      ? "反対の内容に変えたい"
      : f.scene === "edit"
        ? "本文を書き換える"
        : f.scene === "decrypt"
          ? "鍵で暗号文を開く"
          : "通るデータを自動記録";
  $("situation-title").textContent = talking
    ? {
        direct: "AliceからBobへの通信",
        watch: "Charlieは盗み見たい",
        setup: "通信経路の中継機",
        relay: "データは自動で手に入る",
        inbound: "中継機にデータが到着",
        delivering: "データを転送",
        wrap: "共通鍵を暗号化",
        encrypt: "本文を暗号化",
        verify: "Bobが署名を検証",
        decrypt: "Charlieが暗号文を開く",
        idea: "本文を読んで思いついた",
        edit: "Charlieが本文を書き換える",
        question: "この鍵では開けない",
        replace: "送るデータを変更",
        authenticate: "Bobの公開鍵を確認",
        accept: "Bobが受理",
        reject: "通信を中断",
        "alice-key": "Aliceが共通鍵を送る",
      }[f.scene] || "通信の様子"
    : s.title;
  $("situation-text").textContent = "";
  $("goal-text").textContent = talking
    ? "下の「次へ」で続きを見よう。"
    : s.goal;
  $("command-label").textContent = talking
    ? "通信の様子を見よう"
    : pending
      ? "この操作で進める？"
      : done
        ? "次に試すこと"
        : "Charlieの行動";
  $("command-wait").hidden = !talking;
  $("choice-list").hidden = talking || pending;
  $("choice-confirm").hidden = talking || !pending;
  $("choice-list").innerHTML =
    talking || pending
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
      ? "この通信は終了"
      : englishNames((s.outgoing || s.incoming).label) +
        (s.outgoing ? "（すり替え）" : "");
  $("dialogue-label").textContent = talking
    ? "STORY"
    : done
      ? "RESULT"
      : "YOUR TURN";
  $("result-heading").textContent = "ナレーション";
  $("speaker-sprite").setAttribute("href", "./characters.svg#narrator");
  $("feedback").textContent = talking
    ? f.text
    : done
      ? lesson(s)
      : pending
        ? "「決定」で実行。「戻る」で選び直せる。"
        : s.prompt;
  $("bob-result").hidden = !visibleResult || !s.result.message;
  $("bob-result").textContent =
    visibleResult && s.result.message
      ? "Bobが受け取った本文：" + s.result.message
      : "";
  const position = story.position();
  $("dialogue-next").hidden = !talking;
  $("dialogue-next").textContent =
    position.index + 1 < position.total ? "次へ ▶" : "行動を選ぶ ▶";
  $("dialogue-previous").hidden = !talking;
  $("dialogue-previous").disabled = position.index === 0;
  $("dialogue-position").textContent = talking
    ? position.index + 1 + " / " + position.total
    : done
      ? "結果"
      : "行動を選ぶ";
}
function review(id, trigger = document.activeElement) {
  if (story.active() || !quest.select(id)) return;
  previousChoice = id;
  previousTrigger = trigger;
  render();
  $("choice-back").focus({ preventScroll: true });
}
$("choice-list").addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (button) review(button.dataset.action);
});
function cancel() {
  quest.cancel();
  render();
  (
    document.querySelector('[data-action="' + previousChoice + '"]') ||
    previousTrigger
  )?.focus({ preventScroll: true });
}
$("choice-back").addEventListener("click", cancel);
$("choice-commit").addEventListener("click", (event) => {
  if (event.detail > 1) return;
  const frames = quest.confirm();
  if (frames.length) play(frames);
});
$("game-console").addEventListener("keydown", (event) => {
  if (event.key === "Escape" && quest.view().pending) {
    event.preventDefault();
    event.stopPropagation();
    cancel();
  }
});
$("dialogue-next").addEventListener("click", () => {
  story.next();
  render();
  if (!story.active())
    document.querySelector("[data-action]")?.focus({ preventScroll: true });
});
$("dialogue-previous").addEventListener("click", () => {
  story.previous();
  render();
});
$("rounds").addEventListener("click", (event) => {
  const button = event.target.closest("[data-round]");
  if (button) play(quest.start(Number(button.dataset.round)));
});
$("restart").addEventListener("click", () => {
  if (story.active()) {
    const s = quest.view();
    play(quest.start(s.round, s.authenticate));
  } else review("restart");
});
$("authenticate").addEventListener("change", () =>
  play(quest.start(3, $("authenticate").checked)),
);
const mechanisms = [
  "AliceとBobは、同じ共通鍵で本文を暗号化・復号する。Charlieも共通鍵を持つと、本文を読んだり書き換えたりできる。",
  "Aliceは、公開鍵で共通鍵を暗号化する。対応する秘密鍵だけが共通鍵を取り出せる。本文は、引き続き共通鍵で暗号化する。",
  "Aliceは、Aliceの秘密鍵で本文に署名を付ける。Bobは信頼済みのAliceの公開鍵で検証する。Charlieが共通鍵を知っていても、Aliceの署名は作れない。",
  "Aliceは、受け取ったBobの公開鍵を、信頼できる別経路で確認済みの指紋と照合する。Charlieの鍵へのすり替えを、共通鍵を送る前に検出できる。",
];
function buildInfo() {
  const s = quest.view();
  const text =
    infoTopic === "log"
      ? story.active()
        ? ["会話の後に、ここで通信の記録を確認できます。"]
        : s.log.map((entry, i) => i + 1 + ". " + englishNames(entry.text))
      : [
          mechanisms[s.round],
          "この実験では、中継機を通るデータは自動でCharlieの手元に残る。CharlieはAliceやBobの秘密鍵を盗めない。",
        ];
  const limit = Math.max(
    45,
    Math.min(
      140,
      Math.floor((document.defaultView.innerWidth - 85) / 14) *
        Math.max(2, Math.floor((document.defaultView.innerHeight - 240) / 24)),
    ),
  );
  infoPages = text.flatMap((value) => paginateText(value, limit));
  infoPage = Math.min(infoPage, infoPages.length - 1);
  $("info-title").textContent =
    infoTopic === "log" ? "通信の記録" : "このラウンドの仕組み";
  $("info-text").textContent = infoPages[infoPage];
  $("info-count").textContent = infoPage + 1 + " / " + infoPages.length;
  $("info-prev").disabled = infoPage === 0;
  $("info-next").disabled = infoPage === infoPages.length - 1;
  document
    .querySelectorAll("[data-info]")
    .forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.info === infoTopic)),
    );
}
function openInfo() {
  infoOpener = document.activeElement;
  infoPage = 0;
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
    const buttons = [...$("info-dialog").querySelectorAll("button")].filter(
      (b) => !b.disabled,
    );
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
    infoPage = 0;
    buildInfo();
  }
});
$("info-prev").addEventListener("click", () => {
  infoPage--;
  buildInfo();
});
$("info-next").addEventListener("click", () => {
  infoPage++;
  buildInfo();
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

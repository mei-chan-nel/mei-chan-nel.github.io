import { createLab } from "./model.mjs";
import {
  frame,
  forwardFrames,
  roundFrames,
  outcomeFrame,
  packetKind,
  englishNames,
} from "./storyboard.mjs?v=6";
// The protocol stays in model.mjs. This layer limits each scene to two relevant
// decisions and records every arriving packet without a capture command.
export function createQuest() {
  const lab = createLab();
  let pending = null,
    keyTried = false,
    messageTried = false,
    records = new Set();
  const find = (s, type, owner) =>
    s.inventory.find((a) => a.type === type && (!owner || a.owner === owner));
  const shared = (s) =>
    s.inventory.find((a) => a.type === "symmetric" && a.current);
  const oldKey = (s) =>
    s.inventory.find((a) => a.type === "symmetric" && !a.current);
  function record() {
    const s = lab.snapshot();
    if (s.phase !== "done" && !records.has(s.incoming.id)) {
      records.add(s.incoming.id);
      lab.capture();
    }
  }
  function start(round = 0, authenticate = true) {
    lab.start(round, authenticate);
    pending = null;
    keyTried = false;
    messageTried = false;
    records = new Set();
    record();
    return roundFrames(lab.snapshot());
  }
  const choice = (id, label, detail, summary) => ({
    id,
    label,
    detail,
    summary,
  });
  function choices(s = lab.snapshot()) {
    const send = choice(
      "forward",
      s.phase === "public" ? "Aliceへ届ける" : "Bobへ届ける",
      s.outgoing ? "すり替えたデータを送る" : "記録した元のデータを送る",
      "Charlieが、" +
        englishNames((s.outgoing || s.incoming).label) +
        "を" +
        (s.phase === "public" ? "Alice" : "Bob") +
        "へ送る。",
    );
    const retry = choice(
      "retry",
      s.phase === "public" || s.round === 0
        ? "このラウンドをやり直す"
        : "公開鍵の場面からやり直す",
      "新しい共通鍵で再挑戦",
      "このラウンドを最初からやり直す。",
    );
    const undo = choice(
      "undo",
      s.phase === "message" ? "元の本文に戻す" : "すり替えを取り消す",
      "転送前なので戻せる",
      "Charlieが、送信するデータを元に戻す。",
    );
    if (s.phase === "done")
      return [
        s.round < 3
          ? choice(
              "next",
              s.round === 2 ? "公開鍵の確認を試す" : "次のラウンドへ",
              "別の仕組みでも試す",
              "次のラウンドを始める。",
            )
          : choice(
              "compare",
              s.authenticate ? "確認を外して比べる" : "確認ありで比べる",
              "公開鍵の確認だけを変える",
              "AliceによるBobの公開鍵の確認を切り替えて、再実験する。",
            ),
        retry,
      ];
    if (s.outgoing) return [send, undo];
    if (s.phase === "public")
      return [
        choice(
          "swap",
          "Charlieの公開鍵にすり替える",
          "Bobの公開鍵は記録に残る",
          "Charlieが、Aliceに渡す公開鍵をCharlieの公開鍵に替える。",
        ),
        {
          ...send,
          label: "Bobの公開鍵をそのまま届ける",
          detail: "すり替えずに進む",
        },
      ];
    if (s.phase === "key") {
      if (s.round === 0) return [send];
      if (shared(s))
        return [
          choice(
            "rewrap",
            "Bobの公開鍵で包み直す",
            "入手した共通鍵をBob向けに暗号化",
            "Charlieが、入手した共通鍵をBobの公開鍵で暗号化し直す。",
          ),
          {
            ...send,
            label: "届いた暗号文をそのまま送る",
            detail: "Bobが開けるか確かめる",
          },
        ];
      if (keyTried) return [retry, send];
      const previous = s.publicForAlice?.owner === "bob" && oldKey(s);
      return [
        choice(
          "open-key",
          previous ? "前の共通鍵で開いてみる" : "Charlieの秘密鍵で開く",
          previous ? "前のラウンドと同じ作戦" : "Charlieの公開鍵と対になる鍵",
          previous
            ? "Charlieが、前の共通鍵で今回の配送データの復号を試す。"
            : "Charlieが、Charlieの秘密鍵で共通鍵の暗号文を復号する。",
        ),
        send,
      ];
    }
    if (s.read)
      return [
        choice(
          "edit",
          "「love」を「hate」に書き換える",
          "同じ共通鍵で暗号化し直す",
          "Charlieが本文を「I hate you.」に変え、同じ共通鍵で暗号化する。",
        ),
        {
          ...send,
          label: "本文を書き換えずに届ける",
          detail: "元の暗号文をBobへ送る",
        },
      ];
    if (messageTried || (!shared(s) && !oldKey(s))) return [retry, send];
    return [
      choice(
        "read",
        "共通鍵で本文を読む",
        shared(s) ? "記録した今回の共通鍵を使う" : "前のラウンドの共通鍵を試す",
        "Charlieが、記録した共通鍵で本文の暗号文を復号する。",
      ),
      {
        ...send,
        label: "本文を読まずに届ける",
        detail: "元の暗号文をBobへ送る",
      },
    ];
  }
  function view() {
    const s = lab.snapshot();
    const key = shared(s);
    const state =
      s.phase === "done"
        ? "result"
        : s.outgoing
          ? "ready"
          : s.phase === "message" && s.read
            ? "idea"
            : (s.phase === "key" && keyTried && !key) ||
                (s.phase === "message" &&
                  (messageTried || (!key && !oldKey(s))))
              ? "blocked"
              : s.phase;
    const titles = {
      public: "Aliceに渡す公開鍵を選ぶ",
      key:
        s.round === 0
          ? "共通鍵を手に入れた"
          : key
            ? "Bobに共通鍵を届けるには？"
            : "共通鍵の暗号文が届いた",
      message: "本文を読むには？",
      idea: "反対の内容に変えてみよう",
      ready: "届ける前に確認しよう",
      blocked: "鍵の配送から見直そう",
      result: "この通信の結果",
    };
    const goals = {
      public: "公開鍵をすり替えると、どうなる？",
      key:
        s.round === 0
          ? "鍵を届けて、次の暗号文を待とう。"
          : key
            ? "Bobが開ける形にして届けよう。"
            : "まず、共通鍵を取り出そう。",
      message: "共通鍵で本文を開いてみよう。",
      idea: "書き換えるか、そのまま届けるか選ぼう。",
      ready: "このデータを届ける？ 元に戻す？",
      blocked: "公開鍵の渡し方を変えてみよう。",
      result:
        s.result?.code === "signature-rejected"
          ? "盗聴は成功。署名が改ざんを検出。"
          : s.result?.code === "authenticated"
            ? "公開鍵の確認が、盗聴も防いだ。"
            : s.result?.code === "attack-success"
              ? "盗聴も、書き換えも成功。"
              : "別の選択で結果を比べてみよう。",
    };
    const prompts = {
      public: "Bobの公開鍵が届いた。Aliceに渡す鍵を選ぼう。",
      key:
        s.round === 0
          ? "Charlieは共通鍵を入手した。次は、本文の暗号文を待とう。"
          : key
            ? "Charlieは共通鍵を入手した。Bobにも同じ共通鍵を届けたい。"
            : "共通鍵は暗号化されている。手元の鍵で開けるだろうか。",
      message: "本文の暗号文が届いた。記録した共通鍵を使ってみよう。",
      idea: "Charlieは「love」を「hate」に変えてみたくなった。",
      ready:
        s.phase === "public"
          ? "Aliceが受け取るのは、Charlieの公開鍵だ。"
          : s.phase === "key"
            ? "Charlieは、Bobの公開鍵で包み直した共通鍵を送れる。"
            : "Charlieが書き換えた本文は、まだBobには届いていない。",
      blocked:
        "Charlieの手元の鍵では開けない。公開鍵の渡し方を見直してみよう。",
    };
    return {
      ...s,
      state,
      title: titles[state],
      goal: goals[state],
      prompt: prompts[state],
      choices: choices(s),
      pending: pending ? { ...pending } : null,
      recorded: records.has(s.incoming.id),
      keyLabel: key ? englishNames(key.label) : "今回の共通鍵は未取得",
      displayFrame:
        s.phase === "done"
          ? outcomeFrame(s)
          : frame("", "intercept", {
              phase: s.phase,
              kind: packetKind(s.outgoing || s.incoming),
            }),
      rewritten: s.read && s.draft !== s.original,
    };
  }
  function select(id) {
    const action =
      id === "restart"
        ? choice(
            "retry",
            "このラウンドをやり直す",
            "",
            "新しい共通鍵で、このラウンドを最初からやり直す。",
          )
        : choices().find((a) => a.id === id);
    if (!action) return false;
    pending = { ...action };
    return true;
  }
  function confirm() {
    if (!pending) return [];
    const action = pending.id,
      before = lab.snapshot();
    pending = null;
    if (action === "retry") return start(before.round, before.authenticate);
    if (action === "next") return start(Math.min(3, before.round + 1));
    if (action === "compare") return start(3, !before.authenticate);
    if (action === "forward") {
      lab.forward();
      record();
      return forwardFrames(before, lab.snapshot());
    }
    const base = {
      phase: before.phase,
      at: "charlie",
      kind: packetKind(before.incoming),
    };
    if (action === "swap") {
      lab.setOutgoing(find(before, "public", "charlie").id);
      return [
        frame(
          "Charlieは、Bobの公開鍵をCharlieの公開鍵にすり替えた。",
          "replace",
          { ...base, at: "relay", kind: "public" },
        ),
      ];
    }
    if (action === "undo") {
      lab.setOutgoing();
      if (before.phase === "message") lab.edit(before.original);
      return [
        frame("Charlieは、送るデータを元に戻した。", "replace", {
          ...base,
          at: "relay",
        }),
      ];
    }
    if (action === "open-key") {
      keyTried = true;
      const previous = before.publicForAlice?.owner === "bob" && oldKey(before);
      const response = lab.decrypt(
        before.incoming.id,
        (previous || find(before, "private", "charlie")).id,
      );
      return [
        frame(
          response.ok
            ? "Charlieは、Charlieの秘密鍵で共通鍵を取り出した。"
            : previous
              ? "前の共通鍵では、Charlieは今回の配送データを開けなかった。"
              : "Bob宛ての暗号文は、Charlieの秘密鍵では開けなかった。",
          response.ok ? "decrypt" : "question",
          base,
        ),
      ];
    }
    if (action === "rewrap") {
      const made = lab.wrapKey(
        shared(before).id,
        find(before, "public", "bob").id,
      );
      lab.setOutgoing(made.id);
      return [
        frame(
          "Charlieは、共通鍵を本物のBobの公開鍵で暗号化し直した。",
          "wrap",
          { ...base, kind: "wrapped-key" },
        ),
      ];
    }
    if (action === "read") {
      messageTried = true;
      const response = lab.decrypt(
        before.incoming.id,
        (shared(before) || oldKey(before)).id,
      );
      if (!response.ok)
        return [
          frame(
            "Charlieは、記録した共通鍵で本文を開けなかった。",
            "question",
            base,
          ),
        ];
      return [
        frame("Charlieは、本文の復号に成功した。", "decrypt", {
          ...base,
          showPlaintext: true,
        }),
        frame(
          "Charlieは「love」を「hate」に変えて、Bobに届けることを思いついた。",
          "idea",
          { ...base, showPlaintext: true },
        ),
      ];
    }
    if (action === "edit") {
      lab.edit("I hate you.");
      lab.chooseSignature("keep");
      const made = lab.encryptMessage(shared(before).id);
      lab.setOutgoing(made.id);
      return [
        frame("Charlieは、本文を「I hate you.」に書き換えた。", "edit", {
          ...base,
          showPlaintext: true,
        }),
        frame("Charlieは、同じ共通鍵で本文を暗号化し直した。", "encrypt", {
          ...base,
          showPlaintext: true,
        }),
      ];
    }
    return [];
  }
  record();
  return {
    view,
    start,
    select,
    confirm,
    cancel: () => {
      pending = null;
    },
  };
}

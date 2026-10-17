import { createLab } from "./model.mjs";
import {
  frame,
  forwardFrames,
  roundFrames,
  outcomeFrame,
  packetKind,
  englishNames,
} from "./storyboard.mjs?v=7";
// The protocol stays in model.mjs. This layer limits each scene to two relevant
// decisions. Key operations always require an explicit learner-selected key.
export function createQuest() {
  const lab = createLab();
  let pending = null,
    selectingKey = null,
    lastAttempt = null,
    stagedKey = null,
    deliveredKey = null,
    records = new Set();
  const find = (s, type, owner) =>
    s.inventory.find((a) => a.type === type && (!owner || a.owner === owner));
  const shared = (s) =>
    s.inventory.find((a) => a.type === "symmetric" && a.current);
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
    selectingKey = null;
    lastAttempt = null;
    stagedKey = null;
    deliveredKey = null;
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
    if (stagedKey && s.outgoing)
      send.summary =
        "Charlieが、" + stagedKey.label + "を使って作った暗号文をBobへ送る。";
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
            "入手した共通鍵を包み直す",
            "暗号化に使う鍵を選ぶ",
            "",
          ),
          {
            ...send,
            label: "届いた暗号文をそのまま送る",
            detail: "Bobが開けるか確かめる",
          },
        ];
      return [
        choice("open-key", "共通鍵の暗号文を開く", "復号に使う鍵を選ぶ", ""),
        send,
      ];
    }
    if (s.read)
      return [
        choice(
          "edit",
          "「love」を「hate」に書き換える",
          "書き換えた本文を暗号化する鍵を選ぶ",
          "",
        ),
        {
          ...send,
          label: "本文を書き換えずに届ける",
          detail: "元の暗号文をBobへ送る",
        },
      ];
    return [
      choice("read", "本文の暗号文を開く", "復号に使う鍵を選ぶ", ""),
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
          : lastAttempt?.ok === false
            ? "blocked"
            : s.phase === "message" && s.read
              ? "idea"
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
      blocked: "この鍵では操作できなかった",
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
      message: "本文を開く鍵を選ぼう。",
      idea: "書き換えるか、そのまま届けるか選ぼう。",
      ready: "このデータを届ける？ 元に戻す？",
      blocked: "別の鍵で、もう一度試せる。",
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
      message: "本文の暗号文が届いた。Charlieの手元のどの鍵で開けるだろうか。",
      idea: "Charlieは「love」を「hate」に変えてみたくなった。",
      ready: stagedKey
        ? "Charlieは、" +
          stagedKey.label +
          "で暗号文を作った。Bobへ届ける前なら選び直せる。"
        : s.phase === "public"
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
      prompt: lastAttempt?.ok === false ? lastAttempt.reason : prompts[state],
      choices: choices(s),
      pending: pending ? { ...pending } : null,
      selectingKey: selectingKey
        ? { ...selectingKey, keys: availableKeys(s) }
        : null,
      lastAttempt: lastAttempt ? { ...lastAttempt } : null,
      stagedKey: stagedKey ? { ...stagedKey } : null,
      deliveredKey: deliveredKey ? { ...deliveredKey } : null,
      outgoingDescription: stagedKey
        ? (s.phase === "key" ? "共通鍵の暗号文 ← " : "本文の暗号文 ← ") +
          stagedKey.label
        : englishNames((s.outgoing || s.incoming).label) +
          (s.outgoing ? "（すり替え）" : ""),
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
  const keyOperations = {
    "open-key": {
      title: "共通鍵の暗号文を復号する鍵",
      target: "共通鍵の暗号文",
      verb: "復号",
    },
    read: {
      title: "本文の暗号文を復号する鍵",
      target: "本文の暗号文",
      verb: "復号",
    },
    rewrap: {
      title: "共通鍵を暗号化する鍵",
      target: "入手した共通鍵",
      verb: "暗号化",
    },
    edit: {
      title: "書き換えた本文を暗号化する鍵",
      target: "書き換えた本文",
      verb: "暗号化",
    },
  };
  function availableKeys(s) {
    const previous = s.inventory
      .filter((a) => a.type === "symmetric" && !a.current)
      .at(-1);
    return [
      shared(s),
      find(s, "public", "bob"),
      find(s, "public", "charlie"),
      find(s, "private", "charlie"),
      previous,
      find(s, "verify", "alice"),
    ]
      .filter(Boolean)
      .map((a) => ({
        id: a.id,
        type: a.type,
        owner: a.owner,
        label: englishNames(a.label).replace("（信頼済み）", ""),
        detail:
          a.type === "symmetric"
            ? a.current
              ? "この通信で入手"
              : "以前の通信で入手"
            : a.type === "private"
              ? "Charlieだけが持つ鍵"
              : a.type === "verify"
                ? "信頼済みの検証用公開鍵"
                : "公開してよい鍵",
      }));
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
    if (keyOperations[id]) {
      selectingKey = { action: id, ...keyOperations[id], selectedId: null };
      pending = null;
    } else {
      selectingKey = null;
      pending = { ...action };
    }
    return true;
  }
  function selectKey(id) {
    if (!selectingKey) return false;
    const key = availableKeys(lab.snapshot()).find((a) => a.id === id);
    if (!key) return false;
    selectingKey.selectedId = id;
    pending = {
      id: selectingKey.action,
      key,
      summary:
        "Charlieが、" +
        key.label +
        "で" +
        selectingKey.target +
        "を" +
        selectingKey.verb +
        "する。",
    };
    return true;
  }
  function failedReason(action, key, before) {
    if (key.type === "verify")
      return "Aliceの検証用公開鍵は、Aliceの署名を確かめる鍵。暗号文の復号や暗号化には使わない。";
    if (action === "open-key")
      return before.publicForAlice?.owner === "bob"
        ? "Bob宛ての共通鍵を開けるのは、Bobの秘密鍵。Charlieはその秘密鍵を持っていない。"
        : "Charlieの公開鍵に対応するのはCharlieの秘密鍵。公開鍵や共通鍵では開けない。";
    if (action === "read")
      return key.type === "symmetric"
        ? "前の通信と今回の通信では共通鍵が違う。本文の暗号化と同じ共通鍵が必要。"
        : "この本文は共通鍵で暗号化されている。公開鍵や秘密鍵では復号できない。";
    if (action === "rewrap")
      return "共通鍵を送るには、配送先の公開鍵で暗号化する。秘密鍵や共通鍵は使わない。";
    return "この通信の本文は共通鍵で暗号化する。公開鍵や秘密鍵は使わない。";
  }
  function confirm() {
    if (!pending) return [];
    const action = pending.id,
      key = pending.key,
      before = lab.snapshot();
    pending = null;
    selectingKey = null;
    lastAttempt = null;
    if (action === "retry") return start(before.round, before.authenticate);
    if (action === "next") return start(Math.min(3, before.round + 1));
    if (action === "compare") return start(3, !before.authenticate);
    if (action === "forward") {
      deliveredKey = stagedKey;
      stagedKey = null;
      lab.forward();
      record();
      const frames = forwardFrames(before, lab.snapshot());
      if (deliveredKey)
        frames[0].text =
          "Charlieは、" + deliveredKey.label + "で作った暗号文をBobへ届けた。";
      return frames;
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
      stagedKey = null;
      lab.setOutgoing();
      if (before.phase === "message") lab.edit(before.original);
      return [
        frame("Charlieは、送るデータを元に戻した。", "replace", {
          ...base,
          at: "relay",
        }),
      ];
    }
    if (!key || !availableKeys(before).some((a) => a.id === key.id)) return [];
    let response;
    if (action === "open-key" || action === "read")
      response = lab.decrypt(before.incoming.id, key.id);
    if (action === "rewrap") response = lab.wrapKey(shared(before).id, key.id);
    if (action === "edit") {
      if (key.type === "symmetric") {
        lab.edit("I hate you.");
        lab.chooseSignature("keep");
      }
      response = lab.encryptMessage(key.id);
    }
    if (!response) return [];
    lastAttempt = {
      action,
      key: { ...key },
      ok: response.ok,
      reason: response.ok ? "" : failedReason(action, key, before),
    };
    if (!response.ok)
      return [
        frame(
          "Charlieは、" +
            key.label +
            "では" +
            keyOperations[action].target +
            "を" +
            keyOperations[action].verb +
            "できなかった。",
          "question",
          base,
        ),
      ];
    if (action === "open-key")
      return [
        frame(
          "Charlieは、" + key.label + "で共通鍵を取り出した。",
          "decrypt",
          base,
        ),
      ];
    if (action === "read")
      return [
        frame("Charlieは、" + key.label + "で本文を復号した。", "decrypt", {
          ...base,
          showPlaintext: true,
        }),
        frame(
          "Charlieは「love」を「hate」に変えて、Bobに届けることを思いついた。",
          "idea",
          { ...base, showPlaintext: true },
        ),
      ];
    lab.setOutgoing(response.id);
    stagedKey = { ...key };
    if (action === "rewrap")
      return [
        frame(
          "Charlieは、共通鍵を" + key.label + "で暗号化し直した。",
          "wrap",
          { ...base, kind: "wrapped-key" },
        ),
      ];
    return [
      frame("Charlieは、本文を「I hate you.」に書き換えた。", "edit", {
        ...base,
        showPlaintext: true,
      }),
      frame("Charlieは、" + key.label + "で本文を暗号化し直した。", "encrypt", {
        ...base,
        showPlaintext: true,
      }),
    ];
  }
  record();
  return {
    view,
    start,
    select,
    selectKey,
    confirm,
    cancel: () => {
      if (pending && selectingKey) pending = null;
      else {
        pending = null;
        selectingKey = null;
      }
    },
  };
}

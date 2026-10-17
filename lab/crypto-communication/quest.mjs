import { createLab } from "./model.mjs";
import {
  frame,
  forwardFrames,
  roundFrames,
  outcomeFrame,
  packetKind,
  englishNames,
} from "./storyboard.mjs?v=9";
const copy = (value) => JSON.parse(JSON.stringify(value));
export function createQuest() {
  const lab = createLab();
  const initial = () => ({
    pending: null,
    selectingKey: null,
    feedback: null,
    feedbackFrames: [],
    stagedKey: null,
    deliveredKey: null,
    predictionAnswered: false,
    consequence: false,
  });
  let x = initial(),
    records = new Set(),
    retryPoint = null;
  const find = (s, type, owner) =>
    s.inventory.find((a) => a.type === type && (!owner || a.owner === owner));
  const shared = (s) =>
    s.inventory.find((a) => a.type === "symmetric" && a.current);
  function checkpoint() {
    const restoreModel = lab.checkpoint(),
      saved = copy(x),
      savedRecords = [...records],
      savedRetry = retryPoint;
    return () => {
      restoreModel();
      x = copy(saved);
      records = new Set(savedRecords);
      retryPoint = savedRetry;
    };
  }
  function record() {
    const s = lab.snapshot();
    if (s.phase !== "done" && !records.has(s.incoming.id)) {
      records.add(s.incoming.id);
      lab.capture();
    }
  }
  function start(round = 0, authenticate = true) {
    lab.start(round, authenticate);
    x = initial();
    records = new Set();
    retryPoint = null;
    record();
    return roundFrames(lab.snapshot());
  }
  const choice = (id, label, detail = "", summary = "", direct = false) => ({
    id,
    label,
    detail,
    summary,
    direct,
  });
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
  function choices(s = lab.snapshot()) {
    if (x.feedback)
      return x.feedback.correct
        ? [choice("continue", "次へ", "", "", true)]
        : [
            choice(
              "retry-here",
              "この問題をやり直す",
              "誤答を選ぶ前の状態に戻る",
              "",
              true,
            ),
            choice(
              "show-consequence",
              "このまま進むとどうなる？",
              "実際の通信で確かめる",
              "",
              true,
            ),
          ];
    if (s.phase === "done") {
      const next =
        s.round < 3
          ? choice(
              "next",
              s.round === 2 ? "公開鍵の確認を試す" : "次のラウンドへ",
              "",
              "",
              true,
            )
          : choice(
              "compare",
              s.authenticate ? "確認を外して比べる" : "確認ありで比べる",
              "",
              "",
              true,
            );
      return x.consequence
        ? [
            choice(
              "retry-here",
              "誤答した問題からやり直す",
              "鍵や予想を選び直せる",
              "",
              true,
            ),
            next,
          ]
        : [
            next,
            choice(
              "retry-round",
              "このラウンドをもう一度",
              "新しい共通鍵で実験",
              "",
              true,
            ),
          ];
    }
    if (s.outgoing || (s.phase === "key" && s.round === 0))
      return [
        choice(
          "forward",
          s.phase === "public" ? "Aliceへ転送する" : "Bobへ転送する",
          "選んだデータで通信を進める",
          "",
          true,
        ),
      ];
    if (s.phase === "public")
      return [
        choice(
          "swap",
          "Charlieの公開鍵にすり替える",
          "Aliceに渡す鍵を選ぶ",
          "Charlieの公開鍵をAliceへ渡すデータにする。",
        ),
        choice(
          "send-public",
          "Bobの公開鍵をそのまま送る",
          "Aliceに渡す鍵を選ぶ",
          "Bobの公開鍵をそのままAliceへ送る。",
        ),
      ];
    if (s.phase === "key")
      return [
        shared(s)
          ? choice(
              "rewrap",
              "共通鍵を包み直す",
              "Bobが開けるようにする鍵を選ぶ",
            )
          : choice("open-key", "共通鍵の暗号文を開く", "復号に使う鍵を選ぶ"),
      ];
    if (!s.read)
      return [choice("read", "本文の暗号文を開く", "復号に使う鍵を選ぶ")];
    if (!x.predictionAnswered)
      return [
        choice(
          "predict-safe",
          "書き換えてもBobにバレない",
          "改ざんした本文は受理される？",
          "本文を書き換えてもBobは受け付ける、と予想する。",
        ),
        choice(
          "predict-detected",
          "書き換えるとBobにバレる",
          "改ざんした本文は拒否される？",
          "Bobが本文の書き換えを検出する、と予想する。",
        ),
      ];
    return [
      choice("edit", "「love」を「hate」に書き換える", "暗号化し直す鍵を選ぶ"),
    ];
  }
  function availableKeys(s) {
    return [
      shared(s),
      find(s, "public", "bob"),
      find(s, "public", "charlie"),
      find(s, "private", "charlie"),
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
            ? "この通信の共通鍵"
            : a.type === "private"
              ? "Charlieだけが持つ鍵"
              : a.type === "verify"
                ? "信頼済みの検証用公開鍵"
                : "公開してよい鍵",
      }));
  }
  function view() {
    const s = lab.snapshot(),
      key = shared(s);
    const state =
      s.phase === "done"
        ? "result"
        : x.feedback
          ? "feedback"
          : s.outgoing
            ? "ready"
            : s.phase === "message" && s.read
              ? x.predictionAnswered
                ? "edit"
                : "predict"
              : s.phase;
    const titles = {
      public: "Aliceに渡す公開鍵を選ぶ",
      key: key ? "共通鍵をBobに届けよう" : "共通鍵の暗号文が届いた",
      message: "本文を開く鍵は？",
      predict: "書き換えはBobにバレる？",
      edit: "予想を実際に試そう",
      ready: "このデータで通信を進めよう",
      feedback: x.feedback?.correct ? "正解" : "誤答",
      result: "通信の結果",
    };
    const goals = {
      public: "Charlieが共通鍵を取り出せるようにする。",
      key:
        s.round === 0
          ? "鍵を届けて、本文の暗号文を待とう。"
          : key
            ? "Bobが取り出せる形に暗号化し直そう。"
            : "どの鍵で共通鍵を取り出せる？",
      message: "この本文を復号する鍵を選ぼう。",
      predict: "暗号化と改ざん検出の違いを考えよう。",
      edit: "本文を変えて、予想を確かめよう。",
      ready: "BobやAliceの反応を見よう。",
      feedback: x.feedback?.correct ? "" : "この地点で選び直せる。",
      result: x.consequence
        ? "誤答したまま進んだ結果を確認しよう。"
        : "予想と実際の結果を比べよう。",
    };
    const prompt = {
      public: "Bobの公開鍵が中継機に届いた。Aliceに渡す公開鍵を選ぼう。",
      key: key
        ? "Charlieは共通鍵を手に入れた。Bobにも同じ共通鍵を届けたい。"
        : "Aliceが送った共通鍵は暗号化されている。",
      message: "本文の暗号文が届いた。どの鍵で開けるだろうか。",
      predict:
        "Charlieは「love」を「hate」に変えたい。Bobはその変更に気づくだろうか。",
      edit: "Charlieが考えた書き換えを、実際の暗号文にしてみよう。",
      ready: "選んだデータを相手に届けてみよう。",
    };
    const shown =
      s.phase === "done"
        ? outcomeFrame(s)
        : frame("", "intercept", {
            phase: s.phase,
            kind: packetKind(s.outgoing || s.incoming),
            ...(s.phase === "public"
              ? {
                  packetLabel: englishNames((s.outgoing || s.incoming).label),
                  route: "Bob → 中継機 → Alice",
                }
              : {}),
          });
    return {
      ...s,
      state,
      title: titles[state],
      goal: goals[state],
      prompt: x.feedback?.explanation || prompt[state],
      choices: choices(s),
      pending: x.pending ? copy(x.pending) : null,
      selectingKey: x.selectingKey
        ? { ...x.selectingKey, keys: availableKeys(s), allowPass: true }
        : null,
      feedback: x.feedback ? copy(x.feedback) : null,
      feedbackFrame:
        x.feedback?.correct && x.feedbackFrames.length
          ? copy(x.feedbackFrames[0])
          : null,
      consequence: x.consequence,
      canRetryHere: Boolean(retryPoint),
      predictionAnswered: x.predictionAnswered,
      stagedKey: x.stagedKey ? { ...x.stagedKey } : null,
      deliveredKey: x.deliveredKey ? { ...x.deliveredKey } : null,
      outgoingDescription: x.stagedKey
        ? (s.phase === "key" ? "共通鍵の暗号文 ← " : "本文の暗号文 ← ") +
          x.stagedKey.label
        : englishNames((s.outgoing || s.incoming).label),
      recorded: records.has(s.incoming.id),
      keyLabel: key ? englishNames(key.label) : "今回の共通鍵は未取得",
      displayFrame: shown,
      rewritten: s.read && s.draft !== s.original,
      tone: x.feedback
        ? x.feedback.correct
          ? "correct"
          : "wrong"
        : s.phase === "done"
          ? x.consequence
            ? "wrong"
            : "correct"
          : "",
    };
  }
  function select(id) {
    const action =
      id === "restart"
        ? choice(
            "retry-round",
            "このラウンドをやり直す",
            "",
            "新しい共通鍵で、このラウンドを最初からやり直す。",
          )
        : choices().find((a) => a.id === id);
    if (!action) return false;
    if (keyOperations[id]) {
      x.selectingKey = { action: id, ...keyOperations[id], selectedId: null };
      x.pending = null;
    } else {
      x.pending = { ...action };
      x.selectingKey = null;
    }
    return true;
  }
  function selectKey(id) {
    if (!x.selectingKey) return false;
    const key = availableKeys(lab.snapshot()).find((a) => a.id === id);
    if (!key) return false;
    x.selectingKey.selectedId = id;
    x.pending = {
      id: x.selectingKey.action,
      key,
      summary:
        "Charlieが、" +
        key.label +
        "で" +
        x.selectingKey.target +
        "を" +
        x.selectingKey.verb +
        "する。",
    };
    return true;
  }
  function selectPass() {
    if (!x.selectingKey) return false;
    x.selectingKey.selectedId = "pass";
    x.pending = {
      id: "pass",
      operation: x.selectingKey.action,
      summary: "Charlieが、届いた元のデータをそのままBobへ転送する。",
    };
    return true;
  }
  function reason(action, key, s) {
    if (key?.type === "verify")
      return "Aliceの検証用公開鍵は、Aliceの署名を確かめる鍵。本文や共通鍵を復号する鍵ではない。";
    if (action === "open-key")
      return s.publicForAlice?.owner === "bob"
        ? "Bobの公開鍵に対応するのはBobの秘密鍵。CharlieはBobの秘密鍵を持っていない。"
        : "Charlieの公開鍵で包まれた共通鍵には、Charlieの秘密鍵が必要。公開鍵では開けない。";
    if (action === "read")
      return "本文は共通鍵で暗号化されている。暗号化に使われた同じ共通鍵で復号しよう。";
    if (action === "rewrap")
      return key?.type === "public"
        ? "暗号化はできたが、Charlie宛てのまま。Bobが開くにはBobの公開鍵で包む必要がある。"
        : "共通鍵の配送には、配送先の公開鍵を使う。Bobは、対になるBobの秘密鍵で取り出す。";
    return "この通信の本文は共通鍵で暗号化する。公開鍵や秘密鍵は、本文の暗号化には使わない。";
  }
  function evaluate(correct, explanation, frames, origin, kind) {
    retryPoint = origin;
    x.feedback = { correct, explanation, kind };
    x.feedbackFrames = frames.map((f) => ({
      ...f,
      tone: correct ? "correct" : "wrong",
    }));
    return [];
  }
  function forward() {
    const before = lab.snapshot();
    x.deliveredKey = x.stagedKey;
    x.stagedKey = null;
    lab.forward();
    record();
    const frames = forwardFrames(before, lab.snapshot());
    if (x.deliveredKey)
      frames[0].text =
        "Charlieは、" + x.deliveredKey.label + "で作った暗号文をBobへ届けた。";
    return frames;
  }
  function showConsequence() {
    const feedback = x.feedback;
    x.feedback = null;
    x.feedbackFrames = [];
    x.pending = null;
    x.selectingKey = null;
    x.consequence = true;
    const frames = [
      frame(
        "選んだ操作のまま通信を進めると、相手にはどう届くか見てみよう。",
        "question",
        { phase: lab.snapshot().phase },
      ),
    ];
    if (feedback?.kind === "prediction") {
      const s = lab.snapshot(),
        key = shared(s);
      lab.edit("I hate you.");
      lab.chooseSignature("keep");
      const made = lab.encryptMessage(key.id);
      lab.setOutgoing(made.id);
      x.stagedKey = {
        label: englishNames(key.label),
        id: key.id,
        type: "symmetric",
      };
      frames.push(
        frame(
          "Charlieは、本文を「I hate you.」に変え、同じ共通鍵で暗号化した。",
          "edit",
          {
            phase: "message",
            at: "charlie",
            kind: "ciphertext",
            showPlaintext: true,
          },
        ),
      );
    }
    for (let i = 0; i < 3 && lab.snapshot().phase !== "done"; i++)
      frames.push(...forward());
    return frames.map((f) => ({ ...f, tone: "wrong" }));
  }
  function confirm() {
    if (!x.pending) return [];
    const pending = copy(x.pending),
      action = pending.id;
    if (action === "retry-here") {
      const point = retryPoint;
      if (!point) return [];
      point();
      x.pending = null;
      x.feedback = null;
      x.feedbackFrames = [];
      x.consequence = false;
      retryPoint = point;
      return [];
    }
    if (action === "continue") {
      const frames = copy(x.feedbackFrames.slice(1));
      x.pending = null;
      x.feedback = null;
      x.feedbackFrames = [];
      return frames;
    }
    if (action === "show-consequence") return showConsequence();
    if (action === "retry-round")
      return start(lab.snapshot().round, lab.snapshot().authenticate);
    if (action === "next") return start(Math.min(3, lab.snapshot().round + 1));
    if (action === "compare") return start(3, !lab.snapshot().authenticate);
    if (action === "forward") {
      x.pending = null;
      return forward();
    }
    const origin = checkpoint(),
      before = lab.snapshot(),
      key = pending.key;
    x.pending = null;
    x.selectingKey = null;
    x.feedback = null;
    x.feedbackFrames = [];
    const base = {
      phase: before.phase,
      at: "charlie",
      kind: packetKind(before.incoming),
    };
    if (action === "swap") {
      lab.setOutgoing(find(before, "public", "charlie").id);
      return evaluate(
        true,
        before.round === 3 && before.authenticate
          ? "Charlieの鍵へのすり替えを準備できた。今回はAliceの真正性確認がすり替えを止めるか確かめよう。"
          : "AliceがCharlieの公開鍵を使えば、Charlieは対になる秘密鍵で共通鍵を取り出せる。",
        [
          frame(
            "Charlieは、Bobの公開鍵をCharlieの公開鍵にすり替えた。",
            "replace",
            {
              ...base,
              at: "relay",
              kind: "public",
              packetLabel: "Charlieの公開鍵",
            },
          ),
        ],
        origin,
        "public",
      );
    }
    if (action === "send-public")
      return evaluate(
        false,
        "Bobの公開鍵で包まれた共通鍵を開けるのはBobの秘密鍵。Charlieが読むには、渡す公開鍵を考え直そう。",
        [],
        origin,
        "public",
      );
    if (action === "pass")
      return evaluate(
        false,
        pending.operation === "rewrap"
          ? "届いた暗号文はCharlie宛て。Bobへそのまま送っても、Bobの秘密鍵では共通鍵を取り出せない。"
          : pending.operation === "edit"
            ? "元の暗号文には元の本文が入っている。書き換えた本文を届けるには、暗号文を作り直す必要がある。"
            : "Bobは共通鍵で本文を読める。Charlieも本文を読むには、暗号化に使われた同じ共通鍵を選ぼう。",
        [],
        origin,
        "pass",
      );
    if (action.startsWith("predict-")) {
      const correct = (action === "predict-detected") === before.round >= 2;
      if (correct) x.predictionAnswered = true;
      return evaluate(
        correct,
        before.round >= 2
          ? "Aliceの署名は本文と結び付いている。Charlieが共通鍵で暗号化し直しても、Bobは本文の変更を検出できる。"
          : "この通信には署名などの改ざん検出がない。Charlieが同じ共通鍵で暗号化し直すと、Bobは変更に気づけない。",
        [],
        origin,
        "prediction",
      );
    }
    if (!key || !availableKeys(before).some((a) => a.id === key.id)) return [];
    let response;
    if (action === "read" || action === "open-key")
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
    if (!response.ok)
      return evaluate(false, reason(action, key, before), [], origin, action);
    if (action === "open-key")
      return evaluate(
        true,
        "Charlieの公開鍵と対になるのがCharlieの秘密鍵。この組み合わせで共通鍵を取り出せる。",
        [
          frame(
            "Charlieは、" + key.label + "で共通鍵を取り出した。",
            "decrypt",
            base,
          ),
        ],
        origin,
        action,
      );
    if (action === "read")
      return evaluate(
        true,
        "本文の暗号化と同じ共通鍵を使ったため、Charlieは本文を復号できた。",
        [
          frame("Charlieは、" + key.label + "で本文を復号した。", "decrypt", {
            ...base,
            showPlaintext: true,
          }),
          frame(
            "Charlieは「love」を「hate」に変えて、Bobに届けることを思いついた。",
            "idea",
            { ...base, showPlaintext: true },
          ),
        ],
        origin,
        action,
      );
    lab.setOutgoing(response.id);
    x.stagedKey = key;
    if (action === "rewrap")
      return evaluate(
        key.owner === "bob",
        key.owner === "bob"
          ? "Bobの公開鍵で包み直したので、BobはBobの秘密鍵で同じ共通鍵を取り出せる。"
          : reason(action, key, before),
        [
          frame(
            "Charlieは、共通鍵を" + key.label + "で暗号化し直した。",
            "wrap",
            { ...base, kind: "wrapped-key" },
          ),
        ],
        origin,
        action,
      );
    return evaluate(
      true,
      "本文の暗号化には、AliceとBobが使う同じ共通鍵を選べた。予想とBobの反応を比べてみよう。",
      [
        frame("Charlieは、本文を「I hate you.」に書き換えた。", "edit", {
          ...base,
          showPlaintext: true,
        }),
        frame(
          "Charlieは、" + key.label + "で本文を暗号化し直した。",
          "encrypt",
          { ...base, showPlaintext: true },
        ),
      ],
      origin,
      action,
    );
  }
  record();
  return {
    view,
    start,
    select,
    selectKey,
    selectPass,
    confirm,
    checkpoint,
    cancel() {
      if (x.pending && x.selectingKey) x.pending = null;
      else {
        x.pending = null;
        x.selectingKey = null;
      }
    },
  };
}

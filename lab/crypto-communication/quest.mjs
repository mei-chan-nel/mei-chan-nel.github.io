import { createLab } from "./model.mjs?v=20";
import {
  frame,
  forwardFrames,
  roundFrames,
  outcomeFrame,
  packetKind,
  englishNames,
} from "./storyboard.mjs?v=17";
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
    readability: {},
    payloadKey: null,
    consequence: false,
  });
  let x = initial(),
    records = new Set(),
    retryPoint = null,
    keyDeliveryPoint = null;
  const find = (s, type, owner) =>
    s.inventory.find((a) => a.type === type && (!owner || a.owner === owner));
  const shared = (s) =>
    s.attackerKey ||
    s.inventory.find(
      (a) => a.type === "symmetric" && a.current && a.owner === "alice",
    );
  function checkpoint() {
    const restoreModel = lab.checkpoint(),
      saved = copy(x),
      savedRecords = [...records],
      savedRetry = retryPoint,
      savedDelivery = keyDeliveryPoint;
    return () => {
      restoreModel();
      x = copy(saved);
      records = new Set(savedRecords);
      retryPoint = savedRetry;
      keyDeliveryPoint = savedDelivery;
    };
  }
  function record() {
    const s = lab.snapshot();
    if (s.phase !== "done" && !records.has(s.incoming.id)) {
      records.add(s.incoming.id);
      lab.capture();
    }
  }
  function start(round = 0) {
    lab.start(round);
    x = initial();
    records = new Set();
    retryPoint = null;
    keyDeliveryPoint = null;
    record();
    return roundFrames(lab.snapshot());
  }
  const choice = (id, label, detail = "") => ({ id, label, detail });
  const keyOperations = {
    "open-key": {
      title: "共通鍵を開く鍵",
      target: "共通鍵の暗号文",
      verb: "復号",
    },
    read: {
      title: "本文を開く鍵",
      target: "本文の暗号文",
      verb: "復号",
    },
    rewrap: {
      title: "共通鍵の暗号化に使う鍵",
      target: "入手した共通鍵",
      verb: "暗号化",
    },
    "inject-key": {
      title: "共通鍵の暗号化に使う鍵",
      target: "Charlieの共通鍵",
      verb: "暗号化",
    },
    edit: {
      title: "本文を暗号化する鍵",
      target: "Bobに送る本文",
      verb: "暗号化",
    },
  };
  function readingQuestion(s) {
    return (
      s.phase !== "done" &&
      !s.outgoing &&
      ["envelope", "ciphertext"].includes(s.incoming.type) &&
      !s.read &&
      x.readability[s.incoming.id] === undefined
    );
  }
  function canRead(s) {
    return s.incoming.type === "envelope"
      ? s.publicForAlice?.owner === "charlie"
      : s.inventory.some(
          (a) => a.type === "symmetric" && a.current && a.owner === "alice",
        );
  }
  function choices(s = lab.snapshot()) {
    if (x.feedback && !x.feedback.inline)
      return x.feedback.correct
        ? [choice("continue", "次へ")]
        : [
            choice(
              "retry-here",
              "この問題をやり直す",
              "誤答を選ぶ前の状態に戻る",
            ),
            choice(
              "show-consequence",
              "このまま進むとどうなる？",
              "実際の通信で確かめる",
            ),
          ];
    if (s.phase === "done") {
      const next =
        s.round < 3
          ? choice("next", "次のラウンドへ")
          : choice("retry-round", "Round4をもう一度", "新しい共通鍵で実験");
      return x.consequence
        ? [choice("retry-here", "誤答した問題からやり直す"), next]
        : [
            next,
            s.round < 3
              ? choice("retry-round", "このラウンドをもう一度")
              : choice("first", "Round1に戻る"),
          ];
    }
    if (s.outgoing || (s.phase === "key" && s.round === 0))
      return [
        choice(
          "forward",
          s.phase === "public" ? "Aliceへ転送する" : "Bobへ転送する",
          "中継機にあるデータを届ける",
        ),
      ];
    if (readingQuestion(s))
      return [
        choice(
          "can-read",
          s.phase === "key"
            ? "Charlieは共通鍵を取り出せる"
            : "CharlieはAliceの本文を読める",
        ),
        choice(
          "cannot-read",
          s.phase === "key"
            ? "Charlieは共通鍵を取り出せない"
            : "CharlieはAliceの本文を読めない",
        ),
      ];
    if (s.phase === "signing-public")
      return [
        choice(
          "swap-signing-key",
          "Charlieの公開鍵に取り替える",
          "Aliceの名前とCharlieの鍵を載せてBobへ送る",
        ),
        choice(
          "send-signing-key",
          "そのままBobへ転送する",
          "AliceのCA登録済の公開鍵を届ける",
        ),
      ];
    if (s.phase === "public")
      return [
        choice(
          "swap",
          s.ca ? "Charlieの公開鍵に取り替える" : "Charlieの公開鍵にすり替える",
          s.ca
            ? "Bobの名前とCharlieの鍵を載せてAliceへ送る"
            : "AliceにCharlieの鍵を渡す",
        ),
        choice(
          "send-public",
          "そのままAliceへ転送する",
          "Aliceに本物のBobの鍵を渡す",
        ),
      ];
    if (s.phase === "key") {
      if (s.round >= 2)
        return [
          choice(
            "inject-key",
            "Charlieの共通鍵に差し替える",
            s.round === 3
              ? "Aliceとは別の共通鍵をBobに渡す"
              : "共通鍵と本文の両方を偽物にする",
          ),
          choice(
            "pass",
            "Aliceの共通鍵の暗号文をそのまま転送する",
            "Aliceの本文を復号するための共通鍵を届ける",
          ),
        ];
      return [
        shared(s)
          ? choice(
              "rewrap",
              "共通鍵を包み直す",
              "Bobが開けるようにする鍵を選ぶ",
            )
          : choice(
              "open-key",
              "届いた共通鍵の暗号文を開く",
              "復号に使う鍵を選ぶ",
            ),
        choice(
          "pass",
          "そのままBobへ転送する",
          "中継機にある暗号文をそのまま届ける",
        ),
      ];
    }
    if (s.round === 3 && s.phase === "message" && x.predictionAnswered)
      return [
        choice(
          "pass",
          "署名付きの暗号文をそのままBobへ転送する",
          "Charlieは改ざんをあきらめる",
        ),
      ];
    if (s.round !== 3 && !s.read && !s.impersonating)
      return canRead(s)
        ? [
            choice("read", "本文の暗号文を開く", "復号に使う鍵を選ぶ"),
            choice("pass", "そのままBobへ転送する", "元の本文の暗号文を届ける"),
          ]
        : [
            choice(
              "pass",
              "そのままBobへ転送する",
              "Aliceの本文の暗号文を届ける",
            ),
          ];
    if (!x.predictionAnswered)
      return [
        choice(
          "predict-safe",
          s.round === 3
            ? "鍵と本文を差し替えてもBobにバレない"
            : s.impersonating
              ? "差し替えてもBobにバレない"
              : "書き換えてもBobにバレない",
          "Bobは偽の本文を受け付ける？",
        ),
        choice(
          "predict-detected",
          s.round === 3
            ? "鍵と本文を差し替えるとBobにバレる"
            : s.impersonating
              ? "差し替えるとBobにバレる"
              : "書き換えるとBobにバレる",
          "Bobは偽の本文を拒否する？",
        ),
      ];
    return [
      choice(
        "edit",
        s.impersonating
          ? "偽の本文を暗号化する"
          : "「love」を「hate」に書き換える",
        "本文の暗号化に使う鍵を選ぶ",
      ),
    ];
  }
  function availableKeys(s) {
    return [
      shared(s),
      find(s, "public", "bob"),
      find(s, "public", "charlie"),
      find(s, "private", "charlie"),
      s.round === 3 ? find(s, "verify", "alice") : null,
    ]
      .filter(Boolean)
      .map((a) => ({
        id: a.id,
        type: a.type,
        owner: a.owner,
        label:
          s.ca && a.owner !== "charlie" && ["public", "verify"].includes(a.type)
            ? `${a.owner === "bob" ? "Bob" : "Alice"}のCA登録済の公開鍵`
            : englishNames(a.label),
        detail:
          a.type === "symmetric"
            ? a.owner === "charlie"
              ? "Charlieが用意した鍵。Aliceの鍵とは別"
              : "この通信で入手した共通鍵"
            : a.type === "private"
              ? "Charlieだけが持つ鍵"
              : a.type === "verify"
                ? "Aliceの署名を検証する公開鍵"
                : "公開してよい鍵",
      }));
  }
  function view() {
    const s = lab.snapshot(),
      key = shared(s);
    const state = readingQuestion(s)
      ? "readability"
      : s.phase === "done"
        ? "result"
        : x.feedback && !x.feedback.inline
          ? "feedback"
          : s.outgoing
            ? "ready"
            : s.phase === "message" &&
                (s.read || s.impersonating || s.round === 3)
              ? !x.predictionAnswered
                ? "predict"
                : s.round === 3
                  ? "ready"
                  : "edit"
              : s.phase;
    const prompts = {
      readability:
        s.phase === "key"
          ? "Aliceの共通鍵の暗号文が届いた。Charlieは手元の鍵で、Aliceの共通鍵を取り出せるだろうか。"
          : "Aliceの本文の暗号文が届いた。Charlieは手元の鍵で、Aliceの本文を読めるだろうか。",
      "signing-public":
        "AliceのCA登録済の公開鍵が中継機に届いた。Charlieは、Bobへ渡す鍵を選ぼう。",
      public: s.ca
        ? "BobのCA登録済の公開鍵が中継機に届いた。Charlieは、Aliceへ渡す鍵を選ぼう。"
        : "Bobの公開鍵が届いた。Aliceに渡す公開鍵を選ぼう。",
      key:
        s.round === 0
          ? "Charlieは共通鍵を入手した。Charlieが鍵をBobへ届けると、Aliceは本文を送る。"
          : s.ca
            ? s.round === 3
              ? "BobがAliceの本文を復号できる状態を保つには、Charlieはどちらの共通鍵を届ければよいだろうか。"
              : "Charlieは偽の本文をBobに受け付けさせたい。Charlieは共通鍵の配送にどう介入する？"
            : key
              ? "Charlieは共通鍵を入手した。Bobも同じ共通鍵を取り出せるようにしよう。"
              : "Aliceが送った共通鍵は暗号化されている。どの鍵で開けるだろうか。",
      message: "本文の暗号文が届いた。復号に使う鍵を選ぼう。",
      predict:
        s.round === 3
          ? "Charlieが共通鍵と本文の両方を偽物に差し替えたら、BobはAliceの署名の検証で見破れるだろうか。"
          : s.impersonating
            ? "Charlieは本文を読めないと分かった。では、Charlieが自作の本文をAliceの本文として送り込むと、Bobは気づくだろうか。"
            : "Charlieは「love」を「hate」に変えたい。Bobは本文の変更に気づくだろうか。",
      edit: s.impersonating
        ? "Bobが持っているのは、Charlieが送り込んだ共通鍵だ。偽の本文をBobが復号できる形にしよう。"
        : "Charlieが考えた書き換えを、実際の暗号文にしてみよう。",
      ready:
        s.round === 3 && s.phase === "message"
          ? "Charlieは、Aliceの署名を作り直せないと分かった。Charlieは署名付きの暗号文を変えずにBobへ届ける。"
          : "Charlieが選んだデータを、相手へ転送しよう。",
    };
    const shown =
      s.phase === "done"
        ? outcomeFrame(s)
        : frame("", "intercept", {
            phase: s.phase,
            kind: packetKind(s.outgoing || s.incoming),
            packet: s.outgoing || s.incoming,
            signatureOwner:
              s.round === 3 && s.phase === "message"
                ? s.outgoing
                  ? s.outgoingSignature?.owner || null
                  : "alice"
                : null,
            packetLabel: englishNames((s.outgoing || s.incoming).label),
            route:
              s.phase === "public"
                ? "Bob → 中継機 → Alice"
                : "Alice → 中継機 → Bob",
          });
    return {
      ...s,
      state,
      prompt:
        (!x.feedback?.inline && x.feedback?.explanation) || prompts[state],
      choices: choices(s),
      pending: x.pending ? copy(x.pending) : null,
      selectingKey: x.selectingKey
        ? {
            ...x.selectingKey,
            title:
              x.selectingKey.stage === "payload"
                ? "Bobへ送る共通鍵を選ぶ"
                : x.selectingKey.title,
            context:
              x.selectingKey.stage === "wrapping"
                ? "送る共通鍵：" + x.payloadKey.label
                : "",
            keys: availableKeys(s),
            allowPass: false,
          }
        : null,
      feedback: x.feedback ? copy(x.feedback) : null,
      feedbackFrame:
        x.feedback && !x.feedback.inline && x.feedbackFrames.length
          ? copy(x.feedbackFrames[0])
          : null,
      consequence: x.consequence,
      canRetryHere: Boolean(retryPoint),
      predictionAnswered: x.predictionAnswered,
      payloadKey: x.payloadKey ? { ...x.payloadKey } : null,
      stagedKey: x.stagedKey ? { ...x.stagedKey } : null,
      deliveredKey: x.deliveredKey ? { ...x.deliveredKey } : null,
      outgoingDescription: x.stagedKey
        ? (s.phase === "key" ? "共通鍵の暗号文 ← " : "本文の暗号文 ← ") +
          x.stagedKey.label
        : englishNames((s.outgoing || s.incoming).label),
      recorded: records.has(s.incoming.id),
      keyLabel: key ? englishNames(key.label) : "Aliceの共通鍵は未取得",
      displayFrame: shown,
      rewritten: Boolean(
        s.draft && (s.impersonating || (s.read && s.draft !== s.original)),
      ),
      tone: x.feedback
        ? x.feedback.correct
          ? "correct"
          : "wrong"
        : s.phase === "done"
          ? x.consequence || !s.result.accepted
            ? "wrong"
            : s.result.code === "original-accepted" && s.round < 3
              ? ""
              : "correct"
          : "",
    };
  }
  function select(id) {
    const action =
      id === "restart"
        ? choice("retry-round", "このラウンドをやり直す")
        : choices().find((a) => a.id === id);
    if (!action) return false;
    if (x.feedback?.inline) {
      x.feedback = null;
      x.feedbackFrames = [];
    }
    if (id === "inject-key" && lab.snapshot().round === 3) {
      x.pending = { ...action };
      x.selectingKey = null;
      return true;
    }
    if (keyOperations[id]) {
      if (id === "inject-key") lab.createAttackerKey();
      if (["rewrap", "inject-key"].includes(id)) x.payloadKey = null;
      x.selectingKey = {
        action: id,
        ...keyOperations[id],
        stage: ["rewrap", "inject-key"].includes(id) ? "payload" : "operation",
        selectedId: null,
      };
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
      id:
        x.selectingKey.stage === "payload"
          ? "choose-payload"
          : x.selectingKey.action,
      operation: x.selectingKey.action,
      key,
    };
    return true;
  }
  function evaluate(
    correct,
    explanation,
    frames,
    origin,
    kind,
    inline = false,
  ) {
    retryPoint = origin;
    x.feedback = { correct, explanation, kind, inline };
    x.feedbackFrames = frames.map((f) => ({
      ...f,
      tone: correct ? "correct" : "wrong",
    }));
    return [];
  }
  function forward() {
    const before = lab.snapshot();
    if (before.round === 3 && before.phase === "key" && !before.outgoing)
      keyDeliveryPoint = lab.checkpoint();
    x.deliveredKey = x.stagedKey;
    x.stagedKey = null;
    lab.forward();
    record();
    return forwardFrames(before, lab.snapshot());
  }
  function showConsequence() {
    const feedback = x.feedback,
      pendingFrames = copy(x.feedbackFrames.slice(1));
    x.feedback = null;
    x.feedbackFrames = [];
    x.pending = null;
    x.selectingKey = null;
    x.consequence = true;
    const frames = pendingFrames;
    if (lab.snapshot().phase === "done")
      return (
        pendingFrames.length ? pendingFrames : [outcomeFrame(lab.snapshot())]
      ).map((f) => ({
        ...f,
        tone: "wrong",
      }));
    const unchanged = lab.snapshot();
    if (
      !unchanged.outgoing &&
      ["read", "open-key", "payload", "rewrap", "inject-key", "edit"].includes(
        feedback?.kind,
      )
    ) {
      const failure =
        feedback.kind === "read"
          ? "Charlieは選んだ鍵では本文を復号できなかった。"
          : feedback.kind === "open-key"
            ? "Charlieは選んだ鍵では共通鍵を取り出せなかった。"
            : feedback.kind === "edit"
              ? "Charlieは本文を書き換えようとしたが、選んだ鍵では新しい本文の暗号文を作れなかった。"
              : "Charlieは選んだ鍵では新しい共通鍵の暗号文を作れなかった。";
      frames.push(
        frame(
          failure + "Charlieは、届いた元の暗号文を変えずに転送する。",
          "operation-failed",
          {
            at: "charlie",
            phase: unchanged.phase,
            kind: packetKind(unchanged.incoming),
            packet: unchanged.incoming,
          },
        ),
      );
    }
    if (feedback?.kind === "readability" && !canRead(lab.snapshot())) {
      const s = lab.snapshot(),
        key =
          s.phase === "key"
            ? find(s, "private", "charlie")
            : shared(s) || find(s, "private", "charlie");
      lab.decrypt(s.incoming.id, key.id);
      frames.push(
        frame(
          "Charlieは手元の鍵で復号を試したが、Aliceの暗号文を開けなかった。",
          "decrypt-failed",
          {
            at: "charlie",
            phase: s.phase,
            kind: packetKind(s.incoming),
            packet: s.incoming,
          },
        ),
      );
    }
    if (
      feedback?.kind === "key-strategy" ||
      (feedback?.kind === "prediction" && lab.snapshot().round === 3)
    ) {
      if (feedback.kind === "prediction") {
        if (!keyDeliveryPoint)
          throw new Error("Missing original key delivery checkpoint");
        keyDeliveryPoint();
        frames.push(
          frame(
            "Charlieが鍵と本文の両方を差し替える場合を、共通鍵の配送から確認しよう。",
            "question",
            {
              at: "charlie",
              phase: "key",
              kind: "wrapped-key",
              packet: lab.snapshot().incoming,
            },
          ),
        );
      }
      const own = lab.createAttackerKey().id,
        s = lab.snapshot();
      const wrapped = lab.wrapKey(own, find(s, "public", "bob").id);
      lab.setOutgoing(wrapped.id);
      frames.push(
        frame(
          "Charlieは、Charlieの共通鍵をBobの公開鍵で暗号化し、Aliceの共通鍵の暗号文と差し替えた。",
          "wrap",
          {
            at: "charlie",
            phase: "key",
            kind: "wrapped-key",
            packet: lab.snapshot().outgoing,
          },
        ),
      );
      frames.push(...forward());
      if (feedback.kind === "prediction") {
        lab.edit("I hate you.");
        lab.signDraft(find(lab.snapshot(), "private", "charlie").id);
        lab.setOutgoing(lab.encryptMessage(own).id);
        frames.push(
          frame(
            "Charlieは偽の本文にCharlieの署名を付け、Charlieの共通鍵で暗号化した。",
            "encrypt",
            {
              at: "charlie",
              phase: "message",
              kind: "ciphertext",
              packet: lab.snapshot().outgoing,
              signatureOwner: "charlie",
              showPlaintext: true,
            },
          ),
        );
      }
    } else if (feedback?.kind === "prediction") {
      const s = lab.snapshot();
      lab.edit("I hate you.");
      lab.setOutgoing(lab.encryptMessage(shared(s).id).id);
      frames.push(
        frame(
          s.impersonating
            ? "Charlieは、Charlieの共通鍵で偽の本文を暗号化した。"
            : "Charlieは、書き換えた本文を同じ共通鍵で暗号化した。",
          "encrypt",
          {
            at: "charlie",
            phase: "message",
            kind: "ciphertext",
            packet: lab.snapshot().outgoing,
            showPlaintext: true,
          },
        ),
      );
    }
    for (let i = 0; i < 4 && lab.snapshot().phase !== "done"; i++)
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
    if (action === "retry-round") return start(lab.snapshot().round);
    if (action === "next") return start(Math.min(3, lab.snapshot().round + 1));
    if (action === "first") return start(0);
    if (
      action === "forward" ||
      (action === "pass" &&
        !(lab.snapshot().phase === "key" && lab.snapshot().round >= 2))
    ) {
      const origin = checkpoint();
      x.pending = null;
      const frames = forward(),
        after = lab.snapshot();
      if (after.result && !after.result.accepted)
        return evaluate(
          false,
          after.result.code === "bad-key"
            ? "Charlie宛ての共通鍵の暗号文をそのまま転送したため、Bobは共通鍵を取り出せなかった。Bobが取り出せる形にしなければ、本文の通信は始まらない。"
            : englishNames(after.result.text),
          frames,
          origin,
          "delivery",
        );
      return frames;
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
      packet: before.incoming,
    };
    if (action === "choose-payload") {
      if (key?.type !== "symmetric")
        return evaluate(
          false,
          "Bobへ送るのは、本文を暗号化・復号するための共通鍵。公開鍵や秘密鍵は、送る共通鍵そのものではない。",
          [],
          origin,
          "payload",
        );
      x.payloadKey = key;
      x.selectingKey = {
        action: pending.operation,
        ...keyOperations[pending.operation],
        stage: "wrapping",
        selectedId: null,
      };
      return evaluate(true, "", [], origin, "payload", true);
    }
    if (action === "inject-key" && before.round === 3)
      return evaluate(
        false,
        "共通鍵だけをCharlieの鍵に変えると、BobはAliceの暗号文を復号できなくなる。本文も偽物に変えれば、Aliceの正しい署名を付けられず、Bobの検証を通らない。",
        [],
        origin,
        "key-strategy",
      );
    if (action === "pass" && before.phase === "key" && before.round >= 2) {
      const frames = forward();
      return evaluate(
        before.round === 3,
        before.round === 3
          ? "Aliceが本文の暗号化に使う共通鍵をBobへ届けた。この共通鍵を別の鍵に変えると、BobはAliceの暗号文を復号できなくなる。"
          : "BobにはAliceの共通鍵が届いた。Charlieはその共通鍵を知らないため、Charlieの偽の本文を同じ共通鍵で暗号化できない。偽の本文を受け付けさせるには、共通鍵と本文の両方を差し替える必要がある。",
        frames,
        origin,
        "key-pass",
      );
    }
    if (action === "can-read" || action === "cannot-read") {
      const readable = canRead(before),
        correct = (action === "can-read") === readable;
      if (correct) x.readability[before.incoming.id] = readable;
      const next = correct ? choices(lab.snapshot()) : [];
      const onlyForward =
        next.length === 1 && ["pass", "forward"].includes(next[0].id);
      if (correct && (readable || !onlyForward))
        return evaluate(true, "", [], origin, "readability", true);
      return evaluate(
        correct,
        before.phase === "key"
          ? readable
            ? "AliceはCharlieの公開鍵で共通鍵を暗号化した。Charlieは、対になるCharlieの秘密鍵で共通鍵を取り出せる。"
            : "Aliceは本物のBobの公開鍵で共通鍵を暗号化した。復号に必要なBobの秘密鍵をCharlieは持っていない。"
          : readable
            ? "Charlieは、Aliceが本文の暗号化に使った共通鍵を持っている。同じ共通鍵を使えば本文を復号できる。"
            : before.impersonating
              ? "CharlieがBobに送り込んだ共通鍵は、Aliceの共通鍵とは別の鍵だ。Charlieの共通鍵ではAliceの本文を読めない。読めなくても、別の本文を作ることはできる。"
              : "CharlieはAliceの共通鍵を持っていない。公開鍵やCharlieの秘密鍵では、共通鍵で暗号化された本文は読めない。",
        [],
        origin,
        "readability",
      );
    }
    if (["swap", "swap-signing-key"].includes(action)) {
      const signing = action === "swap-signing-key";
      lab.setOutgoing(
        before.ca
          ? lab.forgeCertificate(
              find(before, signing ? "verify" : "public", "charlie").id,
              signing ? "alice" : "bob",
            ).id
          : find(before, "public", "charlie").id,
      );
      if (before.ca) {
        const frames = forward();
        return evaluate(
          false,
          `${signing ? "Bob" : "Alice"}はブラウザ内のCA公開鍵で証明書を検証し、Charlieの鍵への取り替えを検出した。CharlieはCAの秘密鍵を持たないため、正しいCA署名を作れない。`,
          frames,
          origin,
          signing ? "signing-key" : "public",
        );
      }
      return evaluate(
        true,
        "AliceがCharlieの公開鍵を使えば、Charlieは対になる秘密鍵で共通鍵を取り出せる。",
        [
          frame(
            "Charlieは、Bobの公開鍵をCharlieの公開鍵にすり替えた。",
            "replace",
            {
              ...base,
              at: "relay",
              kind: "public",
              packet: lab.snapshot().outgoing,
              packetLabel: "Charlieの公開鍵",
            },
          ),
        ],
        origin,
        "public",
      );
    }
    if (["send-public", "send-signing-key"].includes(action)) {
      const frames = forward();
      return evaluate(
        Boolean(before.ca),
        before.ca
          ? action === "send-signing-key"
            ? "BobはCAの署名とAliceの名前を確認し、Aliceの公開鍵を受け取った。Charlieの鍵に取り替えると、この確認を通らない。"
            : "AliceはCAの署名とBobの名前を確認し、Bobの公開鍵を受け取った。Charlieの鍵に取り替えると、この確認を通らない。"
          : "Aliceは本物のBobの公開鍵を受け取った。CharlieはBobの秘密鍵を持たないため、共通鍵を取り出せなくなる。",
        before.ca ? frames.slice(1) : frames,
        origin,
        "public",
      );
    }
    if (action.startsWith("predict-")) {
      const detected = before.round === 3,
        correct = (action === "predict-detected") === detected;
      if (correct) x.predictionAnswered = true;
      return evaluate(
        correct,
        detected
          ? "BobはCAで確認したAliceの公開鍵で署名を検証する。Charlieの署名はAliceの署名として通らないため、Bobは偽の本文を拒否する。"
          : before.impersonating
            ? "BobはCAでAliceの公開鍵を確認したが、届いた本文の署名は確かめていない。Charlieが用意した共通鍵と本文でも、BobはAliceから届いたものだと誤認する。"
            : "Bobには本文の変更を確かめる署名がない。Charlieが同じ共通鍵で暗号化し直すと、Bobは変更に気づけない。",
        [],
        origin,
        "prediction",
      );
    }
    if (!key || !availableKeys(before).some((a) => a.id === key.id)) return [];
    let response;
    if (["read", "open-key"].includes(action))
      response = lab.decrypt(before.incoming.id, key.id);
    if (["rewrap", "inject-key"].includes(action))
      response = lab.wrapKey(x.payloadKey.id, key.id);
    if (action === "edit") {
      lab.edit("I hate you.");
      response = lab.encryptMessage(key.id);
    }
    if (!response) return [];
    if (!response.ok) {
      const reason =
        action === "sign"
          ? "電子署名を作るには秘密鍵を使う。Aliceの公開鍵はAliceの署名の検証用で、Aliceの署名は作れない。Charlieが使える署名用秘密鍵はCharlie自身の鍵だけだ。"
          : action === "open-key"
            ? before.publicForAlice?.owner === "bob"
              ? "Bob宛ての共通鍵を取り出すにはBobの秘密鍵が必要。CharlieはBobの秘密鍵を持っていない。"
              : "Charlieの公開鍵で包まれた共通鍵は、対になるCharlieの秘密鍵で開ける。公開鍵では開けない。"
            : action === "read"
              ? before.impersonating
                ? "Aliceの本文はAliceの共通鍵で暗号化されている。CharlieがBobに送り込んだ共通鍵では復号できない。"
                : "本文は共通鍵で暗号化されている。暗号化に使われた同じ共通鍵を選ぼう。"
              : ["rewrap", "inject-key"].includes(action)
                ? "Bob宛てに共通鍵を暗号化するにはBobの公開鍵を使う。Bobは対になる秘密鍵で共通鍵を取り出す。"
                : "本文の暗号化には共通鍵を使う。公開鍵や秘密鍵は、この本文の暗号化には使わない。";
      return evaluate(false, reason, [], origin, action);
    }
    if (action === "open-key")
      return evaluate(
        true,
        "Charlieの公開鍵と対になるCharlieの秘密鍵で、共通鍵を取り出せた。",
        [
          frame(
            "Charlieは、Charlieの秘密鍵で共通鍵を取り出した。",
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
    if (["rewrap", "inject-key"].includes(action))
      return evaluate(
        key.owner === "bob",
        key.owner === "bob"
          ? action === "inject-key"
            ? "Charlieが選んだ共通鍵をBobの公開鍵で暗号化した。Bobは、対になるBobの秘密鍵でその共通鍵を取り出せる。"
            : "Bobの公開鍵で包み直したので、BobはBobの秘密鍵で同じ共通鍵を取り出せる。"
          : "Charlieの公開鍵で暗号化するとCharlie宛てになる。Bobが開けるように、Bobの公開鍵を選ぼう。",
        [
          frame(
            action === "inject-key"
              ? "Charlieは、Charlieの共通鍵を" + key.label + "で暗号化した。"
              : "Charlieは、共通鍵を" + key.label + "で暗号化し直した。",
            "wrap",
            {
              ...base,
              kind: "wrapped-key",
              packet: lab.snapshot().outgoing,
              packetLabel: "共通鍵の暗号文",
            },
          ),
        ],
        origin,
        action,
      );
    return evaluate(
      true,
      before.round === 3
        ? "BobはCharlieの共通鍵で復号できても、Aliceの公開鍵でCharlieの署名を検証できないため、偽の本文を拒否する。"
        : before.impersonating
          ? "BobはCharlieの共通鍵で復号できる。送信者を確かめる署名がないため、BobはCharlieの本文をAliceの本文だと思って受け付ける。"
          : "Bobは同じ共通鍵で復号できる。本文の変更を確かめる署名がないため、Bobは改ざんに気づかない。",
      [
        frame(
          before.impersonating
            ? "Charlieは、自作の「I hate you.」をCharlieの共通鍵で暗号化した。"
            : "Charlieは、本文を「I hate you.」に変え、同じ共通鍵で暗号化し直した。",
          "encrypt",
          {
            ...base,
            kind: "ciphertext",
            packet: lab.snapshot().outgoing,
            signatureOwner: lab.snapshot().outgoingSignature?.owner,
            showPlaintext: true,
          },
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
    confirm,
    checkpoint,
    cancel() {
      x.pending = null;
      if (x.feedback?.inline) x.feedback = null;
      if (x.selectingKey?.stage === "wrapping") {
        x.selectingKey = {
          ...x.selectingKey,
          stage: "payload",
          selectedId: null,
        };
        x.payloadKey = null;
      } else x.selectingKey = null;
    },
  };
}

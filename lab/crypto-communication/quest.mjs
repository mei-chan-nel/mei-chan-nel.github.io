import { createLab } from "./model.mjs?v=18";
import {
  frame,
  forwardFrames,
  roundFrames,
  outcomeFrame,
  packetKind,
  englishNames,
} from "./storyboard.mjs?v=14";
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
    signatureSelected: false,
    consequence: false,
  });
  let x = initial(),
    records = new Set(),
    retryPoint = null;
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
  function start(round = 0) {
    lab.start(round);
    x = initial();
    records = new Set();
    retryPoint = null;
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
      title: "Bobへ共通鍵を送る鍵",
      target: "入手した共通鍵",
      verb: "暗号化",
    },
    "inject-key": {
      title: "Bobへ共通鍵を送る鍵",
      target: "Charlieの共通鍵",
      verb: "暗号化",
    },
    sign: {
      title: "偽の本文に署名する鍵",
      target: "偽の本文",
      verb: "署名",
    },
    edit: {
      title: "本文を暗号化する鍵",
      target: "Bobに送る本文",
      verb: "暗号化",
    },
  };
  function choices(s = lab.snapshot()) {
    if (x.feedback)
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
    if (s.phase === "signing-public")
      return [
        choice(
          "swap-signing-key",
          "偽のAliceの証明書にすり替える",
          "Aliceの名前を付けた偽の証明書",
        ),
        choice(
          "send-signing-key",
          "Aliceの証明書をBobへ送る",
          "CAが署名した本物の証明書",
        ),
      ];
    if (s.phase === "public")
      return [
        choice(
          "swap",
          s.ca ? "偽のBobの証明書にすり替える" : "Charlieの公開鍵にすり替える",
          s.ca ? "Bobの名前を付けた偽の証明書" : "AliceにCharlieの鍵を渡す",
        ),
        choice(
          "send-public",
          s.ca ? "Bobの証明書をそのまま送る" : "Bobの公開鍵をそのまま送る",
          "Aliceに本物のBobの鍵を渡す",
        ),
      ];
    if (s.phase === "key") {
      if (s.round >= 2)
        return [
          choice(
            "open-key",
            "届いた共通鍵の暗号文を開く",
            "復号に使う鍵を選ぶ",
          ),
          choice(
            "inject-key",
            "Charlieの共通鍵に差し替える",
            "Charlie自身の新しい鍵をBob宛てに暗号化する",
          ),
        ];
      return [
        shared(s)
          ? choice(
              "rewrap",
              "共通鍵を包み直す",
              "Bobが開けるようにする鍵を選ぶ",
            )
          : choice("open-key", "共通鍵の暗号文を開く", "復号に使う鍵を選ぶ"),
      ];
    }
    if (!s.read && !s.impersonating)
      return [choice("read", "本文の暗号文を開く", "復号に使う鍵を選ぶ")];
    if (!x.predictionAnswered)
      return [
        choice(
          "predict-safe",
          s.impersonating
            ? "差し替えてもBobにバレない"
            : "書き換えてもBobにバレない",
          "Bobは偽の本文を受け付ける？",
        ),
        choice(
          "predict-detected",
          s.impersonating
            ? "差し替えるとBobにバレる"
            : "書き換えるとBobにバレる",
          "Bobは偽の本文を拒否する？",
        ),
      ];
    if (s.round === 3 && !x.signatureSelected)
      return [choice("sign", "偽の本文に署名する", "署名に使う鍵を選ぶ")];
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
      find(s, "verify", "alice"),
    ]
      .filter(Boolean)
      .map((a) => ({
        id: a.id,
        type: a.type,
        owner: a.owner,
        label: englishNames(a.label),
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
    const state =
      s.phase === "done"
        ? "result"
        : x.feedback
          ? "feedback"
          : s.outgoing
            ? "ready"
            : s.phase === "message" && (s.read || s.impersonating)
              ? !x.predictionAnswered
                ? "predict"
                : s.round === 3 && !x.signatureSelected
                  ? "sign"
                  : "edit"
              : s.phase;
    const prompts = {
      "signing-public":
        "Aliceの証明書が届いた。BobはCA署名とAliceという相手名を確認してから、検証用公開鍵を登録する。",
      public: s.ca
        ? "Bobの証明書が届いた。Aliceはブラウザ内のCA公開鍵で、CA署名とBobという相手名を確かめる。"
        : "Bobの公開鍵が届いた。Aliceに渡す公開鍵を選ぼう。",
      key:
        s.round === 0
          ? "Charlieは共通鍵を入手した。Charlieが鍵をBobへ届けると、Aliceは本文を送る。"
          : s.ca
            ? "届いた暗号文はBob宛て。Charlieが読めないなら、Charlie自身の共通鍵をBobに送り込めるだろうか。"
            : key
              ? "Charlieは共通鍵を入手した。Bobも同じ共通鍵を取り出せるようにしよう。"
              : "Aliceが送った共通鍵は暗号化されている。どの鍵で開けるだろうか。",
      message: "本文の暗号文が届いた。復号に使う鍵を選ぼう。",
      predict: s.impersonating
        ? "CharlieはAliceの本文を読めない。Charlieは自作の「I hate you.」を、Aliceの本文としてBobへ送ろうとしている。"
        : "Charlieは「love」を「hate」に変えたい。Bobは本文の変更に気づくだろうか。",
      sign: "Charlieは偽の本文「I hate you.」に署名しようとしている。どの鍵で署名を作れるだろうか。",
      edit: s.impersonating
        ? "Bobが持っているのは、Charlieが送り込んだ共通鍵だ。偽の本文をBobが復号できる形にしよう。"
        : "Charlieが考えた書き換えを、実際の暗号文にしてみよう。",
      ready: "Charlieが選んだデータを、相手へ転送しよう。",
    };
    const shown =
      s.phase === "done"
        ? outcomeFrame(s)
        : frame("", "intercept", {
            phase: s.phase,
            kind: packetKind(s.outgoing || s.incoming),
            packetLabel: englishNames((s.outgoing || s.incoming).label),
            route:
              s.phase === "public"
                ? "Bob → 中継機 → Alice"
                : "Alice → 中継機 → Bob",
          });
    return {
      ...s,
      state,
      prompt: x.feedback?.explanation || prompts[state],
      choices: choices(s),
      pending: x.pending ? copy(x.pending) : null,
      selectingKey: x.selectingKey
        ? {
            ...x.selectingKey,
            keys: availableKeys(s),
            allowPass: !["sign", "inject-key"].includes(x.selectingKey.action),
          }
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
          ? x.consequence
            ? "wrong"
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
    if (keyOperations[id]) {
      if (id === "inject-key") lab.createAttackerKey();
      if (id === "sign") lab.edit("I hate you.");
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
    x.pending = { id: x.selectingKey.action, key };
    return true;
  }
  function selectPass() {
    if (
      !x.selectingKey ||
      ["sign", "inject-key"].includes(x.selectingKey.action)
    )
      return false;
    x.pending = { id: "pass", operation: x.selectingKey.action };
    return true;
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
    return forwardFrames(before, lab.snapshot());
  }
  function showConsequence() {
    const feedback = x.feedback;
    x.feedback = null;
    x.feedbackFrames = [];
    x.pending = null;
    x.selectingKey = null;
    x.consequence = true;
    const frames = [];
    if (["prediction", "sign"].includes(feedback?.kind)) {
      const s = lab.snapshot();
      lab.edit("I hate you.");
      if (s.round === 3 && feedback.kind === "prediction")
        lab.signDraft(find(s, "private", "charlie").id);
      const made = lab.encryptMessage(shared(s).id);
      lab.setOutgoing(made.id);
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
      return evaluate(
        !before.ca,
        before.ca
          ? `${signing ? "Bob" : "Alice"}は事前登録のCA公開鍵で証明書を検証する。CharlieはCAの秘密鍵を持たないため、名前と鍵を偽った証明書は受け付けられない。`
          : "AliceがCharlieの公開鍵を使えば、Charlieは対になる秘密鍵で共通鍵を取り出せる。",
        [
          frame(
            "Charlieは、" +
              (before.ca ? "公開鍵証明書" : "Bobの公開鍵") +
              "をすり替えた。",
            "replace",
            {
              ...base,
              at: "relay",
              kind: before.ca ? "certificate" : "public",
              packetLabel: before.ca ? "偽の証明書" : "Charlieの公開鍵",
            },
          ),
        ],
        origin,
        signing ? "signing-key" : "public",
      );
    }
    if (["send-public", "send-signing-key"].includes(action)) {
      if (before.ca) lab.setOutgoing(before.incoming.id);
      return evaluate(
        Boolean(before.ca),
        before.ca
          ? action === "send-signing-key"
            ? "BobはCA署名とAliceという相手名を確認し、本物のAliceの公開鍵を登録できる。Charlieの鍵へのすり替えは通用しない。"
            : "Aliceは証明書から本物のBobの公開鍵を確認できる。CharlieはBobの秘密鍵を持たないため、Aliceの共通鍵を取り出せない。"
          : "Bobの公開鍵に対応するのはBobの秘密鍵。Charlieが共通鍵を手に入れるには、Aliceに渡す公開鍵を考え直そう。",
        [],
        origin,
        "public",
      );
    }
    if (action === "pass")
      return evaluate(
        false,
        pending.operation === "rewrap"
          ? "届いた共通鍵の暗号文はCharlie宛て。Bobの秘密鍵では開けない。Bob宛てに包み直そう。"
          : pending.operation === "edit"
            ? "元の暗号文のままでは、Charlieが用意した本文はBobに届かない。"
            : "そのまま送ると、Charlieは本文を確かめずに通信を進める。Charlieが読むには、暗号文と対応する鍵が必要だ。",
        [],
        origin,
        "pass",
      );
    if (action.startsWith("predict-")) {
      const detected = before.round === 3,
        correct = (action === "predict-detected") === detected;
      if (correct) x.predictionAnswered = true;
      return evaluate(
        correct,
        detected
          ? "BobはCAで確認したAliceの公開鍵で署名を検証する。Charlieの署名はAliceの署名として通らないため、Bobは偽の本文を拒否する。"
          : before.impersonating
            ? "CAが保証したのはBobの公開鍵。Bobは送信者を確認していないため、Charlieが用意した共通鍵と偽の本文でも受け付けてしまう。"
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
      response = lab.wrapKey(shared(before).id, key.id);
    if (action === "sign") response = lab.signDraft(key.id);
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
    if (action === "sign") {
      x.signatureSelected = true;
      return evaluate(
        true,
        "Charlieの秘密鍵でCharlieの署名を作れた。ただし、Bobが確認したのはAliceの公開鍵なので、この署名はAliceの署名としては通らない。",
        [
          frame(
            "Charlieは、偽の本文にCharlieの秘密鍵で電子署名を作った。",
            "sign-charlie",
            { ...base, kind: "letter", showPlaintext: true },
          ),
        ],
        origin,
        action,
      );
    }
    lab.setOutgoing(response.id);
    x.stagedKey = key;
    if (["rewrap", "inject-key"].includes(action))
      return evaluate(
        key.owner === "bob",
        key.owner === "bob"
          ? action === "inject-key"
            ? "Bobの公開鍵は誰でも使える。Charlie自身の共通鍵もBob宛てに暗号化できる。Bobは復号できても、共通鍵を送った人がAliceかはまだ分からない。"
            : "Bobの公開鍵で包み直したので、BobはBobの秘密鍵で同じ共通鍵を取り出せる。"
          : "Charlieの公開鍵で暗号化するとCharlie宛てになる。Bobが開けるように、Bobの公開鍵を選ぼう。",
        [
          frame(
            action === "inject-key"
              ? "Charlieは、Charlieの共通鍵をBobの公開鍵で暗号化した。"
              : "Charlieは、共通鍵を" + key.label + "で暗号化し直した。",
            "wrap",
            { ...base, kind: "wrapped-key" },
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
          { ...base, kind: "ciphertext", showPlaintext: true },
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
      x.pending = null;
      x.selectingKey = null;
    },
  };
}

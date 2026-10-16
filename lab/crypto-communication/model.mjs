// Ideal cryptography model: ciphertexts and signatures are opaque capabilities.
// Deliberately abstracts arithmetic, encodings, length and bit-level attacks.
const uid = () => globalThis.crypto.randomUUID();
export const rounds = [
  {
    title: "共通鍵暗号方式",
    short: "共通鍵",
    description: "共通鍵を、そのまま通信経路で届ける。",
    stages: ["共通鍵の配送", "暗号文の送信"],
  },
  {
    title: "公開鍵暗号方式の導入",
    short: "公開鍵",
    description: "公開鍵で共通鍵を包み、本文は共通鍵で暗号化する。",
    stages: ["公開鍵の配送", "共通鍵の配送", "暗号文の送信"],
  },
  {
    title: "電子署名の導入",
    short: "電子署名",
    description: "本文にアリスの署名を付け、ボブが信頼済みの公開鍵で検証する。",
    stages: ["公開鍵の配送", "共通鍵の配送", "署名付き暗号文の送信"],
  },
  {
    title: "公開鍵の真正性も確かめる",
    short: "追加実験",
    description: "アリスも、ボブの公開鍵を信頼済みの情報と照合する。",
    stages: ["公開鍵の確認", "共通鍵の配送", "署名付き暗号文の送信"],
  },
];
export function createLab() {
  const objects = new Map();
  const secrets = new Map();
  const known = new Set();
  const history = [];
  let counter = 0;
  let s;
  const make = (type, label, data = {}) => {
    const id = uid();
    objects.set(id, { id, type, label, ...data });
    return id;
  };
  const pubB = make("public", "ボブの公開鍵", {
    owner: "bob",
    fingerprint: "B0B7 · 29AF · 613C",
  });
  const pubC = make("public", "チャーリーの公開鍵", {
    owner: "charlie",
    fingerprint: "C4A1 · 7E82 · 0D95",
  });
  const privC = make("private", "チャーリーの秘密鍵", { owner: "charlie" });
  const pubA = make("verify", "アリスの検証用公開鍵（信頼済み）", {
    owner: "alice",
  });
  known.add(pubC);
  known.add(privC);
  const event = (text, kind = "info") => {
    s.log.push({ text, kind });
    return { ok: kind !== "error", text };
  };
  const cipher = (type, key, payload, label) => {
    const id = make(type, label, {
      token: `⟦ ${uid()
        .replaceAll("-", "")
        .slice(0, 24)
        .match(/.{1,4}/g)
        .join(" ")} ⟧`,
    });
    secrets.set(id, { key, payload });
    return id;
  };
  const envelope = (key, publicId) =>
    cipher("envelope", publicId, key, "公開鍵で暗号化した共通鍵");
  const signature = (text, owner) => {
    const id = make(
      "signature",
      `${owner === "alice" ? "アリス" : "チャーリー"}の電子署名`,
      { token: `SIG · ${uid().slice(0, 12)}` },
    );
    secrets.set(id, { text, owner });
    return id;
  };
  const packet = (text, key, sig = null) =>
    cipher(
      "ciphertext",
      key,
      { text, signature: sig },
      sig ? "署名を添えた本文の暗号文" : "本文の暗号文",
    );
  function view(id) {
    const a = objects.get(id);
    if (!a) return null;
    // No payload/key reference of sealed objects is exposed to the interface.
    return { ...a, current: a.type === "symmetric" ? id === s.key : undefined };
  }
  const inventory = () => [...known].map(view);
  function start(round = 0, authenticate = true) {
    if (s)
      history.push({ round: s.round, result: s.result?.code ?? "restart" });
    // Keep learned keys, but clear working data between independent attempts.
    for (const id of known)
      if (
        !["symmetric", "public", "private", "verify"].includes(
          objects.get(id).type,
        )
      )
        known.delete(id);
    counter++;
    s = {
      round,
      authenticate,
      phase: round === 0 ? "key" : "public",
      step: 0,
      count: counter,
      key: make("symmetric", `共通鍵 K${counter}`, {
        token: uid().slice(0, 16).toUpperCase(),
      }),
      alicePublic: null,
      bobKey: null,
      originalCipher: null,
      incoming: null,
      outgoing: null,
      log: [],
      read: false,
      revealed: [],
      draft: "",
      attachedSignature: null,
      signatureChoice: "keep",
      result: null,
      decryptResult: null,
    };
    if (round >= 2) known.add(pubA);
    s.incoming = round === 0 ? s.key : pubB;
    event(`${rounds[round].title}を開始。共通鍵は新しく生成されました。`);
    return snapshot();
  }
  function snapshot() {
    return {
      round: s.round,
      authenticate: s.authenticate,
      phase: s.phase,
      step: s.step,
      count: s.count,
      incoming: view(s.incoming),
      outgoing: view(s.outgoing),
      inventory: inventory(),
      read: s.read,
      draft: s.draft,
      signature: view(s.attachedSignature),
      signatureChoice: s.signatureChoice,
      decryptResult: s.decryptResult,
      result: s.result
        ? {
            ...s.result,
            eavesdropped: s.read,
            ...(s.result.hiddenMessage && s.read
              ? { hiddenMessage: false, message: "I love you." }
              : {}),
            ...(s.result.code === "attack-success"
              ? {
                  title: s.read
                    ? "盗聴・改ざんに成功"
                    : "改ざんは受理。盗聴は未達成",
                }
              : {}),
          }
        : null,
      log: [...s.log],
      history: [...history],
      bobHasKey: Boolean(s.bobKey),
      publicForAlice: view(s.alicePublic),
      original: s.read ? "I love you." : null,
      trustedFingerprint: s.round === 3 ? objects.get(pubB).fingerprint : null,
    };
  }
  function capture() {
    if (s.phase === "done")
      return event(
        "通信は終了しています。新しい通信で再実験できます。",
        "error",
      );
    known.add(s.incoming);
    return event(
      `${objects.get(s.incoming).label}を手元にコピーしました。通信はまだ止まっています。`,
    );
  }
  function decrypt(id, keyId) {
    if (!known.has(id) || !known.has(keyId))
      return event("コピーした暗号文と、使う鍵を選んでください。", "error");
    const a = objects.get(id),
      key = objects.get(keyId),
      sealed = secrets.get(id);
    if (!sealed || !["envelope", "ciphertext"].includes(a.type))
      return event("選んだデータは復号できる暗号文ではありません。", "error");
    if (a.type === "envelope") {
      if (
        key.type !== "private" ||
        objects.get(sealed.key)?.owner !== key.owner
      ) {
        return event(
          "復号失敗。この暗号文を開けるには、暗号化に使われた公開鍵と対になる秘密鍵が必要です。公開鍵だけでは開けません。",
          "error",
        );
      }
      known.add(sealed.payload);
      s.decryptResult = {
        kind: "key",
        label: objects.get(sealed.payload).label,
      };
      return event("復号成功。共通鍵を鍵置き場に追加しました。");
    }
    if (key.type !== "symmetric" || sealed.key !== keyId) {
      return event(
        "復号失敗。本文を暗号化した共通鍵と一致しません。前の通信の鍵も使えません。",
        "error",
      );
    }
    s.draft = sealed.payload.text;
    s.attachedSignature = sealed.payload.signature;
    s.signatureChoice = "keep";
    if (s.attachedSignature) known.add(s.attachedSignature);
    s.revealed.push(id);
    if (id === s.originalCipher) s.read = true;
    s.decryptResult = { kind: "message", label: sealed.payload.text };
    return event(
      "復号成功。平文を作業台に開きました。編集して、別の暗号文を作れます。",
    );
  }
  function edit(text) {
    s.draft = String(text).slice(0, 500);
  }
  function chooseSignature(choice) {
    s.signatureChoice = choice;
  }
  function encryptMessage(keyId) {
    if (!known.has(keyId) || objects.get(keyId)?.type !== "symmetric")
      return event("本文の暗号化には、手元の共通鍵を選んでください。", "error");
    if (!s.draft.trim())
      return event(
        "暗号化する平文を入力してください。復号前でも、自分で文を作れます。",
        "error",
      );
    const sig =
      s.signatureChoice === "charlie"
        ? signature(s.draft, "charlie")
        : s.signatureChoice === "none"
          ? null
          : s.attachedSignature;
    const id = packet(s.draft, keyId, sig);
    known.add(id);
    s.lastCreated = id;
    return {
      ...event(
        "編集内容を暗号化しました。持ち物に追加しました。送るデータとしてセットできます。",
      ),
      id,
    };
  }
  function wrapKey(keyId, publicId) {
    if (!known.has(keyId) || objects.get(keyId)?.type !== "symmetric")
      return event("包み直す共通鍵を選んでください。", "error");
    if (!known.has(publicId) || objects.get(publicId)?.type !== "public")
      return event("配送先の公開鍵を選んでください。", "error");
    const id = envelope(keyId, publicId);
    known.add(id);
    return {
      ...event(
        "共通鍵を公開鍵で暗号化しました。通信へのセットと転送は別の操作です。",
      ),
      id,
    };
  }
  function corrupt(id) {
    if (
      !known.has(id) ||
      !["ciphertext", "envelope"].includes(objects.get(id)?.type)
    )
      return event("編集する暗号文を選んでください。", "error");
    const a = objects.get(id);
    const broken = make(a.type, "直接編集した暗号文", {
      token: `${a.token.slice(0, -2)} FF ⟧`,
    });
    known.add(broken);
    return {
      ...event(
        "暗号文の一部を直接書き換えました。このモデルでは有効な暗号文を作るには対応する鍵が必要です。",
      ),
      id: broken,
    };
  }
  function setOutgoing(id = null) {
    if (s.phase === "done") return event("通信は終了しています。", "error");
    if (id && !known.has(id))
      return event("手元のデータを選んでください。", "error");
    s.outgoing = id;
    return event(
      id
        ? `${objects.get(id).label}を送信内容にセットしました。まだ転送していません。`
        : "送信内容を元のデータに戻しました。",
    );
  }
  function finish(code, title, text, accepted = false, message = null) {
    s.phase = "done";
    s.result = {
      code,
      title,
      text,
      accepted,
      message:
        message && (s.read || message !== "I love you.") ? message : null,
      hiddenMessage: accepted && !s.read && message === "I love you.",
      eavesdropped: s.read,
    };
    event(title, accepted ? "info" : "error");
  }
  function forward() {
    if (s.phase === "done") return event("通信は終了しています。", "error");
    const id = s.outgoing || s.incoming,
      a = objects.get(id),
      sealed = secrets.get(id);
    if (s.phase === "public") {
      if (a.type !== "public") {
        finish(
          "bad-public",
          "アリスが鍵を受け付けませんでした",
          "公開鍵として使えないデータです。通信は中断され、本文は送られません。",
        );
        return;
      }
      if (s.round === 3 && s.authenticate && id !== pubB) {
        finish(
          "authenticated",
          "すり替えを検出。鍵配送の前に停止",
          "受け取った公開鍵の指紋が、信頼済みのボブの指紋と一致しません。アリスは共通鍵を送らないので、チャーリーは本文を盗み見られません。署名による改ざん検出と、通信相手の公開鍵の確認を組み合わせます。",
        );
        return;
      }
      s.alicePublic = id;
      s.incoming = envelope(s.key, id);
      s.phase = "key";
      s.step++;
      event(
        "アリスが受け取った公開鍵で共通鍵を暗号化しました。暗号化された共通鍵が経路上で停止中。",
      );
    } else if (s.phase === "key") {
      const deliveredKey =
        s.round === 0 && a.type === "symmetric"
          ? id
          : a.type === "envelope" && sealed && sealed.key === pubB
            ? sealed.payload
            : null;
      if (!deliveredKey) {
        finish(
          "bad-key",
          "ボブが共通鍵を取得できませんでした",
          s.round === 0
            ? "この段階でボブが待っているのは共通鍵です。別の種類のデータは共通鍵として使えません。"
            : "ボブが開けるのは、自分の公開鍵で暗号化された共通鍵です。チャーリー宛ての暗号文は、ボブの秘密鍵では開きません。",
        );
        return;
      }
      s.bobKey = deliveredKey;
      const sig = s.round >= 2 ? signature("I love you.", "alice") : null;
      s.incoming = packet("I love you.", s.key, sig);
      s.originalCipher = s.incoming;
      s.phase = "message";
      s.step++;
      event(
        "ボブが共通鍵を取得。アリスが本文を共通鍵で暗号化して送りました。本文の送信前で停止中。",
      );
    } else {
      if (a.type !== "ciphertext" || !sealed || sealed.key !== s.bobKey) {
        finish(
          "bad-message",
          "ボブが本文を復号できませんでした",
          "受け取ったデータとボブの共通鍵が対応していません。鍵の配送先や、再暗号化に使った鍵を見直せます。",
        );
        return;
      }
      const { text, signature: sig } = sealed.payload;
      if (s.round >= 2) {
        const proof = secrets.get(sig);
        if (!proof || proof.owner !== "alice" || proof.text !== text) {
          finish(
            "signature-rejected",
            "署名検証に失敗。ボブは拒否しました",
            s.read
              ? "盗聴はできましたが、改ざんは受け付けられません。アリスの署名は元の内容に結び付いています。共通鍵で再暗号化しても署名は作り直せず、チャーリーの署名や署名の削除でも、信頼済みのアリスの公開鍵による検証を通せません。"
              : "アリスの信頼済み公開鍵で署名を検証できません。本文の変更、署名の削除、別人による署名をボブが検出しました。",
          );
          return;
        }
      }
      if (text === "I hate you.") {
        finish(
          "attack-success",
          s.read ? "盗聴・改ざんに成功" : "改ざんは受理。盗聴は未達成",
          s.round === 0
            ? "鍵を知る人は、本文を読めるだけでなく、別の本文を暗号化して送れます。共通鍵を同じ経路で平文配送したため、機密性と完全性が破られました。"
            : "公開鍵で共通鍵を包んでも、その公開鍵の持ち主を確かめなければ、間に入った人が共通鍵を取得できます。暗号化だけでは通信相手の認証や改ざん検出は保証できません。",
          true,
          text,
        );
      } else {
        finish(
          "original-accepted",
          "ボブがメッセージを受け付けました",
          s.round >= 2
            ? "アリスの署名が本文と一致しました。署名は完全性と送信者の確認を支えますが、本文を隠す機能はありません。鍵のすり替えが可能なら、盗聴は依然として可能です。"
            : "狙った改ざんには至りませんでした。経路上のデータを集め、鍵の役割を調べて再実験できます。",
          true,
          text,
        );
      }
    }
    s.outgoing = null;
  }
  start();
  return {
    snapshot,
    start,
    capture,
    decrypt,
    edit,
    chooseSignature,
    encryptMessage,
    wrapKey,
    corrupt,
    setOutgoing,
    forward,
  };
}

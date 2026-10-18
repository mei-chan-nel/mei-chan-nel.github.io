// Ideal cryptography model: ciphertexts and signatures are opaque capabilities.
// Deliberately abstracts arithmetic, encodings, length and bit-level attacks.
const uid = () => globalThis.crypto.randomUUID();
export const rounds = [
  {
    title: "共通鍵暗号方式",
    short: "共通鍵",
    description: "Aliceが共通鍵を平文でBobへ届ける。",
    stages: ["共通鍵の配送", "暗号文の送信"],
  },
  {
    title: "公開鍵暗号方式の導入",
    short: "公開鍵",
    description: "Aliceが公開鍵で共通鍵を暗号化し、共通鍵で本文を暗号化する。",
    stages: ["公開鍵の配送", "共通鍵の配送", "暗号文の送信"],
  },
  {
    title: "電子署名の導入",
    short: "電子署名",
    description:
      "Aliceが署名を付けるが、検証用公開鍵の持ち主はまだ確認していない。",
    stages: ["公開鍵の配送", "共通鍵の配送", "署名付き暗号文の送信"],
  },
  {
    title: "公開鍵の真正性も確かめる",
    short: "追加実験",
    description:
      "認証局の証明書と、ブラウザ内の信頼済みCA公開鍵で相手の鍵を確認する。",
    stages: ["Bobの証明書の検証", "共通鍵の配送", "署名付き暗号文の送信"],
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
  const pubA = make("verify", "アリスの検証用公開鍵", {
    owner: "alice",
    fingerprint: "A11C · 58E2 · 9D30",
  });
  const verifyC = make("verify", "チャーリーの検証用公開鍵", {
    owner: "charlie",
    fingerprint: "C519 · 84B7 · 2E61",
  });
  // Trust anchor is provisioned with the browser, never imported from a packet.
  const caRoot = make("trust", "ブラウザに事前登録されたCA公開鍵", {
    owner: "ca",
    fingerprint: "CA01 · 73D8 · 5A20",
  });
  const certify = (subject, publicId, signer = caRoot) => {
    const id = make(
      "certificate",
      `${signer !== caRoot ? "偽の" : ""}${subject === "alice" ? "Alice" : subject === "bob" ? "Bob" : "Charlie"}の公開鍵証明書`,
      {
        owner: subject,
        publicId,
        issuer: "認証局 CA",
        fingerprint: objects.get(publicId).fingerprint,
      },
    );
    secrets.set(id, { certificate: { subject, publicId, signer } });
    return id;
  };
  const certA = certify("alice", pubA),
    certB = certify("bob", pubB),
    certC = certify("charlie", pubC);
  function validateCertificate(id, expectedOwner) {
    const item = objects.get(id),
      proof = secrets.get(id)?.certificate;
    if (
      !item ||
      item.type !== "certificate" ||
      !proof ||
      proof.signer !== caRoot ||
      proof.subject !== item.owner ||
      proof.publicId !== item.publicId
    )
      return {
        ok: false,
        reason: "ca-signature",
        text: "ブラウザに事前登録されたCA公開鍵では、証明書のCA署名を検証できない。",
      };
    if (proof.subject !== expectedOwner)
      return {
        ok: false,
        reason: "identity",
        text: "CA署名は正しいが、証明書の相手名が通信相手と一致しない。",
      };
    return {
      ok: true,
      keyId: proof.publicId,
      key: { ...objects.get(proof.publicId) },
      reason: "verified",
    };
  }
  function forgeCertificate(publicId, claimedOwner = "bob") {
    if (
      !known.has(publicId) ||
      !["public", "verify"].includes(objects.get(publicId)?.type)
    )
      return event("Charlieが持つ公開鍵を選んでください。", "error");
    // Charlie can sign a certificate, but cannot sign as the trusted CA.
    const id = certify(claimedOwner, publicId, pubC);
    known.add(id);
    return {
      ...event(
        "Charlieは、自分の公開鍵を相手の鍵と偽る証明書を作りました。CAの正しい署名はありません。",
      ),
      id,
    };
  }
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
      { token: `SIG · ${uid().slice(0, 12)}`, owner },
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
  function start(
    round = 0,
    authenticate = true,
    authenticateSigner = round !== 2,
  ) {
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
      authenticateSigner,
      verificationPublic: authenticateSigner
        ? round === 3
          ? validateCertificate(certA, "alice").keyId
          : pubA
        : verifyC,
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
      deliveredSignature: null,
      signatureChoice: "keep",
      result: null,
      decryptResult: null,
    };
    if (round >= 2) {
      known.add(pubA);
      if (!authenticateSigner) known.add(verifyC);
      if (round === 3) known.add(certC);
    }
    s.incoming = round === 0 ? s.key : round === 3 ? certB : pubB;
    event(`${rounds[round].title}を開始。共通鍵は新しく生成されました。`);
    return snapshot();
  }
  function snapshot() {
    return {
      ca:
        s.round === 3
          ? {
              root: view(caRoot),
              aliceCertificate: view(certA),
              bobCertificate: view(certB),
              charlieCertificate: view(certC),
            }
          : null,
      round: s.round,
      authenticate: s.authenticate,
      authenticateSigner: s.authenticateSigner,
      verificationForBob: s.round >= 2 ? view(s.verificationPublic) : null,
      signingPublic: view(pubA),
      substituteSigningPublic: view(verifyC),
      outgoingSignature: view(secrets.get(s.outgoing)?.payload?.signature),
      deliveredSignature: view(s.deliveredSignature),
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
      trustedFingerprint: null,
    };
  }
  function capture() {
    if (s.phase === "done")
      return event(
        "Charlieは、終了した通信には介入できません。Charlieは、新しい通信で再実験できます。",
        "error",
      );
    known.add(s.incoming);
    if (objects.get(s.incoming)?.type === "certificate")
      known.add(secrets.get(s.incoming).certificate.publicId);
    return event(
      `Charlieは、${objects.get(s.incoming).label}を持ち物にコピーしました。Charlieは、データをまだ転送していません。`,
    );
  }
  function decrypt(id, keyId) {
    if (!known.has(id) || !known.has(keyId))
      return event(
        "Charlieが復号を試す暗号文と、Charlieが使う鍵を選んでください。",
        "error",
      );
    const a = objects.get(id),
      key = objects.get(keyId),
      sealed = secrets.get(id);
    if (!sealed || !["envelope", "ciphertext"].includes(a.type))
      return event(
        "Charlieは、選んだデータを暗号文として復号できません。",
        "error",
      );
    if (a.type === "envelope") {
      if (
        key.type !== "private" ||
        objects.get(sealed.key)?.owner !== key.owner
      ) {
        return event(
          "Charlieは、選んだ鍵で共通鍵を復号できません。Charlieには、暗号化に使われた公開鍵と対になる秘密鍵が必要です。",
          "error",
        );
      }
      known.add(sealed.payload);
      s.decryptResult = {
        kind: "key",
        label: objects.get(sealed.payload).label,
      };
      return event(
        "Charlieは、共通鍵の復号に成功しました。Charlieは、共通鍵を持ち物に加えました。",
      );
    }
    if (key.type !== "symmetric" || sealed.key !== keyId) {
      return event(
        "Charlieは、選んだ共通鍵で本文を復号できません。Charlieには、本文の暗号化に使われた共通鍵が必要です。",
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
      "Charlieは、本文の復号に成功しました。Charlieは、作業台の本文を編集し、別の暗号文を作れます。",
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
      return event(
        "Charlieが本文を暗号化するための共通鍵を選んでください。",
        "error",
      );
    if (!s.draft.trim())
      return event(
        "Charlieが暗号化する本文を入力してください。Charlieは、復号前でも本文を自分で作れます。",
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
        "Charlieは、作業台の本文を暗号化し、持ち物に加えました。Charlieは、新しい暗号文を送信候補に選べます。",
      ),
      id,
    };
  }
  function wrapKey(keyId, publicId) {
    if (!known.has(keyId) || objects.get(keyId)?.type !== "symmetric")
      return event("Charlieが包み直す共通鍵を選んでください。", "error");
    if (!known.has(publicId) || objects.get(publicId)?.type !== "public")
      return event(
        "Charlieが共通鍵の暗号化に使う、配送先の公開鍵を選んでください。",
        "error",
      );
    const id = envelope(keyId, publicId);
    known.add(id);
    return {
      ...event(
        "Charlieは、共通鍵を公開鍵で暗号化しました。Charlieは、新しい共通鍵の暗号文をまだ転送していません。",
      ),
      id,
    };
  }
  function corrupt(id) {
    if (
      !known.has(id) ||
      !["ciphertext", "envelope"].includes(objects.get(id)?.type)
    )
      return event("Charlieが直接書き換える暗号文を選んでください。", "error");
    const a = objects.get(id);
    const broken = make(a.type, "直接編集した暗号文", {
      token: `${a.token.slice(0, -2)} FF ⟧`,
    });
    known.add(broken);
    return {
      ...event(
        "Charlieは、暗号文の一部を直接書き換えました。Charlieは、このモデルで有効な暗号文を作るには対応する鍵を使う必要があります。",
      ),
      id: broken,
    };
  }
  function setOutgoing(id = null) {
    if (s.phase === "done") return event("通信は終了しています。", "error");
    if (id && !known.has(id))
      return event("Charlieが持っているデータを選んでください。", "error");
    s.outgoing = id;
    return event(
      id
        ? `Charlieは、${objects.get(id).label}を送信候補にセットしました。Charlieは、候補をまだ転送していません。`
        : "Charlieは、送信候補を中継機に届いた元のデータに戻しました。",
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
      const certificateKey =
        a.type === "certificate"
          ? secrets.get(id)?.certificate?.publicId
          : null;
      const publicId = certificateKey || (a.type === "public" ? id : null);
      if (s.round === 3 && s.authenticate) {
        const checked = validateCertificate(id, "bob");
        if (!checked.ok) {
          finish(
            "authenticated",
            "証明書のすり替えを検出。共通鍵の配送前に停止",
            checked.text +
              "Aliceは共通鍵を送らないため、Charlieは本文を読めません。",
          );
          return;
        }
      }
      if (!publicId) {
        finish(
          "bad-public",
          "Aliceが鍵を受け付けなかった",
          "公開鍵を取り出せないデータです。本文は送られません。",
        );
        return;
      }
      s.alicePublic = publicId;
      s.incoming = envelope(s.key, publicId);
      s.phase = "key";
      s.step++;
      event(
        "Aliceは、受け取った公開鍵で共通鍵を暗号化しました。Charlieの中継機は、共通鍵の暗号文を止めています。",
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
        "Bobは、共通鍵を取得しました。Aliceは、本文を共通鍵で暗号化して送りました。Charlieの中継機は、本文の暗号文を止めています。",
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
      s.deliveredSignature = sig;
      if (s.round >= 2) {
        const proof = secrets.get(sig);
        if (
          !proof ||
          proof.owner !== objects.get(s.verificationPublic).owner ||
          proof.text !== text
        ) {
          finish(
            "signature-rejected",
            "署名検証に失敗。ボブは拒否しました",
            !s.authenticateSigner
              ? "Bobが登録したのはCharlieの検証用公開鍵です。Aliceの元の署名を残しても、書き換えた本文に対応しません。登録された鍵と対になるCharlieの秘密鍵で新しい署名を作る必要があります。"
              : s.read
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
          s.round >= 2 && !s.authenticateSigner
            ? "Bobが検証用公開鍵の持ち主を確認せず、Charlieの鍵をAliceの鍵として登録したため、Charlie自身の署名が受理されました。Aliceの秘密鍵を盗んだわけではありません。"
            : s.round === 0
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
  // Learning-only time travel. The returned closure keeps sealed payloads
  // inside the model; neither checkpoints nor snapshots reveal their values.
  function checkpoint() {
    const clone = (value) => JSON.parse(JSON.stringify(value));
    const saved = {
      objects: clone([...objects]),
      secrets: clone([...secrets]),
      known: [...known],
      history: clone(history),
      state: clone(s),
      counter,
    };
    return () => {
      objects.clear();
      secrets.clear();
      known.clear();
      for (const [id, item] of clone(saved.objects)) objects.set(id, item);
      for (const [id, item] of clone(saved.secrets)) secrets.set(id, item);
      for (const id of saved.known) known.add(id);
      history.splice(0, history.length, ...clone(saved.history));
      s = clone(saved.state);
      counter = saved.counter;
    };
  }
  return {
    checkpoint,
    validateCertificate,
    forgeCertificate,
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

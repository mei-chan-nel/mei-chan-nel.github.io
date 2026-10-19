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
    title: "認証局 CA の導入",
    short: "認証局 CA",
    description:
      "AliceがBobの公開鍵を確認する。Bobは送信者も確認できるだろうか。",
    stages: [
      "Aliceの鍵を確認",
      "Bobの鍵を確認",
      "共通鍵の配送",
      "本文の差し替え",
    ],
  },
  {
    title: "鍵配送の電子署名と認証タグ",
    short: "署名と認証タグ",
    description:
      "Bobが鍵配送のAliceの署名を検証し、本文の認証タグで改ざんを検出する。",
    stages: [
      "Aliceの鍵を確認",
      "Bobの鍵を確認",
      "署名付き共通鍵の配送",
      "本文の認証タグを検証",
    ],
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
      `${signer !== caRoot ? "偽の" : ""}${subject === "alice" ? "Alice" : subject === "bob" ? "Bob" : "Charlie"}のCA登録済の公開鍵`,
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
  const cipher = (type, key, payload, label, metadata = {}) => {
    const id = make(type, label, {
      token: `⟦ ${uid()
        .replaceAll("-", "")
        .slice(0, 24)
        .match(/.{1,4}/g)
        .join(" ")} ⟧`,
      ...metadata,
    });
    secrets.set(id, { key, payload });
    return id;
  };
  const envelope = (key, publicId) =>
    cipher(
      "envelope",
      publicId,
      key,
      "公開鍵で暗号化した共通鍵",
      s.round === 3
        ? {
            sender: "alice",
            recipient: "bob",
            sessionId: s.sessionId,
            sequence: 0,
          }
        : {},
    );
  const signature = (text, owner, purpose = "message") => {
    const id = make(
      "signature",
      `${owner === "alice" ? "アリス" : "チャーリー"}の電子署名`,
      { token: `SIG · ${uid().slice(0, 12)}`, owner, purpose },
    );
    secrets.set(id, { text, owner, purpose });
    return id;
  };
  const deliveryContext = (item) =>
    JSON.stringify([
      "study-atlas/key-delivery/v1",
      item.token,
      item.sender,
      item.recipient,
      item.sessionId,
      item.sequence,
    ]);
  const attachDeliverySignature = (id, owner) => {
    const sig = signature(
      deliveryContext(objects.get(id)),
      owner,
      "key-delivery",
    );
    secrets.get(id).signature = sig;
    return sig;
  };
  const messageContext = (item) =>
    JSON.stringify([
      "study-atlas/message/v1",
      item.token,
      item.nonce,
      item.sender,
      item.recipient,
      item.sessionId,
      item.sequence,
    ]);
  function packet(text, key, sig = null) {
    const authenticated = s.round === 3;
    // A body signature is deliberately absent in Round 4. The AEAD tag
    // authenticates the ciphertext and its public session/sequence context.
    const id = cipher(
      "ciphertext",
      key,
      { text, signature: authenticated ? null : sig },
      authenticated
        ? "認証タグを添えた本文の暗号文"
        : sig
          ? "署名を添えた本文の暗号文"
          : "本文の暗号文",
      authenticated
        ? {
            authenticated: true,
            nonce: uid(),
            sender: "alice",
            recipient: "bob",
            sessionId: s.sessionId,
            sequence: s.messageSequence,
          }
        : {},
    );
    if (authenticated) {
      const tag = make("tag", "認証タグ", {
        token: `TAG · ${uid().slice(0, 12)}`,
      });
      secrets.set(tag, {
        key,
        context: messageContext(objects.get(id)),
      });
      secrets.get(id).tag = tag;
    }
    return id;
  }
  function validTag(item, sealed, keyId) {
    const proof = secrets.get(sealed?.tag);
    return Boolean(
      item?.authenticated &&
      item.type === "ciphertext" &&
      sealed?.key === keyId &&
      proof?.key === keyId &&
      proof.context === messageContext(item) &&
      item.sender === "alice" &&
      item.recipient === "bob" &&
      item.sessionId === s.sessionId &&
      item.sequence === s.messageSequence,
    );
  }
  function view(id) {
    const a = objects.get(id);
    if (!a) return null;
    // No payload/key reference of sealed objects is exposed to the interface.
    return {
      ...a,
      current:
        a.type === "symmetric"
          ? id === s.key || id === s.attackerKey
          : undefined,
    };
  }
  const inventory = () => [...known].map(view);
  function start(round = 0) {
    if (s)
      history.push({ round: s.round, result: s.result?.code ?? "restart" });
    known.clear();
    known.add(pubC);
    known.add(privC);
    counter++;
    s = {
      round,
      authenticate: round >= 2,
      authenticateSigner: round === 3,
      verificationPublic: null,
      phase: round === 0 ? "key" : round >= 2 ? "signing-public" : "public",
      step: 0,
      count: counter,
      sessionId: uid(),
      messageSequence: 0,
      key: make("symmetric", `共通鍵 K${counter}`, {
        token: uid().slice(0, 16).toUpperCase(),
        owner: "alice",
      }),
      attackerKey: null,
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
      deliveredTag: null,
      signatureChoice: "keep",
      result: null,
      decryptResult: null,
    };
    if (round >= 2) known.add(certC);
    if (round >= 2) known.add(verifyC);
    s.incoming =
      round === 0
        ? s.key
        : s.phase === "signing-public"
          ? certA
          : round >= 2
            ? certB
            : pubB;
    event(`${rounds[round].title}を開始。共通鍵は新しく生成されました。`);
    return snapshot();
  }
  function snapshot() {
    return {
      ca:
        s.round >= 2
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
      attackerKey: view(s.attackerKey),
      impersonating: Boolean(s.attackerKey && s.bobKey === s.attackerKey),
      signingPublic: view(pubA),
      substituteSigningPublic: view(verifyC),
      incomingSignature: view(
        secrets.get(s.incoming)?.signature ||
          secrets.get(s.incoming)?.payload?.signature,
      ),
      outgoingSignature: view(
        secrets.get(s.outgoing)?.signature ||
          secrets.get(s.outgoing)?.payload?.signature,
      ),
      deliveredSignature: view(s.deliveredSignature),
      incomingTag: view(secrets.get(s.incoming)?.tag),
      outgoingTag: view(secrets.get(s.outgoing)?.tag),
      deliveredTag: view(s.deliveredTag),
      phase: s.phase,
      step: s.step,
      count: s.count,
      sessionId: s.sessionId,
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
                    : "なりすましの本文が受理された",
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
    const sealed = secrets.get(s.incoming);
    if (sealed?.signature) known.add(sealed.signature);
    if (sealed?.tag) known.add(sealed.tag);
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
          "Charlieは、" +
            key.label +
            "では共通鍵の暗号文を復号できません。Charlieには、暗号化に使われた公開鍵と対になる秘密鍵が必要です。",
          "error",
        );
      }
      known.add(sealed.payload);
      s.decryptResult = {
        kind: "key",
        label: objects.get(sealed.payload).label,
      };
      return event(
        "Charlieは、共通鍵の暗号文を" +
          key.label +
          "で復号し、" +
          objects.get(sealed.payload).label +
          "を入手しました。",
      );
    }
    if (key.type !== "symmetric" || sealed.key !== keyId) {
      return event(
        "Charlieは、" +
          key.label +
          "では本文の暗号文を復号できません。Charlieには、本文の暗号化に使われた共通鍵が必要です。",
        "error",
      );
    }
    if (a.authenticated && !validTag(a, sealed, keyId))
      return event(
        "Charlieは、認証タグを検証できないため、本文を受け付けません。暗号文や通信の識別情報が変わっています。",
        "error",
      );
    s.draft = sealed.payload.text;
    s.attachedSignature = sealed.payload.signature;
    s.signatureChoice = "keep";
    if (s.attachedSignature) known.add(s.attachedSignature);
    s.revealed.push(id);
    if (id === s.originalCipher) s.read = true;
    s.decryptResult = { kind: "message", label: sealed.payload.text };
    return event(
      "Charlieは、本文の暗号文を" +
        key.label +
        "で復号しました。Charlieは、復号した本文を編集できます。",
    );
  }
  function edit(text) {
    s.draft = String(text).slice(0, 500);
  }
  function createAttackerKey() {
    if (!s.attackerKey)
      s.attackerKey = make("symmetric", `Charlieの共通鍵 C${counter}`, {
        token: uid().slice(0, 16).toUpperCase(),
        owner: "charlie",
      });
    known.add(s.attackerKey);
    return {
      ...event(
        "Charlieは、Charlie自身が使う新しい共通鍵を用意しました。Aliceの共通鍵とは別の鍵です。",
      ),
      id: s.attackerKey,
    };
  }
  function signDraft(keyId) {
    const key = objects.get(keyId);
    if (!known.has(keyId) || key?.type !== "private" || key.owner !== "charlie")
      return event(
        "Charlieが署名を作るには、Charlieの秘密鍵が必要です。Aliceの公開鍵でAliceの署名を作ることはできません。",
        "error",
      );
    if (!s.draft.trim()) return event("署名する本文がありません。", "error");
    s.attachedSignature = signature(s.draft, "charlie");
    known.add(s.attachedSignature);
    s.signatureChoice = "keep";
    return {
      ...event(
        "Charlieは、Charlieの秘密鍵で偽の本文に署名しました。これはAliceの署名ではありません。",
      ),
      id: s.attachedSignature,
    };
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
        "Charlieは、作業中の本文を" +
          objects.get(keyId).label +
          "で暗号化しました。Charlieは、新しい暗号文をまだBobへ転送していません。",
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
        "Charlieは、" +
          objects.get(keyId).label +
          "を" +
          objects.get(publicId).label +
          "で暗号化しました。Charlieは、新しい共通鍵の暗号文をまだ転送していません。",
      ),
      id,
    };
  }
  function signKeyDelivery(envelopeId, privateId) {
    if (
      !known.has(envelopeId) ||
      objects.get(envelopeId)?.type !== "envelope" ||
      !secrets.get(envelopeId)?.payload
    )
      return event(
        "Charlieが署名する共通鍵の暗号文を選んでください。",
        "error",
      );
    const key = objects.get(privateId);
    if (
      !known.has(privateId) ||
      key?.type !== "private" ||
      key.owner !== "charlie"
    )
      return event(
        "Charlieが鍵配送に署名するには、Charlieの秘密鍵が必要です。CharlieはAliceの署名を作れません。",
        "error",
      );
    const original = objects.get(envelopeId);
    const { id: _id, label: _label, type: _type, ...metadata } = original;
    const id = make("envelope", "Charlieが署名した共通鍵の暗号文", {
      ...metadata,
    });
    secrets.set(id, { ...secrets.get(envelopeId) });
    const sig = attachDeliverySignature(id, "charlie");
    known.add(sig);
    known.add(id);
    return {
      ...event(
        "Charlieは、共通鍵の暗号文とAlice・Bob・今回の通信の識別情報にCharlieの秘密鍵で署名しました。Aliceの署名にはなりません。",
      ),
      id,
    };
  }
  function corrupt(id, publicChanges = null) {
    if (
      !known.has(id) ||
      !["ciphertext", "envelope"].includes(objects.get(id)?.type)
    )
      return event("Charlieが直接書き換える暗号文を選んでください。", "error");
    const a = objects.get(id);
    const { id: _id, label: _label, type: _type, ...metadata } = a;
    // The attacker can modify the public wire representation, never the sealed
    // plaintext/key or the authenticating proof. Explicit fields let tests and
    // future experiments demonstrate nonce/session/recipient binding as well.
    const changes = publicChanges
      ? Object.fromEntries(
          Object.entries(publicChanges).filter(
            ([name]) =>
              [
                "token",
                "nonce",
                "sender",
                "recipient",
                "sessionId",
                "sequence",
              ].includes(name) && Object.hasOwn(a, name),
          ),
        )
      : { token: `${a.token.slice(0, -2)} FF ⟧` };
    if (!Object.keys(changes).length)
      return event("Charlieが書き換える公開情報を選んでください。", "error");
    const broken = make(a.type, "直接編集した暗号文", {
      ...metadata,
      ...changes,
    });
    if (a.authenticated || secrets.get(id)?.signature)
      secrets.set(broken, { ...secrets.get(id) });
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
    if (s.phase === "signing-public") {
      const checked = validateCertificate(id, "alice");
      if (!checked.ok) {
        finish(
          "bad-verification-key",
          "Bobが偽のAliceの証明書を検出した",
          checked.text + "Bobは、Aliceの検証用公開鍵を登録しません。",
        );
        return;
      }
      s.verificationPublic = checked.keyId;
      s.incoming = certB;
      s.outgoing = null;
      s.phase = "public";
      event(
        "Bobは、証明書のCA署名とAliceという相手名を検証し、Aliceの公開鍵を登録しました。BobはBobのCA登録済の公開鍵をAliceへ送ります。",
      );
      return;
    }
    if (s.phase === "public") {
      const certificateKey =
        a.type === "certificate"
          ? secrets.get(id)?.certificate?.publicId
          : null;
      const publicId = certificateKey || (a.type === "public" ? id : null);
      if (s.round >= 2) {
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
      if (s.round === 3) attachDeliverySignature(s.incoming, "alice");
      s.phase = "key";
      s.step++;
      event(
        s.round === 3
          ? "Aliceは、Aliceの共通鍵をBobの公開鍵で暗号化し、その暗号文とAlice・Bob・今回の通信の識別情報にAliceの秘密鍵で署名しました。Charlieの中継機は、署名を添えた共通鍵の暗号文を止めています。"
          : "Aliceは、Aliceの共通鍵を" +
              objects.get(publicId).label +
              "で暗号化しました。Charlieの中継機は、共通鍵の暗号文を止めています。",
      );
    } else if (s.phase === "key") {
      if (s.round === 3) {
        const sig = sealed?.signature;
        const proof = secrets.get(sig);
        s.deliveredSignature = sig || null;
        if (
          a.type !== "envelope" ||
          proof?.purpose !== "key-delivery" ||
          proof.owner !== objects.get(s.verificationPublic)?.owner ||
          proof.text !== deliveryContext(a) ||
          a.sender !== "alice" ||
          a.recipient !== "bob" ||
          a.sessionId !== s.sessionId ||
          a.sequence !== 0
        ) {
          finish(
            "key-signature-rejected",
            "共通鍵配送の署名検証に失敗。Bobは拒否した",
            "Bobは、CAで確認したAliceの公開鍵で、共通鍵の暗号文・AliceとBobの識別名・今回の通信の識別情報への署名を検証します。署名の削除、Charlieの署名、暗号文や識別情報の変更は検証を通りません。Bobは共通鍵を採用せず、本文の通信を始めません。",
          );
          return;
        }
      }
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
      s.incoming = packet("I love you.", s.key);
      s.originalCipher = s.incoming;
      s.phase = "message";
      s.step++;
      event(
        (s.attackerKey && s.bobKey === s.attackerKey
          ? "Bobは、Charlieが用意した共通鍵を取得しました。"
          : "Bobは、Aliceの共通鍵を取得しました。") +
          (s.round === 3
            ? "Aliceは、本文をAliceの共通鍵でAEAD暗号化し、認証タグを添えて送りました。Charlieの中継機は、認証タグを添えた本文の暗号文を止めています。"
            : "Aliceは、本文をAliceの共通鍵で暗号化して送りました。Charlieの中継機は、本文の暗号文を止めています。"),
      );
    } else {
      if (s.round === 3) {
        s.deliveredTag = sealed?.tag || null;
        if (!validTag(a, sealed, s.bobKey)) {
          finish(
            "tag-rejected",
            "認証タグの検証に失敗。Bobは拒否した",
            "Bobは、Aliceから署名付きで受け取った共通鍵で認証タグを検証します。暗号文の書き換え、別の鍵で作った偽の本文、今回の通信と異なるデータは検証を通りません。Bobは本文を受け付けず、復号結果も利用しません。",
          );
          return;
        }
      }
      if (a.type !== "ciphertext" || !sealed || sealed.key !== s.bobKey) {
        finish(
          "bad-message",
          "ボブが本文を復号できませんでした",
          "受け取ったデータとボブの共通鍵が対応していません。鍵の配送先や、再暗号化に使った鍵を見直せます。",
        );
        return;
      }
      const { text, signature: sig } = sealed.payload;
      if (s.round !== 3) s.deliveredSignature = sig;
      if (text === "I hate you.") {
        finish(
          "attack-success",
          s.read ? "盗聴・改ざんに成功" : "なりすましの本文が受理された",
          s.round === 2
            ? "CharlieはAliceの共通鍵を盗んでいません。Bobの公開鍵は誰でも使えるため、Charlie自身の共通鍵と偽の本文をBobへ送り込めました。証明書でBobの識別名と公開鍵の結び付きを確認するだけでは、Bobは本文の送信者がAliceか確認できません。"
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
          s.round === 3
            ? "Bobは共通鍵配送のAliceの署名を検証し、その共通鍵で本文の認証タグを検証して、本文を受け付けました。鍵配送への署名は鍵の出所を確かめ、AEADは本文を隠すと同時に改ざんを検出します。本文ごとの電子署名は使っていません。"
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
    createAttackerKey,
    signDraft,
    signKeyDelivery,
    encryptMessage,
    wrapKey,
    corrupt,
    setOutgoing,
    forward,
  };
}

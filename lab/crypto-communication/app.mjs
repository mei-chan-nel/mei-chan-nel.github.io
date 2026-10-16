import { createLab, rounds } from "./model.mjs";
const lab = createLab();
const $ = (id) => document.getElementById(id);
const esc = (v) =>
  String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
const keys = new Set(["symmetric", "public", "private", "verify"]);
const types = {
  symmetric: "共通鍵",
  public: "公開鍵",
  private: "秘密鍵（自分の鍵）",
  verify: "検証用公開鍵",
  envelope: "共通鍵の暗号文",
  ciphertext: "本文の暗号文",
  signature: "電子署名",
};
let selected = "",
  selectedKey = "",
  feedbackText = "まずは、止まっているデータを調べてみよう。",
  feedbackError = false;
const visits = new Set();
const hints = [
  [
    "暗号文を開くために必要なものは何でしょう。その前の通信で、何が通っていましたか？",
    "共通鍵を捕獲して本文を復号したら、平文を編集できます。暗号化しただけでは、送信内容は変わりません。",
  ],
  [
    "前の共通鍵は通用しません。公開鍵と秘密鍵は、誰の組み合わせなら開くでしょう？",
    "ボブの公開鍵は捕獲して残せます。アリスが受け取る公開鍵を変えると、共通鍵の暗号文は誰宛てになるでしょう。ボブにも鍵を届けるには、配送先を戻して包み直す必要があります。",
  ],
  [
    "前のラウンドと同じ操作を試すと、盗聴と改ざんの結果はどう違うでしょう？",
    "元の署名を添えたまま本文を変える・署名を消す・自分で署名する場合を比べましょう。ボブが信頼しているのは誰の検証用公開鍵でしょうか。",
  ],
  [
    "公開鍵のすり替えを、本文を送る前に見抜けるでしょうか？",
    "公開鍵をチャーリーの鍵にすり替えて転送し、指紋が一致するかを観察します。「真正性を確認する」をオフにした場合とも比べてみましょう。",
  ],
];
function itemValue(a) {
  return a?.token || a?.fingerprint || types[a?.type] || "";
}
function buttonItem(a) {
  return `<button type="button" class="item-button ${a.current === false ? "old" : ""}" data-item="${a.id}" aria-pressed="${selected === a.id}" aria-label="操作するデータに選択：${esc(a.label)}"><strong>${esc(a.label)}</strong><small>${esc(a.current === false ? "以前の通信の鍵 · " : "")}${esc(itemValue(a))}</small></button>`;
}
function render() {
  const focusedItem = document.activeElement?.dataset?.item;
  const s = lab.snapshot(),
    r = rounds[s.round];
  if (s.result) visits.add(s.round);
  document.querySelectorAll("[data-round]").forEach((b) => {
    const n = Number(b.dataset.round);
    if (n === s.round) b.setAttribute("aria-current", "step");
    else b.removeAttribute("aria-current");
    b.classList.toggle("visited", visits.has(n));
  });
  $("round-number").textContent =
    s.round === 3
      ? "EXTRA EXPERIMENT"
      : `ROUND ${String(s.round + 1).padStart(2, "0")}`;
  $("round-title").textContent = r.title;
  $("round-description").textContent = r.description;
  $("auth-control").hidden = s.round !== 3;
  $("authenticate").checked = s.authenticate;
  $("stages").innerHTML = r.stages
    .map(
      (t, i) =>
        `<li class="${s.phase === "done" || i < s.step ? "complete" : i === s.step ? "active" : ""}" ${i === s.step && s.phase !== "done" ? 'aria-current="step"' : ""}><span>${String(i + 1).padStart(2, "0")}</span>${esc(t)}</li>`,
    )
    .join("");
  $("direction").textContent =
    s.phase === "public" ? "BOB → ALICE" : "ALICE → BOB";
  $("alice-state").textContent = s.publicForAlice
    ? `配送に使った鍵：${s.publicForAlice.label}`
    : "本文はまだ秘密";
  $("bob-state").textContent = s.result
    ? s.result.accepted
      ? "本文を受理"
      : "通信を拒否・中断"
    : s.bobHasKey
      ? "共通鍵を取得・本文待ち"
      : "受信待ち";
  $("pause-label").textContent =
    s.phase === "done" ? "■ この通信は終了" : "Ⅱ 通信を一時停止中";
  $("packet-route").textContent =
    s.phase === "public"
      ? "ボブ → アリス / 公開鍵"
      : s.phase === "key"
        ? "アリス → ボブ / 鍵配送"
        : "アリス → ボブ / 本文";
  $("packet-title").textContent = s.incoming.label;
  $("packet-value").textContent = itemValue(s.incoming);
  $("packet-detail").textContent =
    s.phase === "public"
      ? "鍵は公開されている。でも、持ち主は確認されている？"
      : s.incoming.type === "symmetric"
        ? "平文で配送中。捕獲すれば鍵として使えます。"
        : "中身は暗号化されています。開けられる鍵を探してみよう。";
  $("outgoing-label").textContent = s.outgoing
    ? `送るデータ：${s.outgoing.label}（すり替え）`
    : "送るデータ：元のまま";
  $("restore").hidden = !s.outgoing || s.phase === "done";
  $("capture").disabled = $("forward").disabled = s.phase === "done";
  $("forward").textContent =
    s.phase === "done" ? "通信は終了しました" : "この内容で転送 →";
  $("intercept").classList.toggle("finished", s.phase === "done");
  const keyItems = s.inventory.filter((a) => keys.has(a.type)),
    dataItems = s.inventory.filter((a) => !keys.has(a.type));
  $("key-count").textContent = `(${keyItems.length})`;
  $("data-count").textContent = `(${dataItems.length})`;
  $("keyring").innerHTML = keyItems.map(buttonItem).join("");
  $("artifacts").innerHTML = dataItems.length
    ? dataItems.map(buttonItem).join("")
    : '<p class="empty">まだデータはありません。経路上のデータを捕獲したり、自分で作ったりできます。</p>';
  if (!s.inventory.some((a) => a.id === selected)) selected = "";
  if (!keyItems.some((a) => a.id === selectedKey)) selectedKey = "";
  const option = (a) =>
    `<option value="${a.id}">${esc(a.label)}${a.current === false ? "（以前の鍵）" : ""}</option>`;
  $("data-select").innerHTML =
    '<option value="">データを選択</option>' + s.inventory.map(option).join("");
  $("data-select").value = selected;
  $("key-select").innerHTML =
    '<option value="">鍵を選択</option>' + keyItems.map(option).join("");
  $("key-select").value = selectedKey;
  $("selected-preview").textContent = itemValue(
    s.inventory.find((a) => a.id === selected),
  );
  $("draft").value = s.draft;
  $("decrypt-result").textContent = s.decryptResult
    ? s.decryptResult.kind === "key"
      ? `${s.decryptResult.label} を取得しました。`
      : s.decryptResult.label
    : "まだ復号していません。";
  $("signature-controls").hidden = s.round < 2;
  $("signature-choice").value = s.signatureChoice;
  $("signature-info").textContent = s.signature
    ? `取得した署名：${s.signature.label} / ${s.signature.token}。本文を編集しても、元の署名は変わりません。`
    : "元の署名はまだ取得していません。復号すると署名も取り出せます。";
  $("original-message").textContent = s.original || "未解読";
  $("original-note").textContent = s.read
    ? "対応する共通鍵で復号できました。"
    : "対応する鍵で復号すると表示されます。";
  const result = $("bob-result");
  result.className = `bob-result ${s.result ? (s.result.accepted ? "success" : "rejected") : ""}`;
  result.innerHTML = s.result
    ? `<span class="result-symbol" aria-hidden="true">${s.result.accepted ? "✓" : "×"}</span><h4>${esc(s.result.title)}</h4>${s.result.message ? `<p class="received" lang="en">${esc(s.result.message)}</p>` : ""}${s.result.hiddenMessage ? "<p>受信本文は非表示です。チャーリーはまだ復号していません。</p>" : ""}<p>${esc(s.result.text)}</p>`
    : '<span class="result-symbol" aria-hidden="true">…</span><h4>ボブは受信待ち</h4><p>転送すると、受信・復号・署名検証の結果がここに表示されます。</p>';
  $("read-mark").textContent = s.read ? "✓" : "○";
  $("tamper-mark").textContent =
    s.result?.code === "attack-success" ? "✓" : "○";
  $("next-round").hidden = !s.result || s.round === 3;
  $("next-round").textContent =
    s.round === 2 ? "追加実験：公開鍵を確かめる →" : "次のラウンドへ →";
  $("hint-text").textContent = hints[s.round][0];
  $("hint-detail").textContent = hints[s.round][1];
  $("log-count").textContent = `(${s.log.length})`;
  $("log-list").innerHTML = s.log
    .map((l) => `<li class="${l.kind}">${esc(l.text)}</li>`)
    .join("");
  $("feedback").textContent = feedbackText;
  $("feedback").classList.toggle("error", feedbackError);
  if (focusedItem)
    document
      .querySelector(`[data-item="${focusedItem}"]`)
      ?.focus({ preventScroll: true });
}
function act(operation, { selectNew = false } = {}) {
  const response = operation();
  const s = lab.snapshot();
  if (selectNew && response?.id) selected = response.id;
  feedbackText = response?.text || s.log.at(-1)?.text || "";
  feedbackError = response?.ok === false;
  render();
}
function restart(round, auth = $("authenticate").checked) {
  lab.start(round, auth);
  selected = "";
  selectedKey = "";
  feedbackText =
    "新しい共通鍵で通信を開始しました。データを調べ、自由に介入してみよう。";
  feedbackError = false;
  render();
}
$("rounds").addEventListener("click", (e) => {
  const b = e.target.closest("[data-round]");
  if (b) restart(Number(b.dataset.round), true);
});
$("restart").addEventListener("click", () => restart(lab.snapshot().round));
$("authenticate").addEventListener("change", () => restart(3));
$("capture").addEventListener("click", () => {
  selected = lab.snapshot().incoming.id;
  act(() => lab.capture());
});
$("forward").addEventListener("click", () => act(() => lab.forward()));
$("restore").addEventListener("click", () => act(() => lab.setOutgoing()));
$("data-select").addEventListener("change", (e) => {
  selected = e.target.value;
  render();
});
$("key-select").addEventListener("change", (e) => {
  selectedKey = e.target.value;
});
for (const id of ["keyring", "artifacts"])
  $(id).addEventListener("click", (e) => {
    const b = e.target.closest("[data-item]");
    if (b) {
      selected = b.dataset.item;
      render();
    }
  });
$("decrypt").addEventListener("click", () =>
  act(() => lab.decrypt(selected, selectedKey)),
);
$("wrap").addEventListener("click", () =>
  act(() => lab.wrapKey(selected, selectedKey), { selectNew: true }),
);
$("encrypt").addEventListener("click", () =>
  act(() => lab.encryptMessage(selectedKey), { selectNew: true }),
);
$("set-outgoing").addEventListener("click", () =>
  act(() => lab.setOutgoing(selected)),
);
$("corrupt").addEventListener("click", () =>
  act(() => lab.corrupt(selected), { selectNew: true }),
);
$("draft").addEventListener("input", (e) => lab.edit(e.target.value));
$("signature-choice").addEventListener("change", (e) =>
  lab.chooseSignature(e.target.value),
);
$("next-round").addEventListener("click", () => {
  restart(Math.min(3, lab.snapshot().round + 1), true);
  $("round-title").scrollIntoView({ block: "start", behavior: "smooth" });
});
render();

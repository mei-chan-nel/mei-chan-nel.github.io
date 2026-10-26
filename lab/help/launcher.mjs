import { pageKey, composePrompt, validateGuide, launchPlan, CHATGPT_URL } from "./prompt.mjs";

const root = new URL("../", import.meta.url);
const key = pageKey(location.pathname, root.pathname);
const heading = document.querySelector("main h1")?.closest("header");
if (key && heading) installHelp(heading);

function installHelp(heading) {
  if (document.querySelector("[data-lab-help]")) return;
  const host = document.createElement("div");
  host.className = "lab-help";
  host.dataset.labHelp = "";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "lab-help__button";
  button.title = "この教材の使い方をChatGPTで聞く（新しいタブ）";
  button.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-8l-6 4v-4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/><path d="M8 9h8M8 13h5"/></svg><span>ChatGPTに聞く</span>';
  const status = document.createElement("p");
  status.className = "lab-help__status";
  status.setAttribute("role", "status");
  status.hidden = true;
  const recovery = document.createElement("details");
  recovery.className = "lab-help__recovery";
  recovery.hidden = true;
  recovery.innerHTML = '<summary>ChatGPTが開かない・質問が渡らない場合</summary><p>質問文をコピーし、ChatGPTの入力欄に貼り付けて送信してください。</p><label for="lab-help-prompt">この教材の質問文</label><textarea id="lab-help-prompt" readonly rows="7" spellcheck="false"></textarea><div class="lab-help__actions"><button type="button" data-help-copy>質問文をコピー</button><button type="button" data-help-open>ChatGPTを開く</button></div><p class="lab-help__copy-status" role="status"></p>';
  host.append(button);
  // Reserve space in the existing heading; never float over experiment controls.
  heading.classList.add("lab-help-heading");
  heading.append(host);
  const feedback = document.createElement("div");
  feedback.className = "lab-help-feedback";
  feedback.append(status, recovery);
  heading.after(feedback);
  const textarea = recovery.querySelector("textarea");
  let pending, prompt = "", busy = false;

  async function readJSON(path) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(new URL(path, import.meta.url), { signal: controller.signal });
      if (!response.ok) throw Error(`Guide HTTP ${response.status}`);
      return await response.json();
    } finally { clearTimeout(timer); }
  }
  function load() {
    if (!pending) pending = (async () => {
      const manifest = await readJSON("./data/manifest.json");
      const paths = manifest.pages?.[key];
      if (!Array.isArray(paths) || !paths.length || paths.some(p => !/^[a-z0-9/-]+\.json$/.test(p))) {
        throw Error("Unknown lab");
      }
      const [common, ...guides] = await Promise.all([
        readJSON("./data/common.json"), ...paths.map(p => readJSON(`./data/${p}`)),
      ]);
      guides.forEach(validateGuide);
      if (guides.at(-1).id !== key) throw Error("Guide route mismatch");
      return composePrompt(common, guides);
    })().catch(error => { pending = null; throw error; });
    return pending;
  }
  // Preload only maintained public instructions. No learner state is read.
  void load().catch(() => {});

  function reserveTab() {
    try {
      const tab = window.open("about:blank", "_blank");
      if (!tab) return null;
      tab.opener = null;
      const meta = tab.document.createElement("meta");
      meta.name = "referrer"; meta.content = "no-referrer";
      tab.document.head.append(meta);
      tab.document.title = "ChatGPTの案内を準備しています";
      tab.document.body.textContent = "質問文を準備しています。元のラボはそのまま残ります。";
      return tab;
    } catch { return null; }
  }
  button.addEventListener("click", async () => {
    if (busy) return;
    busy = true;
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    status.hidden = false;
    status.textContent = "質問文を準備しています…";
    recovery.hidden = true;
    // Reserve synchronously, even if loading/retrying, to retain user activation.
    const tab = reserveTab();
    try {
      prompt = await load();
      textarea.value = prompt;
      const plan = launchPlan(prompt);
      let opened = false;
      if (tab && !tab.closed) {
        try { tab.location.replace(plan.url); opened = true; } catch { tab.close(); }
      }
      recovery.hidden = false;
      recovery.open = !opened || plan.needsCopy;
      status.textContent = !opened
        ? "新しいタブを開けませんでした。下の質問文をコピーしてChatGPTを開いてください。"
        : plan.needsCopy
          ? "質問文が長いため、下の質問文をコピーし、開いたChatGPTへ貼り付けてください。"
          : "ChatGPTで質問文を確認し、必要なら送信してください。案内を読んだら、このラボに戻って操作できます。";
      // A cross-origin page's receipt of q cannot be verified here. Keep recovery
      // reachable even when a popup was created successfully.
      if (!opened) recovery.querySelector("summary").focus();
    } catch {
      if (tab && !tab.closed) tab.close();
      status.textContent = "案内データを読み込めませんでした。接続を確認して「ChatGPTに聞く」をもう一度押してください。ラボの操作は続けられます。";
    } finally {
      busy = false;
      button.disabled = false;
      button.removeAttribute("aria-busy");
    }
  });
  recovery.querySelector("[data-help-copy]").addEventListener("click", async () => {
    const copyStatus = recovery.querySelector(".lab-help__copy-status");
    try {
      await navigator.clipboard.writeText(prompt);
      copyStatus.textContent = "コピーしました。ChatGPTに貼り付けて送信してください。";
    } catch {
      textarea.focus(); textarea.select(); textarea.setSelectionRange(0, textarea.value.length);
      copyStatus.textContent = "自動コピーできませんでした。選択された質問文を、端末のコピー操作でコピーしてください。";
    }
  });
  recovery.querySelector("[data-help-open]").addEventListener("click", () => {
    window.open(CHATGPT_URL, "_blank", "noopener,noreferrer");
  });
}

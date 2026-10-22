import {
  OSSimulation,
  APP_CONFIG,
  FOREGROUND_IDS,
  BACKGROUND_IDS,
} from "./simulation.mjs?v=2";
import { RecordedAudioController } from "./audio-controller.mjs?v=4";
import { tracks } from "./audio/tracks.mjs";
import { initFullscreen } from "./fullscreen.mjs";

const simulation = new OSSimulation();
for (const [id, config] of Object.entries(APP_CONFIG))
  document.querySelector(".os-lab").style.setProperty(`--${id}`, config.color);
const $ = (id) => document.getElementById(id);
const names = {
  ...Object.fromEntries(
    Object.entries(APP_CONFIG).map(([id, app]) => [id, app.label]),
  ),
  os: "OS",
  idle: "アイドル",
};
const icons = { web: "◎", music: "♫", photo: "▧" };
const states = {
  running: "CPUで実行中",
  ready: "実行待ち",
  waiting: "イベント待ち",
  stopped: "未起動",
  "memory-wait": "メモリの空き待ち",
};
const topics = {
  nature: {
    title: "森の小さな図書館",
    kicker: "FOREST JOURNAL",
    lead: "週末は、森で深呼吸。",
    description: "木漏れ日の道で、季節の色を見つけよう。",
    cards: [
      ["朝の散策", "ゆっくり歩く、緑の小道"],
      ["森のひみつ", "木々と水のつながり"],
    ],
  },
  space: {
    title: "星空の向こうへ",
    kicker: "NIGHT SKY MAGAZINE",
    lead: "今夜、遠い宇宙を見上げよう。",
    description: "月の向こうに広がる、光と惑星の世界。",
    cards: [
      ["今月の星空", "見つけたい星と星座"],
      ["惑星をめぐる", "太陽系の小さな旅"],
    ],
  },
  city: {
    title: "まちを歩いてみよう",
    kicker: "CITY WALK GUIDE",
    lead: "いつもの通りに、新しい発見。",
    description: "橋や広場をめぐり、まちの工夫を探そう。",
    cards: [
      ["川沿いの道", "水辺をつなぐ散歩ルート"],
      ["まちのサイン", "案内に隠れたデザイン"],
    ],
  },
};
function webScene(topic) {
  const frame = (contents) =>
    `<svg viewBox="0 0 640 180" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${contents}</svg>`;
  if (topic === "space")
    return frame(
      '<path fill="#182641" d="M0 0h640v180H0z"/><g fill="#f6e8bd"><circle cx="56" cy="32" r="2"/><circle cx="160" cy="63" r="3"/><circle cx="230" cy="23" r="2"/><circle cx="523" cy="35" r="2"/><circle cx="586" cy="123" r="3"/><circle cx="85" cy="143" r="2"/><circle cx="273" cy="141" r="2"/></g><circle fill="#cea277" cx="402" cy="90" r="56"/><path fill="#c17e69" d="M350 70q55 24 106 1l2 12q-52 25-110 1zm-1 30q56 25 108 1l-5 14q-50 21-96-1z"/><ellipse cx="402" cy="90" rx="111" ry="20" fill="none" stroke="#ecdbb8" stroke-width="9" transform="rotate(-18 402 90)"/><circle cx="211" cy="94" r="17" fill="#809daa"/>',
    );
  if (topic === "city")
    return frame(
      '<path fill="#f0d8b8" d="M0 0h640v180H0z"/><circle fill="#e7a55d" cx="500" cy="44" r="31"/><path fill="#a4a797" d="M0 88h45V53h51v67h27V29h49v82h32V65h66v49h33V39h42v75h39V79h68v35h48V53h54v45h32V69h54v111H0z"/><path fill="#355f67" d="M0 127h55V88h39v39h43V65h40v62h54v-27h46v27h42V80h45v47h37v-25h65v25h55V86h46v41h83v53H0z"/><path fill="#7ca6aa" d="M0 151h640v29H0z"/><path fill="none" stroke="#faf1dc" stroke-width="5" d="M0 158q105-43 210 0t210 0 220 0"/><g fill="#edd69e"><path d="M63 100h10v11H63zm83-19h9v11h-9zm94 33h10v10h-10zm91-20h10v12h-10zm169 7h10v11h-10z"/></g>',
    );
  return frame(
    '<path fill="#d8e5c9" d="M0 0h640v180H0z"/><circle fill="#f3e2a3" cx="482" cy="46" r="30"/><path fill="#9db69a" d="M0 118 122 43 245 120 391 55 520 124 640 76v104H0z"/><path fill="#518276" d="M0 142 123 101 244 143 384 98 529 148 640 102v78H0z"/><path fill="#d5d5a7" d="M286 180q70-26 21-64 104 28 57 64z"/><g fill="#285c50"><path d="m54 5 42 89H79l28 47H12l28-47H20zm518 11 37 83h-14l23 43h-85l25-43h-14z"/><path d="M53 132h10v48H53zm517 0h9v48h-9z"/></g><g fill="#3f7564"><path d="m135 49 29 64h-11l18 34h-71l19-34h-12zm365 20 24 51h-10l16 28h-60l17-28h-10z"/></g>',
  );
}
function webPageMarkup(topic) {
  const content = topics[topic];
  return `<article class="web-page"><div class="web-page-hero">${webScene(topic)}</div><div class="web-page-body"><p class="web-page-meta">${content.kicker}</p><h3>${content.title}</h3><p class="web-page-lead">${content.lead}</p><div class="web-page-grid">${content.cards.map(([title, copy]) => `<div><strong>${title}</strong><span>${copy}</span></div>`).join("")}</div></div></article>`;
}
const filters = {
  warm: ["夏色", "saturate(1.9) contrast(1.08)"],
  mono: ["モノクロ", "grayscale(1)"],
  sunset: ["夕焼け", "sepia(.65) saturate(2.1) hue-rotate(330deg)"],
};
const landscape = `<svg viewBox="0 0 640 230" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="山と湖の風景"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#badbdc"/><stop offset="1" stop-color="#eaf0d9"/></linearGradient></defs><path fill="url(#sky)" d="M0 0h640v230H0z"/><circle cx="488" cy="52" r="25" fill="#f6df99"/><path fill="#93b8ad" d="M0 142 135 32 260 143 372 56 526 143 640 83v147H0z"/><path fill="#5c9287" d="M0 170 124 93 234 166 410 91 558 176 640 124v106H0z"/><path fill="#bcd9d4" d="M0 170h640v60H0z"/><path fill="#649a8d" d="m0 170 70 12 95 48H0zm640 0-80 14-70 46h150z"/><path stroke="#ecf3e6" stroke-width="3" d="M232 194h160m-190 16h228m-151 13h112"/><path fill="#2f655b" d="m30 160 16-42 17 42h-9l12 25H26l12-25zm550 4 19-50 20 50h-11l15 29h-48l15-29z"/></svg>`;
const esc = (s) =>
  String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
// Interactive elements are created once. A virtual tick only updates their
// state; replacing a button between pointerdown and click drops the operation.
const TICK_MS = 450;
let playing = false;
let lastFrame = null;
let accumulator = 0;
let lastHistoryTime = -1;
let historyColumns = 24;
let snapshot = simulation.snapshot();
let currentAudioTrackId = tracks[0].id;
const historyButtons = new Map();
const media = document.createElement("audio");
media.src = new URL(tracks[0].src, import.meta.url).href;
media.preload = "auto";
media.loop = true;
media.hidden = true;
media.setAttribute("aria-hidden", "true");
document.body.append(media);
let soundtrack;
soundtrack = new RecordedAudioController({
  media,
  onStatus: () => renderAudioControls(),
});

function safeAction(action) {
  snapshot = action();
  render();
}
function launchAndView(id) {
  simulation.view(id);
  if (id === "web") $("web-topic").value = "nature";
  if (id === "music" || !playing) void soundtrack.unlock();
  if (!playing) setPlaying(true, false);
  return simulation.launch(id);
}
function setPlaying(next, renderNow = true) {
  playing = next;
  accumulator = 0;
  lastFrame = null;
  $("play").textContent = playing ? "Ⅱ 一時停止" : "▶ 再生";
  $("play").setAttribute("aria-pressed", String(playing));
  if (renderNow) render();
}
$("play").addEventListener("click", () => {
  if (!playing) void soundtrack.unlock();
  setPlaying(!playing);
});
$("reset").addEventListener("click", () => {
  playing = false;
  $("web-topic").value = "nature";
  $("photo-filter").value = "warm";
  soundtrack.reset();
  snapshot = simulation.reset();
  setPlaying(false);
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) setPlaying(false);
});

function makeLauncher() {
  $("app-launcher").innerHTML = FOREGROUND_IDS.map(
    (id) =>
      `<div class="app-row" data-owner="${id}" data-app-row="${id}"><div class="app-name"><span class="app-icon" aria-hidden="true">${icons[id]}</span><div><strong>${names[id]}</strong><small><span class="app-state-dot"></span><span class="app-state-label"></span></small><span class="launcher-buffer" hidden><span class="launcher-buffer-track" aria-hidden="true"><i></i></span><span class="launcher-buffer-text"></span></span></div></div><button type="button" data-action="view" data-app="${id}" aria-label="${names[id]}を表示">表示</button><button type="button" data-action="lifecycle" data-app="${id}">起動</button></div>`,
  ).join("");
}
function makeBackgroundLauncher() {
  const compactNames = {
    notify: "通知",
    sync: "クラウド同期",
    security: "セキュリティ",
  };
  $("background-launcher").innerHTML = BACKGROUND_IDS.map(
    (id) =>
      `<div class="background-row" data-owner="${id}" data-background-row="${id}"><strong class="background-name">${compactNames[id]}</strong><span class="background-state"></span></div>`,
  ).join("");
}
function makeAppViews() {
  const empty = (id) =>
    `<div class="empty-app" data-empty="${id}"><span class="empty-icon" aria-hidden="true">${icons[id]}</span><h3>${names[id]}は未起動です</h3><p>起動するとメモリを確保し、アプリを操作できます。</p><button type="button" class="primary" data-action="launch" data-app="${id}">このアプリを起動</button><p class="app-status" data-launch-status="${id}"></p></div>`;
  const web = `<div class="app-toolbar"><select id="web-topic" aria-label="読み込むページ">${Object.entries(
    topics,
  )
    .map(([id, content]) => `<option value="${id}">${content.title}</option>`)
    .join(
      "",
    )}</select><button type="button" data-action="web-load" id="web-load">読み込む</button></div><div class="web-load-state" id="web-load-state" data-phase="idle" role="status" aria-live="polite"><strong id="web-load-label">ページを選んで読み込む</strong><span id="web-load-detail"></span></div><div class="web-load-track" id="web-load-track" role="progressbar" aria-label="ページ読み込みの進行" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i id="web-load-fill"></i></div><div class="web-article" id="web-article"></div><p class="app-status" id="web-status"></p>`;
  const music = `<div class="music-top"><div class="album-art" aria-hidden="true">♫</div><div class="song-title"><h3 id="song-title">DURU Roomscene Lofi</h3><p id="song-artist">DURU-AI / CC0</p></div><div class="music-controls"><button type="button" class="primary" data-action="music-play" id="music-play">▶ 音楽を再生</button><span class="elapsed" id="music-elapsed">00:00</span></div></div><div class="music-track-select"><label for="music-track">曲</label><select id="music-track">${tracks.map((track) => `<option value="${track.id}">${esc(track.title)}</option>`).join("")}</select></div><div class="volume-controls"><button type="button" data-action="mute" id="mute-toggle" aria-pressed="false">消音</button><label for="volume">音量</label><input type="range" id="volume" min="0" max="100" value="45" step="1" /><output id="volume-value" for="volume">45%</output></div><p class="audio-feedback" id="audio-feedback" role="status"></p><div class="buffer-heading"><span>音声バッファ <small>（再生待ちの音）</small></span><strong id="buffer-count">0 / 24</strong></div><div id="buffer-track" class="buffer-track" role="progressbar" aria-label="音声バッファ残量" aria-valuemin="0" aria-valuemax="24" aria-valuenow="0"><span id="buffer-fill"></span></div><p class="app-status" id="music-status"></p><details class="music-credit"><summary>音源について</summary><p><a href="https://github.com/uncle-sheepsky/duru-ai-cc0-bgm#license--please-read" target="_blank" rel="noopener noreferrer">DURU-AI / uncle-sheepsky</a> が作曲・録音ともに<a href="./audio/CC0-1.0.txt">CC0</a>で提供した音源です。音声バッファの量は教材用のモデルです。</p><ul>${tracks.map((track) => `<li><a href="${esc(track.source)}" target="_blank" rel="noopener noreferrer">${esc(track.title)} の配布元</a></li>`).join("")}</ul><p>配信用にMP3を再圧縮しています。<a href="./audio/tracks.json">3曲の出典・加工内容</a></p></details>`;
  const photo = `<div class="app-toolbar"><select id="photo-filter" aria-label="写真の加工効果">${Object.entries(
    filters,
  )
    .map(([id, filter]) => `<option value="${id}">${filter[0]}</option>`)
    .join(
      "",
    )}</select><button type="button" class="primary" data-action="photo-start" id="photo-start">加工する</button></div><div class="photo-stage" id="photo-stage" data-loading="true"><div class="photo-original">${landscape}</div><div class="photo-overlay" id="photo-overlay">${landscape.replaceAll('id="sky"', 'id="sky-overlay"').replaceAll("url(#sky)", "url(#sky-overlay)")}</div><div class="photo-loading" id="photo-loading" role="status"><strong id="photo-load-label">画像を読み込み中</strong><span id="photo-load-detail"></span></div><span class="photo-progress" id="photo-progress">未加工</span></div><p class="photo-caption" id="photo-caption"></p><p class="app-status" id="photo-status"></p>`;
  $("app-content").innerHTML = Object.entries({ web, music, photo })
    .map(
      ([id, content]) =>
        `<div class="app-view" data-app-view="${id}" hidden>${empty(id)}<div class="app-live" data-live="${id}" hidden>${content}</div></div>`,
    )
    .join("");
}
function handleLauncherClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button || button.disabled) return;
  const { action, app } = button.dataset;
  if (!FOREGROUND_IDS.includes(app)) return;
  if (action === "view") safeAction(() => simulation.view(app));
  else if (action === "lifecycle" && (event.detail || 0) < 2) {
    if (
      snapshot.pendingInputs.some(
        (input) => input.id === app && ["launch", "close"].includes(input.type),
      )
    )
      return;
    safeAction(() =>
      snapshot.apps[app].running || snapshot.apps[app].memoryWait
        ? simulation.close(app)
        : launchAndView(app),
    );
  }
}
$("app-launcher").addEventListener("click", handleLauncherClick);
$("app-content").addEventListener("change", (event) => {
  if (event.target.id !== "music-track") return;
  const track = tracks.find((entry) => entry.id === event.target.value);
  if (!track || !snapshot.apps.music.running || pendingFor("music").length)
    return;
  currentAudioTrackId = track.id;
  soundtrack.setSource(new URL(track.src, import.meta.url).href);
  snapshot = simulation.selectTrack(track.id);
  // Prime the new source in this user gesture, silently until the OS has
  // processed the selection and the music process has prepared new data.
  soundtrack.sync(
    snapshot,
    playing && currentAudioTrackId === snapshot.apps.music.music.track,
  );
  void soundtrack.unlock();
  render();
});
$("app-content").addEventListener("input", (event) => {
  if (event.target.id === "volume") {
    soundtrack.setVolume(Number(event.target.value) / 100);
    renderAudioControls();
  }
});
$("app-content").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button || button.disabled) return;
  const action = button.dataset.action;
  if (action === "launch")
    safeAction(() => launchAndView(button.dataset.app));
  if (action === "web-load")
    safeAction(() => simulation.webLoad($("web-topic").value));
  if (action === "music-play") {
    if (!snapshot.apps.music.music.playing) void soundtrack.unlock();
    safeAction(() => simulation.toggleMusic());
  }
  if (action === "photo-start")
    safeAction(() => simulation.startPhoto($("photo-filter").value));
  if (action === "mute") {
    soundtrack.toggleMute();
    renderAudioControls();
  }
  if (action === "audio-retry") void soundtrack.unlock();
});
$("state-details").addEventListener("toggle", () => {
  if ($("state-details").open) renderDetails();
});

const pendingFor = (id) =>
  snapshot.pendingInputs.filter((input) => input.id === id);
function renderLauncher() {
  for (const id of FOREGROUND_IDS) {
    const app = snapshot.apps[id];
    const row = $("app-launcher").querySelector(`[data-app-row="${id}"]`);
    const lifecycleRequest = pendingFor(id).find((input) =>
      ["launch", "close"].includes(input.type),
    );
    const pending = Boolean(lifecycleRequest);
    row.dataset.visible = String(snapshot.visible === id);
    const memoryWait = app.memoryWait;
    row.dataset.state = pending ? "pending" : app.state;
    row.querySelector(".app-state-dot").classList.toggle("on", app.running);
    row.querySelector(".app-state-label").textContent = pending
      ? "OSが操作を受け付けました"
      : memoryWait
        ? app.running
          ? "起動中 · メモリの空き待ち"
          : "メモリの空き待ち · 起動前"
        : app.running
          ? `起動中 · ${states[app.state]}`
          : "未起動";
    const view = row.querySelector('[data-action="view"]');
    view.textContent = snapshot.visible === id ? "表示中" : "表示";
    view.setAttribute("aria-pressed", String(snapshot.visible === id));
    const lifecycle = row.querySelector('[data-action="lifecycle"]');
    lifecycle.textContent = pending
      ? lifecycleRequest.type === "close"
        ? app.running
          ? "終了待ち"
          : "取消待ち"
        : "起動待ち"
      : app.running
        ? "終了"
        : memoryWait
          ? "取消"
          : "起動";
    lifecycle.disabled = pending;
    lifecycle.setAttribute(
      "aria-label",
      memoryWait && !app.running
        ? `${names[id]}の起動待ちを取り消す`
        : `${names[id]}を${app.running ? "終了" : "起動"}`,
    );
    const buffer = row.querySelector(".launcher-buffer");
    buffer.hidden = !(id === "music" && app.running && app.music.playing);
    if (!buffer.hidden) {
      buffer.querySelector("i").style.width =
        `${(app.music.buffer / app.music.capacity) * 100}%`;
      buffer.querySelector(".launcher-buffer-text").textContent =
        `♫ ${!playing ? "一時停止中" : app.music.buffer > 0 ? "再生中" : "準備待ち"} · ${app.music.buffer}/${app.music.capacity}`;
      buffer.setAttribute(
        "aria-label",
        `音声バッファ ${app.music.buffer} / ${app.music.capacity}`,
      );
    }
  }
}
function renderBackgroundLauncher() {
  for (const id of BACKGROUND_IDS) {
    const app = snapshot.apps[id];
    const background = app.background;
    const row = $("background-launcher").querySelector(
      `[data-background-row="${id}"]`,
    );
    row.dataset.state = app.state;
    const state =
      app.state === "running"
        ? "CPU実行中"
        : app.state === "ready"
          ? "CPU待ち"
          : background.pendingEvent
            ? "割り込み待ち"
            : background.phase === "network"
              ? "通信待ち"
              : id === "notify"
                ? "通知待ち"
                : id === "sync"
                  ? "変更待ち"
                  : "予定待ち";
    row.querySelector(".background-state").textContent = state;
    const next =
      background.nextEventAt === null
        ? app.task
        : `次の${id === "notify" ? "模擬通知" : id === "sync" ? "模擬の外部変更" : "定期スキャン"}まで ${Math.max(0, background.nextEventAt - snapshot.time)} tick`;
    row.title = `${names[id]}：${state}。${app.task}。${background.source ? `きっかけ：${background.source}。` : ""}${next}。${app.memory} MB 保持。${playing ? "" : "OS一時停止中。"}`;
    row.setAttribute("aria-label", row.title);
  }
}
function memoryWaitMessage(wait) {
  return `必要 ${wait.required} MB／空き ${snapshot.memory.free} MB。${snapshot.memory.free >= wait.required ? "OSが自動でメモリを確保して再開します。" : "空きができると自動で再開します。"}${playing ? "" : "OSは一時停止中です。"}`;
}
function renderProcessStatus() {
  const id = snapshot.visible;
  const app = snapshot.apps[id];
  const pending = pendingFor(id);
  const memoryWait = app.memoryWait;
  const status = $("window-process-status");
  status.dataset.owner = id;
  status.dataset.paused = String(!playing);
  status.dataset.state = pending.length ? "pending" : app.state;
  const label = {
    running: "● CPU割り当て中",
    ready: "◷ CPUの順番待ち",
    waiting: "Ⅱ イベント待ち · CPU未使用",
    stopped: "未起動",
    "memory-wait": "メモリの空き待ち",
  };
  let detail;
  if (pending.length)
    detail = playing
      ? "入力を受け付けました。OSが順番に処理します。"
      : "OSは一時停止中です。「再生」で受け付けた操作を進めます。";
  else if (memoryWait) detail = memoryWaitMessage(memoryWait);
  else if (!app.running)
    detail = "起動するとメモリに読み込まれ、操作できるようになります。";
  else if (!playing)
    detail = "OSを一時停止しています。再開すると、この状態から進みます。";
  else if (app.state === "running")
    detail = `${app.task}。この時間にアプリの処理が進みます。`;
  else if (app.state === "ready")
    detail = `実行する仕事があります。いまCPUは${names[snapshot.cpu.owner]}を処理しています。`;
  else if (id === "music" && app.music.playing && app.music.buffer > 0)
    detail = "準備済みの音を再生中。CPUを使わずにバッファの音が流れます。";
  else detail = `${app.task}。メモリと画面は保持しています。`;
  $("window-process-label").textContent = pending.length
    ? "入力を受け付けました"
    : memoryWait
      ? "メモリの空き待ち"
      : `${!playing && app.running ? "一時停止中 · " : ""}${label[app.state]}`;
  $("window-process-detail").textContent = detail;
}
function renderAppViews() {
  $("window-title").textContent = names[snapshot.visible];
  for (const id of FOREGROUND_IDS) {
    const app = snapshot.apps[id];
    $("app-content").querySelector(`[data-app-view="${id}"]`).hidden =
      snapshot.visible !== id;
    $("app-content").querySelector(`[data-empty="${id}"]`).hidden = app.running;
    $("app-content").querySelector(`[data-live="${id}"]`).hidden = !app.running;
    const pending = pendingFor(id);
    $("app-content").querySelector(`[data-empty="${id}"] button`).disabled =
      pending.length > 0 || Boolean(app.memoryWait);
    $("app-content").querySelector(`[data-launch-status="${id}"]`).textContent =
      pending.length
        ? pending.some((input) => input.type === "close")
          ? "起動待ちの取り消しを受け付けました。"
          : playing
            ? "OSが起動を処理しています。"
            : "起動を受け付けました。「再生」でOSを動かしてください。"
        : app.memoryWait?.operation === "launch"
          ? memoryWaitMessage(app.memoryWait)
          : "";
    $("app-content").querySelector(`[data-empty="${id}"] button`).textContent =
      app.memoryWait?.operation === "launch"
        ? "メモリの空き待ち"
        : "このアプリを起動";
  }
  const web = snapshot.apps.web.web;
  const webPending = pendingFor("web").some(
    (input) => input.type === "webLoad",
  );
  const busy =
    webPending || ["request", "network", "render"].includes(web.phase);
  const stage = busy ? "loading" : web.page ? "complete" : "idle";
  const articleKey = `${stage}:${web.page || "empty"}:${web.completedLoads || 0}`;
  const article = $("web-article");
  if (article.dataset.page !== articleKey) {
    article.dataset.page = articleKey;
    article.dataset.stage = stage;
    article.className = `web-article ${stage === "complete" ? web.page : ""}`;
    article.innerHTML =
      stage === "complete"
        ? webPageMarkup(web.page)
        : stage === "loading"
          ? '<div class="web-skeleton" aria-hidden="true"><div class="web-skeleton-art"></div><div class="web-skeleton-lines"><i></i><i></i><i></i></div><p>ページのデータを読み込んでいます</p></div>'
          : '<div class="web-start-card"><span aria-hidden="true">◎</span><h3>どんなページを開こう？</h3><p>森・宇宙・まち。上のメニューから選んで<br />「読み込む」を押してください。</p></div>';
  }
  article.setAttribute("aria-busy", String(busy));
  const webProgress = webPending
    ? 0
    : busy
      ? Math.min(99, web.progress || 0)
      : web.page
        ? 100
        : 0;
  $("web-load-track").setAttribute("aria-valuenow", String(webProgress));
  $("web-load-fill").style.width = `${webProgress}%`;
  const loadPhase = webPending ? "queued" : web.phase;
  $("web-load-state").dataset.phase =
    stage === "complete" ? "complete" : loadPhase;
  const loadMessages = {
    queued: [
      "読み込みを受け付けました",
      playing
        ? "OSが入力を処理するのを待っています"
        : "OSの「再生」で読み込みが進みます",
    ],
    idle: ["ページを選んで読み込む", "通信待ちとCPU処理を観察しましょう"],
    request: [
      "1 / 3 読み込みの準備中",
      "CPUが割り当てられると要求の準備が進みます",
    ],
    network: [
      "2 / 3 ページを受信中",
      "通信待ち。WebはCPUを使わずに待っています",
    ],
    render: [
      "3 / 3 ページを描画中",
      "CPUが割り当てられた時間だけ表示を作ります",
    ],
    loaded: ["✓ 読み込み完了", "100% · ページの表示はこのまま続きます"],
  };
  const message = loadMessages[loadPhase] || loadMessages.idle;
  $("web-load-label").textContent = message[0];
  $("web-load-detail").textContent = message[1];
  $("web-status").textContent =
    stage === "complete"
      ? `「${topics[web.page].title}」を表示中。次の操作があるまで、Webは通常CPUを使いません。`
      : busy
        ? "まだ読み込み中です。完了すると、イラスト付きのページに切り替わります。"
        : "このWebページは教材内の模擬ページです。";
  $("web-load").disabled = busy;
  $("web-load").textContent = busy
    ? "読み込み中…"
    : web.page
      ? "再読み込み"
      : "読み込む";
  const music = snapshot.apps.music.music;
  const musicPending = pendingFor("music").length > 0;
  if (!musicPending && currentAudioTrackId !== music.track) {
    currentAudioTrackId =
      tracks.find((entry) => entry.id === music.track)?.id || tracks[0].id;
    soundtrack.setSource(
      new URL(
        tracks.find((entry) => entry.id === currentAudioTrackId).src,
        import.meta.url,
      ).href,
    );
  }
  const track =
    tracks.find((entry) => entry.id === currentAudioTrackId) || tracks[0];
  if (!musicPending) $("music-track").value = track.id;
  $("music-track").disabled = musicPending;
  $("song-title").textContent = track.title;
  $("song-artist").textContent =
    `DURU-AI / CC0 · ${Math.floor(track.duration / 60)}分${Math.round(track.duration % 60)}秒`;
  $("music-play").textContent = music.playing
    ? "Ⅱ 音楽を一時停止"
    : "▶ 音楽を再生";
  $("music-play").disabled = musicPending;
  const elapsedSeconds = Math.floor(snapshot.apps.music.running ? soundtrack.positionSeconds : 0);
  $("music-elapsed").textContent =
    `${String(Math.floor(elapsedSeconds / 60)).padStart(2, "0")}:${String(elapsedSeconds % 60).padStart(2, "0")}`;
  $("buffer-count").textContent = `${music.buffer} / ${music.capacity}`;
  $("buffer-track").setAttribute("aria-valuenow", String(music.buffer));
  $("buffer-track").classList.toggle("low", music.buffer < 5);
  $("buffer-fill").style.width = `${(music.buffer / music.capacity) * 100}%`;
  $("music-status").textContent = musicPending
    ? playing
      ? "再生操作を受け付けました。"
      : "再生操作を受け付けました。OSの「再生」で音楽も進みます。"
    : !music.playing
      ? "再生するとCPUが音を準備し、音源が流れます。"
      : !playing
        ? "OSと音楽を一時停止しています。"
        : music.buffer === 0
          ? music.hasPlayed
            ? "バッファが空になり、音が途切れています。CPUが補充すると自動で再開します。"
            : "音声の準備待ち。CPUがバッファに音を用意すると再生します。"
          : snapshot.cpu.owner === "music"
            ? "CPUで次の音を準備し、バッファに補充しています。"
            : "準備済みの音を再生中。別のアプリを表示しても音は続きます。";
  const photo = snapshot.apps.photo.photo;
  const photoPending = pendingFor("photo").length > 0;
  const photoWait = snapshot.apps.photo.memoryWait;
  const photoLoading = photo.phase !== "ready";
  const visibleFilter = photo.processing ? photo.filter : photo.completedFilter;
  const progress = photo.processing
    ? photo.progress
    : photo.completedFilter
      ? 100
      : 0;
  $("photo-overlay").style.filter = filters[visibleFilter]?.[1] || "none";
  $("photo-overlay").style.clipPath = `inset(0 ${100 - progress}% 0 0)`;
  $("photo-stage").dataset.loading = String(photoLoading);
  $("photo-loading").hidden = !photoLoading;
  const photoLoadMessages = {
    idle: ["画像の読み込み待ち", "起動すると画像ファイルを読み込みます。"],
    request: ["画像を読み込み中", "CPUで読み込み要求を準備しています。"],
    read: ["画像を読み込み中", "記憶装置の読み込み待ち。CPUはほかの処理へ。"],
    "decode-wait": ["画像を読み込み中", "読み込み完了。OSの割り込み処理を待っています。"],
    decode: ["画像を展開中", "CPUで画像を展開し、画面に表示します。"],
  };
  const photoLoadMessage = photoLoadMessages[photo.phase] || ["", ""];
  $("photo-load-label").textContent = photoLoadMessage[0];
  $("photo-load-detail").textContent = photoLoadMessage[1];
  $("photo-progress").textContent = photoLoading
    ? `読み込み ${Math.round(photo.loadProgress)}%`
    : photo.processing || photo.completedFilter
      ? `加工 ${Math.round(progress)}%`
      : "✓ 読み込み完了";
  $("photo-start").disabled =
    photoLoading || photo.processing || photoPending || Boolean(photoWait);
  $("photo-filter").disabled =
    photoLoading || photo.processing || photoPending || Boolean(photoWait);
  $("photo-caption").textContent = photoLoading
    ? `画像の読み込み ${Math.round(photo.loadProgress)}% · 読み込み待ちとCPU処理を順に実行`
    : `CPUで処理した量 ${photo.completed} / ${photo.required} tick${photo.processing ? " · 作業用メモリ +200 MB" : ""}`;
  $("photo-status").textContent = photoPending
    ? playing
      ? "加工の入力を受け付けました。"
      : "入力を受け付けました。OSの「再生」で加工を進めます。"
    : photoLoading
      ? !playing
        ? "OSを一時停止中。OSの「再生」で画像の読み込みを進めます。"
        : photoLoadMessage[1]
      : photoWait
        ? `作業用メモリを待っています。${memoryWaitMessage(photoWait)}`
        : photo.processing
          ? !playing
            ? "OSを一時停止中。加工の進捗と作業用メモリを保持します。"
            : snapshot.cpu.owner === "photo"
              ? "CPU割り当て中。この時間だけ加工が進みます。"
              : "CPUの順番待ち。加工は止まり、作業用メモリは保持します。"
          : photo.completedFilter
            ? `「${filters[photo.completedFilter]?.[0] || photo.completedFilter}」の加工完了。作業用メモリを解放しました。`
            : "効果を選んで加工。CPUの割り当てと進捗を見比べましょう。";
  renderProcessStatus();
}
function renderAudioControls() {
  if (!soundtrack || !$("volume")) return;
  $("volume").value = String(Math.round(soundtrack.volume * 100));
  $("volume-value").textContent = `${Math.round(soundtrack.volume * 100)}%`;
  $("mute-toggle").textContent = soundtrack.muted ? "消音を解除" : "消音";
  $("mute-toggle").setAttribute("aria-pressed", String(soundtrack.muted));
  const feedback = $("audio-feedback");
  if (soundtrack.status === "blocked") {
    if (!feedback.querySelector("button"))
      feedback.innerHTML =
        '音声の再生が保留されています。<button type="button" data-action="audio-retry">音声を再開</button>';
  } else
    feedback.textContent =
      soundtrack.status === "error"
        ? "音源を読み込めませんでした。ページを再読み込みしてください。"
        : soundtrack.status === "retrying"
          ? "ブラウザで音声が中断されました。間を置いて再開します。"
          : soundtrack.muted || soundtrack.volume === 0
            ? "消音中。音声バッファの動きは観察できます。"
            : soundtrack.status === "loading" && snapshot.apps.music.music.playing
              ? "音源を読み込んでいます。"
              : "";
}
function renderHistory() {
  const entries = snapshot.history.slice(-historyColumns);
  const history = $("cpu-history");
  if (snapshot.time < lastHistoryTime) {
    history.replaceChildren();
    historyButtons.clear();
  }
  lastHistoryTime = snapshot.time;
  const allowed = new Set(entries.map((entry) => entry.time));
  for (const [time, cell] of historyButtons)
    if (!allowed.has(time)) {
      cell.remove();
      historyButtons.delete(time);
    }
  const placeholders = [...history.querySelectorAll(".history-placeholder")];
  const required = historyColumns - entries.length;
  for (const placeholder of placeholders.slice(required)) placeholder.remove();
  for (let i = placeholders.length; i < required; i++) {
    const placeholder = document.createElement("span");
    placeholder.className = "history-placeholder";
    placeholder.setAttribute("aria-hidden", "true");
    history.prepend(placeholder);
  }
  for (const entry of entries)
    if (!historyButtons.has(entry.time)) {
      const cell = document.createElement("span");
      cell.className = "history-cell";
      cell.dataset.time = entry.time;
      cell.dataset.owner = entry.owner;
      cell.setAttribute("role", "img");
      cell.title = `${entry.time} tick：${names[entry.owner]}。${entry.task}。${entry.reason}`;
      cell.setAttribute("aria-label", cell.title);
      history.append(cell);
      historyButtons.set(entry.time, cell);
    }
  // Widening restores older entries from the retained simulation history.
  // Insert them before the existing cells so the timeline remains chronological.
  const ordered = [
    ...history.querySelectorAll(".history-placeholder"),
    ...entries.map((entry) => historyButtons.get(entry.time)),
  ];
  ordered.forEach((cell, index) => {
    if (history.children[index] !== cell)
      history.insertBefore(cell, history.children[index] || null);
  });
  $("history-range").textContent = entries.length
    ? `${entries[0].time} → ${entries.at(-1).time} tick`
    : "過去 → 現在";
}
function fitHistory(contentWidth) {
  const history = $("cpu-history");
  const style = window.getComputedStyle(history);
  const width = contentWidth ?? history.clientWidth
    - (parseFloat(style.paddingLeft) || 0)
    - (parseFloat(style.paddingRight) || 0);
  if (!Number.isFinite(width) || width <= 0) return;
  const gap = parseFloat(style.columnGap) || 0;
  // The simulation retains 240 ticks. Keep cells close to 14px while filling
  // the available content width, in normal and fullscreen layouts alike.
  const columns = Math.min(240, Math.max(1, Math.floor((width + gap) / (14 + gap))));
  if (columns === historyColumns) return;
  historyColumns = columns;
  history.style.setProperty("--history-columns", String(columns));
  renderHistory();
}
function renderMemory() {
  const memory = snapshot.memory;
  const owner = (segment) =>
    segment.id.includes("work") ? "workspace" : segment.id;
  $("memory-total").textContent = `${memory.used} / ${memory.total} MB 使用中`;
  const shortLabels = {
    os: "OS",
    web: "Web",
    music: "音楽",
    photo: "写真",
    "photo-work": "写真の作業用",
    notify: "通知",
    sync: "同期",
    security: "セキュリティ",
    free: "空き",
  };
  $("memory-band").innerHTML = memory.segments
    .filter((segment) => segment.size > 0)
    .map((segment) => {
      const name = shortLabels[segment.id] || segment.label;
      const size = `${segment.size} MB`;
      return `<div class="memory-segment" data-owner="${owner(segment)}" style="width:${(segment.size / memory.total) * 100}%;--name-width:${name.length + 0.6};--size-width:${size.length * 0.7 + 0.6}" title="${esc(segment.label)} ${size}"><span class="memory-label-name">${esc(name)}</span><span class="memory-label-size">${size}</span></div>`;
    })
    .join("");
  $("memory-labels").hidden = true;
  $("memory-band").setAttribute(
    "aria-label",
    memory.segments
      .map((segment) => `${segment.label} ${segment.size} MB`)
      .join("、"),
  );
  const waits = snapshot.memoryWaits || [];
  $("allocation-notice").hidden = true;
  if (waits.length) {
    $("allocation-title").textContent =
      `メモリの空き待ち：${waits.map((wait) => names[wait.id]).join("、")}`;
    $("allocation-message").textContent =
      waits.map((wait) => `${names[wait.id]} ${wait.required} MB`).join("／") +
      `。空き ${memory.free} MB。空きができると自動で再開します。`;
  }
}
function renderDetails() {
  $("process-table").innerHTML = Object.entries(snapshot.apps)
    .map(
      ([id, app]) =>
        `<tr><td>${names[id]}</td><td>${app.running ? "起動中" : "未起動"}</td><td>${snapshot.visible === id ? "表示中" : "—"}</td><td>${states[app.state]}</td><td>${app.memory} MB</td></tr>`,
    )
    .join("");
  $("pending-inputs").textContent = snapshot.pendingInputs.length
    ? `OSへの入力待ち：${snapshot.pendingInputs.map((input) => input.label).join("、")}`
    : "OSへの入力待ち：なし";
  $("event-log").innerHTML =
    snapshot.events
      .slice(-80)
      .reverse()
      .map(
        (event) =>
          `<li><time>${event.time} tick</time>${esc(event.message)}</li>`,
      )
      .join("") || "<li>操作すると、OSの処理や切り替えが記録されます。</li>";
}
function render() {
  $("time").textContent = snapshot.time;
  renderLauncher();
  renderBackgroundLauncher();
  renderAppViews();
  const cpu = snapshot.cpu;
  $("cpu-current").dataset.owner = cpu.owner;
  $("cpu-owner").textContent = names[cpu.owner];
  $("cpu-task").textContent = cpu.task;
  $("quantum-track")
    .querySelectorAll("i")
    .forEach((bar, index) =>
      bar.classList.toggle(
        "used",
        !["os", "idle"].includes(cpu.owner) && index < snapshot.quantum.used,
      ),
    );
  $("quantum-caption").textContent =
    cpu.owner === "os"
      ? "OSも同じCPUで処理します"
      : cpu.owner === "idle"
        ? "実行できる仕事がなく、CPUは空いています"
        : `今回の割り当て ${snapshot.quantum.used} / ${snapshot.quantum.size} tick`;
  const ready = Object.entries(snapshot.apps).filter(
    ([, app]) => app.state === "ready",
  );
  $("ready-queue").innerHTML = ready.length
    ? ready
        .map(
          ([id]) =>
            `<span class="queue-chip" data-owner="${id}">${names[id]}</span>`,
        )
        .join("")
    : "なし";
  renderHistory();
  renderMemory();
  $("explanation").textContent = snapshot.memoryWaits.length
    ? `メモリの空き待ち：${snapshot.memoryWaits.map((wait) => `${names[wait.id]} ${wait.required} MB`).join("、")}。空き ${snapshot.memory.free} MB。空きができると自動で再開します。`
    : snapshot.explain;
  $("first-hint").textContent =
    snapshot.pendingInputs.length && !playing
      ? "操作を受け付けました。「再生」でOSを動かすと処理が進みます。"
      : "起動中＝メモリにある。表示中＝画面で見ている。CPU割り当て中＝いま処理している。";
  if ($("state-details").open) renderDetails();
  soundtrack.sync(
    snapshot,
    playing && currentAudioTrackId === snapshot.apps.music.music.track,
  );
  renderAudioControls();
}
function animate(timestamp) {
  if (playing && lastFrame !== null) {
    accumulator += Math.min(timestamp - lastFrame, 200);
    while (accumulator >= TICK_MS) {
      snapshot = simulation.step();
      accumulator -= TICK_MS;
      render();
    }
  }
  lastFrame = timestamp;
  requestAnimationFrame(animate);
}
makeLauncher();
makeBackgroundLauncher();
makeAppViews();
initFullscreen({ panel: $("os-workspace"), button: $("fullscreen-toggle") });
if (window.ResizeObserver) {
  const historyResizeObserver = new window.ResizeObserver(([entry]) => {
    fitHistory(entry.contentRect.width);
  });
  historyResizeObserver.observe($("cpu-history"));
} else {
  const refit = () => requestAnimationFrame(() => fitHistory());
  window.addEventListener("resize", refit);
  document.addEventListener("fullscreenchange", refit);
  $("fullscreen-toggle").addEventListener("click", refit);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") refit();
  });
}
fitHistory();
setPlaying(false);
requestAnimationFrame(animate);

import {
  OSSimulation,
  APP_CONFIG,
  FOREGROUND_IDS,
  BACKGROUND_IDS,
} from "./simulation.mjs";
import { RecordedAudioController } from "./audio-controller.mjs";
import { tracks } from "./audio/tracks.mjs";

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
const backgroundHints = {
  notify: "模擬通知を受信すると短く処理",
  sync: "CPU処理と通信待ちで同期",
  security: "定期的に自動スキャン",
};
const states = {
  running: "CPUで実行中",
  ready: "実行待ち",
  waiting: "イベント待ち",
  stopped: "未起動",
};
const topics = {
  nature: [
    "森の小さな図書館",
    "木々は光を受けて育ち、季節ごとに姿を変えます。読み終わるまで、このページの表示は続きます。",
    "FOREST / FIELD NOTES",
  ],
  space: [
    "星空の向こうへ",
    "夜空に見える光の多くは、はるか遠くから届いたもの。ページを読んでいる間、Webのプロセスは次の操作を待ちます。",
    "SPACE / FIELD NOTES",
  ],
  city: [
    "まちを歩いてみよう",
    "通りの形や標識には、暮らしを支える工夫があります。別のアプリを表示しても、このページはメモリに残ります。",
    "CITY / FIELD NOTES",
  ],
};
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
let selectedHistory = null;
let historyInfoKey = null;
let lastHistoryTime = -1;
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
  tickSeconds: TICK_MS / 1000,
  onStatus: () => renderAudioControls(),
});

function safeAction(action) {
  snapshot = action();
  render();
}
function setPlaying(next) {
  playing = next;
  accumulator = 0;
  lastFrame = null;
  $("play").textContent = playing ? "Ⅱ 一時停止" : "▶ 再生";
  $("play").setAttribute("aria-pressed", String(playing));
  render();
}
$("play").addEventListener("click", () => {
  if (!playing) void soundtrack.unlock();
  setPlaying(!playing);
});
$("reset").addEventListener("click", () => {
  playing = false;
  selectedHistory = null;
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
  $("background-launcher").innerHTML = BACKGROUND_IDS.map(
    (id) =>
      `<div class="background-row" data-owner="${id}" data-background-row="${id}"><div class="background-copy"><div class="background-name"><strong>${names[id]}</strong><span class="background-memory"></span></div><p><strong class="background-state"></strong><span class="background-task"></span></p></div><button type="button" data-action="lifecycle" data-app="${id}">起動</button></div>`,
  ).join("");
}
function makeAppViews() {
  const empty = (id) =>
    `<div class="empty-app" data-empty="${id}"><span class="empty-icon" aria-hidden="true">${icons[id]}</span><h3>${names[id]}は未起動です</h3><p>起動するとメモリを確保し、アプリを操作できます。</p><button type="button" class="primary" data-action="launch" data-app="${id}">このアプリを起動</button><p class="app-status" data-launch-status="${id}"></p></div>`;
  const web = `<div class="app-toolbar"><select id="web-topic" aria-label="読み込むページ">${Object.entries(
    topics,
  )
    .map(([id, content]) => `<option value="${id}">${content[0]}</option>`)
    .join(
      "",
    )}</select><button type="button" data-action="web-load">読み込む</button></div><div class="web-article" id="web-article"></div><p class="app-status" id="web-status"></p>`;
  const music = `<div class="music-top"><div class="album-art" aria-hidden="true">♫</div><div class="song-title"><h3 id="song-title">DURU Roomscene Lofi</h3><p id="song-artist">DURU-AI / CC0</p></div></div><div class="music-track-select"><label for="music-track">曲</label><select id="music-track">${tracks.map((track) => `<option value="${track.id}">${esc(track.title)}</option>`).join("")}</select></div><div class="music-controls"><button type="button" class="primary" data-action="music-play" id="music-play">▶ 音楽を再生</button><span class="elapsed" id="music-elapsed">00:00</span></div><div class="volume-controls"><button type="button" data-action="mute" id="mute-toggle" aria-pressed="false">消音</button><label for="volume">音量</label><input type="range" id="volume" min="0" max="100" value="45" step="1" /><output id="volume-value" for="volume">45%</output></div><p class="audio-feedback" id="audio-feedback" role="status"></p><div class="buffer-heading"><span>音声バッファ <small>（再生待ちの音）</small></span><strong id="buffer-count">0 / 24</strong></div><div id="buffer-track" class="buffer-track" role="progressbar" aria-label="音声バッファ残量" aria-valuemin="0" aria-valuemax="24" aria-valuenow="0"><span id="buffer-fill"></span></div><p class="app-status" id="music-status"></p><details class="music-credit"><summary>音源について</summary><p><a href="https://github.com/uncle-sheepsky/duru-ai-cc0-bgm#license--please-read" target="_blank" rel="noopener noreferrer">DURU-AI / uncle-sheepsky</a> が作曲・録音ともに<a href="./audio/CC0-1.0.txt">CC0</a>で提供した音源です。音声バッファの量は教材用のモデルです。</p><ul>${tracks.map((track) => `<li><a href="${esc(track.source)}" target="_blank" rel="noopener noreferrer">${esc(track.title)} の配布元</a></li>`).join("")}</ul><p>配信用にMP3を再圧縮しています。<a href="./audio/tracks.json">3曲の出典・加工内容</a></p></details>`;
  const photo = `<div class="app-toolbar"><select id="photo-filter" aria-label="写真の加工効果">${Object.entries(
    filters,
  )
    .map(([id, filter]) => `<option value="${id}">${filter[0]}</option>`)
    .join(
      "",
    )}</select><button type="button" class="primary" data-action="photo-start" id="photo-start">加工する</button></div><div class="photo-stage"><div class="photo-original">${landscape}</div><div class="photo-overlay" id="photo-overlay">${landscape.replaceAll('id="sky"', 'id="sky-overlay"').replaceAll("url(#sky)", "url(#sky-overlay)")}</div><span class="photo-progress" id="photo-progress">未加工</span></div><p class="photo-caption" id="photo-caption"></p><p class="app-status" id="photo-status"></p>`;
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
  if (action === "view") safeAction(() => simulation.view(app));
  else if (action === "lifecycle" && (event.detail || 0) < 2) {
    if (
      snapshot.pendingInputs.some(
        (input) => input.id === app && ["launch", "close"].includes(input.type),
      )
    )
      return;
    safeAction(() =>
      snapshot.apps[app].running
        ? simulation.close(app)
        : simulation.launch(app),
    );
  }
}
$("app-launcher").addEventListener("click", handleLauncherClick);
$("background-launcher").addEventListener("click", handleLauncherClick);
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
    safeAction(() => simulation.launch(button.dataset.app));
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
$("cpu-history").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-time]");
  if (!button) return;
  selectedHistory = snapshot.history.find(
    (entry) => entry.time === Number(button.dataset.time),
  );
  renderHistory();
});
$("history-info").addEventListener("click", (event) => {
  if (event.target.closest("button")) {
    selectedHistory = null;
    renderHistory();
  }
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
    const pending = pendingFor(id).some((input) =>
      ["launch", "close"].includes(input.type),
    );
    row.dataset.visible = String(snapshot.visible === id);
    const failure = snapshot.failures?.[id];
    row.dataset.state = pending ? "pending" : failure ? "failed" : app.state;
    row.querySelector(".app-state-dot").classList.toggle("on", app.running);
    row.querySelector(".app-state-label").textContent = pending
      ? "OSが操作を受け付けました"
      : failure
        ? app.running
          ? "起動中 · 作業メモリ不足"
          : "メモリ不足 · 未起動"
        : app.running
          ? `起動中 · ${states[app.state]}`
          : "未起動";
    const view = row.querySelector('[data-action="view"]');
    view.textContent = snapshot.visible === id ? "表示中" : "表示";
    view.setAttribute("aria-pressed", String(snapshot.visible === id));
    const lifecycle = row.querySelector('[data-action="lifecycle"]');
    lifecycle.textContent = pending
      ? app.running
        ? "終了待ち"
        : "起動待ち"
      : app.running
        ? "終了"
        : failure
          ? "再試行"
          : "起動";
    lifecycle.disabled = pending;
    lifecycle.setAttribute(
      "aria-label",
      `${names[id]}を${app.running ? "終了" : "起動"}`,
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
    const pending = pendingFor(id).some((input) =>
      ["launch", "close"].includes(input.type),
    );
    const failure = snapshot.failures?.[id];
    row.dataset.state = pending ? "pending" : failure ? "failed" : app.state;
    row.querySelector(".background-memory").textContent =
      `${app.running ? app.memory : APP_CONFIG[id].memory} MB${app.running ? " 保持" : " 必要"}`;
    row.querySelector(".background-state").textContent = pending
      ? "OSの処理待ち"
      : failure
        ? "メモリ不足 · 未起動"
        : app.state === "running"
          ? "● CPU割り当て中"
          : app.state === "ready"
            ? "◷ CPUの順番待ち"
            : app.running
              ? "Ⅱ イベント待ち · CPU未使用"
              : "未起動";
    let task = backgroundHints[id];
    if (pending)
      task = playing ? "操作を受け付けました" : "OSの「再生」で進みます";
    else if (failure)
      task = `必要 ${failure.required} MB／失敗時の空き ${failure.available} MB`;
    else if (app.running) {
      if (!playing) task = "OS一時停止中";
      else if (app.state === "running" || app.state === "ready")
        task = app.task;
      else if (background.pendingEvent)
        task = "イベント発生 · OSの割り込み待ち";
      else if (background.phase === "network")
        task = `通信の完了まで ${background.networkRemaining} tick`;
      else
        task = `次の${id === "notify" ? "通知" : id === "sync" ? "同期" : "スキャン"}まで ${Math.max(0, background.nextEventAt - snapshot.time)} tick`;
    }
    row.querySelector(".background-task").textContent = ` · ${task}`;
    const button = row.querySelector("button");
    button.disabled = pending;
    button.textContent = pending
      ? app.running
        ? "終了待ち"
        : "起動待ち"
      : app.running
        ? "終了"
        : failure
          ? "再試行"
          : "起動";
    button.setAttribute(
      "aria-label",
      `${names[id]}を${app.running ? "終了" : "起動"}`,
    );
  }
}
function allocationFeedback(failure) {
  return `${failure.time} tick の操作では ${failure.required} MB 必要でしたが、空きは ${failure.available} MB でした。現在の空きは ${snapshot.memory.free} MB。${snapshot.memory.free >= failure.required ? "現在は必要な空きがあります。同じ操作を再試行できます。" : "ほかのアプリを終了するか、加工の完了を待ってから再試行してください。"}`;
}
function renderProcessStatus() {
  const id = snapshot.visible;
  const app = snapshot.apps[id];
  const pending = pendingFor(id);
  const failure = snapshot.failures?.[id];
  const status = $("window-process-status");
  status.dataset.owner = id;
  status.dataset.paused = String(!playing);
  status.dataset.state = pending.length
    ? "pending"
    : failure
      ? "failed"
      : app.state;
  const label = {
    running: "● CPU割り当て中",
    ready: "◷ CPUの順番待ち",
    waiting: "Ⅱ イベント待ち · CPU未使用",
    stopped: "未起動",
  };
  let detail;
  if (pending.length)
    detail = playing
      ? "入力を受け付けました。OSが順番に処理します。"
      : "OSは一時停止中です。「再生」で受け付けた操作を進めます。";
  else if (failure)
    detail = `${allocationFeedback(failure)} CPUの順番待ちとは異なる、メモリ確保の失敗です。`;
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
    : failure
      ? failure.operation === "workspace"
        ? "作業用メモリの確保に失敗"
        : "メモリ不足で起動できません"
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
      pending.length > 0;
    $("app-content").querySelector(`[data-launch-status="${id}"]`).textContent =
      pending.length
        ? playing
          ? "OSが起動を処理しています。"
          : "起動を受け付けました。「再生」でOSを動かしてください。"
        : snapshot.failures?.[id]?.operation === "launch"
          ? allocationFeedback(snapshot.failures[id])
          : "";
    $("app-content").querySelector(`[data-empty="${id}"] button`).textContent =
      snapshot.failures?.[id]?.operation === "launch"
        ? "起動を再試行"
        : "このアプリを起動";
  }
  const web = snapshot.apps.web.web;
  const webPending = pendingFor("web").length > 0;
  const content = topics[web.page] || null;
  const articleKey = web.page || "empty";
  if ($("web-article").dataset.page !== articleKey) {
    $("web-article").dataset.page = articleKey;
    $("web-article").className = `web-article ${esc(web.page || "")}`;
    $("web-article").innerHTML = content
      ? `<div class="article-banner">${content[2]}</div><h3>${content[0]}</h3><p>${content[1]}</p>`
      : '<div class="article-banner">WEB BROWSER</div><h3>気になるページを開いてみよう</h3><p>ページを選んで「読み込む」。CPUの仕事と通信待ちが交互に現れます。</p>';
  }
  const webStatus = {
    idle: "操作を待っています。画面表示だけならCPUは使い続けません。",
    request: "読み込みの準備中。CPUの割り当てを待ちます。",
    network: "通信待ち。CPUを使わずデータの到着を待っています。",
    render: "CPUが割り当てられた時間だけ、ページの描画が進みます。",
    loaded: "読み込み完了。画面を表示したまま次の操作を待っています。",
  };
  $("web-status").textContent = webPending
    ? playing
      ? "読み込みの入力を受け付けました。"
      : "入力を受け付けました。OSの「再生」で進みます。"
    : webStatus[web.phase];
  $("app-content").querySelector('[data-action="web-load"]').disabled =
    webPending || ["request", "network", "render"].includes(web.phase);
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
  const elapsedSeconds = Math.floor(
    ((music.elapsed * TICK_MS) / 1000) % track.duration,
  );
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
          ? "音声の準備待ち。バッファに音がたまると再生します。"
          : snapshot.cpu.owner === "music"
            ? "CPUで次の音を準備し、バッファに補充しています。"
            : "準備済みの音を再生中。別のアプリを表示しても音は続きます。";
  const photo = snapshot.apps.photo.photo;
  const photoPending = pendingFor("photo").length > 0;
  const photoFailure =
    snapshot.failures?.photo?.operation === "workspace"
      ? snapshot.failures.photo
      : null;
  const visibleFilter = photo.processing ? photo.filter : photo.completedFilter;
  const progress = photo.processing
    ? photo.progress
    : photo.completedFilter
      ? 100
      : 0;
  $("photo-overlay").style.filter = filters[visibleFilter]?.[1] || "none";
  $("photo-overlay").style.clipPath = `inset(0 ${100 - progress}% 0 0)`;
  $("photo-progress").textContent = `${Math.round(progress)}%`;
  $("photo-start").disabled = photo.processing || photoPending;
  $("photo-filter").disabled = photo.processing || photoPending;
  $("photo-caption").textContent =
    `CPUで処理した量 ${photo.completed} / ${photo.required} tick${photo.processing ? " · 作業用メモリ +200 MB" : ""}`;
  $("photo-status").textContent = photoPending
    ? playing
      ? "加工の入力を受け付けました。"
      : "入力を受け付けました。OSの「再生」で加工を進めます。"
    : photoFailure
      ? `メモリ不足で加工を開始できません。作業用に ${photoFailure.required} MB 必要です。${snapshot.memory.free >= photoFailure.required ? "現在は空きがあります。「加工する」で再試行できます。" : "ほかのアプリを終了してから再試行してください。"}`
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
        : soundtrack.muted || soundtrack.volume === 0
          ? "消音中。音声バッファの動きは観察できます。"
          : soundtrack.status === "loading" && snapshot.apps.music.music.playing
            ? "音源を読み込んでいます。"
            : "";
}
function renderHistory() {
  const entries = snapshot.history.slice(-24);
  const history = $("cpu-history");
  const follow =
    history.scrollLeft + history.clientWidth >= history.scrollWidth - 10;
  if (snapshot.time < lastHistoryTime) {
    history.replaceChildren();
    historyButtons.clear();
  }
  lastHistoryTime = snapshot.time;
  const allowed = new Set(entries.map((entry) => entry.time));
  for (const [time, button] of historyButtons)
    if (!allowed.has(time)) {
      button.remove();
      historyButtons.delete(time);
    }
  const placeholders = [...history.querySelectorAll(".history-placeholder")];
  const required = 24 - entries.length;
  for (const placeholder of placeholders.slice(required)) placeholder.remove();
  for (let i = placeholders.length; i < required; i++) {
    const placeholder = document.createElement("span");
    placeholder.className = "history-placeholder";
    placeholder.setAttribute("aria-hidden", "true");
    history.prepend(placeholder);
  }
  for (const entry of entries) {
    let button = historyButtons.get(entry.time);
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.dataset.time = entry.time;
      button.dataset.owner = entry.owner;
      button.setAttribute(
        "aria-label",
        `${entry.time} tick：${names[entry.owner]}。${entry.task}`,
      );
      button.title = `${entry.time} tick：${names[entry.owner]}`;
      history.append(button);
      historyButtons.set(entry.time, button);
    }
    button.setAttribute(
      "aria-pressed",
      String(selectedHistory?.time === entry.time),
    );
  }
  if (follow && !selectedHistory && !history.contains(document.activeElement))
    history.scrollLeft = history.scrollWidth;
  $("history-range").textContent = entries.length
    ? `${entries[0].time} → ${entries.at(-1).time} tick`
    : "過去 → 現在";
  const key = selectedHistory?.time ?? "none";
  if (historyInfoKey !== key) {
    historyInfoKey = key;
    if (selectedHistory) {
      const entry = selectedHistory;
      $("history-info").innerHTML =
        `<strong>${entry.time} tick · ${names[entry.owner]}：${esc(entry.task)}</strong><p>${esc(entry.reason)} メモリ使用量 ${entry.memory.used} MB。</p><button type="button" class="history-unselect">選択を解除</button>`;
    } else
      $("history-info").innerHTML =
        "<p>履歴のマスを選ぶと、処理内容と切り替え理由が分かります。</p>";
  }
}
function renderMemory() {
  const memory = snapshot.memory;
  const owner = (segment) =>
    segment.id.includes("work") ? "workspace" : segment.id;
  $("memory-total").textContent = `${memory.used} / ${memory.total} MB 使用中`;
  $("memory-band").innerHTML = memory.segments
    .filter((segment) => segment.size > 0)
    .map(
      (segment) =>
        `<div class="memory-segment" data-owner="${owner(segment)}" style="width:${(segment.size / memory.total) * 100}%" title="${esc(segment.label)} ${segment.size} MB">${segment.size / memory.total > 0.12 ? esc(segment.label) : ""}</div>`,
    )
    .join("");
  $("memory-labels").innerHTML = memory.segments
    .filter((segment) => segment.size > 0)
    .map(
      (segment) =>
        `<span data-owner="${owner(segment)}">${esc(segment.label)} ${segment.size} MB</span>`,
    )
    .join("");
  $("memory-band").setAttribute(
    "aria-label",
    memory.segments
      .map((segment) => `${segment.label} ${segment.size} MB`)
      .join("、"),
  );
  const failure = snapshot.lastFailure;
  $("allocation-notice").hidden = !failure;
  if (failure) {
    $("allocation-title").textContent =
      `メモリ不足：${names[failure.id]}の${failure.operation === "workspace" ? "作業領域を確保できません" : "起動に失敗"}`;
    $("allocation-message").textContent =
      `${failure.time} tick の操作：${failure.required} MB 必要でしたが、空きは ${failure.available} MB でした。現在の空きは ${memory.free} MB。${memory.free >= failure.required ? "必要な空きができたので、同じ操作をもう一度試せます。" : "ほかのアプリを終了するか、加工の完了を待ってから再試行してください。"} メモリ不足によるアプリの自動終了はありません。CPUの競合は順番待ち、メモリ不足は処理開始の失敗です。`;
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
  $("explanation").textContent = snapshot.explain;
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
setPlaying(false);
requestAnimationFrame(animate);

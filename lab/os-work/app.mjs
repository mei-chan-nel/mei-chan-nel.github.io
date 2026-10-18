import { OSSimulation } from './simulation.mjs';

const simulation = new OSSimulation();
const $ = (id) => document.getElementById(id);
const names = { web: 'Webブラウザ', music: '音楽再生', photo: '写真加工', os: 'OS', idle: 'アイドル' };
const icons = { web: '◎', music: '♫', photo: '▧' };
const states = { running: 'CPUで実行中', ready: '実行待ち', waiting: 'イベント待ち', stopped: '未起動' };
const topics = { nature: ['森の小さな図書館', '木々は光を受けて育ち、季節ごとに姿を変えます。読み終わるまで、このページの表示は続きます。', 'FOREST / FIELD NOTES'], space: ['星空の向こうへ', '夜空に見える光の多くは、はるか遠くから届いたもの。ページを読んでいる間、Webのプロセスは次の操作を待ちます。', 'SPACE / FIELD NOTES'], city: ['まちを歩いてみよう', '通りの形や標識には、暮らしを支える工夫があります。別のアプリを表示しても、このページはメモリに残ります。', 'CITY / FIELD NOTES'] };
const filters = { warm: ['夏色', 'saturate(1.9) contrast(1.08)'], mono: ['モノクロ', 'grayscale(1)'], sunset: ['夕焼け', 'sepia(.65) saturate(2.1) hue-rotate(330deg)'] };
const landscape = `<svg viewBox="0 0 640 230" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="山と湖の風景"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#badbdc"/><stop offset="1" stop-color="#eaf0d9"/></linearGradient></defs><path fill="url(#sky)" d="M0 0h640v230H0z"/><circle cx="488" cy="52" r="25" fill="#f6df99"/><path fill="#93b8ad" d="M0 142 135 32 260 143 372 56 526 143 640 83v147H0z"/><path fill="#5c9287" d="M0 170 124 93 234 166 410 91 558 176 640 124v106H0z"/><path fill="#bcd9d4" d="M0 170h640v60H0z"/><path fill="#649a8d" d="m0 170 70 12 95 48H0zm640 0-80 14-70 46h150z"/><path stroke="#ecf3e6" stroke-width="3" d="M232 194h160m-190 16h228m-151 13h112"/><path fill="#2f655b" d="m30 160 16-42 17 42h-9l12 25H26l12-25zm550 4 19-50 20 50h-11l15 29h-48l15-29z"/></svg>`;
const esc = (s) => String(s ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
let playing = false;
let speed = 1;
let lastFrame = 0;
let accumulator = 0;
let selectedHistory = null;
let currentView = null;
let webChoice = 'nature';
let photoChoice = 'warm';
let soundEnabled = false;
let audioContext;
let voice;
let audioGain;
let snapshot = simulation.snapshot();

function safeAction(action) {
  snapshot = action();
  render();
}
function setPlaying(next) {
  playing = next;
  accumulator = 0;
  lastFrame = 0;
  $('play').textContent = playing ? 'Ⅱ 一時停止' : '▶ 再生';
  $('play').setAttribute('aria-pressed', String(playing));
  $('step').disabled = playing;
  syncAudio();
}
$('play').addEventListener('click', () => setPlaying(!playing));
$('step').addEventListener('click', () => safeAction(() => simulation.step()));
$('reset').addEventListener('click', () => {
  setPlaying(false);
  selectedHistory = null;
  webChoice = 'nature';
  photoChoice = 'warm';
  safeAction(() => simulation.reset());
});
$('speed').addEventListener('change', (event) => { speed = Number(event.target.value); accumulator = 0; });
document.addEventListener('visibilitychange', () => { if (document.hidden) setPlaying(false); });
$('app-launcher').addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const { action, app } = button.dataset;
  if (action === 'view') safeAction(() => simulation.view(app));
  else if (action === 'launch') safeAction(() => simulation.launch(app));
  else if (action === 'close') safeAction(() => simulation.close(app));
});
$('app-content').addEventListener('change', (event) => {
  if (event.target.id === 'web-topic') webChoice = event.target.value;
  if (event.target.id === 'photo-filter') photoChoice = event.target.value;
});
$('app-content').addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  if (action === 'launch') safeAction(() => simulation.launch(snapshot.visible));
  if (action === 'web-load') safeAction(() => simulation.webLoad(webChoice));
  if (action === 'music-play') {
    safeAction(() => simulation.toggleMusic());
    if (soundEnabled) await prepareAudio();
  }
  if (action === 'photo-start') safeAction(() => simulation.startPhoto(photoChoice));
  if (action === 'sound') {
    soundEnabled = !soundEnabled;
    if (soundEnabled) {
      try { await prepareAudio(); } catch { soundEnabled = false; }
    }
    syncAudio();
    updateAppContent();
  }
});
$('cpu-history').addEventListener('click', (event) => {
  const button = event.target.closest('button[data-time]');
  if (!button) return;
  selectedHistory = snapshot.history.find((entry) => entry.time === Number(button.dataset.time));
  renderHistory();
});
$('history-info').addEventListener('click', (event) => {
  if (event.target.closest('button')) { selectedHistory = null; renderHistory(); }
});
$('state-details').addEventListener('toggle', () => { if ($('state-details').open) renderDetails(); });

function renderLauncher() {
  const active = document.activeElement;
  const focusKey = active?.closest('#app-launcher') ? `${active.dataset.app}:${active.dataset.action}` : null;
  $('app-launcher').innerHTML = Object.entries(snapshot.apps).map(([id, app]) => {
    const pending = snapshot.pendingInputs.some((input) => input.id === id && ['launch', 'close'].includes(input.type));
    return `<div class="app-row" data-owner="${id}" data-visible="${snapshot.visible === id}"><div class="app-name"><span class="app-icon" aria-hidden="true">${icons[id]}</span><div><strong>${names[id]}</strong><small><span class="app-state-dot ${app.running ? 'on' : ''}"></span>${pending ? 'OSの処理待ち' : app.running ? `起動中 · ${states[app.state]}` : '未起動'}</small></div></div><button type="button" data-action="view" data-app="${id}" aria-pressed="${snapshot.visible === id}" aria-label="${names[id]}を表示">${snapshot.visible === id ? '表示中' : '表示'}</button><button type="button" data-action="${app.running ? 'close' : 'launch'}" data-app="${id}" ${pending ? 'disabled' : ''} aria-label="${names[id]}を${app.running ? '終了' : '起動'}">${app.running ? '終了' : '起動'}</button></div>`;
  }).join('');
  if (focusKey) {
    const [app, action] = focusKey.split(':');
    const replacement = $('app-launcher').querySelector(`[data-app="${app}"][data-action="${action}"]`) || $('app-launcher').querySelector(`[data-app="${app}"][data-action="view"]`);
    replacement?.focus({ preventScroll: true });
  }
}
function renderAppFrame() {
  const app = snapshot.apps[snapshot.visible];
  const frameKey = `${snapshot.visible}:${app.running}`;
  $('window-title').textContent = names[snapshot.visible];
  if (currentView === frameKey) { updateAppContent(); return; }
  currentView = frameKey;
  if (!app.running) {
    $('app-content').innerHTML = `<div class="empty-app"><span class="empty-icon" aria-hidden="true">${icons[snapshot.visible]}</span><h3>${names[snapshot.visible]}は未起動です</h3><p>「起動」でメモリを確保して、操作できるようになります。</p><button type="button" class="primary" data-action="launch">このアプリを起動</button><p class="app-status" id="launch-status"></p></div>`;
  } else if (snapshot.visible === 'web') {
    $('app-content').innerHTML = `<div class="app-toolbar"><select id="web-topic" aria-label="読み込むページ">${Object.entries(topics).map(([id, content]) => `<option value="${id}" ${webChoice === id ? 'selected' : ''}>${content[0]}</option>`).join('')}</select><button type="button" data-action="web-load">読み込む</button></div><div class="web-article" id="web-article"></div><p class="app-status" id="web-status"></p>`;
  } else if (snapshot.visible === 'music') {
    $('app-content').innerHTML = `<div class="music-top"><div class="album-art" aria-hidden="true">♫</div><div class="song-title"><h3>Little afternoon</h3><p>Study Atlas / 教材用メロディー</p></div></div><div class="music-controls"><div><button type="button" class="primary" data-action="music-play" id="music-play">▶ 音楽を再生</button><button type="button" data-action="sound" id="sound-toggle">音をオン</button></div><span class="elapsed" id="music-elapsed">0 tick</span></div><div class="buffer-heading"><span>音声バッファ <small>（再生待ちの音）</small></span><strong id="buffer-count">0 / 24</strong></div><div id="buffer-track" class="buffer-track" role="progressbar" aria-label="音声バッファ残量" aria-valuemin="0" aria-valuemax="24" aria-valuenow="0"><span id="buffer-fill"></span></div><p class="music-note">CPUが準備した音を、出力装置が少しずつ再生します。</p><p class="app-status" id="music-status"></p>`;
  } else {
    $('app-content').innerHTML = `<div class="app-toolbar"><select id="photo-filter" aria-label="写真の加工効果">${Object.entries(filters).map(([id, filter]) => `<option value="${id}" ${photoChoice === id ? 'selected' : ''}>${filter[0]}</option>`).join('')}</select><button type="button" class="primary" data-action="photo-start" id="photo-start">加工する</button></div><div class="photo-stage"><div class="photo-original">${landscape}</div><div class="photo-overlay" id="photo-overlay">${landscape.replaceAll('id="sky"', 'id="sky-overlay"').replaceAll('url(#sky)', 'url(#sky-overlay)')}</div><span class="photo-progress" id="photo-progress">未加工</span></div><p class="photo-caption" id="photo-caption"></p><p class="app-status" id="photo-status"></p>`;
  }
  updateAppContent();
}
function updateAppContent() {
  const app = snapshot.apps[snapshot.visible];
  const pending = snapshot.pendingInputs.filter((input) => input.id === snapshot.visible);
  if (!app.running) {
    const button = $('app-content').querySelector('button');
    button.disabled = pending.length > 0;
    $('launch-status').textContent = pending.length ? 'OSに起動を依頼しました。再生または1ステップで進みます。' : '';
    return;
  }
  if (snapshot.visible === 'web') {
    const web = app.web;
    const content = topics[web.page] || null;
    const articleKey = web.page || 'empty';
    if ($('web-article').dataset.page !== articleKey) {
      $('web-article').dataset.page = articleKey;
      $('web-article').className = `web-article ${esc(web.page || '')}`;
      $('web-article').innerHTML = content ? `<div class="article-banner">${content[2]}</div><h3>${content[0]}</h3><p>${content[1]}</p>` : '<div class="article-banner">WEB BROWSER</div><h3>気になるページを開いてみよう</h3><p>ページを選んで「読み込む」。CPUの仕事と通信待ちが交互に現れます。</p>';
    }
    const status = { idle: '操作を待っています。画面表示だけならCPUは使い続けません。', request: '読み込みの準備中：CPUの順番が来ると進みます。', network: '通信待ち：WebはCPUを使わず、データの到着を待っています。', render: 'ページを描画中：CPUが割り当てられた時間だけ進みます。', loaded: '読み込み完了。表示を保ったまま、次の入力を待っています。' };
    $('web-status').textContent = pending.length ? '入力をOSに依頼しました。再生または1ステップで進みます。' : status[web.phase] || app.task;
    $('app-content').querySelector('[data-action="web-load"]').disabled = pending.length > 0 || ['request','network','render'].includes(web.phase);
  } else if (snapshot.visible === 'music') {
    const music = app.music;
    $('music-play').textContent = music.playing ? 'Ⅱ 音楽を停止' : '▶ 音楽を再生';
    $('music-play').disabled = pending.length > 0;
    $('sound-toggle').textContent = soundEnabled ? '音をオフ' : '音をオン';
    $('sound-toggle').setAttribute('aria-pressed', String(soundEnabled));
    $('music-elapsed').textContent = `${music.elapsed} tick`;
    $('buffer-count').textContent = `${music.buffer} / ${music.capacity}`;
    $('buffer-track').setAttribute('aria-valuenow', String(music.buffer));
    $('buffer-track').setAttribute('aria-valuemax', String(music.capacity));
    $('buffer-track').classList.toggle('low', music.buffer < 5);
    $('buffer-fill').style.width = `${music.buffer / music.capacity * 100}%`;
    $('music-status').textContent = pending.length ? '入力をOSに依頼しました。再生または1ステップで進みます。' : !music.playing ? '再生すると、CPUが音声データを準備します。' : music.buffer === 0 ? 'バッファが空。CPUによる音声の準備を待っています。' : snapshot.cpu.owner === 'music' ? 'CPUで次の音を準備し、バッファへ補充しています。' : `バッファ内の音を再生中。いまCPUは${names[snapshot.cpu.owner]}です。`;
  } else {
    const photo = app.photo;
    const visibleFilter = photo.processing ? photo.filter : photo.completedFilter;
    const progress = photo.processing ? photo.progress : photo.completedFilter ? 100 : 0;
    $('photo-overlay').style.filter = filters[visibleFilter]?.[1] || 'none';
    $('photo-overlay').style.clipPath = `inset(0 ${100 - progress}% 0 0)`;
    $('photo-progress').textContent = `${Math.round(progress)}%`;
    $('photo-start').disabled = photo.processing || pending.length > 0;
    $('photo-filter').disabled = photo.processing;
    $('photo-caption').textContent = `CPUで処理した量 ${photo.completed || 0} / ${photo.required || 30} tick${photo.processing ? ' · 作業用メモリ +200 MB' : ''}`;
    $('photo-status').textContent = pending.length ? '加工をOSに依頼しました。再生または1ステップで進みます。' : photo.processing ? snapshot.cpu.owner === 'photo' ? 'CPUで加工中。この時間だけ処理が進みます。' : 'CPUの順番待ち。画像と作業用メモリは保持します。' : photo.completedFilter ? `「${filters[photo.completedFilter]?.[0] || photo.completedFilter}」の加工完了。作業用メモリを解放しました。` : '効果を選んで加工。CPUの割り当てと進捗を見比べましょう。';
  }
}
function renderHistory() {
  const entries = snapshot.history.slice(-24);
  const active = document.activeElement;
  const focusedTime = active?.closest('#cpu-history') ? active.dataset.time : null;
  const focusUnselect = Boolean(active?.closest('#history-info'));
  const previousHistoryScroll = $('cpu-history').scrollLeft;
  const followHistory = previousHistoryScroll + $('cpu-history').clientWidth >= $('cpu-history').scrollWidth - 10;
  $('cpu-history').innerHTML = '<span class="history-placeholder" aria-hidden="true"></span>'.repeat(24 - entries.length) + entries.map((entry) => `<button type="button" data-time="${entry.time}" data-owner="${entry.owner}" aria-pressed="${selectedHistory?.time === entry.time}" aria-label="${entry.time} tick：${names[entry.owner]}。${esc(entry.task)}" title="${entry.time} tick：${names[entry.owner]}"></button>`).join('');
  if (focusedTime) $('cpu-history').querySelector(`[data-time="${focusedTime}"]`)?.focus({ preventScroll: true });
  if (followHistory && !focusedTime && !selectedHistory) $('cpu-history').scrollLeft = $('cpu-history').scrollWidth;
  else $('cpu-history').scrollLeft = previousHistoryScroll;
  $('history-range').textContent = entries.length ? `${entries[0].time} → ${entries.at(-1).time} tick` : '過去 → 現在';
  if (selectedHistory) {
    const entry = selectedHistory;
    const memory = entry.memory ? ` メモリ使用量 ${entry.memory.used} MB。` : '';
    $('history-info').innerHTML = `<strong>${entry.time} tick · ${names[entry.owner]}：${esc(entry.task)}</strong><p>${esc(entry.reason)}${esc(memory)}</p><button type="button" class="history-unselect">選択を解除</button>`;
    if (focusUnselect) $('history-info').querySelector('button')?.focus({ preventScroll: true });
  } else {
    $('history-info').innerHTML = '<p>履歴のマスを選ぶと、処理内容と切り替え理由が分かります。</p>';
  }
}
function renderMemory() {
  const memory = snapshot.memory;
  const segments = [...memory.segments];
  if (!segments.some((segment) => segment.id === 'free')) segments.push({ id: 'free', label: '空き', size: memory.free });
  const owner = (segment) => segment.id.includes('work') || segment.id.includes('temp') ? 'workspace' : segment.id;
  $('memory-total').textContent = `${memory.used} / ${memory.total} MB 使用中`;
  $('memory-band').innerHTML = segments.filter((segment) => segment.size > 0).map((segment) => `<div class="memory-segment" data-owner="${owner(segment)}" style="width:${segment.size / memory.total * 100}%" title="${esc(segment.label)} ${segment.size} MB">${segment.size / memory.total > .12 ? esc(segment.label) : ''}</div>`).join('');
  $('memory-labels').innerHTML = segments.filter((segment) => segment.size > 0).map((segment) => `<span data-owner="${owner(segment)}">${esc(segment.label)} ${segment.size} MB</span>`).join('');
  $('memory-band').setAttribute('aria-label', segments.map((segment) => `${segment.label} ${segment.size} MB`).join('、'));
}
function renderDetails() {
  $('process-table').innerHTML = Object.entries(snapshot.apps).map(([id, app]) => `<tr><td>${names[id]}</td><td>${app.running ? '起動中' : '未起動'}</td><td>${snapshot.visible === id ? '表示中' : '—'}</td><td>${states[app.state]}</td><td>${app.memory} MB</td></tr>`).join('');
  $('pending-inputs').textContent = snapshot.pendingInputs.length ? `OSへの入力待ち：${snapshot.pendingInputs.map((input) => input.label).join('、')}` : 'OSへの入力待ち：なし';
  $('event-log').innerHTML = snapshot.events.slice(-80).reverse().map((event) => `<li><time>${event.time} tick</time>${esc(event.message)}</li>`).join('') || '<li>操作すると、OSの処理や切り替えが記録されます。</li>';
}
function render() {
  $('time').textContent = snapshot.time;
  renderLauncher();
  renderAppFrame();
  const cpu = snapshot.cpu;
  $('cpu-current').dataset.owner = cpu.owner;
  $('cpu-owner').textContent = names[cpu.owner];
  $('cpu-task').textContent = cpu.task;
  $('quantum-track').querySelectorAll('i').forEach((bar, index) => bar.classList.toggle('used', !['os','idle'].includes(cpu.owner) && index < snapshot.quantum.used));
  $('quantum-caption').textContent = cpu.owner === 'os' ? 'OSも同じCPUで処理します' : cpu.owner === 'idle' ? '実行できる仕事がなく、CPUは空いています' : `今回の割り当て ${snapshot.quantum.used} / ${snapshot.quantum.size} tick`;
  const ready = Object.entries(snapshot.apps).filter(([,app]) => app.state === 'ready');
  $('ready-queue').innerHTML = ready.length ? ready.map(([id]) => `<span class="queue-chip" data-owner="${id}">${names[id]}</span>`).join('') : 'なし';
  renderHistory();
  renderMemory();
  $('explanation').textContent = snapshot.explain;
  $('first-hint').textContent = snapshot.pendingInputs.length && !playing ? '操作をOSに依頼しました。「再生」または「1ステップ」で仮想時間を進めてください。' : '起動中＝メモリにある。表示中＝画面で見ている。CPUで実行中＝いま処理している。';
  if ($('state-details').open) renderDetails();
  syncAudio();
}
async function prepareAudio() {
  if (!audioContext) {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) throw new Error('Audio unavailable');
    audioContext = new Audio();
    voice = audioContext.createOscillator();
    audioGain = audioContext.createGain();
    voice.type = 'sine';
    audioGain.gain.value = 0;
    voice.connect(audioGain).connect(audioContext.destination);
    voice.start();
  }
  await audioContext.resume();
  syncAudio();
}
function syncAudio() {
  if (!audioContext) return;
  const music = snapshot.apps.music;
  const audible = soundEnabled && playing && music.running && music.music.playing && music.music.buffer > 0;
  const notes = [261.63,329.63,392,329.63,293.66,349.23,440,349.23,261.63,329.63,392,523.25,440,392,329.63,293.66];
  const note = notes[Math.floor(music.music.elapsed / 2) % notes.length];
  voice.frequency.setTargetAtTime(note, audioContext.currentTime, .03);
  audioGain.gain.setTargetAtTime(audible ? .035 : 0, audioContext.currentTime, .03);
}
function animate(timestamp) {
  if (playing) {
    if (lastFrame) accumulator += Math.min(timestamp - lastFrame, 200);
    const duration = 450 / speed;
    while (accumulator >= duration) {
      snapshot = simulation.step();
      accumulator -= duration;
      render();
    }
  }
  lastFrame = timestamp;
  requestAnimationFrame(animate);
}
render();
setPlaying(false);
requestAnimationFrame(animate);

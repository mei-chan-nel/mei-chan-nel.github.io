/**
 * Deterministic teaching model of a single-core, round-robin OS.
 * One step is one deliberately slow virtual time unit, including OS overhead.
 * All devices, buffers, work and allocation share that clock. Actual operating
 * systems have much shorter quanta, many threads, hardware interrupts/DMA,
 * virtual memory and more elaborate scheduling. This model has one process per
 * app, fixed memory allocations and periodic resident tasks. Residents start
 * with the OS and keep their memory. Allocation requests wait until enough
 * memory is available; the OS allocates the oldest request that currently fits.
 * Device completions and resident wakeups use the same clock; no real
 * network/audio runs here.
 */
export const APP_CONFIG = Object.freeze({
  web: Object.freeze({ label: 'Webブラウザ', memory: 200, color: '#2f6597' }),
  music: Object.freeze({ label: '音楽再生', memory: 120, color: '#267765' }),
  photo: Object.freeze({ label: '写真加工', memory: 240, color: '#b94732' }),
  notify: Object.freeze({ label: '通知アプリ', memory: 64, color: '#805000', background: true }),
  sync: Object.freeze({ label: 'クラウド同期', memory: 96, color: '#287c86', background: true }),
  security: Object.freeze({ label: 'セキュリティ対策', memory: 128, color: '#93415f', background: true }),
});

export const FOREGROUND_IDS = Object.freeze(['web', 'music', 'photo']);
export const BACKGROUND_IDS = Object.freeze(['notify', 'sync', 'security']);
const IDS = Object.keys(APP_CONFIG);
const BACKGROUND_CONFIG = Object.freeze({
  notify: Object.freeze({ period: 12, work: 2 }),
  sync: Object.freeze({ period: 18, work: 3 }),
  security: Object.freeze({ period: 26, work: 9 }),
});
const QUANTUM = 3;
const OS_MEMORY = 160;
const TOTAL_MEMORY = 1024;
const PHOTO_MEMORY = 200;
const PHOTO_WORK = 30;
const MUSIC_CAPACITY = 24;
const MUSIC_THRESHOLD = 14;
const clone = (value) => JSON.parse(JSON.stringify(value));

const freshApp = (id) => ({
  running: false,
  work: 0,
  web: id === 'web' ? { phase: 'idle', topic: 'nature', page: null, networkRemaining: 0 } : undefined,
  music: id === 'music' ? {
    track: 'roomscene-lofi',
    playing: false, buffer: 0, capacity: MUSIC_CAPACITY, elapsed: 0,
    underruns: 0, buffering: false, hasPlayed: false, wasEmpty: false,
  } : undefined,
  photo: id === 'photo' ? {
    processing: false, progress: 0, filter: 'warm', completedFilter: null,
    completed: 0, required: PHOTO_WORK,
  } : undefined,
  background: APP_CONFIG[id].background ? {
    phase: 'stopped', nextEventAt: null, networkRemaining: 0,
    cycles: 0, wakeups: 0, cpuTicks: 0, pendingEvent: false,
  } : undefined,
});

export class OSSimulation {
  constructor() { this.reset(); }

  reset() {
    this.time = 0;
    this.visible = 'web';
    this._apps = Object.fromEntries(IDS.map((id) => [id, freshApp(id)]));
    for (const id of BACKGROUND_IDS) {
      this._apps[id].running = true;
      this._apps[id].background.phase = 'waiting';
      this._apps[id].background.nextEventAt = BACKGROUND_CONFIG[id].period;
    }
    this._inputs = [];
    this._interrupts = [];
    this._ready = [];
    this._current = null;
    this._slice = 0;
    this._displaySlice = 0;
    this._timerPending = false;
    this._timerOwner = null;
    this._transition = '';
    this._cpu = { owner: 'idle', task: 'CPUアイドル', reason: '操作を待っています。' };
    this._history = [];
    this._events = [];
    this._lastFailure = null;
    this._failures = {};
    this._memoryWaits = [];
    return this.snapshot();
  }

  launch(id) {
    this._checkId(id);
    return APP_CONFIG[id].background ? this.snapshot() : this._queue('launch', id);
  }
  close(id) {
    this._checkId(id);
    return APP_CONFIG[id].background ? this.snapshot() : this._queue('close', id);
  }

  // Selecting the visible window neither launches it nor gives it CPU time.
  view(id) {
    this._checkId(id);
    if (APP_CONFIG[id].background) throw new RangeError('常駐アプリには表示するウィンドウがありません。');
    this.visible = id;
    return this.snapshot();
  }

  webLoad(topic = 'nature') { return this._queue('webLoad', 'web', { topic: String(topic) }); }
  toggleMusic() { return this._queue('toggleMusic', 'music'); }
  selectTrack(trackId = 'roomscene-lofi') {
    const track = String(trackId);
    const pendingTrackChange = this._inputs.some((input) => input.id === 'music'
      && ['selectTrack', 'launch', 'close'].includes(input.type));
    if (this._apps.music.music.track === track && !pendingTrackChange) return this.snapshot();
    return this._queue('selectTrack', 'music', { track });
  }
  startPhoto(filter = 'warm') {
    const lifecycleIndex = this._inputs.findLastIndex((input) => input.id === 'photo'
      && ['launch', 'close'].includes(input.type));
    const willCancel = this._inputs.some((input) => input.id === 'photo' && input.type === 'close');
    const alreadyWaiting = this._memoryWaits.some((wait) => wait.id === 'photo' && wait.operation === 'workspace');
    if ((alreadyWaiting && !willCancel)
      || this._inputs.slice(lifecycleIndex + 1).some((input) => input.type === 'startPhoto')) return this.snapshot();
    return this._queue('startPhoto', 'photo', { filter: String(filter) });
  }

  _checkId(id) {
    if (!Object.hasOwn(APP_CONFIG, id)) throw new RangeError(`Unknown app: ${id}`);
  }

  _queue(type, id, data = {}) {
    this._checkId(id);
    if (type === 'launch' && this._memoryWaits.some((wait) => wait.id === id && wait.operation === 'launch')
      && !this._inputs.some((input) => input.id === id && input.type === 'close')) return this.snapshot();
    // A double click on launch/close does not create duplicate lifecycle events.
    const lastLifecycle = this._inputs.findLast((entry) => entry.id === id && ['launch', 'close'].includes(entry.type));
    if (!['launch', 'close'].includes(type) || lastLifecycle?.type !== type) {
      this._inputs.push({ type, id, ...data });
    }
    return this.snapshot();
  }

  _runnable(id) {
    return this._apps[id].running && this._apps[id].work > 0
      && !this._memoryWaits.some((wait) => wait.id === id);
  }

  _enqueue(id, first = false) {
    if (!this._runnable(id) || this._current === id || this._ready.includes(id)) return;
    if (first) this._ready.unshift(id);
    else this._ready.push(id);
  }

  _next() {
    while (this._ready.length) {
      const id = this._ready.shift();
      if (this._runnable(id)) return id;
    }
    return null;
  }

  _interruptCurrent() {
    if (this._current) {
      const interrupted = this._current;
      this._current = null;
      this._enqueue(interrupted, true);
    }
    this._slice = 0;
  }

  _event(message) {
    this._events.push({ time: this.time, message });
    if (this._events.length > 160) this._events.shift();
  }

  _inputLabel(input) {
    const app = APP_CONFIG[input.id].label;
    return {
      launch: `${app}を起動`, close: `${app}を終了`,
      webLoad: 'ページを読み込む', toggleMusic: '音楽の再生・一時停止',
      selectTrack: '音楽の曲を切り替える',
      startPhoto: '写真の加工を開始',
    }[input.type];
  }

  _allocationFailure(id, operation, required, available, data = {}) {
    const purpose = operation === 'launch' ? `${APP_CONFIG[id].label}の起動` : '写真加工の作業';
    const message = `${purpose}には${required} MBの空きメモリが必要ですが、空きは${available} MBです。操作を保留し、メモリの空きが増えたらOSが自動で再開します。`;
    this._memoryWaits.push({ id, operation, required, requestedAt: this.time, ...data });
    const failure = { id, operation, required, available, time: this.time, message };
    this._lastFailure = failure;
    this._failures[id] = failure;
    this._event(message);
    return message;
  }

  _clearFailure(id, operation = null) {
    if (this._failures[id] && (!operation || this._failures[id].operation === operation)) {
      delete this._failures[id];
    }
    if (this._lastFailure?.id === id && (!operation || this._lastFailure.operation === operation)) {
      this._lastFailure = Object.values(this._failures).sort((a, b) => a.time - b.time).at(-1) || null;
    }
  }

  _allocateLaunch(id) {
    const label = APP_CONFIG[id].label;
    this._apps[id] = freshApp(id);
    this._apps[id].running = true;
    this._memoryWaits = this._memoryWaits.filter((wait) => !(wait.id === id && wait.operation === 'launch'));
    this._clearFailure(id, 'launch');
    this._event(`${label}を起動し、${APP_CONFIG[id].memory} MBのメモリを確保。`);
    return `${label}を起動。${APP_CONFIG[id].memory} MBのメモリを確保しました。`;
  }

  _allocateWorkspace(filter) {
    const app = this._apps.photo;
    this._memoryWaits = this._memoryWaits.filter((wait) => !(wait.id === 'photo' && wait.operation === 'workspace'));
    this._clearFailure('photo', 'workspace');
    app.photo.processing = true;
    app.photo.progress = 0;
    app.photo.completed = 0;
    app.photo.filter = filter;
    app.work = PHOTO_WORK;
    this._enqueue('photo');
    this._event(`写真加工を開始。作業用メモリ${PHOTO_MEMORY} MBを追加確保。`);
    return '作業用メモリを確保し、写真加工が実行待ちになりました。';
  }

  _memoryWaitSnapshot() {
    const available = this._memory().free;
    return this._memoryWaits.map((wait) => ({ ...wait, available }));
  }

  _applyInput(input) {
    const { id, type } = input;
    const app = this._apps[id];
    const label = APP_CONFIG[id].label;
    if (type === 'launch') {
      if (app.running) return `${label}はすでに起動しています。`;
      const available = this._memory().free;
      if (this._memoryWaits.some((wait) => wait.id === id && wait.operation === 'launch')) return `${label}の起動はメモリの空き待ちです。`;
      if (APP_CONFIG[id].memory > available) return this._allocationFailure(id, 'launch', APP_CONFIG[id].memory, available);
      return `入力イベントを処理し、${this._allocateLaunch(id)}`;
    }
    if (type === 'close') {
      const canceledWait = this._memoryWaits.find((wait) => wait.id === id);
      this._apps[id] = freshApp(id);
      this._memoryWaits = this._memoryWaits.filter((wait) => wait.id !== id);
      this._ready = this._ready.filter((entry) => entry !== id);
      this._interrupts = this._interrupts.filter((entry) => entry.id !== id);
      if (this._timerOwner === id) {
        this._timerPending = false;
        this._timerOwner = null;
      }
      this._clearFailure(id);
      // Discard obsolete commands, but preserve commands for an explicitly
      // queued subsequent launch of the same app.
      let nextLaunch = false;
      this._inputs = this._inputs.filter((entry) => {
        if (entry.id !== id) return true;
        if (entry.type === 'launch') nextLaunch = true;
        return nextLaunch || entry.type === 'close';
      });
      if (!app.running && canceledWait) {
        this._event(`${label}の起動の保留を取り消しました。メモリは確保していません。`);
        return `取消の入力を処理し、${label}の起動待ちを取り消しました。空きが増えても自動起動しません。`;
      }
      this._event(`${label}を終了し、使用していたメモリと未完了の処理を解放。`);
      return `終了イベントを処理し、${label}のメモリを解放しました。`;
    }
    if (!app.running) return `${label}が終了しているため、入力は処理されません。`;
    if (type === 'webLoad') {
      app.web.phase = 'request';
      app.web.topic = input.topic;
      app.web.networkRemaining = 0;
      app.work = 3;
      this._enqueue(id);
      this._event('ページ読み込みを要求。Webブラウザが実行待ちに。');
      return 'クリックをOSが受け取り、Webブラウザを実行待ちにしました。';
    }
    if (type === 'selectTrack') {
      if (app.music.track === input.track) return '同じ曲が選択されているため、再生状態を保ちました。';
      const playing = app.music.playing;
      app.music = { ...freshApp('music').music, track: input.track, playing, buffering: playing };
      app.work = playing ? 3 : 0;
      this._ready = this._ready.filter((entry) => entry !== id);
      this._enqueue(id);
      this._event(`選択した曲に切り替え、音声バッファを空にしました。${playing ? '新しい曲の音声データをCPUで準備します。' : '再生操作を待ちます。'}`);
      return playing
        ? '曲の切り替え入力をOSが処理。前の音声バッファを空にし、新しい曲の準備を実行待ちにしました。'
        : '曲の切り替え入力をOSが処理。再生位置と音声バッファを初期化し、再生操作を待ちます。';
    }
    if (type === 'toggleMusic') {
      app.music.playing = !app.music.playing;
      app.music.wasEmpty = false;
      if (app.music.playing) {
        app.music.buffering = app.music.buffer === 0;
        if (app.music.buffer <= MUSIC_THRESHOLD) app.work = 3;
        this._enqueue(id);
        this._event('音楽の再生を開始。必要な音声データをCPUで準備します。');
        return '再生ボタンの入力を処理。音声データを準備する処理を登録しました。';
      }
      app.work = 0;
      app.music.buffering = false;
      this._ready = this._ready.filter((entry) => entry !== id);
      this._event('音楽を一時停止。音声バッファとアプリのメモリは保持。');
      return '音楽を一時停止しました。起動中のアプリとバッファはメモリに残ります。';
    }
    if (type === 'startPhoto') {
      if (app.photo.processing) return '写真は加工中です。CPUが割り当てられるのを待ちます。';
      const available = this._memory().free;
      if (PHOTO_MEMORY > available) return this._allocationFailure(id, 'workspace', PHOTO_MEMORY, available, { filter: input.filter });
      return `加工の入力を処理し、${this._allocateWorkspace(input.filter)}`;
    }
    return '入力イベントを処理しました。';
  }

  _advanceDevices() {
    this._advanceBackgroundDevices();
    const web = this._apps.web;
    if (web.running && web.web.phase === 'network') {
      web.web.networkRemaining -= 1;
      if (web.web.networkRemaining <= 0) {
        web.web.networkRemaining = 0;
        web.web.phase = 'render';
        web.work = 3;
        this._enqueue('web');
        this._event('通信が完了。Webブラウザが画面を描くために実行待ちへ。');
      }
    }
    const app = this._apps.music;
    if (!app.running || !app.music.playing) return;
    const music = app.music;
    // Audio hardware consumes prepared data independently of CPU ownership.
    if (music.buffer > 0) {
      music.buffer -= 1;
      music.elapsed += 1;
      music.hasPlayed = true;
      music.buffering = false;
      music.wasEmpty = false;
    } else {
      music.buffering = true;
      if (music.hasPlayed && !music.wasEmpty) {
        music.underruns += 1;
        this._event('音声バッファが空になり、次の音声データを待っています。');
      }
      music.wasEmpty = true;
    }
    if (music.buffer <= MUSIC_THRESHOLD && app.work === 0) {
      app.work = 3;
      this._enqueue('music');
      this._event('音声バッファが減ったため、音声データの補充が実行待ちに。');
    }
  }

  _advanceBackgroundDevices() {
    for (const id of BACKGROUND_IDS) {
      const app = this._apps[id];
      if (!app.running) continue;
      const background = app.background;
      if (background.phase === 'waiting' && background.nextEventAt !== null && this.time >= background.nextEventAt) {
        background.nextEventAt = null;
        background.pendingEvent = true;
        this._interrupts.push({ id, type: 'wake', time: this.time });
      } else if (background.phase === 'network' && background.networkRemaining > 0) {
        background.networkRemaining -= 1;
        if (background.networkRemaining === 0) {
          background.pendingEvent = true;
          this._interrupts.push({ id, type: 'network', time: this.time });
        }
      }
    }
  }

  _applyBackgroundInterrupt(interrupt) {
    const { id, type } = interrupt;
    const app = this._apps[id];
    const label = APP_CONFIG[id].label;
    app.background.pendingEvent = false;
    if (type === 'wake') {
      app.background.phase = 'work';
      app.background.wakeups += 1;
      app.work = BACKGROUND_CONFIG[id].work;
      this._event(`${label}の定期イベントが発生。OSが割り込みを処理し、実行待ちへ。`);
    } else {
      app.background.phase = 'finish';
      app.work = 2;
      this._event(`${label}の通信が完了。OSが割り込みを処理し、仕上げの処理が実行待ちへ。`);
    }
    this._enqueue(id);
    return `${label}の${type === 'wake' ? '定期イベント' : '通信完了'}をOSが受け取り、必要な処理を実行待ちにしました。常駐アプリも、処理が必要なときだけCPUを使います。`;
  }

  _finishBackgroundCycle(id) {
    const background = this._apps[id].background;
    background.phase = 'waiting';
    background.cycles += 1;
    background.nextEventAt = this.time + BACKGROUND_CONFIG[id].period;
    this._event(`${APP_CONFIG[id].label}の処理が完了。メモリを保持したまま、次の定期イベント待ちへ。`);
  }

  _appTask(id) {
    const app = this._apps[id];
    if (!app.running) return '終了';
    if (id === 'web') return {
      idle: '操作イベント待ち', request: 'ページ要求を準備', network: '通信の完了待ち',
      render: 'ページを画面に描画', loaded: '操作イベント待ち',
    }[app.web.phase];
    if (id === 'music') {
      if (app.work > 0) return '音声データを準備・補充';
      return app.music.playing ? '音声バッファから再生・補充時刻待ち' : '再生操作待ち';
    }
    if (app.background) {
      if (app.background.pendingEvent) return 'OSのイベント割り込み待ち';
      if (app.background.phase === 'network') return '同期通信の完了待ち';
      if (app.background.phase === 'waiting') return '次の定期イベント待ち';
      if (id === 'notify') return '新しい通知を確認';
      if (id === 'sync') return app.background.phase === 'finish' ? '同期結果を保存' : '同期データを準備';
      return 'ファイルの安全性を確認';
    }
    return app.photo.processing ? '写真の画素を加工' : '加工操作待ち';
  }

  _run(id) {
    const app = this._apps[id];
    app.work -= 1;
    if (id === 'music') {
      app.music.buffer = Math.min(MUSIC_CAPACITY, app.music.buffer + 8);
      app.music.buffering = false;
      if (app.music.buffer === MUSIC_CAPACITY) app.work = 0;
    } else if (id === 'photo') {
      app.photo.completed += 1;
      app.photo.progress = app.photo.completed / PHOTO_WORK * 100;
      if (app.work === 0) {
        app.photo.processing = false;
        app.photo.progress = 100;
        app.photo.completedFilter = app.photo.filter;
        this._event('写真加工が完了。作業用メモリを解放し、操作イベント待ちへ。');
      }
    } else if (app.background) {
      app.background.cpuTicks += 1;
      if (app.work === 0) {
        if (id === 'sync' && app.background.phase === 'work') {
          app.background.phase = 'network';
          app.background.networkRemaining = 6;
          this._event('クラウド同期のデータ準備が完了。通信を待つ間はCPUを使いません。');
        } else this._finishBackgroundCycle(id);
      }
    } else if (app.work === 0 && app.web.phase === 'request') {
      app.web.phase = 'network';
      app.web.networkRemaining = 6;
      this._event('ページ要求の準備が完了。通信待ちに入り、CPUをほかの処理へ渡します。');
    } else if (app.work === 0 && app.web.phase === 'render') {
      app.web.phase = 'loaded';
      app.web.page = app.web.topic;
      this._event('ページの描画が完了。画面を表示したまま操作イベント待ちへ。');
    }
  }

  /** Advance exactly one common virtual tick; there are no wall-clock timers. */
  step() {
    this.time += 1;
    this._advanceDevices();

    if (this._inputs.length) {
      this._interruptCurrent();
      const input = this._inputs.shift();
      const reason = this._applyInput(input);
      this._transition = '入力イベントを処理した後、実行待ちのプロセスを選びます。';
      return this._record('os', `入力イベント：${this._inputLabel(input)}`, reason);
    }

    // Input events, including cancellation, take precedence. Among retained
    // requests, service the oldest one that currently fits; a larger request
    // must not prevent a smaller eligible request from being allocated.
    const available = this._memory().free;
    const memoryWait = this._memoryWaits.find((wait) => wait.required <= available);
    if (memoryWait) {
      this._interruptCurrent();
      const result = memoryWait.operation === 'launch'
        ? this._allocateLaunch(memoryWait.id)
        : this._allocateWorkspace(memoryWait.filter);
      const reason = `空きメモリが${available} MBになったため、${memoryWait.requestedAt} tickから保留していた操作をOSが自動で再開。${result}`;
      this._event(reason);
      this._transition = 'メモリを確保した後、実行待ちのプロセスを選びます。';
      return this._record('os', `メモリ確保・自動再開：${APP_CONFIG[memoryWait.id].label}`, reason);
    }

    if (this._interrupts.length) {
      this._interruptCurrent();
      const interrupt = this._interrupts.shift();
      const reason = this._applyBackgroundInterrupt(interrupt);
      this._transition = 'イベント割り込みを処理した後、実行待ちの順番にCPUを割り当てます。';
      return this._record('os', `イベント割り込み：${APP_CONFIG[interrupt.id].label}の${interrupt.type === 'wake' ? '定期イベント' : '通信完了'}`, reason);
    }

    if (this._timerPending) {
      this._timerPending = false;
      this._timerOwner = null;
      this._current = this._next();
      this._slice = 0;
      this._transition = '';
      const target = this._current ? APP_CONFIG[this._current].label : 'CPUアイドル';
      this._event(`タイマー割り込み。時間枠${QUANTUM}単位を使ったため、次は${target}へ。`);
      return this._record('os', 'タイマー割り込み・プロセス切り替え',
        `時間枠${QUANTUM}単位を使い切ったためOSに戻り、実行待ちの順番から${target}を選びました。`);
    }

    if (!this._current && (this._ready.length || this._transition)) {
      this._current = this._next();
      this._slice = 0;
      const reason = this._transition || '実行待ちのプロセスにCPUを割り当てます。';
      this._transition = '';
      return this._record('os', this._current
        ? `プロセス切り替え → ${APP_CONFIG[this._current].label}`
        : 'プロセスの待ち状態を管理', reason);
    }

    if (!this._current) {
      return this._record('idle', 'CPUアイドル',
        '実行待ちの処理がありません。アプリが起動中でも、イベント待ちの間はCPUを使いません。');
    }

    const id = this._current;
    const task = this._appTask(id);
    this._run(id);
    this._slice += 1;
    const executedSlice = this._slice;
    const reason = `OSからCPUを割り当てられ、${APP_CONFIG[id].label}の「${task}」を1単位進めました。`;
    if (!this._runnable(id)) {
      this._current = null;
      this._slice = 0;
      this._transition = `${APP_CONFIG[id].label}は${this._appTask(id)}になったため、CPUをほかの処理へ渡します。`;
    } else if (this._slice >= QUANTUM) {
      this._current = null;
      this._enqueue(id);
      this._timerPending = true;
      this._timerOwner = id;
    }
    return this._record(id, task, reason, executedSlice);
  }

  _memory() {
    const segments = [{ id: 'os', label: 'OS', size: OS_MEMORY }];
    for (const id of IDS) {
      if (!this._apps[id].running) continue;
      segments.push({ id, label: APP_CONFIG[id].label, size: APP_CONFIG[id].memory });
      if (id === 'photo' && this._apps.photo.photo.processing) {
        segments.push({ id: 'photo-work', label: '写真の作業用', size: PHOTO_MEMORY });
      }
    }
    const used = segments.reduce((sum, segment) => sum + segment.size, 0);
    const free = TOTAL_MEMORY - used;
    segments.push({ id: 'free', label: '空き', size: free });
    return { total: TOTAL_MEMORY, os: OS_MEMORY, used, free, segments };
  }

  _describeApps() {
    const memoryWaits = this._memoryWaitSnapshot();
    return Object.fromEntries(IDS.map((id) => {
      const app = this._apps[id];
      const memoryWait = memoryWaits.find((wait) => wait.id === id) || null;
      const state = memoryWait ? 'memory-wait' : !app.running ? 'stopped' : this._cpu.owner === id ? 'running'
        : this._runnable(id) ? 'ready' : 'waiting';
      return [id, {
        running: app.running, state, memoryWait,
        memory: app.running ? APP_CONFIG[id].memory + (id === 'photo' && app.photo.processing ? PHOTO_MEMORY : 0) : 0,
        task: memoryWait ? `メモリの空き待ち（${memoryWait.operation === 'launch' ? '起動' : '写真加工'}）`
          : state === 'running' ? this._cpu.task : this._appTask(id),
        ...(app.web ? { web: app.web } : {}),
        ...(app.music ? { music: app.music } : {}),
        ...(app.photo ? { photo: app.photo } : {}),
        ...(app.background ? { background: app.background } : {}),
      }];
    }));
  }

  _explain() {
    const owner = this._cpu.owner;
    if (owner === 'idle') {
      if (this._memoryWaits.length) {
        return '保留中の操作はメモリの空きを待っています。CPUに空きがあっても、必要なメモリを確保するまでは始まりません。';
      }
      const music = this._apps.music;
      if (music.running && music.music.playing && music.music.buffer > 0) {
        return 'CPUがアイドルでも、準備済みの音声バッファから音楽は流れ続けます。アプリのメモリも保持されています。';
      }
      if (BACKGROUND_IDS.some((id) => this._apps[id].running)) {
        return '常駐アプリも、次のイベントを待つ間はCPUを使いません。CPUが空いていても、起動中のアプリのメモリは保持されます。';
      }
      return IDS.some((id) => this._apps[id].running)
        ? 'アプリはイベント待ちです。CPUが空いていても、起動中のアプリのメモリと画面は残ります。'
        : 'アプリを起動すると、OSがメモリを確保します。起動・表示・CPUでの実行はそれぞれ別です。';
    }
    if (owner === 'os') return this._cpu.reason;
    if (APP_CONFIG[owner].background) {
      return `画面には${APP_CONFIG[this.visible].label}を表示したまま、CPUは常駐アプリの${APP_CONFIG[owner].label}を処理しています。常駐アプリも必要なときだけCPUの順番待ちに並びます。`;
    }
    if (owner !== this.visible) return `表示中は${APP_CONFIG[this.visible].label}ですが、CPUは${APP_CONFIG[owner].label}を処理しています。表示と実行は別です。`;
    if (this._apps.music.running && this._apps.music.music.playing && this._apps.music.music.buffer > 0 && owner !== 'music') {
      return 'CPUがほかの処理をしている間も、準備済みの音声バッファから音楽を再生できます。';
    }
    if (owner === 'photo') return '写真加工は、CPUが割り当てられた時間だけ進みます。加工中は作業用のメモリも使います。';
    if (owner === 'music') return 'CPUで音声データをまとめて準備し、バッファに蓄えています。再生のすべてにCPUが必要なわけではありません。';
    return 'ページの要求や描画にはCPUを使います。読み込みが終わると、画面を表示したままイベント待ちになります。';
  }

  _record(owner, task, reason, executedSlice = 0) {
    this._cpu = { owner, task, reason };
    // The snapshot describes the interval just executed, even when completing
    // that interval has already reset the scheduler's next-process counter.
    this._displaySlice = executedSlice;
    this._history.push(clone({
      time: this.time, owner, task, reason, apps: this._describeApps(),
      memory: this._memory(), visible: this.visible,
    }));
    if (this._history.length > 240) this._history.shift();
    return this.snapshot();
  }

  snapshot() {
    return clone({
      time: this.time, visible: this.visible, cpu: this._cpu,
      apps: this._describeApps(), memory: this._memory(),
      history: this._history, events: this._events, explain: this._explain(),
      lastFailure: this._lastFailure, failures: this._failures,
      memoryWaits: this._memoryWaitSnapshot(),
      pendingInterrupts: this._interrupts.map((entry) => ({ ...entry, label: APP_CONFIG[entry.id].label })),
      pendingInputs: this._inputs.map((input) => ({
        type: input.type, id: input.id, label: this._inputLabel(input),
      })),
      quantum: { size: QUANTUM, used: this._displaySlice },
    });
  }
}

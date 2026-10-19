/**
 * Keeps one real recording in step with the simulation's prepared audio.
 * The media element belongs to the page, never to an app window or CPU slice.
 */
export class RecordedAudioController {
  constructor({ media, tickSeconds = 0.45, onStatus, now = () => performance.now() } = {}) {
    if (!media || typeof media.play !== 'function' || typeof media.pause !== 'function') {
      throw new TypeError('A persistent HTML media element is required.');
    }
    this.media = media;
    this.tickSeconds = Number.isFinite(tickSeconds) && tickSeconds > 0 ? tickSeconds : 0.45;
    this.volume = 0.45;
    this.muted = false;
    this.status = media.readyState >= 2 ? 'ready' : 'loading';
    this._onStatus = onStatus;
    this._desired = false;
    this._audible = false;
    this._elapsed = 0;
    this._epoch = 0;
    this._sourceEpoch = 0;
    this._source = this._sourceKey(media.getAttribute?.('src') || media.src || '');
    this._sourceChanging = false;
    this._pending = null;
    this._gestureSeen = false;
    this._blocked = false;
    this._failed = false;
    this._now = now;
    this._retryAfter = 0;
    this._abortCount = 0;
    this._queuedSeek = null;
    this._lastSeekAt = -Infinity;
    media.loop = true;
    media.preload = 'auto';
    this._applySoundSettings();

    const ready = () => {
      this._flushSeek();
      if (!this._blocked && !this._failed && this.status !== 'retrying') this._setStatus('ready');
    };
    media.addEventListener?.('loadedmetadata', () => this._flushSeek());
    media.addEventListener?.('seeked', () => this._flushSeek());
    media.addEventListener?.('canplay', ready);
    media.addEventListener?.('canplaythrough', ready);
    media.addEventListener?.('waiting', () => {
      if (this._desired && !this._blocked && !this._failed) this._setStatus('loading');
    });
    media.addEventListener?.('playing', () => {
      // A pending play can finish after a close, reset or pause. Mute before
      // stopping it, including when the browser dispatches this event first.
      if (!this._desired || this._failed || this._blocked) {
        this._pause();
      } else if (!this._failed) this._setStatus('ready');
    });
    media.addEventListener?.('error', () => {
      this._failed = true;
      this._setStatus('error');
      this._pause();
    });
  }

  _setStatus(status) {
    if (this.status === status) return;
    this.status = status;
    this._onStatus?.(status);
  }

  _applySoundSettings() {
    if (this.media.volume !== this.volume) this.media.volume = this.volume;
    // Keep an already started transport alive during simulated underruns.
    // Silence is immediate; each simulated underrun no longer needs a new
    // play() request outside the original user gesture.
    const muted = this.muted || !this._audible || this._failed || this._blocked;
    if (this.media.muted !== muted) this.media.muted = muted;
  }

  setVolume(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return this.volume;
    this.volume = Math.min(1, Math.max(0, number));
    this._applySoundSettings();
    return this.volume;
  }

  setMuted(value) {
    this.muted = Boolean(value);
    this._applySoundSettings();
    return this.muted;
  }

  toggleMute() { return this.setMuted(!this.muted); }

  _sourceKey(source) {
    try {
      return new URL(source, this.media.ownerDocument?.baseURI || globalThis.location?.href).href;
    } catch { return String(source); }
  }

  /** Change recordings without replacing the media element or user choices. */
  setSource(source) {
    const next = String(source ?? '').trim();
    const key = this._sourceKey(next);
    if (!next || key === this._source) return false;
    this._source = key;
    this._sourceEpoch += 1;
    this._epoch += 1;
    this._desired = false;
    this._audible = false;
    this._elapsed = 0;
    // load() aborts old-source requests. Detach them immediately so unlock()
    // can prime the new recording inside the same track-selection gesture.
    this._pending = null;
    this._blocked = false;
    this._failed = false;
    this._retryAfter = 0;
    this._abortCount = 0;
    this._queuedSeek = null;
    this._lastSeekAt = -Infinity;
    this._sourceChanging = true;
    this._pause();
    this._setStatus('loading');
    try {
      this.media.src = next;
      this.media.load?.();
      this._align(true);
    } catch {
      this._failed = true;
      this._setStatus('error');
    } finally {
      this._sourceChanging = false;
      this._applySoundSettings();
    }
    return true;
  }

  /** Call directly inside a click handler, before awaiting any other work. */
  unlock() {
    this._gestureSeen = true;
    this._blocked = false;
    this._retryAfter = 0;
    this._abortCount = 0;
    if (this._failed) return Promise.resolve(false);
    if (this._pending) return this._pending.promise;
    if (!this.media.paused && this._desired) return Promise.resolve(true);
    return this._beginPlay(!this._desired);
  }

  sync(snapshot, simulationPlaying) {
    const app = snapshot?.apps?.music;
    const music = app?.music;
    const wasDesired = this._desired;
    const wasAudible = this._audible;
    this._elapsed = Math.max(0, Number(music?.elapsed) || 0);
    this._desired = Boolean(!this._sourceChanging && simulationPlaying && app?.running && music?.playing);
    this._audible = this._desired && music.buffer > 0;
    if (this._desired && !this._audible) this._queuedSeek = null;
    // Silence before any seek on depletion/pause. On recovery, seek to the
    // frozen virtual position before unmuting the continuous recording.
    if (!this._audible) this._applySoundSettings();
    if (this._audible || !this._desired) {
      this._align((wasDesired && !this._desired) || (!wasAudible && this._audible));
    }
    this._applySoundSettings();
    if (!this._desired) {
      // A muted gesture prime may complete normally so the browser can grant
      // this element playback permission. Actual playback is stopped at once.
      const priming = this._pending?.prime && !wasDesired && this._pending.epoch === this._epoch;
      if (!priming) this._pause();
    } else this._reconcile();
  }

  _reconcile() {
    if (!this._desired || this._failed || this._blocked || !this._gestureSeen
      || this._now() < this._retryAfter) return;
    this._applySoundSettings();
    if (!this._pending && this.media.paused) this._beginPlay(false);
  }

  _target() {
    const position = this._elapsed * this.tickSeconds;
    const duration = Number(this.media.duration);
    return Number.isFinite(duration) && duration > 0 ? position % duration : position;
  }

  _align(force = false) {
    const target = this._target();
    const current = Number(this.media.currentTime);
    const duration = Number(this.media.duration);
    let difference = Math.abs(target - current);
    if (Number.isFinite(duration) && duration > 0 && difference <= duration) {
      difference = Math.min(difference, duration - difference);
    }
    if (difference < 0.02) return;
    if (!force && Number.isFinite(current)
      && (difference <= 0.9 || this._now() - this._lastSeekAt < 2000)) return;
    this._queuedSeek = target;
    this._flushSeek();
  }

  _flushSeek() {
    if (this._queuedSeek === null || this._failed || this._blocked
      || this.media.seeking || this.media.readyState < 1) return;
    const target = this._queuedSeek;
    // Consume the intent before setting currentTime: seeking can dispatch
    // ready events while currentTime still reports its previous value.
    this._queuedSeek = null;
    this._lastSeekAt = this._now();
    try { this.media.currentTime = target; } catch { /* A later state change may align again. */ }
  }

  _pause() {
    if (!this.media.muted) this.media.muted = true;
    if (!this.media.paused || (this._pending && !this._pending.cancelled)) {
      if (this._pending) this._pending.cancelled = true;
      this.media.pause();
    }
  }

  _beginPlay(prime) {
    if (this._pending) return this._pending.promise;
    const request = { epoch: this._epoch, sourceEpoch: this._sourceEpoch, prime, promise: null };
    this._pending = request;
    this._applySoundSettings();
    this._flushSeek();
    if (this.media.readyState < 2) this._setStatus('loading');
    let result;
    try { result = this.media.play(); }
    catch (error) { result = Promise.reject(error); }
    request.promise = Promise.resolve(result).then(() => {
      if (request.sourceEpoch !== this._sourceEpoch) {
        // A source switch has already selected and possibly started another
        // recording. Never clear its request or change its status/position.
        if (!this._desired || this._failed) this._pause();
        else this._applySoundSettings();
        return false;
      }
      if (this._pending === request) this._pending = null;
      this._abortCount = 0;
      this._retryAfter = 0;
      if (request.epoch !== this._epoch || !this._desired || this._failed) {
        this._pause();
        this._align(true);
      } else {
        this._applySoundSettings();
        if (this._audible) this._align(true);
      }
      if (!this._blocked && !this._failed) this._setStatus('ready');
      // Application ticks reconcile a later session. Never restart playback
      // recursively from a media promise or a media event.
      return true;
    }, (error) => {
      if (request.sourceEpoch !== this._sourceEpoch) return false;
      if (this._pending === request) this._pending = null;
      this._pause();
      if (request.epoch !== this._epoch) {
        return false;
      }
      if (error?.name === 'NotAllowedError') {
        this._blocked = true;
        this._setStatus('blocked');
      } else if (error?.name === 'AbortError') {
        if (!this._desired) {
          if (!this._failed) this._setStatus(this.media.readyState >= 2 ? 'ready' : 'loading');
          return false;
        }
        this._abortCount++;
        this._retryAfter = this._now() + 500;
        if (this._abortCount >= 3) this._blocked = true;
        if (!this._failed) this._setStatus(this._blocked ? 'blocked' : 'retrying');
        // At most three attempts, separated by application ticks and a delay.
        // Repeated immediate rejections must not monopolize the browser thread.
      } else {
        this._failed = true;
        this._setStatus('error');
      }
      return false;
    });
    return request.promise;
  }

  reset() {
    this._epoch += 1;
    this._desired = false;
    this._audible = false;
    this._elapsed = 0;
    this._queuedSeek = null;
    this._abortCount = 0;
    this._retryAfter = 0;
    this._pause();
    this._align(true);
    // Preserve volume/mute choices and any useful browser playback permission.
    if (!this._blocked && !this._failed) this._setStatus(this.media.readyState >= 2 ? 'ready' : 'loading');
  }
}

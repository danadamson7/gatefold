// Playback engine: queue, shuffle/repeat, play counting, 10-band EQ (Web Audio) and OS media keys.
import { S, saveUser, recordPlay, albumArt } from './store.js';
import { emit, shuffle as shuffled, debounce } from './util.js';

export const EQ_FREQS = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
export const EQ_PRESETS = {
  Flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  Rock: [5, 4, 3, 1, -1, -1, 1, 3, 4, 5],
  Pop: [-1, 1, 3, 4, 3, 0, -1, -1, 1, 2],
  Jazz: [3, 2, 1, 2, -1, -1, 0, 1, 2, 3],
  Classical: [4, 3, 2, 1, -1, -1, 0, 2, 3, 4],
  Electronic: [5, 4, 1, 0, -2, 1, 0, 1, 4, 5],
  'Bass Boost': [7, 6, 4, 2, 0, 0, 0, 0, 0, 0],
  'Treble Boost': [0, 0, 0, 0, 0, 1, 3, 5, 6, 7],
  Vocal: [-2, -2, -1, 1, 4, 4, 3, 1, 0, -1],
  Loudness: [6, 4, 0, 0, -2, 0, -1, -4, 5, 2],
};

class Player {
  constructor() {
    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.queue = []; // track ids
    this.order = []; // play order (indices into queue)
    this.pos = -1;
    this.source = null; // { type, id, label }
    this.listened = 0;
    this.counted = false;
    this.lastTime = 0;
    this.loading = false;
    this.graph = null;
    const a = this.audio;
    a.addEventListener('timeupdate', () => this.onTime());
    a.addEventListener('ended', () => this.next(true));
    a.addEventListener('play', () => emit('state'));
    a.addEventListener('pause', () => emit('state'));
    a.addEventListener('playing', () => { this.loading = false; emit('state'); });
    a.addEventListener('waiting', () => { this.loading = true; emit('state'); });
    a.addEventListener('durationchange', () => emit('time'));
    a.addEventListener('error', () => this.onError());
    this.saveSession = debounce(() => this.writeSession(), 1500);
    this.mediaKeys();
  }

  get current() {
    return this.pos >= 0 ? this.queue[this.order[this.pos]] : null;
  }
  get track() {
    return S.tracks.get(this.current);
  }
  get playing() {
    return !this.audio.paused;
  }
  get upcoming() {
    return this.order.map((i) => this.queue[i]);
  }

  initGraph() {
    if (this.graph) return;
    const ctx = new AudioContext();
    const src = ctx.createMediaElementSource(this.audio);
    const pre = ctx.createGain();
    const filters = EQ_FREQS.map((f, i) => {
      const b = ctx.createBiquadFilter();
      b.type = i === 0 ? 'lowshelf' : i === EQ_FREQS.length - 1 ? 'highshelf' : 'peaking';
      b.frequency.value = f;
      b.Q.value = 1.1;
      return b;
    });
    let node = src.connect(pre);
    for (const f of filters) node = node.connect(f);
    node.connect(ctx.destination);
    this.graph = { ctx, pre, filters };
    this.applyEq();
  }

  applyEq() {
    if (!this.graph) return;
    const { on, preamp, bands } = S.user.eq;
    this.graph.pre.gain.value = on ? 10 ** (preamp / 20) : 1;
    this.graph.filters.forEach((f, i) => { f.gain.value = on ? bands[i] : 0; });
  }

  applyVolume() {
    const v = S.user.muted ? 0 : S.user.volume / 100;
    this.audio.volume = v * v; // perceptual curve
  }

  // ---- queue control ----
  playList(ids, start = 0, source = null) {
    ids = ids.filter((id) => S.tracks.has(id));
    if (!ids.length) return;
    this.queue = ids.slice();
    this.source = source;
    this.buildOrder(Math.min(start, ids.length - 1));
    this.load(true);
  }

  // Plays the list in a random order regardless of the shuffle toggle.
  shuffleList(ids, source = null) {
    const list = shuffled(ids);
    this.playList(list, 0, source);
  }

  buildOrder(start) {
    const idx = this.queue.map((_, i) => i);
    if (S.user.shuffle) {
      this.order = [start, ...shuffled(idx.filter((i) => i !== start))];
      this.pos = 0;
    } else {
      this.order = idx;
      this.pos = start;
    }
  }

  enqueue(ids, next = false) {
    ids = ids.filter((id) => S.tracks.has(id));
    if (!ids.length) return;
    if (this.pos < 0) return this.playList(ids, 0, { type: 'queue', label: 'Queue' });
    const base = this.queue.length;
    this.queue.push(...ids);
    const added = ids.map((_, i) => base + i);
    if (next) this.order.splice(this.pos + 1, 0, ...added);
    else this.order.push(...added);
    emit('queue');
    this.saveSession();
  }

  jump(pos) {
    if (pos < 0 || pos >= this.order.length) return;
    this.pos = pos;
    this.load(true);
  }

  removeAt(pos) {
    if (pos === this.pos) return;
    this.order.splice(pos, 1);
    if (pos < this.pos) this.pos--;
    emit('queue');
    this.saveSession();
  }

  load(autoplay, startAt = 0) {
    const id = this.current;
    if (!id) return;
    this.listened = 0;
    this.counted = false;
    this.lastTime = startAt;
    this.loading = true;
    this.audio.src = `media/${encodeURIComponent(id)}`;
    if (startAt) {
      this.audio.addEventListener('loadedmetadata', () => { this.audio.currentTime = startAt; }, { once: true });
    }
    if (autoplay) this.play();
    emit('track', id);
    emit('queue');
    this.updateMediaSession();
    this.saveSession();
    const nxt = this.queue[this.order[this.pos + 1]];
    if (nxt) window.gf.prepare(nxt);
  }

  play() {
    if (!this.current) return;
    this.initGraph();
    if (this.graph.ctx.state === 'suspended') this.graph.ctx.resume();
    this.audio.play().catch((err) => { if (err.name !== 'AbortError') console.warn('play failed', err); });
  }

  pause() {
    this.audio.pause();
    this.saveSession();
  }

  toggle() {
    if (!this.current) {
      const all = [...S.tracks.keys()];
      if (all.length) this.shuffleList(all, { type: 'random', label: 'Random songs' });
      return;
    }
    if (this.audio.paused) this.play();
    else this.pause();
  }

  next(auto = false) {
    if (!this.current) return;
    if (auto && S.user.repeat === 'one') {
      this.audio.currentTime = 0;
      this.listened = 0;
      this.counted = false;
      this.play();
      return;
    }
    if (this.pos < this.order.length - 1) {
      this.pos++;
      this.load(true);
    } else if (S.user.repeat === 'all' || !auto) {
      if (S.user.shuffle) this.order = shuffled(this.order);
      this.pos = 0;
      this.load(S.user.repeat === 'all' || !this.audio.paused);
    } else {
      this.audio.pause();
      this.audio.currentTime = 0;
      emit('state');
    }
  }

  prev() {
    if (!this.current) return;
    if (this.audio.currentTime > 3 || this.pos === 0) {
      this.audio.currentTime = 0;
      return;
    }
    this.pos--;
    this.load(true);
  }

  seek(frac) {
    const d = this.duration;
    if (d) this.audio.currentTime = Math.max(0, Math.min(d - 0.25, frac * d));
  }

  get duration() {
    return isFinite(this.audio.duration) ? this.audio.duration : this.track?.duration || 0;
  }

  setShuffle(on) {
    S.user.shuffle = on;
    saveUser();
    if (this.pos >= 0) {
      const cur = this.order[this.pos];
      if (on) {
        const rest = shuffled(this.order.slice(this.pos + 1));
        const done = this.order.slice(0, this.pos);
        this.order = [...done, cur, ...rest];
      } else {
        this.order = this.queue.map((_, i) => i);
        this.pos = cur;
      }
      emit('queue');
    }
    emit('state');
  }

  cycleRepeat() {
    S.user.repeat = { off: 'all', all: 'one', one: 'off' }[S.user.repeat];
    saveUser();
    emit('state');
  }

  // ---- events ----
  onTime() {
    const t = this.audio.currentTime;
    const dt = t - this.lastTime;
    if (dt > 0 && dt < 2) this.listened += dt;
    this.lastTime = t;
    const d = this.duration;
    if (!this.counted && d && this.listened >= Math.min(d * 0.5, 240)) {
      this.counted = true;
      recordPlay(this.current, this.source);
    }
    emit('time');
    if ('mediaSession' in navigator && d && isFinite(t)) {
      try {
        navigator.mediaSession.setPositionState({ duration: d, position: Math.min(t, d), playbackRate: 1 });
      } catch { /* position may race with duration */ }
    }
    this.saveSession();
  }

  onError() {
    if (!this.audio.src || !this.current) return;
    const t = this.track;
    emit('toast', `Can't play “${t?.title || 'track'}” — skipping`);
    this.loading = false;
    if (this.pos < this.order.length - 1) setTimeout(() => this.next(true), 400);
    else emit('state');
  }

  updateMediaSession() {
    if (!('mediaSession' in navigator)) return;
    const t = this.track;
    if (!t) return;
    const meta = { title: t.title, artist: t.artist, album: t.albumTitle };
    navigator.mediaSession.metadata = new MediaMetadata(meta);
    // The OS media overlay only accepts http/data/blob artwork, so hand it a blob of the cover.
    const art = albumArt(S.albums.get(t.albumKey), false);
    if (!art) return;
    fetch(art).then((r) => r.blob()).then((b) => {
      if (this.track !== t) return;
      if (this.artUrl) URL.revokeObjectURL(this.artUrl);
      this.artUrl = URL.createObjectURL(b);
      navigator.mediaSession.metadata = new MediaMetadata({ ...meta, artwork: [{ src: this.artUrl, type: b.type }] });
    }).catch(() => {});
  }

  mediaKeys() {
    if (!('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    ms.setActionHandler('play', () => this.play());
    ms.setActionHandler('pause', () => this.pause());
    ms.setActionHandler('previoustrack', () => this.prev());
    ms.setActionHandler('nexttrack', () => this.next());
    ms.setActionHandler('seekto', (e) => { this.audio.currentTime = e.seekTime; });
  }

  writeSession() {
    S.user.session = this.pos < 0 ? null : {
      queue: this.queue, order: this.order, pos: this.pos, source: this.source,
      time: Math.floor(this.audio.currentTime || 0),
    };
    saveUser();
  }

  restore() {
    const s = S.user.session;
    if (!s?.queue?.length) return;
    // Drop tracks that disappeared from the library since last run.
    const keep = s.queue.map((id) => S.tracks.has(id));
    if (!keep[s.order[s.pos]]) return;
    const remap = [];
    let n = 0;
    keep.forEach((k, i) => { if (k) remap[i] = n++; });
    this.queue = s.queue.filter((_, i) => keep[i]);
    const cur = s.order[s.pos];
    this.order = s.order.filter((i) => keep[i]).map((i) => remap[i]);
    this.pos = this.order.indexOf(remap[cur]);
    this.source = s.source;
    this.load(false, s.time || 0);
  }
}

export const player = new Player();

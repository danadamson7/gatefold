// Application state: the library (from the main process) plus user data (settings, stats, playlists).
import { debounce, emit, esc, sortKey, strHash } from './util.js';

export const S = {
  info: null,
  snapshot: null,
  tracks: new Map(), // id -> track (with user overrides applied)
  albums: new Map(), // key -> album
  albumList: [],
  artists: new Map(), // album artist -> { name, albums, trackCount, duration }
  trackArtists: new Map(), // track artist -> [track ids]
  user: null,
  ui: { page: 'explore', artist: null, album: null, playlist: null, songsArtist: null },
};

export const SONG_COLUMNS = ['title', 'artist', 'albumArtist', 'album', 'year', 'track', 'disc', 'duration', 'plays',
  'genre', 'mood', 'lastPlayed', 'added', 'format'];

const DEFAULT_USER = () => ({
  settings: {
    folders: [],
    mergeDiscs: true,
    forgottenDays: 60,
    artistSort: 'alpha',
    songColumns: ['title', 'artist', 'albumArtist', 'album', 'year', 'duration', 'plays', 'genre'],
    songSort: { key: 'albumArtist', dir: 1 },
  },
  stats: { tracks: {}, playlists: {} },
  playlists: [],
  artistImages: {},
  albumArt: {},
  overrides: {},
  eq: { on: false, preamp: 0, bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], preset: 'Flat' },
  volume: 80,
  muted: false,
  shuffle: false,
  repeat: 'off',
  session: null,
});

function merge(base, extra) {
  for (const [k, v] of Object.entries(extra || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) merge(base[k], v);
    else base[k] = v;
  }
  return base;
}

export async function loadUser() {
  S.user = merge(DEFAULT_USER(), await window.gf.getUser());
}

export const saveUser = debounce(() => window.gf.saveUser(JSON.stringify(S.user)), 700);
window.addEventListener('beforeunload', () => saveUser.flush());

export function setLibrary(snapshot) {
  S.snapshot = snapshot;
  const ov = S.user.overrides;
  S.tracks = new Map();
  for (const t of snapshot.tracks) S.tracks.set(t.id, ov[t.id] ? { ...t, ...ov[t.id] } : t);

  const albums = new Map();
  for (const t of S.tracks.values()) {
    let a = albums.get(t.albumKey);
    if (!a) {
      a = { key: t.albumKey, title: t.albumTitle, artist: t.albumArtist, tracks: [], duration: 0, addedAt: 0,
        art: snapshot.albums[t.albumKey]?.art || null, years: new Map(), genres: new Map() };
      albums.set(t.albumKey, a);
    }
    a.tracks.push(t);
    a.duration += t.duration || 0;
    a.addedAt = Math.max(a.addedAt, t.addedAt || 0);
    if (t.year) a.years.set(t.year, (a.years.get(t.year) || 0) + 1);
    for (const g of (t.genre || '').split(/\s*[,;/]\s*/).filter(Boolean)) a.genres.set(g, (a.genres.get(g) || 0) + 1);
  }
  for (const a of albums.values()) {
    a.tracks.sort((x, y) => x.discN - y.discN || x.track - y.track || x.title.localeCompare(y.title));
    a.year = [...a.years].sort((x, y) => y[1] - x[1] || x[0] - y[0])[0]?.[0] || 0;
    a.genre = [...a.genres].sort((x, y) => y[1] - x[1]).map((g) => g[0]).slice(0, 3).join(', ');
    a.discs = new Set(a.tracks.map((t) => t.discN)).size;
    delete a.years;
    delete a.genres;
  }
  S.albums = albums;
  S.albumList = [...albums.values()].sort((x, y) => sortKey(x.artist).localeCompare(sortKey(y.artist)) || x.year - y.year);

  S.artists = new Map();
  for (const a of S.albumList) {
    let ar = S.artists.get(a.artist);
    if (!ar) S.artists.set(a.artist, (ar = { name: a.artist, albums: [], trackCount: 0, duration: 0 }));
    ar.albums.push(a);
    ar.trackCount += a.tracks.length;
    ar.duration += a.duration;
  }
  for (const ar of S.artists.values()) ar.albums.sort(byYear);

  S.trackArtists = new Map();
  for (const t of S.tracks.values()) {
    if (!S.trackArtists.has(t.artist)) S.trackArtists.set(t.artist, []);
    S.trackArtists.get(t.artist).push(t.id);
  }
  emit('library');
}

export const byYear = (x, y) => (x.year || 9999) - (y.year || 9999) || x.title.localeCompare(y.title);

// ---- art ----
export function albumArt(album, thumb = true) {
  if (!album) return null;
  const custom = S.user.albumArt[album.key];
  if (custom) return `custom/${custom}`;
  return album.art ? `art/${album.key}${thumb ? '_t' : ''}.jpg?v=${album.art}` : null;
}

export function artHtml(album, cls = '', thumb = true) {
  const url = albumArt(album, thumb);
  if (url) return `<img class="art ${cls}" src="${esc(url)}" loading="lazy" decoding="async" alt="">`;
  return placeholder(album?.title || '?', cls);
}

export function placeholder(text, cls = '') {
  const h = strHash(text) % 360;
  const initials = text.split(/\s+/).filter((w) => /\w/.test(w)).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return `<div class="art ph ${cls}" style="--h:${h}"><span>${esc(initials)}</span></div>`;
}

export function artistImage(name) {
  const custom = S.user.artistImages[name];
  if (custom) return `custom/${custom}`;
  const ar = S.artists.get(name);
  const withArt = ar?.albums.find((a) => albumArt(a));
  return withArt ? albumArt(withArt) : null;
}

export function playlistArtHtml(pl, cls = '') {
  if (pl.image) return `<img class="art ${cls}" src="custom/${esc(pl.image)}" alt="">`;
  const seen = new Set();
  const arts = [];
  for (const id of pl.tracks) {
    const t = S.tracks.get(id);
    if (!t || seen.has(t.albumKey)) continue;
    seen.add(t.albumKey);
    const url = albumArt(S.albums.get(t.albumKey));
    if (url) arts.push(url);
    if (arts.length === 4) break;
  }
  if (arts.length >= 4) return `<div class="art mosaic ${cls}">${arts.map((u) => `<img src="${esc(u)}" alt="">`).join('')}</div>`;
  if (arts.length) return `<img class="art ${cls}" src="${esc(arts[0])}" alt="">`;
  return placeholder(pl.name, cls);
}

// ---- stats ----
export const trackStats = (id) => S.user.stats.tracks[id] || { n: 0, last: 0 };

export function albumStats(album) {
  let n = 0;
  let last = 0;
  for (const t of album.tracks) {
    const s = S.user.stats.tracks[t.id];
    if (s) {
      n += s.n;
      last = Math.max(last, s.last);
    }
  }
  return { n, last };
}

export function recordPlay(id, source) {
  const st = S.user.stats;
  const s = (st.tracks[id] ||= { n: 0, last: 0 });
  s.n++;
  s.last = Date.now();
  if (source?.type === 'playlist') {
    const p = (st.playlists[source.id] ||= { n: 0, last: 0 });
    p.n++;
    p.last = Date.now();
  }
  saveUser();
  emit('stats', id);
}

// ---- playlists ----
export const playlist = (id) => S.user.playlists.find((p) => p.id === id);

export function createPlaylist(name, ids = []) {
  const pl = { id: Math.random().toString(36).slice(2, 10), name, image: null, tracks: [...ids], created: Date.now() };
  S.user.playlists.push(pl);
  saveUser();
  emit('playlists');
  return pl;
}

export function addToPlaylist(id, ids) {
  const pl = playlist(id);
  pl.tracks.push(...ids);
  saveUser();
  emit('playlists');
  return pl;
}

export function updateOverrides(id, fields) {
  const base = S.snapshot.tracks.find((t) => t.id === id);
  const ov = {};
  for (const [k, v] of Object.entries(fields)) if (String(base[k] ?? '') !== String(v ?? '')) ov[k] = v;
  if (Object.keys(ov).length) S.user.overrides[id] = ov;
  else delete S.user.overrides[id];
  saveUser();
  setLibrary(S.snapshot);
}

// Library scanning: walks music folders, reads tags, groups tracks into albums and extracts cover art.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { parseFile } from 'music-metadata';
import { nativeImage } from 'electron';

export const AUDIO_EXT = new Set(['mp3', 'flac', 'ogg', 'oga', 'opus', 'm4a', 'mp4', 'aac', 'wav', 'webm',
  'wma', 'ape', 'wv', 'aif', 'aiff', 'mpc', 'dsf', 'alac']);
const IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'webp']);
const TRACK_VERSION = 3; // bump to force a full re-read of tags after a parser change

export const hash = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 16);
const ext = (p) => path.extname(p).slice(1).toLowerCase();
const norm = (s) => s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, '');

// "Rush in Rio Disc 1" -> { base: "Rush in Rio", disc: 1 }
// "The Song Remains The Same [Disc 1] [Live]" -> { base: "The Song Remains The Same [Live]", disc: 1 }
const DISC_BRACKET = /\s*[[(](?:disc|disk|cd)\s*(\d+)(?:\s*of\s*\d+)?[\])]/i;
const DISC_SUFFIX = /[\s\-_:,]*(?:disc|disk|cd)\s*(\d+)(?:\s*of\s*\d+)?\s*$/i;
const DISC_FOLDER = /^(?:(?:cd|disc|disk)\s*)?(\d{1,2})$/i;
export function splitDisc(name) {
  let base;
  let m = DISC_BRACKET.exec(name);
  if (m) base = name.slice(0, m.index) + name.slice(m.index + m[0].length);
  else {
    m = DISC_SUFFIX.exec(name);
    if (!m || m.index === 0) return { base: name, disc: 0 };
    base = name.slice(0, m.index);
  }
  base = base.replace(/\s{2,}/g, ' ').replace(/[\s\-_:,]+$/, '').trim();
  const wrapped = /^\[([^[\]]*)\]$/.exec(base) || /^\(([^()]*)\)$/.exec(base);
  if (wrapped) base = wrapped[1].trim();
  return { base, disc: +m[1] };
}

async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) await fn(items[i++]);
  }));
}

async function writeJson(file, data) {
  const tmp = file + '.tmp';
  await fsp.writeFile(tmp, JSON.stringify(data));
  await fsp.rename(tmp, file);
}

function firstString(v) {
  if (Array.isArray(v)) return v[0] || '';
  return v || '';
}

async function readTrack(file, id, st, prev) {
  let mm = await parseFile(file, { skipCovers: true });
  if (!mm.format.duration) mm = await parseFile(file, { skipCovers: true, duration: true });
  const c = mm.common;
  const base = path.basename(file, path.extname(file));
  let lyrics = '';
  let lyricsSync = null;
  for (const l of c.lyrics || []) {
    if (l.syncText?.length && !lyricsSync) lyricsSync = l.syncText.map((x) => [x.timestamp ?? 0, x.text]);
    else if (l.text && !lyrics) lyrics = l.text;
  }
  return {
    id, path: file, mtime: st.mtimeMs, size: st.size, v: TRACK_VERSION,
    addedAt: prev?.addedAt ?? st.mtimeMs,
    title: c.title || base.replace(/^\d+[\s.\-_]+/, ''),
    artist: c.artist || c.albumartist || 'Unknown Artist',
    albumArtistTag: c.albumartist || (c.compilation ? 'Various Artists' : ''),
    album: c.album || path.basename(path.dirname(file)),
    albumFromFolder: !c.album,
    artistFromFolder: !c.artist && !c.albumartist,
    year: c.year || c.originalyear || 0,
    track: c.track?.no || 0, trackOf: c.track?.of || 0,
    disc: c.disk?.no || 0, discOf: c.disk?.of || 0,
    discSubtitle: firstString(c.discsubtitle),
    duration: mm.format.duration || 0,
    genre: (c.genre || []).join(', '),
    mood: c.mood || '',
    comment: (c.comment || []).map((x) => (typeof x === 'string' ? x : x.text)).filter(Boolean).join('\n'),
    lyrics, lyricsSync,
    codec: mm.format.codec || '',
  };
}

// Assigns albumKey / albumTitle / albumArtist / discN to every track and returns album -> info.
function group(tracks, merge, roots) {
  const prelim = new Map();
  for (const t of tracks) {
    let dir = path.dirname(t.path);
    let disc = t.disc;
    const fd = DISC_FOLDER.exec(path.basename(dir));
    if (fd && merge && !roots.has(path.dirname(dir))) {
      dir = path.dirname(dir);
      if (!disc || (disc === 1 && t.discOf <= 1)) disc = +fd[1];
    }
    // Untagged files: fall back to the usual Artist/Album/track folder layout.
    if (t.artistFromFolder) {
      const up = path.dirname(dir);
      t.artist = up !== dir && !roots.has(dir) && !roots.has(up) ? path.basename(up) : 'Unknown Artist';
    }
    let title = t.albumFromFolder ? path.basename(dir) : t.album;
    if (merge) {
      const s = splitDisc(title);
      if (s.disc && s.base) {
        title = s.base;
        if (!disc || (disc === 1 && t.discOf <= 1)) disc = s.disc;
      }
    }
    t.albumTitle = title;
    t.discN = disc || 1;
    t._dir = dir;
    // Tracks without an album-artist tag are grouped by folder first, then promoted to an artist key
    // if every track in that folder-album shares one artist (so split "Disc N" folders still merge).
    const pk = t.albumArtistTag ? 'a:' + norm(t.albumArtistTag) + '|' + norm(title) : 'd:' + dir + '|' + norm(title);
    if (!prelim.has(pk)) prelim.set(pk, []);
    prelim.get(pk).push(t);
  }
  const albums = new Map();
  for (const [pk, list] of prelim) {
    let key = pk;
    if (pk.startsWith('d:')) {
      const artists = new Set(list.map((t) => norm(t.artist)));
      if (artists.size === 1) key = 'a:' + [...artists][0] + '|' + norm(list[0].albumTitle);
    }
    const id = hash(key);
    if (!albums.has(id)) albums.set(id, { id, tracks: [] });
    albums.get(id).tracks.push(...list);
  }
  for (const a of albums.values()) {
    const tagged = a.tracks.filter((t) => t.albumArtistTag);
    const names = tagged.length ? tagged.map((t) => t.albumArtistTag) : a.tracks.map((t) => t.artist);
    const counts = new Map();
    for (const n of names) counts.set(n, (counts.get(n) || 0) + 1);
    const distinct = new Set(names.map(norm));
    const albumArtist = !tagged.length && distinct.size > 1
      ? 'Various Artists'
      : [...counts].sort((x, y) => y[1] - x[1])[0][0];
    const titles = new Map();
    for (const t of a.tracks) titles.set(t.albumTitle, (titles.get(t.albumTitle) || 0) + 1);
    const title = [...titles].sort((x, y) => y[1] - x[1])[0][0];
    a.dirs = new Set(a.tracks.map((t) => path.dirname(t.path)));
    for (const t of a.tracks) {
      t.albumKey = a.id;
      t.albumArtist = albumArtist;
      t.albumTitle = title;
      delete t._dir;
    }
  }
  return albums;
}

const COVER_NAME = /^(cover|folder|front|albumart(?!small)|album)/i;

export class Library {
  constructor(dir) {
    this.dir = dir;
    this.artDir = path.join(dir, 'art');
    this.file = path.join(dir, 'library.json');
    fs.mkdirSync(this.artDir, { recursive: true });
    try {
      this.data = JSON.parse(fs.readFileSync(this.file, 'utf8'));
    } catch {
      this.data = { tracks: {}, albums: {} };
    }
    this.byId = this.data.tracks;
    this.scanning = null;
  }

  track(id) {
    return this.byId[id];
  }

  snapshot() {
    return { tracks: Object.values(this.data.tracks), albums: this.data.albums };
  }

  scan(folders, opts) {
    if (!this.scanning) this.scanning = this._scan(folders, opts).finally(() => { this.scanning = null; });
    return this.scanning;
  }

  async _scan(folders, { merge = true, onProgress = () => {} } = {}) {
    folders = folders.map((f) => path.resolve(f));
    const files = [];
    const images = new Map(); // dir -> [image paths]
    const lrc = new Set();
    const walk = async (dir) => {
      let entries;
      try {
        entries = await fsp.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of entries) {
        if (e.name.startsWith('.')) continue;
        const full = path.join(dir, e.name);
        if (e.isDirectory()) await walk(full);
        else if (e.isFile()) {
          const x = ext(e.name);
          if (AUDIO_EXT.has(x)) files.push(full);
          else if (IMAGE_EXT.has(x)) {
            if (!images.has(dir)) images.set(dir, []);
            images.get(dir).push(full);
          } else if (x === 'lrc') lrc.add(full.slice(0, -4).toLowerCase());
        }
      }
    };
    onProgress({ phase: 'Finding music', done: 0, total: 0 });
    for (const f of folders) await walk(f);

    const old = this.data.tracks;
    const next = {};
    const changed = new Set();
    let done = 0;
    await pool(files, 8, async (file) => {
      const id = hash(file);
      try {
        const st = await fsp.stat(file);
        const prev = old[id];
        if (prev && prev.mtime === st.mtimeMs && prev.size === st.size && prev.v === TRACK_VERSION) next[id] = prev;
        else {
          next[id] = await readTrack(file, id, st, prev);
          changed.add(id);
        }
        next[id].lrc = lrc.has(file.slice(0, -path.extname(file).length).toLowerCase());
      } catch (err) {
        console.warn('skip', file, err.message);
      }
      if (++done % 20 === 0) onProgress({ phase: 'Reading tags', done, total: files.length });
    });

    const albums = group(Object.values(next), merge, new Set(folders));
    const dirAlbums = new Map();
    for (const t of Object.values(next)) {
      const d = path.dirname(t.path);
      if (!dirAlbums.has(d)) dirAlbums.set(d, new Set());
      dirAlbums.get(d).add(t.albumKey);
    }
    const oldAlbums = this.data.albums || {};
    const albumInfo = {};
    let artDone = 0;
    const albumList = [...albums.values()];
    await pool(albumList, 4, async (a) => {
      const prev = oldAlbums[a.id];
      const dirty = !prev || a.tracks.some((t) => changed.has(t.id)) || prev.dirs?.join('\n') !== [...a.dirs].join('\n');
      if (!dirty && (prev.art === null || fs.existsSync(path.join(this.artDir, a.id + '.jpg')))) albumInfo[a.id] = prev;
      else albumInfo[a.id] = { art: await this._resolveArt(a, images, dirAlbums), dirs: [...a.dirs] };
      if (++artDone % 10 === 0) onProgress({ phase: 'Finding album art', done: artDone, total: albumList.length });
    });

    this.data = { tracks: next, albums: albumInfo };
    this.byId = next;
    await writeJson(this.file, this.data);
    onProgress({ phase: 'Done', done: files.length, total: files.length });
    return { tracks: files.length, changed: changed.size, albums: albums.size };
  }

  async _resolveArt(album, images, dirAlbums) {
    const candidates = [];
    for (const dir of album.dirs) {
      // Folder images only count when the folder holds just this album (skips an artist-level Folder.jpg).
      if (dirAlbums.get(dir).size > 1) continue;
      for (const p of images.get(dir) || []) {
        const name = path.basename(p);
        if (/small|thumb/i.test(name)) continue;
        candidates.push({ img: () => nativeImage.createFromPath(p), named: COVER_NAME.test(name) });
      }
    }
    const first = [...album.tracks].sort((a, b) => a.discN - b.discN || a.track - b.track)[0];
    try {
      const mm = await parseFile(first.path, { skipCovers: false });
      const pics = mm.common.picture || [];
      const pic = pics.find((p) => /front/i.test(p.type || '')) || pics[0];
      if (pic) candidates.push({ img: () => nativeImage.createFromBuffer(Buffer.from(pic.data)), named: true, embedded: true });
    } catch {
      /* unreadable cover */
    }
    let best = null;
    let bestScore = -1;
    for (const c of candidates) {
      const img = c.img();
      if (img.isEmpty()) continue;
      const { width, height } = img.getSize();
      const square = Math.min(width, height) / Math.max(width, height);
      const score = width * height * (c.named ? 1.2 : 1) * (square > 0.8 ? 1 : 0.3);
      if (score > bestScore) [best, bestScore] = [img, score];
    }
    if (!best) return null;
    const full = best.getSize().width > 800 ? best.resize({ width: 800, quality: 'best' }) : best;
    const thumb = best.resize({ width: 300, quality: 'best' });
    await fsp.writeFile(path.join(this.artDir, album.id + '.jpg'), full.toJPEG(90));
    await fsp.writeFile(path.join(this.artDir, album.id + '_t.jpg'), thumb.toJPEG(85));
    return Date.now().toString(36);
  }
}

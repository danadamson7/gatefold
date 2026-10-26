// Portable metadata/stats transfer. No audio, passwords, absolute paths or custom images.
import { S, saveUser, setLibrary } from './store.js';

const fields = ['title', 'artist', 'albumArtist', 'albumTitle', 'year', 'month', 'day',
  'genre', 'mood', 'comment', 'discSubtitle', 'discOf', 'lyrics'];
const clean = (v) => String(v ?? '').trim().toLocaleLowerCase();
const baseName = (path) => String(path ?? '').replace(/\\/g, '/').split('/').pop() || '';
const signature = (t) => [baseName(t.path), t.albumTitle, t.discN || 1, t.track || 0,
  Math.round(t.duration || 0)].map(clean).join('|');

export function createMetadataExport(snapshot, user) {
  const overrides = user.overrides || {};
  return {
    format: 'gatefold-metadata', version: 1, appVersion: '1.1.0', createdAt: new Date().toISOString(),
    // Entries contain no absolute music folder paths; songs matched by ID and original filename/album details.
    tracks: snapshot.tracks.map((base) => {
      const extra = overrides[base.id] || {};
      const meta = Object.fromEntries(fields.filter((k) => extra[k] !== undefined).map((k) => [k, extra[k]]));
      return {
        id: base.id, match: signature(base), fileName: baseName(base.path),
        title: extra.title ?? base.title, artist: extra.artist ?? base.artist,
        albumTitle: extra.albumTitle ?? base.albumTitle, albumArtist: extra.albumArtist ?? base.albumArtist,
        track: base.track, discN: base.discN, duration: base.duration,
        year: extra.year ?? base.year, month: extra.month ?? base.month, day: extra.day ?? base.day,
        genre: extra.genre ?? base.genre, mood: extra.mood ?? base.mood,
        discSubtitle: extra.discSubtitle ?? base.discSubtitle,
        stats: user.stats?.tracks?.[base.id] || { n: 0, last: 0 }, overrides: meta,
      };
    }),
    playlists: (user.playlists || []).map((p) => ({ name: p.name,
      tracks: p.tracks.map((id) => {
        const b = snapshot.tracks.find((t) => t.id === id);
        return b && { id, match: signature(b) };
      }).filter(Boolean),
    })),
  };
}

export function importMetadataExport(data, snapshot, user) {
  if (!data || data.format !== 'gatefold-metadata' || data.version !== 1 || !Array.isArray(data.tracks)
    || data.tracks.length > 300000) throw new Error('Not a supported Gatefold metadata export');
  const byId = new Map(snapshot.tracks.map((t) => [t.id, t]));
  const bySig = new Map();
  for (const t of snapshot.tracks) {
    const key = signature(t);
    if (!bySig.has(key)) bySig.set(key, []);
    bySig.get(key).push(t);
  }
  const matches = new Map();
  let skipped = 0;
  for (const record of data.tracks) {
    if (!record || typeof record !== 'object' || typeof record.match !== 'string') { skipped++; continue; }
    const same = bySig.get(record.match) || [];
    const t = byId.get(record.id) || (same.length === 1 ? same[0] : null);
    if (!t || matches.has(record.id)) { skipped++; continue; }
    matches.set(record.id, t.id);
    const fieldsToSave = {};
    for (const key of fields) {
      const v = record.overrides?.[key];
      if (v !== undefined && (typeof v === 'string' || typeof v === 'number') && String(v).length <= 1000000) {
        fieldsToSave[key] = v;
      }
    }
    if (Object.keys(fieldsToSave).length) user.overrides[t.id] = { ...(user.overrides[t.id] || {}), ...fieldsToSave };
    const stats = record.stats;
    if (stats && Number.isSafeInteger(stats.n) && stats.n >= 0 && Number.isFinite(stats.last) && stats.last >= 0) {
      // Replace rather than add to avoid double counting repeated imports.
      user.stats.tracks[t.id] = { n: stats.n, last: stats.last };
    }
  }
  let playlists = 0;
  for (const p of Array.isArray(data.playlists) ? data.playlists.slice(0, 10000) : []) {
    if (typeof p?.name !== 'string' || !Array.isArray(p.tracks)) continue;
    const ids = p.tracks.slice(0, 100000).map((x) => matches.get(x?.id)).filter(Boolean);
    if (!ids.length || user.playlists.some((v) => v.name === p.name)) continue;
    user.playlists.push({ id: Math.random().toString(36).slice(2, 10), name: p.name.slice(0, 200), image: null, tracks: ids, created: Date.now() });
    playlists++;
  }
  return { matched: matches.size, skipped, playlists };
}

export function restoreMetadata(data) {
  if (!S.snapshot) throw new Error('Scan the music library before importing');
  const result = importMetadataExport(data, S.snapshot, S.user);
  saveUser();
  setLibrary(S.snapshot);
  return result;
}

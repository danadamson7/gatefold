import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseReleaseDate } from '../src/metadata.mjs';

// Renderer JS is shipped as browser ES modules in a CommonJS Electron project.
// Copy the unmodified module sources to a tiny ESM sandbox to test without Electron.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gatefold-tests-'));
const jsDir = path.resolve('src/renderer/js');
fs.cpSync(jsDir, path.join(tmp, 'js'), { recursive: true });
fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}');
globalThis.window = { addEventListener() {}, gf: { saveUser: async () => {} } };
const store = await import(pathToFileURL(path.join(tmp, 'js/store.js')));
const explore = await import(pathToFileURL(path.join(tmp, 'js/views/explore.js')));
const { S, setLibrary, updateAlbumOverrides, updateOverrides } = store;

test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));

test('release dates retain partial precision and reject invalid days', () => {
  assert.deepEqual(parseReleaseDate('2004-09-12'), { year: 2004, month: 9, day: 12 });
  assert.deepEqual(parseReleaseDate('2004-09'), { year: 2004, month: 9, day: 0 });
  assert.deepEqual(parseReleaseDate('2004'), { year: 2004, month: 0, day: 0 });
  assert.deepEqual(parseReleaseDate(undefined, 1999), { year: 1999, month: 0, day: 0 });
  assert.deepEqual(parseReleaseDate('2023-02-30', 2023), { year: 2023, month: 0, day: 0 });
  assert.deepEqual(parseReleaseDate('2024-02-29'), { year: 2024, month: 2, day: 29 });
});

function track(a, n, opts = {}) {
  return {
    id: `track${a}-${n}`, albumKey: `album${a}`, albumTitle: `Album ${a}`,
    albumArtist: `Album Artist ${a}`, artist: n === 1 ? 'Singer One' : 'Singer Two',
    title: `Track ${n}`, track: n, discN: n, discOf: 2, discSubtitle: `Part ${n}`,
    year: 2004, month: 9, day: 12, genre: 'Rock', comment: 'Original comment',
    duration: 120, addedAt: Date.now(), path: `/fake/${a}/${n}.mp3`, ...opts,
  };
}
function setup() {
  S.user = { settings: { artistSort:'alpha' }, overrides: {}, albumArt: { album0: 'sample.jpg' },
    stats: { tracks: {}, playlists: { many: { n: 9999, last: Date.now() } } },
    playlists: [{ id: 'many', name: 'Greatest', tracks: [] }], artistImages: {} };
  const tracks = [];
  const albums = {};
  for (let i = 0; i < 30; i++) {
    tracks.push(track(i, 1), track(i, 2));
    albums[`album${i}`] = { art: null, dirs: [`/fake/${i}`] };
    S.user.stats.tracks[`track${i}-1`] = { n: 30 - i, last: Date.now() };
  }
  setLibrary({ tracks, albums });
}

test('album editing leaves separate song artists intact and preserves overrides, art and stable album keys', () => {
  setup();
  updateOverrides('track0-1', { lyrics: 'Stored lyrics' });
  updateAlbumOverrides('album0', {
    albumTitle: 'A New Name', albumArtist: 'New Album Credit', year: 2012,
    month: 5, day: 23, genre: 'Electronic', comment: 'Album comment', discOf: 3,
  }, { 1: 'First movement', 2: 'Second movement' });
  const a = S.albums.get('album0');
  assert.equal(a.title, 'A New Name');
  assert.equal(a.artist, 'New Album Credit');
  assert.deepEqual([a.year, a.month, a.day], [2012, 5, 23]);
  assert.equal(a.discs, 3);
  assert.equal(a.genre, 'Electronic');
  assert.equal(a.tracks[0].artist, 'Singer One');
  assert.equal(a.tracks[1].artist, 'Singer Two');
  assert.equal(a.tracks[0].discSubtitle, 'First movement');
  assert.equal(a.tracks[1].discSubtitle, 'Second movement');
  assert.equal(S.tracks.get('track0-1').lyrics, 'Stored lyrics');
  assert.equal(S.user.albumArt.album0, 'sample.jpg');
  assert.equal(S.artists.get('New Album Credit').albums[0].key, 'album0');
  assert.equal(S.albums.size, 30);
  // Reconstruct the cached snapshot as happens after application reload/rescan.
  setLibrary(S.snapshot);
  assert.equal(S.albums.get('album0').title, 'A New Name');
});

test('top 25 contains ranked played albums only, not playlists', () => {
  setup();
  const top = explore.exploreData().top;
  assert.equal(top.length, 25);
  assert.equal(top[0].a.key, 'album0');
  assert.equal(top[24].a.key, 'album24');
  assert.ok(top.every((item) => item.a && !item.p));
});

test('single-track artist edits do not erase other previously saved song overrides', () => {
  setup();
  updateOverrides('track0-1', { lyrics: 'My lyrics' });
  updateOverrides('track0-1', { artist: 'Featured Artist' });
  assert.equal(S.tracks.get('track0-1').lyrics, 'My lyrics');
  assert.equal(S.tracks.get('track0-1').artist, 'Featured Artist');
  assert.equal(S.tracks.get('track0-1').albumArtist, 'Album Artist 0');
});

// Gatefold 1.1.7: Most Played is based on cumulative listening time.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const temp = mkdtempSync(join(tmpdir(), 'gatefold-v117-'));
cpSync(resolve('src/renderer/js'), join(temp, 'js'), { recursive: true });
writeFileSync(join(temp, 'package.json'), '{"type":"module"}');
globalThis.window = { addEventListener() {}, gf: { saveUser: async () => {} } };
const store = await import(pathToFileURL(join(temp, 'js/store.js')));
const explore = await import(pathToFileURL(join(temp, 'js/views/explore.js')));
const { S, setLibrary } = store;
test.after(() => rmSync(temp, { recursive: true, force: true }));

function song(id, albumKey, albumArtist, duration, n) {
  return {
    id, albumKey, albumTitle: albumKey, albumArtist, artist: albumArtist,
    title: id, path: '/music/' + id + '.mp3', track: 1, discN: 1,
    duration, n, addedAt: Date.now(), year: 2020, genre: 'Rock',
  };
}
function setup(tracks) {
  S.user = {
    settings: { forgottenDays: 60 }, overrides: {}, albumArt: {},
    artistImages: {}, playlists: [], stats: {
      tracks: Object.fromEntries(tracks.map(t => [
        t.id, { n: t.n, last: t.n ? Date.now() : 0 },
      ])), playlists: {},
    },
  };
  const albums = Object.fromEntries(tracks.map(t => [t.albumKey, { art: null, dirs: [] }]));
  setLibrary({ tracks, albums });
  S.ui.exploreNewPanel = 'new';
  S.ui.randomFilter = '';
}

test('Most Played ranks by duration multiplied by individual song plays, not raw play counts', () => {
  setup([
    song('short', 'Many short listens', 'Fast Artist', 30, 20),
    song('long', 'Fewer long listens', 'Slow Artist', 300, 4),
    song('part1', 'Multiple songs', 'Mixed Artist', 180, 3),
    song('part2', 'Multiple songs', 'Mixed Artist', 300, 2),
    song('never', 'Never played', 'Unplayed Artist', 500, 0),
    song('unknown', 'Unknown length', 'Unknown Artist', 0, 8),
  ]);
  const d = explore.exploreData();
  assert.deepEqual(d.top.map(x => x.a.title), [
    'Fewer long listens', 'Multiple songs', 'Many short listens',
  ]);
  assert.deepEqual(d.top.map(x => x.listenedSeconds), [1200, 1140, 600]);
  assert.equal(explore.albumListeningSeconds(S.albums.get('Multiple songs')), 1140);
  // Top Artists is still ranked by play counts, not listening time.
  assert.equal(d.topArtists[0].artist.name, 'Fast Artist');
  assert.equal(d.topArtists[0].n, 20);
  assert.equal(d.topArtists[1].artist.name, 'Unknown Artist');
  assert.equal(d.topArtists[1].n, 8);
});

test('Most Played displays rounded minutes, and keeps the fifty-album limit', () => {
  setup([
    song('short', 'Short record', 'Artist One', 60, 1),
    song('long', 'Long record', 'Artist Two', 121, 3),
  ]);
  const el = { innerHTML: '', querySelector: () => null };
  explore.renderExplore(el);
  const panel = el.innerHTML.match(/<section class="xcol" data-col="top">([\s\S]*?)<\/section>/)?.[1];
  assert.ok(panel);
  assert.match(panel, /Top 50 by minutes listened/);
  assert.match(panel, /#1 · 6 min played/);
  assert.match(panel, /#2 · 1 min played/);
  assert.doesNotMatch(panel, /#1 · 3 plays/);

  setup(Array.from({ length: 60 }, (_, i) =>
    song('song' + i, 'Album ' + i, 'Artist ' + i, 120, 60 - i)));
  const top = explore.exploreData().top;
  assert.equal(top.length, 50);
  assert.equal(top[0].a.key, 'Album 0');
  assert.equal(top[49].a.key, 'Album 49');
});

test('Listening time handles empty/missing durations and leaves other Explore lists alone', () => {
  setup([
    song('missing', 'No duration', 'One', undefined, 4),
    song('invalid', 'Negative length', 'Two', -42, 10),
    song('valid', 'Valid', 'Three', 75, 2),
  ]);
  const d = explore.exploreData();
  assert.deepEqual(d.top.map(x => x.a.key), ['Valid']);
  assert.equal(d.top[0].listenedSeconds, 150);
  assert.equal(d.fresh.length, 3);
  assert.equal(d.never.length, 0);
  assert.ok(d.topArtists.some(x => x.artist.name === 'Two' && x.n === 10));
});

test('Windows installer, lockfile and export metadata use version 1.1.7', () => {
  const read = p => readFileSync(resolve(p), 'utf8');
  const pkg = JSON.parse(read('package.json'));
  const lock = JSON.parse(read('package-lock.json'));
  assert.equal(pkg.version, '1.1.7');
  assert.equal(lock.version, '1.1.7');
  assert.equal(lock.packages[''].version, '1.1.7');
  assert.match(read('BUILD_WINDOWS_INSTALLER.cmd'), /Gatefold-Setup-1\.1\.7\.exe/);
  assert.match(read('scripts/Build-Windows.ps1'), /Gatefold-Setup-1\.1\.7\.exe/);
  assert.match(read('src/renderer/js/transfer.js'), /appVersion: '1\.1\.7'/);
});

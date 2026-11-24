// Gatefold 1.1.8: dynamic rankings, saved playlist order, song column migration and artist rail.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const temp = mkdtempSync(join(tmpdir(), 'gatefold-v118-'));
cpSync(resolve('src/renderer/js'), join(temp, 'js'), { recursive: true });
writeFileSync(join(temp, 'package.json'), '{"type":"module"}');
globalThis.window = { addEventListener() {}, gf: { saveUser: async () => {} } };
const store = await import(pathToFileURL(join(temp, 'js/store.js')));
const explore = await import(pathToFileURL(join(temp, 'js/views/explore.js')));
const playlists = await import(pathToFileURL(join(temp, 'js/views/playlists.js')));
const album = await import(pathToFileURL(join(temp, 'js/views/album.js')));
const { S, setLibrary, migrateLastPlayedColumn } = store;
const read = (path) => readFileSync(resolve(path), 'utf8');
test.after(() => rmSync(temp, { recursive: true, force: true }));

function track(id, albumKey, albumArtist, seconds, plays) {
  return { id, albumKey, albumTitle: albumKey, albumArtist, artist: albumArtist,
    path: '/music/' + id + '.mp3', title: id, duration: seconds, track: 1,
    discN: 1, year: 2024, genre: 'Rock', addedAt: Date.now(), plays };
}
function seed(tracks, settings = {}) {
  S.user = { settings: { forgottenDays: 60, ...settings }, albumArt: {}, artistImages: {},
    overrides: {}, alternateAlbumArt: {}, playlists: [],
    stats: { tracks: Object.fromEntries(tracks.map(t => [
      t.id, { n: t.plays, last: Date.now() - 3600000 },
    ])), playlists: {} } };
  const albums = Object.fromEntries(tracks.map(t => [t.albumKey, { art: null, dirs: [] }]));
  setLibrary({ tracks, albums });
  S.ui.exploreNewPanel = 'artists';
  S.ui.randomFilter = '';
}
const songs = [
  track('one', 'Album One', 'Alpha; Beta', 240, 6),
  track('two', 'Album Two', 'Alpha', 40, 10),
  track('three', 'Album Three', 'Gamma', 360, 3),
  track('four', 'Album Four', 'Delta', 80, 1),
  track('five', 'Album Five', 'Epsilon', 10, 1),
];

test('Most Played and Top Artists have independent editable limits with 50/25 defaults', () => {
  seed(songs);
  let d = explore.exploreData();
  assert.equal(d.top.length, 5);
  assert.equal(d.topArtists.length, 5);
  assert.equal(explore.exploreLimit(undefined, 50, 500), 50);
  assert.equal(explore.exploreLimit(undefined, 25, 250), 25);
  assert.equal(explore.exploreLimit(999, 50, 500), 500);
  assert.equal(explore.exploreLimit(-5, 25, 250), 25);
  S.user.settings.mostPlayedLimit = 2;
  S.user.settings.topArtistsLimit = 3;
  d = explore.exploreData();
  assert.equal(d.top.length, 2);
  assert.equal(d.topArtists.length, 3);
  S.user.settings.mostPlayedLimit = 4;
  S.user.settings.topArtistsLimit = 1;
  d = explore.exploreData();
  assert.equal(d.top.length, 4);
  assert.equal(d.topArtists.length, 1);
});

test('Top Artists ranks by seconds listened rather than raw play counts, including co-credits', () => {
  seed(songs);
  const artists = explore.exploreData().topArtists;
  assert.deepEqual(artists.map(x => [x.artist.name, x.listenedSeconds]), [
    ['Alpha', 1840], ['Beta', 1440], ['Gamma', 1080], ['Delta', 80], ['Epsilon', 10],
  ]);
  assert.equal(artists[0].artist.albums.length, 2);
  const panel = { innerHTML: '', querySelector: () => null };
  explore.renderExplore(panel);
  assert.match(panel.innerHTML, /Top by minutes listened/);
  assert.match(panel.innerHTML, /Top most played Album Artists/);
  assert.match(panel.innerHTML, /#1 · 31 min played/);
  assert.match(panel.innerHTML, /data-act="artist" data-name="Alpha"/);
});

test('Song table migration adds Last Played after Plays, before Genre, once', () => {
  const settings = { songColumns: ['title','album','plays','genre','year'] };
  assert.equal(migrateLastPlayedColumn(settings), true);
  assert.deepEqual(settings.songColumns, ['title','album','plays','lastPlayed','genre','year']);
  assert.equal(migrateLastPlayedColumn(settings), false);
  settings.songColumns.splice(settings.songColumns.indexOf('lastPlayed'), 1);
  assert.equal(migrateLastPlayedColumn(settings), false, 'User can hide it later');
  assert.ok(!settings.songColumns.includes('lastPlayed'));
  assert.ok(store.SONG_COLUMNS.indexOf('plays') < store.SONG_COLUMNS.indexOf('lastPlayed'));
  assert.ok(store.SONG_COLUMNS.indexOf('lastPlayed') < store.SONG_COLUMNS.indexOf('genre'));
  const src = read('src/renderer/js/views/songs.js');
  assert.match(src, /lastPlayed: \{ label: 'Last Played'/);
  assert.match(src, /fmtDate\(trackStats\(t.id\).last\)/);
});

test('Settings exposes both ranking limits and stores changes', () => {
  const ui = read('src/renderer/js/ui.js');
  assert.match(ui, /data-most-played-limit/);
  assert.match(ui, /data-top-artists-limit/);
  assert.match(ui, /'mostPlayedLimit', 50, 500/);
  assert.match(ui, /'topArtistsLimit', 25, 250/);
  assert.match(ui, /saveUser\(\);\s*emit\('settings'\)/);
});

test('Playlist sidebar reorder is saved, keeps every playlist identity, and does not change songs', () => {
  const list = [
    { id: 'a', tracks: ['a1'] }, { id: 'b', tracks: ['b1','b2'] },
    { id: 'c', tracks: ['c1'] }, { id: 'd', tracks: [] },
  ];
  assert.equal(playlists.movePlaylistInList(list, 'd', 'b', false), true);
  assert.deepEqual(list.map(p => p.id), ['a','d','b','c']);
  assert.equal(playlists.movePlaylistInList(list, 'a', 'c', true), true);
  assert.deepEqual(list.map(p => p.id), ['d','b','c','a']);
  assert.equal(playlists.movePlaylistInList(list, 'b', 'd', true), false);
  assert.deepEqual(list.find(p => p.id === 'b').tracks, ['b1','b2']);
  assert.equal(playlists.movePlaylistInList(list, 'a', 'nonexistent'), false);
  const src = read('src/renderer/js/views/playlists.js');
  assert.match(src, /playlist-sidebar-row/);
  assert.match(src, /draggable="true"/);
  assert.match(src, /data-pl-step="-1"/);
  assert.match(src, /data-pl-step="1"/);
  assert.match(src, /row.addEventListener\('drop'/);
  assert.match(src, /saveUser\(\); emit\('playlists'\)/);
});

test('Artists album detail uses the right-side clickable Album Artist strip, not the X', () => {
  seed(songs);
  S.ui.artist = 'Alpha';
  const page = album.albumDetail(S.albums.get('Album One'), { artistsLayout: true });
  assert.doesNotMatch(page, /class="close-x" data-act="close-album"/);
  const ordinary = album.albumDetail(S.albums.get('Album One'));
  assert.match(ordinary, /class="close-x" data-act="close-album"/);
  const artistsSource = read('src/renderer/js/views/artists.js');
  assert.match(artistsSource, /class="artist-return-rail"/);
  assert.match(artistsSource, /data-act="artist" data-name="\$\{esc\(backArtist\)\}"/);
  assert.match(artistsSource, /albumArtistNames\(a.artist\)\[0\]/);
  const css = read('src/renderer/styles.css');
  assert.match(css, /#page-artists \.artist-album-shell\s*\{[^}]*display: flex/);
  assert.match(css, /#page-artists \.artist-return-rail\s*\{[^}]*height: 100%/);
});

test('Version and Windows setup are 1.1.9, Android PWA remains read-only', () => {
  assert.equal(JSON.parse(read('package.json')).version, '1.1.9');
  const lock = JSON.parse(read('package-lock.json'));
  assert.equal(lock.version, '1.1.9');
  assert.equal(lock.packages[''].version, '1.1.9');
  assert.match(read('BUILD_WINDOWS_INSTALLER.cmd'), /Gatefold-Setup-1\.1\.9\.exe/);
  assert.match(read('scripts/Build-Windows.ps1'), /Gatefold-Setup-1\.1\.9\.exe/);
  assert.match(read('src/renderer/js/transfer.js'), /appVersion: '1\.1\.9'/);
  assert.doesNotMatch(read('pwa/index.html'), /album-props|song-props/);
});

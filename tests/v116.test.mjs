// Gatefold 1.1.6 — Explore rankings, album-artist co-credits and panel switch.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const temp = mkdtempSync(join(tmpdir(), 'gatefold-v116-'));
cpSync(resolve('src/renderer/js'), join(temp, 'js'), { recursive: true });
writeFileSync(join(temp, 'package.json'), '{"type":"module"}');
globalThis.window = { addEventListener() {}, gf: { saveUser: async () => {} } };
const { S, setLibrary } = await import(pathToFileURL(join(temp, 'js/store.js')));
const explore = await import(pathToFileURL(join(temp, 'js/views/explore.js')));
test.after(() => rmSync(temp, { recursive: true, force: true }));

function song(id, albumKey, albumArtist, plays, addedAt = Date.now()) {
  return {
    id, albumKey, albumTitle: albumKey, albumArtist, artist: 'Singer ' + id,
    title: id, track: 1, discN: 1, duration: 180, path: '/music/' + id + '.mp3',
    addedAt, plays, genre: 'Rock', year: 2022,
  };
}
function seed(tracks) {
  S.user = {
    settings: { forgottenDays: 60 }, overrides: {}, albumArt: {}, artistImages: {},
    stats: { tracks: Object.fromEntries(tracks.map(t => [t.id, { n: t.plays, last: Date.now() }])), playlists: {} },
    playlists: [],
  };
  const albums = Object.fromEntries(tracks.map(t => [t.albumKey, { art: null, dirs: [] }]));
  setLibrary({ tracks, albums });
  S.ui.exploreNewPanel = 'new';
  S.ui.randomFilter = '';
}

test('Top Artists sums full credited album plays, including semicolon-separated co-artists', () => {
  seed([
    song('joint', 'Joint Album', 'Alpha; Beta', 10),
    song('solo-a', 'Alpha Solo', 'Alpha', 5),
    song('solo-b', 'Beta Solo', 'Beta', 2),
    song('solo-g', 'Gamma Solo', 'Gamma', 8),
    song('unplayed', 'Unplayed Album', 'Delta', 0),
  ]);
  const artists = explore.exploreData().topArtists;
  assert.deepEqual(artists.map(x => [x.artist.name, x.n]), [
    ['Alpha', 15], ['Beta', 12], ['Gamma', 8],
  ]);
  assert.equal(artists[0].artist.albums.length, 2);
  assert.equal(artists[1].artist.albums.length, 2);
  assert.equal(artists.some(x => x.artist.name === 'Delta'), false);
});

test('Top Artists includes at most 25, sorted by number of plays', () => {
  seed(Array.from({ length: 30 }, (_, i) => song(
    'song-' + i, 'Album ' + i, 'Artist ' + i, 30 - i
  )));
  const artists = explore.exploreData().topArtists;
  assert.equal(artists.length, 25);
  assert.equal(artists[0].artist.name, 'Artist 0');
  assert.equal(artists[24].artist.name, 'Artist 24');
  assert.ok(artists.every((x, i) => i === 0 || x.n <= artists[i - 1].n));
});

test('Newly Added is the default and switches to clickable Top Artists, then back', () => {
  seed([
    song('joint', 'Joint Album', 'Alpha; Beta', 10, Date.now() - 86400000),
    song('solo-a', 'Alpha Solo', 'Alpha', 5, Date.now()),
  ]);
  const el = { innerHTML: '', querySelector: () => null };
  const secondPanel = () => el.innerHTML.match(/<section class="xcol" data-col="new">([\s\S]*?)<\/section>/)?.[1];
  explore.renderExplore(el);
  let panel = secondPanel();
  assert.ok(panel);
  assert.match(panel, /<h2>Newly Added<\/h2>/);
  assert.match(panel, /Added/);
  assert.match(panel, /data-act="open-album"/);
  assert.match(panel, /data-act="explore-new-panel" data-v="new" class="on" aria-pressed="true"/);
  S.ui.exploreNewPanel = 'artists';
  explore.renderExplore(el);
  panel = secondPanel();
  assert.match(panel, /<h2>Top Artists<\/h2>/);
  assert.match(panel, /25 most played Album Artists/);
  assert.match(panel, /data-act="artist" data-name="Alpha"/);
  assert.match(panel, /#1 · 15 plays/);
  assert.match(panel, /data-act="explore-new-panel" data-v="artists" class="on" aria-pressed="true"/);
  S.ui.exploreNewPanel = 'new';
  explore.renderExplore(el);
  assert.match(secondPanel(), /<h2>Newly Added<\/h2>/);
  assert.match(secondPanel(), /data-act="open-album"/);
});

test('Existing artist navigation and view-aware Quick Play are wired to the panel', () => {
  const app = readFileSync(resolve('src/renderer/js/app.js'), 'utf8');
  assert.match(app, /artist: \(d\) => openArtist\(d.name\)/);
  assert.match(app, /'explore-new-panel': \(d\) =>/);
  assert.match(app, /S.ui.exploreNewPanel = d.v === 'artists'/);
  assert.match(app, /d.topArtists\[0\]\?\.artist/);
  assert.match(app, /player.playList\(artistIds\(first.name\)/);
});

test('Most Played ranks at most 50 albums and labels the updated limit', () => {
  const src = readFileSync(resolve('src/renderer/js/views/explore.js'), 'utf8');
  assert.match(src, /\.slice\(0, 50\)/);
  assert.match(src, /Your top 50 albums/);
  assert.match(src, /\.slice\(0, 25\)/);
});

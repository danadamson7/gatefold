import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(new URL('../' + p, import.meta.url),'utf8');
const css = read('src/renderer/styles.css');
const album = read('src/renderer/js/views/album.js');
const ui = read('src/renderer/js/ui.js');
test('version 1.1.5 is configured for Windows packaging', () => {
  assert.equal(JSON.parse(read('package.json')).version, '1.1.5');
  assert.equal(JSON.parse(read('package-lock.json')).version, '1.1.5');
  assert.match(read('BUILD_WINDOWS_INSTALLER.cmd'), /Gatefold-Setup-1\.1\.5\.exe/);
});
test('alternate art is independent of regular album cover and supports selection/removal', () => {
  assert.match(read('src/renderer/js/store.js'), /alternateAlbumArt: \{\}/);
  assert.match(read('src/preload.cjs'), /pickAlternateAlbumArt/);
  assert.match(read('src/main.mjs'), /image:pick-alternate/);
  assert.match(read('src/main.mjs'), /croppedWidth = croppedHeight \* 2/);
  assert.match(ui, /data-alt-art/);
  assert.match(ui, /data-alt-reset/);
  assert.match(ui, /delete S\.user\.alternateAlbumArt\[key\]/);
});
test('selected Artist album centers main art above optional background and tracks', () => {
  assert.match(read('src/renderer/js/views/artists.js'), /artistsLayout: true/);
  assert.match(album, /av-art-top/);
  assert.match(album, /av-track-panel/);
  assert.match(album, /av-alt-backdrop/);
  assert.match(album, /artistsLayout \? S\.user\.alternateAlbumArt/);
});
test('Now Playing retains compact list and has wider panes without center vertical scroll', () => {
  assert.doesNotMatch(read('src/renderer/js/views/nowplaying.js'), /q-disc/);
  assert.match(css, /440px minmax\(0, 1fr\) 495px/);
  assert.match(css, /385px minmax\(0, 1fr\) 413px/);
  assert.match(css, /\.np-center\s*\{[^}]*overflow-y: hidden/);
});
test('Playlist and alternative artwork use the specified scaling and aspect ratio', () => {
  assert.match(css, /\.pl-art\s*\{[^}]*1101px/);
  assert.match(css, /#page-playlists \.side-item \.thumb\s*\{[^}]*69px/);
  assert.match(css, /\.ap-alt-preview\s*\{[^}]*aspect-ratio: 2 \/ 1/);
  assert.match(css, /\.av-alt-backdrop\s*\{[^}]*aspect-ratio: 2 \/ 1/);
});
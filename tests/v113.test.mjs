// Gatefold v1.1.3: independent playlist scrolling and album-canvas artwork.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const css = read('src/renderer/styles.css');
const album = read('src/renderer/js/views/album.js');
const playlist = read('src/renderer/js/views/playlists.js');

test('alternative art belongs to album canvas, not track panel', () => {
  assert.match(album, /const altBackground = alternate/);
  assert.match(album, /data-key="\$\{a.key\}">\s*\$\{altBackground\}\s*<button class="close-x"/);
  assert.match(album, /<div class="av-track-panel">\s*<div class="tracks">/);
  assert.doesNotMatch(album, /av-track-panel\$\{alternate|with-alt-art/);
  assert.match(css, /#page-artists \.artist-album-view\s*\{[^}]*position: relative; isolation: isolate/);
  assert.match(css, /#page-artists \.artist-album-view \.av-main\s*\{[^}]*position: relative; z-index: 1/);
  assert.match(css, /#page-artists \.artist-album-view \.av-alt-backdrop\s*\{[^}]*position: absolute; z-index: 0;[^}]*aspect-ratio: 2 \/ 1/);
});

test('playlist art is 98 percent of v1.1.2', () => {
  assert.equal(Math.round(1050 * .98), 1029);
  assert.equal(Math.round(175 * .98), 172);
  assert.match(css, /\.pl-art\s*\{[^}]*1029px/);
  assert.match(css, /#page-playlists \.side-item \.thumb\s*\{[^}]*172px; height: 172px/);
});

test('playlist information stays outside independently scrollable song table', () => {
  const cover = playlist.indexOf('class="pl-art"');
  const details = playlist.indexOf('class="pl-info"');
  const headerEnd = playlist.indexOf('</header>', details);
  const rows = playlist.indexOf('<section class="pl-tracks"', headerEnd);
  assert.ok(cover >= 0 && cover < details && details < headerEnd && headerEnd < rows);
  assert.match(css, /#page-playlists \.content\s*\{[^}]*overflow: hidden/);
  assert.match(css, /\.pl-view\s*\{[^}]*height: 100%;\s*min-height: 0;\s*overflow: hidden/);
  assert.match(css, /\.pl-tracks\s*\{[^}]*overflow-y: auto/);
  assert.match(css, /\.pl-tracks \.phead\s*\{[^}]*position: sticky; top: 0/);
  assert.match(playlist, /row\.addEventListener\('drop'/);
});

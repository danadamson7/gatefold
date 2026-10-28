// v1.1.1 verifies the playlist header/table layout and retained handlers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const js = readFileSync(resolve(root, 'src/renderer/js/views/playlists.js'), 'utf8');
const css = readFileSync(resolve(root, 'src/renderer/styles.css'), 'utf8');

test('playlist title, metadata and controls stay below artwork in left column', () => {
  const art = js.indexOf('class="pl-art"');
  const info = js.indexOf('class="pl-info"');
  const headEnd = js.indexOf('</header>', info);
  const tracks = js.indexOf('<section class="pl-tracks"', headEnd);
  assert.ok(art > 0 && art < info && info < headEnd && headEnd < tracks);
  for (const action of ['play-playlist', 'shuffle-playlist', 'rename-playlist', 'delete-playlist']) {
    const index = js.indexOf(`data-act="${action}"`);
    assert.ok(index > info && index < headEnd, `${action} must remain beneath artwork`);
  }
});

test('song table occupies right panel and reordering is retained', () => {
  assert.match(js, /<section class="pl-tracks"[\s\S]*?class="ptable"/);
  assert.match(js, /data-dbl="play-in-playlist"/);
  assert.match(js, /row\.addEventListener\('drop'/);
  assert.match(css, /\.pl-view\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*minmax\(0, min\(840px, 63.7%\)\) minmax\(0, 1fr\)/);
  assert.match(css, /@media \(max-width: 1450px\)\s*\{\s*\.pl-view\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\)/);
});

test('rendered playlist has left-side cover + controls and right-side interactive track rows', () => {
  const p = { id: 'road', name: 'Road Trip', tracks: ['t1'] };
  const S = {
    user: { playlists: [p] },
    ui: { playlist: 'road' },
    tracks: new Map([['t1', { id: 't1', title: 'First Song', artist: 'Sample Artist', albumTitle: 'Sample Album', duration: 180 }]]),
  };
  const el = { innerHTML: '', querySelectorAll: () => [] };
  const script = js.replace(/^import .*;\s*$/gm, '').replace(/^export function renderPlaylists/m, 'function renderPlaylists') + '\nrenderPlaylists(el);';
  runInNewContext(script, {
    S, el, playlist: (id) => S.user.playlists.find((x) => x.id === id),
    playlistArtHtml: () => '<div class="art">Preview</div>',
    saveUser: () => {}, esc: (s) => String(s), icon: () => '',
    fmtTime: (s) => '3:00', fmtHours: () => '3 min', emit: () => {},
  });
  assert.match(el.innerHTML, /<h1>Road Trip<\/h1>/);
  const coverAt = el.innerHTML.indexOf('class="pl-art"');
  const actionsAt = el.innerHTML.indexOf('class="head-actions"');
  const tableAt = el.innerHTML.indexOf('class="ptable"');
  assert.ok(coverAt >= 0 && coverAt < actionsAt && actionsAt < tableAt);
  assert.match(el.innerHTML, /data-dbl="play-in-playlist"/);
  assert.match(el.innerHTML, /First Song/);
});

// Test harness: GATEFOLD_SHOT=<dir> drives the UI offscreen, saves a screenshot per step, then quits.
// Steps come from GATEFOLD_STEPS (a JSON file of [name, js, waitMs]) or the default tour below.
import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const DEFAULT = [
  ['01-explore', 'await __gf.scan; __gf.go("explore")', 1200],
  ['02-artists-all', '__gf.openArtist("")', 900],
  ['03-artist', '__gf.openArtist([...__gf.S.artists.keys()].find(n => /vance|rush/i.test(n)) || [...__gf.S.artists.keys()][0])', 900],
  ['04-album', `{ const ar = __gf.S.artists.get(__gf.S.ui.artist); const a = ar.albums.find(a => a.discs > 1) || ar.albums[0]; __gf.openAlbum(a.key); }`, 1000],
  ['05-nowplaying', `{ const a = __gf.S.albums.get(__gf.S.ui.album); __gf.A['play-album']({ key: a.key }); __gf.go('nowplaying'); }`, 2500],
  ['06-playlists', `{ const ids = [...__gf.S.tracks.keys()].slice(0, 12); __gf.createPlaylist('Road Trip', ids); __gf.go('playlists'); }`, 900],
  ['07-songs', '__gf.go("songs")', 900],
  ['08-eq', '__gf.A.eq()', 500],
  ['09-search', `__gf.A.eq(); __gf.A.search(); { const i = document.querySelector('#search-panel input'); i.value = 'the'; i.dispatchEvent(new Event('input')); }`, 600],
  ['10-settings', `document.querySelector('#search-panel')?.remove(); __gf.A.settings()`, 700],
  ['11-properties', `document.querySelector('#settings')?.remove(); __gf.songProperties(__gf.player.current)`, 900],
];

export default async function shoot(win, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const wc = win.webContents;
  wc.on('console-message', (e) => console.log('[renderer]', e.message));
  wc.setFrameRate(30);
  const start = Date.now();
  while (!(await wc.executeJavaScript('!!window.__gf?.ready').catch(() => false))) {
    if (Date.now() - start > 30000) throw new Error('renderer never became ready');
    await delay(200);
  }
  const steps = process.env.GATEFOLD_STEPS ? JSON.parse(fs.readFileSync(process.env.GATEFOLD_STEPS, 'utf8')) : DEFAULT;
  for (const [name, js, wait = 600] of steps) {
    try {
      if (js) await wc.executeJavaScript(`(async () => { ${js} })()`);
    } catch (err) {
      console.log(`[step ${name}] failed: ${err.message}`);
    }
    await delay(wait);
    const img = await wc.capturePage();
    fs.writeFileSync(path.join(outDir, `${name}.png`), img.toPNG());
    console.log(`[shot] ${name}`);
  }
  const report = await wc.executeJavaScript(`JSON.stringify({ tracks: __gf.S.tracks.size, albums: __gf.S.albums.size, artists: __gf.S.artists.size,
    playing: __gf.player.track?.title, time: __gf.player.audio.currentTime, err: __gf.player.audio.error?.message || null })`);
  console.log('[report]', report);
  app.quit();
}

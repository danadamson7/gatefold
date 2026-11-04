// Gatefold 1.1.5: only the selected Artists main album cover scales down.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const css = read('src/renderer/styles.css');

test('Artists selected album main cover is 85% of v1.1.4 and remains top centered', () => {
  assert.equal(450 * 0.85, 382.5);
  assert.ok(Math.abs(36 * 0.85 - 30.6) < 1e-9);
  const match = css.match(/#page-artists \.artist-album-view \.av-art-top\s*\{([^}]+)\}/);
  assert.ok(match, 'Selected Artists album cover CSS must exist');
  assert.match(match[1], /width:\s*min\(382\.5px, 30\.6dvh, 85%\)/);
  assert.match(match[1], /margin:\s*0 auto 18px/);
  assert.doesNotMatch(match[1], /position:\s*(?:absolute|fixed)/);
});

test('All other cover placement, playlist, and Now Playing dimensions remain unchanged', () => {
  assert.match(css, /#page-artists \.artist-album-view \.av-alt-backdrop\s*\{[^}]*bottom:\s*0;[^}]*1760px/);
  assert.match(css, /#page-playlists \.side-item \.thumb\s*\{\s*width:\s*69px; height:\s*69px/);
  assert.match(css, /\.pl-art\s*\{\s*width:\s*min\(100%, 1101px/);
  assert.match(css, /\.np-art\s*\{\s*width:\s*min\(1014px/);
  assert.match(css, /\.pl-tracks\s*\{[^}]*overflow-y:\s*auto/);
});

test('Version 1.1.5 matches the package, lockfile, and Windows setup scripts', () => {
  const pkg = JSON.parse(read('package.json'));
  const lock = JSON.parse(read('package-lock.json'));
  assert.equal(pkg.version, '1.1.5');
  assert.equal(lock.version, '1.1.5');
  assert.equal(lock.packages[''].version, '1.1.5');
  assert.match(read('BUILD_WINDOWS_INSTALLER.cmd'), /Gatefold-Setup-1\.1\.5\.exe/);
  assert.match(read('scripts/Build-Windows.ps1'), /Gatefold-Setup-1\.1\.5\.exe/);
});

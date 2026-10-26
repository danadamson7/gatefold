// Regression coverage for v1.0.5 artwork dimensions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const styles = readFileSync(resolve(root, 'src/renderer/styles.css'), 'utf8');
function rule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = styles.match(new RegExp('(?:^|\\n)'+ escaped +'\\s*\\{([^}]+)\\}', 'm'));
  assert.ok(m, `Missing CSS rule: ${selector}`);
  return m[1];
}
test('version and Windows installer target are 1.0.5', () => {
  const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  const lock = JSON.parse(readFileSync(resolve(root, 'package-lock.json'), 'utf8'));
  const cmd = readFileSync(resolve(root, 'BUILD_WINDOWS_INSTALLER.cmd'), 'utf8');
  assert.equal(pkg.version, '1.0.5');
  assert.equal(lock.version, '1.0.5');
  assert.equal(lock.packages[''].version, '1.0.5');
  assert.match(cmd, /Gatefold-Setup-1\.0\.5\.exe/);
});
test('artist/now playing art unchanged and playlist cover 130% of v1.0.4', () => {
  assert.match(rule('.album-grid'), /315px/);                      // 210 * 1.5
  assert.match(rule('.grid-view.artist-selected .album-grid'), /390px/); // 260 * 1.5
  assert.match(rule('.av-side'), /450px, 42vw/);                 // 300 * 1.5; 28vw * 1.5
  assert.match(rule('#page-artists .side-item .thumb'), /57px; height: 57px/);
  assert.match(rule('.np-art'), /87vh, 100%, 930px/);           // 58vh * 1.5; 620px * 1.5
  assert.match(rule('.pl-art'), /width: min\(100%, 538px\)/); // 414 * 1.3, rounded
  assert.match(rule('#page-playlists .side-item .thumb'), /90px; height: 90px/);
});

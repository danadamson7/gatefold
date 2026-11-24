// Gatefold 1.1.9: Explore settings labels only; existing numeric controls stay wired.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const ui = read('src/renderer/js/ui.js');
const explore = read('src/renderer/js/views/explore.js');
const settingsMarkup = ui.split('<section><h3>Explore</h3>')[1]?.split('</section>')[0];

test('forgotten-listen text stays the same through days', () => {
  assert.ok(settingsMarkup);
  assert.match(settingsMarkup, /An album counts as a <b>forgotten listen<\/b> after <input[^>]*data-forgot[^>]*> days<\/label>/);
  assert.doesNotMatch(settingsMarkup, /without a play/);
});

test('two ranking labels have the requested shorter wording and existing input identifiers', () => {
  assert.match(settingsMarkup, /Albums most played \(<input[^>]*data-most-played-limit[^>]*>\)<\/label>/);
  assert.match(settingsMarkup, /Top Artists displayed \(<input[^>]*data-top-artists-limit[^>]*>\)<\/label>/);
  assert.doesNotMatch(settingsMarkup, /Show the top/);
  assert.doesNotMatch(settingsMarkup, /albums under <b>Most Played<\/b>/);
  assert.doesNotMatch(settingsMarkup, /Album Artists<\/b> under Top Artists/);
});

test('settings backend behavior, numeric bounds and analytics are retained', () => {
  assert.match(settingsMarkup, /min="7" max="3650" data-forgot/);
  assert.match(settingsMarkup, /min="1" max="500" step="1" data-most-played-limit/);
  assert.match(settingsMarkup, /min="1" max="250" step="1" data-top-artists-limit/);
  assert.match(ui, /s\.forgottenDays = Math\.max\(7, \+e\.target\.value \|\| 60\)/);
  assert.match(ui, /\['\[data-most-played-limit\]', 'mostPlayedLimit', 50, 500\]/);
  assert.match(ui, /\['\[data-top-artists-limit\]', 'topArtistsLimit', 25, 250\]/);
  assert.match(explore, /topArtistsLimit = exploreLimit\(S\.user\.settings\?\.topArtistsLimit, 25, 250\)/);
  assert.match(explore, /mostPlayedLimit = exploreLimit\(S\.user\.settings\?\.mostPlayedLimit, 50, 500\)/);
  assert.match(explore, /listenedSeconds: artist\.albums\.reduce/);
  assert.match(explore, /listenedSeconds: albumListeningSeconds\(x\.a\)/);
});

test('version and installer filenames are consistently 1.1.9', () => {
  const pkg = JSON.parse(read('package.json'));
  const lock = JSON.parse(read('package-lock.json'));
  assert.equal(pkg.version, '1.1.9');
  assert.equal(lock.version, '1.1.9');
  assert.equal(lock.packages[''].version, '1.1.9');
  assert.match(read('BUILD_WINDOWS_INSTALLER.cmd'), /Gatefold-Setup-1\.1\.9\.exe/);
  assert.match(read('scripts/Build-Windows.ps1'), /Gatefold-Setup-1\.1\.9\.exe/);
  assert.match(read('src/renderer/js/transfer.js'), /appVersion: '1\.1\.9'/);
});

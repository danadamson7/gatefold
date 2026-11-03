// Gatefold 1.1.4: visual layout and sizing expectations against v1.1.3.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const css = read('src/renderer/styles.css');
const album = read('src/renderer/js/views/album.js');
const rule = (selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('(?:^|\\n)' + escaped + '\\s*\\{([^}]+)\\}', 'g');
  return Array.from(css.matchAll(re), match => match[1]);
};

test('playlist main image increases to 107 percent of version 1.1.3', () => {
  const previous = 1029;
  const updated = Math.round(previous * 1.07);
  assert.equal(updated, 1101);
  const covers = rule('.pl-art');
  assert.ok(covers.length >= 2);
  assert.ok(covers.some(x => x.includes('width: min(100%, 1101px')));
  assert.match(css, /min\(1101px, 58\.85%\)/);
  assert.match(css, /27\.82dvh/);
  assert.match(css, /\* 1\.07/);
});

test('playlist sidebar thumbnails are 40 percent of v1.1.3 and scroll behavior retained', () => {
  assert.equal(Math.round(172 * .4), 69);
  const thumbnails = rule('#page-playlists .side-item .thumb');
  assert.ok(thumbnails.length >= 2);
  assert.ok(thumbnails.every(x => /69px; height: 69px/.test(x)));
  assert.match(css, /\.pl-tracks\s*\{[^}]*overflow-y: auto/);
});

test('alternative 2:1 backdrop is 1.6 times as large and bottom-centered', () => {
  assert.equal(Math.round(1100 * 1.6), 1760);
  const styles = rule('#page-artists .artist-album-view .av-alt-backdrop');
  assert.equal(styles.length, 1);
  assert.match(styles[0], /bottom:\s*0/);
  assert.match(styles[0], /left:\s*50%/);
  assert.match(styles[0], /translateX\(-50%\)/);
  assert.match(styles[0], /1760px/);
  assert.match(styles[0], /aspect-ratio:\s*2 \/ 1/);
  assert.doesNotMatch(styles[0], /top:\s*50%/);
  assert.match(album, /\$\{altBackground\}\s*<button class="close-x"/);
});

test('Now Playing center cover scales 109 percent without a vertical scrollbar', () => {
  assert.equal(Math.round(930 * 1.09), 1014);
  const covers = rule('.np-art');
  assert.ok(covers.some(s => /width:\s*min\(1014px/.test(s)));
  assert.ok(covers.some(s => /\* 1\.09/.test(s)));
  assert.match(css, /\.np-center\s*\{[^}]*overflow-y:\s*hidden/);
});

test('package and Windows installer version match Gatefold 1.1.4', () => {
  const pkg = JSON.parse(read('package.json'));
  const lock = JSON.parse(read('package-lock.json'));
  assert.equal(pkg.version, '1.1.4');
  assert.equal(lock.version, '1.1.4');
  assert.equal(lock.packages[''].version, '1.1.4');
  assert.match(read('BUILD_WINDOWS_INSTALLER.cmd'), /Gatefold-Setup-1\.1\.4\.exe/);
  assert.match(read('scripts/Build-Windows.ps1'), /Gatefold-Setup-1\.1\.4\.exe/);
});

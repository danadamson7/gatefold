import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { resolve } from 'node:path';

const css = readFileSync(resolve('src/renderer/styles.css'), 'utf8');
const nowPlaying = readFileSync(resolve('src/renderer/js/views/nowplaying.js'), 'utf8');
const store = readFileSync(resolve('src/renderer/js/store.js'), 'utf8');

function cssRule(selector) {
  const start = css.indexOf(selector + ' {');
  assert.ok(start !== -1, 'CSS rule not found: ' + selector);
  const end = css.indexOf('}', start);
  return css.slice(start, end);
}

test('Now Playing song list is compact, without disc subtitle headings', () => {
  const m = nowPlaying.match(/function queueHtml\(\)\s*\{[\s\S]*?\n\}/);
  assert.ok(m);
  assert.doesNotMatch(m[0], /q-disc|discSubtitle|discHeader/);
  const ctx = {
    S: { tracks: new Map([['a',{title:'First',artist:'One'}],['b',{title:'Second',artist:'Two'}]]) },
    player: { upcoming: ['a','b'], pos: 1 },
    esc: s => s, fmtTime: () => '3:00'
  };
  runInNewContext(m[0] + '\noutput=queueHtml();', ctx);
  assert.equal((ctx.output.match(/class="qrow/g) || []).length,2);
  assert.match(ctx.output,/class="qrow cur"/);
  assert.doesNotMatch(ctx.output,/q-disc/);
});

test('album art fills a black square without cropping or stretching', () => {
  for(const selector of ['.art', '.art.mosaic img', '.side-item .thumb', '.sr .thumb']) {
    assert.match(cssRule(selector), /object-fit:\s*contain/);
    assert.match(cssRule(selector), /background:\s*#000/);
  }
  assert.match(cssRule('.art'), /aspect-ratio:\s*1\s*\/\s*1/);
  assert.match(cssRule('.art'), /object-position:\s*center/);
  assert.match(store,/export function artHtml/);
  assert.doesNotMatch(css,/object-fit:\s*cover\s*;/);
});

test('playlist cover is 130 percent of 1.1.0 dimensions with responsive columns', () => {
  assert.match(cssRule('.pl-art'), /min\(100%, 840px\)/);
  assert.match(cssRule('#page-playlists .side-item .thumb'), /140px; height: 140px/);
  assert.match(cssRule('.pl-view'), /min\(840px, 63\.7%\)/);
  assert.match(css,/@media \(max-width: 1450px\)/);
});

// Album card (grid tile) and album detail panel, shared by Artists, Explore and Search.
import { S, artHtml, albumArt, trackStats } from '../store.js';
import { esc, fmtLength, fmtTime, fmtReleaseDate, tintOf } from '../util.js';
import { icon } from '../icons.js';

const same = (a, b) => a.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '') === b.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

export function albumMeta(a) {
  return [fmtReleaseDate(a), fmtLength(a.duration)].filter(Boolean).join(' · ');
}

export function albumCard(a, { showArtist = false, selected = false } = {}) {
  return `<div class="acard${selected ? ' sel' : ''}" data-act="open-album" data-key="${a.key}" data-ctx="album">
    <div class="art-wrap">${artHtml(a)}<button class="play-fab" data-act="play-album" data-key="${a.key}" title="Play album">${icon('play')}</button></div>
    <div class="at">${esc(a.title)}</div>
    ${showArtist ? `<div class="aa">${esc(a.artist)}</div>` : ''}
    <div class="am">${esc(albumMeta(a))}</div>
  </div>`;
}

export function albumDetail(a) {
  const discs = new Map();
  for (const t of a.tracks) {
    if (!discs.has(t.discN)) discs.set(t.discN, []);
    discs.get(t.discN).push(t);
  }
  const multi = discs.size > 1;
  let body = '';
  for (const [n, list] of discs) {
    const sub = list.find((t) => t.discSubtitle)?.discSubtitle;
    if (sub || multi) body += `<h3 class="disc">${esc(sub || `Disc ${n}`)}</h3>`;
    for (const t of list) {
      const other = !same(t.artist, a.artist) && !(sub && same(t.artist, sub));
      body += `<div class="trow" data-tid="${t.id}" data-key="${a.key}" data-dbl="play-in-album" data-ctx="track">
        <span class="n"><span class="num">${t.track || ''}</span><button class="rowplay" data-act="play-in-album" data-tid="${t.id}" data-key="${a.key}" title="Play">${icon('play')}</button></span>
        <span class="tt">${esc(t.title)}${other ? `<span class="ta">${esc(t.artist)}</span>` : ''}</span>
        <span class="d">${fmtTime(t.duration)}</span>
      </div>`;
    }
  }
  const plays = a.tracks.reduce((s, t) => s + trackStats(t.id).n, 0);
  return `<div class="album-view" data-key="${a.key}">
    <button class="close-x" data-act="close-album" title="Close (Esc)">${icon('close')}</button>
    <div class="av-side">
      <div class="av-art" data-ctx="album" data-key="${a.key}">${artHtml(a, 'big', false)}</div>
      <div class="av-facts">
        ${a.genre ? `<div>${esc(a.genre)}</div>` : ''}
        <div>${a.tracks.length} tracks${a.discs > 1 ? ` · ${a.discs} discs` : ''}</div>
        <div>${plays ? `${plays} plays` : 'Never played'}</div>
      </div>
    </div>
    <div class="av-main">
      <h1>${esc(a.title)} <button class="tri" data-act="play-album" data-key="${a.key}" title="Play album">${icon('play')}</button></h1>
      <div class="av-sub"><a data-act="artist" data-name="${esc(a.artist)}">${esc(a.artist)}</a>${a.year ? ` (${fmtReleaseDate(a)})` : ''} · ${fmtLength(a.duration)}</div>
      <div class="av-tools">
        <button class="chip" data-act="shuffle-album" data-key="${a.key}">${icon('shuffle')}Shuffle</button>
        <button class="chip" data-act="queue-album" data-key="${a.key}">${icon('queue')}Add to queue</button>
        <button class="chip" data-act="album-to-playlist" data-key="${a.key}">${icon('plus')}Add to playlist</button>
        <button class="chip" data-act="album-props" data-key="${a.key}">${icon('info')}Properties</button>
      </div>
      <div class="tracks">${body}</div>
    </div>
  </div>`;
}

// Tints the album panel from its cover, like the navy backdrop in the reference design.
export async function tintAlbum(el, a) {
  const hsl = await tintOf(albumArt(a));
  if (!hsl || !el.isConnected) return;
  const [h, s] = hsl;
  const sat = Math.min(s, 0.55) * 100;
  el.style.setProperty('--tint-a', `hsl(${h} ${sat}% 16%)`);
  el.style.setProperty('--tint-b', `hsl(${h} ${sat}% 6%)`);
}

export function albumByKey(key) {
  return S.albums.get(key);
}

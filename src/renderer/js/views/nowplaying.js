// NOW PLAYING: queue on the left, large cover in the centre, lyrics on the right.
import { S, artHtml, albumArt, trackStats } from '../store.js';
import { player } from '../player.js';
import { esc, fmtTime, albumArtistNames } from '../util.js';
import { icon } from '../icons.js';

let lyricsFor = null;
let lyrics = null;
let userScrolledAt = 0;

function queueHtml() {
  const ids = player.upcoming;
  if (!ids.length) return '<div class="empty">Nothing queued. Pick an album to get started.</div>';
  let previous = null;
  return ids.map((id, i) => {
    const t = S.tracks.get(id);
    if (!t) return '';
    const subtitle = S.albums.get(t.albumKey)?.tracks.find((song) => song.discN === t.discN && song.discSubtitle)?.discSubtitle || t.discSubtitle;
    const discHeader = subtitle && (previous?.albumKey !== t.albumKey || previous?.discN !== t.discN)
      ? `<div class="q-disc">${esc(subtitle)}</div>` : '';
    previous = t;
    return `${discHeader}<div class="qrow"${i === player.pos ? ' cur' : ''}${i < player.pos ? ' past' : ''}" data-act="jump" data-pos="${i}" data-tid="${id}" data-ctx="queue">
      <span class="qn">${i + 1}</span>
      <span class="qt"><span class="t">${esc(t.title)}</span><span class="a">${esc(t.artist)}</span></span>
      <span class="d">${fmtTime(t.duration)}</span>
    </div>`;
  }).join('');
}

export function renderNowPlaying(el) {
  const t = player.track;
  const a = t && S.albums.get(t.albumKey);
  const src = player.source?.label;
  const art = a ? albumArt(a, false) : null;
  const st = t ? trackStats(t.id) : null;
  el.innerHTML = `<div class="np">
    <aside class="np-queue">
      <div class="side-head"><h3>Song List</h3>${src ? `<span class="src" title="${esc(src)}">${esc(src)}</span>` : ''}</div>
      <div class="np-list">${queueHtml()}</div>
    </aside>
    <div class="np-center">
      ${art ? `<div class="np-bg" style="background-image:url('${esc(art)}')"></div>` : ''}
      ${t ? `<div class="np-art" data-act="open-album" data-key="${a.key}" data-ctx="album">${artHtml(a, 'big', false)}</div>
        <div class="np-title">${esc(t.title)}</div>
        <div class="np-artist"><a data-act="artist" data-name="${esc(albumArtistNames(a.artist)[0])}">${esc(t.artist)}</a></div>
        <div class="np-album"><a data-act="open-album" data-key="${a.key}">${esc(a.title)}</a>${a.year ? ` (${a.year || ''})` : ''}</div>
        <div class="np-meta">${[t.discOf > 1 || a.discs > 1 ? `Disc ${t.discN}` : '', t.track ? `Track ${t.track}${t.trackOf ? ` of ${t.trackOf}` : ''}` : '', t.genre, t.mood, `${st.n} play${st.n === 1 ? '' : 's'}`].filter(Boolean).map(esc).join(' · ')}</div>`
    : `<div class="np-empty">${icon('record', 'big-ic spin-slow')}<p>Nothing playing</p></div>`}
    </div>
    <aside class="np-lyrics">
      <div class="side-head"><h3>Lyrics</h3>${t ? `<button class="icon-btn sm" data-act="edit-lyrics" data-tid="${t.id}" title="Edit lyrics">${icon('edit')}</button>` : ''}</div>
      <div class="lyrics-body"></div>
    </aside>
  </div>`;
  el.querySelector('.np-list .cur')?.scrollIntoView({ block: 'center' });
  const body = el.querySelector('.lyrics-body');
  body.addEventListener('wheel', () => { userScrolledAt = Date.now(); }, { passive: true });
  loadLyrics(body, t);
}

async function loadLyrics(body, t) {
  if (!t) {
    body.innerHTML = '';
    return;
  }
  if (lyricsFor !== t.id) {
    lyricsFor = t.id;
    lyrics = null;
    const ov = S.user.overrides[t.id]?.lyrics;
    lyrics = ov != null ? { text: ov } : await window.gf.lyrics(t.id);
    if (lyricsFor !== t.id) return;
  }
  if (!body.isConnected) return;
  if (lyrics?.synced) {
    body.classList.add('synced');
    body.innerHTML = lyrics.synced.map(([ms, line]) => `<p data-ms="${ms}">${esc(line) || '&nbsp;'}</p>`).join('');
    syncLyrics();
  } else if (lyrics?.text) {
    body.classList.remove('synced');
    body.innerHTML = lyrics.text.split(/\r?\n/).map((l) => `<p>${esc(l) || '&nbsp;'}</p>`).join('');
  } else {
    body.classList.remove('synced');
    body.innerHTML = `<div class="empty">No lyrics for this song.<br><button class="btn ghost" data-act="edit-lyrics" data-tid="${t.id}">${icon('edit')}Add lyrics</button>
      <small>Gatefold also reads lyrics tags and .lrc files next to the song.</small></div>`;
  }
}

export function syncLyrics() {
  const body = document.querySelector('#page-nowplaying .lyrics-body.synced');
  if (!body) return;
  const ms = player.audio.currentTime * 1000;
  let cur = null;
  for (const p of body.children) {
    if (+p.dataset.ms <= ms + 150) cur = p;
    else break;
  }
  if (cur && !cur.classList.contains('on')) {
    body.querySelector('p.on')?.classList.remove('on');
    cur.classList.add('on');
    if (Date.now() - userScrolledAt > 4000) cur.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
}

export function invalidateLyrics() {
  lyricsFor = null;
}

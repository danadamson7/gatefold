// SONGS: every song in a sortable, virtualised table, filterable by artist.
import { S, SONG_COLUMNS, saveUser, trackStats } from '../store.js';
import { esc, fmtTime, fmtDate, sortKey } from '../util.js';
import { icon } from '../icons.js';

const ROW = 30;
export const COLS = {
  title: { label: 'Title', w: 'minmax(180px,2.2fr)', get: (t) => t.title },
  artist: { label: 'Artist', w: 'minmax(120px,1.4fr)', get: (t) => t.artist },
  albumArtist: { label: 'Album Artist', w: 'minmax(120px,1.4fr)', get: (t) => t.albumArtist },
  album: { label: 'Album', w: 'minmax(140px,1.6fr)', get: (t) => t.albumTitle },
  year: { label: 'Year', w: '58px', get: (t) => t.year || '', num: true },
  track: { label: 'Track', w: '62px', get: (t) => (t.track ? (t.trackOf ? `${t.track} of ${t.trackOf}` : t.track) : ''), sort: (t) => t.discN * 1000 + t.track, num: true },
  disc: { label: 'Disc', w: '62px', get: (t) => (t.discOf > 1 || t.discN > 1 ? (t.discOf ? `${t.discN} of ${t.discOf}` : t.discN) : ''), sort: (t) => t.discN, num: true },
  duration: { label: 'Length', w: '66px', get: (t) => fmtTime(t.duration), sort: (t) => t.duration, num: true },
  plays: { label: 'Plays', w: '58px', get: (t) => trackStats(t.id).n || '', sort: (t) => trackStats(t.id).n, num: true },
  genre: { label: 'Genre', w: 'minmax(80px,1fr)', get: (t) => t.genre },
  mood: { label: 'Mood', w: 'minmax(70px,.8fr)', get: (t) => t.mood },
  lastPlayed: { label: 'Last Played', w: '108px', get: (t) => fmtDate(trackStats(t.id).last), sort: (t) => trackStats(t.id).last, num: true },
  added: { label: 'Added', w: '108px', get: (t) => fmtDate(t.addedAt), sort: (t) => t.addedAt, num: true },
  format: { label: 'Format', w: '70px', get: (t) => t.path.split('.').pop().toUpperCase() },
};

let rows = [];
let filter = '';

function computeRows() {
  const name = S.ui.songsArtist;
  let list = name != null ? (S.trackArtists.get(name) || []).map((id) => S.tracks.get(id)) : [...S.tracks.values()];
  if (filter) {
    const q = filter.toLowerCase();
    list = list.filter((t) => `${t.title} ${t.artist} ${t.albumTitle} ${t.genre}`.toLowerCase().includes(q));
  }
  const { key, dir } = S.user.settings.songSort;
  const c = COLS[key] || COLS.title;
  const val = c.sort || c.get;
  const tie = (a, b) => sortKey(a.albumArtist).localeCompare(sortKey(b.albumArtist)) || (a.year - b.year) || a.albumTitle.localeCompare(b.albumTitle) || a.discN - b.discN || a.track - b.track;
  list.sort((a, b) => {
    const x = val(a);
    const y = val(b);
    const r = typeof x === 'number' && typeof y === 'number' ? x - y : sortKey(x).localeCompare(sortKey(y));
    return r * dir || tie(a, b);
  });
  rows = list;
}

const visibleCols = () => S.user.settings.songColumns.filter((k) => COLS[k]);
const template = () => `34px ${visibleCols().map((k) => COLS[k].w).join(' ')}`;

function sidebar() {
  const cur = S.ui.songsArtist;
  const names = [...S.trackArtists.keys()].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  return `<aside class="sidebar">
    <div class="side-head"><h3>Artists</h3></div>
    <div class="side-list">
      <div class="side-item all${cur == null ? ' on' : ''}" data-act="songs-artist" data-name="">${icon('note', 'thumb')}<span class="name">All Artists</span><span class="count">${S.tracks.size}</span></div>
      ${names.map((n) => `<div class="side-item compact${cur === n ? ' on' : ''}" data-act="songs-artist" data-name="${esc(n)}"><span class="name">${esc(n)}</span><span class="count">${S.trackArtists.get(n).length}</span></div>`).join('')}
    </div></aside>`;
}

function header() {
  const { key, dir } = S.user.settings.songSort;
  return `<div class="vt-head" style="grid-template-columns:${template()}"><span></span>${visibleCols().map((k) => `<span class="${COLS[k].num ? 'num' : ''}${k === key ? ' sorted' : ''}" data-act="song-sort" data-key="${k}">${COLS[k].label}${k === key ? (dir > 0 ? ' ▴' : ' ▾') : ''}</span>`).join('')}</div>`;
}

export function renderSongs(el) {
  if (S.ui.songsArtist != null && !S.trackArtists.has(S.ui.songsArtist)) S.ui.songsArtist = null;
  computeRows();
  const side = el.querySelector('.side-list')?.scrollTop || 0;
  el.innerHTML = `<div class="split">${sidebar()}<div class="content songs">
    <div class="songs-bar">
      <h1>${esc(S.ui.songsArtist ?? 'All Songs')}</h1><span class="muted" id="song-count">${rows.length} songs</span>
      <div class="spacer"></div>
      <input class="filter" id="song-filter" placeholder="Filter songs…" value="${esc(filter)}">
      <button class="chip" data-act="song-columns">${icon('columns')}Columns</button>
    </div>
    ${header()}
    <div class="vt-scroll"><div class="vt-spacer"></div><div class="vt-rows"></div></div>
  </div></div>`;
  el.querySelector('.side-list').scrollTop = side;
  const scroller = el.querySelector('.vt-scroll');
  let raf = 0;
  scroller.addEventListener('scroll', () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => paintRows(el));
  });
  const input = el.querySelector('#song-filter');
  input.addEventListener('input', () => {
    filter = input.value;
    computeRows();
    el.querySelector('#song-count').textContent = `${rows.length} songs`;
    scroller.scrollTop = 0;
    paintRows(el);
  });
  paintRows(el);
}

export function paintRows(el = document.getElementById('page-songs')) {
  const scroller = el.querySelector('.vt-scroll');
  if (!scroller) return;
  el.querySelector('.vt-spacer').style.height = `${rows.length * ROW}px`;
  const first = Math.max(0, Math.floor(scroller.scrollTop / ROW) - 8);
  const last = Math.min(rows.length, first + Math.ceil(scroller.clientHeight / ROW) + 16);
  const cols = visibleCols();
  const tpl = template();
  let out = '';
  for (let i = first; i < last; i++) {
    const t = rows[i];
    out += `<div class="vt-row${i % 2 ? ' odd' : ''}" style="top:${i * ROW}px;grid-template-columns:${tpl}" data-tid="${t.id}" data-idx="${i}" data-dbl="play-in-songs" data-ctx="track">
      <span class="n"><button class="rowplay" data-act="play-in-songs" data-idx="${i}">${icon('play')}</button></span>
      ${cols.map((k) => `<span class="${COLS[k].num ? 'num' : ''}">${esc(COLS[k].get(t))}</span>`).join('')}</div>`;
  }
  el.querySelector('.vt-rows').innerHTML = out;
  document.dispatchEvent(new Event('gf:painted'));
}

export const songRows = () => rows;

export function setSongSort(key) {
  const s = S.user.settings.songSort;
  if (s.key === key) s.dir = -s.dir;
  else S.user.settings.songSort = { key, dir: COLS[key].num ? -1 : 1 };
  saveUser();
}

export function toggleColumn(key) {
  const cols = S.user.settings.songColumns;
  const i = cols.indexOf(key);
  if (i >= 0) {
    if (key !== 'title') cols.splice(i, 1);
  } else {
    cols.push(key);
    cols.sort((a, b) => SONG_COLUMNS.indexOf(a) - SONG_COLUMNS.indexOf(b));
  }
  saveUser();
}

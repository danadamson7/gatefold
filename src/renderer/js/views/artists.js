// ARTISTS: album-artist sidebar + album grid / album detail.
import { S, artistImage, byYear, placeholder } from '../store.js';
import { esc, fmtHours, sortKey } from '../util.js';
import { icon } from '../icons.js';
import { albumCard, albumDetail, tintAlbum } from './album.js';

export function sortedArtists() {
  const list = [...S.artists.values()];
  if (S.user.settings.artistSort === 'count') {
    return list.sort((a, b) => b.albums.length - a.albums.length || b.trackCount - a.trackCount || sortKey(a.name).localeCompare(sortKey(b.name)));
  }
  return list.sort((a, b) => sortKey(a.name).localeCompare(sortKey(b.name)));
}

function sidebar() {
  const sort = S.user.settings.artistSort;
  const cur = S.ui.artist;
  const rows = sortedArtists().map((ar) => {
    const img = artistImage(ar.name);
    return `<div class="side-item${cur === ar.name ? ' on' : ''}" data-act="artist" data-name="${esc(ar.name)}" data-ctx="artist">
      ${img ? `<img class="thumb" src="${esc(img)}" loading="lazy" alt="">` : placeholder(ar.name, 'thumb')}
      <span class="name">${esc(ar.name)}</span><span class="count">${ar.albums.length}</span>
    </div>`;
  }).join('');
  return `<aside class="sidebar">
    <div class="side-head"><h3>Album Artists</h3>
      <div class="seg" title="Sort artists">
        <button class="${sort === 'alpha' ? 'on' : ''}" data-act="artist-sort" data-v="alpha">A–Z</button>
        <button class="${sort === 'count' ? 'on' : ''}" data-act="artist-sort" data-v="count">Count</button>
      </div></div>
    <div class="side-list">
      <div class="side-item all${cur == null ? ' on' : ''}" data-act="artist" data-name="">${icon('clef', 'thumb')}<span class="name">All Artists</span><span class="count">${S.albums.size}</span></div>
      ${rows}
    </div>
  </aside>`;
}

function grid() {
  const name = S.ui.artist;
  const ar = name != null ? S.artists.get(name) : null;
  const albums = ar ? ar.albums : [...S.albumList].sort(byYear);
  const title = ar ? ar.name : 'All Artists';
  const sub = ar
    ? `${ar.albums.length} album${ar.albums.length === 1 ? '' : 's'} · ${ar.trackCount} songs · ${fmtHours(ar.duration)}`
    : `${S.albums.size} albums · ${S.artists.size} artists · in chronological order`;
  return `<div class="grid-view">
    <header class="center-head">
      <h1>${esc(title)}</h1><p>${esc(sub)}</p>
      <div class="head-actions">
        <button class="chip" data-act="play-artist" data-name="${esc(name ?? '')}">${icon('play')}Play</button>
        <button class="chip" data-act="shuffle-artist" data-name="${esc(name ?? '')}">${icon('shuffle')}Shuffle</button>
      </div>
    </header>
    <div class="album-grid">${albums.map((a) => albumCard(a, { showArtist: !ar, selected: a.key === S.ui.lastAlbum })).join('')}</div>
  </div>`;
}

export function renderArtists(el) {
  if (S.ui.artist != null && !S.artists.has(S.ui.artist)) S.ui.artist = null;
  const prevList = el.querySelector('.side-list');
  const sideScroll = prevList?.scrollTop || 0;
  const a = S.ui.album && S.albums.get(S.ui.album);
  el.innerHTML = `<div class="split">${sidebar()}<div class="content" id="artists-content">${a ? albumDetail(a) : grid()}</div></div>`;
  el.querySelector('.side-list').scrollTop = sideScroll;
  if (a) tintAlbum(el.querySelector('.album-view'), a);
  else if (S.ui.gridScroll) el.querySelector('#artists-content').scrollTop = S.ui.gridScroll;
}

export function scrollArtistIntoView(el) {
  el.querySelector('.side-item.on')?.scrollIntoView({ block: 'center' });
}

// EXPLORE: five quick-play columns.
import { S, artHtml, albumStats, playlistArtHtml, trackStats } from '../store.js';
import { esc, fmtAgo, fmtDate, rng, shuffle, fmtTime } from '../util.js';
import { icon } from '../icons.js';
import { albumMeta } from './album.js';

let randomSeed = Date.now();
export const rerollRandom = () => { randomSeed = Date.now(); };

export function exploreData() {
  const albums = S.albumList;
  const withStats = albums.map((a) => ({ a, ...albumStats(a) }));
  const plTop = S.user.playlists
    .map((p) => ({ p, ...(S.user.stats.playlists[p.id] || { n: 0, last: 0 }) }))
    .filter((x) => x.n > 0);
  const top = [...withStats.filter((x) => x.n > 0), ...plTop].sort((x, y) => y.n - x.n).slice(0, 5);
  const fresh = [...albums].sort((x, y) => y.addedAt - x.addedAt).slice(0, 24);
  const cutoff = Date.now() - S.user.settings.forgottenDays * 86400000;
  const forgotten = withStats.filter((x) => x.n > 0 && x.last < cutoff).sort((x, y) => y.n - x.n || x.last - y.last).slice(0, 24);
  const day = Math.floor(Date.now() / 86400000);
  const never = shuffle(withStats.filter((x) => x.n === 0), rng(day)).slice(0, 24);
  const songs = shuffle([...S.tracks.keys()], rng(randomSeed)).slice(0, 14);
  return { top, fresh, forgotten, never, songs };
}

function albumRow(a, meta, hero = false) {
  return `<div class="xrow${hero ? ' hero' : ''}" data-act="open-album" data-key="${a.key}" data-ctx="album">
    <div class="art-wrap">${artHtml(a, '', !hero)}<button class="play-fab" data-act="play-album" data-key="${a.key}" title="Play">${icon('play')}</button></div>
    <div class="xtext"><div class="at">${esc(a.title)}</div><div class="aa">${esc(a.artist)}</div><div class="am">${esc(meta)}</div></div>
  </div>`;
}

function playlistRow(p, meta, hero = false) {
  return `<div class="xrow${hero ? ' hero' : ''}" data-act="open-playlist" data-id="${p.id}" data-ctx="playlist">
    <div class="art-wrap">${playlistArtHtml(p)}<button class="play-fab" data-act="play-playlist" data-id="${p.id}" title="Play">${icon('play')}</button></div>
    <div class="xtext"><div class="at">${esc(p.name)}</div><div class="aa">Playlist · ${p.tracks.length} songs</div><div class="am">${esc(meta)}</div></div>
  </div>`;
}

function column(id, ic, title, sub, items, empty) {
  return `<section class="xcol" data-col="${id}">
    <header>
      <div class="xhead">${icon(ic)}<div><h2>${title}</h2><p>${sub}</p></div></div>
      <button class="qp" data-act="quickplay" data-col="${id}" title="Quick play">${icon(id === 'random' ? 'dice' : 'play')}</button>
    </header>
    <div class="xlist">${items || `<div class="empty">${empty}</div>`}</div>
  </section>`;
}

export function renderExplore(el) {
  if (!S.tracks.size) {
    el.innerHTML = `<div class="welcome">
      <div class="welcome-card">${icon('record', 'big-ic')}<h1>Welcome to Gatefold</h1>
      <p>An album-first music player. Point it at your music folder to get started.</p>
      <button class="btn primary" data-act="add-folder">${icon('folder')}Choose music folder…</button></div></div>`;
    return;
  }
  const d = exploreData();
  const plays = (n) => `${n} play${n === 1 ? '' : 's'}`;
  const topItems = d.top.map((x, i) => (x.p ? playlistRow(x.p, plays(x.n), i === 0) : albumRow(x.a, plays(x.n), i === 0))).join('');
  const newItems = d.fresh.map((a, i) => albumRow(a, `Added ${fmtDate(a.addedAt)}`, i === 0)).join('');
  const forgotItems = d.forgotten.map((x, i) => albumRow(x.a, `${plays(x.n)} · last ${fmtAgo(x.last)}`, i === 0)).join('');
  const neverItems = d.never.map((x, i) => albumRow(x.a, albumMeta(x.a), i === 0)).join('');
  const songItems = d.songs.map((id) => {
    const t = S.tracks.get(id);
    const a = S.albums.get(t.albumKey);
    return `<div class="srow" data-tid="${id}" data-act="play-random-song" data-ctx="track">
      <div class="art-wrap">${artHtml(a)}<span class="play-fab small">${icon('play')}</span></div>
      <div class="xtext"><div class="st">${esc(t.title)}</div><div class="aa">${esc(t.artist)}</div><div class="am">${esc(t.albumTitle)} · ${fmtTime(t.duration)}${trackStats(id).n ? '' : ' · new'}</div></div>
    </div>`;
  }).join('');
  const randomCol = `<button class="dice-hero" data-act="quickplay" data-col="random">${icon('dice')}<span>Play a random song</span><small>then keep the surprises coming</small></button>
    ${songItems}<button class="btn ghost reroll" data-act="reroll">${icon('refresh')}Deal new songs</button>`;

  el.innerHTML = `<div class="explore">
    ${column('top', 'flame', 'Most Played', 'Your top albums & playlists', topItems, 'Albums and playlists you play most will rank here.')}
    ${column('new', 'sparkle', 'Newly Added', 'Fresh in the library', newItems, '')}
    ${column('forgotten', 'hourglass', 'Forgotten Listens', `Loved, but not for ${S.user.settings.forgottenDays}+ days`, forgotItems, `Albums you've played before but haven't heard in ${S.user.settings.forgottenDays} days show up here.`)}
    ${column('never', 'headphones', 'Never Played', 'Albums waiting for a first spin', neverItems, 'You have played every album. Impressive.')}
    ${column('random', 'dice', 'Random Song', 'Feeling lucky?', randomCol, '')}
  </div>`;
}

// EXPLORE: five quick-play columns.
import { S, artHtml, albumStats, artistImage, placeholder, playlistArtHtml, trackStats } from '../store.js';
import { esc, fmtAgo, fmtDate, rng, shuffle, fmtTime } from '../util.js';
import { icon } from '../icons.js';
import { albumMeta } from './album.js';

let randomSeed = Date.now();
export const randomChoices = () => [...new Map([...S.tracks.values()].flatMap((t) => [
  ...String(t.genre || '').split(/[,;/]/).map((v) => v.trim()).filter(Boolean).map((v) => `genre:${v}`),
  ...String(t.mood || '').split(/[,;/]/).map((v) => v.trim()).filter(Boolean).map((v) => `mood:${v}`),
]).map((v) => [v.toLocaleLowerCase(), v]))].map(([_, v]) => v).sort((a, b) => a.localeCompare(b));
export function randomSongIds() {
  const value = S.ui.randomFilter || '';
  if (!value) return [...S.tracks.keys()];
  const split = value.indexOf(':');
  const field = value.slice(0, split), term = value.slice(split + 1).toLocaleLowerCase();
  return [...S.tracks.values()].filter((t) => ['genre','mood'].includes(field) &&
    String(t[field] || '').split(/[,;/]/).some((v) => v.trim().toLocaleLowerCase() === term)).map((t) => t.id);
}

export const rerollRandom = () => { randomSeed = Date.now(); };

// Configurable Explore list sizes; legacy libraries default to the original 50/25 limits.
export const exploreLimit = (value, fallback, maximum) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 ? Math.min(maximum, Math.floor(n)) : fallback;
};

// Minutes listened are based on track durations and recorded play counts,
 // not on the number of times an album appears in the play history.
export function albumListeningSeconds(album) {
  return album.tracks.reduce((total, track) =>
    total + Math.max(0, Number(trackStats(track.id).n) || 0) *
      Math.max(0, Number(track.duration) || 0), 0);
}

export function exploreData() {
  const albums = S.albumList;
  const withStats = albums.map((a) => ({ a, ...albumStats(a) }));
  const mostPlayedLimit = exploreLimit(S.user.settings?.mostPlayedLimit, 50, 500);
  const topArtistsLimit = exploreLimit(S.user.settings?.topArtistsLimit, 25, 250);
  const withListeningTime = withStats.map((x) => ({ ...x, listenedSeconds: albumListeningSeconds(x.a) }));
  const top = withListeningTime.filter((x) => x.listenedSeconds > 0)
    .sort((x, y) => y.listenedSeconds - x.listenedSeconds ||
      x.a.title.localeCompare(y.a.title) || x.a.key.localeCompare(y.a.key))
    .slice(0, mostPlayedLimit);
  const secondsByAlbum = new Map(withListeningTime.map(({ a, listenedSeconds }) => [a.key, listenedSeconds]));
  // Every credited Album Artist receives that album's listened time; co-credit albums count once per artist.
  const topArtists = [...S.artists.values()]
    .map((artist) => ({
      artist,
      listenedSeconds: artist.albums.reduce((total, a) => total + (secondsByAlbum.get(a.key) || 0), 0),
    }))
    .filter(({ listenedSeconds }) => listenedSeconds > 0)
    .sort((x, y) => y.listenedSeconds - x.listenedSeconds || x.artist.name.localeCompare(y.artist.name))
    .slice(0, topArtistsLimit);
  const fresh = [...albums].sort((x, y) => y.addedAt - x.addedAt).slice(0, 24);
  const cutoff = Date.now() - S.user.settings.forgottenDays * 86400000;
  const forgotten = withStats.filter((x) => x.n > 0 && x.last < cutoff).sort((x, y) => y.n - x.n || x.last - y.last).slice(0, 24);
  const day = Math.floor(Date.now() / 86400000);
  const never = shuffle(withStats.filter((x) => x.n === 0), rng(day)).slice(0, 24);
  const songs = shuffle(randomSongIds(), rng(randomSeed)).slice(0, 14);
  return { top, topArtists, fresh, forgotten, never, songs };
}

function albumRow(a, meta, hero = false) {
  return `<div class="xrow${hero ? ' hero' : ''}" data-act="open-album" data-key="${a.key}" data-ctx="album">
    <div class="art-wrap">${artHtml(a, '', !hero)}<button class="play-fab" data-act="play-album" data-key="${a.key}" title="Play">${icon('play')}</button></div>
    <div class="xtext"><div class="at">${esc(a.title)}</div><div class="aa">${esc(a.artist)}</div><div class="am">${esc(meta)}</div></div>
  </div>`;
}

function artistRow({ artist, listenedSeconds }, index) {
  const img = artistImage(artist.name);
  const art = img
    ? `<img class="art" src="${esc(img)}" loading="lazy" decoding="async" alt="">`
    : placeholder(artist.name);
  return `<button type="button" class="xrow artist-xrow" data-act="artist" data-name="${esc(artist.name)}" data-ctx="artist" title="Open ${esc(artist.name)}">
    <div class="art-wrap">${art}</div>
    <div class="xtext"><div class="at">${esc(artist.name)}</div>
      <div class="aa">${artist.albums.length} album${artist.albums.length === 1 ? '' : 's'}</div>
      <div class="am">#${index + 1} · ${Math.round(listenedSeconds / 60)} min played</div>
    </div>
  </button>`;
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
      ${id === 'random' ? `<select class="random-filter" aria-label="Random song genre or mood" title="Limit random songs by genre or mood">
        <option value="">All songs</option>${randomChoices().map((v) => `<option value="${esc(v)}"${S.ui.randomFilter === v ? ' selected' : ''}>${esc(v.startsWith('genre:') ? 'Genre: ' + v.slice(6) : 'Mood: ' + v.slice(5))}</option>`).join('')}</select>`
        : `<button class="qp" data-act="quickplay" data-col="${id}" title="Quick play">${icon('play')}</button>`}
    </header>
    ${id === 'new' ? `<div class="xcol-switch" role="group" aria-label="Choose Explore panel">
      <button type="button" data-act="explore-new-panel" data-v="new" class="${S.ui.exploreNewPanel === 'artists' ? '' : 'on'}" aria-pressed="${S.ui.exploreNewPanel === 'artists' ? 'false' : 'true'}">Newly Added</button>
      <button type="button" data-act="explore-new-panel" data-v="artists" class="${S.ui.exploreNewPanel === 'artists' ? 'on' : ''}" aria-pressed="${S.ui.exploreNewPanel === 'artists' ? 'true' : 'false'}">Top Artists</button>
    </div>` : ''}
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
  const topItems = d.top.map((x, i) => albumRow(x.a, `#${i + 1} · ${Math.round(x.listenedSeconds / 60)} min played`, i === 0)).join('');
  const newItems = d.fresh.map((a, i) => albumRow(a, `Added ${fmtDate(a.addedAt)}`, i === 0)).join('');
  const artistItems = d.topArtists.map((item, i) => artistRow(item, i)).join('');
  const showTopArtists = S.ui.exploreNewPanel === 'artists';
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
    ${column('top', 'flame', 'Most Played', 'Top by minutes listened', topItems, 'Albums you play most will rank here.')}
    ${column('new', showTopArtists ? 'clef' : 'sparkle', showTopArtists ? 'Top Artists' : 'Newly Added', showTopArtists ? 'Top most played Album Artists' : 'Fresh in the library', showTopArtists ? artistItems : newItems, showTopArtists ? 'Play music to rank your Album Artists here.' : '')}
    ${column('forgotten', 'hourglass', 'Forgotten Listens', `Loved, but not for ${S.user.settings.forgottenDays}+ days`, forgotItems, `Albums you've played before but haven't heard in ${S.user.settings.forgottenDays} days show up here.`)}
    ${column('never', 'headphones', 'Never Played', 'Albums waiting for a first spin', neverItems, 'You have played every album. Impressive.')}
    ${column('random', 'dice', 'Random Song', 'Feeling lucky?', randomCol, '')}
  </div>`;
  el.querySelector('.random-filter')?.addEventListener('change', (e) => {
    S.ui.randomFilter = e.target.value;
    rerollRandom();
    renderExplore(el);
  });
}

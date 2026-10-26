import { S, loadUser, saveUser, setLibrary, playlist, createPlaylist, addToPlaylist, albumArt, artHtml, SONG_COLUMNS } from './store.js';
import { player } from './player.js';
import { $, $$, esc, fmtTime, on, emit, shuffle, albumArtistNames } from './util.js';
import { icon } from './icons.js';
import { renderExplore, exploreData, rerollRandom, randomSongIds } from './views/explore.js';
import { renderArtists, scrollArtistIntoView, sortedArtists } from './views/artists.js';
import { renderNowPlaying, syncLyrics, invalidateLyrics } from './views/nowplaying.js';
import { renderPlaylists } from './views/playlists.js';
import { renderSongs, paintRows, songRows, setSongSort, toggleColumn, COLS } from './views/songs.js';
import { toast, showMenu, menuAt, closeMenu, closeModal, promptBox, confirmBox, songProperties, albumProperties,
  changeAlbumArt, changeArtistImage, openSearch, closeSearch, openSettings, closeSettings, renderSettings, toggleEq, closeEq } from './ui.js';

window.addEventListener('error', (e) => console.error('renderer error:', e.message, e.filename, e.lineno));
window.addEventListener('unhandledrejection', (e) => console.error('unhandled rejection:', e.reason?.stack || e.reason));

const PAGES = ['explore', 'artists', 'nowplaying', 'playlists', 'songs'];
const RENDER = { explore: renderExplore, artists: renderArtists, nowplaying: renderNowPlaying, playlists: renderPlaylists, songs: renderSongs };
const pageEl = (p) => document.getElementById(`page-${p}`);

// ---------------- navigation ----------------
function go(page, { keepScroll = false } = {}) {
  S.ui.page = page;
  for (const p of PAGES) pageEl(p).classList.toggle('active', p === page);
  $$('#tabs .tab').forEach((t) => t.classList.toggle('active', t.dataset.page === page));
  render(page, keepScroll);
  S.user.lastPage = page;
  saveUser();
}

function render(page = S.ui.page, keepScroll = true) {
  const el = pageEl(page);
  const scroller = el.querySelector('.content, .explore');
  const top = keepScroll ? scroller?.scrollTop : 0;
  RENDER[page](el);
  if (keepScroll && top && page !== 'artists') {
    const s = el.querySelector('.content, .explore');
    if (s) s.scrollTop = top;
  }
  markPlaying();
}

function markPlaying() {
  const id = player.current;
  $$('.playing-row').forEach((r) => r.classList.remove('playing-row'));
  if (!id) return;
  $$(`[data-tid="${id}"]:not(.qrow)`).forEach((r) => r.classList.add('playing-row'));
}
document.addEventListener('gf:painted', markPlaying);

function saveGridScroll() {
  if (S.ui.page === 'artists' && !S.ui.album) S.ui.gridScroll = $('#artists-content')?.scrollTop || 0;
}

function openAlbum(key, trackId = null) {
  const a = S.albums.get(key);
  if (!a) return;
  saveGridScroll();
  const fromAll = S.ui.page === 'artists' && S.ui.artist == null;
  if (!fromAll && !albumArtistNames(a.artist).includes(S.ui.artist)) S.ui.artist = albumArtistNames(a.artist)[0];
  S.ui.album = key;
  S.ui.lastAlbum = key;
  go('artists');
  if (!fromAll) scrollArtistIntoView(pageEl('artists'));
  if (trackId) {
    const trackRow = [...pageEl('artists').querySelectorAll('.trow')].find((r) => r.dataset.tid === trackId);
    if (trackRow) {
      trackRow.classList.add('search-target');
      trackRow.scrollIntoView({ block: 'center' });
    }
  }
}

function openArtist(name) {
  S.ui.artist = name || null;
  S.ui.album = null;
  S.ui.gridScroll = 0;
  go('artists');
  scrollArtistIntoView(pageEl('artists'));
}

// ---------------- play helpers ----------------
const albumIds = (key) => S.albums.get(key)?.tracks.map((t) => t.id) || [];
const albumSource = (key) => ({ type: 'album', id: key, label: S.albums.get(key)?.title });
const artistIds = (name) => (name ? (S.artists.get(name)?.albums || []) : [...S.albumList]).flatMap((a) => a.tracks.map((t) => t.id));
const artistSource = (name) => ({ type: 'artist', id: name, label: name || 'All Artists' });
const playlistSource = (pl) => ({ type: 'playlist', id: pl.id, label: pl.name });

function playAlbum(key, tid) {
  const ids = albumIds(key);
  player.playList(ids, Math.max(0, ids.indexOf(tid)), albumSource(key));
}

function playPlaylist(id, start = 0, shuffled = false) {
  const pl = playlist(id);
  if (!pl?.tracks.length) return toast('That playlist is empty');
  if (shuffled) player.shuffleList(pl.tracks, playlistSource(pl));
  else player.playList(pl.tracks, start, playlistSource(pl));
}

function playRandomFrom(firstId) {
  const all = randomSongIds();
  if (!all.length) return toast('No songs match this genre or mood');
  const first = firstId || all[Math.floor(Math.random() * all.length)];
  player.playList([first, ...shuffle(all.filter((id) => id !== first))], 0, { type: 'random', label: S.ui.randomFilter || 'Random songs' });
}

function quickplay(col) {
  const d = exploreData();
  const pick = (list) => list[0];
  if (col === 'random') return playRandomFrom();
  if (col === 'top') {
    const x = pick(d.top);
    if (!x) return toast('Nothing played yet — try Never Played');
    return playAlbum(x.a.key);
  }
  if (col === 'new') return d.fresh[0] && playAlbum(d.fresh[0].key);
  if (col === 'forgotten') return d.forgotten[0] ? playAlbum(d.forgotten[0].a.key) : toast('No forgotten albums yet');
  if (col === 'never') {
    if (!d.never.length) return toast('Every album has been played');
    playAlbum(d.never[Math.floor(Math.random() * d.never.length)].a.key);
  }
}

// ---------------- playlist helpers ----------------
async function newPlaylist(ids = []) {
  const name = await promptBox('New playlist', `Playlist ${S.user.playlists.length + 1}`, 'Create');
  if (!name) return null;
  const pl = createPlaylist(name, ids);
  toast(ids.length ? `Added ${ids.length} song${ids.length > 1 ? 's' : ''} to “${name}”` : `Created “${name}”`);
  return pl;
}

function playlistSubmenu(getIds) {
  return [
    { label: 'New playlist…', icon: 'plus', act: () => newPlaylist(getIds()) },
    S.user.playlists.length ? { sep: true } : null,
    ...S.user.playlists.map((p) => ({
      label: p.name, icon: 'cassette',
      act: () => {
        const ids = getIds();
        addToPlaylist(p.id, ids);
        toast(`Added ${ids.length} song${ids.length > 1 ? 's' : ''} to “${p.name}”`);
      },
    })),
  ];
}

async function importM3u() {
  const found = await window.gf.findM3u(S.user.settings.folders);
  const names = new Set(S.user.playlists.map((p) => p.name));
  const fresh = found.filter((f) => !names.has(f.name));
  for (const f of fresh) createPlaylist(f.name, f.ids);
  toast(found.length ? `Imported ${fresh.length} playlist${fresh.length === 1 ? '' : 's'}${found.length > fresh.length ? ` (${found.length - fresh.length} already existed)` : ''}` : 'No .m3u playlists found in your music folders');
  if (fresh.length) {
    S.ui.playlist = S.user.playlists.find((p) => p.name === fresh[0].name)?.id;
    closeSettings();
    go('playlists');
  }
}

// ---------------- actions (event delegation on data-act) ----------------
const A = {
  tab: (d) => go(d.page),
  settings: () => openSettings({ rescan, addFolder, importM3u }),
  search: () => openSearch(),
  win: (d) => window.gf.win(d.cmd),
  toggle: () => player.toggle(),
  prev: () => player.prev(),
  next: () => player.next(),
  repeat: () => player.cycleRepeat(),
  shuffle: () => player.setShuffle(!S.user.shuffle),
  eq: () => toggleEq(),
  mute: () => {
    S.user.muted = !S.user.muted;
    player.applyVolume();
    updateVolume();
    saveUser();
  },
  artist: (d) => openArtist(d.name),
  'artist-sort': (d) => {
    S.user.settings.artistSort = d.v;
    saveUser();
    render('artists');
  },
  'open-album': (d) => openAlbum(d.key, d.tid),
  'close-album': () => {
    S.ui.album = null;
    render('artists');
  },
  'play-album': (d) => playAlbum(d.key),
  'shuffle-album': (d) => player.shuffleList(albumIds(d.key), albumSource(d.key)),
  'queue-album': (d) => {
    player.enqueue(albumIds(d.key));
    toast('Added album to the queue');
  },
  'album-to-playlist': (d, el) => menuAt(el, playlistSubmenu(() => albumIds(d.key))),
  'album-props': (d) => albumProperties(d.key),
  'play-in-album': (d) => playAlbum(d.key, d.tid),
  'play-artist': (d) => player.playList(artistIds(d.name), 0, artistSource(d.name)),
  'shuffle-artist': (d) => player.shuffleList(artistIds(d.name), artistSource(d.name)),
  quickplay: (d) => quickplay(d.col),
  'play-random-song': (d) => playRandomFrom(d.tid),
  reroll: () => {
    rerollRandom();
    render('explore');
  },
  jump: (d) => player.jump(+d.pos),
  'open-playlist': (d) => {
    S.ui.playlist = d.id;
    go('playlists');
  },
  'play-playlist': (d) => playPlaylist(d.id),
  'shuffle-playlist': (d) => playPlaylist(d.id, 0, true),
  'play-in-playlist': (d) => playPlaylist(d.pl, +d.idx),
  'new-playlist': async () => {
    const pl = await newPlaylist();
    if (pl) {
      S.ui.playlist = pl.id;
      go('playlists');
    }
  },
  'rename-playlist': async (d) => {
    const pl = playlist(d.id);
    const name = await promptBox('Rename playlist', pl.name);
    if (!name) return;
    pl.name = name;
    saveUser();
    emit('playlists');
  },
  'delete-playlist': async (d) => {
    const pl = playlist(d.id);
    if (!(await confirmBox(`Delete “${pl.name}”?`, 'The songs stay in your library.', 'Delete'))) return;
    S.user.playlists = S.user.playlists.filter((p) => p.id !== d.id);
    saveUser();
    emit('playlists');
  },
  'playlist-image': async (d) => {
    const file = await window.gf.pickImage();
    if (!file) return;
    playlist(d.id).image = file;
    saveUser();
    emit('playlists');
  },
  'import-m3u': () => importM3u(),
  'songs-artist': (d) => {
    S.ui.songsArtist = d.name || null;
    render('songs', false);
  },
  'song-sort': (d) => {
    setSongSort(d.key);
    render('songs');
  },
  'song-columns': (d, el) => menuAt(el, SONG_COLUMNS.map((k) => ({
    label: COLS[k].label, icon: S.user.settings.songColumns.includes(k) ? 'check' : null, disabled: k === 'title',
    act: () => {
      toggleColumn(k);
      render('songs');
    },
  }))),
  'play-in-songs': (d) => {
    const rows = songRows();
    const label = S.ui.songsArtist ?? 'All Songs';
    player.playList(rows.map((t) => t.id), +d.idx, { type: 'songs', label });
  },
  'edit-lyrics': (d) => songProperties(d.tid, 'lyrics'),
  'add-folder': () => addFolder(),
};

function dataOf(el) {
  return { ...el.dataset };
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('#ctxmenu')) closeMenu();
  const el = e.target.closest('[data-act]');
  if (!el || el.closest('#ctxmenu')) return;
  const fn = A[el.dataset.act];
  if (fn) {
    e.preventDefault();
    fn(dataOf(el), el, e);
  }
});

document.addEventListener('dblclick', (e) => {
  if (e.target.closest('button, input, a')) return;
  const el = e.target.closest('[data-dbl]');
  if (el) A[el.dataset.dbl]?.(dataOf(el), el, e);
});

// ---------------- context menus ----------------
function trackMenu(d) {
  const t = S.tracks.get(d.tid);
  if (!t) return [];
  const inPlaylist = d.pl && playlist(d.pl);
  return [
    { label: 'Play', icon: 'play', act: () => playAlbum(t.albumKey, t.id) },
    { label: 'Play next', icon: 'queue', act: () => { player.enqueue([t.id], true); toast('Playing next'); } },
    { label: 'Add to queue', icon: 'queue', act: () => { player.enqueue([t.id]); toast('Added to queue'); } },
    { label: 'Add to playlist', icon: 'cassette', sub: playlistSubmenu(() => [t.id]) },
    inPlaylist ? { label: `Remove from “${inPlaylist.name}”`, icon: 'trash', act: () => { inPlaylist.tracks.splice(+d.idx, 1); saveUser(); emit('playlists'); } } : null,
    { sep: true },
    { label: 'Go to album', icon: 'record', act: () => openAlbum(t.albumKey) },
    { label: 'Go to artist', icon: 'clef', act: () => openArtist(albumArtistNames(t.albumArtist)[0]) },
    { sep: true },
    { label: 'Song properties…', icon: 'info', act: () => songProperties(t.id) },
    { label: 'Show in folder', icon: 'folder', act: () => window.gf.showFile(t.id) },
  ];
}

const MENUS = {
  track: trackMenu,
  queue: (d) => [
    ...trackMenu(d).slice(3, 4),
    { label: 'Remove from queue', icon: 'trash', disabled: +d.pos === player.pos, act: () => player.removeAt(+d.pos) },
    { sep: true },
    ...trackMenu(d).slice(6),
  ],
  album: (d) => {
    const a = S.albums.get(d.key);
    if (!a) return [];
    return [
      { label: 'Play', icon: 'play', act: () => playAlbum(a.key) },
      { label: 'Shuffle', icon: 'shuffle', act: () => player.shuffleList(albumIds(a.key), albumSource(a.key)) },
      { label: 'Play next', icon: 'queue', act: () => player.enqueue(albumIds(a.key), true) },
      { label: 'Add to queue', icon: 'queue', act: () => player.enqueue(albumIds(a.key)) },
      { label: 'Add to playlist', icon: 'cassette', sub: playlistSubmenu(() => albumIds(a.key)) },
      { sep: true },
      { label: 'Go to artist', icon: 'clef', act: () => openArtist(albumArtistNames(a.artist)[0]) },
      { label: 'Change album art…', icon: 'image', act: () => changeAlbumArt(a.key) },
      S.user.albumArt[a.key] ? { label: 'Use original art', icon: 'refresh', act: () => { delete S.user.albumArt[a.key]; saveUser(); emit('art'); } } : null,
      { label: 'Album properties…', icon: 'info', act: () => albumProperties(a.key) },
    ];
  },
  artist: (d) => [
    { label: 'Play all', icon: 'play', act: () => player.playList(artistIds(d.name), 0, artistSource(d.name)) },
    { label: 'Shuffle', icon: 'shuffle', act: () => player.shuffleList(artistIds(d.name), artistSource(d.name)) },
    { label: 'Add to playlist', icon: 'cassette', sub: playlistSubmenu(() => artistIds(d.name)) },
    { sep: true },
    { label: 'Set artist picture…', icon: 'image', act: () => changeArtistImage(d.name) },
    S.user.artistImages[d.name] ? { label: 'Use album cover as picture', icon: 'refresh', act: () => { delete S.user.artistImages[d.name]; saveUser(); emit('art'); } } : null,
  ],
  playlist: (d) => [
    { label: 'Play', icon: 'play', act: () => playPlaylist(d.id) },
    { label: 'Shuffle', icon: 'shuffle', act: () => playPlaylist(d.id, 0, true) },
    { sep: true },
    { label: 'Rename…', icon: 'edit', act: () => A['rename-playlist'](d) },
    { label: 'Change image…', icon: 'image', act: () => A['playlist-image'](d) },
    playlist(d.id)?.image ? { label: 'Use album covers', icon: 'refresh', act: () => { playlist(d.id).image = null; saveUser(); emit('playlists'); } } : null,
    { label: 'Delete…', icon: 'trash', act: () => A['delete-playlist'](d) },
  ],
};

document.addEventListener('contextmenu', (e) => {
  const el = e.target.closest('[data-ctx]');
  if (!el || e.target.closest('input, textarea')) return;
  e.preventDefault();
  const items = MENUS[el.dataset.ctx]?.(dataOf(el));
  if (items?.length) showMenu(e.clientX, e.clientY, items);
});

// ---------------- player bar ----------------
function updateTrack() {
  const t = player.track;
  const a = t && S.albums.get(t.albumKey);
  $('#pb-title').innerHTML = t
    ? `<b>${esc(t.title)}</b><span> — ${esc(t.artist)}</span><span class="pb-album"> · ${esc(t.albumTitle)}</span>`
    : '<b>Gatefold</b><span> — pick an album to start</span>';
  $('#pb-art').innerHTML = a ? artHtml(a) : '';
  $('#pb-art').classList.toggle('empty', !a);
  document.title = t ? `${t.title} — ${t.artist}` : 'Gatefold';
  updateTime();
}

function updateState() {
  $('#play-btn').innerHTML = icon(player.playing ? 'pause' : 'play');
  $('#play-btn').classList.toggle('loading', player.loading && player.playing);
  const rec = $('#tabs [data-page="nowplaying"] .ic');
  rec.classList.toggle('spinning', player.playing);
  const r = S.user.repeat;
  $('#repeat-btn').innerHTML = icon(r === 'one' ? 'repeatOne' : 'repeat');
  $('#repeat-btn').classList.toggle('on', r !== 'off');
  $('#repeat-btn').title = { off: 'Repeat: off', all: 'Repeat: all', one: 'Repeat: one song' }[r];
  $('#shuffle-btn').classList.toggle('on', S.user.shuffle);
  $('#shuffle-btn').title = S.user.shuffle ? 'Shuffle: on' : 'Shuffle: off';
  $('#eq-btn').classList.toggle('on', S.user.eq.on);
}

let dragging = null;
function updateTime() {
  const d = player.duration;
  const cur = dragging != null ? dragging * d : player.audio.currentTime || 0;
  const frac = d ? Math.min(1, cur / d) : 0;
  $('#t-cur').textContent = fmtTime(cur);
  $('#t-dur').textContent = fmtTime(d);
  $('#seek-fill').style.width = `${frac * 100}%`;
  $('#seek-knob').style.left = `${frac * 100}%`;
}

function updateVolume() {
  const v = S.user.volume;
  $('#volume').value = v;
  $('#volume').style.setProperty('--v', `${S.user.muted ? 0 : v}%`);
  $('#vol-pct').textContent = S.user.muted ? 'Muted' : `${v}%`;
  $('#vol-icon').innerHTML = icon(S.user.muted || v === 0 ? 'mute' : 'volume');
}

function wirePlayerBar() {
  const bar = $('#seekbar');
  const fracAt = (e) => {
    const r = bar.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
  };
  bar.addEventListener('pointerdown', (e) => {
    if (!player.current) return;
    bar.setPointerCapture(e.pointerId);
    dragging = fracAt(e);
    bar.classList.add('drag');
    updateTime();
  });
  bar.addEventListener('pointermove', (e) => {
    if (dragging == null) {
      const d = player.duration;
      bar.title = d ? fmtTime(fracAt(e) * d) : '';
      return;
    }
    dragging = fracAt(e);
    updateTime();
  });
  const end = () => {
    if (dragging == null) return;
    player.seek(dragging);
    dragging = null;
    bar.classList.remove('drag');
  };
  bar.addEventListener('pointerup', end);
  bar.addEventListener('pointercancel', end);

  const vol = $('#volume');
  vol.addEventListener('input', () => {
    S.user.volume = +vol.value;
    S.user.muted = false;
    player.applyVolume();
    updateVolume();
    saveUser();
  });
  vol.addEventListener('wheel', (e) => {
    e.preventDefault();
    S.user.volume = Math.max(0, Math.min(100, S.user.volume + (e.deltaY < 0 ? 5 : -5)));
    player.applyVolume();
    updateVolume();
    saveUser();
  }, { passive: false });
}

// ---------------- library scanning ----------------
let scanning = false;
async function rescan(announce = false) {
  if (scanning) return;
  const folders = S.user.settings.folders;
  scanning = true;
  const bar = $('#scanbar');
  bar.classList.add('on');
  try {
    const r = await window.gf.scan(folders, S.user.settings.mergeDiscs);
    setLibrary(r.library);
    if (announce || (r.changed && r.changed !== r.tracks)) toast(`Library updated · ${r.tracks} songs in ${r.albums} albums`);
  } catch (err) {
    console.error(err);
    toast(`Scan failed: ${err.message}`);
  } finally {
    scanning = false;
    bar.classList.remove('on');
    renderSettings();
  }
}

window.gf.onScanProgress((p) => {
  const bar = $('#scanbar');
  bar.querySelector('span').textContent = p.total ? `${p.phase} · ${p.done} / ${p.total}` : `${p.phase}…`;
  bar.querySelector('.fill').style.width = p.total ? `${(p.done / p.total) * 100}%` : '0';
  const s = $('#settings-scan');
  if (s) s.textContent = bar.querySelector('span').textContent;
});

async function addFolder() {
  const picked = await window.gf.pickFolders();
  if (!picked.length) return;
  const set = new Set(S.user.settings.folders);
  for (const f of picked) set.add(f);
  S.user.settings.folders = [...set];
  saveUser();
  renderSettings();
  rescan(true);
}

// ---------------- keyboard ----------------
let artistPrefix = '';
let artistTypedAt = 0;
document.addEventListener('keydown', (e) => {
  const typing = e.target.closest?.('input, textarea, select');
  if (e.key === 'Escape') {
    if ($('#search-panel')) return closeSearch();
    if ($('#ctxmenu')) return closeMenu();
    if ($('.modal-wrap')) return closeModal();
    if ($('#eq-panel')) return closeEq();
    if ($('#settings')) return closeSettings();
    if (S.ui.page === 'artists' && S.ui.album) return A['close-album']();
    if (typing) e.target.blur();
    return;
  }
  if (e.key === 'F11') {
    e.preventDefault();
    return window.gf.win('fullscreen');
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
    e.preventDefault();
    return openSearch();
  }
  if (typing) return;
  // Album Artist type-ahead works whenever that sidebar has keyboard focus.
  if (S.ui.page === 'artists' && e.target.closest?.('.artist-side-list') &&
      e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && /[\p{L}\p{N} ]/u.test(e.key)) {
    e.preventDefault();
    const now = Date.now();
    artistPrefix = now - artistTypedAt > 900 ? e.key : artistPrefix + e.key;
    artistTypedAt = now;
    const artists = sortedArtists();
    const findMatch = (q) => artists.find((a) => a.name.toLocaleLowerCase().startsWith(q.toLocaleLowerCase()));
    let match = findMatch(artistPrefix);
    if (!match) {
      artistPrefix = e.key;
      match = findMatch(artistPrefix);
    }
    if (match) openArtist(match.name);
    return;
  }
  if (e.key === ' ') {
    e.preventDefault();
    player.toggle();
  } else if (e.ctrlKey && e.key === 'ArrowRight') player.next();
  else if (e.ctrlKey && e.key === 'ArrowLeft') player.prev();
  else if (e.ctrlKey && /^[1-5]$/.test(e.key)) go(PAGES[+e.key - 1]);
  else if (e.key === '/') {
    e.preventDefault();
    openSearch();
  }
});

// ---------------- app events ----------------
on('library', () => {
  render();
  updateTrack();
});
on('art', () => render());
on('settings', () => { if (S.ui.page === 'explore') render('explore'); });
on('playlists', () => { if (S.ui.page === 'playlists' || S.ui.page === 'explore') render(); });
on('track', () => {
  updateTrack();
  markPlaying();
  if (S.ui.page === 'nowplaying') render('nowplaying');
});
on('queue', () => { if (S.ui.page === 'nowplaying') render('nowplaying'); });
on('state', updateState);
on('time', () => {
  updateTime();
  if (S.ui.page === 'nowplaying') syncLyrics();
});
on('toast', toast);
on('lyrics-changed', () => {
  invalidateLyrics();
  if (S.ui.page === 'nowplaying') render('nowplaying');
});

// ---------------- boot ----------------
async function boot() {
  for (const el of [$('#topbar'), $('#playerbar')]) el.innerHTML = el.innerHTML.replace(/\{(\w+)\}/g, (_, n) => icon(n));
  window.gf.onWinState((s) => { $('#fs-btn').innerHTML = icon(s.fullscreen ? 'unfullscreen' : 'fullscreen'); });
  S.info = await window.gf.info();
  document.body.classList.add(`os-${S.info.platform}`);
  await loadUser();
  if (S.info.testFolders) S.user.settings.folders = S.info.testFolders;
  else if (!S.user.settings.folders.length && S.info.musicDir) S.user.settings.folders = [S.info.musicDir];
  setLibrary(await window.gf.getLibrary());
  wirePlayerBar();
  player.applyVolume();
  updateVolume();
  updateState();
  updateTrack();
  player.restore();
  go(PAGES.includes(S.user.lastPage) ? S.user.lastPage : 'explore');
  const scan = rescan(!S.tracks.size);
  window.__gf = { S, player, go, openAlbum, openArtist, A, render, scan, createPlaylist, songProperties, ready: true };
}

boot();

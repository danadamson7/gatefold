import { createMetadataExport, restoreMetadata } from './transfer.js';
// Overlays: context menus, modal dialogs, search, settings drawer, equalizer, toasts.
import { S, saveUser, updateOverrides, updateAlbumOverrides, albumArt, artHtml, trackStats, albumStats, artistImage, placeholder } from './store.js';
import { player, EQ_FREQS, EQ_PRESETS } from './player.js';
import { $, esc, fmtTime, fmtLength, fmtDate, fmtAgo, emit, sortKey } from './util.js';
import { icon } from './icons.js';

const root = () => document.getElementById('overlay-root');

// ---------------- toast ----------------
let toastTimer;
export function toast(msg) {
  let el = $('#toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    root().appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

// ---------------- context menu ----------------
export function closeMenu() {
  $('#ctxmenu')?.remove();
}

function menuHtml(items) {
  return `<ul>${items.filter(Boolean).map((it, i) => {
    if (it.sep) return '<li class="sep"></li>';
    return `<li class="${it.sub ? 'has-sub' : ''}${it.disabled ? ' disabled' : ''}" data-mi="${i}">${it.icon ? icon(it.icon) : '<span class="ic"></span>'}<span>${esc(it.label)}</span>${it.sub ? `<span class="caret">›</span>${menuHtml(it.sub)}` : ''}</li>`;
  }).join('')}</ul>`;
}

export function showMenu(x, y, items) {
  closeMenu();
  items = items.filter(Boolean);
  const el = document.createElement('div');
  el.id = 'ctxmenu';
  el.innerHTML = menuHtml(items);
  root().appendChild(el);
  const r = el.getBoundingClientRect();
  el.style.left = `${Math.min(x, innerWidth - r.width - 8)}px`;
  el.style.top = `${Math.min(y, innerHeight - r.height - 8)}px`;
  if (x + r.width * 2 > innerWidth) el.classList.add('flip');
  el.addEventListener('click', (e) => {
    const li = e.target.closest('li[data-mi]');
    if (!li || li.classList.contains('has-sub') || li.classList.contains('disabled')) return;
    const path = [];
    for (let n = li; n && n !== el; n = n.parentElement) if (n.dataset?.mi) path.unshift(+n.dataset.mi);
    let it = { sub: items };
    for (const i of path) it = it.sub.filter(Boolean)[i];
    closeMenu();
    it.act?.();
  });
}

export function menuAt(el, items) {
  const r = el.getBoundingClientRect();
  showMenu(r.left, r.bottom + 4, items);
}

// ---------------- modal ----------------
export function closeModal() {
  $('.modal-wrap')?.remove();
}

export function modal(html, cls = '') {
  closeModal();
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap';
  wrap.innerHTML = `<div class="modal ${cls}">${html}</div>`;
  wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) closeModal(); });
  root().appendChild(wrap);
  return wrap.firstElementChild;
}

export function promptBox(title, value = '', ok = 'Save') {
  return new Promise((resolve) => {
    const m = modal(`<form class="prompt"><h2>${esc(title)}</h2><input name="v" value="${esc(value)}" autocomplete="off">
      <div class="modal-actions"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary">${esc(ok)}</button></div></form>`, 'small');
    const input = m.querySelector('input');
    input.focus();
    input.select();
    m.querySelector('[data-close]').onclick = () => { closeModal(); resolve(null); };
    m.querySelector('form').onsubmit = (e) => {
      e.preventDefault();
      closeModal();
      resolve(input.value.trim() || null);
    };
  });
}

export function confirmBox(title, text, ok = 'OK') {
  return new Promise((resolve) => {
    const m = modal(`<h2>${esc(title)}</h2><p>${esc(text)}</p>
      <div class="modal-actions"><button class="btn ghost" data-v="0">Cancel</button><button class="btn danger" data-v="1">${esc(ok)}</button></div>`, 'small');
    m.querySelectorAll('button').forEach((b) => { b.onclick = () => { closeModal(); resolve(b.dataset.v === '1'); }; });
  });
}

// ---------------- song properties ----------------
export async function songProperties(id, focus) {
  const t = S.tracks.get(id);
  if (!t) return;
  const a = S.albums.get(t.albumKey);
  const index = a.tracks.findIndex((item) => item.id === id);
  const navigate = (dir) => {
    const next = a.tracks[index + dir];
    if (next) songProperties(next.id);
  };
  const st = trackStats(id);
  const ovLyrics = S.user.overrides[id]?.lyrics;
  const lyr = ovLyrics != null ? { text: ovLyrics } : await window.gf.lyrics(id);
  const lyricsText = lyr?.text ?? (lyr?.synced ? lyr.synced.map((l) => l[1]).join('\n') : '');
  const ro = (label, v) => `<label><span>${label}</span><div class="ro">${esc(v) || '—'}</div></label>`;
  const ed = (label, name, v) => `<label><span>${label}</span><input name="${name}" value="${esc(v)}"></label>`;
  const m = modal(`<form class="props">
    <header class="props-head">${artHtml(a, 'props-art')}<div><h2>${esc(t.title)}</h2><p>${esc(t.artist)} — ${esc(a.title)}</p></div>
      <div class="props-nav"><button type="button" class="icon-btn" data-song-prev title="Previous song (←)" ${index <= 0 ? 'disabled' : ''}>←</button><small>${index + 1} / ${a.tracks.length}</small><button type="button" class="icon-btn" data-song-next title="Next song (→)" ${index >= a.tracks.length - 1 ? 'disabled' : ''}>→</button></div>
      <button type="button" class="icon-btn close-x" data-close>${icon('close')}</button></header>
    <div class="props-grid">
      ${ed('Track title', 'title', t.title)}
      ${ed('Artist', 'artist', t.artist)}
      ${ed('Album artist', 'albumArtist', t.albumArtist)}
      ${ro('Album', t.albumTitle)}
      ${ro('Track', t.track ? `${t.track}${t.trackOf ? ` of ${t.trackOf}` : ''}` : '')}
      ${ro('Disc', `${t.discN}${t.discOf ? ` of ${t.discOf}` : a.discs > 1 ? ` of ${a.discs}` : ''}`)}
      ${ro('Length', fmtTime(t.duration))}
      ${ro('Times played', `${st.n}${st.last ? ` (last ${fmtAgo(st.last)})` : ''}`)}
      ${ed('Year', 'year', t.year || '')}
      ${ed('Genre', 'genre', t.genre)}
      ${ed('Mood', 'mood', t.mood)}
      ${ro('Format', [...new Set([t.path.split('.').pop().toUpperCase(), t.codec].filter(Boolean))].join(' · '))}
      <label class="wide"><span>Comments</span><textarea name="comment" rows="2">${esc(t.comment)}</textarea></label>
      <label class="wide"><span>Lyrics${lyr?.synced ? ' <em>(synced lyrics from ' + (lyr.source === 'lrc' ? '.lrc file' : 'tag') + ' — editing replaces them with plain text)</em>' : ''}</span><textarea name="lyrics" rows="8">${esc(lyricsText)}</textarea></label>
      <label class="wide"><span>File</span><div class="ro path">${esc(t.path)}</div></label>
    </div>
    <p class="hint">Edits are saved in Gatefold's library — your music files are not modified.</p>
    <div class="modal-actions">
      <button type="button" class="btn ghost" data-show>${icon('folder')}Show in folder</button><div class="spacer"></div>
      <button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary">Save</button></div>
  </form>`, 'wide');
  m.querySelectorAll('[data-close]').forEach((b) => { b.onclick = closeModal; });
  m.querySelector('[data-show]').onclick = () => window.gf.showFile(id);
  m.querySelector('[data-song-prev]').onclick = () => navigate(-1);
  m.querySelector('[data-song-next]').onclick = () => navigate(1);
  m.addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key) || e.ctrlKey || e.metaKey || e.altKey) return;
    // Preserve caret and selection shortcuts while editing a text field.
    if (e.target.closest('input, textarea, select, [contenteditable]')) return;
    e.preventDefault();
    e.stopPropagation();
    navigate(e.key === 'ArrowLeft' ? -1 : 1);
  });
  const form = m.querySelector('form');
  if (focus) form.elements[focus]?.focus();
  form.onsubmit = (e) => {
    e.preventDefault();
    const f = form.elements;
    const fields = { title: f.title.value.trim(), artist: f.artist.value.trim(), albumArtist: f.albumArtist.value.trim(), year: +f.year.value || 0,
      genre: f.genre.value.trim(), mood: f.mood.value.trim(), comment: f.comment.value };
    if (f.lyrics.value !== lyricsText) fields.lyrics = f.lyrics.value;
    else if (ovLyrics != null) fields.lyrics = ovLyrics;
    updateOverrides(id, fields);
    emit('lyrics-changed', id);
    closeModal();
    toast('Song properties saved');
  };
}

// ---------------- album properties ----------------
export function albumProperties(key) {
  const a = S.albums.get(key);
  if (!a) return;
  const custom = S.user.albumArt[key];
  const st = albumStats(a);
  const dirs = S.snapshot.albums[key]?.dirs || [];
  const ed = (label, name, value, extra = '') => `<label><span>${label}</span><input name="${name}" value="${esc(value ?? '')}" ${extra}></label>`;
  const ro = (label, value) => `<label><span>${label}</span><div class="ro">${esc(value) || '—'}</div></label>`;
  const artists = new Set(a.tracks.map((t) => t.artist));
  const mixedArtists = artists.size > 1;
  const genres = new Set(a.tracks.map((t) => t.genre || ''));
  const comments = new Set(a.tracks.map((t) => t.comment || ''));
  const discNums = [...new Set(a.tracks.map((t) => t.discN || 1))].sort((x, y) => x - y);
  const discEdits = discNums.map((n) => {
    const t = a.tracks.find((t) => t.discN === n && t.discSubtitle) || a.tracks.find((t) => t.discN === n);
    return ed(a.discs > 1 ? `Disc ${n} subtitle` : 'Disc subtitle', `subtitle_${n}`, t?.discSubtitle || '');
  }).join('');
  const m = modal(`<form class="props">
    <header class="props-head"><div><h2>${esc(a.title)}</h2><p>Album properties · editable metadata</p></div>
      <button type="button" class="icon-btn close-x" data-close>${icon('close')}</button></header>
    <div class="album-props">
      <div class="ap-art">${artHtml(a, 'big', false)}
        <div class="ap-art-btns"><button type="button" class="btn ghost" data-art>${icon('image')}Change art…</button>
        ${custom ? `<button type="button" class="btn ghost" data-reset>${icon('refresh')}Use original</button>` : ''}</div>
        <small>${custom ? 'Custom image' : a.art ? 'From the music files / folder' : 'No art found — choose a PNG or JPG'}</small></div>
      <div class="props-grid one">
        ${ed('Album title', 'albumTitle', a.title, 'required')}
        ${ed('Album Artist', 'albumArtist', a.artist, 'required')}
        ${ed('Artist (all songs)', 'artist', mixedArtists ? '' : a.tracks[0]?.artist, mixedArtists ? 'placeholder="Multiple artists — leave blank to keep"' : '')}
        ${ed('Genre', 'genre', genres.size === 1 ? [...genres][0] : '', genres.size > 1 ? 'placeholder="Multiple genres — leave blank to keep"' : '')}
        <div class="date-fields wide"><span>Release date</span><div>
          ${ed('Year', 'year', a.year || '', 'type="number" min="0" max="9999" placeholder="YYYY"')}
          ${ed('Month', 'month', a.month || '', 'type="number" min="1" max="12" placeholder="MM"')}
          ${ed('Day', 'day', a.day || '', 'type="number" min="1" max="31" placeholder="DD"')}
        </div></div>
        ${ed('Number of discs', 'discOf', a.discs, 'type="number" min="1" max="99" required')}
        ${discEdits}
        <label class="wide"><span>Comments</span><textarea name="comment" rows="3" placeholder="${comments.size > 1 ? 'Different comments per song — leave blank to keep' : ''}">${esc(comments.size === 1 ? [...comments][0] : '')}</textarea></label>
        ${ro('Number of tracks', a.tracks.length)}
        ${ro('Length', fmtLength(a.duration))}
        ${ro('Times played', `${st.n}${st.last ? ` (last ${fmtAgo(st.last)})` : ''}`)}
        ${ro('Added', fmtDate(a.addedAt))}
        <label class="wide"><span>Folder${dirs.length > 1 ? 's' : ''}</span><div class="ro path">${dirs.map(esc).join('<br>')}</div></label>
      </div>
    </div>
    <p class="hint">Album-wide edits are stored in Gatefold, not written to your music files. Artist, Genre and Comments can still be edited separately for each song.</p>
    <div class="modal-actions"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary">Save changes</button></div>
  </form>`, 'wide');
  const form = m.querySelector('form');
  m.querySelectorAll('[data-close]').forEach((b) => { b.onclick = closeModal; });
  m.querySelector('[data-art]').onclick = async () => {
    await changeAlbumArt(key);
    // Keep any unsaved text edits intact while updating the preview.
    const preview = m.querySelector('.ap-art > .art');
    if (preview && S.user.albumArt[key]) {
      const img = document.createElement('img');
      img.className = preview.className;
      img.src = `custom/${S.user.albumArt[key]}`;
      img.alt = '';
      preview.replaceWith(img);
    }
  };
  m.querySelector('[data-reset]')?.addEventListener('click', () => {
    delete S.user.albumArt[key];
    saveUser();
    emit('art');
    // Retain unsaved text edits; update just the image preview.
    const preview = m.querySelector('.ap-art > .art');
    const replacement = document.createElement('div');
    replacement.innerHTML = artHtml(a, 'big', false);
    preview?.replaceWith(replacement.firstElementChild);
  });
  form.onsubmit = (e) => {
    e.preventDefault();
    const f = form.elements;
    const year = +f.year.value || 0;
    const month = +f.month.value || 0;
    const day = +f.day.value || 0;
    const discs = +f.discOf.value;
    const latestDisc = Math.max(...discNums);
    const days = year && month ? new Date(Date.UTC(year, month, 0)).getUTCDate() : 0;
    if ((!year && (month || day)) || (day && !month) || month > 12 || day > days || (day && !year)) {
      return toast('Enter a valid release date (year, optional month and day)');
    }
    if (!Number.isInteger(discs) || discs < latestDisc || discs > 99) {
      return toast(`Number of discs must be between ${latestDisc} and 99`);
    }
    const title = f.albumTitle.value.trim();
    const albumArtist = f.albumArtist.value.trim();
    if (!title || !albumArtist) return toast('Album title and Album Artist are required');
    const fields = { albumTitle: title, albumArtist, year, month, day, discOf: discs };
    // A blank mixed-value field means keep the song-specific values; otherwise
    // changing an album property deliberately applies it to every song.
    if (!mixedArtists || f.artist.value.trim()) fields.artist = f.artist.value.trim();
    if (genres.size === 1 || f.genre.value.trim()) fields.genre = f.genre.value.trim();
    if (comments.size === 1 || f.comment.value) fields.comment = f.comment.value;
    const subtitles = Object.fromEntries(discNums.map((n) => [n, f[`subtitle_${n}`].value.trim()]));
    updateAlbumOverrides(key, fields, subtitles);
    closeModal();
    toast('Album properties saved');
  };
}

export async function changeAlbumArt(key) {
  const file = await window.gf.pickImage();
  if (!file) return;
  S.user.albumArt[key] = file;
  saveUser();
  emit('art');
}

export async function changeArtistImage(name) {
  const file = await window.gf.pickImage();
  if (!file) return;
  S.user.artistImages[name] = file;
  saveUser();
  emit('art');
}

// ---------------- search ----------------
export function openSearch() {
  if ($('#search-panel')) return $('#search-panel input').focus();
  const el = document.createElement('div');
  el.id = 'search-panel';
  el.innerHTML = `<div class="search-box">${icon('search')}<input placeholder="Search artists, albums, songs…" spellcheck="false"><button type="button" class="search-dismiss" title="Close search (Esc)">Esc</button></div><div class="search-results"></div>`;
  root().appendChild(el);
  const input = el.querySelector('input');
  el.querySelector('.search-dismiss').addEventListener('click', closeSearch);
  const out = el.querySelector('.search-results');
  let sel = -1;
  const render = () => {
    const q = input.value.trim().toLowerCase();
    sel = -1;
    if (!q) {
      out.innerHTML = '<div class="empty small">Type to search your library.</div>';
      return;
    }
    const match = (s) => s.toLowerCase().includes(q);
    const artists = [...S.artists.values()].filter((a) => match(a.name)).sort((a, b) => sortKey(a.name).localeCompare(sortKey(b.name))).slice(0, 5);
    const albums = S.albumList.filter((a) => match(a.title) || match(a.artist)).slice(0, 8);
    const songs = [...S.tracks.values()].filter((t) => match(t.title) || match(t.artist)).slice(0, 12);
    const sec = (title, html) => (html ? `<h4>${title}</h4>${html}` : '');
    out.innerHTML = sec('Artists', artists.map((a) => {
      const img = artistImage(a.name);
      return `<div class="sr" data-act="artist" data-name="${esc(a.name)}">${img ? `<img class="thumb" src="${esc(img)}" alt="">` : placeholder(a.name, 'thumb')}<span><b>${esc(a.name)}</b><small>${a.albums.length} albums</small></span></div>`;
    }).join(''))
      + sec('Albums', albums.map((a) => `<div class="sr" data-act="open-album" data-key="${a.key}" data-ctx="album">${artHtml(a, 'thumb')}<span><b>${esc(a.title)}</b><small>${esc(a.artist)}${a.year ? ` · ${a.year}` : ''}</small></span></div>`).join(''))
      + sec('Songs', songs.map((t) => `<div class="sr" data-act="open-album" data-tid="${t.id}" data-key="${t.albumKey}" data-ctx="track">${artHtml(S.albums.get(t.albumKey), 'thumb')}<span><b>${esc(t.title)}</b><small>${esc(t.artist)} — ${esc(t.albumTitle)}</small></span><em>${fmtTime(t.duration)}</em></div>`).join(''))
      || '<div class="empty small">No matches.</div>';
  };
  input.addEventListener('input', render);
  input.addEventListener('keydown', (e) => {
    const items = [...out.querySelectorAll('.sr')];
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      sel = Math.max(0, Math.min(items.length - 1, sel + (e.key === 'ArrowDown' ? 1 : -1)));
      items.forEach((x, i) => x.classList.toggle('kb', i === sel));
      items[sel]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      (items[sel] || items[0])?.click();
    }
  });
  out.addEventListener('click', (e) => { if (e.target.closest('.sr')) setTimeout(closeSearch, 0); });
  render();
  input.focus();
}

export function closeSearch() {
  $('#search-panel')?.remove();
}

// ---------------- settings ----------------
export function openSettings(handlers) {
  if ($('#settings')) return closeSettings();
  const el = document.createElement('div');
  el.id = 'settings';
  root().appendChild(el);
  renderSettings(el, handlers);
  requestAnimationFrame(() => el.classList.add('open'));
}

export function closeSettings() {
  const el = $('#settings');
  if (!el) return;
  el.classList.remove('open');
  setTimeout(() => el.remove(), 200);
}

export async function renderSettings(el = $('#settings'), handlers) {
  if (!el) return;
  handlers ||= el._handlers;
  el._handlers = handlers;
  const s = S.user.settings;
  el.innerHTML = `<div class="drawer">
    <header><h2>${icon('menu')}Settings</h2><button class="icon-btn" data-x>${icon('close')}</button></header>
    <section><h3>Music folders</h3>
      ${s.folders.map((f, i) => `<div class="folder">${icon('folder')}<span title="${esc(f)}">${esc(f)}</span><button class="icon-btn sm" data-rm="${i}" title="Remove">${icon('close')}</button></div>`).join('') || '<p class="muted">No folders yet.</p>'}
      <div class="row"><button class="btn ghost" data-add>${icon('plus')}Add folder…</button><button class="btn ghost" data-rescan>${icon('refresh')}Rescan library</button></div>
      <p class="muted" id="settings-scan">${S.tracks.size} songs · ${S.albums.size} albums · ${S.artists.size} album artists</p>
      <label class="toggle"><input type="checkbox" data-merge ${s.mergeDiscs ? 'checked' : ''}><span></span>Combine “Disc 1 / Disc 2” folders into one album</label>
    </section>
    <section><h3>Explore</h3>
      <label class="inline">An album counts as a <b>forgotten listen</b> after <input type="number" min="7" max="3650" data-forgot value="${s.forgottenDays}"> days without a play</label>
    </section>
    <section><h3>Playlists</h3>
      <div class="row"><button class="btn ghost" data-m3u>${icon('folder')}Import .m3u playlists from music folders</button></div>
    </section>
    <section><h3>Playback</h3>
      <p class="muted">WMA, APE and ALAC files are converted for playback the first time they play (needs ffmpeg). Cache: <span id="cache-size">…</span></p>
      <div class="row"><button class="btn ghost" data-cache>${icon('trash')}Clear conversion cache</button></div>
    </section>
    <section><h3>Statistics</h3>
      <div class="row"><button class="btn ghost" data-export>${icon('folder')}Export metadata…</button>
        <button class="btn ghost" data-import>${icon('folder')}Import metadata…</button></div>
      <p class="muted">Export song properties, album metadata, play counts and playlist membership as JSON. Audio files and custom images are not included. Importing replaces matching play counts; unmatched songs are skipped.</p>
      <input data-import-file type="file" accept=".json,application/json" hidden>
      <div class="row"><button class="btn danger ghost" data-reset>${icon('refresh')}Reset all play counts</button></div>
    </section>
    <section><h3>Keyboard</h3>
      <dl class="keys"><dt>Space</dt><dd>Play / pause</dd><dt>Ctrl + ← / →</dt><dd>Previous / next song</dd><dt>Ctrl + 1–5</dt><dd>Switch page</dd>
      <dt>← / → (Song Properties, outside text fields)</dt><dd>Previous / next song in album</dd><dt>Ctrl + F</dt><dd>Search</dd><dt>F11</dt><dd>Full screen</dd><dt>Esc</dt><dd>Close panel</dd></dl>
    </section>
    <footer class="muted">Gatefold ${esc(S.info.version)} · album-first music player</footer>
  </div>`;
  el.querySelector('[data-x]').onclick = closeSettings;
  el.onmousedown = (e) => { if (e.target === el) closeSettings(); };
  el.querySelectorAll('[data-rm]').forEach((b) => {
    b.onclick = () => {
      s.folders.splice(+b.dataset.rm, 1);
      saveUser();
      renderSettings();
      handlers.rescan();
    };
  });
  el.querySelector('[data-add]').onclick = handlers.addFolder;
  el.querySelector('[data-rescan]').onclick = () => handlers.rescan(true);
  el.querySelector('[data-merge]').onchange = (e) => {
    s.mergeDiscs = e.target.checked;
    saveUser();
    handlers.rescan(true);
  };
  el.querySelector('[data-forgot]').onchange = (e) => {
    s.forgottenDays = Math.max(7, +e.target.value || 60);
    saveUser();
    emit('settings');
  };
  el.querySelector('[data-m3u]').onclick = handlers.importM3u;
  el.querySelector('[data-cache]').onclick = async () => {
    await window.gf.clearCache();
    renderSettings();
  };
  el.querySelector('[data-export]').onclick = async () => {
    if (!S.snapshot) return toast('Scan your library first');
    try {
      const exportFile = createMetadataExport(S.snapshot, S.user);
      if (await window.gf.exportMetadata(JSON.stringify(exportFile, null, 2))) toast('Metadata exported');
    } catch (err) { toast(`Export failed: ${err.message}`); }
  };
  const importInput = el.querySelector('[data-import-file]');
  el.querySelector('[data-import]').onclick = () => importInput.click();
  importInput.onchange = async () => {
    const file = importInput.files?.[0];
    if (!file) return;
    try {
      if (file.size > 100_000_000) throw new Error('File is too large');
      const data = JSON.parse(await file.text());
      if (!(await confirmBox('Import metadata?', 'Matching song overrides and play counts will be updated. Existing music files will not change.', 'Import'))) return;
      const r = restoreMetadata(data);
      toast(`Imported ${r.matched} tracks and ${r.playlists} playlists (${r.skipped} skipped)`);
      renderSettings(el, handlers);
    } catch (err) { toast(`Import failed: ${err.message}`); }
  };
  el.querySelector('[data-reset]').onclick = async () => {
    if (!(await confirmBox('Reset play counts?', 'This clears every play count and last-played date. Playlists are kept.', 'Reset'))) return;
    S.user.stats = { tracks: {}, playlists: {} };
    saveUser();
    emit('settings');
    toast('Play counts reset');
  };
  const size = await window.gf.cacheSize();
  const cs = el.querySelector('#cache-size');
  if (cs) cs.textContent = size > 1e9 ? `${(size / 1e9).toFixed(1)} GB` : `${Math.round(size / 1e6)} MB`;
}

// ---------------- equalizer ----------------
export function toggleEq() {
  if ($('#eq-panel')) return closeEq();
  const el = document.createElement('div');
  el.id = 'eq-panel';
  root().appendChild(el);
  renderEq(el);
  document.querySelector('[data-act="eq"]')?.classList.add('on-open');
}

export function closeEq() {
  $('#eq-panel')?.remove();
  document.querySelector('[data-act="eq"]')?.classList.remove('on-open');
}

function renderEq(el) {
  const eq = S.user.eq;
  const label = (f) => (f >= 1000 ? `${f / 1000}k` : f);
  const slider = (name, v, lbl) => `<div class="eq-band"><span class="db">${v > 0 ? '+' : ''}${v}</span>
    <input type="range" min="-12" max="12" step="1" value="${v}" data-band="${name}" orient="vertical"><span class="f">${lbl}</span></div>`;
  el.innerHTML = `<header><h3>Equalizer</h3>
      <label class="toggle"><input type="checkbox" data-on ${eq.on ? 'checked' : ''}><span></span>${eq.on ? 'On' : 'Off'}</label>
      <select data-preset>${[...Object.keys(EQ_PRESETS), 'Custom'].map((p) => `<option ${p === eq.preset ? 'selected' : ''}>${p}</option>`).join('')}</select>
      <button class="icon-btn sm" data-x>${icon('close')}</button></header>
    <div class="eq-bands${eq.on ? '' : ' off'}">${slider('pre', eq.preamp, 'Pre')}<div class="eq-div"></div>${EQ_FREQS.map((f, i) => slider(i, eq.bands[i], label(f))).join('')}</div>`;
  el.querySelector('[data-x]').onclick = closeEq;
  el.querySelector('[data-on]').onchange = (e) => {
    eq.on = e.target.checked;
    commit(el);
  };
  el.querySelector('[data-preset]').onchange = (e) => {
    const p = EQ_PRESETS[e.target.value];
    if (!p) return;
    eq.preset = e.target.value;
    eq.bands = p.slice();
    eq.on = true;
    commit(el);
  };
  el.querySelectorAll('input[data-band]').forEach((inp) => {
    inp.oninput = () => {
      const v = +inp.value;
      if (inp.dataset.band === 'pre') eq.preamp = v;
      else {
        eq.bands[+inp.dataset.band] = v;
        eq.preset = 'Custom';
        el.querySelector('[data-preset]').value = 'Custom';
      }
      inp.previousElementSibling.textContent = `${v > 0 ? '+' : ''}${v}`;
      player.applyEq();
      saveUser();
    };
    inp.ondblclick = () => {
      inp.value = 0;
      inp.oninput();
    };
  });
}

function commit(el) {
  player.applyEq();
  saveUser();
  renderEq(el);
}

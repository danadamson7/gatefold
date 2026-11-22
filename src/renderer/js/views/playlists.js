// PLAYLISTS: playlist sidebar + large playlist header with its songs.
import { S, playlist, playlistArtHtml, saveUser } from '../store.js';
import { esc, fmtTime, fmtHours, emit } from '../util.js';
import { icon } from '../icons.js';

// In-place reordering preserves the user's playlist IDs and all saved tracks.
export function movePlaylistInList(list, fromId, targetId, after = false) {
  const from = list.findIndex(p => p.id === fromId);
  const target = list.findIndex(p => p.id === targetId);
  if (from === -1 || target === -1 || from === target) return false;
  let insertion = target + (after ? 1 : 0);
  if (from < insertion) insertion--;
  if (from === insertion) return false;
  const [item] = list.splice(from, 1);
  list.splice(insertion, 0, item);
  return true;
}

function sidebar() {
  const rows = S.user.playlists.map((p, i, list) => `<div class="side-item playlist-sidebar-row${S.ui.playlist === p.id ? ' on' : ''}" data-act="open-playlist" data-id="${p.id}" data-ctx="playlist" draggable="true" title="Drag to reorder playlists">
      ${playlistArtHtml(p, 'thumb')}<span class="name">${esc(p.name)}</span><span class="count">${p.tracks.length}</span>
      <span class="playlist-move-controls"><button type="button" data-pl-step="-1" aria-label="Move ${esc(p.name)} up" title="Move up" ${i === 0 ? 'disabled' : ''}>▲</button>
      <button type="button" data-pl-step="1" aria-label="Move ${esc(p.name)} down" title="Move down" ${i === list.length - 1 ? 'disabled' : ''}>▼</button></span>
    </div>`).join('');
  return `<aside class="sidebar">
    <div class="side-head"><h3>Playlists</h3><button class="chip" data-act="new-playlist">${icon('plus')}New</button></div>
    <div class="side-list">${rows || '<div class="empty small">No playlists yet.</div>'}
      <button class="btn ghost import" data-act="import-m3u">${icon('folder')}Import .m3u playlists</button></div>
  </aside>`;
}

function detail(p) {
  const tracks = p.tracks.map((id) => S.tracks.get(id));
  const total = tracks.reduce((s, t) => s + (t?.duration || 0), 0);
  const rows = tracks.map((t, i) => {
    if (!t) return `<div class="prow missing" data-idx="${i}"><span class="n">${i + 1}</span><span>Missing file</span><span></span><span></span><span></span></div>`;
    return `<div class="prow" draggable="true" data-idx="${i}" data-tid="${t.id}" data-pl="${p.id}" data-dbl="play-in-playlist" data-ctx="track">
      <span class="n"><span class="num">${i + 1}</span><button class="rowplay" data-act="play-in-playlist" data-idx="${i}" data-pl="${p.id}">${icon('play')}</button></span>
      <span class="tt">${esc(t.title)}</span><span class="ar">${esc(t.artist)}</span><span class="al">${esc(t.albumTitle)}</span><span class="d">${fmtTime(t.duration)}</span>
    </div>`;
  }).join('');
  return `<div class="pl-view">
    <header class="pl-head">
      <div class="pl-art" data-act="playlist-image" data-id="${p.id}" title="Change playlist image">${playlistArtHtml(p, 'big')}<span class="pl-art-edit">${icon('image')}Change image</span></div>
      <div class="pl-info">
        <div class="kicker">Playlist</div>
        <h1>${esc(p.name)}</h1>
        <p>${p.tracks.length} songs · ${fmtHours(total)}</p>
        <div class="head-actions">
          <button class="btn primary" data-act="play-playlist" data-id="${p.id}">${icon('play')}Play</button>
          <button class="chip" data-act="shuffle-playlist" data-id="${p.id}">${icon('shuffle')}Shuffle</button>
          <button class="chip" data-act="rename-playlist" data-id="${p.id}">${icon('edit')}Rename</button>
          <button class="chip" data-act="delete-playlist" data-id="${p.id}">${icon('trash')}Delete</button>
        </div>
      </div>
    </header>
    <section class="pl-tracks" aria-label="Songs in ${esc(p.name)}">
      ${rows ? `<div class="ptable"><div class="phead"><span>#</span><span>Title</span><span>Artist</span><span>Album</span><span>Length</span></div>${rows}</div>`
      : '<div class="empty">This playlist is empty. Right-click any song or album and choose <b>Add to playlist</b>.</div>'}
    </section>
  </div>`;
}

export function renderPlaylists(el) {
  if (S.ui.playlist && !playlist(S.ui.playlist)) S.ui.playlist = null;
  if (!S.ui.playlist && S.user.playlists.length) S.ui.playlist = S.user.playlists[0].id;
  const p = S.ui.playlist && playlist(S.ui.playlist);
  const sideScroll = el.querySelector('.side-list')?.scrollTop || 0;
  el.innerHTML = `<div class="split">${sidebar()}<div class="content">${p ? detail(p)
    : `<div class="welcome"><div class="welcome-card">${icon('cassette', 'big-ic')}<h1>No playlists yet</h1><p>Make a mixtape from anything in your library.</p>
       <button class="btn primary" data-act="new-playlist">${icon('plus')}New playlist</button></div></div>`}</div></div>`;
  if (el.querySelector('.side-list')) el.querySelector('.side-list').scrollTop = sideScroll;
  wireSidebarOrder(el);
  wireDrag(el, p);
}

function wireSidebarOrder(el) {
  let draggedId = null;
  const rows = [...el.querySelectorAll('.playlist-sidebar-row')];
  const clear = () => rows.forEach(row => row.classList.remove('dragging', 'drop-above', 'drop-below'));
  const persist = () => { saveUser(); emit('playlists'); };
  rows.forEach((row) => {
    const id = row.dataset.id;
    row.querySelectorAll('[data-pl-step]').forEach((button) => {
      button.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        const index = S.user.playlists.findIndex(p => p.id === id);
        const step = Number(button.dataset.plStep);
        const other = S.user.playlists[index + step];
        if (other && movePlaylistInList(S.user.playlists, id, other.id, step > 0)) persist();
      });
    });
    row.addEventListener('dragstart', (e) => {
      if (e.target.closest('button')) return e.preventDefault();
      draggedId = id;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', id);
      row.classList.add('dragging');
    });
    row.addEventListener('dragend', () => { draggedId = null; clear(); });
    row.addEventListener('dragover', (e) => {
      if (!draggedId || draggedId === id) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      clear();
      const rect = row.getBoundingClientRect();
      row.classList.add(e.clientY < rect.top + rect.height / 2 ? 'drop-above' : 'drop-below');
    });
    row.addEventListener('drop', (e) => {
      if (!draggedId) return;
      e.preventDefault();
      const rect = row.getBoundingClientRect();
      const changed = movePlaylistInList(S.user.playlists, draggedId, id, e.clientY >= rect.top + rect.height / 2);
      draggedId = null;
      clear();
      if (changed) persist();
    });
  });
}

function wireDrag(el, p) {
  if (!p) return;
  let from = null;
  el.querySelectorAll('.prow[draggable]').forEach((row) => {
    row.addEventListener('dragstart', (e) => {
      from = +row.dataset.idx;
      row.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    row.addEventListener('dragend', () => row.classList.remove('dragging'));
    row.addEventListener('dragover', (e) => {
      e.preventDefault();
      el.querySelectorAll('.drop-above,.drop-below').forEach((x) => x.classList.remove('drop-above', 'drop-below'));
      const r = row.getBoundingClientRect();
      row.classList.add(e.clientY < r.top + r.height / 2 ? 'drop-above' : 'drop-below');
    });
    row.addEventListener('drop', (e) => {
      e.preventDefault();
      const r = row.getBoundingClientRect();
      let to = +row.dataset.idx + (e.clientY < r.top + r.height / 2 ? 0 : 1);
      if (from == null) return;
      const [moved] = p.tracks.splice(from, 1);
      if (to > from) to--;
      p.tracks.splice(to, 0, moved);
      from = null;
      saveUser();
      emit('playlists');
    });
  });
}

// Android-installable read-only companion: local metadata + optional local audio in IndexedDB.
const $ = (q) => document.querySelector(q);
const escapeText = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nameKey = (s) => String(s || '').trim().toLocaleLowerCase();
const fileKey = (s) => String(s || '').replace(/\\/g,'/').split('/').pop().toLocaleLowerCase();
const duration = (s) => `${Math.floor((s || 0) / 60)}:${String(Math.floor((s || 0) % 60)).padStart(2, '0')}`;
let data = { format:'gatefold-metadata', version:1, tracks:[], playlists:[] };
let page = 'albums', selected = null, filter = '', keyword = '', queue = [], pos = -1, objectURL = null;
const audio = $('#audio');
function notify(msg) { $('#notice').textContent = msg; }
function txComplete(tx) { return new Promise((resolve,reject) => { tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error); }); }
function openDb() {
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open('gatefold-mobile-v1',1);
    req.onupgradeneeded=()=>{const db=req.result;db.createObjectStore('state');db.createObjectStore('audio');};
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
}
let db;
async function get(store,key) {return new Promise((resolve,reject)=>{const r=db.transaction(store,'readonly').objectStore(store).get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function save(store,key,value) {const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(value,key);await txComplete(tx);}
function credits(value){return [...new Set(String(value||'Unknown Artist').split(';').map(s=>s.trim()).filter(Boolean))];}
function albums() {
 const by=new Map();for(const t of data.tracks){const key=[t.albumArtist,t.albumTitle].join('\u0001');if(!by.has(key))by.set(key,{key,artist:t.albumArtist,title:t.albumTitle,year:t.year||0,month:t.month||0,day:t.day||0,tracks:[]});by.get(key).tracks.push(t);}
 const result=[...by.values()];for(const a of result)a.tracks.sort((x,y)=>(x.discN||1)-(y.discN||1)||(x.track||0)-(y.track||0)||x.title.localeCompare(y.title));
 return result.sort((a,b)=>(a.year||9999)-(b.year||9999)||(a.month||0)-(b.month||0)||(a.day||0)-(b.day||0)||a.title.localeCompare(b.title));
}
function options(){const v=new Set();for(const t of data.tracks){for(const f of ['genre','mood'])for(const n of String(t[f]||'').split(/[,;/]/).map(s=>s.trim()).filter(Boolean))v.add(`${f}:${n}`);}$('#filter').innerHTML='<option value="">All genres and moods</option>'+[...v].sort().map(s=>`<option value="${escapeText(s)}">${escapeText(s.startsWith('genre:')?'Genre: '+s.slice(6):'Mood: '+s.slice(5))}</option>`).join('');$('#filter').value=filter;}
function matches(t){if(keyword&&!`${t.title} ${t.artist} ${t.albumTitle} ${t.albumArtist} ${t.genre} ${t.mood}`.toLocaleLowerCase().includes(keyword))return false;
 if(!filter)return true;const n=filter.indexOf(':'),k=filter.slice(0,n),v=filter.slice(n+1).toLocaleLowerCase();return String(t[k]||'').split(/[,;/]/).some(s=>s.trim().toLocaleLowerCase()===v);}
function tile(a){let hue=0;for(let i=0;i<a.title.length;i++)hue=(hue*31+a.title.charCodeAt(i))%360;return `<button class="tile" data-album="${escapeText(a.key)}"><span class="cover" style="--h:${hue}">${escapeText(a.title.slice(0,2).toUpperCase())}</span><span class="title">${escapeText(a.title)}</span><span class="meta">${escapeText(a.artist)} · ${a.year||'—'} · ${duration(a.tracks.reduce((n,t)=>n+(t.duration||0),0))}</span></button>`;}
function songRow(t){return `<button class="item" data-song="${escapeText(t.id)}">${escapeText(t.title)}<small>${escapeText(t.artist)} · ${escapeText(t.albumTitle)} · ${duration(t.duration)}</small></button>`;}
function render(){const catalog=$('#catalog'),a=albums();
 if(page==='albums'&&selected){const album=a.find(x=>x.key===selected);if(!album){selected=null;return render();}let disc=-1;catalog.innerHTML=`<button class="back" data-back>← All albums</button><section class="detail"><h2>${escapeText(album.title)}</h2><p class="muted">${escapeText(album.artist)} · ${album.year||'—'}</p><div class="list">${album.tracks.map(t=>{let heading='';if(disc!==t.discN){disc=t.discN;heading=t.discSubtitle|| (album.tracks.some(x=>x.discN!==disc)?`Disc ${disc}`:'');}return `${heading?`<h3 class="disc">${escapeText(heading)}</h3>`:''}${songRow(t)}`;}).join('')}</div></section>`;return;}
 if(page==='albums'){const arr=a.filter(x=>x.tracks.some(matches));catalog.innerHTML=arr.length?`<div class="albumgrid">${arr.map(tile).join('')}</div>`:'<div class="empty">No matching albums.</div>';}
 if(page==='artists'){const names=[...new Set(a.flatMap(x=>credits(x.artist)))].sort();catalog.innerHTML=`<div class="list">${names.map(n=>`<button class="item" data-artist="${escapeText(n)}">${escapeText(n)}<small>${a.filter(x=>credits(x.artist).includes(n)).length} albums</small></button>`).join('')}</div>`;}
 if(page==='songs'){const rows=data.tracks.filter(matches).sort((x,y)=>x.title.localeCompare(y.title));catalog.innerHTML=rows.length?`<div class="list">${rows.map(songRow).join('')}</div>`:'<div class="empty">No matching songs.</div>';}
 if(page==='playlists'){catalog.innerHTML=`<div class="list">${(data.playlists||[]).map((p,i)=>`<button class="item" data-playlist="${i}">${escapeText(p.name)}<small>${p.tracks.length} songs</small></button>`).join('')}</div>`;}
 if(page==='playlist-detail'){const p=data.playlists[Number(selected)];catalog.innerHTML=`<button class="back" data-back>← Playlists</button><h2>${escapeText(p?.name||'Playlist')}</h2><div class="list">${(p?.tracks||[]).map(x=>data.tracks.find(t=>t.id===x.id)).filter(Boolean).map(songRow).join('')}</div>`;}
 if(page==='artist-detail'){const arr=a.filter(x=>credits(x.artist).includes(selected)&&x.tracks.some(matches));catalog.innerHTML=`<button class="back" data-back>← Artists</button><h2>${escapeText(selected)}</h2><div class="albumgrid">${arr.map(tile).join('')}</div>`;}
}
function playerList(id){if(page==='playlist-detail'){const p=data.playlists[Number(selected)];return(p?.tracks||[]).map(x=>x.id).filter(x=>data.tracks.some(t=>t.id===x));}
 if(page==='albums'&&selected){const a=albums().find(x=>x.key===selected);if(a)return a.tracks.map(t=>t.id);}
 return data.tracks.filter(matches).map(t=>t.id);}
async function playAt(index){if(index<0||index>=queue.length)return;pos=index;const t=data.tracks.find(t=>t.id===queue[pos]);if(!t)return;
 const blob=await get('audio',t.id);if(objectURL)URL.revokeObjectURL(objectURL);objectURL=null;
 $('#current').textContent=`${t.title} — ${t.artist}`;
 if(!blob){notify(`Audio not imported for “${t.title}”. Select its music file above.`);audio.removeAttribute('src');return;}
 objectURL=URL.createObjectURL(blob);audio.src=objectURL;try{await audio.play();}catch{notify('Tap Play to start playback, or check audio format support.');}
}
$('#catalog').addEventListener('click',e=>{const t=e.target.closest('[data-back],[data-album],[data-artist],[data-song],[data-playlist]');if(!t)return;
 if(t.hasAttribute('data-back')){page=page==='playlist-detail'?'playlists':page==='artist-detail'?'artists':'albums';selected=null;}
 else if(t.dataset.album){page='albums';selected=t.dataset.album;}
 else if(t.dataset.artist){page='artist-detail';selected=t.dataset.artist;}
 else if(t.dataset.playlist){page='playlist-detail';selected=t.dataset.playlist;}
 else if(t.dataset.song){const id=t.dataset.song;queue=playerList(id);pos=queue.indexOf(id);if(pos<0){queue=[id];pos=0;}playAt(pos);}
 render();});
document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{page=b.dataset.tab;selected=null;document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('chosen',x===b));render();}));
$('#search').addEventListener('input',e=>{keyword=e.target.value.trim().toLocaleLowerCase();render();});
$('#filter').addEventListener('change',e=>{filter=e.target.value;render();});
$('#prev').addEventListener('click',()=>playAt(Math.max(0,pos-1)));
$('#next').addEventListener('click',()=>playAt(pos+1));
$('#play').addEventListener('click',()=>{if(audio.paused){if(pos<0&&data.tracks.length){queue=playerList();playAt(0);}else audio.play().catch(()=>{});}else audio.pause();});
audio.addEventListener('play',()=>$('#play').textContent='❚❚');audio.addEventListener('pause',()=>$('#play').textContent='▶');audio.addEventListener('ended',()=>playAt(pos+1));
$('#meta').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>100_000_000)throw Error('Metadata file too large');const parsed=JSON.parse(await f.text());
 if(parsed.format!=='gatefold-metadata'||parsed.version!==1||!Array.isArray(parsed.tracks)||parsed.tracks.length>300000)throw Error('Not a Gatefold 1.1 metadata file');
 data=parsed;await save('state','library',parsed);options();selected=null;page='albums';render();notify(`Imported ${parsed.tracks.length} songs. Add matching music files to play them.`);
 }catch(err){notify(`Import failed: ${err.message}`);}});
async function addAudio(files){if(!data.tracks.length)return notify('Import the metadata JSON first.');
 const indexed=new Map();for(const t of data.tracks){const n=fileKey(t.fileName);if(!indexed.has(n))indexed.set(n,[]);indexed.get(n).push(t);}
 let count=0,ambiguous=0,failed=0;
 for(const file of files){const candidates=indexed.get(fileKey(file.name))||[];let matches=candidates;
 if(matches.length>1){const parent=file.webkitRelativePath.replace(/\\/g,'/').split('/').slice(-2,-1)[0];matches=candidates.filter(t=>nameKey(t.albumTitle)===nameKey(parent));}
 if(matches.length!==1){if(candidates.length>1)ambiguous++;continue;}
 try{await save('audio',matches[0].id,file);count++;}catch{failed++;}
 }
 notify(`Imported ${count} playable files. ${ambiguous} ambiguous filenames skipped; ${failed} storage failures. Audio support depends on your browser.`);
}
$('#audio-files').addEventListener('change',e=>addAudio([...e.target.files]));$('#audio-folder').addEventListener('change',e=>addAudio([...e.target.files]));
(async()=>{try{db=await openDb();const saved=await get('state','library');if(saved?.tracks){data=saved;options();render();notify(`${data.tracks.length} tracks available. Add music files if not already imported.`);}if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});}catch(err){notify(`Local storage unavailable: ${err.message}`);}})();

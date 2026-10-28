import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, cpSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve('.');
const temp = mkdtempSync(join(tmpdir(), 'gatefold-v110-'));
cpSync(resolve(root, 'src/renderer/js'), join(temp, 'js'), { recursive: true });
writeFileSync(join(temp, 'package.json'), '{"type":"module"}');
globalThis.window = { addEventListener() {}, gf: { saveUser: async () => {} } };
const store = await import(pathToFileURL(join(temp, 'js/store.js')));
const explore = await import(pathToFileURL(join(temp, 'js/views/explore.js')));
const transfer = await import(pathToFileURL(join(temp, 'js/transfer.js')));
const album = await import(pathToFileURL(join(temp, 'js/views/album.js')));
test.after(() => rmSync(temp, { recursive: true, force: true }));

const track = (id, key, artist, year, month, day, trackN = 1) => ({
 id, albumKey:key, albumTitle:key, albumArtist:artist, artist:'Singer', title:id, path:`/home/music/${key}/${id}.mp3`,
 discN:1, track:trackN, duration:180, addedAt:0, year, month, day, genre:'Rock', mood:'Calm', discSubtitle:'First Part',
});
function setup() {
 const tracks = [
  track('dec','Album D','One; Two',2020,12,1),
  track('jan','Album J','Two; Three',2020,1,2),
  track('older','Album O','One',2019,11,1),
  track('day','Album B','One',2020,1,1),
  track('other','Other','Three',2022,2,3),
 ];
 store.S.user = { settings: { forgottenDays:60 }, albumArt:{}, overrides:{}, stats:{tracks:{dec:{n:5,last:1500}},playlists:{}}, playlists:[{name:'Mix',id:'mix',tracks:['dec','jan']}], artistImages:{} };
 const albums = Object.fromEntries(tracks.map(t=>[t.albumKey,{art:null,dirs:[]}]));
 store.setLibrary({tracks,albums});
 return { tracks, albums };
}

test('albums sort by year, then month, then day, while only year displays in album metadata',()=>{
 setup();
 assert.deepEqual(store.S.albumList.map(a=>a.title),['Album O','Album B','Album J','Album D','Other']);
 const a = store.S.albums.get('Album D');
 assert.equal(album.albumMeta(a),'2020 · 3:00');
 assert.ok(!album.albumMeta(a).includes('12'));
});

test('semicolon-separated album artist credits map the same album under both artist names',()=>{
 setup();
 assert.deepEqual([...store.S.artists.keys()].sort(),['One','Three','Two']);
 assert.ok(store.S.artists.get('One').albums.some(a=>a.key==='Album D'));
 assert.ok(store.S.artists.get('Two').albums.some(a=>a.key==='Album D'));
 assert.ok(store.S.artists.get('Three').albums.some(a=>a.key==='Album J'));
 assert.match(album.albumDetail(store.S.albums.get('Album D')), /data-name="One"/);
 assert.match(album.albumDetail(store.S.albums.get('Album D')), /data-name="Two"/);
});

test('genre and mood selection limit random-song choices and ranks',()=>{
 setup();
 assert.ok(explore.randomChoices().includes('genre:Rock'));
 assert.ok(explore.randomChoices().includes('mood:Calm'));
 store.S.ui.randomFilter='mood:calm';
 assert.equal(explore.randomSongIds().length,5);
 store.S.ui.randomFilter='genre:metal';
 assert.equal(explore.randomSongIds().length,0);
 store.S.ui.randomFilter='';
});

test('metadata export restores edits, play counts and playlist membership across renamed folders',()=>{
 const {tracks} = setup();
 store.S.user.overrides.dec={artist:'New Artist',albumTitle:'Retitled',month:11,lyrics:'Edited lyrics'};
 const exported = transfer.createMetadataExport(store.S.snapshot,store.S.user);
 assert.equal(exported.format,'gatefold-metadata');
 assert.equal(exported.tracks.find(x=>x.id==='dec').fileName,'dec.mp3');
 assert.ok(!JSON.stringify(exported).includes('/home/music'));
 const target = structuredClone(store.S.snapshot);
 for(const t of target.tracks) {t.id='new-'+t.id;t.path=t.path.replace('/home/music','/phone/songs');}
 const newUser = { overrides:{},stats:{tracks:{},playlists:{}},playlists:[],albumArt:{},artistImages:{} };
 const result = transfer.importMetadataExport(exported,target,newUser);
 assert.equal(result.matched,tracks.length);
 assert.equal(newUser.overrides['new-dec'].artist,'New Artist');
 assert.equal(newUser.overrides['new-dec'].lyrics,'Edited lyrics');
 assert.equal(newUser.stats.tracks['new-dec'].n,5);
 assert.deepEqual(newUser.playlists[0].tracks,['new-dec','new-jan']);
 const repeated = transfer.importMetadataExport(exported,target,newUser);
 assert.equal(repeated.playlists,0);
 assert.equal(newUser.stats.tracks['new-dec'].n,5);
});

test('mobile PWA is installable read-only shell without desktop editing controls',()=>{
 const html=readFileSync(resolve(root,'pwa/index.html'),'utf8');
 const js=readFileSync(resolve(root,'pwa/app.js'),'utf8');
 const manifest=JSON.parse(readFileSync(resolve(root,'pwa/manifest.webmanifest'),'utf8'));
 assert.equal(manifest.display,'standalone');
 assert.equal(manifest.start_url,'./');
 assert.match(html,/audio-folder/);
 assert.match(js,/indexedDB\.open/);
 assert.doesNotMatch(html,/album-props|song-props|settings/);
 const workflow=readFileSync(resolve(root,'.github/workflows/deploy-android-pwa.yml'),'utf8');
 assert.match(workflow,/actions\/deploy-pages@v4/);
});

test('Now Playing list remains compact like v1.0.5 and previous/next song property controls exist',()=>{
 const np=readFileSync(resolve(root,'src/renderer/js/views/nowplaying.js'),'utf8');
 const ui=readFileSync(resolve(root,'src/renderer/js/ui.js'),'utf8');
 assert.doesNotMatch(np,/q-disc/);
 assert.match(np,/class="qrow\$\{/);
 assert.match(ui,/data-song-prev/);
 assert.match(ui,/data-song-next/);
 assert.match(ui,/ArrowLeft.*ArrowRight/);
});

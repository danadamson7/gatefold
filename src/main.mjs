import { app, BrowserWindow, ipcMain, protocol, dialog, nativeImage, shell, net } from 'electron';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Library, hash } from './library.mjs';
import { Transcoder, needsTranscode } from './transcode.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const shotDir = process.env.GATEFOLD_SHOT;
if (process.env.GATEFOLD_USERDATA) app.setPath('userData', path.resolve(process.env.GATEFOLD_USERDATA));
if (shotDir) app.commandLine.appendSwitch('mute-audio');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

protocol.registerSchemesAsPrivileged([{
  scheme: 'gf',
  privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true },
}]);

if (!shotDir && !app.requestSingleInstanceLock()) app.quit();

const userData = () => app.getPath('userData');
let lib;
let transcoder;
let win;

const MIME = {
  mp3: 'audio/mpeg', flac: 'audio/flac', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg', m4a: 'audio/mp4',
  mp4: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav', webm: 'audio/webm',
  html: 'text/html', js: 'text/javascript', css: 'text/css', svg: 'image/svg+xml', png: 'image/png',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', woff2: 'font/woff2', json: 'application/json',
};
const mimeOf = (p) => MIME[path.extname(p).slice(1).toLowerCase()] || 'application/octet-stream';

// Serves a local file with HTTP Range support so <audio> can seek.
async function serveFile(file, request, type = mimeOf(file)) {
  let size;
  try {
    size = (await fsp.stat(file)).size;
  } catch {
    return new Response('not found', { status: 404 });
  }
  const headers = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' };
  const range = /bytes=(\d*)-(\d*)/.exec(request.headers.get('range') || '');
  let start = 0;
  let end = size - 1;
  let status = 200;
  if (range && (range[1] || range[2])) {
    if (range[1]) {
      start = +range[1];
      if (range[2]) end = Math.min(+range[2], size - 1);
    } else start = Math.max(0, size - +range[2]);
    if (start >= size) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
    status = 206;
    headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
  }
  headers['Content-Length'] = String(end - start + 1);
  return new Response(Readable.toWeb(fs.createReadStream(file, { start, end })), { status, headers });
}

function inside(base, rel) {
  const p = path.join(base, rel);
  return p.startsWith(base + path.sep) ? p : null;
}

async function handle(request) {
  const url = new URL(request.url);
  const parts = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  const [kind, ...rest] = parts.split('/');
  const name = rest.join('/');
  if (kind === 'media') {
    const t = lib.track(name);
    if (!t) return new Response('unknown track', { status: 404 });
    if (needsTranscode(t)) {
      try {
        return serveFile(await transcoder.get(t), request, 'audio/ogg');
      } catch (err) {
        return new Response(String(err.message), { status: 500 });
      }
    }
    return serveFile(t.path, request);
  }
  if (kind === 'art') {
    const p = inside(lib.artDir, name);
    return p ? serveFile(p, request) : new Response(null, { status: 404 });
  }
  if (kind === 'custom') {
    const p = inside(path.join(userData(), 'custom'), name);
    return p ? serveFile(p, request) : new Response(null, { status: 404 });
  }
  const p = inside(path.join(here, 'renderer'), parts || 'index.html');
  return p ? net.fetch(pathToFileURL(p).toString()) : new Response(null, { status: 404 });
}

// ---- user data (settings, play counts, playlists): owned by the renderer, persisted here ----
const userFile = () => path.join(userData(), 'user.json');
function readUser() {
  try {
    return JSON.parse(fs.readFileSync(userFile(), 'utf8'));
  } catch {
    return null;
  }
}
let userWrite = Promise.resolve();
function saveUser(json) {
  userWrite = userWrite.then(async () => {
    const tmp = userFile() + '.tmp';
    await fsp.writeFile(tmp, json);
    await fsp.rename(tmp, userFile());
  }).catch((err) => console.error('saving user data failed', err));
  return userWrite;
}

// ---- window bounds ----
const boundsFile = () => path.join(userData(), 'window.json');
function loadBounds() {
  try {
    return JSON.parse(fs.readFileSync(boundsFile(), 'utf8'));
  } catch {
    return { width: 1440, height: 900 };
  }
}

function parseLrc(text) {
  const lines = [];
  for (const raw of text.split(/\r?\n/)) {
    const stamps = [...raw.matchAll(/\[(\d+):(\d+(?:[.:]\d+)?)\]/g)];
    if (!stamps.length) continue;
    const words = raw.replace(/\[[^\]]*\]/g, '').trim();
    for (const s of stamps) lines.push([Math.round((+s[1] * 60 + parseFloat(s[2].replace(':', '.'))) * 1000), words]);
  }
  return lines.sort((a, b) => a[0] - b[0]);
}

async function importImage(file) {
  const img = nativeImage.createFromPath(file);
  if (img.isEmpty()) throw new Error('Not a readable image');
  const dir = path.join(userData(), 'custom');
  await fsp.mkdir(dir, { recursive: true });
  const name = hash(file + Date.now()) + '.jpg';
  const out = img.getSize().width > 1000 ? img.resize({ width: 1000, quality: 'best' }) : img;
  await fsp.writeFile(path.join(dir, name), out.toJPEG(90));
  return name;
}

function registerIpc() {
  ipcMain.handle('app:info', () => ({
    musicDir: app.getPath('music'),
    testFolders: process.env.GATEFOLD_FOLDERS ? process.env.GATEFOLD_FOLDERS.split(path.delimiter) : null,
    shot: !!shotDir,
    version: app.getVersion(),
    platform: process.platform,
  }));
  ipcMain.handle('lib:get', () => lib.snapshot());
  ipcMain.handle('lib:scan', async (_e, { folders, merge }) => {
    const res = await lib.scan(folders, {
      merge,
      onProgress: (p) => win?.webContents.send('scan:progress', p),
    });
    return { ...res, library: lib.snapshot() };
  });
  ipcMain.handle('user:get', () => readUser());
  ipcMain.handle('user:save', (_e, json) => saveUser(json));
  ipcMain.handle('metadata:export', async (_e, json) => {
    if (typeof json !== 'string' || json.length > 100_000_000) throw new Error('Invalid metadata export');
    const data = JSON.parse(json);
    if (data?.format !== 'gatefold-metadata' || data?.version !== 1) throw new Error('Invalid Gatefold metadata file');
    const result = await dialog.showSaveDialog(win, {
      title: 'Export Gatefold library metadata',
      defaultPath: 'Gatefold-metadata.json',
      filters: [{ name: 'Gatefold metadata (JSON)', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return false;
    await fsp.writeFile(result.filePath, json, 'utf8');
    return true;
  });
  ipcMain.handle('dialog:folder', async () => {
    const r = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'multiSelections'] });
    return r.canceled ? [] : r.filePaths;
  });
  ipcMain.handle('image:pick', async () => {
    const r = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
    });
    return r.canceled ? null : importImage(r.filePaths[0]);
  });
  ipcMain.handle('lyrics:get', async (_e, id) => {
    const t = lib.track(id);
    if (!t) return null;
    if (t.lrc) {
      try {
        const text = await fsp.readFile(t.path.slice(0, -path.extname(t.path).length) + '.lrc', 'utf8');
        const synced = parseLrc(text);
        if (synced.length) return { synced, source: 'lrc' };
        return { text, source: 'lrc' };
      } catch {
        /* fall through to tags */
      }
    }
    if (t.lyricsSync?.length) return { synced: t.lyricsSync, source: 'tag' };
    if (t.lyrics) return { text: t.lyrics, source: 'tag' };
    return null;
  });
  ipcMain.handle('media:prepare', async (_e, id) => {
    const t = lib.track(id);
    if (t && needsTranscode(t)) await transcoder.get(t).catch(() => {});
  });
  ipcMain.handle('m3u:scan', async (_e, folders) => {
    const byPath = new Map(Object.values(lib.byId).map((t) => [t.path.toLowerCase(), t.id]));
    const found = [];
    const walk = async (dir) => {
      for (const e of await fsp.readdir(dir, { withFileTypes: true }).catch(() => [])) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) await walk(full);
        else if (/\.m3u8?$/i.test(e.name)) {
          const ids = [];
          for (let line of (await fsp.readFile(full, 'utf8')).split(/\r?\n/)) {
            line = line.trim();
            if (!line || line.startsWith('#')) continue;
            const rel = line.replace(/\\/g, '/');
            const abs = path.isAbsolute(rel) ? rel : path.resolve(dir, rel);
            const id = byPath.get(abs.toLowerCase()) || byPath.get(path.join(dir, path.basename(rel)).toLowerCase());
            if (id) ids.push(id);
          }
          if (ids.length) found.push({ name: path.basename(e.name).replace(/\.m3u8?$/i, ''), ids });
        }
      }
    };
    for (const f of folders) await walk(f);
    return found;
  });
  ipcMain.handle('cache:size', () => transcoder.size());
  ipcMain.handle('cache:clear', () => transcoder.clear());
  ipcMain.handle('show:file', (_e, id) => {
    const t = lib.track(id);
    if (t) shell.showItemInFolder(t.path);
  });
  ipcMain.handle('win', (_e, cmd) => {
    if (cmd === 'minimize') win.minimize();
    else if (cmd === 'fullscreen') win.setFullScreen(!win.isFullScreen());
    else if (cmd === 'maximize') (win.isMaximized() ? win.unmaximize() : win.maximize());
    else if (cmd === 'close') win.close();
  });
}

function createWindow() {
  const b = loadBounds();
  win = new BrowserWindow({
    ...b,
    minWidth: 1100,
    minHeight: 680,
    frame: false,
    show: false,
    backgroundColor: '#0b0a08',
    title: 'Gatefold',
    icon: path.join(here, 'renderer', 'icon.png'),
    webPreferences: {
      preload: path.join(here, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      offscreen: !!shotDir,
    },
  });
  if (b.maximized) win.maximize();
  win.once('ready-to-show', () => !shotDir && win.show());
  const sendState = () => win.webContents.send('win:state', { fullscreen: win.isFullScreen(), maximized: win.isMaximized() });
  for (const ev of ['enter-full-screen', 'leave-full-screen', 'maximize', 'unmaximize']) win.on(ev, sendState);
  win.on('close', () => {
    if (shotDir) return;
    const bounds = win.isMaximized() || win.isFullScreen() ? { ...loadBounds(), maximized: win.isMaximized() } : { ...win.getBounds(), maximized: false };
    fs.writeFileSync(boundsFile(), JSON.stringify(bounds));
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  win.loadURL('gf://app/index.html');
}

app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.whenReady().then(async () => {
  lib = new Library(userData());
  transcoder = new Transcoder(path.join(userData(), 'transcode'));
  protocol.handle('gf', handle);
  registerIpc();
  createWindow();
  if (shotDir) (await import('./shoot.mjs')).default(win, shotDir);
});

app.on('window-all-closed', () => app.quit());

// Formats Chromium can't decode (WMA, APE, ALAC, ...) are converted once to Opus with ffmpeg and cached.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const NATIVE = new Set(['mp3', 'flac', 'ogg', 'oga', 'opus', 'm4a', 'mp4', 'aac', 'wav', 'webm']);
const CACHE_LIMIT = 3 * 1024 ** 3;

export function needsTranscode(t) {
  const x = path.extname(t.path).slice(1).toLowerCase();
  return !NATIVE.has(x) || /alac/i.test(t.codec || '');
}

function findFfmpeg() {
  if (process.env.GATEFOLD_FFMPEG) return process.env.GATEFOLD_FFMPEG;
  const exe = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  // Packaged builds ship ffmpeg under resources/ffmpeg/.
  const bundled = process.resourcesPath && path.join(process.resourcesPath, 'ffmpeg', exe);
  if (bundled && fs.existsSync(bundled)) return bundled;
  return exe;
}

export class Transcoder {
  constructor(dir) {
    this.dir = dir;
    this.jobs = new Map();
    this.ffmpeg = findFfmpeg();
    fs.mkdirSync(dir, { recursive: true });
    this.prune().catch(() => {});
  }

  get(track) {
    const out = path.join(this.dir, `${track.id}-${Math.round(track.mtime)}.opus`);
    if (fs.existsSync(out)) return Promise.resolve(out);
    if (!this.jobs.has(out)) {
      const job = this._run(track.path, out).finally(() => this.jobs.delete(out));
      this.jobs.set(out, job);
    }
    return this.jobs.get(out);
  }

  _run(src, out) {
    const tmp = out + '.part';
    return new Promise((resolve, reject) => {
      const p = spawn(this.ffmpeg, ['-loglevel', 'error', '-y', '-i', src, '-vn', '-map_metadata', '-1',
        '-c:a', 'libopus', '-b:a', '192k', '-f', 'ogg', tmp], { stdio: ['ignore', 'ignore', 'pipe'] });
      let err = '';
      p.stderr.on('data', (d) => { err += d; });
      p.on('error', (e) => reject(new Error(`ffmpeg not available (${e.message}). Install ffmpeg to play this format.`)));
      p.on('close', async (code) => {
        if (code !== 0) return reject(new Error(err.trim() || `ffmpeg exited with ${code}`));
        await fsp.rename(tmp, out);
        resolve(out);
      });
    });
  }

  async entries() {
    const names = await fsp.readdir(this.dir);
    return Promise.all(names.map(async (n) => {
      const p = path.join(this.dir, n);
      const st = await fsp.stat(p);
      return { p, size: st.size, used: st.atimeMs || st.mtimeMs };
    }));
  }

  async size() {
    return (await this.entries()).reduce((s, e) => s + e.size, 0);
  }

  async prune() {
    const list = (await this.entries()).sort((a, b) => a.used - b.used);
    let total = list.reduce((s, e) => s + e.size, 0);
    for (const e of list) {
      if (total <= CACHE_LIMIT) break;
      await fsp.rm(e.p, { force: true });
      total -= e.size;
    }
  }

  async clear() {
    for (const e of await this.entries()) await fsp.rm(e.p, { force: true });
  }
}

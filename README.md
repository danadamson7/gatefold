# Gatefold

An album-first music player for Windows and Linux. Gatefold is built around albums rather than single songs: big cover art, track lists grouped by disc, and quick ways to rediscover albums you haven't played in a while.

---

## Installing on Windows

1. Go to the **[Releases page](https://github.com/ryand825/gatefold/releases/latest)** and download **`Gatefold-Setup-1.0.0.exe`** (under *Assets*).
2. Double-click the downloaded file.
3. Windows may show a blue **"Windows protected your PC"** box. This happens because the app isn't signed with a paid certificate, not because anything is wrong. Click **More info**, then **Run anyway**.
4. Choose whether to install for just you or everyone, pick a folder (the default is fine), and click **Install**.
5. Start **Gatefold** from the Start menu or the desktop shortcut.
6. On first launch Gatefold scans your **Music** folder (`C:\Users\<you>\Music`). A thin gold bar under the tabs shows progress.
   - If your music is somewhere else, click the **☰** button (top-left) → **Add folder…** and pick it. You can add several folders, including external drives.

That's it. Everything needed, including the converter for **WMA** files, is in the installer.

**Updating:** download the newer installer from Releases and run it; your play counts and playlists are kept.
**Uninstalling:** *Settings → Apps → Installed apps → Gatefold → Uninstall*. Your play counts and playlists stay in `%APPDATA%\Gatefold`. Delete that folder too if you want everything gone.

## Installing on Linux

1. Download **`Gatefold-1.0.0.AppImage`** from the [Releases page](https://github.com/ryand825/gatefold/releases/latest).
2. Make it executable: right-click → Properties → *Allow executing*, or `chmod +x Gatefold-1.0.0.AppImage`.
3. Double-click it to run. It scans `~/Music` on first launch.

WMA files need `ffmpeg` installed (`sudo apt install ffmpeg`, `sudo dnf install ffmpeg`, etc.). Most distros already have it.

---

## Using Gatefold

The five tabs across the top:

| Tab | What it does |
| --- | --- |
| 🧭 **Explore** | Five quick-play columns: **Most Played** albums & playlists, **Newly Added**, **Forgotten Listens** (albums you used to play but haven't in 60+ days), **Never Played**, and **Random Song**. The round button at the top of each column plays something from it immediately. |
| 𝄞 **Artists** | Album artists down the left (sort **A–Z** or by album **Count**). **All Artists** shows every album in chronological order. Click an album to open its track list. |
| 💿 **Now Playing** | Song list on the left (the playing song is bold), big cover in the middle, lyrics on the right. |
| 📼 **Playlists** | Your playlists with their pictures. Drag songs to reorder them. |
| ♪ **Songs** | Every song in one sortable table. Click a column header to sort; the **Columns** button chooses which columns show. Pick an artist on the left to filter. |

The bar at the bottom has previous / play-pause / next, the song title with a seek bar, volume (0–100%), **repeat** (click to cycle off → all → one), **shuffle**, and the **EQ** button for the 10-band equalizer with presets.

Top-left: **☰** settings and **🔍** search. Top-right: minimize, full screen, exit.

### Tips

- **Right-click almost anything** (a song, album, artist or playlist) for more options: *Add to playlist*, *Play next*, *Song properties…*, *Change album art…*, *Set artist picture…*, and more.
- **Double-click** a song to play it, or hover and click the ▶ that appears.
- **New playlist:** Playlists tab → **+ New**, or right-click any song/album → *Add to playlist* → *New playlist…*. Click a playlist's picture to change it. *Import .m3u playlists* picks up playlists saved by other players.
- **Album art** is taken from the music files or from `folder.jpg` / `cover.jpg` in the album folder. If an album has none, right-click it → *Change album art…* and pick any JPG or PNG.
- **Lyrics** are read from the music files or from a `.lrc` file with the same name as the song (synced `.lrc` lyrics scroll along with the music). You can also type or paste them: Now Playing → **Add lyrics**.
- **Song properties** shows track title, artist, album artist, album, track # of #, disc # of #, length, times played, year, genre, mood, comments and lyrics. Edits are saved inside Gatefold; **your music files are never changed**.
- Albums split into folders like **"Album Disc 1" / "Album Disc 2"** or **CD1 / CD2** are combined into a single album with disc headings. You can turn this off in ☰ settings.
- A song counts as "played" once you've listened to half of it (or 4 minutes).

### Keyboard shortcuts

| Key | Action |
| --- | --- |
| Space | Play / pause |
| Ctrl + ← / → | Previous / next song |
| Ctrl + 1 … 5 | Switch tab |
| Ctrl + F | Search |
| F11 | Full screen |
| Esc | Close a panel / go back |

### Supported formats

MP3, FLAC, WMA, M4A/AAC, Ogg Vorbis, Opus, WAV, and also APE and ALAC. WMA, APE and ALAC are converted in the background the first time they play, so there's a brief pause on the first play only.

---

## For developers

Requires Node.js 20+.

```sh
npm ci
npm start                             # run from source
python3 tools/make_test_library.py    # generate a small tagged test library in ./test-library
npm run shots                         # headless UI tour against ./test-library, screenshots in ./shots
npm run dist:linux                    # build the AppImage
npm run dist:win                      # build the Windows installer
```

The Windows build bundles `vendor/ffmpeg/win32/ffmpeg.exe`, which is not in git. Get it from the [BtbN FFmpeg builds](https://github.com/BtbN/FFmpeg-Builds/releases) (`ffmpeg-master-latest-win64-lgpl.zip` → `bin/ffmpeg.exe`, plus its `LICENSE.txt`). Building the Windows installer on Linux needs `wine` on the PATH.

### Releases

Pushing a tag like `v1.0.1` (matching the `version` in `package.json`) runs `.github/workflows/release.yml`: it builds the Windows installer on a Windows runner (downloading ffmpeg itself) and the Linux AppImage, then attaches both to a GitHub Release. You can also run it by hand from the Actions tab (Run workflow) to get the builds as downloadable artifacts without releasing.

Built with [Electron](https://www.electronjs.org/) and [music-metadata](https://github.com/Borewit/music-metadata). The Windows installer includes [FFmpeg](https://ffmpeg.org/) (LGPL) for WMA/APE/ALAC playback.

## License

MIT. See [LICENSE](LICENSE).

> **Gatefold v1.1.1:** Restores the v1.0.5 Now Playing Song List, enlarges v1.1.0 playlist covers by 30%, and letterboxes/pillarboxes non-square album art on black. Retains the v1.1.0 metadata transfer, full release-date sorting, multi-artist credits, genre/mood filtering, and Android PWA. See `CHANGELOG-REQUESTED-CHANGES.md`.

# Gatefold

An album-first music player for Windows and Linux. Gatefold is built around albums rather than single songs: big cover art, track lists grouped by disc, and quick ways to rediscover albums you haven't played in a while.

---

## Build the Windows setup installer (no coding required)

This modified source package includes `BUILD_WINDOWS_INSTALLER.cmd`.
On a 64-bit Windows 10 or 11 PC, extract the ZIP and double-click that
file. The script downloads the necessary tools, runs the tests and
attempts to create `Gatefold-Setup-1.1.1.exe` alongside it. An internet
connection is required. See `HOW_TO_CREATE_INSTALLER.txt` for details.

**This ZIP is not itself an installer.** A Windows build must succeed before
any `.exe` is available. The one-click builder has not been verified on
Windows in the environment where the modification was prepared.

---

## Installing on Windows

**Download Gatefold v1.1.1 from the successful Windows installer GitHub Actions workflow (Actions → Windows installer (CI) → Artifacts).** A release may also be published after a version tag is built.

1. Download the `Gatefold-Setup-Windows` artifact from the latest successful [Windows installer workflow](https://github.com/danadamson7/gatefold/actions/workflows/build-windows-installer.yml); extract its ZIP to find `Gatefold-Setup-1.1.1.exe`.
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

1. When a Linux build is published, download its `.AppImage` from the [Releases page](https://github.com/danadamson7/gatefold/releases).
2. Make it executable: right-click → Properties → *Allow executing*, or `chmod +x Gatefold-1.1.1.AppImage`.
3. Double-click it to run. It scans `~/Music` on first launch.

WMA files need `ffmpeg` installed (`sudo apt install ffmpeg`, `sudo dnf install ffmpeg`, etc.). Most distros already have it.

---

## Using Gatefold

The five tabs across the top:

| Tab | What it does |
| --- | --- |
| 🧭 **Explore** | Five quick-play columns: **Most Played** (your top 25 played albums), **Newly Added**, **Forgotten Listens** (albums you used to play but haven't in 60+ days), **Never Played**, and **Random Song**. The round button at the top of each column plays something from it immediately. |
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
- **Song properties** has separate editable **Artist** and **Album Artist** fields, alongside track title, year, genre, mood, comments and lyrics. Edits are saved inside Gatefold; **your music files are never changed**.
- **Album properties** (open an album → **Properties**) lets you edit the album title, album artist, all-song artist (optional), genre, release year/month/day, disc count, per-disc subtitles, comments and cover art. If an album already has different artists, genres or comments on its songs, leaving the mixed-value field blank preserves the song-specific values. All overrides survive future music-library rescans.
- **Search** (Ctrl+F): choose a song result to open its containing album and highlight the song, without starting playback. Press **Esc** or click the **Esc** button to dismiss search.
- **Album Artist sidebar:** click an entry or focus the sidebar and type an artist name to jump to the matching artist.
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

## Download the latest Windows installer from GitHub

Whenever a commit is pushed to `main`, GitHub Actions will try to build the Windows setup executable. You can also start it manually:

1. Open [Windows installer (CI)](https://github.com/danadamson7/gatefold/actions/workflows/build-windows-installer.yml).
2. Open the latest successful run and download the `Gatefold-Setup-Windows` artifact.
3. Extract its ZIP and run `Gatefold-Setup-1.1.1.exe` on Windows.

The executable is not code-signed, so Windows SmartScreen may show a warning. The existing `release.yml` builds Windows and Linux release packages from version tags. For v1.0.6, update the version in `package.json` and `package-lock.json` and publish the new code using the same GitHub repository.

---

## For developers

Requires Node.js 20+.

```sh
npm ci
npm start                             # run from source
npm test                              # metadata and ranking regression tests
python3 tools/make_test_library.py    # generate a small tagged test library in ./test-library
npm run shots                         # headless UI tour against ./test-library, screenshots in ./shots
npm run dist:linux                    # build the AppImage
npm run dist:win                      # build the Windows installer
```

The Windows build bundles `vendor/ffmpeg/win32/ffmpeg.exe`, which is not in git. Get it from the [BtbN FFmpeg builds](https://github.com/BtbN/FFmpeg-Builds/releases) (`ffmpeg-master-latest-win64-lgpl.zip` → `bin/ffmpeg.exe`, plus its `LICENSE.txt`). Building the Windows installer on Linux needs `wine` on the PATH.

Built with [Electron](https://www.electronjs.org/) and [music-metadata](https://github.com/Borewit/music-metadata). The Windows installer includes [FFmpeg](https://ffmpeg.org/) (LGPL) for WMA/APE/ALAC playback.

## License

MIT. See [LICENSE](LICENSE).

## Gatefold Mobile (Android PWA)

The `pwa/` directory contains a **read-only**, offline-capable Android music browser/player. It does not change album/song properties or desktop settings. It **does not automatically stream from Windows**: use Settings → Statistics → Export metadata in Gatefold, copy the JSON and audio files to the phone, then import them into the PWA. Unsupported browser codecs require audio conversion. For install steps and GitHub Pages hosting, see [`pwa/README.md`](pwa/README.md).

## Metadata transfer between Gatefold installations

Settings → Statistics → **Export metadata** creates a portable JSON file with song and album overrides, play counts, timestamps, and playlist membership, without audio or custom art. On another installation, scan your music folder first, then use Settings → Statistics → **Import metadata**. Matching songs keep their play counts and edited fields. Filename/album/disc/track/duration identifiers are used when original paths differ; unmatched and ambiguous songs are skipped. Re-importing the same export replaces matched statistics instead of adding counts.

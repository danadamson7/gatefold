# Gatefold 1.0.5 — playlist layout update

Based on the previously customized Gatefold v1.0.4. All earlier changes are retained.

## Playlists page changes

- **New two-column layout:** the playlist cover and its details are grouped on the left; the song list table appears on the right on desktop-sized windows.
- Playlist title, song count / total duration, and **Play**, **Shuffle**, **Rename**, **Delete** buttons now appear **below the cover**, instead of beside it.
- Main playlist artwork increased by **30%** relative to v1.0.4, from a 414px maximum to **538px** (414 x 1.3 = 538.2, rounded to the nearest pixel).
- Sidebar playlist thumbnails increased by **30%**, from 69px to **90px** (69 x 1.3 = 89.7, rounded to the nearest pixel).
- Artwork reduces as needed to fit the available left column. On window widths below 1160px, the song list stacks beneath the cover/details to keep it usable.
- Playlist playback, image replacement, song reordering, renaming, and deletion still use the existing event handlers.

## Package and installer builder

- Updated application and lockfile version to **1.0.5**.
- Windows double-click build script targets `Gatefold-Setup-1.0.5.exe`.
- This archive is an updated **source/build kit**, not a compiled Windows installer. Building and running the Windows `.exe` has not been verified here.

## Retained previous versions

# Gatefold 1.0.4 — artwork size update

Based on the previously customized Gatefold v1.0.1 supplied in this conversation. All existing modifications remain.

## 50% larger artwork (150% of v1.0.1 sizes)

| Page and location | Before | Version 1.0.4 |
| --- | ---: | ---: |
| Artists: all-artists album cards (minimum width) | 210px | 315px |
| Artists: selected artist album cards (minimum width) | 260px | 390px |
| Artists: album detail artwork maximum width | 300px | 450px |
| Artists: sidebar cover-derived thumbnails | 38px | 57px |
| Now Playing: main album cover (height-based target) | 58vh | 87vh |
| Now Playing: main album cover (pixel cap) | 620px | 930px |
| Playlists: header cover | 276px | 414px |
| Playlists: sidebar thumbnails | 46px | 69px |

Artwork uses available width as an additional limit and may be smaller in narrow windows. The Now Playing pane can scroll vertically if a large cover and its song information do not fit vertically.

## Packaging

- Project and installer artifact version set to **1.0.4**.
- Windows double-click build script and GitHub Actions artifact path now target `Gatefold-Setup-1.0.4.exe`.
- The Windows installer build is *not* included. Windows/Electron packaging has not been executed here.

## Retained v1.0.1 modifications

Editable album properties and release date; distinct artist and album artist; keyboard search dismiss and song-to-album navigation; album artist type-ahead; centered album detail with disc subtitles; wider Now Playing panels and lyrics; Most Played top 25 albums.

## GitHub publishing (October 26, 2026)

- Published source for v1.0.5 to danadamson7/gatefold.
- Added Windows Actions CI on pushes to main, pull requests and manual dispatch.
- Preserved existing tag-triggered Windows/Linux Release workflow.
- Automated Windows artifact builds are not yet independently verified to succeed.

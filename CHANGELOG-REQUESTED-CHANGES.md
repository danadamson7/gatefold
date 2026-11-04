# Gatefold 1.1.5 — Smaller top-center Artists album artwork

- **Artists → selected album:** Decrease the main album cover size to **0.85×** the v1.1.4 dimensions. The responsive CSS changes from `min(450px, 36dvh, 100%)` to `min(382.5px, 30.6dvh, 85%)`.
- The main album cover retains its **top-center** position and existing spacing.
- No changes to the separate alternative album art, playlist layouts, Now Playing, library data, or Android PWA.
- Update package and Windows installer version to 1.1.5, with regression tests.

---

# Gatefold 1.1.4 — Artwork scaling and album backdrop placement

- **Playlists / main cover:** Increase from v1.1.3 by 1.07×; maximum 1029 → **1101 px** (rounded). The viewport-responsive width cap and independently scrollable song list are preserved.
- **Playlists / left sidebar:** Reduce playlist thumbnail size to 0.4× v1.1.3; 172 → **69 px** square (rounded).
- **Artists / selected album:** Move the optional alternative-album-art container to the **bottom center** of the album canvas; enlarge both dimensions 1.6× compared with v1.1.3, increasing maximum width 1100 → **1760 px** at a fixed **2:1** aspect ratio. It remains behind the album controls and tracks, with no change to original album art.
- **Now Playing:** Scale central album cover dimensions by 1.09× relative to v1.1.3; maximum 930 → **1014 px** (rounded), while keeping the existing no-vertical-scroll layout and responsive fit.
- Update project version, lockfile root, setup scripts, and exported metadata version to **1.1.4**.
- Android PWA is unchanged.
- Verify by running `npm test` and the GitHub Actions Windows installer workflow. Desktop layout requires final device-level review.

---

# Gatefold 1.1.3 — Album canvas artwork and playlist scrolling

- **Artists / selected album:** When alternative 2:1 artwork is assigned, show it centered behind the entire album canvas rather than inside the song list. Cover art, album title, metadata, controls, and songs all appear in front of it. No alternate art leaves the normal album backdrop.
- **Playlists:** Scale the main cover to 98% of its v1.1.2 maximum, 1050 → 1029 px. Scale sidebar thumbnails from 175 → 172 px (rounded).
- **Playlists:** Keep the left artwork/title/info/actions panel stationary during song scrolling. The song table has its own vertical overflow and sticky column headings. At narrower widths, a compact left/details panel stays above the independent scrolling list.
- **Version:** 1.1.3 in npm package, dependency lock root, setup scripts, and metadata export.
- All prior desktop features and the Android PWA are retained.

---

# Gatefold 1.1.2 — Layout and alternative album artwork
- Now Playing: Song List and Lyrics widths are 125% of 1.1.1 (352 → 440px and 396 → 495px on large windows). Center album art no longer scrolls vertically; cover scales down to fit.
- Playlists: Cover maximum enlarged from 840px to 1050px, thumbnails from 140px to 175px.
- Album Properties: Separate alternate art selection and removal, center-cropped to true 2:1 and saved independently in user data.
- Artists selected album: Main cover top center; optional 2:1 alternate art behind track list with a dark scrim for readable songs. With no alternate art, display the ordinary song-list background.
- Existing music files and main album covers are not modified. Android PWA is unchanged.
- Tests: npm test. The desktop UI requires final testing in Windows.

---

# Gatefold 1.1.1 — Now Playing and cover artwork refinements

- **Now Playing → Song List** restored to the v1.0.5 compact song-row design; disc subtitle separators are removed. Other v1.1.0 features remain unchanged.
- **Playlists** main cover maximum enlarged from 646px to **840px** (1.3× rounded), and the sidebar playlist thumbnails enlarged from 108px to **140px**. The left column grows accordingly, and the layout continues to stack the song list below on smaller windows.
- **Album artwork** uses square black frames with `object-fit: contain` and centered positioning, preserving original aspect ratios without cropping or stretching. This includes album grids, album details, search thumbnails, Now Playing, and album covers used in playlist mosaics; portrait and landscape images show black padding.
- **Version and Windows setup executable** updated to **1.1.1**.
- No changes to the read-only Android PWA in this desktop-focused patch.

---

# Gatefold 1.1.0 — major update

- **Playlists:** main cover increased by 1.2× from 538 px to 646 px; sidebar thumbnails 90 px to 108 px.
- **Now Playing:** show disc/album subtitles in the Song List at disc transitions.
- **Explore:** the Random Song header now has a genre/mood drop-down populated from tagged songs; random play and dealt song rows honor the chosen filter.
- **Song Properties:** previous/next arrow buttons for album track order; Left/Right keys work when focus is outside editable text fields.
- **Statistics:** export and import portable JSON with song overrides, play counts, and playlists, matching songs across folders; original audio is unchanged.
- **Albums:** chronological year → month → day order, with **year only** shown in the main UI (month/day remain available in Album Properties).
- **Album Artists:** semicolon-separated album artist credits index one album under each individual artist.
- **Android PWA:** separate read-only installable mobile player under `pwa/`, with offline locally imported audio and desktop metadata export. Needs HTTPS hosting (GitHub Pages workflow included); no automatic desktop streaming.

Inherited all Gatefold 1.0.5 functionality and its previous changes.

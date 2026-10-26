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

# Gatefold Mobile PWA — version 1.1.0

**Read-only companion** for Android Chrome; it does not expose settings, album/song property editors, or write back to desktop.

## Install

1. Host the contents of `pwa/` at a real **HTTPS** address (for example GitHub Pages). Opening `file://` or a LAN `http://192.168...` URL is **not** sufficient for an installable PWA.
2. Open the HTTPS URL in Android Chrome; choose **Install app** or **Add to Home screen**.
3. In Windows Gatefold 1.1.0, open Settings → Statistics → **Export metadata** and transfer the JSON file to your phone.
4. In the PWA choose **Import Gatefold metadata JSON**; then **Add music files** or **Add music folder** selecting audio files already copied to the Android device. Metadata JSON contains **no music audio or album-art binaries**. The app imports the selected audio into its private IndexedDB storage for offline listening.
5. Tap an album, playlist, artist or song to browse and play locally imported audio.

### Important limitations

- Gatefold has no internet music-streaming backend, so the phone cannot automatically stream the PC library. You must copy/import music onto your phone.
- Browser-supported codecs vary; WMA and APE may not play. Convert unsupported files before copying.
- Browser storage can be evicted, and duplicate filenames from different albums may require folder import to disambiguate; protect your original files.
- Play counts, song and album properties are read-only in the PWA; playback does not sync statistics back to Windows.
- Custom album/playlist art is not embedded in the metadata JSON. Mobile displays artwork placeholders.
- The GitHub Actions deploy job requires GitHub Pages to be enabled with **Source: GitHub Actions** under repository Settings → Pages. After that, published pages typically use `https://danadamson7.github.io/gatefold/`.

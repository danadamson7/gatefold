#!/usr/bin/env python3
"""Generate a small fake music library (sine tones + real tags + cover art) for testing Gatefold.

Covers the tricky cases: multi-disc album with disc subtitles and per-disc track artists, a
"Various Artists" compilation, folder vs embedded art, tag lyrics and a synced .lrc sidecar.

Usage: python3 tools/make_test_library.py [output_dir]   (default: ./test-library)
"""
import os
import random
import subprocess
import sys

OUT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "test-library"))
random.seed(7)


def run(args):
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", *args], check=True)


def cover(path, src):
    run(["-f", "lavfi", "-i", src, "-frames:v", "1", "-update", "1", path])


def tone(path, seconds, freq, tags, fmt, art=None):
    args = ["-f", "lavfi", "-i", f"sine=frequency={freq}:duration={seconds}"]
    if art and fmt in ("mp3", "flac"):
        args += ["-i", art, "-map", "0:a", "-map", "1:v", "-c:v", "png", "-disposition:v", "attached_pic"]
    args += ["-af", "volume=0.15"]
    if fmt == "mp3":
        args += ["-c:a", "libmp3lame", "-b:a", "48k", "-ac", "1", "-id3v2_version", "3"]
    elif fmt == "flac":
        args += ["-c:a", "flac", "-ac", "1", "-sample_fmt", "s16"]
    elif fmt == "ogg":
        args += ["-c:a", "libvorbis", "-q:a", "0", "-ac", "1"]
    for k, v in tags.items():
        args += ["-metadata", f"{k}={v}"]
    run(args + [path])


ALBUMS = [
    dict(artist="Northern Pike", album="Cold Water", year=1998, fmt="mp3", art="folder", genre="Rock",
         src="gradients=s=600x600:c0=0x103050:c1=0x80c0e0:x0=0:y0=0:x1=600:y1=600:speed=0",
         tracks=["Thaw", "Black Ice", "Riverbed", "Long Winter", "Spring Melt", "Undertow"]),
    dict(artist="Northern Pike", album="Ice Out", year=2003, fmt="flac", art="embed", genre="Rock",
         src="mandelbrot=s=600x600:maxiter=200", mood="Brooding",
         tracks=["Breakup", "Open Lake", "Pressure Ridge", "Shove", "Last Sled"]),
    dict(artist="Mara Quill", album="Paper Lanterns", year=2015, fmt="ogg", art="folder", genre="Folk",
         src="cellauto=s=600x600:rule=110:random_fill_ratio=0.5", mood="Gentle",
         tracks=["Lantern Song", "Fold", "Ricepaper", "Crane", "Ember Walk"]),
]

WORKS = dict(artist="Vance, Rook & Hale", album="Workshop Volume 1", year=1977, genre="Progressive Rock",
             src="gradients=s=600x600:c0=0x061428:c1=0x0c2244:speed=0",
             discs=[("Ada Vance", ["Piano Concerto No. 1 (i. Allegro; ii. Andante; iii. Toccata con Fuoco)"]),
                    ("Theo Rook", ["Lend Your Ear", "C'est Ici", "Hallowed Ground", "Nobody Else", "Closer"]),
                    ("Ivo Hale", ["The Enemy Drums", "L.A. Mornings", "New Orleans", "Invention in D Minor"]),
                    ("Vance, Rook & Hale", ["Fanfare for the Night Shift", "Pirates of the Plains"])])

COMP = dict(artist="Various Artists", album="Late Night Radio", year=2021, genre="Jazz",
            src="gradients=s=600x600:c0=0x301040:c1=0xf06080:speed=0",
            tracks=[("Nightcap", "Lena Ford"), ("Static Hymn", "The Dialtones"), ("Dead Air", "Mara Quill"),
                    ("Sign Off", "Northern Pike")])

LRC = """[ar:Northern Pike]
[ti:Thaw]
[00:00.50]The river's waking under me
[00:04.00]A crack runs out across the bay
[00:08.00]I hear the whole lake breathe
[00:12.00]And winter slips away
[00:17.00]Thaw, thaw, let it go
[00:21.00]Down to where the cold waters flow
"""

LYRICS = "Under the ice the pressure grows\nA ridge of white where nobody goes\nHold your breath and count to ten\nThe lake will open up again"


def main():
    os.makedirs(OUT, exist_ok=True)
    for a in ALBUMS:
        d = os.path.join(OUT, a["artist"], f'{a["year"]} - {a["album"]}')
        os.makedirs(d, exist_ok=True)
        art = os.path.join(d, "cover.jpg" if a["art"] == "folder" else ".embed.png")
        cover(art, a["src"])
        n = len(a["tracks"])
        for i, t in enumerate(a["tracks"], 1):
            tags = {"title": t, "artist": a["artist"], "album": a["album"], "date": str(a["year"]), "genre": a["genre"]}
            if a["fmt"] in ("flac", "ogg"):
                tags.update(ALBUMARTIST=a["artist"], TRACKNUMBER=i, TRACKTOTAL=n, DISCNUMBER=1, DISCTOTAL=1)
                if a.get("mood"):
                    tags["MOOD"] = a["mood"]
                if t == "Pressure Ridge":
                    tags["LYRICS"] = LYRICS
                    tags["COMMENT"] = "Recorded in one take."
            else:
                tags.update(album_artist=a["artist"], track=f"{i}/{n}", disc="1/1")
            path = os.path.join(d, f"{i:02d} {t}.{a['fmt']}")
            tone(path, random.randint(25, 75), random.choice([220, 262, 294, 330, 392, 440]), tags, a["fmt"],
                 art if a["art"] == "embed" else None)
            if t == "Thaw":
                with open(os.path.splitext(path)[0] + ".lrc", "w") as f:
                    f.write(LRC)
        if a["art"] == "embed":
            os.remove(art)

    w = WORKS
    d = os.path.join(OUT, w["artist"], f'{w["year"]} - {w["album"]}')
    os.makedirs(d, exist_ok=True)
    art = os.path.join(d, ".embed.png")
    cover(art, w["src"])
    for disc, (subtitle, titles) in enumerate(w["discs"], 1):
        for i, t in enumerate(titles, 1):
            tags = {"title": t, "artist": subtitle, "ALBUMARTIST": w["artist"], "album": w["album"],
                    "date": str(w["year"]), "genre": w["genre"], "TRACKNUMBER": i, "TRACKTOTAL": len(titles),
                    "DISCNUMBER": disc, "DISCTOTAL": len(w["discs"]), "DISCSUBTITLE": subtitle}
            tone(os.path.join(d, f"{disc}-{i:02d} {t}.flac"), random.randint(30, 90), 330, tags, "flac", art)
    os.remove(art)

    c = COMP
    d = os.path.join(OUT, "Compilations", c["album"])
    os.makedirs(d, exist_ok=True)
    cover(os.path.join(d, "folder.jpg"), c["src"])
    for i, (t, ar) in enumerate(c["tracks"], 1):
        tags = {"title": t, "artist": ar, "album_artist": c["artist"], "album": c["album"], "date": str(c["year"]),
                "genre": c["genre"], "track": f"{i}/{len(c['tracks'])}", "disc": "1/1"}
        tone(os.path.join(d, f"{i:02d} {ar} - {t}.mp3"), random.randint(25, 60), 262, tags, "mp3")
    print(OUT)


if __name__ == "__main__":
    main()

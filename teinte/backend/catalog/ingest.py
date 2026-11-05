"""
Fill the image catalogue from Unsplash (preferred: editorial-grade fashion, beauty and jewellery photography;
https://unsplash.com/license) or Pexels (https://www.pexels.com/license/). The source is chosen by which key
is set — UNSPLASH_ACCESS_KEY wins — or forced with --source. Both are free for commercial use with credit.

Rate limits are per hour (Unsplash: 50 for a new "demo" app, 5,000 once approved for production;
Pexels: 200), so ingestion runs in two resumable phases:

  pool      one search per category intent, no colour filter, 2 pages × 80 photos      (~140 requests)
  targeted  each intent again per colour profile, filtered to that profile's colour   (~840 requests)

The catalogue is usable after the pool phase; targeted results raise the colour match of every slot
as they arrive. Every response is cached on disk, so re-running never repeats a request, and the job waits
for the hourly quota to reset instead of failing. Downloaded thumbnails (≤130 px tall) are analysed locally
(k-means colours in Lab, edge density for "minimal") — full-size images are hotlinked from Pexels' CDN.

  python -m catalog.ingest                  # both phases, waits for quota resets
  python -m catalog.ingest --phase pool     # just the pool
  python -m catalog.ingest --fake http://127.0.0.1:9002   # against a local fake API (tests)
"""
import argparse
import hashlib
import json
import os
import sqlite3
import sys
import time
import urllib.parse
import urllib.request

import cv2
import numpy as np

from . import rules

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.environ.get("TEINTE_CATALOG_DIR", HERE)
DB = os.path.join(DATA, "catalog.db")
CACHE = os.path.join(DATA, "cache")
THUMBS = os.path.join(DATA, "thumbs")
API = "https://api.pexels.com/v1/search"
UA = "Teinte/1.0 (colour analysis; catalogue ingest)"

PORTRAIT = {"hairstyles", "clothing", "office", "party", "festive", "date-night", "casual", "vacation", "black-tie"}


def env_key(name="PEXELS_API_KEY"):
    k = os.environ.get(name)
    if k:
        return k
    p = os.path.join(HERE, "..", ".env")
    if os.path.exists(p):
        for line in open(p):
            if line.strip().startswith(f"{name}="):
                return line.split("=", 1)[1].split("#")[0].strip() or None
    return None


def connect():
    os.makedirs(DATA, exist_ok=True)
    db = sqlite3.connect(DB, timeout=120)      # several sources may ingest at once
    db.executescript("""
    CREATE TABLE IF NOT EXISTS items(
      id INTEGER PRIMARY KEY, photographer TEXT, photographer_url TEXT, url TEXT, alt TEXT,
      width INT, height INT, avg_color TEXT, src TEXT, colours TEXT, edge REAL, analysed INT DEFAULT 0);
    CREATE TABLE IF NOT EXISTS candidates(
      item_id INT, category TEXT, gender TEXT, phrase TEXT, profile TEXT, colour TEXT,
      UNIQUE(item_id, category, gender, phrase, profile));
    CREATE TABLE IF NOT EXISTS slots(
      profile TEXT, category TEXT, gender TEXT, rank INT, item_id INT, score REAL, match TEXT, match_hex TEXT,
      PRIMARY KEY(profile, category, gender, rank));
    CREATE INDEX IF NOT EXISTS cand_cg ON candidates(category, gender);
    """)
    if "source" not in {r[1] for r in db.execute("PRAGMA table_info(items)")}:
        db.execute("ALTER TABLE items ADD COLUMN source TEXT DEFAULT 'Pexels'")
    return db


class Pexels:
    name, page_size = "Pexels", 80

    def __init__(self, key, base=API):
        self.key, self.base = key, base
        self.remaining, self.reset = None, None
        os.makedirs(CACHE, exist_ok=True)

    def search(self, query, per_page=80, page=1, color=None, orientation=None):
        params = {"query": query, "per_page": per_page, "page": page}
        if color:
            params["color"] = color.lstrip("#")
        if orientation:
            params["orientation"] = orientation
        url = f"{self.base}?{urllib.parse.urlencode(params)}"
        path = os.path.join(CACHE, hashlib.sha1(url.encode()).hexdigest() + ".json")
        if os.path.exists(path):
            return json.load(open(path)), True
        while True:
            if self.remaining == 0 and self.reset:
                wait = max(5, self.reset - time.time() + 5)
                print(f"  quota used up — waiting {wait / 60:.0f} min for the hourly reset", flush=True)
                time.sleep(wait)
                self.remaining = None
            req = urllib.request.Request(url, headers={"Authorization": self.key, "User-Agent": UA})
            try:
                with urllib.request.urlopen(req, timeout=40) as r:
                    self.remaining = int(r.headers.get("X-Ratelimit-Remaining", "1"))
                    self.reset = float(r.headers.get("X-Ratelimit-Reset", time.time() + 3600))
                    data = json.load(r)
                break
            except urllib.error.HTTPError as e:
                if e.code == 429:
                    self.remaining, self.reset = 0, float(e.headers.get("X-Ratelimit-Reset", time.time() + 900))
                    continue
                if e.code == 401:
                    sys.exit("Pexels rejected the API key (401). Check PEXELS_API_KEY in backend/.env.")
                raise
        json.dump(data, open(path, "w"))
        return data, False


# Unsplash's colour filter takes names, not hex — map each target colour to the nearest name in Lab space
UNSPLASH_COLOURS = {"black": "#141414", "white": "#f4f4f2", "yellow": "#e8c33a", "orange": "#e07b25", "red": "#c0392b",
                    "purple": "#6a3d9a", "magenta": "#c2185b", "green": "#4f7a3a", "teal": "#1e6f6c", "blue": "#2c5aa0"}


def nearest_colour_name(hexc):
    lab = lambda h: cv2.cvtColor(np.uint8([[[int(h[5:7], 16), int(h[3:5], 16), int(h[1:3], 16)]]]), cv2.COLOR_BGR2LAB)[0, 0].astype(float)
    t = lab(hexc)
    return min(UNSPLASH_COLOURS, key=lambda n: np.linalg.norm(lab(UNSPLASH_COLOURS[n]) - t))


class Unsplash(Pexels):
    """Same interface as Pexels; responses are converted to Pexels' shape so the rest of the pipeline is shared.
    Images are hotlinked from images.unsplash.com as the API guidelines require."""
    name, page_size = "Unsplash", 30
    UTM = "utm_source=teinte&utm_medium=referral"

    def __init__(self, key, base="https://api.unsplash.com/search/photos"):
        super().__init__(key, base)

    def search(self, query, per_page=30, page=1, color=None, orientation=None):
        params = {"query": query, "per_page": min(per_page, 30), "page": page, "content_filter": "high"}
        if color:
            params["color"] = nearest_colour_name(color)
        if orientation:
            params["orientation"] = orientation
        url = f"{self.base}?{urllib.parse.urlencode(params)}"
        path = os.path.join(CACHE, "u_" + hashlib.sha1(url.encode()).hexdigest() + ".json")
        if os.path.exists(path):
            return json.load(open(path)), True
        while True:
            if self.remaining == 0:
                wait = max(60, 3600 - (time.time() % 3600) + 30)    # Unsplash resets on the hour
                print(f"  Unsplash hourly limit reached — waiting {wait / 60:.0f} min", flush=True)
                time.sleep(wait)
                self.remaining = None
            req = urllib.request.Request(url, headers={"Authorization": f"Client-ID {self.key}", "Accept-Version": "v1", "User-Agent": UA})
            try:
                with urllib.request.urlopen(req, timeout=40) as r:
                    self.remaining = int(r.headers.get("X-Ratelimit-Remaining", "1"))
                    raw = json.load(r)
                break
            except urllib.error.HTTPError as e:
                if e.code in (403, 429) and "Rate Limit" in (e.read() or b"").decode(errors="ignore") + str(e.headers.get("X-Ratelimit-Remaining")):
                    self.remaining = 0
                    continue
                if e.code == 401:
                    sys.exit("Unsplash rejected the access key (401). Check UNSPLASH_ACCESS_KEY in backend/.env.")
                raise
        data = {"photos": [self.to_pexels(p) for p in raw.get("results", [])]}
        json.dump(data, open(path, "w"))
        return data, False

    def to_pexels(self, p):
        raw = p["urls"]["raw"]
        sized = lambda w, extra="": f"{raw}&w={w}&auto=format&q=80{extra}"
        return dict(id=int(hashlib.sha1(p["id"].encode()).hexdigest()[:13], 16), width=p["width"], height=p["height"],
                    url=f"{p['links']['html']}?{self.UTM}", photographer=p["user"]["name"],
                    photographer_url=f"{p['user']['links']['html']}?{self.UTM}", avg_color=p.get("color"),
                    alt=p.get("alt_description") or p.get("description") or "",
                    src={"small": sized(400), "portrait": sized(800, "&ar=3:4&fit=crop"), "large": sized(940),
                         "large2x": sized(1880)}, source="Unsplash")


class Pixabay(Pexels):
    """Pixabay API (https://pixabay.com/api/docs/). Its terms forbid permanent hotlinking, so photos chosen for the
    catalogue are downloaded by build.py into MEDIA and served from our own server. 100 requests / minute."""
    name, page_size = "Pixabay", 100
    COLOURS = {"red": "#c0392b", "orange": "#e07b25", "yellow": "#e8c33a", "green": "#4f7a3a", "turquoise": "#1e9e9a",
               "blue": "#2c5aa0", "lilac": "#b39ddb", "pink": "#f2a3b5", "white": "#f4f4f2", "gray": "#8e9196",
               "black": "#141414", "brown": "#7a4e2b"}

    def __init__(self, key, base="https://pixabay.com/api/"):
        super().__init__(key, base)

    def search(self, query, per_page=100, page=1, color=None, orientation=None):
        params = {"key": self.key, "q": query[:100], "image_type": "photo", "per_page": min(per_page, 200), "page": page,
                  "safesearch": "true", "order": "popular"}
        if color:
            lab = lambda h: cv2.cvtColor(np.uint8([[[int(h[5:7], 16), int(h[3:5], 16), int(h[1:3], 16)]]]), cv2.COLOR_BGR2LAB)[0, 0].astype(float)
            params["colors"] = min(self.COLOURS, key=lambda n: np.linalg.norm(lab(self.COLOURS[n]) - lab(color)))
        if orientation == "portrait":
            params["orientation"] = "vertical"
        url = f"{self.base}?{urllib.parse.urlencode(params)}"
        path = os.path.join(CACHE, "x_" + hashlib.sha1(url.replace(self.key, "KEY").encode()).hexdigest() + ".json")
        if os.path.exists(path):
            return json.load(open(path)), True
        for attempt in range(5):
            try:
                with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=40) as r:
                    self.remaining = int(r.headers.get("X-RateLimit-Remaining", "1"))
                    raw = json.load(r)
                break
            except urllib.error.HTTPError as e:
                if e.code == 429:
                    time.sleep(65); continue
                if e.code in (400, 401, 403) and "key" in (e.read() or b"").decode(errors="ignore").lower():
                    sys.exit("Pixabay rejected the API key. Check PIXABAY_API_KEY in backend/.env.")
                raise
        if self.remaining is not None and self.remaining < 3:
            time.sleep(61)
        data = {"photos": [self.to_pexels(h) for h in raw.get("hits", [])]}
        json.dump(data, open(path, "w"))
        return data, False

    @staticmethod
    def to_pexels(h):
        user = h.get("user", "Pixabay")
        return dict(id=int(hashlib.sha1(f"pixabay:{h['id']}".encode()).hexdigest()[:13], 16), width=h["imageWidth"], height=h["imageHeight"],
                    url=h["pageURL"], photographer=user, photographer_url=f"https://pixabay.com/users/{user}-{h.get('user_id', '')}/",
                    avg_color=None, alt=h.get("tags", ""),
                    # remote URLs are only used once, to analyse and to download; they expire after 24 h
                    src={"small": h["webformatURL"], "large": h["largeImageURL"], "pixabay_id": h["id"]}, source="Pixabay")


class Wikimedia(Pexels):
    """Wikimedia Commons file search (no key). Only free-licence files (CC0, public domain, CC BY, CC BY-SA) are kept;
    the credit carries the author and licence, as those licences require. Thumbnails are hotlinked from
    upload.wikimedia.org, which Commons permits."""
    name, page_size = "Wikimedia Commons", 50
    OK_LICENCES = ("cc0", "public domain", "pd", "cc by", "cc-by")

    def __init__(self, key=None, base="https://commons.wikimedia.org/w/api.php"):
        super().__init__(key or "none", base)

    def search(self, query, per_page=50, page=1, color=None, orientation=None):
        params = {"action": "query", "format": "json", "generator": "search", "gsrnamespace": 6,
                  "gsrsearch": f"{query} filetype:bitmap", "gsrlimit": min(per_page, 50), "gsroffset": (page - 1) * per_page,
                  "prop": "imageinfo", "iiprop": "url|size|mime|extmetadata", "iiurlwidth": 400}
        url = f"{self.base}?{urllib.parse.urlencode(params)}"
        path = os.path.join(CACHE, "w_" + hashlib.sha1(url.encode()).hexdigest() + ".json")
        if os.path.exists(path):
            return json.load(open(path)), True
        for attempt in range(4):
            try:
                with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA + " (pranitsingh223@gmail.com)"}), timeout=40) as r:
                    raw = json.load(r)
                break
            except urllib.error.HTTPError as e:
                if e.code in (429, 503):
                    time.sleep(10 * (attempt + 1)); continue
                raise
        time.sleep(0.5)        # polite pacing for a volunteer-run service
        photos = []
        for pg in (raw.get("query", {}).get("pages", {}) or {}).values():
            ii = (pg.get("imageinfo") or [{}])[0]
            meta = ii.get("extmetadata", {})
            lic = (meta.get("LicenseShortName", {}).get("value") or "").strip()
            if ii.get("mime") not in ("image/jpeg", "image/png") or not lic.lower().startswith(self.OK_LICENCES):
                continue
            if min(ii.get("width", 0), ii.get("height", 0)) < 900:      # too small to look premium
                continue
            artist = re_strip(meta.get("Artist", {}).get("value") or "Unknown") or "Unknown"
            thumb = ii["thumburl"]
            w800, w1600 = (thumb.replace("/400px-", f"/{w}px-") for w in (800, 1600))
            photos.append(dict(id=int(hashlib.sha1(f"commons:{pg['pageid']}".encode()).hexdigest()[:13], 16),
                               width=ii["width"], height=ii["height"], url=ii.get("descriptionurl", ""), photographer=artist[:80],
                               photographer_url=ii.get("descriptionurl", ""), avg_color=None,
                               alt=re_strip(meta.get("ImageDescription", {}).get("value") or pg["title"][5:])[:140],
                               src={"small": thumb, "portrait": w800, "large": w800, "large2x": w1600},
                               source=f"Wikimedia Commons · {lic}"))
        data = {"photos": photos}
        json.dump(data, open(path, "w"))
        return data, False


def re_strip(html):
    import html as H
    import re
    return H.unescape(re.sub(r"<[^>]+>", "", html)).strip()


def store(db, photos, category, gender, phrase, profile=None, colour=None):
    for p in photos:
        db.execute("INSERT OR IGNORE INTO items(id, photographer, photographer_url, url, alt, width, height, avg_color, src, source) "
                   "VALUES(?,?,?,?,?,?,?,?,?,?)",
                   (p["id"], p["photographer"], p["photographer_url"], p["url"], p.get("alt") or "", p["width"], p["height"],
                    p.get("avg_color"), json.dumps(p["src"]), p.get("source", "Pexels")))
        db.execute("INSERT OR IGNORE INTO candidates(item_id, category, gender, phrase, profile, colour) VALUES(?,?,?,?,?,?)", (p["id"], category, gender, phrase, profile, colour))


ONLY = None   # --category: limit a run to one category (e.g. a newly added one)


def phase_pool(db, px):
    jobs = [(c, g, phrase) for c, spec in rules.CATEGORIES.items() for g in rules.GENDERS for phrase, _ in spec["intents"][g] if ONLY in (None, c)]
    for i, (c, g, phrase) in enumerate(jobs, 1):
        data, cached = px.search(phrase, px.page_size, 1, orientation="portrait" if c in PORTRAIT else None)
        store(db, data.get("photos", []), c, g, phrase)
        db.commit()
        print(f"  pool {i}/{len(jobs)}  {c:10s} {g:6s} {phrase!r}  quota left {px.remaining}", flush=True)
        if i % 20 == 0:                    # publish as we go: every category fills early on
            analyse(db)
            refresh(db)
    # second page of every search, after page 1 of all of them, so no category waits on another
    analyse(db)
    refresh(db)
    for i, (c, g, phrase) in enumerate(jobs, 1):
        data, cached = px.search(phrase, px.page_size, 2, orientation="portrait" if c in PORTRAIT else None)
        store(db, data.get("photos", []), c, g, phrase)
        db.commit()
        print(f"  pool p2 {i}/{len(jobs)}  quota left {px.remaining}", flush=True)
        if i % 20 == 0:
            analyse(db)
            refresh(db)


def phase_targeted(db, px):
    jobs = []
    for key, prof in rules.PROFILES.items():
        for c, spec in rules.CATEGORIES.items():
            if ONLY not in (None, c):
                continue
            for g in rules.GENDERS:
                for phrase, ref in spec["intents"][g]:
                    jobs.append((key, c, g, phrase, rules.resolve(prof, ref)["hex"]))
    for i, (key, c, g, phrase, hexc) in enumerate(jobs, 1):
        data, cached = px.search(phrase, min(40, px.page_size), 1, color=hexc, orientation="portrait" if c in PORTRAIT else None)
        store(db, data.get("photos", []), c, g, phrase, key, hexc)
        if i % 10 == 0 or not cached:
            db.commit()
        if i % 25 == 0:
            print(f"  targeted {i}/{len(jobs)}  quota left {px.remaining}", flush=True)
        if i % 120 == 0:          # publish improvements as they arrive instead of after hours
            analyse(db)
            refresh(db)
    db.commit()


def refresh(db):
    from .build import build
    from .vision import vet
    vet(db)
    filled, total = build(db, quiet=True)
    print(f"  catalogue refreshed: {filled}/{total} slots filled", flush=True)


def analyse(db, workers=8):
    """Download each candidate's small thumbnail once and measure its colours and visual busyness."""
    from concurrent.futures import ThreadPoolExecutor
    os.makedirs(THUMBS, exist_ok=True)
    todo = db.execute("SELECT id, src FROM items WHERE analysed=0").fetchall()
    print(f"  analysing {len(todo)} new images", flush=True)

    def one(row):
        iid, src = row
        path = os.path.join(THUMBS, f"{iid}.jpg")
        try:
            if not os.path.exists(path):
                url = json.loads(src)["small"]
                req = urllib.request.Request(url, headers={"User-Agent": UA})
                with urllib.request.urlopen(req, timeout=30) as r:
                    open(path, "wb").write(r.read())
            return iid, colour_signature(cv2.imread(path))
        except Exception as e:  # a missing thumbnail just leaves that photo out
            return iid, None

    with ThreadPoolExecutor(workers) as ex:
        for n, (iid, sig) in enumerate(ex.map(one, todo), 1):
            if sig:
                db.execute("UPDATE items SET colours=?, edge=?, analysed=1 WHERE id=?", (json.dumps(sig["colours"]), sig["edge"], iid))
            else:
                db.execute("UPDATE items SET analysed=-1 WHERE id=?", (iid,))
            if n % 200 == 0:
                db.commit()
                print(f"    {n}/{len(todo)}", flush=True)
    db.commit()


def colour_signature(bgr, k=5):
    if bgr is None:
        return None
    h, w = bgr.shape[:2]
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB).reshape(-1, 3).astype(np.float32)
    crit = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 0.5)
    _, labels, centres = cv2.kmeans(lab, k, None, crit, 2, cv2.KMEANS_PP_CENTERS)
    share = np.bincount(labels.ravel(), minlength=k) / len(labels)
    rgb = cv2.cvtColor(centres.reshape(-1, 1, 3).astype(np.uint8), cv2.COLOR_LAB2RGB).reshape(-1, 3)
    cols = sorted(({"hex": "#%02x%02x%02x" % tuple(int(v) for v in c), "share": round(float(s), 4)} for c, s in zip(rgb, share)),
                  key=lambda x: -x["share"])
    edges = cv2.Canny(cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY), 80, 160)
    return {"colours": cols, "edge": round(float((edges > 0).mean()), 4)}


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--phase", choices=["pool", "targeted", "all"], default="all")
    ap.add_argument("--source", choices=["unsplash", "pixabay", "wikimedia", "pexels"],
                    help="default: Unsplash if UNSPLASH_ACCESS_KEY is set, else Pexels. Run once per source; they share one catalogue")
    ap.add_argument("--fake", help="base URL of a fake Pexels search API (tests)")
    ap.add_argument("--category", choices=list(rules.CATEGORIES), help="only fetch photos for this category")
    a = ap.parse_args()
    ONLY = a.category
    if a.fake:
        px = Pexels("fake", a.fake.rstrip("/") + "/v1/search")
    else:
        source = a.source or ("unsplash" if env_key("UNSPLASH_ACCESS_KEY") else "pexels")
        keyname = {"unsplash": "UNSPLASH_ACCESS_KEY", "pixabay": "PIXABAY_API_KEY", "pexels": "PEXELS_API_KEY"}.get(source)
        key = env_key(keyname) if keyname else "none"
        if not key:
            sys.exit(f"No {keyname} in backend/.env (free keys: unsplash.com/developers · pixabay.com/api/docs · pexels.com/api)")
        px = {"unsplash": Unsplash, "pixabay": Pixabay, "wikimedia": Wikimedia, "pexels": Pexels}[source](key)
        print(f"image source: {px.name}", flush=True)
    db = connect()
    if a.phase in ("pool", "all"):
        print("phase 1: pool", flush=True)
        phase_pool(db, px)
        analyse(db)
        refresh(db)
    if a.phase in ("targeted", "all"):
        print("phase 2: colour-targeted", flush=True)
        phase_targeted(db, px)
        analyse(db)
        refresh(db)
    print("done — catalogue exported to frontend/public/catalog", flush=True)

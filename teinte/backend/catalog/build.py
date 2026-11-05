"""
Rank the catalogue for every slot (12 colour profiles × 11 categories × 2 genders) and export it.

Score of a candidate photo for a slot (all terms 0-1):

  fit      saliency-weighted CIEDE2000 match of the photo's k-means colours to the slot's target palette
           (backgrounds — near-white or near-grey, low-chroma clusters — weigh less than the subject)
  clash    the same against the profile's AVOID colours (subtracted)
  minimal  low edge density and few significant colours: clean, uncluttered, editorial shots
  quality  resolution and orientation (portrait for people, any for products)
  targeted small bonus when Pexels returned it for this profile's colour filter

The top 10 per slot are chosen greedily with diversity rules (≤ 2 per photographer, no photo twice within a
profile/gender, no near-identical colour signatures), written to the `slots` table and exported as static
JSON so the site renders a profile's whole lookbook instantly after a scan:

  frontend/src/data/profiles.json            rules for all 12 profiles + category metadata (bundled)
  frontend/public/catalog/<profile>.json     ranked images for that profile (fetched once, cached)

  python -m catalog.build
"""
import json
import math
import os
import sqlite3
import time

import numpy as np

from . import rules
from .vision import DUP_COS
from .ingest import DB, PORTRAIT, connect

HERE = os.path.dirname(os.path.abspath(__file__))
FRONT = os.environ.get("TEINTE_FRONTEND", os.path.abspath(os.path.join(HERE, "..", "..", "frontend")))
OUT_PROFILES = os.path.join(FRONT, "src", "data", "profiles.json")
OUT_CATALOG = os.path.join(FRONT, "public", "catalog")


# ───────────────────────────────────────────── colour maths (CIEDE2000)
def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def rgb_lab(rgb):
    def lin(v):
        c = v / 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (lin(v) for v in rgb)
    x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047
    y = r * 0.2126 + g * 0.7152 + b * 0.0722
    z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883
    f = lambda t: t ** (1 / 3) if t > 0.008856 else 7.787 * t + 16 / 116
    return 116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))


def de2000(l1, l2):
    L1, a1, b1 = l1
    L2, a2, b2 = l2
    C1, C2 = math.hypot(a1, b1), math.hypot(a2, b2)
    Cb = (C1 + C2) / 2
    G = 0.5 * (1 - math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)))
    a1p, a2p = (1 + G) * a1, (1 + G) * a2
    C1p, C2p = math.hypot(a1p, b1), math.hypot(a2p, b2)
    h = lambda x, y: 0 if x == 0 and y == 0 else math.degrees(math.atan2(y, x)) % 360
    h1p, h2p = h(a1p, b1), h(a2p, b2)
    dLp, dCp = L2 - L1, C2p - C1p
    dhp = 0 if C1p * C2p == 0 else (h2p - h1p if abs(h2p - h1p) <= 180 else h2p - h1p - 360 if h2p > h1p else h2p - h1p + 360)
    dHp = 2 * math.sqrt(C1p * C2p) * math.sin(math.radians(dhp / 2))
    Lbp, Cbp = (L1 + L2) / 2, (C1p + C2p) / 2
    hbp = h1p + h2p if C1p * C2p == 0 else ((h1p + h2p) / 2 if abs(h1p - h2p) <= 180 else (h1p + h2p + (360 if h1p + h2p < 360 else -360)) / 2)
    T = 1 - 0.17 * math.cos(math.radians(hbp - 30)) + 0.24 * math.cos(math.radians(2 * hbp)) + 0.32 * math.cos(math.radians(3 * hbp + 6)) - 0.2 * math.cos(math.radians(4 * hbp - 63))
    SL = 1 + 0.015 * (Lbp - 50) ** 2 / math.sqrt(20 + (Lbp - 50) ** 2)
    SC, SH = 1 + 0.045 * Cbp, 1 + 0.015 * Cbp * T
    RT = -2 * math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7)) * math.sin(math.radians(60 * math.exp(-((hbp - 275) / 25) ** 2)))
    return math.sqrt((dLp / SL) ** 2 + (dCp / SC) ** 2 + (dHp / SH) ** 2 + RT * (dCp / SC) * (dHp / SH))


# ───────────────────────────────────────────── scoring
def prepare(colours):
    """[(lab, share, saliency)] — a big pale low-chroma cluster is probably the backdrop."""
    out = []
    for c in colours:
        lab = rgb_lab(hex_rgb(c["hex"]))
        chroma = math.hypot(lab[1], lab[2])
        backdrop = lab[0] > 85 and chroma < 9
        sal = (0.15 if backdrop else 0.45) + min(chroma / 28, 1.0)
        out.append((lab, c["share"], sal, c["hex"]))
    return out


def fit_to(clusters, palette_labs, scale):
    num = den = 0.0
    for lab, share, sal, _ in clusters:
        d = min(de2000(lab, p) for p in palette_labs)
        w = share * sal
        num += w * math.exp(-d / scale)
        den += w
    return num / den if den else 0.0


def nearest(clusters, palette):
    """The palette colour this photo matches best (used as the "matches your …" chip)."""
    best, bd = None, 1e9
    for lab, share, sal, _ in clusters:
        if share * sal < 0.08:
            continue
        for s in palette:
            d = de2000(lab, s["_lab"])
            if d < bd:
                best, bd = s, d
    return best, bd


def score(item, prof, cat, palette, avoid_labs, targeted):
    clusters = item["_clusters"]
    pal_labs = [s["_lab"] for s in palette]
    fit = fit_to(clusters, pal_labs, 13.0)
    clash = fit_to(clusters, avoid_labs, 9.0)
    significant = sum(1 for _, s, _, _ in clusters if s > 0.08)
    minimal = max(0.0, 1 - item["edge"] / 0.22) * 0.7 + (1 - (significant - 1) / 4) * 0.3
    portrait = item["height"] >= item["width"]
    quality = min(1.0, (item["width"] * item["height"]) / (3000 * 4000)) * 0.5 + (0.5 if (portrait or cat not in PORTRAIT) else 0.1)
    # premium: LAION aesthetic (≈5 ordinary … 7+ editorial) mapped to 0-1; relevance: CLIP's own-category probability
    premium = min(1.0, max(0.0, (item.get("aesthetic") or 5.0) - 5.0) / 2.5)
    s = (0.42 * fit - 0.25 * clash + 0.28 * premium + 0.10 * item.get("_rel", 0.5) + 0.08 * minimal
         + 0.04 * quality + (0.05 if targeted else 0.0))
    return s, fit, clash


# ───────────────────────────────────────────── build
BLOCKLIST = os.path.join(HERE, "blocklist.txt")


def blocked():
    if not os.path.exists(BLOCKLIST):
        return set()
    return {int(l.split("#")[0]) for l in open(BLOCKLIST) if l.split("#")[0].strip()}


def load(db):
    items = {}
    banned = blocked()
    vetted = "vetted" in {r[1] for r in db.execute("PRAGMA table_info(items)")}
    has_emb = "emb" in {r[1] for r in db.execute("PRAGMA table_info(items)")}
    q = ("SELECT id, photographer, photographer_url, url, alt, width, height, avg_color, src, colours, edge, source, "
         + ("aesthetic, " + ("emb" if has_emb else "NULL") + " FROM items WHERE analysed=1 AND vetted=1" if vetted
            else "NULL, NULL FROM items WHERE analysed=1"))
    for row in db.execute(q):
        iid, ph, phu, url, alt, w, h, avg, src, cols, edge, source, aes, emb = row
        if iid in banned:
            continue
        cols = json.loads(cols)
        items[iid] = dict(id=iid, photographer=ph, photographer_url=phu, url=url, alt=alt, width=w, height=h, avg=avg, source=source or "Pexels",
                          src=json.loads(src), colours=cols, edge=edge, aesthetic=aes, _clusters=prepare(cols),
                          _emb=(np.frombuffer(emb, dtype=np.float16).astype(np.float32) if emb else None))
    cands, rel = {}, {}
    # only photos the visual check admitted to THIS category and gender are eligible
    q = ("SELECT item_id, category, gender, profile, relevance FROM candidates WHERE ok=1" if vetted
         else "SELECT item_id, category, gender, profile, 0.5 FROM candidates")
    for iid, c, g, profile, r in db.execute(q):
        if iid in items:
            cands.setdefault((c, g), {}).setdefault(iid, set()).add(profile)
            rel[(iid, c, g)] = max(rel.get((iid, c, g), 0.0), r or 0.0)
    for (iid, c, g), r in rel.items():
        items[iid].setdefault("_relmap", {})[(c, g)] = r
    return items, cands


from functools import lru_cache


@lru_cache(maxsize=None)
def dhash(iid):
    """64-bit difference hash of the thumbnail — catches the same shoot published several times."""
    import cv2
    from .ingest import THUMBS
    im = cv2.imread(os.path.join(THUMBS, f"{iid}.jpg"), cv2.IMREAD_GRAYSCALE)
    if im is None:
        return None
    im = cv2.resize(im, (9, 8), interpolation=cv2.INTER_AREA)
    bits = (im[:, 1:] > im[:, :-1]).flatten()
    return int("".join("1" if b else "0" for b in bits), 2)


def pick(scored, items, used, k=rules.PER_SLOT):
    chosen, per_ph, sigs, hashes, embs = [], {}, [], [], []
    for s, iid, match in scored:
        it = items[iid]
        if iid in used or per_ph.get(it["photographer"], 0) >= 2:
            continue
        sig = [rgb_lab(hex_rgb(c["hex"])) for c in it["colours"][:2]]
        if any(all(de2000(a, b) < 4 for a, b in zip(sig, o)) for o in sigs):
            continue          # near-duplicate shot (same colours)
        h = dhash(iid)
        if h is not None and any(bin(h ^ o).count("1") <= 12 for o in hashes):
            continue          # near-duplicate shot (same composition)
        e = it.get("_emb")
        if e is not None and any(float(e @ o) > DUP_COS for o in embs):
            continue          # same shoot / same subject (CLIP content similarity)
        chosen.append((s, iid, match))
        per_ph[it["photographer"]] = per_ph.get(it["photographer"], 0) + 1
        sigs.append(sig)
        if h is not None:
            hashes.append(h)
        if e is not None:
            embs.append(e)
        if len(chosen) == k:
            break
    return chosen


def build(db=None, export=True, quiet=False):
    db = db or connect()
    t0 = time.time()
    items, cands = load(db)
    db.execute("DELETE FROM slots")
    filled = total = 0
    for key, prof in rules.PROFILES.items():
        avoid_labs = [rgb_lab(hex_rgb(s["hex"])) for s in prof["avoid"]]
        for g in rules.GENDERS:
            used = set()
            for cat in rules.CATEGORIES:
                palette = [dict(s, _lab=rgb_lab(hex_rgb(s["hex"]))) for s in rules.target_palette(prof, cat)]
                scored = []
                for iid, profiles in cands.get((cat, g), {}).items():
                    targeted = key in profiles
                    items[iid]["_rel"] = items[iid].get("_relmap", {}).get((cat, g), 0.5)
                    s, fit, clash = score(items[iid], prof, cat, palette, avoid_labs, targeted)
                    m, d = nearest(items[iid]["_clusters"], palette)
                    scored.append((s, iid, m if (m and d < 16) else None))
                scored.sort(key=lambda x: -x[0])
                chosen = pick(scored, items, used)
                total += rules.PER_SLOT
                filled += len(chosen)
                for rank, (s, iid, m) in enumerate(chosen):
                    used.add(iid)
                    db.execute("INSERT INTO slots VALUES(?,?,?,?,?,?,?,?)",
                               (key, cat, g, rank, iid, round(s, 4), m["name"] if m else None, m["hex"] if m else None))
    db.commit()
    if not quiet:
        print(f"ranked {len(items)} analysed photos into {filled}/{total} slots in {time.time() - t0:.1f}s")
    if export:
        export_all(db, items)
    return filled, total


def export_profiles():
    cats = {k: dict(title=v["title"], kicker=v["kicker"], kind=v["kind"]) for k, v in rules.CATEGORIES.items()}
    profiles = {}
    for key, p in rules.PROFILES.items():
        q = {k: v for k, v in p.items()}
        q["why"] = {c: rules.why(p, c) for c in rules.CATEGORIES}
        profiles[key] = q
    os.makedirs(os.path.dirname(OUT_PROFILES), exist_ok=True)
    json.dump(dict(profiles=profiles, categories=cats, seasonFamily=rules.SEASON_FAMILY,
                   undertoneRule=rules.UNDERTONE_RULE, familyRule=rules.FAMILY_RULE),
              open(OUT_PROFILES, "w"), indent=1, ensure_ascii=False)


MEDIA = os.path.join(FRONT, "public", "media", "pixabay")


def pixabay_local(iid, src):
    """Download a chosen Pixabay photo once (1280 px) and return its site path. Pixabay's image URLs expire after
    24 h, so a stale one is refreshed by looking the photo up by id."""
    import urllib.request
    from .ingest import UA, env_key
    path = os.path.join(MEDIA, f"{iid}.jpg")
    if os.path.exists(path):
        return f"/media/pixabay/{iid}.jpg"
    os.makedirs(MEDIA, exist_ok=True)
    urls = [src.get("large")]
    key = env_key("PIXABAY_API_KEY")
    if key and src.get("pixabay_id"):
        try:
            with urllib.request.urlopen(f"https://pixabay.com/api/?key={key}&id={src['pixabay_id']}", timeout=30) as r:
                hits = json.load(r).get("hits", [])
                if hits:
                    urls.append(hits[0]["largeImageURL"])
        except Exception:
            pass
    for u in urls:
        if not u:
            continue
        try:
            with urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": UA}), timeout=40) as r:
                open(path, "wb").write(r.read())
            return f"/media/pixabay/{iid}.jpg"
        except Exception:
            continue
    return None


def export_all(db, items=None):
    items = items or load(db)[0]
    export_profiles()
    os.makedirs(OUT_CATALOG, exist_ok=True)
    stamp = int(time.time())
    for key in rules.PROFILES:
        out = {"profile": key, "generated": stamp, "categories": {}}
        for cat, g, rank, iid, s, m, mh in db.execute(
                "SELECT category, gender, rank, item_id, score, match, match_hex FROM slots WHERE profile=? ORDER BY category, gender, rank", (key,)):
            it = items[iid]
            src = it["src"]
            if it["source"] == "Pixabay":                # self-hosted, as Pixabay's terms require
                local = pixabay_local(iid, src)
                if not local:
                    continue
                thumb = full = local
            else:
                thumb, full = (src.get("portrait") if cat in PORTRAIT else src.get("large")), src.get("large2x")
            out["categories"].setdefault(cat, {}).setdefault(g, []).append(dict(
                id=iid, w=it["width"], h=it["height"], alt=it["alt"], avg=it["avg"],
                thumb=thumb, full=full,
                colours=[c["hex"] for c in it["colours"][:3]], match=m, matchHex=mh, score=s,
                photographer=it["photographer"], photographerUrl=it["photographer_url"], url=it["url"], source=it["source"]))
        json.dump(out, open(os.path.join(OUT_CATALOG, f"{key}.json"), "w"), separators=(",", ":"))
    json.dump({"profiles": list(rules.PROFILES), "generated": stamp}, open(os.path.join(OUT_CATALOG, "index.json"), "w"))
    print(f"exported → {OUT_CATALOG}")


if __name__ == "__main__":
    build()

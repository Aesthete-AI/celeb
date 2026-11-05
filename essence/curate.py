"""Curate 10 portraits per essence person with EXACTLY the rules used for the 278-person colour set.

The functions are imported from AI Startup/web_portraits/ unchanged:
  harvest   harvest_urls.search + QUERIES + BAD_HOSTS      (DuckDuckGo image search, watermark hosts skipped)
  download  download_candidates.fetch                       (>= 450 px short side, md5 de-duplication, max 50)
  score     select_clear.Judge                              (identity, single face, head straight, top of head
                                                             and neck in frame, nothing over the face, eyes
                                                             open, no glasses, colour, face >= 180 px; score =
                                                             no-makeup, size, sharpness, frontal, exposure, studio)
  round2    round2.QUERIES                                  (extra searches for anyone short of 10 matches)
  finalize  finalize.identity_consensus / HandCheck / portrait_crop / dhash
            (identity from the consensus face of the web results — never relaxed; + makeup <= 0.5 and no hand
             near the face; ranked colour first, then fewest misses, then score; near-duplicates skipped)

People already in the 278 set are not re-curated: their 10 photos were chosen by these same rules and are
copied from output/inference_clear_images_top10/.

Usage:  python curate.py harvest | download | score [N_PROC] | round2 | finalize | all
"""
import json, os, random, shutil, sys, time
import multiprocessing as mproc

HERE = os.path.dirname(os.path.abspath(__file__))
AI = os.path.join(os.path.dirname(HERE), "AI Startup-20260916T113727Z-1-001", "AI Startup")
WP = os.path.join(AI, "web_portraits")
sys.path.insert(0, WP)

URLS = os.path.join(HERE, "web_urls")
CAND = os.path.join(HERE, "web_candidates")
SCORES = os.path.join(HERE, "web_scores")
TOP10 = os.path.join(HERE, "top10")
PREV_TOP10 = os.path.join(AI, "output", "inference_clear_images_top10")
TOP_N = 10
for d in (URLS, CAND, SCORES, TOP10):
    os.makedirs(d, exist_ok=True)


def people():
    return json.load(open(os.path.join(HERE, "essence_labels.json")))["people"]


def reused():
    """stem -> folder in the 278 set, for people already curated there."""
    have = {s.lower(): s for s in os.listdir(PREV_TOP10)}
    return {p["stem"]: have[p["stem"].lower()] for p in people() if p["stem"].lower() in have}


def todo():
    r = reused()
    return [p for p in people() if p["stem"] not in r]


# ───────────────────────────────────────────────────────────── 1. harvest
def harvest(queries=None, tag=""):
    from harvest_urls import search, BAD_HOSTS, QUERIES
    queries = queries or QUERIES
    for i, p in enumerate(todo(), 1):
        path = os.path.join(URLS, p["stem"] + tag + ".json")
        if os.path.exists(path):
            continue
        seen, cands = set(), []
        for q in queries:
            for r in search(q.format(n=p["search_name"])):
                u = r.get("image", "")
                if not u.startswith("http") or u in seen or any(b in u for b in BAD_HOSTS):
                    continue
                seen.add(u)
                cands.append(dict(url=u, page=r.get("url"), title=r.get("title"), source=r.get("source"),
                                  w=r.get("width"), h=r.get("height"), query=q.format(n=p["search_name"])))
            time.sleep(2 + random.random() * 2)
        json.dump(dict(name=p["search_name"], candidates=cands), open(path, "w"), indent=1)
        print(f"harvest {i}/{len(todo())} {p['search_name']}: {len(cands)} candidates", flush=True)


# ───────────────────────────────────────────────────────────── 2. download
def _download_person(stem, tag="", start=0, max_per=None):
    import hashlib, threading, queue
    import download_candidates as DL
    max_per = max_per or DL.MAX_PER
    d = os.path.join(CAND, stem); os.makedirs(d, exist_ok=True)
    logp = os.path.join(d, "_downloads.json")
    log = json.load(open(logp)) if os.path.exists(logp) else []
    if not tag and log:
        return
    cands = json.load(open(os.path.join(URLS, stem + tag + ".json")))["candidates"]
    tried = {x["url"] for x in log}
    num = lambda v: int(v) if str(v).isdigit() else 0
    cands = [c for c in cands if c["url"] not in tried]
    cands.sort(key=lambda c: -(num(c.get("w")) * num(c.get("h"))))
    q = queue.Queue()
    for i, c in enumerate(cands):
        q.put((i, c))
    new, lock = [], threading.Lock()
    seen = {f.split("_")[-1].split(".")[0] for f in os.listdir(d) if not f.startswith("_")}

    def work():
        while True:
            with lock:
                if len([x for x in new if x.get("file")]) >= max_per:
                    return
            try:
                i, c = q.get_nowait()
            except queue.Empty:
                return
            res, err = DL.fetch(c)
            with lock:
                if res:
                    data, (h, w) = res
                    hsh = hashlib.md5(data).hexdigest()[:12]
                    if hsh in seen:
                        new.append(dict(url=c["url"], error="duplicate")); continue
                    seen.add(hsh)
                    fn = f"{start + i:03d}_{hsh}.jpg"
                    open(os.path.join(d, fn), "wb").write(data)
                    new.append(dict(file=fn, url=c["url"], page=c.get("page"), title=c.get("title"),
                                    source=c.get("source"), width=w, height=h, query=c.get("query")))
                else:
                    new.append(dict(url=c["url"], error=err))
    ts = [threading.Thread(target=work) for _ in range(12)]
    [t.start() for t in ts]; [t.join() for t in ts]
    json.dump(log + new, open(logp, "w"), indent=1)
    print(f"download {stem}{tag}: {len([x for x in new if x.get('file')])} kept of {len(new)} tried", flush=True)


def download():
    from concurrent.futures import ThreadPoolExecutor
    stems = [p["stem"] for p in todo() if os.path.exists(os.path.join(URLS, p["stem"] + ".json"))]
    with ThreadPoolExecutor(4) as ex:
        list(ex.map(_download_person, stems))


# ───────────────────────────────────────────────────────────── 3. score (the Judge, unchanged)
def _score_worker(stems):
    import select_clear as SCL
    J = SCL.Judge()
    for stem in stems:
        outp = os.path.join(SCORES, stem + ".json")
        d = os.path.join(CAND, stem)
        files = sorted(f for f in os.listdir(d) if not f.startswith("_"))
        prev = json.load(open(outp)) if os.path.exists(outp) else None
        done = {c["file"] for c in prev["candidates"]} if prev else set()
        if prev and done >= set(files):
            continue
        res = list(prev["candidates"]) if prev else []
        for f in files:
            if f in done:
                continue
            try:
                r = J.judge(os.path.join(d, f), None)       # no earlier photo: identity comes from consensus
            except Exception as e:
                r = dict(file=f, usable=False, why=f"error {type(e).__name__}")
            if r:
                res.append(r)
        json.dump(dict(stem=stem, reference_found=False, reference_encoding=None, candidates=res), open(outp, "w"),
                  indent=1, default=lambda o: o.item() if hasattr(o, "item") else str(o))
        ok = [r for r in res if r.get("usable") and not r.get("checks_other_than_identity_failed")]
        print(f"score {stem}: {len(res)} judged, {len(ok)} meet every non-identity rule", flush=True)
    J.fl.close(); J.seg.close()


def score(n=4):
    stems = [p["stem"] for p in todo() if os.path.exists(os.path.join(CAND, p["stem"], "_downloads.json"))]
    chunks = [stems[i::n] for i in range(n)]
    ctx = mproc.get_context("spawn")
    ps = [ctx.Process(target=_score_worker, args=(c,)) for c in chunks if c]
    [p.start() for p in ps]; [p.join() for p in ps]


# ───────────────────────────────────────────────────────────── 4. identity-matched pool per person
def matched(stem, refine=False):
    import finalize as FZ
    sp = os.path.join(SCORES, stem + ".json")
    if not os.path.exists(sp):
        return [], "not scored", None
    d = json.load(open(sp))
    usable = [c for c in d["candidates"] if c.get("usable")]
    ok, how, x = FZ.identity_consensus(usable, None)
    if refine:
        ok, how = tighten(ok, how)
    return ok, how, x


# ── Checks added for the essence set (the 278 colour set never needed them) ──────────────────────────────
# 1  tighter identity — TESTED AND NOT USED: Eddie Jemison's grey-haired photos looked like a second man but
#    are the same man older; dlib clusters all of them together, so ageing is kept as genuine identity. The consensus keeps every face within 0.55 of one medoid photo, so two similar people
#    can both sit within range of a medoid between them (Eddie Jemison's first top 10 mixed in a second man).
#    Here the group is re-centred on the mean face and anyone further than 0.5 from it is dropped, repeated
#    until stable — the person is still defined by the consensus, never by a single photo.
# 2  real photograph. Cartoons, paintings and statues carry no information about a living face (Cantinflas's
#    results included cartoons; Akhenaten has only statues). CLIP ViT-L/14 scores "a photograph of a person"
#    against cartoon / painting / statue. Calibrated by eye on Cantinflas: artwork scored <= 0.06 while genuine
#    vintage black-and-white photographs scored 0.11-0.40 (CLIP finds old monochrome drawing-like), so the
#    cut-off is 0.05 — it removes artwork without discarding real archive photos. (ViT-B/32 with a
#    "digital art" prompt was tried first and rejected: it called retouched studio portraits fake.)
ID_TIGHT = 0.5
PHOTO_MIN = 0.05
ART = ["a photograph of a person", "a cartoon, caricature or drawing of a person", "a painting of a person",
       "a statue, bust or sculpture"]
_clip = {}


def tighten(ok, how):
    import numpy as np
    E = [(c, np.array(c["encoding"])) for c in ok if c.get("encoding")]
    keep = E
    for _ in range(10):
        if not keep:
            break
        centre = np.mean([e for _, e in keep], 0)
        nxt = [(c, e) for c, e in E if np.linalg.norm(e - centre) <= ID_TIGHT]
        if len(nxt) == len(keep):
            break
        keep = nxt
    return [c for c, _ in keep], f"{how}; tightened to {len(keep)} within {ID_TIGHT} of the mean face"


def photo_prob(path):
    import torch
    from PIL import Image
    if not _clip:
        from transformers import CLIPModel, CLIPProcessor
        dev = "cuda" if torch.cuda.is_available() else "cpu"
        m = CLIPModel.from_pretrained("openai/clip-vit-large-patch14").eval().to(dev)
        pr = CLIPProcessor.from_pretrained("openai/clip-vit-large-patch14")
        with torch.no_grad():
            t = m.get_text_features(**pr(text=ART, return_tensors="pt", padding=True).to(dev))
        _clip.update(m=m, pr=pr, dev=dev, t=t / t.norm(dim=-1, keepdim=True))
    with torch.no_grad():
        e = _clip["m"].get_image_features(**_clip["pr"](images=Image.open(path).convert("RGB"), return_tensors="pt").to(_clip["dev"]))
        e = e / e.norm(dim=-1, keepdim=True)
        return float((100 * e @ _clip["t"].T).softmax(-1)[0, 0])


def round2():
    """Extra searches (round2.py queries) for anyone with fewer than 10 identity-matched candidates."""
    # from round2 import QUERIES as Q2
    # NEVER import round2.py: it has no __main__ guard, so importing it RUNS round 2 on the 278-person set
    # (that happened once on 5 Nov 2026 and was undone by restore_round2_accident.py). Its queries, copied:
    Q2 = ["{n} makeup free selfie", "{n} bare face no makeup", "{n} front facing portrait photo",
          "{n} slicked back hair portrait", "{n} close up face straight"]
    short = []
    for p in todo():
        ok, how, _ = matched(p["stem"])
        if len(ok) < 15:                      # 10 needed; margin for duplicates and the hand / makeup checks
            short.append(p)
    print(f"round 2 for {len(short)} people", flush=True)
    from harvest_urls import search, BAD_HOSTS
    for p in short:
        path = os.path.join(URLS, p["stem"] + "_r2.json")
        if not os.path.exists(path):
            seen, cands = set(), []
            for q in Q2:
                for r in search(q.format(n=p["search_name"])):
                    u = r.get("image", "")
                    if u.startswith("http") and u not in seen and not any(b in u for b in BAD_HOSTS):
                        seen.add(u); cands.append(dict(url=u, page=r.get("url"), title=r.get("title"), w=r.get("width"),
                                                       h=r.get("height"), query=q.format(n=p["search_name"])))
                time.sleep(2 + random.random() * 2)
            json.dump(dict(name=p["search_name"], candidates=cands), open(path, "w"), indent=1)
        _download_person(p["stem"], tag="_r2", start=500, max_per=60)
    return [p["stem"] for p in short]


# ───────────────────────────────────────────────────────────── 5. finalize (top 10)
def finalize():
    import cv2, numpy as np, pandas as pd
    import finalize as FZ
    hands = FZ.HandCheck()
    rows, per = [], []
    reuse = reused()
    for p in people():
        stem, outd = p["stem"], os.path.join(TOP10, p["stem"])
        if os.path.exists(outd):
            shutil.rmtree(outd)
        os.makedirs(outd)
        if stem in reuse:
            src = os.path.join(PREV_TOP10, reuse[stem])
            for f in sorted(os.listdir(src))[:TOP_N]:
                shutil.copy2(os.path.join(src, f), os.path.join(outd, f))
            n = len(os.listdir(outd))
            per.append(dict(Person=p["person"], Folder=stem, Images=n, Source="278 colour set (same rules)",
                            Identity="as curated for the 278 set", **{"Meeting every rule": None}))
            continue
        ok, how, _ = matched(stem)
        for c in ok:
            c["photo_prob"] = photo_prob(os.path.join(CAND, stem, c["file"]))
        n_art = sum(c["photo_prob"] < PHOTO_MIN for c in ok)
        ok = [c for c in ok if c["photo_prob"] >= PHOTO_MIN]
        how += f"; {n_art} non-photographs removed"
        logs = {x["file"]: x for x in json.load(open(os.path.join(CAND, stem, "_downloads.json"))) if x.get("file")} \
            if os.path.exists(os.path.join(CAND, stem, "_downloads.json")) else {}
        for c in ok:
            c["failed"] = list(c.get("checks_other_than_identity_failed", []))
            if c["makeup_prob"] > 0.5:
                c["failed"].append("low makeup (CLIP <= 0.5)")
            if hands.near_face(os.path.join(CAND, stem, c["file"]), c):
                c["failed"].append("no hand near face")
            c["n_failed"] = len(c["failed"])
        ranked = sorted(ok, key=lambda c: ("colour photo" in c["failed"], c["n_failed"], -c["score"]))
        kept, hashes = [], []
        for c in ranked:
            cr = FZ.portrait_crop(os.path.join(CAND, stem, c["file"]), c)
            if cr is None or cr.size == 0:
                continue
            hv = FZ.dhash(cr)
            if any((hv != h2).sum() < 20 for h2 in hashes):
                continue
            hashes.append(hv); kept.append((c, cr))
            if len(kept) == TOP_N:
                break
        for i, (c, cr) in enumerate(kept, 1):
            cv2.imwrite(os.path.join(outd, f"{i:02d}.jpg"), cr, [cv2.IMWRITE_JPEG_QUALITY, 95])
            s = logs.get(c["file"], {})
            rows.append({"Person": p["person"], "Folder": stem, "Rank": i, "Saved as": f"top10/{stem}/{i:02d}.jpg",
                         "Meets every requirement": "Yes" if c["n_failed"] == 0 else "No", "Misses": ", ".join(c["failed"]) or None,
                         "Makeup probability (CLIP)": c["makeup_prob"], "Real photograph (CLIP)": round(c["photo_prob"], 3), "Yaw": c["yaw"], "Pitch": c["pitch"], "Roll": c["roll"],
                         "Face width px": c["face_w"], "Score": c["score"], "Source image URL": s.get("url"), "Source page": s.get("page")})
        per.append(dict(Person=p["person"], Folder=stem, Images=len(kept), Source="web search (curated here)", Identity=how,
                        **{"Meeting every rule": sum(1 for c, _ in kept if c["n_failed"] == 0)}))
        print(f"finalize {stem}: {len(kept)} images ({how})", flush=True)
    hands.close()
    out = os.path.join(HERE, "essence_images_manifest.xlsx")
    with pd.ExcelWriter(out, engine="openpyxl") as w:
        pd.DataFrame(per).to_excel(w, sheet_name="Per person", index=False)
        pd.DataFrame(rows).to_excel(w, sheet_name="Every image", index=False)
    tot = sum(r["Images"] for r in per)
    print(f"saved {out} | {tot} images | people with fewer than 10: {[r['Person'] for r in per if r['Images'] < TOP_N]}")


if __name__ == "__main__":
    step = sys.argv[1] if len(sys.argv) > 1 else "all"
    print(f"{len(people())} people, {len(reused())} reused from the 278 set, {len(todo())} to curate", flush=True)
    if step in ("harvest", "all"): harvest()
    if step in ("download", "all"): download()
    if step in ("score", "all"): score(int(sys.argv[2]) if len(sys.argv) > 2 and step == "score" else 4)
    if step in ("round2", "all"):
        if round2():
            score(4)
    if step in ("finalize", "all"): finalize()
    print("STEP DONE", step, flush=True)

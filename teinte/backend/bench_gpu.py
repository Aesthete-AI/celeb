"""
GPU check for the production engine:

  1. fidelity  — for a few people, the engine's Graphonomy mask + each of the 12 backbones must reproduce the
                 cached research features (<model>_top10_masked_graphonomy.npz) for the same head crop
  2. latency   — end-to-end analyse() time for 1, 3 and 10 photographs (the published 2.13 s is 10 photos)

  python bench_gpu.py [--release <segmentation_pipeline_release>] [--people 3]
"""
import argparse
import os
import statistics
import time

import cv2
import numpy as np

from engine import Engine

HERE = os.path.dirname(os.path.abspath(__file__))
RELEASE = os.path.join(HERE, "..", "..", "AI Startup-20260916T113727Z-1-001", "AI Startup", "output", "segmentation_pipeline_release")


def main(release, n_people):
    crops_dir = os.path.join(release, "data", "2_head_crops")
    feats_dir = os.path.join(release, "data", "4_features")
    e = Engine()
    t = time.perf_counter()
    e.load()
    assert e.state == "ready", e.error
    print(f"engine ready on {e.device} in {time.perf_counter() - t:.1f}s")
    torch = e.torch

    people = [p for p in sorted(os.listdir(crops_dir)) if os.path.isfile(os.path.join(crops_dir, p, "10.jpg"))][:max(n_people, 5)]

    # ── 1. fidelity
    cached = {}
    for name in e.models:
        z = np.load(os.path.join(feats_dir, f"{name}_top10_masked_graphonomy.npz"), allow_pickle=True)
        cached[name] = dict(zip(map(str, z["keys"]), z["features"]))
    worst = {}
    for person in people[:n_people]:
        bgr = cv2.imread(os.path.join(crops_dir, person, "01.jpg"))
        _, keep = e.segment(bgr)
        im = e.masked_input(bgr, keep)
        with torch.no_grad():
            for name, (m, tf) in e.models.items():
                f = m(tf(im)[None].to(e.device)).float().cpu().numpy()[0]
                c = cached[name][f"{person}/01"]
                cos = float(f @ c / np.linalg.norm(f) / np.linalg.norm(c))
                worst[name] = min(worst.get(name, 1.0), cos)
    print("\nfidelity — worst cosine(engine feature, cached research feature) over", n_people, "people")
    for name, c in worst.items():
        print(f"  {name:22s} {c:.5f}  {'OK' if c > 0.995 else 'CHECK'}")

    # ── 2. latency
    def photos(person, k):
        return [cv2.imread(os.path.join(crops_dir, person, f"{i:02d}.jpg")) for i in range(1, k + 1)]

    e.analyse(photos(people[0], 3))  # warm-up (cudnn autotune, allocator)
    print("\nlatency — end-to-end analyse(), GPU synchronised")
    for k in (1, 3, 10):
        ts, seg, bb = [], [], []
        for person in people[:5]:
            imgs = photos(person, k)
            torch.cuda.synchronize()
            r = e.analyse(imgs)
            ts.append(r["timings"]["total_ms"]); seg.append(r["timings"]["segmentation_ms"]); bb.append(r["timings"]["backbones_ms"])
        print(f"  {k:2d} photo(s): total {statistics.median(ts) / 1000:.2f}s  "
              f"(Graphonomy {statistics.median(seg):.0f} ms, preprocess+12 backbones {statistics.median(bb):.0f} ms)  → {r['season']} / {r['undertone']}")
    print(f"\npeak VRAM {torch.cuda.max_memory_allocated() / 1e9:.2f} GB")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--release", default=RELEASE)
    ap.add_argument("--people", type=int, default=3)
    a = ap.parse_args()
    main(os.path.abspath(a.release), a.people)

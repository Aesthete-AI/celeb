"""
Refit only the gender head, on more faces than the colour heads have.

The colour heads can only learn from the 278 analyst-labelled celebrities. Apparent gender does not need
analyst labels, so this head also trains on ordinary portraits from the image catalogue — which fixes the
imbalance of the research set (69 men vs 209 women) that left the head under-confident on men.

Everything else is untouched: same 12 backbones, same masked Graphonomy input, same
StandardScaler -> PCA(96) -> balanced logistic regression, and the colour heads in heads.joblib are
rewritten exactly as they were.

  python train_gender.py --extra <dir of <male|female>_<id>.jpg>   [--eval <dir>]
"""
import argparse
import glob
import os
import time

import cv2
import joblib
import numpy as np
from sklearn.model_selection import StratifiedKFold

from train_heads import DEFAULT_FEATURES, HERE, head, labels, load

HEADS = os.path.join(HERE, "artifacts", "heads.joblib")


def extract(paths, device=None):
    """Run the real scan pipeline (Graphonomy mask -> 12 backbones) over each photo."""
    from engine import Engine
    e = Engine(device)
    e.load()
    assert e.state == "ready", e.error
    feats = {n: [] for n in e.models}
    kept = []
    t0 = time.time()
    for i, p in enumerate(paths, 1):
        img = cv2.imread(p)
        if img is None:
            continue
        try:
            _, keep = e.segment(img)
            if keep.sum() < 400:
                continue
            im = e.masked_input(img, keep)
            with e.torch.no_grad():
                for name, (m, tf) in e.models.items():
                    v = m(tf(im)[None].to(e.device)).float().cpu().numpy()[0]
                    feats[name].append(v / (np.linalg.norm(v) + 1e-12))
        except Exception as ex:
            print("  skipped", os.path.basename(p), str(ex)[:60])
            continue
        kept.append(p)
        if i % 50 == 0:
            print(f"  {i}/{len(paths)}  ({(time.time()-t0)/i:.2f}s/photo)", flush=True)
    del e
    return kept, {n: np.array(v) for n, v in feats.items()}


def main(extra_dir, eval_dir, out):
    b = joblib.load(HEADS)
    gt = labels(os.path.join(HERE, "data", "seasonapproved_undertones_colour.xlsx"))

    # 1. the research set, from the cached features the colour heads use
    blocks = {n: load(os.path.abspath(DEFAULT_FEATURES), n) for n in b["backbones"]}
    keys = [k for k in blocks["resnet50_imagenet"][0] if k in gt]
    idx = {k: i for i, k in enumerate(blocks["resnet50_imagenet"][0])}
    y = [gt[k]["gender"] for k in keys]
    X = {n: blocks[n][1][[idx[k] for k in keys]] for n in b["backbones"]}
    print(f"research set: {len(keys)} people ({y.count('male')} male, {y.count('female')} female)")

    # 2. ordinary portraits, labelled by the folder name
    paths = sorted(glob.glob(os.path.join(extra_dir, "*.jpg")))
    print(f"extra portraits: {len(paths)} — extracting features through the scan pipeline")
    kept, F = extract(paths)
    ey = [os.path.basename(p).split("_")[0] for p in kept]
    print(f"  usable: {len(kept)} ({ey.count('male')} male, {ey.count('female')} female)")
    for n in b["backbones"]:
        X[n] = np.vstack([X[n], F[n]])
    y = np.array(y + ey)

    # 3. honest estimate first: 5-fold, mean of the 12 per-backbone probabilities
    P = np.zeros((len(y), 2))
    cls = np.array(["female", "male"])
    for tr, te in StratifiedKFold(5, shuffle=True, random_state=0).split(X["resnet50_imagenet"], y):
        for n in b["backbones"]:
            h = head().fit(X[n][tr], y[tr])
            P[te] += h.predict_proba(X[n][te]) / len(b["backbones"])
    pred = cls[P.argmax(1)]
    conf = P.max(1)
    print(f"\nout-of-fold on {len(y)} faces: {100*(pred == y).mean():.1f}% correct")
    for th in (0.5, 0.55, 0.6, 0.65, 0.7):
        m = conf >= th
        print(f"  threshold {th:.2f}: decides {100*m.mean():4.0f}%   wrong {int((pred[m] != y[m]).sum())}")

    # 4. refit on everything and write just the gender head back
    for n in b["backbones"]:
        b["heads"][n]["gender"] = head().fit(X[n], y)
    b["classes"]["gender"] = list(b["heads"]["resnet50_imagenet"]["gender"].classes_)
    b.setdefault("notes", {})["gender"] = f"{len(y)} faces ({list(y).count('male')} male, {list(y).count('female')} female)"
    joblib.dump(b, out, compress=3)
    print(f"\nsaved -> {out}")

    if eval_dir:
        ep = sorted(glob.glob(os.path.join(eval_dir, "*.jpg")))
        kept2, F2 = extract(ep)
        ty = np.array([os.path.basename(p).split("_")[0] for p in kept2])
        P2 = np.mean([b["heads"][n]["gender"].predict_proba(F2[n]) for n in b["backbones"]], 0)
        pr = np.array(b["classes"]["gender"])[P2.argmax(1)]
        c2 = P2.max(1)
        print(f"\nheld-out {len(ty)} faces: {100*(pr == ty).mean():.1f}% correct")
        for th in (0.5, 0.55, 0.6, 0.65, 0.7):
            m = c2 >= th
            print(f"  threshold {th:.2f}: decides {100*m.mean():4.0f}%   wrong {int((pr[m] != ty[m]).sum())}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--extra", required=True)
    ap.add_argument("--eval", default=None)
    ap.add_argument("--out", default=HEADS)
    a = ap.parse_args()
    main(a.extra, a.eval, a.out)

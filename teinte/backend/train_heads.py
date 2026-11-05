"""
Fit the production heads for the 7 CNNs + 5 ViTs (mean of probabilities) configuration.

The research pipeline (segmentation_pipeline_release/code/backbone_pipeline.py) only ever scores
people out-of-fold, so it never leaves a head behind that can be served. This script:

  1. loads the cached Graphonomy-masked features of all 12 frozen backbones
     (<model>_top10_masked_graphonomy.npz: 278 people x 10 photographs),
  2. averages each person's 10 photograph-vectors and L2-normalises them (exactly as probe.load),
  3. re-scores the ensemble out-of-fold (5-fold stratified, 3 splits) so the shipped
     configuration is checked against the published 64.4 / 51.1 / 28.1,
  4. fits one StandardScaler -> PCA(96) -> LogisticRegression(balanced) head per backbone per target
     on all 278 people, and writes them to artifacts/heads.joblib.

It also stores each person's 96-d PCA embedding per backbone, so the API can name the celebrities
whose colouring is closest to the user's ("colour twins").

  python train_heads.py --features "<release>/data/4_features"
"""
import argparse
import os
import re
import time

import joblib
import numpy as np
import pandas as pd
from sklearn.decomposition import PCA
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedKFold
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler, normalize

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_ROOT = os.path.join(HERE, "..", "..", "AI Startup-20260916T113727Z-1-001", "AI Startup", "output")
DEFAULT_FEATURES = os.path.join(OUT_ROOT, "segmentation_pipeline_release", "data", "4_features")

# name -> timm repo, in the order of the published table
BACKBONES = {
    "resnet50_imagenet": "resnet50.a1_in1k",
    "efficientnet_b7": "tf_efficientnet_b7.ns_jft_in1k",
    "densenet201": "densenet201.tv_in1k",
    "inception_resnet_v2": "inception_resnet_v2.tf_in1k",
    "seresnext101": "seresnext101_32x8d.ah_in1k",
    "nasnet_large": "nasnetalarge.tf_in1k",
    "convnext_large": "convnext_large.fb_in22k_ft_in1k",
    "dinov2_vit_large": "vit_large_patch14_dinov2.lvd142m",
    "clip_vit_large": "vit_large_patch14_clip_224.openai",
    "siglip_so400m": "vit_so400m_patch14_siglip_384.webli",
    "eva02_large": "eva02_large_patch14_448.mim_in22k_ft_in1k",
    "vit_large_in21k": "vit_large_patch16_224.augreg_in21k_ft_in1k",
}
TARGETS = ("undertone", "season4", "season12", "gender")
TAG = "top10_masked_graphonomy"


def key(n):
    return re.sub(r"[^\w\-. ]", "", str(n)).strip().replace(" ", "_")


def gender_labels():
    """Apparent gender per person, from the male/female folders the research set was split into.
    It rides on the same 12 backbone features as the colour heads, so a scan gets it for free."""
    out = {}
    for g in ("male", "female"):
        d = os.path.join(OUT_ROOT, f"inference_clear_images_278_{g}")
        if os.path.isdir(d):
            for f in os.listdir(d):
                out[os.path.splitext(f)[0]] = g
    return out


def labels(path):
    d = pd.read_excel(path)
    g = gender_labels()
    out = {}
    for _, r in d.iterrows():
        if pd.isna(r["Celebrity Name"]) or pd.isna(r["Seasonal Colour"]):
            continue
        out[key(r["Celebrity Name"])] = dict(name=str(r["Celebrity Name"]).strip(),
                                             undertone=str(r["Skin Undertone"]).split()[0].strip(),
                                             season4=str(r["Seasonal Colour"]).split()[-1],
                                             season12=str(r["Seasonal Colour"]).strip(),
                                             gender=g.get(key(r["Celebrity Name"])))
    return {k: v for k, v in out.items() if v["gender"]}


def load(features_dir, name):
    z = np.load(os.path.join(features_dir, f"{name}_{TAG}.npz"), allow_pickle=True)
    per = {}
    for k, f in zip(z["keys"], z["features"]):
        per.setdefault(str(k).split("/")[0], []).append(f)
    keys = sorted(per)
    return keys, normalize(np.stack([np.mean(per[k], 0) for k in keys]))


def head():
    return make_pipeline(StandardScaler(), PCA(n_components=96, random_state=0),
                         LogisticRegression(max_iter=3000, C=1.0, class_weight="balanced"))


def oof(F, y, seeds=(0, 1, 2)):
    P = np.zeros((len(y), len(np.unique(y))))
    for s in seeds:
        for tr, te in StratifiedKFold(5, shuffle=True, random_state=s).split(F, y):
            P[te] += head().fit(F[tr], y[tr]).predict_proba(F[te]) / len(seeds)
    return P


def main(features_dir, labels_path, out_path, skip_oof):
    gt = labels(labels_path)
    blocks, keys = {}, None
    for name in BACKBONES:
        ks, F = load(features_dir, name)
        m = [i for i, k in enumerate(ks) if k in gt]
        ks = [ks[i] for i in m]
        if keys is None:
            keys = ks
        assert ks == keys, f"{name}: person order differs"
        blocks[name] = normalize(F[m])
        print(f"  {name:20s} {blocks[name].shape}")
    print(f"{len(keys)} labelled people")

    report, oof_probs = {}, {}
    if not skip_oof:
        for t in TARGETS:
            y = np.array([gt[k][t] for k in keys])
            P = np.mean([oof(blocks[n], y) for n in BACKBONES], 0)
            acc = float((np.unique(y)[P.argmax(1)] == y).mean())
            report[t] = round(acc * 100, 1)
            oof_probs[t] = P
            print(f"  out-of-fold {t:9s} {acc*100:.1f}%", flush=True)
        # kept so calibration / label-coherence rules can be checked without refitting
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        np.savez(os.path.join(os.path.dirname(out_path), "oof_probabilities.npz"), keys=np.array(keys),
                 **oof_probs, **{f"y_{t}": np.array([gt[k][t] for k in keys]) for t in TARGETS})

    heads, embeddings = {}, {}
    t0 = time.time()
    for name in BACKBONES:
        heads[name] = {}
        for t in TARGETS:
            y = np.array([gt[k][t] for k in keys])
            heads[name][t] = head().fit(blocks[name], y)
        # the undertone head's scaler+PCA is the shared embedding space for colour twins
        sc, pca = heads[name]["undertone"][0], heads[name]["undertone"][1]
        embeddings[name] = normalize(pca.transform(sc.transform(blocks[name]))).astype(np.float32)
    print(f"fitted {len(heads) * len(TARGETS)} heads in {time.time() - t0:.1f}s")

    bundle = dict(
        config="7 CNNs + 5 ViTs (mean of probabilities)",
        segmenter="graphonomy",
        backbones=BACKBONES,
        heads=heads,
        classes={t: list(heads["resnet50_imagenet"][t].classes_) for t in TARGETS},
        people=[dict(key=k, **gt[k]) for k in keys],
        embeddings=embeddings,
        oof_accuracy=report,
    )
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    joblib.dump(bundle, out_path, compress=3)
    print("saved ->", out_path, f"({os.path.getsize(out_path) / 1e6:.1f} MB)")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--features", default=DEFAULT_FEATURES)
    ap.add_argument("--labels", default=os.path.join(HERE, "data", "seasonapproved_undertones_colour.xlsx"))
    ap.add_argument("--out", default=os.path.join(HERE, "artifacts", "heads.joblib"))
    ap.add_argument("--skip-oof", action="store_true")
    a = ap.parse_args()
    main(os.path.abspath(a.features), a.labels, a.out, a.skip_oof)

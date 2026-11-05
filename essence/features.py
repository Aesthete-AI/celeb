"""Embed every curated essence photo with the same framework as the colour tables.

  1  head crop       extract_features.build_crops (SegFormer-B5, hair top to below the neck)   — as crops_top10
  2  region mask     maskers.MASKERS["graphonomy" | "selfie_segmenter"]  (face + hair + neck, rest black)
  3  embedding       extract_features.embed — each of the 12 frozen timm backbones, classifier removed

Nothing here is trained. Output: features/<backbone>_<masker>.npz with keys "<Person>/<nn>" and one row
per photo, plus timings.json (per-photo cost of each stage).

Usage:  python features.py [graphonomy|selfie_segmenter ...]
"""
import glob, json, os, sys, time
import cv2, numpy as np, torch

HERE = os.path.dirname(os.path.abspath(__file__))
BP = os.path.join(os.path.dirname(HERE), "AI Startup-20260916T113727Z-1-001", "AI Startup", "output", "backbone_pipeline")
sys.path.insert(0, BP)
sys.path.insert(0, os.path.join(os.path.dirname(BP), "segformer_clip_pipeline"))
import extract_features as EF            # noqa: E402
from maskers import MASKERS               # noqa: E402

TOP10 = os.path.join(HERE, "top10")
CROPS = os.path.join(HERE, "crops")
FEATS = os.path.join(HERE, "features")
CNNS = ["resnet50_imagenet", "efficientnet_b7", "densenet201", "inception_resnet_v2", "seresnext101", "nasnet_large", "convnext_large"]
VITS = ["dinov2_vit_large", "clip_vit_large", "siglip_so400m", "eva02_large", "vit_large_in21k"]
TIMES = os.path.join(HERE, "timings.json")


def timings():
    return json.load(open(TIMES)) if os.path.exists(TIMES) else {}


def save_time(key, ms):
    t = timings(); t[key] = round(ms, 2); json.dump(t, open(TIMES, "w"), indent=1)


def crops():
    t0 = time.perf_counter()
    before = len(glob.glob(os.path.join(CROPS, "*", "*.jpg")))
    keys = EF.build_crops(TOP10, CROPS, True, "segformer")
    made = len(glob.glob(os.path.join(CROPS, "*", "*.jpg"))) - before
    if made:
        save_time("segformer_crop_ms_per_photo", (time.perf_counter() - t0) * 1000 / made)
    return keys


def mask(which, keys, device="cuda"):
    cache = os.path.join(HERE, f"crops_masked_{which}")
    todo = [k for k in keys if not os.path.exists(os.path.join(cache, k + ".jpg"))]
    print(f"{which}: {len(keys)} crops, {len(todo)} to mask", flush=True)
    if todo:
        m = MASKERS[which](device)
        t0, failed = time.perf_counter(), 0
        for i, k in enumerate(todo, 1):
            img = cv2.imread(os.path.join(CROPS, k + ".jpg"))
            out, _ = m.masked(img)
            if out is None:
                out, failed = img, failed + 1          # nothing found -> keep the whole crop (as in the colour runs)
            os.makedirs(os.path.dirname(os.path.join(cache, k + ".jpg")), exist_ok=True)
            cv2.imwrite(os.path.join(cache, k + ".jpg"), out, [cv2.IMWRITE_JPEG_QUALITY, 96])
        save_time(f"{which}_mask_ms_per_photo", (time.perf_counter() - t0) * 1000 / len(todo))
        print(f"  masking failed on {failed} photos (whole crop kept)", flush=True)
        del m; torch.cuda.empty_cache()
    return cache


def embed(which, keys, cache):
    os.makedirs(FEATS, exist_ok=True)
    for name in CNNS + VITS:
        out = os.path.join(FEATS, f"{name}_{which}.npz")
        if os.path.exists(out):
            continue
        t0 = time.perf_counter()
        F, cfg = EF.embed(keys, cache, name, EF.BACKBONES[name])
        save_time(f"{name}_{which}_embed_ms_per_photo", (time.perf_counter() - t0) * 1000 / len(keys))
        np.savez_compressed(out, keys=np.array(keys), features=F.astype(np.float32), repo=EF.BACKBONES[name], masker=which)
        print(f"  {name:20s} -> {os.path.basename(out)} {F.shape}", flush=True)


if __name__ == "__main__":
    which = sys.argv[1:] or ["graphonomy", "selfie_segmenter"]
    keys = crops()
    print(len(keys), "photos", flush=True)
    for w in which:
        embed(w, keys, mask(w, keys))
    print("FEATURES DONE", flush=True)

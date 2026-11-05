"""Kitchener essence for new photos — % of all 7 essences — with no training.

Same framework as the evaluation: SegFormer head crop -> region mask (graphonomy | selfie_segmenter) -> the
12 frozen backbones -> per backbone: centre, cosine to the 7 essence prototypes, standardise, softmax ->
mean over backbones. The prototype bank (essence_prototypes_<masker>.npz) is built by evaluate.py from the
123 labelled people.

Usage:  python predict_essence.py photo1.jpg [photo2.jpg ...] [--masker selfie_segmenter] [--models 7CNN+5ViT|7CNN|5ViTs]
        [--gender female|male]   (recommended: 5 ViTs with same-gender prototypes — best in the evaluation)
        (several photos of ONE person are averaged first, like the 10-photo consensus)
"""
import argparse, os, sys, tempfile
import cv2, numpy as np, torch

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from features import EF, MASKERS, CNNS, VITS   # noqa: E402
import segformer_clip_pipeline as SC            # noqa: E402


def l2(x):
    return x / np.maximum(np.linalg.norm(x, axis=-1, keepdims=True), 1e-12)


def predict(paths, masker="graphonomy", models="5ViTs", gender=None, device="cuda"):
    """gender ('female' | 'male') selects the recommended same-gender prototypes; None uses all people."""
    bank = np.load(os.path.join(HERE, f"essence_prototypes_{masker}{'_same_gender' if gender else ''}.npz"), allow_pickle=True)
    ess = [str(e) for e in bank["essences"]]
    names = {"7CNN": CNNS, "5ViTs": VITS, "7CNN+5ViT": CNNS + VITS}[models]
    tmp = tempfile.mkdtemp()
    parser, mk = SC.SegFormerParser(device), MASKERS[masker](device)
    keys = []
    for i, p in enumerate(paths):
        img = cv2.imread(p)
        P = parser.parse(img)
        crop = P["crop"] if P is not None else img
        out, _ = mk.masked(crop)
        cv2.imwrite(os.path.join(tmp, f"{i:02d}.jpg"), out if out is not None else crop, [cv2.IMWRITE_JPEG_QUALITY, 96])
        keys.append(f"{i:02d}")
    del parser, mk; torch.cuda.empty_cache()
    probs = []
    for n in names:
        F, _ = EF.embed(keys, tmp, n, EF.BACKBONES[n], device=device)
        z = l2(F.mean(0))                                   # several photos of one person -> one vector
        zc = l2(z - bank[f"{n}__mu"])
        s = zc @ bank[f"{n}__prototypes_{gender}" if gender else f"{n}__prototypes"].T
        x = (s - bank[f"{n}__m"]) / bank[f"{n}__s"]
        e = np.exp(x - x.max()); probs.append(e / e.sum())
    p = np.mean(probs, 0)
    return dict(sorted(((ess[i], round(float(p[i]) * 100, 1)) for i in range(len(ess))), key=lambda kv: -kv[1]))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("photos", nargs="+")
    ap.add_argument("--masker", default="graphonomy", choices=list(MASKERS))
    ap.add_argument("--models", default="5ViTs", choices=["7CNN+5ViT", "7CNN", "5ViTs"])
    ap.add_argument("--gender", choices=["female", "male"], help="recommended: gives the same-gender prototypes")
    a = ap.parse_args()
    r = predict(a.photos, a.masker, a.models, a.gender)
    print("Kitchener essence:", ", ".join(f"{v}% {k}" for k, v in r.items()))
    print("Dominant:", next(iter(r)))

"""The two framework tables (Graphonomy / Selfie Segmenter) with Kitchener essence rows added.

Resource rows are copied from the existing tables; colour rows come from masked_variants_scores.csv (the run
behind those tables); essence rows from essence_scores.csv. Writes essence_tables.md and essence_tables.xlsx.
"""
import os
import numpy as np, pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
BP = os.path.join(os.path.dirname(HERE), "AI Startup-20260916T113727Z-1-001", "AI Startup", "output", "backbone_pipeline")
COLS = ["resnet50_imagenet", "efficientnet_b7", "densenet201", "inception_resnet_v2", "seresnext101", "nasnet_large",
        "convnext_large", "dinov2_vit_large", "clip_vit_large", "siglip_so400m", "eva02_large", "vit_large_in21k",
        "7CNN", "5 ViTs", "7CNN+5ViT"]
HEAD = ["ResNet-50", "EffNet-B7", "DenseNet-201", "Incep-RN-V2", "SE-ResNeXt", "NASNet-L", "ConvNeXt-L", "DINOv2",
        "CLIP-L", "SigLIP", "EVA-02", "ViT-L 21k", "7CNN", "5 ViTs", "7CNN+5ViT"]
COLOUR_CFG = {"7CNN": "7 CNNs", "5 ViTs": "5 ViTs", "7CNN+5ViT": "CNNs + 5 ViTs"}

RES = {
    "graphonomy": {
        "Weights total": ["253 MB", "414 MB", "231 MB", "376 MB", "525 MB", "498 MB", "944 MB", "1.33 GB", "1.33 GB", "1.82 GB", "1.33 GB", "1.33 GB", "2.23 GB", "6.50 GB", "8.58 GB"],
        "Peak RAM (GB)": ["1.40", "1.51", "1.40", "1.51", "1.67", "1.62", "2.49", "3.34", "3.82", "4.31", "3.34", "3.33", "3.27", "5.74", "5.66"],
        "Peak VRAM (GB)": ["0.54", "0.54", "0.54", "0.54", "0.54", "0.54", "0.84", "1.31", "1.24", "1.79", "1.29", "1.23", "0.84", "1.79", "1.79"],
        "Per person GPU (s)": ["0.21", "0.29", "0.25", "0.27", "0.23", "0.28", "0.25", "0.71", "0.29", "0.56", "0.61", "0.28", "0.65", "1.68", "2.13"],
        "Per person CPU (s)": ["3.5", "6.1", "3.6", "3.8", "3.8", "4.4", "4.1", "88", "46", "89", "171", "70", "9.2", "450", "456"],
    },
    "selfie_segmenter": {
        "Segmenter weights": ["21.6 MB"] * 15,
        "Weights total": ["116 MB", "277 MB", "94 MB", "239 MB", "388 MB", "361 MB", "807 MB", "1.19 GB", "1.19 GB", "1.68 GB", "1.19 GB", "1.19 GB", "2.09 GB", "6.37 GB", "8.44 GB"],
        "Peak RAM (GB)": ["1.38", "1.51", "1.38", "1.51", "1.67", "1.62", "2.49", "3.34", "3.82", "4.31", "3.34", "3.33", "3.27", "5.74", "5.66"],
        "Peak VRAM (GB)": ["0.11", "0.47", "0.09", "0.24", "0.39", "0.45", "0.84", "1.31", "1.24", "1.79", "1.29", "1.23", "0.84", "1.79", "1.79"],
        "Per person GPU (s)": ["1.07", "1.16", "1.12", "1.13", "1.10", "1.15", "1.11", "1.58", "1.16", "1.42", "1.48", "1.14", "1.52", "2.54", "2.99"],
        "Per person CPU (s)": ["1.2", "3.9", "1.3", "1.5", "1.6", "2.1", "1.8", "86", "44", "86", "168", "68", "7.0", "447", "453"],
    },
}
COLOUR_ROWS = {
    "graphonomy": {
        "Undertone": "53.2 52.2 54.0 51.1 53.2 49.6 58.3 53.2 63.3 54.0 56.8 58.3 60.8 60.1 64.4",
        "4-season": "41.0 35.3 45.7 40.6 36.3 35.3 44.2 43.5 41.4 50.0 49.3 40.6 45.0 48.9 51.1",
        "12-season": "20.1 16.9 20.5 17.6 17.3 18.0 20.1 16.9 20.1 23.4 23.4 24.1 23.7 26.6 28.1"},
    "selfie_segmenter": {
        "Undertone": "54.0 55.4 57.6 53.2 52.9 50.7 59.0 51.8 58.6 53.2 55.8 56.5 60.1 61.5 62.6",
        "4-season": "38.8 38.1 42.4 41.0 35.3 38.1 43.2 43.5 42.1 50.4 42.4 39.9 47.8 48.2 50.0",
        "12-season": "20.1 15.5 21.6 18.0 17.6 15.1 20.9 20.9 20.5 24.5 24.8 25.5 22.7 26.3 27.3"},
}
COLOUR_TAG = {"graphonomy": "top10_masked_graphonomy", "selfie_segmenter": "top10_masked_mediapipe3"}
TITLE = {"graphonomy": "Graphonomy — unchanged",
         "selfie_segmenter": "Selfie Segmenter as the segmentation model (Multiclass Selfie Segmenter 16 MB + PoseLandmarker lite trimmer 5.6 MB = 21.6 MB, CPU-only)"}
ESS_ROWS = [("same gender", "dominant", "Essence — dominant (same-gender prototypes)"),
            ("same gender", "top-2", "Essence — top-2"),
            ("same gender", "balanced", "Essence — balanced (7 classes)"),
            ("same gender", "blend overlap", "Essence — blend overlap"),
            ("same gender", "per photo", "Essence — single photo"),
            ("main", "dominant", "Essence — dominant (all-people prototypes)")]


def bank_kb(masker, col):
    z = np.load(os.path.join(HERE, f"essence_prototypes_{masker}_same_gender.npz"))
    names = {"7CNN": COLS[:7], "5 ViTs": COLS[7:12], "7CNN+5ViT": COLS[:12]}.get(col, [col])
    b = sum(z[f"{n}__{k}"].nbytes for n in names for k in ("mu", "prototypes_female", "prototypes_male", "m", "s"))
    return f"{b/1024:.0f} KB" if b < 1024 ** 2 else f"{b/1024**2:.1f} MB"


def table(masker):
    col = pd.read_csv(os.path.join(BP, "masked_variants_scores.csv"))
    col = col[col.variant == COLOUR_TAG[masker]].set_index("config")
    ess = pd.read_csv(os.path.join(HERE, "essence_scores.csv"))
    ess = ess[ess.masker == {"graphonomy": "Graphonomy", "selfie_segmenter": "Selfie Segmenter"}[masker]]
    rows = dict(RES[masker])
    # colour rows exactly as published in the existing tables (re-rounding the CSV flips a few last digits)
    for lab, vals in COLOUR_ROWS[masker].items():
        rows[lab] = [f"{v}%" for v in vals.split()]
    rows["Essence head (prototype bank)"] = [bank_kb(masker, c) for c in COLS]
    for variant, metric, lab in ESS_ROWS:
        e = ess[ess.variant == variant].set_index("config")
        rows[lab] = [f"{e.loc[c, metric]*100:.1f}%" for c in COLS]
    return pd.DataFrame(rows, index=HEAD).T


def md(df):
    num = lambda s: float(s.rstrip("%")) if s.endswith("%") else None
    out = ["| Metric | " + " | ".join(df.columns) + " |", "|---" * (len(df.columns) + 1) + "|"]
    for r, vals in df.iterrows():
        v = list(vals)
        nums = [num(x) for x in v]
        best = max((x for x in nums if x is not None), default=None)
        cells = [f"**{x}**" if best is not None and num(x) == best else x for x in v]
        out.append(f"| {r} | " + " | ".join(cells) + " |")
    return "\n".join(out)


if __name__ == "__main__":
    parts = []
    with pd.ExcelWriter(os.path.join(HERE, "essence_tables.xlsx"), engine="openpyxl") as w:
        for m in ("graphonomy", "selfie_segmenter"):
            df = table(m)
            df.to_excel(w, sheet_name={"graphonomy": "Graphonomy", "selfie_segmenter": "Selfie Segmenter"}[m])
            parts.append(f"### {TITLE[m]}\n\n{md(df)}\n")
    open(os.path.join(HERE, "essence_tables.md"), "w").write("\n".join(parts))
    print("\n".join(parts))

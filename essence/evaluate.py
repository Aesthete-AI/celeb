"""Kitchener essence from the frozen 7 CNN + 5 ViT framework — no training — and its accuracy.

Algorithm: leave-one-person-out soft prototypes (decided before looking at any result)
  For one backbone:
    1  person vector   z_i = L2(mean of the person's 10 photo embeddings)          — as in the colour tables
    2  centre          z_i <- L2(z_i - mean over all people)                       — label-free
    3  prototypes      P_e = L2( sum_j w_je * z_j ) over every OTHER person j, w_je = j's labelled share of
                       essence e (blends count partially: a 45% Natural / 45% Romantic person feeds both)
    4  similarity      s_ie = z_i . P_e
    5  calibration     each essence's similarities standardised over people (label-free), so an essence
                       with many examples does not win by default
    6  percentages     p_i = softmax(standardised s_i) -> a % for all 7 essences
  Combination: mean of the backbones' percentage vectors (7 CNNs, 5 ViTs, all 12), as in the colour tables.

Nothing is fitted: no weights, no head, no tuned threshold. A person's own photos and label never touch their
own prediction, and every one of the 1,230 photos is inferred. The same four statistics computed from all
123 people form the deployable prototype bank (essence_prototypes_<masker>.npz) used by predict_essence.py.

Scores (all against essence_labels.json):
  dominant      predicted top essence is the labelled dominant one (any of them when the source ties)
  in blend      predicted top essence is one of the person's labelled essences
  top-2         a labelled dominant essence is in the predicted top two
  balanced      dominant accuracy averaged over the 7 essences (corrects for Romantic being most common)
  blend overlap sum_e min(predicted %, labelled %) — 100% means identical percentages
  per photo     dominant accuracy when each photo is scored on its own instead of the 10-photo consensus
"""
import json, os, sys
import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
FEATS = os.path.join(HERE, "features")
CNNS = ["resnet50_imagenet", "efficientnet_b7", "densenet201", "inception_resnet_v2", "seresnext101", "nasnet_large", "convnext_large"]
VITS = ["dinov2_vit_large", "clip_vit_large", "siglip_so400m", "eva02_large", "vit_large_in21k"]
SHORT = {"resnet50_imagenet": "ResNet-50", "efficientnet_b7": "EffNet-B7", "densenet201": "DenseNet-201",
         "inception_resnet_v2": "Incep-RN-V2", "seresnext101": "SE-ResNeXt", "nasnet_large": "NASNet-L",
         "convnext_large": "ConvNeXt-L", "dinov2_vit_large": "DINOv2", "clip_vit_large": "CLIP-L", "siglip_so400m": "SigLIP",
         "eva02_large": "EVA-02", "vit_large_in21k": "ViT-L 21k"}
MASKERS = {"graphonomy": "Graphonomy", "selfie_segmenter": "Selfie Segmenter"}

L = json.load(open(os.path.join(HERE, "essence_labels.json")))
ESS = L["essences"]
# Excluded from the photo benchmark (labels kept in essence_labels.json): no photograph of him exists; the three
# images that passed the real-photograph check are photorealistic digital reconstructions of statues.
EXCLUDE = {"Akhenaten": "ancient pharaoh — only statues and digital reconstructions exist"}
PEOPLE = {p["stem"]: p for p in L["people"] if p["stem"] not in EXCLUDE}


def l2(x):
    return x / np.maximum(np.linalg.norm(x, axis=-1, keepdims=True), 1e-12)


def softmax(x):
    e = np.exp(x - x.max(-1, keepdims=True))
    return e / e.sum(-1, keepdims=True)


def load(name, masker):
    z = np.load(os.path.join(FEATS, f"{name}_{masker}.npz"), allow_pickle=True)
    keys, F = [str(k) for k in z["keys"]], z["features"]
    per = {}
    for k, f in zip(keys, F):
        per.setdefault(k.split("/")[0], []).append(f)
    stems = sorted(s for s in per if s in PEOPLE)
    Zp = l2(np.stack([np.mean(per[s], 0) for s in stems]))                 # person vectors (step 1)
    img_owner = [k.split("/")[0] for k in keys]
    keep = [i for i, s in enumerate(img_owner) if s in PEOPLE]
    return stems, Zp, [img_owner[i] for i in keep], l2(F[keep])


def predict(stems, Z, W, Zimg=None, img_owner=None, centre=True, gender=None):
    """Leave-one-person-out percentages for every person (and every photo, if given)."""
    mu = Z.mean(0) if centre else 0
    Zc = l2(Z - mu)
    S = Zc @ l2(W.T @ Zc).T * 0                                            # shape (people, essences)
    sums = W.T @ Zc                                                         # sum_j w_je z_j  (essence x dim)
    for i in range(len(stems)):
        others = sums - np.outer(W[i], Zc[i])                               # remove person i (step 3)
        if gender is not None:                                              # ablation: same-gender people only
            same = np.array([g == gender[i] for g in gender]); same[i] = False
            others = W[same].T @ Zc[same]
        S[i] = Zc[i] @ l2(others).T
    m, s = S.mean(0), S.std(0) + 1e-9                                       # step 5, label-free
    P = softmax((S - m) / s)
    Pimg = None
    if Zimg is not None:
        Zi = l2(Zimg - mu)
        idx = {s_: i for i, s_ in enumerate(stems)}
        Simg = np.empty((len(Zi), len(ESS)))
        for k, owner in enumerate(img_owner):
            i = idx[owner]
            if gender is not None:
                same = np.array([g == gender[i] for g in gender]); same[i] = False
                Simg[k] = Zi[k] @ l2(W[same].T @ Zc[same]).T
            else:
                Simg[k] = Zi[k] @ l2(sums - np.outer(W[i], Zc[i])).T
        Pimg = softmax((Simg - m) / s)
    bank = dict(mu=mu, prototypes=l2(sums), m=m, s=s)
    if gender is not None:                                                   # one prototype set per gender
        for gg in sorted(set(gender)):
            sel = np.array([x == gg for x in gender])
            bank[f"prototypes_{gg}"] = l2(W[sel].T @ Zc[sel])
    return P, Pimg, bank


def metrics(P, stems, Pimg=None, img_owner=None):
    W = np.array([[PEOPLE[s]["blend"][e] for e in ESS] for s in stems])
    dom = [set(PEOPLE[s]["dominant"]) for s in stems]
    top = [ESS[i] for i in P.argmax(1)]
    order = np.argsort(-P, 1)
    r = {}
    r["dominant"] = np.mean([t in d for t, d in zip(top, dom)])
    r["in blend"] = np.mean([W[i, ESS.index(t)] > 0 for i, t in enumerate(top)])
    r["top-2"] = np.mean([bool({ESS[j] for j in order[i, :2]} & dom[i]) for i in range(len(stems))])
    rec = []
    for e in ESS:
        idx = [i for i, d in enumerate(dom) if e in d]
        if idx:
            rec.append(np.mean([top[i] in dom[i] for i in idx]))
    r["balanced"] = float(np.mean(rec))
    r["blend overlap"] = float(np.minimum(P, W).sum(1).mean())
    if Pimg is not None:
        idx = {s: i for i, s in enumerate(stems)}
        r["per photo"] = np.mean([ESS[Pimg[k].argmax()] in dom[idx[o]] for k, o in enumerate(img_owner)])
    return r


def baselines(stems):
    W = np.array([[PEOPLE[s]["blend"][e] for e in ESS] for s in stems])
    dom = [set(PEOPLE[s]["dominant"]) for s in stems]
    prior = W.mean(0)
    maj = ESS[int(np.argmax([sum(e in d for d in dom) for e in ESS]))]
    return {"Always '%s' (most common)" % maj: dict(dominant=np.mean([maj in d for d in dom]),
                                                   balanced=1 / len(ESS), **{"blend overlap": float(np.minimum(prior, W).sum(1).mean())}),
            "Random guess (1 in 7)": dict(dominant=np.mean([len(d) / len(ESS) for d in dom]), balanced=1 / len(ESS))}


def run(masker, variant="main"):
    blocks, rows, banks = {}, [], {}
    stems = None
    for n in CNNS + VITS:
        if not os.path.exists(os.path.join(FEATS, f"{n}_{masker}.npz")):
            continue
        st, Z, own, Zimg = load(n, masker)
        stems = stems or st
        assert st == stems
        W = np.array([[PEOPLE[s]["blend"][e] for e in ESS] for s in st])
        g = [PEOPLE[s]["gender"] for s in st] if variant == "same gender" else None
        P, Pimg, bank = predict(st, Z, W, Zimg, own, centre=(variant != "no centring"), gender=g)
        blocks[n] = (P, Pimg, own); banks[n] = bank
        rows.append(dict(config=n, label=SHORT[n], **metrics(P, st, Pimg, own)))
    combos = {"7CNN": CNNS, "5 ViTs": VITS, "7CNN+5ViT": CNNS + VITS}
    for label, ns in combos.items():
        ns = [n for n in ns if n in blocks]
        if not ns:
            continue
        P = np.mean([blocks[n][0] for n in ns], 0)
        Pimg = np.mean([blocks[n][1] for n in ns], 0)
        rows.append(dict(config=label, label=label, **metrics(P, stems, Pimg, blocks[ns[0]][2])))
        blocks[label] = (P, Pimg, blocks[ns[0]][2])
    return pd.DataFrame(rows), blocks, stems, banks


def per_person_sheet(P, stems):
    out = []
    for i, s in enumerate(stems):
        p = PEOPLE[s]
        order = np.argsort(-P[i])
        out.append({"Person": p["person"], "Labelled dominant": " / ".join(p["dominant"]),
                    "Labelled blend": ", ".join(f"{round(p['blend'][e]*100)}% {e}" for e in p["essences"]),
                    "Predicted dominant": ESS[order[0]],
                    "Predicted blend (top 3)": ", ".join(f"{round(P[i, j]*100)}% {ESS[j]}" for j in order[:3]),
                    "Dominant correct": "Yes" if ESS[order[0]] in p["dominant"] else "No",
                    **{f"{e} %": round(float(P[i, k]) * 100, 1) for k, e in enumerate(ESS)}})
    return pd.DataFrame(out)


if __name__ == "__main__":
    maskers = [m for m in MASKERS if any(f.endswith(f"_{m}.npz") for f in os.listdir(FEATS))]
    results, xl = {}, {}
    for mk in maskers:
        for variant in ("main", "no centring", "same gender"):
            df, blocks, stems, banks = run(mk, variant)
            results[(mk, variant)] = df
            if variant in ("main", "same gender"):
                cfg = "7CNN+5ViT" if variant == "main" else "5 ViTs"          # recommended: 5 ViTs, same gender
                tag = "" if variant == "main" else "_same_gender"
                xl[f"{MASKERS[mk][:10]} {cfg} {'gender' if tag else 'all'}"] = per_person_sheet(blocks[cfg][0], stems)
                np.savez_compressed(os.path.join(HERE, f"essence_prototypes_{mk}{tag}.npz"), essences=np.array(ESS),
                                    **{f"{n}__{k}": v for n, b in banks.items() for k, v in b.items()})
                # per-essence recall
                P = blocks[cfg][0]
                rec = []
                for e in ESS:
                    idx = [i for i, s in enumerate(stems) if e in PEOPLE[s]["dominant"]]
                    rec.append(dict(Essence=e, People=len(idx),
                                    Correct=sum(ESS[P[i].argmax()] in PEOPLE[stems[i]]["dominant"] for i in idx),
                                    Recall=round(np.mean([ESS[P[i].argmax()] in PEOPLE[stems[i]]["dominant"] for i in idx]) * 100, 1),
                                    **{"Predicted as this": int(sum(ESS[P[i].argmax()] == e for i in range(len(stems))))}))
                xl[f"{MASKERS[mk][:10]} {cfg} recall{tag[:7]}"] = pd.DataFrame(rec)
            print(f"\n== {MASKERS[mk]} — {variant}")
            print(df[["label", "dominant", "in blend", "top-2", "balanced", "blend overlap", "per photo"]]
                  .assign(**{c: lambda d, c=c: (d[c] * 100).round(1) for c in ["dominant", "in blend", "top-2", "balanced", "blend overlap", "per photo"]})
                  .to_string(index=False))
    # baselines over the people actually evaluated (Akhenaten has no photographs, so no features)
    b = baselines(run(maskers[0])[2])
    print("\nbaselines:", {k: {m: round(v * 100, 1) for m, v in d.items()} for k, d in b.items()})
    allrows = pd.concat([d.assign(masker=MASKERS[m], variant=v) for (m, v), d in results.items()])
    allrows.to_csv(os.path.join(HERE, "essence_scores.csv"), index=False)
    with pd.ExcelWriter(os.path.join(HERE, "essence_results.xlsx"), engine="openpyxl") as w:
        for (m, v), d in results.items():
            d.drop(columns="config").assign(**{c: (d[c] * 100).round(1) for c in d.columns if c not in ("config", "label")}) \
             .to_excel(w, sheet_name=f"{MASKERS[m][:10]} {v}"[:31], index=False)
        for k, d in xl.items():
            d.to_excel(w, sheet_name=k[:31], index=False)
        pd.DataFrame([dict(Baseline=k, **{m: round(v * 100, 1) for m, v in d.items()}) for k, d in b.items()]) \
          .to_excel(w, sheet_name="Baselines", index=False)
    print("saved essence_results.xlsx, essence_scores.csv, essence_prototypes_*.npz")

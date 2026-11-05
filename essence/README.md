# Kitchener essence — 7 CNN + 5 ViT framework, no training

## Files
| File | What it is |
|---|---|
| `raw_labels.tsv` | the 123-person list exactly as supplied |
| `essence_labels.{json,csv,xlsx}` | parsed ground truth: 7 essences (Gamine = High-Spirited, Ingenue = Youthful, Ethereal = Angelic), % blend per person, dominant essence(s), search name, gender |
| `top10/<Person>/01–10.jpg` | 10 curated portraits per person (Akhenaten: 3, excluded — see below) |
| `essence_images_manifest.xlsx` | per person and per image: source URL, rules met / missed, scores |
| `features/<backbone>_<masker>.npz` | embeddings of every photo, 12 backbones × 2 maskers |
| `essence_results.xlsx` / `essence_scores.csv` | every configuration and variant; per-person predicted % for all 7 essences; per-essence recall; baselines |
| `essence_tables.{md,xlsx}` | the two framework tables with the essence rows added |
| `essence_prototypes_<masker>[_same_gender].npz` | the prototype bank used for inference |
| `predict_essence.py` | % of all 7 essences for new photos: `python predict_essence.py a.jpg [b.jpg …] --gender female` |

Scripts, in order: `labels.py` → `curate.py all` → `features.py` → `evaluate.py` → `make_tables.py`.

## Photos — same rules as the 278 colour set
`curate.py` imports the original `web_portraits` functions unchanged (search, download, `Judge`, identity
consensus, hand check, portrait crop, de-duplication). 23 people already in the 278 set reuse those 10 photos.
One check was added: **real photograph** (CLIP ViT-L/14 ≥ 0.05 against cartoon / painting / statue), because
search results for some people included cartoons and statues. **Akhenaten** has no photographs (statues and
digital reconstructions only), so he is excluded from the benchmark → **122 people, 1,220 photos**.

## Algorithm — leave-one-person-out soft prototypes
Per backbone: person vector (mean of 10 embeddings, L2) → centre → cosine to 7 essence prototypes built from every
*other* person, weighted by their labelled blend → standardise each essence's scores → softmax = % of each essence.
Models are combined by the mean of probabilities, as in the colour tables. Nothing is fitted; a person's own
photos and label never touch their prediction (on random features it scores 15.6%; letting a person into their
own prototypes would give 83.5%). Recommended variant: prototypes from people of the **same gender**.

## Result (122 people; always-"Romantic" = 22.1%, random = 14.9%)
| Configuration | Dominant | 95% CI | Top-2 |
|---|---|---|---|
| SigLIP, same gender (Graphonomy) | **43.4%** | 35.0–52.3% | 62.3% |
| 5 ViTs, same gender (Graphonomy) | 41.8% | 33.4–50.7% | 59.8% |
| 7 CNN + 5 ViT, same gender (Selfie Segmenter) | 35.2% | 27.3–44.1% | 60.7% |
| 7 CNN alone | ≈ 22% (chance) | | |

The same-gender variant was one of three set out before running, but it was chosen as best on these same 122
people, so its figures are slightly optimistic.

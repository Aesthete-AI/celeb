# Teinte: colour analysis and personal stylist

A React website around the **Graphonomy + 7 CNN + 5 ViT** colour pipeline. A visitor uploads a selfie and gets a **skin undertone** and a **12-season colour**. They then browse lookbooks (clothing, makeup, hair, jewellery and seven occasions) dressed in their colours, and can talk to a stylist chat that stays in sync with the page on screen.

```
teinte/
├── run.sh                    build the site + serve site and API on :8000  (./run.sh --demo for UI work)
├── backend/
│   ├── server.py             FastAPI: /api/health, /api/analyze, /api/chat (SSE), serves frontend/dist
│   ├── engine.py             Graphonomy mask → 12 frozen backbones → heads → mean of probabilities → fusion
│   ├── train_heads.py        fits the production heads from the cached Graphonomy-masked features
│   ├── evaluate_fusion.py    picks the 12-season coherence weights on out-of-fold probabilities
│   ├── artifacts/            heads.joblib (36 heads + colour-twin embeddings), oof_probabilities.npz
│   └── models/graphonomy/    network code (+ symlink to graphonomy_inference.pth)
└── frontend/                 Vite + React 18 + TypeScript + Tailwind + Framer Motion
    └── src/
        ├── data/             the curated database: seasons.ts, sections.ts, looks.ts, quiz.ts, celebs.json
        ├── lib/              face.ts (MediaPipe, in-browser crop), stylist.ts (recommendation engine), intent.ts, api.ts
        ├── components/       ModelFigure (SVG fashion models), ChatPanel, Drape, LookCard, Nav, …
        └── pages/            Home, Analyze, Palette, Lookbook, Section, Seasons, Wardrobe, Privacy
```

## The analysis pipeline (same as the research code)

| Step | Where | What |
|---|---|---|
| 1 Face + crop | **browser** (MediaPipe Face Landmarker) | face box → `croppers.expand` geometry: 0.8 × face-height above, 0.9 × below, square, ≥ 2 × face-width. Photo checks: face, framing, pose, lighting, focus |
| 2 Segment | server, Graphonomy (single pass, 512²) | face = 13, hair = 2, neck = 10; everything else black; JPEG q96 round-trip as in training |
| 3 Embed | server, 12 frozen timm backbones | ResNet-50, EfficientNet-B7, DenseNet-201, Inception-ResNet-V2, SE-ResNeXt-101, NASNet-L, ConvNeXt-L, DINOv2-L, CLIP-L, SigLIP-SO400M, EVA-02-L, ViT-L/16. 1–3 photos are averaged per backbone, then L2-normalised |
| 4 Heads | server | per backbone: StandardScaler → PCA(96) → balanced logistic regression, fitted on all 278 people |
| 5 Combine | server | mean of the 12 probability vectors; 12-season × 4-season^1.0 × undertone^0.5 coherence product |

**Verified against your cached outputs.** On `Aaron_Tveit/01`, the engine's masked input matches `data/3_model_inputs_graphonomy` with a mean pixel difference of 0.009/255. The ResNet-50 feature matches the cached vector at cosine 0.99995. Refitting reproduces the saved Graphonomy report's predictions (100% / 100% / 99.6% agreement).

**Accuracy (278 people, out-of-fold):**

| | Undertone | 4-season | 12-season |
|---|---|---|---|
| Saved Graphonomy report / this refit | 63.3% | 53.6% | 24.5% |
| With the coherence fusion (shipped) | 63.3% | 53.6% | **27.0%** |

The release README's table (64.4 / 51.1 / 28.1) doesn't match the saved report; it probably comes from `combine.py`'s per-repeat averaging. The fusion weights were chosen on the same out-of-fold set, so 27.0% is slightly optimistic. Users upload 1–3 photos, but the heads were trained on 10-photo averages, so expect single-selfie accuracy below these numbers. The UI encourages extra photos.

**Latency on this machine's RTX 5000 Ada** (`bench_gpu.py`, end to end, all 12 models resident, 11 GB VRAM):

| Photos | Total | Graphonomy | Preprocess + 12 backbones |
|---|---|---|---|
| 1 (a single selfie) | **0.26 s** | 42 ms | 209 ms |
| 3 (site maximum) | **0.65 s** | 120 ms | 519 ms |
| 10 (the published setting) | **2.21 s** (published: 2.13 s) | 393 ms | 1.81 s |

All 12 backbones reproduce the cached research features on GPU (worst cosine 0.99997). The first version took 7.1 s for 10 photos because timm's CPU preprocessing thrashed on 20 intra-op threads. With `torch.set_num_threads(1)` on CUDA, transforms shared across models with identical preprocessing (10 distinct of 12) and an 8-thread pool, preprocessing fell from 5.1 s to 0.09 s with identical numerics. On CPU only, expect minutes per analysis.

### This machine (RTX 5000 Ada, 32 GB)

`nvidia-smi` reports *Driver/library version mismatch*. On Oct 16 an unattended upgrade installed kernel `6.17.0-1033-oem` with the 595.99 NVIDIA module and 595.99 user-space libraries, but the machine is still running kernel `…-1032` with the 595.84 module. Only NVML (what `nvidia-smi` uses) refuses the mismatch. The CUDA driver API accepts it within the 595 branch, so PyTorch (`+cu130`) runs on the GPU as-is. Reboot when convenient (GRUB boots the newest kernel by default) to restore `nvidia-smi`. `bench_gpu.py` checks fidelity and latency on the GPU.

## Privacy model

The full photo never leaves the browser. The browser cuts the head-and-neck crop and sends only that. The server decodes it in memory and drops it after the response; nothing is written or logged. The original wording, "only skin-colour samples are sent", would be **untrue** for this pipeline, because the 12 backbones need the masked face, hair and neck image. The site therefore says: *"Your photo stays in your browser and is visible only to you… only that crop is sent to be read — analysed in memory, then discarded."* The drape studio uses an in-tab copy that is never persisted.

## The recommendation database: 12 profiles × 11 categories

**Profile = season family × undertone** (4 × 3 = 12), e.g. `autumn-warm` or `winter-neutral`. The engine returns it as `profile`. It is derived from the fused 12-season result and the undertone head.

- **Undertone sets temperature and metals.** Warm points to yellow gold, cream, coral and olive. Cool points to silver, white gold, crisp white, berry and blue. Neutral leaves room for both: rose gold, mixed metals, soft white, dusty rose and jade.
- **Season sets depth and intensity.** Spring is light and clear, Summer light and soft, Autumn deep and rich, Winter deep and crisp.
- **`backend/catalog/rules.py`** is the single source of truth. Each profile has 8 colours, 4 neutrals, 4 colours to avoid, metals, gems, lips/blush/eyes and hair colours, plus a "why" rule for each category.
- **Categories:** jewellery, hairstyles, makeup, clothing, office, party, festive, date night, casual, vacation and black tie, each with search intents for women and men.

**Images.** Photos come from **Pexels** (free commercial licence, attribution shown). Scraping Amazon, Myntra, Flipkart, Meesho or Shein isn't used: their terms prohibit robots and data mining, and the product photos are copyrighted.

```
catalog/ingest.py   pool: each intent searched once, 2 × 80 photos              (~140 API calls)
                    targeted: each intent per profile, colour-filtered          (~840 API calls)
                    thumbnails analysed locally: k-means colours (Lab) + edge density
catalog/build.py    for each of 264 slots (profile × category × gender), score every candidate:
                    0.62·palette fit − 0.30·avoid clash + 0.20·minimalism + 0.08·quality (+ targeted bonus)
                    (CIEDE2000; pale low-chroma backdrops down-weighted), take the top 10 with diversity
                    rules → SQLite `slots` → frontend/public/catalog/<profile>.json
```

Fill it once (Pexels allows 200 calls/hour by default; the job is resumable and waits for each reset):

```bash
echo "PEXELS_API_KEY=<your key>" >> backend/.env       # free key: https://www.pexels.com/api/
cd backend && .venv/bin/python -m catalog.ingest      # pool phase finishes in minutes, so the site is usable;
                                                      # targeted phase refreshes the catalogue every 120 calls (~5 h)
.venv/bin/python -m catalog.build                     # re-rank anytime (≈ seconds), e.g. after editing rules.py
```

After a scan, the profile's catalogue is prefetched while the result animates, so **Your Edit** (`/for-you`, `/for-you/<category>`) renders instantly. Until photos exist, each slot shows colour-story tiles built from the same rules. The pipeline was tested end to end against a fake Pexels API and filled 2,640 of 2,640 slots.

## The recommendation engine and stylist chat

- **Routing:** `intent.ts` maps a question to a category and gender ("sangeet" → Festive, "my husband" → men), and the main pane navigates to `/for-you/<category>` while the chat answers.
- **Grounding:** `stylist.ts` builds the LLM context from the profile's rules, colours, metals, makeup and hair, plus the photos on the matching page, so answers refer to what is on screen.
- **No profile yet:** the chat asks 7 quick questions (veins, metal, sun, natural hair, eyes, white vs ivory, contrast), scores them on the temperature/value/chroma axes, saves the result and then answers the original question.
- **Follow-ups:** each answer ends with a follow-up question and three tappable replies (`<<FOLLOWUPS>>` trailer).
- **Models:** an ordered chain of free OpenAI-compatible providers with per-model fallback: Gemini, then Groq, then OpenRouter, then local Ollama. With no key, or if every provider fails, the curated engine answers from the same database, so the chat always works.

## Running it

```bash
# 1. backend (Python 3.12). On a GPU box install the CUDA torch build first:
cd backend
python3 -m venv .venv
.venv/bin/pip install torch==2.14.1 torchvision==0.29.1 --index-url https://download.pytorch.org/whl/cu130
.venv/bin/pip install -r requirements.txt
cp .env.example .env              # add a free GEMINI_API_KEY (and/or GROQ_API_KEY)

# 2. everything (needs Node 20+)
cd .. && ./run.sh                 # http://localhost:8000
./run.sh --demo                   # UI only, no backbones, results clearly labelled "demo"

# frontend dev with hot reload (proxies /api to :8000)
cd frontend && npm run dev        # http://localhost:5173
```

`train_heads.py` reads the cached features from `segmentation_pipeline_release/data/4_features`. Re-run it if the labels or features change. scikit-learn must stay at the pinned version, otherwise the pickled heads won't load.

## Apparent gender (which lookbook the edit opens on)

A 4th head rides on the same 12 feature vectors the colour heads use, so the read happens *during* the
colour prediction: no second model, no second request, no vision API, and the photo never leaves this
server. It is a live prediction from the photo, not a stored label.

Trained on 571 faces — the 278 analyst-labelled celebrities (69 male / 209 female) plus 293 ordinary
portraits from the image catalogue, which fixes the research set's imbalance (`train_gender.py`). The
colour heads are untouched and byte-identical.

| Measured on | Result |
|---|---|
| 571 training faces, out-of-fold | 98.1% correct |
| 90 held-out faces never trained on | 86/90 argmax correct; at the shipped 0.65 threshold it decides for 97% and is wrong 3 times |
| …of those 3 errors | 2 are photos with no visible face (a cocktail glass, a razor) that the browser's face check rejects before a real scan; 1 is a genuinely androgynous portrait |
| Added latency | 0 ms — 48 heads together take 13 ms of the ~280 ms scan |

Below `TEINTE_GENDER_MIN` (0.65) the engine returns `gender: null` and the client switches to **Both**,
showing For her and For him together rather than guessing or leaving the previous person's lookbook up.
A scan sets the lookbook, the Women / Men / Both toggle overrides it by hand, and the choice is remembered
in `teinte.gender.v1`. A visitor who has not scanned starts on the women's edit.

Re-run after changing the training data:

```bash
.venv/bin/python train_gender.py --extra <dir of male_*.jpg / female_*.jpg> --eval <held-out dir>
```

## Stylist chat speed

Gemini Flash models reason silently before their first word. Measured on the same sangeet question (Oct 2026, free tier):

| Model, thinking level | First word | Full answer |
|---|---|---|
| gemini-3.8-flash, default | 55.2 s, then 429 quota errors | 57.8 s |
| gemini-3.5-flash, default | 6.1 s | 7.7 s |
| gemini-3.5-flash, low | 2.4 s | 5.0 s |
| **gemini-3.6-flash, low (shipped)** | **2.9 s** | **4.8 s** |
| gemini-3.1-flash-lite, low | 1.3 s | 2.2 s |
| gemini-3.5-flash-lite, low | 17.3 s | 18.7 s |

Through `/api/chat`, five varied questions took 2.3–5.4 s to the first word and 4–7 s in total. Free-tier latency varies a lot run to run (the same model measured 3.7 s and 71 s minutes apart), so these are medians over several questions; a paid tier is what makes them consistent. 3.6-flash is the shipped default because it costs half what 3.5-flash does per token at the same quality. One answer measures **951 input + 204 output tokens**. The server sends `reasoning_effort=GEMINI_REASONING` (default `low`). It fails over to the next model if no word arrives within `LLM_FIRST_TOKEN_TIMEOUT` (10 s), and skips a model that returns 429 for `LLM_COOLDOWN` (300 s).

## Image sources

`catalog.ingest` uses **Unsplash** when `UNSPLASH_ACCESS_KEY` is set (editorial-grade fashion, beauty and jewellery photography), otherwise Pexels. A new Unsplash app is limited to 50 requests an hour; apply for production access in the Unsplash dashboard (5,000/hour) before a full run. Images are hotlinked and credited "Photo by … on Unsplash", as Unsplash's API guidelines require.

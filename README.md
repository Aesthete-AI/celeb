# Celeb — Teinte website + Kitchener essence research

| Folder | What it is |
|---|---|
| [`teinte/`](teinte/) | The Teinte colour-analysis website: React/Vite frontend, FastAPI backend (12-backbone colour engine, stylist chat, voice input), the photo catalogue. See [`teinte/README.md`](teinte/README.md). |
| [`essence/`](essence/) | Kitchener essence research: labels for 122 people, 10 curated photos each, embeddings from the same 7 CNN + 5 ViT framework, the no-training prototype classifier and its results. See [`essence/README.md`](essence/README.md). |

## Not in this repository
- **Secrets**: `teinte/backend/.env` (API keys). Copy `teinte/backend/.env.example` and fill it in.
- **Environments**: `teinte/backend/.venv`, `teinte/frontend/node_modules`, build output `frontend/dist` (`run.sh` rebuilds them).
- **Backbone weights** (~8.4 GB): downloaded by timm / Hugging Face on first start.
- **Graphonomy weights** are included as two parts (each under GitHub's 100 MB file limit) in
  `teinte/backend/models/graphonomy/weights/`; `run.sh` joins them into `graphonomy_inference.pth`.
- **Essence search pool** (`essence/web_candidates`, ~1.6 GB of unselected downloads); `web_urls/` and
  `web_scores/` record every candidate URL and score, and `top10/` holds the selected photos.
- The colour-research pipeline under `AI Startup/` (used by `essence/curate.py`, `essence/features.py` and
  `teinte/backend/train_heads.py`) is a separate project and is not included.

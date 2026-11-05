#!/usr/bin/env bash
# Build the React app and serve everything (site + API) from one process on :8000.
#   ./run.sh            full engine (needs torch + a GPU for ~2 s analyses)
#   ./run.sh --demo     no backbones; labelled demo results, for UI work on any laptop
set -euo pipefail
cd "$(dirname "$0")"
[ -f backend/.env ] && set -a && . backend/.env && set +a
[ "${1:-}" = "--demo" ] && export TEINTE_DEMO=1
(cd frontend && npm ci --silent && npm run build)
cd backend
# Graphonomy weights are stored as two <100 MB parts (GitHub's file limit); join them once
W=models/graphonomy/graphonomy_inference.pth
[ -e "$W" ] || cat models/graphonomy/weights/graphonomy_inference.pth.part-* > "$W"
[ -f artifacts/heads.joblib ] || .venv/bin/python train_heads.py
exec .venv/bin/uvicorn server:app --host 0.0.0.0 --port "${PORT:-8000}"

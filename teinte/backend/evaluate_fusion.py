"""Choose the label-coherence weights in engine.fuse on out-of-fold probabilities (no refitting).

  python evaluate_fusion.py
"""
import os
import numpy as np
from engine import SEASON_UNDERTONE, fuse

z = np.load(os.path.join(os.path.dirname(os.path.abspath(__file__)), "artifacts", "oof_probabilities.npz"), allow_pickle=True)
c12, c4, cu = (np.unique(z[f"y_{t}"]) for t in ("season12", "season4", "undertone"))
y12, y4, yu = z["y_season12"], z["y_season4"], z["y_undertone"]
print(f"{'w4':>4} {'wu':>4}  12-season  family(derived)  family==4-head  season-undertone coherent")
for w4 in (0, 0.5, 1, 1.5, 2, 3):
    for wu in (0, 0.5, 1):
        pred = np.array([c12[fuse(p, c12, q, c4, u, cu, w4, wu).argmax()] for p, q, u in zip(z["season12"], z["season4"], z["undertone"])])
        fam = np.array([s.split()[-1] for s in pred])
        ut = cu[z["undertone"].argmax(1)]
        coherent = np.mean([u == "Neutral" or SEASON_UNDERTONE[s] == u for s, u in zip(pred, ut)])
        print(f"{w4:4} {wu:4}  {np.mean(pred == y12)*100:8.1f}%  {np.mean(fam == y4)*100:13.1f}%  "
              f"{np.mean(fam == c4[z['season4'].argmax(1)])*100:13.1f}%  {coherent*100:10.1f}%")

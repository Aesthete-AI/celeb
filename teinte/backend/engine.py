"""
Inference engine: Graphonomy (face + hair + neck mask) -> 7 CNNs + 5 ViTs -> per-backbone heads ->
mean of probabilities. Mirrors segmentation_pipeline_release/code exactly:

  * the browser sends the head crop (face box, 0.8 x face height above, 0.9 x below, square,
    >= 2 x face width) - the same rule as croppers.expand, so the full photo never leaves the device
  * Graphonomy single pass at 512 x 512, no flip (GraphonomyCropper defaults);
    face = class 13, hair = class 2, neck = class 10; everything else blacked out
  * the masked image is JPEG-encoded at quality 96 and decoded, as the cached training inputs were
  * every backbone embeds it with its own timm transform; vectors from 1-5 photos are averaged,
    L2-normalised, and each backbone's head emits probabilities; the 12 are averaged
"""
import base64
import io
import os
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor

import cv2
import joblib
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
GRAPHONOMY_DIR = os.environ.get("GRAPHONOMY_DIR", os.path.join(HERE, "models", "graphonomy"))
HEADS_PATH = os.environ.get("TEINTE_HEADS", os.path.join(HERE, "artifacts", "heads.joblib"))
FACE, HAIR, NECK = 13, 2, 10
MIN_KEEP = 400

# label-coherence weights, chosen on out-of-fold probabilities (see evaluate_fusion.py)
GENDER_MIN = float(os.environ.get("TEINTE_GENDER_MIN", "0.65"))   # below this the read is treated as "unsure"
FUSION = dict(season4=float(os.environ.get("TEINTE_FUSE_S4", "1.0")),
              undertone=float(os.environ.get("TEINTE_FUSE_UT", "0.5")))

SEASON_UNDERTONE = {  # which undertone each 12-season sits on, for the coherence prior
    "Light Spring": "Warm", "Warm Spring": "Warm", "Bright Spring": "Warm",
    "Light Summer": "Cool", "Cool Summer": "Cool", "Soft Summer": "Cool",
    "Soft Autumn": "Warm", "Warm Autumn": "Warm", "Deep Autumn": "Warm",
    "Cool Winter": "Cool", "Deep Winter": "Cool", "Bright Winter": "Cool",
}


def fuse(p12, cls12, p4, cls4, pu=None, clsu=None, w4=1.0, wu=0.0):
    """Product of experts: P(season12) x P(its family)^w4 x P(its undertone)^wu, renormalised.
    The 4-season head is the more accurate one (51% vs 28%), so it steers the 12-season choice
    and the family shown can never contradict the season shown."""
    i4 = {c: i for i, c in enumerate(cls4)}
    s = np.array([p12[i] * max(p4[i4[c.split()[-1]]], 1e-6) ** w4 for i, c in enumerate(cls12)])
    if pu is not None and wu > 0:
        iu = {c: i for i, c in enumerate(clsu)}
        s *= np.array([max(pu[iu[SEASON_UNDERTONE[c]]] + pu[iu.get("Neutral", 0)] * 0.5, 1e-6) ** wu
                       for c in cls12])
    return s / s.sum()


def hex_of(rgb):
    return "#%02x%02x%02x" % tuple(int(round(v)) for v in rgb)


def robust_colour(rgb_pixels):
    """Median colour of the middle 80% by lightness - ignores specular highlights and shadow."""
    if len(rgb_pixels) < 50:
        return None
    lab = cv2.cvtColor(rgb_pixels.reshape(-1, 1, 3).astype(np.uint8), cv2.COLOR_RGB2LAB).reshape(-1, 3)
    lo, hi = np.percentile(lab[:, 0], [10, 90])
    sel = rgb_pixels[(lab[:, 0] >= lo) & (lab[:, 0] <= hi)]
    return np.median(sel if len(sel) else rgb_pixels, 0)


class Graphonomy:
    def __init__(self, device):
        import torch
        sys.path.insert(0, GRAPHONOMY_DIR)
        from networks import deeplab_xception_transfer, graph
        self.torch, self.device = torch, device
        self.net = deeplab_xception_transfer.deeplab_xception_transfer_projection_savemem(
            n_classes=20, hidden_layers=128, source_classes=7)
        sd = torch.load(os.path.join(GRAPHONOMY_DIR, "graphonomy_inference.pth"), map_location="cpu",
                        weights_only=False)
        self.net.load_state_dict(sd, strict=True)
        self.net.eval().to(device)
        adj2 = torch.from_numpy(graph.cihp2pascal_nlp_adj).float().unsqueeze(0).unsqueeze(0).expand(1, 1, 7, 20).transpose(2, 3)
        adj3 = torch.from_numpy(graph.preprocess_adj(graph.pascal_graph)).float().unsqueeze(0).unsqueeze(0).expand(1, 1, 7, 7)
        adj1 = torch.from_numpy(graph.preprocess_adj(graph.cihp_graph)).float().unsqueeze(0).unsqueeze(0).expand(1, 1, 20, 20)
        self.adj1, self.adj3, self.adj2 = adj1.to(device), adj3.to(device), adj2.to(device)

    def labels(self, bgr):
        torch = self.torch
        H, W = bgr.shape[:2]
        x = cv2.resize(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB), (512, 512), interpolation=cv2.INTER_LINEAR)
        x = (x.astype(np.float32) * 2.0) / 255.0 - 1.0
        t = torch.from_numpy(x.transpose(2, 0, 1)).unsqueeze(0).to(self.device)
        with torch.no_grad():
            out = self.net.forward(t, self.adj1, self.adj3, self.adj2)
            out = torch.nn.functional.interpolate(out, size=(H, W), mode="bilinear", align_corners=True)
        return out.argmax(1)[0].cpu().numpy()


class Engine:
    """Loads once, then serves analyse() calls one at a time (a single GPU is the bottleneck)."""

    def __init__(self, device=None, demo=False):
        self.demo = demo
        self.state, self.error, self.loaded = "starting", None, 0
        self.device = device
        self.lock = threading.Lock()
        self.bundle = joblib.load(HEADS_PATH) if os.path.exists(HEADS_PATH) else None
        if self.bundle is None:
            self.state, self.error = "error", f"heads not found at {HEADS_PATH} - run train_heads.py"

    @property
    def total(self):
        return len(self.bundle["backbones"]) if self.bundle else 12

    def load(self):
        if self.bundle is None:
            return
        if self.demo:
            self.state = "demo"
            return
        try:
            import timm
            import torch
            self.torch = torch
            self.device = self.device or ("cuda" if torch.cuda.is_available() else "cpu")
            self.state = "loading"
            if self.device == "cuda":
                # timm's CPU preprocessing works on tiny tensors; 20 intra-op threads thrash (5.1 s → 0.09 s
                # for 10 photos × 12 models with 1 thread + a pool). GPU forward passes are unaffected.
                torch.set_num_threads(1)
            self.pool = ThreadPoolExecutor(8)
            self.graphonomy = Graphonomy(self.device)
            self.models = {}
            for name, repo in self.bundle["backbones"].items():
                m = timm.create_model(repo, pretrained=True, num_classes=0).eval().to(self.device)
                cfg = timm.data.resolve_data_config({}, model=m)
                self.models[name] = (m, timm.data.create_transform(**cfg))
                self.loaded += 1
                print(f"  loaded {name} ({self.loaded}/{self.total}) on {self.device}", flush=True)
            # models with identical preprocessing share one transformed batch (10 distinct of 12)
            self.tf_groups = {}
            for name, (_, tf) in self.models.items():
                self.tf_groups.setdefault(repr(tf), (tf, []))[1].append(name)
            self.state = "ready"
        except Exception as e:  # surfaced through /api/health rather than crashing the API
            self.state, self.error = "error", f"{type(e).__name__}: {e}"
            print("engine failed to load:", self.error, flush=True)

    # ---------------------------------------------------------------- per-photo steps
    def segment(self, bgr):
        lab = self.graphonomy.labels(bgr)
        regions = {"face": lab == FACE, "hair": lab == HAIR, "neck": lab == NECK}
        keep = regions["face"] | regions["hair"] | regions["neck"]
        return regions, keep

    @staticmethod
    def masked_input(bgr, keep):
        out = bgr.copy()
        out[~keep] = 0
        ok, buf = cv2.imencode(".jpg", out, [cv2.IMWRITE_JPEG_QUALITY, 96])
        from PIL import Image
        return Image.open(io.BytesIO(buf.tobytes())).convert("RGB")

    @staticmethod
    def region_png(regions, size):
        h, w = size
        code = np.zeros((h, w), np.uint8)
        code[regions["neck"]] = 3
        code[regions["hair"]] = 2
        code[regions["face"]] = 1
        s = 384 / max(h, w)
        if s < 1:
            code = cv2.resize(code, (int(w * s), int(h * s)), interpolation=cv2.INTER_NEAREST)
        ok, buf = cv2.imencode(".png", code)
        return "data:image/png;base64," + base64.b64encode(buf.tobytes()).decode()

    # ---------------------------------------------------------------- main entry
    def analyse(self, images_bgr):
        if self.state == "demo":
            return self._demo(images_bgr)
        if self.state != "ready":
            raise RuntimeError(f"engine not ready ({self.state})")
        torch = self.torch
        timings = {}
        with self.lock:
            t0 = time.perf_counter()
            inputs, first, measured = [], None, []
            for bgr in images_bgr:
                regions, keep = self.segment(bgr)
                if keep.sum() < MIN_KEEP:
                    continue
                inputs.append(self.masked_input(bgr, keep))
                rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
                measured.append({k: robust_colour(rgb[regions[k]]) for k in ("face", "hair", "neck")})
                if first is None:
                    first = (regions, keep, bgr.shape[:2])
            timings["segmentation_ms"] = round((time.perf_counter() - t0) * 1000, 1)
            if not inputs:
                raise ValueError("no_face_hair_neck")

            t1 = time.perf_counter()
            jobs = [(key, i) for key in self.tf_groups for i in range(len(inputs))]
            done = list(self.pool.map(lambda j: self.tf_groups[j[0]][0](inputs[j[1]]), jobs))
            batches = {key: torch.stack(done[k * len(inputs):(k + 1) * len(inputs)]).to(self.device, non_blocking=True)
                       for k, key in enumerate(self.tf_groups)}
            by_model = {n: batches[key] for key, (_, names) in self.tf_groups.items() for n in names}
            timings["preprocess_ms"] = round((time.perf_counter() - t1) * 1000, 1)
            feats = {}
            with torch.no_grad():
                for name, (m, _) in self.models.items():
                    f = m(by_model[name]).float().cpu().numpy()
                    v = f.mean(0)                                   # average photographs first
                    feats[name] = (v / (np.linalg.norm(v) + 1e-12))[None]
            if self.device == "cuda":
                torch.cuda.synchronize()
            timings["backbones_ms"] = round((time.perf_counter() - t1) * 1000, 1)

        t2 = time.perf_counter()
        result = self._classify(feats)
        timings["heads_ms"] = round((time.perf_counter() - t2) * 1000, 1)
        timings["total_ms"] = round((time.perf_counter() - t0) * 1000, 1)

        regions, keep, size = first
        result.update(
            regions=dict(mask=self.region_png(regions, size),
                         share={k: round(float(v.mean()) * 100, 1) for k, v in regions.items()},
                         kept_percent=round(float(keep.mean()) * 100, 1)),
            measured=self._measured(measured),
            photos_used=len(inputs), timings=timings, device=self.device, demo=False)
        return result

    def _classify(self, feats):
        b = self.bundle
        probs = {}
        for t, cls in b["classes"].items():
            P = np.mean([b["heads"][n][t].predict_proba(feats[n])[0] for n in b["backbones"]], 0)
            probs[t] = dict(zip(cls, P.tolist()))
        # colour twins: cosine in each backbone's 96-d head space, averaged over backbones
        sims = np.mean([b["embeddings"][n] @ self._embed(n, feats[n]) for n in b["backbones"]], 0)
        twins = [dict(name=b["people"][i]["name"], season=b["people"][i]["season12"],
                      undertone=b["people"][i]["undertone"], similarity=round(float(sims[i]), 3))
                 for i in np.argsort(-sims)[:6]]
        return self._decide(probs, twins)

    def _embed(self, name, f):
        head = self.bundle["heads"][name]["undertone"]
        z = head[1].transform(head[0].transform(f))[0]
        return z / (np.linalg.norm(z) + 1e-12)

    def _decide(self, probs, twins):
        c12, c4, cu = list(probs["season12"]), list(probs["season4"]), list(probs["undertone"])
        p12 = np.array([probs["season12"][c] for c in c12])
        fused = fuse(p12, c12, np.array([probs["season4"][c] for c in c4]), c4,
                     np.array([probs["undertone"][c] for c in cu]), cu, FUSION["season4"], FUSION["undertone"])
        order = np.argsort(-fused)
        season = c12[order[0]]
        undertone = max(probs["undertone"], key=probs["undertone"].get)
        # apparent gender, so the edit opens on the right lookbook. It reads the same 12 feature vectors
        # the colour heads do, so it costs no extra time and the photo never leaves this server.
        # Below GENDER_MIN the client is left on whatever lookbook it was showing.
        gp = probs.get("gender") or {}
        gender = max(gp, key=gp.get) if gp else None
        gender_confidence = round(gp[gender], 3) if gender else 0.0
        return dict(
            # the 4-season × 3-undertone profile that keys the recommendation catalogue
            profile=f"{season.split()[-1].lower()}-{undertone.lower()}",
            undertone=undertone, undertone_confidence=round(probs["undertone"][undertone], 3),
            season=season, season_family=season.split()[-1],
            season_confidence=round(float(fused[order[0]]), 3),
            season_ranking=[dict(season=c12[i], p=round(float(fused[i]), 3)) for i in order[:4]],
            gender=gender if gender_confidence >= GENDER_MIN else None,
            gender_confidence=gender_confidence,
            probabilities={k: {c: round(v, 4) for c, v in d.items()} for k, d in probs.items()},
            colour_twins=twins)

    @staticmethod
    def _measured(measured):
        out = {}
        for k in ("face", "hair", "neck"):
            vals = [m[k] for m in measured if m[k] is not None]
            out[k] = hex_of(np.median(vals, 0)) if vals else None
        return out

    # ---------------------------------------------------------------- demo (UI development only)
    def _demo(self, images_bgr):
        """No backbones: a labelled stand-in so the interface can be developed on a laptop.
        It reads the median skin colour of the crop centre and is NOT the trained model."""
        bgr = images_bgr[0]
        h, w = bgr.shape[:2]
        c = cv2.cvtColor(bgr[h // 3:h // 2, w // 3:2 * w // 3], cv2.COLOR_BGR2LAB).reshape(-1, 3).astype(float)
        L, a, bb = np.median(c, 0)
        warm = (bb - 128) - 0.6 * (a - 128)
        undertone = "Warm" if warm > 6 else "Cool" if warm < 1 else "Neutral"
        fam = ("Autumn" if L < 150 else "Spring") if undertone != "Cool" else ("Winter" if L < 150 else "Summer")
        sub = {"Spring": "Light Spring" if L > 175 else "Warm Spring", "Autumn": "Deep Autumn" if L < 120 else "Soft Autumn",
               "Summer": "Light Summer" if L > 175 else "Soft Summer", "Winter": "Deep Winter" if L < 120 else "Cool Winter"}[fam]
        cls12 = self.bundle["classes"]["season12"] if self.bundle else list(SEASON_UNDERTONE)
        probs = {"season12": {c: (0.4 if c == sub else 0.6 / 11) for c in cls12},
                 "season4": {f: (0.55 if f == fam else 0.15) for f in ("Autumn", "Spring", "Summer", "Winter")},
                 "undertone": {u: (0.6 if u == undertone else 0.2) for u in ("Cool", "Neutral", "Warm")}}
        r = self._decide(probs, [])
        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
        r.update(regions=None, measured=dict(face=hex_of(np.median(rgb[h // 3:h // 2, w // 3:2 * w // 3].reshape(-1, 3), 0)),
                                              hair=None, neck=None),
                 photos_used=len(images_bgr), timings=dict(total_ms=0), device="none", demo=True)
        return r

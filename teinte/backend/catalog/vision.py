"""
Visual vetting of every candidate photo (GPU, OpenCLIP ViT-L/14):

  category  zero-shot match against descriptions of all 11 categories + off-topic decoys. A photo is admitted
            to a category only when that category wins. Clothing and the dress-up occasions are allowed to
            overlap (an evening dress fits Party or Black Tie); festive, jewellery, hairstyles and makeup must win.
  gender    people categories need a clear woman / man matching the slot; product shots (jewellery, makeup)
            only must not clearly show the opposite gender.
  premium   LAION aesthetic predictor (MLP on the same CLIP embedding, ~1-10). Below AESTHETIC_MIN is rejected.

Results are stored per item (aesthetic, gender) and per candidate (relevance, ok), so build.py can rank on them.

  python -m catalog.vision        # vet everything not yet vetted
"""
import os

import numpy as np
import torch

HERE = os.path.dirname(os.path.abspath(__file__))
AESTHETIC_MIN = float(os.environ.get("TEINTE_AESTHETIC_MIN", "4.5"))   # floor only; ranking uses the score

# what each category must visibly show, per gender
PROMPTS = {
    "jewellery": {"female": ["a close-up photo of earrings", "a close-up photo of a necklace", "a close-up photo of rings on a hand",
                             "a photo of a bracelet", "a woman wearing elegant jewelry"],
                  "male": ["a close-up photo of a men's wristwatch", "a photo of a man's ring", "a photo of a men's bracelet",
                           "a man wearing a chain necklace"]},
    "hairstyles": {"female": ["a portrait of a woman showing her hairstyle", "a woman's hair styled in waves, a bun or a braid"],
                   "male": ["a portrait of a man showing his haircut", "a man's hairstyle, close-up of his hair"]},
    "makeup": {"female": ["a photo of lipstick", "a photo of an eyeshadow palette", "makeup products and brushes",
                          "a close-up of a woman's makeup look"],
               "male": ["men's grooming and skincare products", "a man grooming his beard", "a bottle of skincare cream"]},
    "clothing": {"female": ["a woman wearing a stylish outfit", "a fashion photo of a woman's clothes"],
                 "male": ["a man wearing a stylish outfit", "a fashion photo of a man's clothes"]},
    "footwear": {"female": ["a photo of women's high heels", "a photo of women's ankle boots", "a photo of women's ballet flats or sandals",
                            "a photo of women's fashion sneakers", "a close-up of a woman's feet wearing elegant shoes"],
                 "male": ["a photo of men's leather oxford shoes", "a photo of men's chelsea boots", "a photo of men's loafers",
                          "a photo of men's leather sneakers", "a close-up of a man's feet wearing dress shoes"]},
    "office": {"female": ["a woman in professional office attire with a blazer", "a businesswoman in a suit"],
               "male": ["a man in a business suit and tie", "a businessman in a blazer and shirt"]},
    "party": {"female": ["a woman in a cocktail dress at a party", "a woman in a glamorous party outfit"],
              "male": ["a man dressed up for an evening party", "a man in a stylish party outfit"]},
    "festive": {"female": ["a woman wearing a saree", "a woman wearing a lehenga, Indian ethnic wear"],
                "male": ["a man wearing a sherwani", "a man wearing a kurta, Indian ethnic wear"]},
    "date-night": {"female": ["a woman in an elegant evening outfit for a dinner date"],
                   "male": ["a man in a smart casual outfit for a dinner date"]},
    "casual": {"female": ["a woman in a casual everyday outfit", "a woman in jeans and a t-shirt"],
               "male": ["a man in a casual everyday outfit", "a man in jeans and a t-shirt"]},
    "vacation": {"female": ["a woman in a summer dress on vacation", "a woman in a linen outfit at the beach"],
                 "male": ["a man in a linen shirt on a summer vacation", "a man in summer clothes at the beach"]},
    "black-tie": {"female": ["a woman in a floor-length evening gown", "a woman in a formal gala gown"],
                  "male": ["a man in a tuxedo with a bow tie", "a man in formal black-tie attire"]},
}
DECOYS = ["a landscape", "a plate of food", "a building or an interior", "an animal", "text, a logo or a screenshot",
          "a crown or a tiara", "a car", "a crowd of many people", "a child", "flowers", "a wedding ceremony with many guests",
          "a blurry low quality photo", "a painting, drawing or illustration", "a mannequin or a store display"]
PEOPLE = {"hairstyles", "clothing", "office", "party", "festive", "date-night", "casual", "vacation", "black-tie"}
DRESS = {"clothing", "office", "party", "date-night", "casual", "vacation", "black-tie"}   # may share a photo
GENDER_PROMPTS = ["a photo of a woman", "a photo of a man", "a photo of an object with no person"]
# premium gate: the photo must read as contemporary, professional fashion/beauty/product photography
STYLE_GOOD = ["a modern professional fashion photograph", "a high-end editorial beauty or product photograph",
              "a stylish contemporary lifestyle photo"]
STYLE_BAD = ["an old vintage sepia or black-and-white archive photograph", "a painting, drawing or historical illustration",
             "a museum object on display", "a candid snapshot of a crowded street or event", "a low-quality amateur snapshot",
             "a news or press photo", "AI-generated digital art or a fantasy illustration", "a 3D render",
             "a costume, fancy dress or a halloween or christmas outfit", "a mannequin or a dress form",
             "a tiny distant figure in a big landscape", "a silhouette against the sky"]
# a child in an adult slot is a hard reject, whatever the category says
CHILD_PROMPTS = ["a photo of an adult man", "a photo of an adult woman", "a photo of a young child under twelve"]
CHILD_MAX = 0.6
# people categories must show a person, filling a fair part of the frame (not an animal in a bow tie, not a speck)
SUBJECT_PROMPTS = ["a photo of a person", "a photo of an animal or a bird", "a tiny distant person in a large scene"]
ANIMAL_MAX, TINY_MAX = 0.4, 0.25
# Pixabay tags its AI/illustration uploads; these are rejected before any model is consulted
BANNED_TAGS = ("ai generated", "ai-generated", "generated", "digital art", "fantasy", "illustration", "3d", "render",
               "cartoon", "anime", "costume", "halloween", "christmas", "santa", "cosplay", "mannequin", "child", "kid",
               "kids", "baby", "toddler", "boy", "schoolgirl", "superhero", "zombie", "vampire", "witch", "elf")
DUP_COS = 0.93       # CLIP cosine above which two photos count as the same shoot
MODERN_MIN = float(os.environ.get("TEINTE_MODERN_MIN", "0.55"))
STRICT_SOURCES = {"Wikimedia Commons": 5.0}     # extra aesthetic floor for archive-heavy sources


class Aesthetic(torch.nn.Module):
    def __init__(self):
        super().__init__()
        self.layers = torch.nn.Sequential(
            torch.nn.Linear(768, 1024), torch.nn.Dropout(0.2), torch.nn.Linear(1024, 128), torch.nn.Dropout(0.2),
            torch.nn.Linear(128, 64), torch.nn.Dropout(0.1), torch.nn.Linear(64, 16), torch.nn.Linear(16, 1))

    def forward(self, x):
        return self.layers(x)


class Vetter:
    def __init__(self, device=None):
        import open_clip
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self.model, _, self.pre = open_clip.create_model_and_transforms("ViT-L-14", pretrained="openai", device=self.device)
        self.model.eval()
        tok = open_clip.get_tokenizer("ViT-L-14")
        self.labels = []          # (category or None, gender or None)
        texts = []
        for c, by_g in PROMPTS.items():
            for g, ps in by_g.items():
                for p in ps:
                    self.labels.append((c, g)); texts.append(p)
        for d in DECOYS:
            self.labels.append((None, None)); texts.append(d)
        with torch.no_grad():
            t = self.model.encode_text(tok(texts).to(self.device)).float()
            self.text = t / t.norm(dim=-1, keepdim=True)
            g = self.model.encode_text(tok(GENDER_PROMPTS).to(self.device)).float()
            self.gtext = g / g.norm(dim=-1, keepdim=True)
            st = self.model.encode_text(tok(STYLE_GOOD + STYLE_BAD).to(self.device)).float()
            self.stext = st / st.norm(dim=-1, keepdim=True)
            ch = self.model.encode_text(tok(CHILD_PROMPTS).to(self.device)).float()
            self.ctext = ch / ch.norm(dim=-1, keepdim=True)
            sb = self.model.encode_text(tok(SUBJECT_PROMPTS).to(self.device)).float()
            self.subtext = sb / sb.norm(dim=-1, keepdim=True)
        self.aes = Aesthetic()
        self.aes.load_state_dict(torch.load(os.path.join(HERE, "sac_l14_aesthetic.pth"), map_location="cpu", weights_only=True))
        self.aes.eval().to(self.device)

    @torch.no_grad()
    def embed(self, paths):
        from PIL import Image
        ims = torch.stack([self.pre(Image.open(p).convert("RGB")) for p in paths]).to(self.device)
        e = self.model.encode_image(ims).float()
        return e / e.norm(dim=-1, keepdim=True)

    @torch.no_grad()
    def judge(self, emb):
        """Per image: aesthetic score, gender probs and a probability per (category, gender) label group."""
        scale = 100.0
        sims = (scale * emb @ self.text.T).cpu().numpy()
        gp = (scale * emb @ self.gtext.T).softmax(-1).cpu().numpy()
        aes = self.aes(emb).squeeze(-1).cpu().numpy()
        # each decoy is its own group; a category group scores by its BEST description, so groups with
        # more prompts don't out-vote a single decoy like "a crown or a tiara"
        keys = [(c, g) if c else ("decoy", d) for (c, g), d in zip(self.labels, [None] * (len(self.labels) - len(DECOYS)) + DECOYS)]
        out = []
        for i in range(len(emb)):
            best = {}
            for k, v in zip(keys, sims[i]):
                best[k] = max(best.get(k, -1e9), float(v))
            ks = list(best)
            z = np.array([best[k] for k in ks]); z = np.exp(z - z.max()); z /= z.sum()
            groups = {(None, None) if k[0] == "decoy" else k: 0.0 for k in ks}
            for k, v in zip(ks, z):
                kk = (None, None) if k[0] == "decoy" else k
                groups[kk] = max(groups[kk], float(v)) if kk == (None, None) else float(v)
            st = (scale * emb[i] @ self.stext.T).softmax(-1).cpu().numpy()
            modern = float(st[:len(STYLE_GOOD)].sum())
            child = float((scale * emb[i] @ self.ctext.T).softmax(-1)[2])
            sub = (scale * emb[i] @ self.subtext.T).softmax(-1).cpu().numpy()
            out.append(dict(modern=modern, child=child, animal=float(sub[1]), tiny=float(sub[2]), aesthetic=float(aes[i]), woman=float(gp[i][0]), man=float(gp[i][1]), obj=float(gp[i][2]), groups=groups))
        return out


def banned_tags(alt, source):
    if not source.startswith("Pixabay"):
        return None
    tags = {t.strip().lower() for t in (alt or "").split(",")}
    hit = next((b for b in BANNED_TAGS if b in tags), None)
    return hit


def decide(j, category, gender, source="", alt=""):
    """→ (ok, relevance, reason)"""
    groups = j["groups"]
    own = groups.get((category, gender), 0.0)
    best = max(groups, key=groups.get)
    tag = banned_tags(alt, source)
    if tag:
        return False, own, f"tagged '{tag}'"
    if j.get("animal", 0) > ANIMAL_MAX:
        return False, own, "shows an animal"
    if category in PEOPLE and j.get("child", 0) > CHILD_MAX:
        return False, own, "may show a child"
    if category in PEOPLE and j.get("tiny", 0) > TINY_MAX:
        return False, own, "person too small in frame"
    if j["aesthetic"] < max(AESTHETIC_MIN, STRICT_SOURCES.get(source.split(" ·")[0], 0)):
        return False, own, "below premium threshold"
    if j.get("modern", 1.0) < MODERN_MIN:
        return False, own, "not modern editorial photography"
    want, other = (j["woman"], j["man"]) if gender == "female" else (j["man"], j["woman"])
    if category in PEOPLE and want < 0.6:
        return False, own, "gender not clear"
    if category not in PEOPLE and other > 0.6:
        return False, own, "opposite gender"
    if best == (category, gender):
        return True, own, "category wins"
    # product shots (a ring, a lipstick) are often gender-neutral: the category must win, and the slot's own
    # gender variant must still be a real contender (keeps dainty necklaces out of men's jewellery)
    # if category in ("jewellery", "makeup") and best[0] == category and own >= (0.25 if gender == "male" else 0.15):
    if category in ("jewellery", "makeup", "footwear") and best[0] == category and own >= (0.25 if gender == "male" else 0.15):
        return True, own, "category wins (neutral product)"
    # hair portraits usually show some outfit too; hair must still be a strong theme of the photo
    if category == "hairstyles" and best[1] == gender and best[0] in DRESS | {"makeup"} and own >= 0.2:
        return True, own, "hair portrait"
    if category in DRESS and best[0] in DRESS and best[1] == gender and own >= 0.15:
        return True, own, "dress-up overlap"
    return False, own, f"looks like {best[0] or 'off-topic'}"


def vet(db, batch=48):
    """Vet every candidate whose item has a thumbnail but no verdict yet."""
    from .ingest import THUMBS
    cols = {r[1] for r in db.execute("PRAGMA table_info(items)")}
    for col, t in (("aesthetic", "REAL"), ("vetted", "INT DEFAULT 0")):
        if col not in cols:
            db.execute(f"ALTER TABLE items ADD COLUMN {col} {t}")
    ccols = {r[1] for r in db.execute("PRAGMA table_info(candidates)")}
    for col, t in (("ok", "INT"), ("relevance", "REAL"), ("reason", "TEXT")):
        if col not in ccols:
            db.execute(f"ALTER TABLE candidates ADD COLUMN {col} {t}")
    rows = db.execute("SELECT id, source, alt FROM items WHERE analysed=1 AND vetted=0").fetchall()
    todo = [r[0] for r in rows]
    source_of = {r[0]: r[1] or "" for r in rows}
    alt_of = {r[0]: r[2] or "" for r in rows}
    if "emb" not in {r[1] for r in db.execute("PRAGMA table_info(items)")}:
        db.execute("ALTER TABLE items ADD COLUMN emb BLOB")
    if not todo:
        return 0
    v = Vetter()
    print(f"  vetting {len(todo)} photos on {v.device}", flush=True)
    for k in range(0, len(todo), batch):
        ids = todo[k:k + batch]
        paths = [os.path.join(THUMBS, f"{i}.jpg") for i in ids]
        embs = v.embed(paths)
        js = v.judge(embs)
        for iid, j, e in zip(ids, js, embs.cpu().numpy().astype(np.float16)):
            db.execute("UPDATE items SET aesthetic=?, vetted=1, emb=? WHERE id=?", (round(j["aesthetic"], 3), e.tobytes(), iid))
            for c, g, ph, pr in db.execute("SELECT category, gender, phrase, profile FROM candidates WHERE item_id=?", (iid,)).fetchall():
                ok, rel, why = decide(j, c, g, source_of[iid], alt_of[iid])
                db.execute("UPDATE candidates SET ok=?, relevance=?, reason=? WHERE item_id=? AND category=? AND gender=? AND phrase=? AND profile IS ?",
                           (int(ok), round(rel, 4), why, iid, c, g, ph, pr))
        db.commit()
    del v
    torch.cuda.empty_cache()
    return len(todo)


if __name__ == "__main__":
    from .ingest import connect
    print("vetted", vet(connect()))

"""Kitchener essence ground truth: raw_labels.tsv (pasted verbatim) -> essence_labels.{json,csv,xlsx}.

Seven essences, with the synonyms used in the source list:
    Dramatic · Natural · Classic · Romantic
    Gamine   = High-Spirited
    Ingenue  = Youthful   (also spelled "Inegnue")
    Ethereal = Angelic

Each person gets a blend that sums to 1:
  * if the source gives percentages, those are used (column 4 first, then column 3 when it holds them);
    a partial percentage ("70% Romantic") keeps the stated share and spreads the rest over the other
    listed essences by rank;
  * otherwise the listed order sets the weights (Kitchener's own 2-4 essence blends, dominant first):
        1 essence  100
        2          60 / 40      ("X and Y" -> 50 / 50: a genuine tie)
        3          50 / 30 / 20
        4          40 / 30 / 20 / 10
        5+         descending, normalised
The dominant essence is the largest share; a tie gives several co-dominant essences, and a prediction
of any of them counts as correct.
"""
import csv, json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
ESSENCES = ["Dramatic", "Natural", "Classic", "Romantic", "Gamine", "Ingenue", "Ethereal"]
SYN = {
    "dramatic": "Dramatic", "natural": "Natural", "classic": "Classic", "romantic": "Romantic",
    "gamine": "Gamine", "high spirited": "Gamine", "high-spirited": "Gamine", "highspirited": "Gamine",
    "ingenue": "Ingenue", "inegnue": "Ingenue", "youthful": "Ingenue",
    "ethereal": "Ethereal", "angelic": "Ethereal",
}
RANK = {1: [1.0], 2: [0.6, 0.4], 3: [0.5, 0.3, 0.2], 4: [0.4, 0.3, 0.2, 0.1]}

# Spelling in the source list -> the name a web image search needs. The label name is kept as given.
SEARCH_NAME = {
    "Ankhaten": "Akhenaten", "Angelica Houston": "Anjelica Huston", "Ava Gardener": "Ava Gardner",
    "Chef Dan Hunter": "Dan Hunter chef", "Dave Letterman": "David Letterman", "Daniel Day Lewis": "Daniel Day-Lewis",
    "Edie Falko": "Edie Falco", "Gavin Newson": "Gavin Newsom", "Jean Simones": "Jean Simmons",
    "John Lenon": "John Lennon", "Liv Taylor": "Liv Tyler", "Michael J.Fox": "Michael J. Fox",
    "Muhammed Ali": "Muhammad Ali", "Operah Winfrey": "Oprah Winfrey", "Rachel Ray": "Rachael Ray",
    "Renne Flamming": "Renée Fleming", "Sheamus Farelly": "Sheamus wrestler", "Sofia Loren": "Sophia Loren",
    "Shirley Maclaine": "Shirley MacLaine", "Janelle Monae": "Janelle Monáe",
    "Ryan Gosling  (Verified post cheek implant surgery)": "Ryan Gosling",
}
FEMALE = {
    "Adele", "Aishwarya Rai", "Angelina Jolie", "Angelica Houston", "Anna Kendrick", "Audrey Coyne", "Ava Gardener",
    "Bette Midler", "Betty White", "Bonnie Aarons", "Brit Marling", "Bryce Dallas Howard", "Charlize Theron", "Cher",
    "Chita Rivera", "Daryl Hannah", "Dot Jones", "Eartha Kitt", "Edie Falko", "Elizabeth Taylor", "Emma Stone",
    "Frida Kahlo", "Grace Jones", "Gina McKee", "Halle Bailey", "Hedy Lamarr", "Ina Garten", "Idina Menzel",
    "Janelle Monae", "Jean Simones", "Jessye Norman", "Jourdan Dunn", "Julia Child", "Julia Roberts", "Kathy Bates",
    "Lesley Manville", "Lily Collins", "Liv Taylor", "Liza Minnelli", "Lucy Liu", "Maggie Smith", "Maggie Gyllenhaal",
    "Marilyn Monroe", "Meg Ryan", "Meryl Streep", "Michelle Williams", "Michelle Yeoh", "Mitsuko Uchida",
    "Miranda Otto", "Natalie Wood", "Nicole Kidman", "Operah Winfrey", "Rachel Ray", "Renne Flamming", "Rita Moreno",
    "Roseanne Barr", "Saina Nehwal", "Scarlett Johansson", "Selena Gomez", "Serena Williams", "Simone Biles",
    "Sigourney Weaver", "Shirley Maclaine", "Shirley Verrett", "Sofia Carson", "Sofia Loren", "Tilda Swinton",
    "Tina Turner", "Tracee Ellis Ross", "Vanessa Redgrave", "Vivien Leigh", "Whoopi Goldberg",
}
NOTES = {
    "Ankhaten": "Ancient pharaoh: no photographs exist, only statues and reliefs",
    "Ryan Gosling  (Verified post cheek implant surgery)": "Label verified on post-surgery photos",
    "Aishwarya Rai": "Ethereal also reported by the source; not counted in the blend",
    "Sofia Loren": "Source: 'Highly Romantic (at least 70%)'",
    "Meryl Streep": "Source: 'Pure Classic'",
}


def essences_in(text):
    """Essences mentioned in a phrase, in order of first mention."""
    t = text.lower().replace("(", " ").replace(")", " ")
    found = []
    for m in re.finditer(r"high[\s-]*spiri?ted|[a-z]+", t):
        key = re.sub(r"\s+", " ", m.group(0)).replace("high-spiri", "high spiri")
        key = "high spirited" if key.startswith("high") and "spir" in key else key
        e = SYN.get(key)
        if e and e not in found:
            found.append(e)
    return found


def percentages(text):
    """{'Romantic': 0.7, ...} from '70% Romantic; 10% each Natural, Classic, Youthful'."""
    out = {}
    for m in re.finditer(r"(\d+(?:\.\d+)?)\s*%\s*(each\s+)?([A-Za-z ,\-]+?)(?=(?:;|,\s*\d|\.\s*$|\(|$|\s+and\s+\d))", text):
        pct, each, names = float(m.group(1)) / 100, m.group(2), m.group(3)
        es = essences_in(names)
        if each:
            for e in es:
                out[e] = pct
        elif es:
            out[es[0]] = pct
    return out


def by_rank(order, tie=False):
    if tie:
        return {e: 1 / len(order) for e in order}
    w = RANK.get(len(order)) or [len(order) - i for i in range(len(order))]
    s = sum(w)
    return {e: v / s for e, v in zip(order, w)}


def blend(c2, c3, c4):
    order = essences_in(c2)
    for col in (c4, c3):
        pc = percentages(col) if "%" in col else {}
        if pc:
            listed = [e for e in order if e not in pc] + [e for e in essences_in(col) if e not in pc and e not in order]
            rest = 1 - sum(pc.values())
            if rest > 1e-6 and listed:                    # "70% Romantic": spread the remainder by rank
                pc.update({e: rest * v for e, v in by_rank(listed).items()})
            s = sum(pc.values())
            return {e: v / s for e, v in pc.items()}, "given percentages"
    tie = bool(re.search(r"\band\b", c2)) and len(order) == 2 and "with" not in c2.lower()
    return by_rank(order, tie), ("equal split ('and')" if tie else "rank order (dominant first)")


def load_rows():
    rows = []
    for line in open(os.path.join(HERE, "raw_labels.tsv"), encoding="utf-8"):
        line = line.rstrip("\n")
        if not line.strip():
            continue
        parts = (line.split("\t") + ["", "", ""])[:4]
        name, c2, c3, c4 = [p.strip() for p in parts]
        w, method = blend(c2, c3, c4)
        top = max(w.values())
        dominant = [e for e, v in w.items() if abs(v - top) < 1e-6]
        search = SEARCH_NAME.get(name, name)
        rows.append(dict(
            person=name, stem=re.sub(r"[^A-Za-z0-9]+", "_", search.replace("é", "e").replace("á", "a")).strip("_"),
            search_name=search, gender="female" if name in FEMALE else "male",
            label_text=c2, label_text_2=c3, percent_text=c4, weight_source=method,
            blend={e: round(w.get(e, 0.0), 4) for e in ESSENCES}, essences=sorted(w, key=lambda e: -w[e]),
            dominant=dominant, note=NOTES.get(name, "")))
    return rows


if __name__ == "__main__":
    rows = load_rows()
    json.dump(dict(essences=ESSENCES, synonyms={"Gamine": "High-Spirited", "Ingenue": "Youthful", "Ethereal": "Angelic"},
                   people=rows), open(os.path.join(HERE, "essence_labels.json"), "w"), indent=1, ensure_ascii=False)
    with open(os.path.join(HERE, "essence_labels.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["Person", "Search name", "Folder", "Gender", "Dominant", "Blend", *ESSENCES, "Weights from",
                    "Label (source col 2)", "Label (source col 3)", "Percentages (source col 4)", "Note"])
        for r in rows:
            w.writerow([r["person"], r["search_name"], r["stem"], r["gender"], " / ".join(r["dominant"]),
                        ", ".join(f"{round(r['blend'][e]*100)}% {e}" for e in r["essences"]),
                        *[round(r["blend"][e] * 100, 1) for e in ESSENCES], r["weight_source"],
                        r["label_text"], r["label_text_2"], r["percent_text"], r["note"]])
    try:
        import pandas as pd
        pd.read_csv(os.path.join(HERE, "essence_labels.csv")).to_excel(os.path.join(HERE, "essence_labels.xlsx"), index=False)
    except Exception as e:
        print("xlsx skipped:", e)
    from collections import Counter
    print(len(rows), "people |", Counter(r["gender"] for r in rows), "| dominant:",
          Counter(d for r in rows for d in r["dominant"]).most_common())
    print("ties:", [(r["person"], r["dominant"]) for r in rows if len(r["dominant"]) > 1])

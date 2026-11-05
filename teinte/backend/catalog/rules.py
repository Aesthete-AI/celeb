"""
The recommendation rules: 4 seasons × 3 skin undertones = 12 colour profiles.

  undertone → TEMPERATURE: which metals and which side of the colour wheel
              (warm: yellow gold, cream, coral, olive · cool: silver, white gold, crisp white, berry, blue ·
               neutral: room to explore both — rose gold, mixed metals, soft white, dusty rose, jade)
  season    → DEPTH and INTENSITY: how light/deep and how clear/soft those colours should be
              (Spring light & clear · Summer light & soft · Autumn deep & rich · Winter deep & crisp)

Every profile below is the intersection of the two. Each category (jewellery, hair, makeup, clothing and the
occasions) then turns the profile into concrete search intents and the colour targets that images are ranked
against. This file is the single source of truth: export.py writes it to the frontend as JSON.
"""

FAMILIES = ("Spring", "Summer", "Autumn", "Winter")
UNDERTONES = ("Warm", "Neutral", "Cool")

UNDERTONE_RULE = {
    "Warm": "Your warm undertone is your cue for yellow gold and warmer shades such as cream, coral and olive.",
    "Cool": "Your cool undertone points you toward silver, white gold and cooler shades such as crisp white, berry and blue.",
    "Neutral": "Your near-neutral undertone gives you room to explore both sides — rose gold and mixed metals, soft white, dusty rose, jade and teal.",
}
FAMILY_RULE = {
    "Spring": "As a Spring, keep colours light-to-medium and clear — fresh and sunlit, never heavy, dark or greyed.",
    "Summer": "As a Summer, keep colours light-to-medium and soft — blended, with a hint of grey, never stark or neon.",
    "Autumn": "As an Autumn, go medium-to-deep and rich — earthy, spiced and toasted, never icy or neon.",
    "Winter": "As a Winter, go deep or icy with crisp contrast — saturated jewel tones, never dusty or muted.",
}

# 12-season result → the family it belongs to (engine output → profile key)
SEASON_FAMILY = {s: s.split()[-1] for s in (
    "Light Spring", "Warm Spring", "Bright Spring", "Light Summer", "Cool Summer", "Soft Summer",
    "Soft Autumn", "Warm Autumn", "Deep Autumn", "Cool Winter", "Deep Winter", "Bright Winter")}


def key(family, undertone):
    return f"{family.lower()}-{undertone.lower()}"


def S(name, hex_):
    return {"name": name, "hex": hex_}


# ───────────────────────────────────────────────────────────────── the 12 profiles
PROFILES = {
    # ── SPRING: light-medium, clear
    "spring-warm": dict(
        mood="Sunlit and golden",
        colours=[S("Coral", "#FF7F50"), S("Peach", "#FFB38A"), S("Golden Yellow", "#F6C343"), S("Warm Turquoise", "#21B2A6"),
                 S("Apple Green", "#8DB600"), S("Poppy", "#E8452E"), S("Apricot", "#F9A15E"), S("Clear Camel", "#C89A5B")],
        neutrals=[S("Cream", "#FFF3DC"), S("Camel", "#C19A6B"), S("Warm Beige", "#E3C9A1"), S("Golden Brown", "#9C6B30")],
        avoid=[S("Black", "#111111"), S("Icy Grey", "#D5D9DE"), S("Burgundy", "#6B1E2E"), S("Dusty Mauve", "#9C7D89")],
        metals=[S("Yellow Gold", "#D4AF37"), S("Polished Brass", "#C9A54A")],
        gems=["Citrine", "Coral", "Turquoise", "Peridot"],
        lips=[S("Coral", "#E86B54"), S("Peach Nude", "#E9A48A"), S("Warm Red", "#D9452F")],
        blush=[S("Apricot", "#F5A584"), S("Peach", "#F8B99F")],
        eyes=[S("Champagne", "#E8CFA6"), S("Bronze", "#A6733D"), S("Teal", "#14958E")],
        hair=[S("Golden Blonde", "#D7B06C"), S("Honey", "#C38B4C"), S("Strawberry Blonde", "#D59868")],
    ),
    "spring-neutral": dict(
        mood="Fresh and balanced",
        colours=[S("Warm Pink", "#F5A3B5"), S("Light Coral", "#F7867A"), S("Aqua", "#7ED6D0"), S("Butter", "#F7E07E"),
                 S("Periwinkle", "#9DB2EC"), S("Mint", "#A6E3C8"), S("Watermelon", "#F05D73"), S("Soft Camel", "#D2AC7E")],
        neutrals=[S("Ivory", "#FFF8E8"), S("Light Warm Grey", "#CBC3B7"), S("Stone", "#BFB2A3"), S("Light Navy", "#45628F")],
        avoid=[S("Black", "#111111"), S("Charcoal", "#36393E"), S("Mustard", "#C9A227"), S("Olive Drab", "#5B5A2D")],
        metals=[S("Rose Gold", "#E1A98C"), S("Light Gold", "#E4C77A"), S("Silver", "#C9CDD2")],
        gems=["Aquamarine", "Rose quartz", "Peridot", "Pearl"],
        lips=[S("Watermelon Pink", "#E86A7E"), S("Peachy Pink", "#E79A8E"), S("Clear Coral", "#F25A4D")],
        blush=[S("Coral Pink", "#F67F7F"), S("Soft Peach", "#F8B99F")],
        eyes=[S("Champagne", "#E8CFA6"), S("Taupe", "#9C8E8A"), S("Aqua", "#70C4BE")],
        hair=[S("Light Golden Brown", "#A6744A"), S("Beige Blonde", "#D3BF9F"), S("Caramel", "#9C6233")],
    ),
    "spring-cool": dict(
        mood="Clear, bright and crisp",
        colours=[S("Clear Aqua", "#00CED1"), S("Coral Pink", "#FF5D73"), S("Bright Periwinkle", "#7F95D9"), S("Clear Violet", "#8E5BD8"),
                 S("Kelly Green", "#3DAA5A"), S("Lemon", "#F4F15A"), S("Turquoise", "#00B7B0"), S("Bright Rose", "#F2477F")],
        neutrals=[S("Crisp White", "#FFFFFF"), S("Light Grey", "#D9DDE2"), S("Bright Navy", "#1F3A93"), S("Soft Charcoal", "#4A4C52")],
        avoid=[S("Mustard", "#C9A227"), S("Rust", "#A8492A"), S("Camel", "#C19A6B"), S("Olive", "#6B6A2E")],
        metals=[S("Silver", "#C9CDD2"), S("White Gold", "#E1E1DC")],
        gems=["Blue topaz", "Pink sapphire", "Emerald", "Crystal"],
        lips=[S("Clear Pink", "#F0617E"), S("Berry Pink", "#C2185B"), S("Cherry", "#D0103A")],
        blush=[S("Bright Pink", "#F06292"), S("Cool Coral", "#F2707F")],
        eyes=[S("Silver", "#C9CDD2"), S("Violet", "#7D4FC7"), S("Navy", "#1F3A93")],
        hair=[S("Dark Ash Brown", "#3E3633"), S("Cool Brown", "#5A4A42"), S("Ash Blonde", "#C9B79A")],
    ),
    # ── SUMMER: light-medium, soft
    "summer-warm": dict(
        mood="Soft, sunlit haze",
        colours=[S("Soft Peach", "#E9B49A"), S("Sage", "#A3B18A"), S("Warm Rose", "#D18E8E"), S("Soft Aqua", "#8FC9C0"),
                 S("Light Camel", "#D2B48C"), S("Dusty Coral", "#E0907A"), S("Butter", "#F0DFA0"), S("Soft Teal", "#6FA3A0")],
        neutrals=[S("Cream", "#F3E9D7"), S("Oatmeal", "#DCCFB8"), S("Warm Taupe", "#A99A86"), S("Soft Brown", "#8A6E58")],
        avoid=[S("Black", "#111111"), S("Stark White", "#FFFFFF"), S("Fuchsia", "#E3007D"), S("Royal Blue", "#2350C8")],
        metals=[S("Brushed Gold", "#C2A25E"), S("Rose Gold", "#D4A08A")],
        gems=["Peach moonstone", "Rose quartz", "Jade", "Freshwater pearl"],
        lips=[S("Peach Nude", "#D9937E"), S("Warm Rose", "#C47C78"), S("Soft Coral", "#E0806C")],
        blush=[S("Peach", "#E8A58C"), S("Warm Pink", "#DE9A96")],
        eyes=[S("Champagne", "#E2CBA6"), S("Soft Bronze", "#A88664"), S("Sage", "#9AA88A")],
        hair=[S("Soft Caramel", "#9C7350"), S("Golden Bronde", "#A88B68"), S("Light Auburn", "#8E5A3C")],
    ),
    "summer-neutral": dict(
        mood="Misty and blended",
        colours=[S("Dusty Rose", "#C48B92"), S("Muted Teal", "#5C8D89"), S("Sage", "#9DB09A"), S("Greyed Lavender", "#A39BB8"),
                 S("Stone Blue", "#7891A8"), S("Soft Berry", "#A85A72"), S("Mauve", "#A8818D"), S("Eucalyptus", "#7FA090")],
        neutrals=[S("Soft White", "#EFECE7"), S("Rose Beige", "#CDB8AE"), S("Greige", "#A79E95"), S("Soft Navy", "#3E4B63")],
        avoid=[S("Neon Pink", "#FF3FA4"), S("Bright Orange", "#F28C28"), S("Stark White", "#FFFFFF"), S("Black", "#111111")],
        metals=[S("Rose Gold", "#C9A196"), S("Brushed Silver", "#B5B8BC")],
        gems=["Grey moonstone", "Rose quartz", "Labradorite", "Grey pearl"],
        lips=[S("Dusty Rose", "#B07C82"), S("Rosewood", "#A0625D"), S("Soft Mauve", "#A16E7E")],
        blush=[S("Soft Rose", "#CC8E97"), S("Muted Peach", "#D3A08E")],
        eyes=[S("Taupe", "#8F847E"), S("Smoky Plum", "#6E5068"), S("Sage", "#8A9A80")],
        hair=[S("Mushroom Brown", "#7F6E60"), S("Bronde", "#94806A"), S("Soft Brown", "#6B5A4E")],
    ),
    "summer-cool": dict(
        mood="Cool, calm and rosy",
        colours=[S("Powder Blue", "#A9C8E8"), S("Lavender", "#BFA8DD"), S("Dusty Rose", "#D9A0AC"), S("Soft Raspberry", "#C25A7C"),
                 S("Periwinkle", "#7F8FD9"), S("Seafoam", "#8CCBB7"), S("Plum", "#7A3E6B"), S("Soft Navy", "#4A5B7E")],
        neutrals=[S("Soft White", "#F5F4F2"), S("Cool Grey", "#9AA0A8"), S("Rose Taupe", "#9C8487"), S("Slate", "#6D7A8C")],
        avoid=[S("Orange", "#F28C28"), S("Mustard", "#C9A227"), S("Rust", "#A8492A"), S("Camel", "#C19A6B")],
        metals=[S("Silver", "#C0C4CA"), S("Platinum", "#E5E4E2")],
        gems=["Amethyst", "Sapphire", "Pink tourmaline", "White pearl"],
        lips=[S("Rose", "#C46A84"), S("Berry", "#9D4F6B"), S("Mauve Pink", "#D08A9E")],
        blush=[S("Cool Pink", "#E68AA3"), S("Rose", "#DB8A9B")],
        eyes=[S("Plum", "#7A4E70"), S("Grey-Blue", "#8DA0B8"), S("Taupe", "#9C8E8A")],
        hair=[S("Ash Blonde", "#B7A58C"), S("Ash Brown", "#6E5B4C"), S("Mushroom", "#8A7766")],
    ),
    # ── AUTUMN: medium-deep, rich
    "autumn-warm": dict(
        mood="Spiced, earthy and golden",
        colours=[S("Rust", "#B7471F"), S("Mustard", "#D4A017"), S("Olive", "#708238"), S("Terracotta", "#C8643B"),
                 S("Pumpkin", "#E07B25"), S("Teal", "#1E6F6C"), S("Forest", "#33582F"), S("Bronze", "#9C6B30")],
        neutrals=[S("Cream", "#F3E6CC"), S("Camel", "#BF8F55"), S("Coffee", "#5E4027"), S("Khaki", "#A89A6A")],
        avoid=[S("Icy Pink", "#F4D7E6"), S("Cool Grey", "#8E949C"), S("Fuchsia", "#E3007D"), S("Black", "#111111")],
        metals=[S("Yellow Gold", "#D4AF37"), S("Antique Gold", "#B8913A"), S("Copper", "#B87333")],
        gems=["Amber", "Topaz", "Tiger's eye", "Carnelian"],
        lips=[S("Brick", "#A4442A"), S("Terracotta", "#B8603F"), S("Warm Nude", "#A86A4F")],
        blush=[S("Terracotta", "#C26A4A"), S("Apricot", "#D88A5F")],
        eyes=[S("Copper", "#B06A35"), S("Olive", "#6E6E33"), S("Bronze", "#8E6430")],
        hair=[S("Auburn", "#8A3B1F"), S("Copper", "#B0522A"), S("Chestnut", "#7A4626")],
    ),
    "autumn-neutral": dict(
        mood="Rich and grounded",
        colours=[S("Deep Teal", "#1F5F5B"), S("Burgundy", "#7B2333"), S("Moss", "#6E7F3A"), S("Soft Terracotta", "#B9745A"),
                 S("Deep Rose", "#A9646A"), S("Taupe", "#9E8A78"), S("Plum Brown", "#5E3A3F"), S("Muted Mustard", "#C2A257")],
        neutrals=[S("Oyster", "#EDE4D6"), S("Warm Grey", "#9C9488"), S("Chocolate", "#4A2C20"), S("Olive Brown", "#5E5638")],
        avoid=[S("Neon Yellow", "#E9FF3B"), S("Icy Blue", "#CFE8F7"), S("Optic White", "#FFFFFF"), S("Hot Pink", "#FF4F9A")],
        metals=[S("Rose Gold", "#C99A84"), S("Antique Brass", "#A88B4E"), S("Gunmetal", "#6B6E70")],
        gems=["Garnet", "Smoky quartz", "Jade", "Champagne diamond"],
        lips=[S("Rosewood", "#A0625D"), S("Berry Brown", "#7A3B3F"), S("Spiced Nude", "#8A5A44")],
        blush=[S("Soft Brick", "#A85F4C"), S("Warm Rose", "#C2817A")],
        eyes=[S("Taupe", "#9A8573"), S("Plum", "#5E3A4A"), S("Deep Olive", "#556B2F")],
        hair=[S("Chocolate", "#4A2C20"), S("Mahogany", "#5E2A1E"), S("Soft Brown", "#6B4A35")],
    ),
    "autumn-cool": dict(
        mood="Deep, smoky and moody",
        colours=[S("Aubergine", "#4E2A3A"), S("Pine", "#01594F"), S("Deep Plum", "#5C2C4E"), S("Slate Teal", "#4F7676"),
                 S("Wine", "#6B1F3A"), S("Smoky Blue", "#4A5D7A"), S("Mauve", "#8A6A78"), S("Spruce", "#3C5A54")],
        neutrals=[S("Charcoal", "#3A3A3F"), S("Taupe Grey", "#8A8380"), S("Espresso", "#3B2A20"), S("Soft White", "#EDEAE4")],
        avoid=[S("Orange", "#F28C28"), S("Bright Yellow", "#FFE135"), S("Camel", "#C19A6B"), S("Peach", "#FFBE98")],
        metals=[S("Gunmetal", "#53565A"), S("Pewter", "#8E9196"), S("Brushed Silver", "#B5B8BC")],
        gems=["Garnet", "Iolite", "Smoky quartz", "Black pearl"],
        lips=[S("Wine", "#6E1F3A"), S("Berry", "#8E2F55"), S("Mauve", "#9A6070")],
        blush=[S("Plum Rose", "#9A4A64"), S("Dusty Berry", "#A85A72")],
        eyes=[S("Graphite", "#3A3A3F"), S("Plum", "#4A1F48"), S("Pine", "#2F5A50")],
        hair=[S("Dark Ash Brown", "#3E3633"), S("Espresso", "#2B1E1A"), S("Cool Chocolate", "#4A3A35")],
    ),
    # ── WINTER: deep or icy, crisp
    "winter-warm": dict(
        mood="Bold, warm and dramatic",
        colours=[S("Tomato Red", "#D2382B"), S("Deep Emerald", "#00704A"), S("Warm Teal", "#00797A"), S("Burnt Orange", "#C25A1E"),
                 S("Garnet", "#73232B"), S("Marigold", "#E3A21A"), S("Chocolate", "#4A2C20"), S("Bright Navy", "#1F3A93")],
        neutrals=[S("Espresso", "#3B2A20"), S("Black-Brown", "#2B1E1A"), S("Ivory", "#FFF8E8"), S("Camel", "#B0834F")],
        avoid=[S("Pastel Pink", "#F8C8DC"), S("Icy Blue", "#CFE8F7"), S("Lavender", "#B9A6D6"), S("Dusty Grey", "#A9A9A9")],
        metals=[S("Yellow Gold", "#D4AF37"), S("Bronze", "#8C6239"), S("Rich Gold", "#C9A030")],
        gems=["Emerald", "Garnet", "Fire opal", "Tiger's eye"],
        lips=[S("Brick Red", "#A3301F"), S("Warm Red", "#C8302B"), S("Spiced Plum", "#6E2E3A")],
        blush=[S("Brick", "#A44E3A"), S("Deep Coral", "#C9654C")],
        eyes=[S("Bronze", "#8C6239"), S("Deep Olive", "#4F5A2A"), S("Espresso", "#3B2A20")],
        hair=[S("Espresso", "#3B2418"), S("Dark Chocolate", "#4A2C20"), S("Mahogany", "#5E2A1E")],
    ),
    "winter-neutral": dict(
        mood="Regal and high-contrast",
        colours=[S("Emerald", "#00754A"), S("Ruby", "#9B111E"), S("Deep Teal", "#014D4E"), S("Magenta", "#B0174E"),
                 S("Black Cherry", "#3D0C1E"), S("Royal Blue", "#2A52BE"), S("True Red", "#C8102E"), S("Soft Ivory", "#F7F4EC")],
        neutrals=[S("Black", "#111111"), S("Charcoal", "#333333"), S("Soft White", "#F7F4EC"), S("Black-Brown", "#2B1E1A")],
        avoid=[S("Pastel Peach", "#FFD3B6"), S("Dusty Rose", "#C49A9A"), S("Khaki", "#C3B091"), S("Mustard", "#C9A227")],
        metals=[S("Rose Gold", "#B76E79"), S("Silver", "#C9CDD2"), S("Rich Gold", "#C9A030")],
        gems=["Ruby", "Emerald", "Onyx", "Diamond"],
        lips=[S("True Red", "#C8102E"), S("Deep Berry", "#7A1E48"), S("Brick Red", "#9E2B25")],
        blush=[S("Plum Rose", "#9A4A64"), S("Raspberry", "#B03060")],
        eyes=[S("Black", "#111111"), S("Emerald", "#00754A"), S("Plum Bronze", "#5A3A40")],
        hair=[S("Black", "#111111"), S("Dark Espresso", "#2B1E1A"), S("Black Cherry", "#3D0C1E")],
    ),
    "winter-cool": dict(
        mood="Icy, crisp and electric",
        colours=[S("Sapphire", "#0F52BA"), S("Blue Red", "#B3112E"), S("Fuchsia", "#C71585"), S("Emerald", "#009473"),
                 S("Icy Blue", "#CFE8F7"), S("Royal Purple", "#5B2C83"), S("Cobalt", "#0047AB"), S("Icy Pink", "#F4D7E6")],
        neutrals=[S("Optic White", "#FFFFFF"), S("Black", "#111111"), S("Charcoal", "#36454F"), S("Navy", "#1F2A44")],
        avoid=[S("Orange", "#F28C28"), S("Camel", "#C19A6B"), S("Mustard", "#C9A227"), S("Rust", "#A8492A")],
        metals=[S("Platinum", "#E5E4E2"), S("Silver", "#C9CDD2"), S("White Gold", "#E1E1DC")],
        gems=["Sapphire", "Ruby", "Diamond", "Tanzanite"],
        lips=[S("Blue Red", "#B3112E"), S("Fuchsia", "#C2185B"), S("Berry", "#8E1F4A")],
        blush=[S("Cool Pink", "#E2718F"), S("Berry", "#B84A70")],
        eyes=[S("Charcoal", "#36454F"), S("Silver", "#BFC3C8"), S("Plum", "#4E2A4F")],
        hair=[S("Blue Black", "#141822"), S("Cool Espresso", "#2B2321"), S("Silver", "#D9D9D9")],
    ),
}

for _k, _p in PROFILES.items():
    fam, ut = _k.split("-")
    _p["key"] = _k
    _p["family"] = fam.capitalize()
    _p["undertone"] = ut.capitalize()
    _p["label"] = f"{fam.capitalize()} · {ut.capitalize()} undertone"
    _p["rule"] = f"{UNDERTONE_RULE[ut.capitalize()]} {FAMILY_RULE[fam.capitalize()]}"


# ───────────────────────────────────────────────────────────────── categories
# Each intent is (search phrase, colour target). Colour targets name a profile list and an index:
#   "colours:0" → first signature colour · "neutrals" → the whole list · "metals" → all metals …
# The ingest step searches phrases (optionally colour-filtered); the ranker scores every candidate against
# the category's TARGET palette for each profile.
CATEGORIES = {
    "jewellery": dict(
        title="Jewellery", kicker="Metals & stones", kind="category",
        target=("metals", "gems_hex", "neutrals"),
        why="{metals} sit in harmony with your undertone; let the stones echo {c0} and {c1}.",
        intents={
            "female": [("gold earrings minimal jewelry", "metals:0"), ("silver earrings minimal jewelry", "metals:-1"),
                       ("dainty necklace jewelry", "metals:0"), ("rings jewelry closeup", "metals:0"),
                       ("pearl earrings", "neutrals:0"), ("gemstone ring", "colours:0")],
            "male": [("men watch wrist", "metals:0"), ("men ring jewelry", "metals:0"), ("men bracelet", "metals:-1"),
                     ("men chain necklace", "metals:0")],
        },
    ),
    "hairstyles": dict(
        title="Hair & Hairstyles", kicker="Colour & cut", kind="category",
        target=("hair",),
        why="Hair in {hair} harmonises with your skin; avoid shades that fight your undertone.",
        intents={
            "female": [("woman hairstyle portrait", "hair:0"), ("woman wavy hair", "hair:1"), ("woman bob haircut", "hair:2"),
                       ("woman hair bun", "hair:0"), ("woman braided hair", "hair:1")],
            "male": [("man haircut portrait", "hair:0"), ("man hairstyle", "hair:1"), ("man curly hair", "hair:2")],
        },
    ),
    "makeup": dict(
        title="Makeup & Grooming", kicker="Face", kind="category",
        target=("lips", "blush", "eyes"),
        why="{lip} lips with {blush} cheeks; eyes in {eye}.",
        intents={
            "female": [("lipstick", "lips:0"), ("lipstick swatches", "lips:1"), ("makeup flat lay", "lips:0"),
                       ("eyeshadow palette", "eyes:1"), ("blush makeup", "blush:0"), ("woman makeup portrait", "lips:0")],
            "male": [("men grooming products", "neutrals:2"), ("men skincare", "neutrals:0"), ("beard grooming", "hair:0")],
        },
    ),
    "clothing": dict(
        title="Clothing & Colour", kicker="Your wardrobe", kind="category",
        target=("colours", "neutrals"),
        why="Wear {c0}, {c1} and {c2} near your face; build the base in {n0} and {n1}.",
        intents={
            "female": [("woman dress fashion", "colours:0"), ("woman blouse fashion", "colours:1"), ("woman sweater fashion", "colours:2"),
                       ("woman outfit minimal", "neutrals:1"), ("woman coat fashion", "neutrals:3")],
            "male": [("man shirt fashion", "colours:0"), ("man sweater fashion", "colours:2"), ("man jacket fashion", "neutrals:3"),
                     ("man outfit minimal", "neutrals:1")],
        },
    ),
    "footwear": dict(
        title="Footwear", kicker="Shoes · boots · heels", kind="category",
        target=("neutrals", "colours", "metals"),
        why="Ground your looks in {n2} or {n3} leather; let one pair in {c0} carry the colour, with {m0} hardware.",
        intents={
            "female": [("women high heels fashion", "neutrals:2"), ("women leather ankle boots", "neutrals:3"),
                       ("women ballet flats", "neutrals:1"), ("women strappy sandals", "metals:0"),
                       ("women stiletto pumps", "colours:0"), ("women fashion sneakers", "neutrals:0")],
            "male": [("men leather oxford shoes", "neutrals:3"), ("men chelsea boots", "neutrals:2"),
                     ("men suede loafers", "neutrals:1"), ("men leather derby shoes", "colours:2"),
                     ("men white leather sneakers", "neutrals:0")],
        },
    ),
    "office": dict(
        title="Office & Interview", kicker="Professional wear", kind="occasion",
        target=("neutrals", "colours"),
        why="Anchor in {n0} and {n3}, add one {c0} piece near the face, small {m0} details.",
        intents={
            "female": [("woman blazer office outfit", "neutrals:3"), ("woman business suit", "neutrals:2"), ("woman office outfit", "colours:0")],
            "male": [("man suit office", "neutrals:3"), ("man blazer shirt business", "neutrals:2"), ("man business tie", "colours:0")],
        },
    ),
    "party": dict(
        title="Party & Occasion", kicker="Cocktail · celebration", kind="occasion",
        target=("colours",),
        why="Your most magnetic shades — {c0}, {c4} or {c5} — in a fabric with a little shine, finished with {m0}.",
        intents={
            "female": [("woman cocktail dress", "colours:0"), ("woman party dress", "colours:4"), ("woman evening outfit", "colours:5")],
            "male": [("man party outfit", "colours:5"), ("man velvet blazer", "colours:0"), ("man evening shirt", "colours:4")],
        },
    ),
    "festive": dict(
        title="Festive & Wedding", kicker="Ethnic · celebration", kind="occasion",
        target=("colours", "metals"),
        why="Choose {c0} or {c5} with {m0} zari and jewellery for weddings, sangeet and festivals.",
        intents={
            "female": [("woman saree", "colours:0"), ("lehenga", "colours:5"), ("indian woman ethnic wear", "colours:1")],
            "male": [("man sherwani", "colours:0"), ("man kurta", "neutrals:0"), ("indian groom", "colours:5")],
        },
    ),
    "date-night": dict(
        title="Date Night", kicker="Dinner · romance", kind="occasion",
        target=("colours",),
        why="Soft, touchable textures in {c1} or {c6} that glow in low light, finished with {m0}.",
        intents={
            "female": [("woman date night outfit", "colours:1"), ("woman slip dress", "colours:6")],
            "male": [("man smart casual outfit", "colours:6"), ("man knit polo", "colours:1")],
        },
    ),
    "casual": dict(
        title="Weekend Casual", kicker="Everyday · brunch", kind="occasion",
        target=("neutrals", "colours"),
        why="Easy pieces in {n1} and {c2} — denim and knits that still flatter.",
        intents={
            "female": [("woman casual outfit", "neutrals:1"), ("woman street style", "colours:2")],
            "male": [("man casual outfit", "neutrals:1"), ("man street style", "colours:2")],
        },
    ),
    "vacation": dict(
        title="Vacation & Resort", kicker="Beach · travel", kind="occasion",
        target=("colours", "neutrals"),
        why="Airy linens in {n0} with {c3} or {c1} for sunshine.",
        intents={
            "female": [("woman summer dress beach", "colours:3"), ("woman linen outfit", "neutrals:0")],
            "male": [("man linen shirt beach", "colours:3"), ("man summer outfit", "neutrals:0")],
        },
    ),
    "black-tie": dict(
        title="Black Tie & Gala", kicker="Formal · red carpet", kind="occasion",
        target=("colours", "neutrals"),
        why="Floor-length {c7} or {c0} — or a sharp tuxedo in {n3} — finished with {m0} jewellery or cufflinks.",
        intents={
            "female": [("woman evening gown", "colours:7"), ("woman gala dress", "colours:0")],
            "male": [("man tuxedo", "neutrals:3"), ("man formal suit bow tie", "neutrals:2")],
        },
    ),
}
GENDERS = ("female", "male")
PER_SLOT = 10

# rough hex for gemstones, so jewellery images can be scored against stones as well as metals
GEM_HEX = {
    "Citrine": "#E4A010", "Coral": "#F88379", "Turquoise": "#40E0D0", "Peridot": "#B4C424", "Aquamarine": "#7FFFD4",
    "Rose quartz": "#F7CAC9", "Pearl": "#EAE0C8", "Blue topaz": "#4FB4E0", "Pink sapphire": "#E75480", "Emerald": "#009B77",
    "Crystal": "#E8F1F5", "Peach moonstone": "#F2C6A8", "Jade": "#00A86B", "Freshwater pearl": "#F0E6D8",
    "Grey moonstone": "#B8B8C0", "Labradorite": "#5F7A88", "Grey pearl": "#A9A9B0", "Amethyst": "#9966CC",
    "Sapphire": "#0F52BA", "Pink tourmaline": "#E68FAC", "White pearl": "#F5F2EA", "Amber": "#FFBF00", "Topaz": "#FFC87C",
    "Tiger's eye": "#B5651D", "Carnelian": "#B31B1B", "Garnet": "#733635", "Smoky quartz": "#6E5A4B",
    "Champagne diamond": "#F7E7CE", "Iolite": "#5A4FCF", "Black pearl": "#2F2F38", "Fire opal": "#E95C20",
    "Ruby": "#9B111E", "Onyx": "#111111", "Diamond": "#F2F6F8", "Tanzanite": "#4D5BBE",
}


def resolve(profile, ref):
    """'colours:0' → that swatch's hex; 'metals:-1' → last metal; 'neutrals' → first neutral."""
    name, _, idx = ref.partition(":")
    xs = profile[name]
    return xs[int(idx) if idx else 0]


def target_palette(profile, category):
    out = []
    for part in CATEGORIES[category]["target"]:
        if part == "gems_hex":
            out += [S(g, GEM_HEX[g]) for g in profile["gems"] if g in GEM_HEX]
        else:
            out += profile[part]
    return out


def why(profile, category):
    p = profile
    lower = lambda s: s["name"].lower()
    fill = {f"c{i}": lower(c) for i, c in enumerate(p["colours"])}
    fill.update({f"n{i}": lower(c) for i, c in enumerate(p["neutrals"])})
    fill.update({f"m{i}": lower(c) for i, c in enumerate(p["metals"])})
    fill.update(metals=" and ".join(m["name"].lower() for m in p["metals"][:2]).capitalize(),
                hair=", ".join(lower(h) for h in p["hair"]), lip=lower(p["lips"][0]), blush=lower(p["blush"][0]),
                eye=" or ".join(lower(e) for e in p["eyes"][:2]))
    s = CATEGORIES[category]["why"].format(**fill)
    return s[0].upper() + s[1:]

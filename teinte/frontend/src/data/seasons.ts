// The curated 12-season database. Every recommendation on the site — palettes, looks, makeup, hair,
// jewellery and the stylist's answers — is derived from these records.

export type Swatch = { name: string; hex: string };
export type Family = "Spring" | "Summer" | "Autumn" | "Winter";
export type Undertone = "Warm" | "Cool" | "Neutral";
export type Role = "dark" | "light" | "mid" | "signature" | "accent" | "soft" | "deep" | "bright" | "pastel";

export type Season = {
  id: string;
  name: string;
  family: Family;
  undertone: "Warm" | "Cool";
  dims: { hue: string; value: string; chroma: string };
  tagline: string;
  description: string;
  gradient: [string, string, string];
  skin: string; // representative skin tone used on illustrations before a scan
  contrast: "Low" | "Medium" | "Medium-high" | "High";
  palette: Swatch[];
  neutrals: Swatch[];
  avoid: Swatch[];
  roles: Record<Role, Swatch>;
  metals: { best: Swatch[]; avoid: string[]; finish: string };
  gems: string[];
  makeup: {
    foundation: string;
    lips: Swatch[];
    blush: Swatch[];
    eyes: Swatch[];
    liner: string;
    brows: string;
    nails: Swatch[];
  };
  hair: { best: Swatch[]; avoid: string[]; note: string };
  prints: string;
  fabrics: string;
  sisters: string[];
};

const s = (name: string, hex: string): Swatch => ({ name, hex });

export const SEASONS: Season[] = [
  // ───────────────────────────── SPRING — warm & clear
  {
    id: "light-spring",
    name: "Light Spring",
    family: "Spring",
    undertone: "Warm",
    dims: { hue: "Warm", value: "Light", chroma: "Clear" },
    tagline: "Sunlit pastels with a golden glow.",
    description:
      "Your colouring is light, warm and delicate, with a fresh clarity. Clear, sunny pastels make your skin look luminous, while heavy darks and greyed tones drain it. Keep contrast gentle and colours lively.",
    gradient: ["#FFE3C2", "#FFC2B0", "#BFE9DC"],
    skin: "#F2D2B6",
    contrast: "Low",
    palette: [
      s("Buttercup", "#F7D66E"), s("Peach", "#FFBE98"), s("Light Coral", "#F7867A"), s("Warm Pink", "#F5A3B5"),
      s("Apricot", "#FBB57C"), s("Salmon", "#F99C83"), s("Mint", "#A6E3C8"), s("Light Aqua", "#7ED6D0"),
      s("Turquoise", "#3EC5BE"), s("Spring Green", "#A9D47A"), s("Periwinkle", "#9DB2EC"), s("Clear Light Violet", "#B9A1E2"),
      s("Light Warm Navy", "#45628F"), s("Golden Tan", "#D8A86B"), s("Camel", "#D2AC7E"), s("Poppy", "#F26B5B"),
    ],
    neutrals: [s("Warm Ivory", "#FFF5E3"), s("Cream", "#F4E5C9"), s("Light Camel", "#D9B68C"), s("Warm Light Grey", "#CBC3B7"), s("Milk Chocolate", "#8C603F"), s("Light Navy", "#45628F")],
    avoid: [s("Black", "#121212"), s("Burgundy", "#6B1E2E"), s("Charcoal", "#35383D"), s("Dusty Mauve", "#9C7D89"), s("Olive Drab", "#5B5A2D"), s("Stark White", "#FFFFFF")],
    roles: {
      dark: s("Light Warm Navy", "#45628F"), light: s("Warm Ivory", "#FFF5E3"), mid: s("Light Camel", "#D9B68C"),
      signature: s("Peach", "#FFBE98"), accent: s("Turquoise", "#3EC5BE"), soft: s("Mint", "#A6E3C8"),
      deep: s("Milk Chocolate", "#8C603F"), bright: s("Light Coral", "#F7867A"), pastel: s("Buttercup", "#F7D66E"),
    },
    metals: { best: [s("Light Gold", "#E4C77A"), s("Rose Gold", "#E1A98C"), s("Polished Brass", "#D6B456")], avoid: ["Oxidised silver", "Gunmetal", "Heavy antique gold"], finish: "Polished and delicate" },
    gems: ["Peridot", "Aquamarine", "Citrine", "Coral", "Cream pearl", "Light turquoise"],
    makeup: {
      foundation: "Light, with a peach or golden undertone",
      lips: [s("Peach Nude", "#E9A48A"), s("Coral Pink", "#F07C6C"), s("Warm Rose", "#DC8582")],
      blush: [s("Apricot", "#F5A584"), s("Peach", "#F8B99F")],
      eyes: [s("Champagne", "#E8CFA6"), s("Soft Bronze", "#B88A5C"), s("Aqua", "#70C4BE")],
      liner: "Soft brown or warm navy",
      brows: "Golden blonde to light warm brown",
      nails: [s("Coral", "#F48475"), s("Sheer Peach", "#F6C7AE")],
    },
    hair: { best: [s("Golden Blonde", "#D7B06C"), s("Strawberry Blonde", "#D59868"), s("Honey", "#C38B4C"), s("Light Golden Brown", "#A6744A")], avoid: ["Ash platinum", "Blue-black", "Burgundy"], note: "Stay light and golden; soft honey highlights add sparkle without contrast." },
    prints: "Small to medium florals, watercolour and fine stripes in clear pastels.",
    fabrics: "Light, airy and fluid — cotton voile, linen, silk crêpe, fine knits.",
    sisters: ["light-summer", "warm-spring"],
  },
  {
    id: "warm-spring",
    name: "Warm Spring",
    family: "Spring",
    undertone: "Warm",
    dims: { hue: "Warm", value: "Medium-light", chroma: "Clear" },
    tagline: "Sunshine in a bottle — golden, fresh, alive.",
    description:
      "Golden warmth is your defining trait. Clear, sunny colours with a yellow base bring out your glow; anything cool, icy or dusty makes you look tired. Think marigold, coral and fresh greens.",
    gradient: ["#FFD27A", "#FF9F6E", "#9ED9A2"],
    skin: "#E5B88F",
    contrast: "Medium",
    palette: [
      s("Marigold", "#F5B731"), s("Warm Coral", "#F27255"), s("Apricot", "#F9A15E"), s("Poppy Red", "#E8452E"),
      s("Golden Yellow", "#F6C543"), s("Clear Salmon", "#F68E73"), s("Lime Green", "#A4C639"), s("Kelly Green", "#3DAA5A"),
      s("Warm Turquoise", "#21B2A6"), s("Clear Teal", "#14958E"), s("Golden Brown", "#A0682F"), s("Camel", "#C89A5B"),
      s("Warm Periwinkle", "#7F95D9"), s("Bright Navy", "#2E4C8C"), s("Golden Pink", "#F28B8F"), s("Pumpkin", "#EE7F2D"),
    ],
    neutrals: [s("Ivory", "#FFF3DC"), s("Warm Beige", "#E3C9A1"), s("Camel", "#C89A5B"), s("Golden Brown", "#A0682F"), s("Warm Grey", "#A89C8C"), s("Bright Navy", "#2E4C8C")],
    avoid: [s("Black", "#121212"), s("Icy Pink", "#F4D7E6"), s("Cool Grey", "#8E949C"), s("Burgundy", "#6B1E2E"), s("Lavender", "#B9A6D6"), s("Optic White", "#FFFFFF")],
    roles: {
      dark: s("Bright Navy", "#2E4C8C"), light: s("Ivory", "#FFF3DC"), mid: s("Camel", "#C89A5B"),
      signature: s("Warm Coral", "#F27255"), accent: s("Warm Turquoise", "#21B2A6"), soft: s("Warm Beige", "#E3C9A1"),
      deep: s("Golden Brown", "#A0682F"), bright: s("Poppy Red", "#E8452E"), pastel: s("Apricot", "#F9A15E"),
    },
    metals: { best: [s("Yellow Gold", "#D4AF37"), s("Brushed Brass", "#C9A54A"), s("Copper", "#C27A4A")], avoid: ["Silver", "Platinum", "Gunmetal"], finish: "Warm, polished or hammered" },
    gems: ["Citrine", "Coral", "Turquoise", "Peridot", "Topaz", "Ivory pearl"],
    makeup: {
      foundation: "Light-medium to medium with a golden undertone",
      lips: [s("Warm Coral", "#E86B54"), s("Poppy", "#D9452F"), s("Golden Nude", "#C98563")],
      blush: [s("Warm Peach", "#F29A76"), s("Coral", "#EE8466")],
      eyes: [s("Bronze", "#A6733D"), s("Warm Gold", "#D2A64C"), s("Olive Shimmer", "#8C8A3F")],
      liner: "Golden brown or teal",
      brows: "Golden to medium warm brown",
      nails: [s("Coral", "#EE6E55"), s("Apricot", "#F5A06C")],
    },
    hair: { best: [s("Golden Copper", "#B8692F"), s("Honey Blonde", "#CB9A55"), s("Warm Caramel", "#A86B3A"), s("Golden Brown", "#7C522E")], avoid: ["Ash blonde", "Jet black", "Violet tones"], note: "Golden and copper reflects are your best friends; ask for warm, sunlit balayage." },
    prints: "Cheerful medium-scale florals, tropical leaves, gingham and clean stripes.",
    fabrics: "Crisp cotton, linen, silk twill, light suede, polished leather.",
    sisters: ["warm-autumn", "bright-spring"],
  },
  {
    id: "bright-spring",
    name: "Bright Spring",
    family: "Spring",
    undertone: "Warm",
    dims: { hue: "Warm-neutral", value: "Medium", chroma: "Bright" },
    tagline: "Pure, saturated colour with a warm spark.",
    description:
      "You carry clarity and contrast — bright eyes, clear skin. Vivid, saturated colours with a hint of warmth match your intensity; muted, greyed shades flatten you. Wear colour with confidence.",
    gradient: ["#FF6F91", "#FFC75F", "#2EC4B6"],
    skin: "#E6BC9C",
    contrast: "Medium-high",
    palette: [
      s("Geranium", "#F2475B"), s("Flamingo", "#F86B8F"), s("Clear Coral", "#FF6F5E"), s("Warm True Red", "#E3242B"),
      s("Sunny Yellow", "#FFD23F"), s("Clear Lime", "#9BDB3C"), s("Clear Emerald", "#00A86B"), s("Turquoise", "#00B7B0"),
      s("Vivid Aqua", "#00CED1"), s("Bright Royal", "#2856D8"), s("Clear Violet", "#8E5BD8"), s("Hot Coral Pink", "#FF5D73"),
      s("Bright Navy", "#1F3A93"), s("Warm Black-Brown", "#3B2A22"), s("Tangerine", "#FF8C32"), s("Mango", "#FFB347"),
    ],
    neutrals: [s("Ivory", "#FFF8E8"), s("Light Warm Grey", "#C8C2BA"), s("Bright Navy", "#1F3A93"), s("Chocolate", "#5B3A29"), s("Camel", "#C49A6C"), s("Charcoal Brown", "#3B2A22")],
    avoid: [s("Dusty Rose", "#C49A9A"), s("Taupe", "#A3927F"), s("Muted Olive", "#7A7550"), s("Mauve", "#A6858F"), s("Brown-grey", "#8B8178"), s("Soft Sage", "#A9B49A")],
    roles: {
      dark: s("Bright Navy", "#1F3A93"), light: s("Ivory", "#FFF8E8"), mid: s("Camel", "#C49A6C"),
      signature: s("Geranium", "#F2475B"), accent: s("Turquoise", "#00B7B0"), soft: s("Mango", "#FFB347"),
      deep: s("Chocolate", "#5B3A29"), bright: s("Clear Emerald", "#00A86B"), pastel: s("Flamingo", "#F86B8F"),
    },
    metals: { best: [s("Polished Gold", "#E1B83E"), s("Rose Gold", "#E0A388"), s("Bright Brass", "#D9B44A")], avoid: ["Matte antique metals", "Oxidised silver"], finish: "High-shine and sparkling" },
    gems: ["Emerald", "Turquoise", "Ruby", "Tourmaline", "Fire opal", "White topaz"],
    makeup: {
      foundation: "Light-medium with a neutral-golden undertone",
      lips: [s("Clear Coral", "#F25A4D"), s("Warm Red", "#D7262E"), s("Watermelon", "#F05D73")],
      blush: [s("Coral Pink", "#F67F7F"), s("Bright Peach", "#FF9A76")],
      eyes: [s("Teal", "#0E8F8A"), s("Bronze", "#A5703A"), s("Violet", "#7D4FC7")],
      liner: "Black-brown or bright navy",
      brows: "Medium to dark warm brown",
      nails: [s("Geranium", "#F2475B"), s("Turquoise", "#00B7B0")],
    },
    hair: { best: [s("Warm Dark Brown", "#4A2E1F"), s("Chestnut", "#6E3B22"), s("Golden Auburn", "#8E3F1F"), s("Rich Caramel", "#9C6233")], avoid: ["Ashy, smoky tones", "Flat mousy browns"], note: "Keep hair rich and glossy — shine matters as much as colour for you." },
    prints: "Bold graphic prints, colour-block, tropical and high-contrast stripes.",
    fabrics: "Smooth and lustrous — silk satin, crisp poplin, sharp tailoring, patent leather.",
    sisters: ["bright-winter", "warm-spring"],
  },

  // ───────────────────────────── SUMMER — cool & soft
  {
    id: "light-summer",
    name: "Light Summer",
    family: "Summer",
    undertone: "Cool",
    dims: { hue: "Cool", value: "Light", chroma: "Soft" },
    tagline: "Misty, blended pastels with a cool breeze.",
    description:
      "Light and cool with a gentle softness, your colouring glows in airy, blue-based pastels. High contrast and heavy darks overpower you; keep everything light, fresh and blended.",
    gradient: ["#DCE7F7", "#E9D6EC", "#CFEDE6"],
    skin: "#F1D5C7",
    contrast: "Low",
    palette: [
      s("Powder Blue", "#A9C8E8"), s("Lavender", "#BFA8DD"), s("Dusty Rose", "#D9A0AC"), s("Seafoam", "#A7DCCB"),
      s("Soft Periwinkle", "#A3AEE0"), s("Light Orchid", "#D5A6D6"), s("Cool Pink", "#F2AFC6"), s("Sky Blue", "#8EC1E6"),
      s("Soft Aqua", "#8FD0CF"), s("Light Raspberry", "#D26D93"), s("Cornflower", "#7C9CD9"), s("Lilac", "#C9B5E3"),
      s("Soft Teal", "#5FA8A7"), s("Rose Pink", "#E58FAA"), s("Light Lemon", "#F3EC9C"), s("Slate Blue", "#7489B5"),
    ],
    neutrals: [s("Soft White", "#F7F5F2"), s("Light Cool Grey", "#C9CBD0"), s("Rose Beige", "#DDC4BD"), s("Cool Taupe", "#A39A98"), s("Soft Navy", "#4A5B7E"), s("Pewter", "#8B8F96")],
    avoid: [s("Black", "#121212"), s("Orange", "#F28C28"), s("Mustard", "#C9A227"), s("Rust", "#A8492A"), s("Chocolate", "#4A2C20"), s("Olive", "#6B6A2E")],
    roles: {
      dark: s("Soft Navy", "#4A5B7E"), light: s("Soft White", "#F7F5F2"), mid: s("Light Cool Grey", "#C9CBD0"),
      signature: s("Powder Blue", "#A9C8E8"), accent: s("Light Raspberry", "#D26D93"), soft: s("Lavender", "#BFA8DD"),
      deep: s("Slate Blue", "#7489B5"), bright: s("Rose Pink", "#E58FAA"), pastel: s("Seafoam", "#A7DCCB"),
    },
    metals: { best: [s("Silver", "#C9CDD2"), s("White Gold", "#E1E1DC"), s("Soft Rose Gold", "#DDB2A4")], avoid: ["Brassy yellow gold", "Copper"], finish: "Satin or softly polished" },
    gems: ["Moonstone", "Rose quartz", "Aquamarine", "Pink sapphire", "White pearl", "Blue topaz"],
    makeup: {
      foundation: "Fair to light with a pink or neutral-cool undertone",
      lips: [s("Rose Nude", "#C98A92"), s("Soft Berry", "#B85D7A"), s("Cool Pink", "#E2899F")],
      blush: [s("Soft Pink", "#EFA2B4"), s("Rose", "#DB8A9B")],
      eyes: [s("Taupe", "#9C8E8A"), s("Lilac", "#B8A3D3"), s("Soft Grey-Blue", "#8DA0B8")],
      liner: "Soft grey or navy",
      brows: "Ash blonde to soft ash brown",
      nails: [s("Ballet Pink", "#F2C6D0"), s("Lavender", "#C3AEDF")],
    },
    hair: { best: [s("Ash Blonde", "#C9B79A"), s("Beige Blonde", "#D3BF9F"), s("Pearl Blonde", "#E2D5BF"), s("Light Ash Brown", "#8E7A64")], avoid: ["Copper", "Golden orange", "Jet black"], note: "Soft, cool blondes and beige tones; ask for toner to keep brassiness away." },
    prints: "Soft watercolour florals, fine pinstripes, gentle tonal patterns.",
    fabrics: "Soft and floaty — chiffon, cashmere, washed silk, cotton lawn.",
    sisters: ["light-spring", "cool-summer"],
  },
  {
    id: "cool-summer",
    name: "Cool Summer",
    family: "Summer",
    undertone: "Cool",
    dims: { hue: "Cool", value: "Medium", chroma: "Soft-medium" },
    tagline: "Rose, plum and blue — pure, calm coolness.",
    description:
      "Your colouring is distinctly cool with no golden cast. Blue-based, softly bright colours — raspberry, periwinkle, plum — make you look rested and radiant. Warm, yellow-based shades turn you sallow.",
    gradient: ["#B9C7EA", "#D7A7C8", "#9DC9D4"],
    skin: "#E8C4B6",
    contrast: "Medium",
    palette: [
      s("Raspberry", "#C2185B"), s("Soft Fuchsia", "#D25C9A"), s("Periwinkle", "#7F8FD9"), s("Powder Blue", "#9BB7E0"),
      s("Plum", "#7A3E6B"), s("Cool Rose", "#D9849B"), s("Spruce", "#3C7A75"), s("Sapphire Mist", "#4F6FB0"),
      s("Soft Teal", "#4E9A9A"), s("Lavender", "#A994D4"), s("Watermelon Pink", "#E46A8A"), s("Cornflower", "#6E8FD6"),
      s("Seafoam", "#8CCBB7"), s("Berry", "#9E2A5B"), s("Navy", "#2C3E66"), s("Cool Lemon", "#EEE48F"),
    ],
    neutrals: [s("Soft White", "#F5F4F2"), s("Cool Grey", "#9AA0A8"), s("Rose Taupe", "#9C8487"), s("Navy", "#2C3E66"), s("Charcoal Blue", "#3E4756"), s("Cocoa", "#6B5452")],
    avoid: [s("Orange", "#F28C28"), s("Camel", "#C19A6B"), s("Mustard", "#C9A227"), s("Rust", "#A8492A"), s("Warm Olive", "#7A6F2E"), s("Golden Brown", "#8B5A2B")],
    roles: {
      dark: s("Navy", "#2C3E66"), light: s("Soft White", "#F5F4F2"), mid: s("Cool Grey", "#9AA0A8"),
      signature: s("Raspberry", "#C2185B"), accent: s("Periwinkle", "#7F8FD9"), soft: s("Powder Blue", "#9BB7E0"),
      deep: s("Plum", "#7A3E6B"), bright: s("Soft Fuchsia", "#D25C9A"), pastel: s("Cool Rose", "#D9849B"),
    },
    metals: { best: [s("Silver", "#C0C4CA"), s("Platinum", "#D8D8D4"), s("White Gold", "#E1E1DC")], avoid: ["Yellow gold", "Copper", "Bronze"], finish: "Polished or brushed silver tones" },
    gems: ["Sapphire", "Amethyst", "Pink tourmaline", "Tanzanite", "Grey pearl", "Blue topaz"],
    makeup: {
      foundation: "Light to medium with a cool or neutral-pink undertone",
      lips: [s("Raspberry", "#B42358"), s("Cool Rose", "#C46A84"), s("Mauve Berry", "#9D4F6B")],
      blush: [s("Cool Pink", "#E68AA3"), s("Soft Berry", "#C9708C")],
      eyes: [s("Plum", "#7A4E70"), s("Slate", "#6D7A8C"), s("Silver Taupe", "#A39C9E")],
      liner: "Charcoal, navy or plum",
      brows: "Ash brown",
      nails: [s("Raspberry", "#B42358"), s("Mauve", "#B68BA0")],
    },
    hair: { best: [s("Cool Ash Brown", "#6E5B4C"), s("Mushroom Brown", "#8A7766"), s("Ash Blonde", "#B7A58C"), s("Soft Espresso", "#3E3230")], avoid: ["Copper", "Golden yellow", "Red-orange"], note: "Cool, smoky browns and ashy blondes. Gloss treatments with a violet or blue toner keep it cool." },
    prints: "Medium-scale florals, paisley and soft geometrics in blended cool tones.",
    fabrics: "Matte to soft-sheen — jersey, cashmere, silk crêpe, fine wool.",
    sisters: ["cool-winter", "light-summer"],
  },
  {
    id: "soft-summer",
    name: "Soft Summer",
    family: "Summer",
    undertone: "Cool",
    dims: { hue: "Cool-neutral", value: "Medium", chroma: "Muted" },
    tagline: "Smoky, sophisticated, quietly cool.",
    description:
      "Grey-softened and gently cool, your colouring is elegant and blended. Muted colours with a dusty, misty quality look expensive on you; anything neon or stark white feels harsh.",
    gradient: ["#A9B6C2", "#C7A9B4", "#9FB8A8"],
    skin: "#DDBCA7",
    contrast: "Low",
    palette: [
      s("Dusty Rose", "#C48B92"), s("Muted Teal", "#5C8D89"), s("Soft Sage", "#9DB09A"), s("Greyed Lavender", "#A39BB8"),
      s("Stone Blue", "#7891A8"), s("Soft Burgundy", "#7E4A57"), s("Mauve", "#A8818D"), s("Smoky Plum", "#6E5068"),
      s("Denim Blue", "#5F7896"), s("Soft Raspberry", "#A85A72"), s("Slate Teal", "#4F7676"), s("Heather", "#9E8FA8"),
      s("Eucalyptus", "#7FA090"), s("Rose Brown", "#987070"), s("Soft Navy", "#3E4B63"), s("Pewter Blue", "#8698A8"),
    ],
    neutrals: [s("Soft White", "#EFECE7"), s("Rose Beige", "#CDB8AE"), s("Cool Taupe", "#958A84"), s("Medium Grey", "#8E9196"), s("Soft Navy", "#3E4B63"), s("Charcoal", "#4A4C52")],
    avoid: [s("Neon Pink", "#FF3FA4"), s("Orange", "#F28C28"), s("Stark White", "#FFFFFF"), s("Black", "#121212"), s("Bright Yellow", "#FFE135"), s("Kelly Green", "#2BB24C")],
    roles: {
      dark: s("Soft Navy", "#3E4B63"), light: s("Soft White", "#EFECE7"), mid: s("Cool Taupe", "#958A84"),
      signature: s("Dusty Rose", "#C48B92"), accent: s("Muted Teal", "#5C8D89"), soft: s("Greyed Lavender", "#A39BB8"),
      deep: s("Soft Burgundy", "#7E4A57"), bright: s("Soft Raspberry", "#A85A72"), pastel: s("Soft Sage", "#9DB09A"),
    },
    metals: { best: [s("Brushed Silver", "#B5B8BC"), s("Pewter", "#8E9196"), s("Soft Rose Gold", "#C9A196")], avoid: ["Shiny yellow gold", "Copper"], finish: "Matte, brushed or satin" },
    gems: ["Grey moonstone", "Rose quartz", "Smoky quartz", "Labradorite", "Grey pearl", "Iolite"],
    makeup: {
      foundation: "Light to medium with a neutral-cool undertone",
      lips: [s("Dusty Rose", "#B07C82"), s("Soft Mauve", "#A16E7E"), s("Muted Berry", "#8E4E62")],
      blush: [s("Soft Rose", "#CC8E97"), s("Mauve", "#B68790")],
      eyes: [s("Taupe", "#8F847E"), s("Smoky Plum", "#6E5068"), s("Slate Teal", "#5A7A7A")],
      liner: "Charcoal or soft brown-grey",
      brows: "Ash brown, softly defined",
      nails: [s("Mauve", "#A8818D"), s("Greige", "#BDB2AA")],
    },
    hair: { best: [s("Mushroom Brown", "#7F6E60"), s("Dark Ash Blonde", "#A08D74"), s("Soft Ash Brown", "#6B5A4E"), s("Smoky Bronde", "#94806A")], avoid: ["Bright copper", "Jet black", "Platinum"], note: "Blended, low-contrast dimension — babylights rather than chunky highlights." },
    prints: "Soft abstracts, tonal florals, heathered textures, gentle plaids.",
    fabrics: "Matte and textured — cashmere, bouclé, washed linen, suede, jersey.",
    sisters: ["soft-autumn", "cool-summer"],
  },

  // ───────────────────────────── AUTUMN — warm & muted
  {
    id: "soft-autumn",
    name: "Soft Autumn",
    family: "Autumn",
    undertone: "Warm",
    dims: { hue: "Warm-neutral", value: "Medium", chroma: "Muted" },
    tagline: "Golden haze — warm, earthy, gently muted.",
    description:
      "Your colouring is warm and soft, with a dusty, blended quality. Muted earth tones and warm greys look effortlessly rich on you; icy colours and pure brights overwhelm your natural harmony.",
    gradient: ["#D8B79A", "#B9A88B", "#9FAF95"],
    skin: "#D9B08F",
    contrast: "Low",
    palette: [
      s("Muted Olive", "#7D7A4E"), s("Soft Terracotta", "#B9745A"), s("Dusty Peach", "#D9A48B"), s("Sage", "#9AA88A"),
      s("Muted Mustard", "#C2A257"), s("Deep Rose", "#A9646A"), s("Khaki", "#A79C74"), s("Soft Teal", "#5F8A82"),
      s("Mahogany", "#7B4A3A"), s("Warm Taupe", "#9E8A78"), s("Salmon Rose", "#C98A7A"), s("Moss", "#7A8253"),
      s("Soft Denim", "#6E8396"), s("Camel", "#B8936A"), s("Cinnamon", "#9B6040"), s("Jade Grey", "#7F9B8E"),
    ],
    neutrals: [s("Oyster", "#EDE4D6"), s("Golden Beige", "#D2B994"), s("Warm Grey", "#9C9488"), s("Camel", "#B8936A"), s("Coffee", "#6B4E3D"), s("Olive Brown", "#5E5638")],
    avoid: [s("Black", "#121212"), s("Fuchsia", "#E3007D"), s("Icy Blue", "#CFE8F7"), s("Royal Blue", "#2350C8"), s("Optic White", "#FFFFFF"), s("Hot Pink", "#FF4F9A")],
    roles: {
      dark: s("Coffee", "#6B4E3D"), light: s("Oyster", "#EDE4D6"), mid: s("Camel", "#B8936A"),
      signature: s("Soft Terracotta", "#B9745A"), accent: s("Soft Teal", "#5F8A82"), soft: s("Sage", "#9AA88A"),
      deep: s("Mahogany", "#7B4A3A"), bright: s("Deep Rose", "#A9646A"), pastel: s("Dusty Peach", "#D9A48B"),
    },
    metals: { best: [s("Brushed Gold", "#C2A25E"), s("Rose Gold", "#C99A84"), s("Antique Brass", "#A88B4E")], avoid: ["Bright polished silver", "Chrome"], finish: "Matte, brushed, softly antiqued" },
    gems: ["Smoky topaz", "Jade", "Champagne diamond", "Moonstone (peach)", "Tiger's eye", "Freshwater pearl"],
    makeup: {
      foundation: "Light-medium to medium with a neutral-golden undertone",
      lips: [s("Rosewood", "#A0625D"), s("Warm Nude", "#B98272"), s("Soft Brick", "#9E5A47")],
      blush: [s("Soft Peach", "#D8957E"), s("Warm Rose", "#C2817A")],
      eyes: [s("Taupe", "#9A8573"), s("Olive", "#7D7A4E"), s("Soft Bronze", "#9E7550")],
      liner: "Soft brown or olive",
      brows: "Soft medium brown",
      nails: [s("Rosewood", "#A0625D"), s("Nude", "#C9A18D")],
    },
    hair: { best: [s("Soft Caramel", "#9C7350"), s("Golden Bronde", "#A88B68"), s("Light Auburn", "#8E5A3C"), s("Honey Brown", "#7E5A3E")], avoid: ["Jet black", "Ash platinum", "Burgundy-violet"], note: "Soft warm browns and bronde with blended caramel — never stark." },
    prints: "Subtle paisleys, animal print in soft browns, tonal florals, herringbone.",
    fabrics: "Textured, matte — suede, linen, raw silk, chunky knits, tweed.",
    sisters: ["soft-summer", "warm-autumn"],
  },
  {
    id: "warm-autumn",
    name: "Warm Autumn",
    family: "Autumn",
    undertone: "Warm",
    dims: { hue: "Warm", value: "Medium-deep", chroma: "Rich" },
    tagline: "Toasted, not dusty — spice, rust and gold.",
    description:
      "Rich golden warmth defines you. Earthy, spiced colours — rust, mustard, olive, pumpkin — make you look vibrant and healthy, while cool, icy or blue-based shades leave you grey.",
    gradient: ["#E3A857", "#C0622F", "#6F7A3A"],
    skin: "#C99467",
    contrast: "Medium",
    palette: [
      s("Rust", "#B7471F"), s("Mustard", "#D4A017"), s("Olive", "#708238"), s("Terracotta", "#C8643B"),
      s("Pumpkin", "#E07B25"), s("Deep Peach", "#E39969"), s("Bronze", "#9C6B30"), s("Antique Gold", "#C9A043"),
      s("Moss Green", "#6E7F3A"), s("Warm Forest", "#33582F"), s("Deep Coral", "#D2603F"), s("Caramel", "#B0743C"),
      s("Teal", "#1E6F6C"), s("Paprika", "#A63A1F"), s("Saffron", "#E8A33C"), s("Tomato Red", "#C93A23"),
    ],
    neutrals: [s("Cream", "#F3E6CC"), s("Camel", "#BF8F55"), s("Coffee", "#5E4027"), s("Khaki", "#A89A6A"), s("Warm Brown", "#7A4E2B"), s("Olive Brown", "#5C5530")],
    avoid: [s("Black", "#121212"), s("Icy Pink", "#F4D7E6"), s("Cool Grey", "#8E949C"), s("Fuchsia", "#E3007D"), s("Navy", "#1F2A44"), s("Optic White", "#FFFFFF")],
    roles: {
      dark: s("Coffee", "#5E4027"), light: s("Cream", "#F3E6CC"), mid: s("Camel", "#BF8F55"),
      signature: s("Rust", "#B7471F"), accent: s("Teal", "#1E6F6C"), soft: s("Khaki", "#A89A6A"),
      deep: s("Warm Forest", "#33582F"), bright: s("Pumpkin", "#E07B25"), pastel: s("Deep Peach", "#E39969"),
    },
    metals: { best: [s("Yellow Gold", "#D4AF37"), s("Antique Gold", "#B8913A"), s("Copper", "#B87333"), s("Bronze", "#9C6B30")], avoid: ["Silver", "Platinum", "Chrome"], finish: "Hammered, antiqued, burnished" },
    gems: ["Amber", "Topaz", "Carnelian", "Tiger's eye", "Garnet", "Gold pearl"],
    makeup: {
      foundation: "Medium to tan with a golden or olive undertone",
      lips: [s("Brick", "#A4442A"), s("Terracotta", "#B8603F"), s("Warm Nude", "#A86A4F")],
      blush: [s("Terracotta", "#C26A4A"), s("Warm Apricot", "#D88A5F")],
      eyes: [s("Copper", "#B06A35"), s("Olive", "#6E6E33"), s("Bronze", "#8E6430")],
      liner: "Chocolate brown or deep olive",
      brows: "Warm medium to deep brown",
      nails: [s("Rust", "#A4442A"), s("Burnt Orange", "#C8643B")],
    },
    hair: { best: [s("Auburn", "#8A3B1F"), s("Copper", "#B0522A"), s("Golden Chestnut", "#7A4626"), s("Caramel Brown", "#8C5B33")], avoid: ["Ash blonde", "Blue-black", "Platinum"], note: "Copper, auburn and golden chestnut make your eyes glow — think autumn leaves." },
    prints: "Paisley, tartan, leopard, ikat and rich botanical prints.",
    fabrics: "Rich and tactile — suede, tweed, corduroy, raw silk, cable knits, leather.",
    sisters: ["warm-spring", "deep-autumn"],
  },
  {
    id: "deep-autumn",
    name: "Deep Autumn",
    family: "Autumn",
    undertone: "Warm",
    dims: { hue: "Warm-neutral", value: "Deep", chroma: "Rich" },
    tagline: "Rich, earthy, luxurious depth.",
    description:
      "Deep and warm with real substance, your colouring can carry dark, saturated earth and jewel tones — burgundy, forest, chocolate, deep teal. Pale pastels and icy shades wash you out.",
    gradient: ["#7B2D26", "#B5651D", "#1F4E4A"],
    skin: "#A87150",
    contrast: "Medium-high",
    palette: [
      s("Warm Burgundy", "#7B2333"), s("Forest Green", "#2F4F2F"), s("Deep Teal", "#1F5F5B"), s("Aubergine", "#4E2A3A"),
      s("Rich Terracotta", "#A9472A"), s("Deep Mustard", "#B8860B"), s("Deep Olive", "#556B2F"), s("Paprika", "#9E3A1F"),
      s("Copper", "#B06A35"), s("Tomato", "#C0392B"), s("Emerald Olive", "#3B6E4A"), s("Burnt Orange", "#C25A1E"),
      s("Petrol", "#1B4D5C"), s("Garnet", "#73232B"), s("Bronze", "#8C6239"), s("Marigold", "#D9961A"),
    ],
    neutrals: [s("Cream", "#EFE2C8"), s("Espresso", "#3B2A20"), s("Dark Chocolate", "#4A2C20"), s("Camel", "#B0834F"), s("Olive Charcoal", "#3F3F2E"), s("Coffee", "#5E4027")],
    avoid: [s("Pastel Pink", "#F8C8DC"), s("Powder Blue", "#B0CFEA"), s("Icy Grey", "#D5D9DE"), s("Lavender", "#B9A6D6"), s("Optic White", "#FFFFFF"), s("Neon Yellow", "#E9FF3B")],
    roles: {
      dark: s("Espresso", "#3B2A20"), light: s("Cream", "#EFE2C8"), mid: s("Camel", "#B0834F"),
      signature: s("Warm Burgundy", "#7B2333"), accent: s("Deep Teal", "#1F5F5B"), soft: s("Deep Olive", "#556B2F"),
      deep: s("Forest Green", "#2F4F2F"), bright: s("Rich Terracotta", "#A9472A"), pastel: s("Deep Mustard", "#B8860B"),
    },
    metals: { best: [s("Antique Gold", "#B8913A"), s("Bronze", "#8C6239"), s("Copper", "#B06A35"), s("Rich Yellow Gold", "#C9A030")], avoid: ["Bright silver", "Platinum"], finish: "Rich, hammered, antiqued" },
    gems: ["Garnet", "Emerald", "Amber", "Smoky quartz", "Tiger's eye", "Onyx (with gold)"],
    makeup: {
      foundation: "Medium to deep with a golden, olive or neutral undertone",
      lips: [s("Brick Red", "#8E2F21"), s("Warm Plum", "#6E2E3A"), s("Spiced Nude", "#8A5A44")],
      blush: [s("Brick", "#A44E3A"), s("Deep Peach", "#B86A4F")],
      eyes: [s("Bronze", "#8C6239"), s("Deep Olive", "#4F5A2A"), s("Aubergine", "#4E2A3A")],
      liner: "Espresso, deep olive or black-brown",
      brows: "Deep warm brown",
      nails: [s("Oxblood", "#5C1A22"), s("Bronze", "#8C6239")],
    },
    hair: { best: [s("Espresso", "#3B2418"), s("Dark Chocolate", "#4A2C20"), s("Mahogany", "#5E2A1E"), s("Deep Auburn", "#6E2E1A")], avoid: ["Ash blonde", "Platinum", "Silvery greys"], note: "Deep, glossy browns with warm mahogany or auburn reflects." },
    prints: "Rich paisley, ikat, tapestry florals, leopard and bold plaids.",
    fabrics: "Weighty and luxurious — velvet, brocade, leather, heavy silk, wool crêpe.",
    sisters: ["deep-winter", "warm-autumn"],
  },

  // ───────────────────────────── WINTER — cool & clear
  {
    id: "cool-winter",
    name: "Cool Winter",
    family: "Winter",
    undertone: "Cool",
    dims: { hue: "Cool", value: "Medium-deep", chroma: "Clear" },
    tagline: "Icy clarity and crisp, blue-based drama.",
    description:
      "Purely cool and clear, your colouring shines in crisp contrasts — true black and white, sapphire, ruby, icy pastels. Warm, earthy and golden shades look muddy against your skin.",
    gradient: ["#1F2A60", "#B0174E", "#BFE3F2"],
    skin: "#E3BFAE",
    contrast: "High",
    palette: [
      s("Sapphire", "#0F52BA"), s("Blue Ruby", "#9B111E"), s("Vibrant Fuchsia", "#C71585"), s("Cool Emerald", "#009473"),
      s("Icy Blue", "#CFE8F7"), s("Deep Cool Purple", "#5B2C83"), s("Shocking Pink", "#E3007D"), s("True Red", "#C8102E"),
      s("Royal Blue", "#2350C8"), s("Pine", "#01796F"), s("Icy Pink", "#F4D7E6"), s("Icy Lilac", "#E0D4F2"),
      s("Magenta", "#B0174E"), s("Midnight Navy", "#1F2A44"), s("Cobalt", "#0047AB"), s("Icy Mint", "#D2F0E4"),
    ],
    neutrals: [s("Optic White", "#FFFFFF"), s("True Black", "#111111"), s("Charcoal", "#36454F"), s("Cool Grey", "#8E949C"), s("Midnight Navy", "#1F2A44"), s("Silver Grey", "#C0C4CA")],
    avoid: [s("Orange", "#F28C28"), s("Camel", "#C19A6B"), s("Mustard", "#C9A227"), s("Rust", "#A8492A"), s("Olive", "#6B6A2E"), s("Peach", "#FFBE98")],
    roles: {
      dark: s("True Black", "#111111"), light: s("Optic White", "#FFFFFF"), mid: s("Charcoal", "#36454F"),
      signature: s("Sapphire", "#0F52BA"), accent: s("Blue Ruby", "#9B111E"), soft: s("Icy Blue", "#CFE8F7"),
      deep: s("Deep Cool Purple", "#5B2C83"), bright: s("Vibrant Fuchsia", "#C71585"), pastel: s("Icy Pink", "#F4D7E6"),
    },
    metals: { best: [s("Platinum", "#E5E4E2"), s("Polished Silver", "#C9CDD2"), s("White Gold", "#E1E1DC")], avoid: ["Yellow gold", "Copper", "Bronze"], finish: "High-polish, mirror bright" },
    gems: ["Sapphire", "Ruby", "Diamond", "Amethyst", "Tanzanite", "White pearl"],
    makeup: {
      foundation: "Light to deep with a cool, pink or neutral-cool undertone",
      lips: [s("Blue Red", "#B3112E"), s("Fuchsia", "#C2185B"), s("Cool Berry", "#8E1F4A")],
      blush: [s("Cool Pink", "#E2718F"), s("Berry", "#B84A70")],
      eyes: [s("Charcoal", "#36454F"), s("Silver", "#BFC3C8"), s("Deep Plum", "#4E2A4F")],
      liner: "Black or deep navy",
      brows: "Cool dark brown to black",
      nails: [s("Blue Red", "#B3112E"), s("Icy Lilac", "#E0D4F2")],
    },
    hair: { best: [s("Blue Black", "#141822"), s("Cool Espresso", "#2B2321"), s("Ash Dark Brown", "#3E3633"), s("Silver/Platinum", "#D9D9D9")], avoid: ["Golden blonde", "Copper", "Caramel"], note: "Cool, inky depth — or striking silver. Avoid warm highlights." },
    prints: "Graphic geometrics, high-contrast stripes, houndstooth, monochrome florals.",
    fabrics: "Sleek and structured — satin, crisp cotton, gabardine, patent, velvet.",
    sisters: ["cool-summer", "deep-winter"],
  },
  {
    id: "deep-winter",
    name: "Deep Winter",
    family: "Winter",
    undertone: "Cool",
    dims: { hue: "Cool-neutral", value: "Deep", chroma: "Clear" },
    tagline: "Intense, dramatic, regal.",
    description:
      "Deep colouring with cool clarity — you wear the darkest, richest jewel tones beautifully: black, port wine, emerald, sapphire. Pale, dusty or warm earthy colours make you look washed out.",
    gradient: ["#1A1423", "#6B0F3A", "#0B6E4F"],
    skin: "#8C5E46",
    contrast: "High",
    palette: [
      s("Port Wine", "#6B0F2A"), s("Emerald", "#00754A"), s("Sapphire", "#0F52BA"), s("Deep Fuchsia", "#A0115E"),
      s("Royal Purple", "#5A2A82"), s("True Red", "#C8102E"), s("Pine", "#01594F"), s("Icy Silver", "#D7DCE0"),
      s("Midnight Blue", "#191970"), s("Deep Teal", "#014D4E"), s("Magenta", "#B0174E"), s("Cool Burgundy", "#5C1A33"),
      s("Electric Blue", "#2A52BE"), s("Icy Violet", "#DDD3F0"), s("Black Cherry", "#3D0C1E"), s("Stark White", "#FAFAFA"),
    ],
    neutrals: [s("True Black", "#111111"), s("Charcoal", "#333333"), s("Stark White", "#FAFAFA"), s("Midnight Navy", "#14213D"), s("Black-Brown", "#2B1E1A"), s("Icy Grey", "#D7DCE0")],
    avoid: [s("Peach", "#FFBE98"), s("Camel", "#C19A6B"), s("Dusty Rose", "#C49A9A"), s("Mustard", "#C9A227"), s("Light Khaki", "#C3B091"), s("Soft Sage", "#A9B49A")],
    roles: {
      dark: s("True Black", "#111111"), light: s("Stark White", "#FAFAFA"), mid: s("Charcoal", "#333333"),
      signature: s("Port Wine", "#6B0F2A"), accent: s("Emerald", "#00754A"), soft: s("Icy Silver", "#D7DCE0"),
      deep: s("Midnight Blue", "#191970"), bright: s("Deep Fuchsia", "#A0115E"), pastel: s("Icy Violet", "#DDD3F0"),
    },
    metals: { best: [s("Silver", "#C9CDD2"), s("Platinum", "#E5E4E2"), s("Gunmetal", "#53565A"), s("Cool Rich Gold", "#C8B273")], avoid: ["Brassy yellow", "Copper"], finish: "Polished, bold, statement" },
    gems: ["Emerald", "Ruby", "Sapphire", "Onyx", "Garnet", "Black pearl"],
    makeup: {
      foundation: "Medium to deep with a neutral or cool undertone",
      lips: [s("Black Cherry", "#5C1A2E"), s("True Red", "#B3112E"), s("Deep Berry", "#7A1E48")],
      blush: [s("Deep Berry", "#A3405F"), s("Plum Rose", "#9A4A64")],
      eyes: [s("Graphite", "#3A3A3F"), s("Emerald", "#00754A"), s("Deep Plum", "#4A1F48")],
      liner: "Black",
      brows: "Dark cool brown to black",
      nails: [s("Port Wine", "#6B0F2A"), s("Black", "#111111")],
    },
    hair: { best: [s("Black", "#111111"), s("Blue Black", "#141822"), s("Dark Espresso", "#2B1E1A"), s("Black Cherry", "#3D0C1E")], avoid: ["Golden blonde", "Copper", "Caramel highlights"], note: "Keep it deep and glossy; a black-cherry gloss is the most daring you need." },
    prints: "Bold graphics, large-scale florals on black, animal prints in black & white.",
    fabrics: "Luxurious and sleek — velvet, satin, leather, brocade, sharp wool.",
    sisters: ["deep-autumn", "cool-winter"],
  },
  {
    id: "bright-winter",
    name: "Bright Winter",
    family: "Winter",
    undertone: "Cool",
    dims: { hue: "Cool-neutral", value: "Medium", chroma: "Bright" },
    tagline: "Electric, high-voltage clarity.",
    description:
      "Clear and vivid with striking contrast, you shine in the most saturated cool colours — hot pink, royal blue, emerald, true red — with crisp black and white. Muted and dusty tones dull your sparkle.",
    gradient: ["#FF1F8E", "#2347FF", "#00C2A8"],
    skin: "#D8AE95",
    contrast: "High",
    palette: [
      s("Hot Pink", "#FF1F8E"), s("Blue-based Red", "#D0103A"), s("Royal Blue", "#2347FF"), s("Cool Emerald", "#00A36C"),
      s("Amethyst", "#8E44AD"), s("Cool Lemon", "#F4F15A"), s("Electric Teal", "#00C2A8"), s("Cobalt", "#0047AB"),
      s("Fuchsia", "#E3007D"), s("Icy Aqua", "#C7F1F0"), s("Violet", "#6A2FD0"), s("Cherry", "#C2003E"),
      s("Turquoise", "#00B4C5"), s("Icy Pink", "#FADADD"), s("Bright Navy", "#1E2F8C"), s("Pure Green", "#00A651"),
    ],
    neutrals: [s("Optic White", "#FFFFFF"), s("True Black", "#111111"), s("Charcoal", "#36383D"), s("Bright Navy", "#1E2F8C"), s("Icy Grey", "#D9DDE2"), s("Cool Taupe", "#7D7476")],
    avoid: [s("Dusty Rose", "#C49A9A"), s("Taupe", "#A3927F"), s("Mustard", "#C9A227"), s("Rust", "#A8492A"), s("Camel", "#C19A6B"), s("Soft Sage", "#A9B49A")],
    roles: {
      dark: s("True Black", "#111111"), light: s("Optic White", "#FFFFFF"), mid: s("Charcoal", "#36383D"),
      signature: s("Hot Pink", "#FF1F8E"), accent: s("Royal Blue", "#2347FF"), soft: s("Icy Aqua", "#C7F1F0"),
      deep: s("Bright Navy", "#1E2F8C"), bright: s("Cool Emerald", "#00A36C"), pastel: s("Icy Pink", "#FADADD"),
    },
    metals: { best: [s("Polished Silver", "#C9CDD2"), s("Platinum", "#E5E4E2"), s("White Gold", "#E1E1DC")], avoid: ["Antique gold", "Copper", "Matte bronze"], finish: "Mirror-polished, sparkling" },
    gems: ["Diamond", "Emerald", "Ruby", "Pink sapphire", "Tanzanite", "Crystal"],
    makeup: {
      foundation: "Light to deep with a neutral-cool undertone",
      lips: [s("Hot Pink", "#E0157E"), s("Cherry Red", "#C2003E"), s("Clear Berry", "#A3125A")],
      blush: [s("Bright Pink", "#F06292"), s("Cool Coral-Pink", "#F2707F")],
      eyes: [s("Black", "#111111"), s("Silver", "#C9CDD2"), s("Sapphire", "#1E3FA8")],
      liner: "Black, sharp",
      brows: "Defined dark brown to black",
      nails: [s("Cherry", "#C2003E"), s("Hot Pink", "#FF1F8E")],
    },
    hair: { best: [s("Black", "#111111"), s("Dark Cool Brown", "#2E2523"), s("Espresso", "#2B2321"), s("Icy Platinum", "#E5E4E2")], avoid: ["Mousy brown", "Golden caramel", "Copper"], note: "High-contrast and glossy. Dark and dramatic, or ice-bright — never in between." },
    prints: "Pop-art, bold colour-block, graphic florals and crisp polka dots.",
    fabrics: "High shine and crisp — satin, patent, sequins, sharp cotton, scuba.",
    sisters: ["bright-spring", "cool-winter"],
  },
];

export const SEASON_BY_ID = Object.fromEntries(SEASONS.map((x) => [x.id, x])) as Record<string, Season>;
export const SEASON_BY_NAME = Object.fromEntries(SEASONS.map((x) => [x.name, x])) as Record<string, Season>;
export const FAMILIES: Family[] = ["Spring", "Summer", "Autumn", "Winter"];
export const seasonId = (name: string) => SEASON_BY_NAME[name]?.id ?? name.toLowerCase().replace(/\s+/g, "-");
export const gradientCss = (g: string[], angle = 135) => `linear-gradient(${angle}deg, ${g.join(", ")})`;

export const UNDERTONE_COPY: Record<Undertone, { title: string; body: string; metals: string }> = {
  Warm: { title: "Warm undertone", body: "Golden, peachy or olive-gold beneath the surface. Colours with a yellow base harmonise with you.", metals: "Gold, brass, copper and bronze" },
  Cool: { title: "Cool undertone", body: "Pink, rosy or blue beneath the surface. Colours with a blue base harmonise with you.", metals: "Silver, platinum and white gold" },
  Neutral: { title: "Neutral undertone", body: "A balance of warm and cool. You can borrow from both sides — choose softened, balanced shades.", metals: "Both — rose gold is your sweet spot" },
};

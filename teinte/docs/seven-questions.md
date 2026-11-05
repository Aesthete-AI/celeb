# The questionnaire, in full

The no-photo route. The stylist chat runs it whenever someone asks a question without having scanned,
and the analyse page offers it as a fallback. One preliminary question sets the lookbook, then **seven**
questions place the person on the three axes of the 12-season system.

| Axis | What it measures | Positive end | Negative end |
|---|---|---|---|
| **Temperature** | the undertone of the skin | Warm (golden/peach) | Cool (pink/blue) |
| **Value** | how light or deep the colouring is | Light | Deep |
| **Chroma** | how clear or muted it is | Bright / clear | Soft / greyed |

Every option carries a score on one or more axes. Blank means that option says nothing about that axis.
The swatch column is the colour dot shown beside the answer in the chat.

---

## Preliminary · `gender` — whose looks to show

> **First — whose looks should I show you?**

| # | Answer | Effect |
|---|---|---|
| 1 | **Women's looks** | sets the lookbook to `female` |
| 2 | **Men's looks** | sets the lookbook to `male` |
| 3 | **Show me both** | sets the lookbook to `all` |

Nothing here touches the colour axes — it only decides whether the edit opens on
women's looks, men's looks or both.

---

## Question 1 of 7 · `veins`

> **In daylight, what colour are the veins on your inner wrist?**

*Why it is asked: Vein colour is a quick read on undertone.*

| # | Answer | Swatch | Temperature | Value | Chroma |
|---|---|---|---|---|---|
| 1 | **Green or olive** | `#6B8E4E` | **+1** | — | — |
| 2 | **Blue or purple** | `#4A5FA8` | **-1** | — | — |
| 3 | **A mix / hard to tell** | `#5E7A86` | 0 | — | — |

---

## Question 2 of 7 · `metal`

> **Which metal makes your skin look healthiest?**

| # | Answer | Swatch | Temperature | Value | Chroma |
|---|---|---|---|---|---|
| 1 | **Gold** | `#D4AF37` | **+1** | — | — |
| 2 | **Silver** | `#C0C4CA` | **-1** | — | — |
| 3 | **Both work** | `#E1A98C` | 0 | — | — |

---

## Question 3 of 7 · `sun`

> **How does your skin react to the sun?**

| # | Answer | Swatch | Temperature | Value | Chroma |
|---|---|---|---|---|---|
| 1 | **Burns easily, rarely tans** | — | **-0.4** | **+0.8** | — |
| 2 | **Burns a little, then tans** | — | 0 | **+0.2** | — |
| 3 | **Tans easily to golden** | — | **+0.7** | **-0.3** | — |
| 4 | **Deepens easily, rarely burns** | — | **+0.2** | **-0.9** | — |

---

## Question 4 of 7 · `hair`

> **What's your natural hair colour (before any dye)?**

| # | Answer | Swatch | Temperature | Value | Chroma |
|---|---|---|---|---|---|
| 1 | **Golden or strawberry blonde** | `#D7B06C` | **+0.8** | **+1** | — |
| 2 | **Ash blonde / light ash brown** | `#B7A58C` | **-0.7** | **+0.7** | **-0.4** |
| 3 | **Red, copper or auburn** | `#A8492A` | **+1** | 0 | — |
| 4 | **Medium soft brown** | `#7F6E60` | — | 0 | **-0.7** |
| 5 | **Dark chocolate brown** | `#4A2C20` | **+0.3** | **-0.8** | — |
| 6 | **Black / blue-black** | `#141822` | **-0.3** | **-1** | **+0.4** |

---

## Question 5 of 7 · `eyes`

> **And your eyes?**

| # | Answer | Swatch | Temperature | Value | Chroma |
|---|---|---|---|---|---|
| 1 | **Bright blue, green or turquoise** | `#2E8FB3` | — | — | **+1** |
| 2 | **Soft grey, grey-blue or grey-green** | `#8A9A9A` | **-0.3** | — | **-0.8** |
| 3 | **Hazel or green-gold** | `#8E7B3A` | **+0.7** | — | **-0.3** |
| 4 | **Warm or golden brown** | `#8B5A2B` | **+0.6** | **-0.3** | — |
| 5 | **Very dark brown / black** | `#2B1E1A` | — | **-0.8** | **+0.5** |

---

## Question 6 of 7 · `white`

> **Next to your face, which looks better?**

| # | Answer | Swatch | Temperature | Value | Chroma |
|---|---|---|---|---|---|
| 1 | **Crisp optic white** | `#FFFFFF` | **-0.5** | — | **+0.6** |
| 2 | **Soft ivory or cream** | `#F3E6CC` | **+0.5** | — | **-0.3** |
| 3 | **Not sure** | — | — | — | — |

---

## Question 7 of 7 · `contrast`

> **How would you describe the contrast between your hair, skin and eyes?**

| # | Answer | Swatch | Temperature | Value | Chroma |
|---|---|---|---|---|---|
| 1 | **Soft & blended**<br><sub>everything is close in depth</sub> | — | — | — | **-0.8** |
| 2 | **Medium** | — | — | — | 0 |
| 3 | **Striking**<br><sub>e.g. dark hair, light skin, bright eyes</sub> | — | — | **-0.2** | **+0.9** |

---

## How the answers become a season

1. **Average each axis** over the questions that actually scored it — a mean, not a running total, so
   leaving an axis untouched never drags it toward zero. Temperature can be fed by six of the seven
   questions (veins, metal, sun, hair, eyes, white), value by four (sun, hair, eyes, contrast) and
   chroma by four (hair, eyes, white, contrast). How many apply depends on which answers are chosen.
2. **Stretch and weight.** The averages are scaled (temperature ×1.6, value ×1.4, chroma ×1.4) and the
   temperature difference is weighted 1.4× in the distance, because more questions inform it.
3. **Find the nearest season.** Each of the 12 seasons sits at a fixed point in the same space:

| Season | Temperature | Value | Chroma |
|---|---|---|---|
| Light Spring | 0.5 | 1 | 0.3 |
| Warm Spring | 1 | 0.3 | 0.4 |
| Bright Spring | 0.4 | 0.2 | 1 |
| Light Summer | -0.5 | 1 | -0.3 |
| Cool Summer | -1 | 0.3 | -0.3 |
| Soft Summer | -0.4 | 0 | -1 |
| Soft Autumn | 0.4 | 0 | -1 |
| Warm Autumn | 1 | -0.3 | -0.3 |
| Deep Autumn | 0.4 | -1 | 0 |
| Deep Winter | -0.4 | -1 | 0.2 |
| Cool Winter | -1 | -0.4 | 0.5 |
| Bright Winter | -0.4 | -0.2 | 1 |

4. **Rank them.** Distances become weights via `exp(−distance × 2.2)`, normalised. The closest season is
   the result, its weight is the confidence, and the next three appear as the runners-up in the UI.
5. **Undertone** is read straight off the averaged temperature: **Warm** above +0.25, **Cool** below −0.25,
   **Neutral** in between.

The result is saved exactly like a scan result, so the stylist answers from it immediately — the only
difference is that the profile is marked `source: "quiz"` rather than `"scan"`.

Source of truth: `frontend/src/data/quiz.ts` (`QUIZ` and `scoreQuiz()`), read 27 October 2026.

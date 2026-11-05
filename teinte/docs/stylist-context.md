# What the stylist is told (captured, not reconstructed)

Captured live from the running app on 27 October 2026: a real scan of a photo, then the
question *"What should I wear to a party this weekend?"* asked on the **Party & Occasion** edit.
This is the exact `context` field the browser posts to `/api/chat`.

Two things go to the model on every question, and **the photo is not one of them**:

1. **A fixed instruction block** (`SYSTEM` in `backend/server.py`) — who the stylist is, the house format,
   and the rule to end with one follow-up question. Identical for every user.
2. **The client context below** — built in `frontend/src/lib/stylist.ts` by `buildContext()` from the
   scan result and the page on screen. Nothing else; no image, no name, no photo.

```text
Colour profile: Autumn · Warm undertone — Spiced, earthy and golden. 12-season detail: Deep Autumn.
Source: AI photo analysis (season confidence 44%).
Rules: Your warm undertone is your cue for yellow gold and warmer shades such as cream, coral and olive. As an Autumn, go medium-to-deep and rich — earthy, spiced and toasted, never icy or neon.
Best colours: Rust (#B7471F), Mustard (#D4A017), Olive (#708238), Terracotta (#C8643B), Pumpkin (#E07B25), Teal (#1E6F6C), Forest (#33582F), Bronze (#9C6B30). Neutrals: Cream (#F3E6CC), Camel (#BF8F55), Coffee (#5E4027), Khaki (#A89A6A). Avoid: Icy Pink (#F4D7E6), Cool Grey (#8E949C), Fuchsia (#E3007D), Black (#111111).
Metals: Yellow Gold, Antique Gold, Copper. Gems: Amber, Topaz, Tiger's eye, Carnelian.
Makeup: lips Brick (#A4442A), Terracotta (#B8603F), Warm Nude (#A86A4F); blush Terracotta (#C26A4A), Apricot (#D88A5F); eyes Copper (#B06A35), Olive (#6E6E33), Bronze (#8E6430).
Hair colours: Auburn (#8A3B1F), Copper (#B0522A), Chestnut (#7A4626).
Looks requested for: women.
The client is viewing: Party & Occasion edit.
Category rule for Party & Occasion: Your most magnetic shades — rust, pumpkin or teal — in a fabric with a little shine, finished with yellow gold.
Photos on screen (refer to them by their matching colour): #1 style, fashion — matches Rust; #2 style, fashion, chair, sequins, glitter, sparkle — matches Bronze; #3 watermelon, fashion, dress, red, green, watermelon decor — matches Rust; #4 style, fashion — matches Bronze; #5 fashion, disco ball, sparkle, mirror, entertainment, pink; #6 fashion, makeup — matches Bronze.
```

1598 characters, ~399 tokens. One full answer measures 951 input + 204 output tokens.

## Where each line comes from

| Line | Source |
|---|---|
| Colour profile / 12-season detail | the scan: `engine.analyse()` → `profile`, `season` |
| Source + confidence | whether it came from the photo or the questionnaire |
| Rules | `backend/catalog/rules.py` — the undertone rule and the season rule, joined |
| Best colours / Neutrals / Avoid | the 12-profile palette database |
| Metals / Gems / Makeup / Hair | the same database |
| Looks requested for | Women / Men / Both, set by the scan's gender read |
| The client is viewing | the page open behind the chat |
| Category rule | the "why" line for that category in `rules.py` |
| Photos on screen | the ranked photos actually rendered, each with the palette colour it matches |

The last line is what lets the stylist say "the rust dress, second from the left" instead of inventing
clothes. Stock-library tags are cleaned first (deduped, capped at six, with SEO filler such as
"hot girl" and "indian model" stripped) — that alone cut the context from 2,324 to 1,598 characters.

## If you ever do want it switched off

`buildContext()` returns the no-profile string when `profile` is null, so the honest way to demo a
cold start is `?reset`, not deleting the context. Removing the context would leave the stylist
guessing colours — it would still skip the questions, because that gate reads the saved profile
(`if (!profile)` in `ChatPanel.tsx`), not the context.

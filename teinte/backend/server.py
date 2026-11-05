"""
Teinte API.

  GET  /api/health    engine state (starting / loading n of 12 / ready / demo / error) + chat providers
  POST /api/analyze   1-5 head crops (multipart "photos") -> undertone, season, regions, colour twins
  POST /api/chat      stylist chat, streamed as Server-Sent Events from the first LLM provider that answers

Photos are decoded in memory, analysed and dropped; nothing is written to disk or logged.

  uvicorn server:app --host 0.0.0.0 --port 8000
  TEINTE_DEMO=1 uvicorn server:app ...   (no backbones; labelled stand-in results for UI work)
"""
import asyncio
import json
import os
import threading
import time
from collections import defaultdict, deque

import cv2
import httpx
import numpy as np
from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from engine import Engine
from speech import SR as STT_SR, stt

HERE = os.path.dirname(os.path.abspath(__file__))
DIST = os.environ.get("TEINTE_DIST", os.path.join(HERE, "..", "frontend", "dist"))
MAX_PHOTOS, MAX_BYTES = 5, 8 * 1024 * 1024

# ------------------------------------------------------------------ LLM providers (all have free tiers)
# Each is OpenAI-compatible. The chain is tried in order; a provider is skipped when its key is unset,
# and the next model / provider is tried on a rate limit or outage. Free model line-ups change often, so
# each provider takes an ordered, comma-separated model list (override with <PROVIDER>_MODEL).
PROVIDERS = {
    "gemini": dict(base="https://generativelanguage.googleapis.com/v1beta/openai",
                   key="GEMINI_API_KEY", model=os.environ.get("GEMINI_MODEL", "gemini-3.5-flash,gemini-flash-latest")),
    "groq": dict(base="https://api.groq.com/openai/v1",
                 key="GROQ_API_KEY", model=os.environ.get("GROQ_MODEL", "openai/gpt-oss-120b,openai/gpt-oss-20b")),
    "openrouter": dict(base="https://openrouter.ai/api/v1",
                       key="OPENROUTER_API_KEY", model=os.environ.get("OPENROUTER_MODEL", "openrouter/free")),
    "ollama": dict(base=os.environ.get("OLLAMA_BASE", "http://localhost:11434/v1"),
                   key="OLLAMA_ENABLED", model=os.environ.get("OLLAMA_MODEL", "qwen3:8b")),
}
CHAIN = [p.strip() for p in os.environ.get("LLM_CHAIN", "gemini,groq,openrouter,ollama").split(",") if p.strip()]


def active_providers():
    return [n for n in CHAIN if n in PROVIDERS and os.environ.get(PROVIDERS[n]["key"])]


FIRST_TOKEN_TIMEOUT = float(os.environ.get("LLM_FIRST_TOKEN_TIMEOUT", "8"))    # seconds to wait for first token
COOLDOWN = {}   # (provider, model) → time.time() until which it is skipped
COOLDOWN_429 = float(os.environ.get("LLM_COOLDOWN_429", "120"))   # rate-limit: skip for 2 min
COOLDOWN_503 = float(os.environ.get("LLM_COOLDOWN_503", "30"))    # overloaded: skip for 30 s


def attempts():
    """(provider, model) pairs in order; cooled-down models go last so a live one is always tried first."""
    pairs = [(n, m.strip()) for n in active_providers() for m in PROVIDERS[n]["model"].split(",") if m.strip()]
    now = time.time()
    return [p for p in pairs if COOLDOWN.get(p, 0) <= now] + [p for p in pairs if COOLDOWN.get(p, 0) > now]


# Short connect timeout (4 s) so a dead host fails fast and we try the next model quickly.
HTTP = httpx.AsyncClient(timeout=httpx.Timeout(30, connect=4), limits=httpx.Limits(max_keepalive_connections=10))


# ------------------------------------------------------------------ app
engine = Engine(demo=os.environ.get("TEINTE_DEMO") == "1")
app = FastAPI(title="Teinte API", version="1.0")
app.add_middleware(CORSMiddleware, allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
                   allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
def _start():
    threading.Thread(target=engine.load, daemon=True).start()
    # the microphone's speech model loads after the colour engine, so a cold start serves analysis first
    threading.Thread(target=lambda: (engine_ready_wait(), stt.load()), daemon=True).start()


def engine_ready_wait(timeout=600):
    t0 = time.time()
    while engine.state in ("starting", "loading") and time.time() - t0 < timeout:
        time.sleep(1)


# simple per-IP sliding-window limiter: enough to stop a script hammering the GPU or the free LLM quota
_hits = defaultdict(deque)


def limited(request: Request, bucket: str, n: int, per: float):
    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "?").split(",")[0]
    q, now = _hits[(bucket, ip)], time.time()
    while q and now - q[0] > per:
        q.popleft()
    if len(q) >= n:
        raise HTTPException(429, "Too many requests - please wait a moment.")
    q.append(now)


@app.get("/api/health")
def health():
    # return dict(engine=engine.state, loaded=engine.loaded, total=engine.total, device=engine.device,
    #             error=engine.error, chat=active_providers(),
    #             accuracy=(engine.bundle or {}).get("oof_accuracy"),
    #             config=(engine.bundle or {}).get("config"))
    # Public endpoint: only whether the service is ready. How it works (models, hardware, accuracy, chat
    # provider) is never exposed to visitors — check the server log for those.
    return dict(engine=engine.state, chat=bool(active_providers()))


@app.post("/api/analyze")
async def analyze(request: Request, photos: list[UploadFile] = File(...)):
    limited(request, "analyze", 12, 60)
    if engine.state not in ("ready", "demo"):
        # msg = {"loading": f"The analysis engine is warming up ({engine.loaded}/{engine.total} models loaded).",
        #        "starting": "The analysis engine is starting."}.get(engine.state, "The analysis engine is unavailable.")
        msg = ("We're getting ready — please try again in a few seconds." if engine.state in ("loading", "starting")
               else "Photo analysis is unavailable right now — try the seven questions instead.")
        raise HTTPException(503, msg)
    if not 1 <= len(photos) <= MAX_PHOTOS:
        raise HTTPException(400, f"Send between 1 and {MAX_PHOTOS} photos.")
    images = []
    for p in photos:
        raw = await p.read(MAX_BYTES + 1)
        if len(raw) > MAX_BYTES:
            raise HTTPException(413, "Each photo must be under 8 MB.")
        img = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
        del raw
        if img is None or min(img.shape[:2]) < 96:
            raise HTTPException(400, "One of the photos could not be read.")
        images.append(img)
    try:
        result = await run_in_threadpool(engine.analyse, images)
    except ValueError:
        raise HTTPException(422, "We couldn't find your face, hair and neck clearly. Try a brighter, front-facing photo.")
    finally:
        del images
    return JSONResponse(result)


# ------------------------------------------------------------------ chat
class Msg(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(max_length=4000)


class ChatIn(BaseModel):
    messages: list[Msg] = Field(min_length=1, max_length=30)
    context: str = Field("", max_length=12000)   # profile, palette and on-screen looks, built by the client
    # "structured" — the Studio interface's compact, sectioned answers; "prose" — the Previous interface
    format: str = Field("prose", pattern="^(prose|structured)$")


SYSTEM = """You are Teinte, a warm, precise personal stylist and colour analyst specialising in seasonal colour \
analysis (12 seasons) and skin undertone.

CRITICAL RULE — Answer ONLY what was asked. Read the question carefully:
• If the question is about ONE specific item (lipstick, ring, necklace, earrings, bag, shoes, foundation, \
  blush, hairstyle, beard, watch, tie…) → answer ONLY about that item in 3–6 sentences. No extra sections.
• If the question is about a FULL LOOK for an occasion (party, office, wedding, date, vacation…) → use 2–3 \
  relevant bold sections maximum (e.g. **Outfit**, **Shoes & bag**, **Jewellery** OR **Makeup**, never all).
• If the question asks about colour matching (does X work for me? which shade of Y?) → answer the colour \
  question directly and concisely with hex codes.
• If the question is about a specific GARMENT or item the client is looking at → tell them whether it works \
  for their season, what palette swatch it matches, and one pairing suggestion.
• Do NOT pad with generic advice the client did not ask for.

Additional rules:
- All colour names must be specific and evocative ("warm terracotta", "dusty rose", not just "red"). Include \
  the hex the first time each distinct colour is mentioned, e.g. warm terracotta (#b85d38).
- Adapt to the client's gender (stated in context) and the occasion. Respect cultural dress when mentioned.
- Keep the total response under 160 words. Short and specific beats long and generic.
- End with exactly one natural follow-up question tailored to the client's specific question.
- Stay on style, beauty and wardrobe topics; politely redirect if asked anything else.
- Never claim to see the client's photo; you only know the analysis results in the context.
- Never mention AI, models, algorithms or how the analysis works.
- After your answer, on a new final line, output <<FOLLOWUPS>> followed by a JSON array of 3 short replies \
  the CLIENT might tap next (each under 60 characters, written in the client's voice). Nothing after it.

Client context
{context}"""


async def stream_provider(name, model, messages):
    p = PROVIDERS[name]
    headers = {"Authorization": f"Bearer {os.environ.get(p['key'])}", "Content-Type": "application/json"}
    if name == "openrouter":
        headers.update({"HTTP-Referer": os.environ.get("PUBLIC_URL", "http://localhost"), "X-Title": "Teinte"})
    # body = dict(model=model, messages=messages, stream=True, temperature=0.7, max_tokens=1200)
    # Gemini 3.x counts its hidden reasoning against max_tokens: at 1200 a wedding answer used ~1150
    # thinking tokens and was cut off mid-line. 4000 leaves room; "low" effort halves the latency.
    body = dict(model=model, messages=messages, stream=True, temperature=0.7, max_tokens=4000)
    if name == "gemini" and os.environ.get("GEMINI_REASONING", "low"):
        body["reasoning_effort"] = os.environ.get("GEMINI_REASONING", "low")
    async with HTTP.stream("POST", f"{p['base']}/chat/completions", headers=headers, json=body) as r:
        if r.status_code != 200:
            if r.status_code == 429:
                COOLDOWN[(name, model)] = time.time() + COOLDOWN_429
            elif r.status_code == 503:
                COOLDOWN[(name, model)] = time.time() + COOLDOWN_503
            raise RuntimeError(f"{name} {r.status_code}: {(await r.aread())[:200]!r}")
        lines = r.aiter_lines()
        first = True
        while True:
            try:
                # only the wait for the FIRST word is bounded; a long answer may take as long as it needs
                line = await (asyncio.wait_for(lines.__anext__(), FIRST_TOKEN_TIMEOUT) if first else lines.__anext__())
            except StopAsyncIteration:
                break
            except asyncio.TimeoutError:
                raise RuntimeError(f"{name} {model}: no output within {FIRST_TOKEN_TIMEOUT:.0f}s")
            if not line.startswith("data:"):
                continue
            data = line[5:].strip()
            if data == "[DONE]":
                break
            try:
                delta = json.loads(data)["choices"][0]["delta"].get("content") or ""
            except (KeyError, IndexError, json.JSONDecodeError):
                continue
            if delta:
                first = False
                yield delta

# The Studio interface renders answers as a verdict plus labelled sections with photo references, so it
# asks for a strict, compact shape instead of prose. The Previous interface keeps SYSTEM unchanged.
SYSTEM_STRUCTURED_V1 = """   # superseded below: one fixed shape for every question
You are Teinte, a precise personal stylist and colour analyst specialising in seasonal \
colour analysis (12 seasons) and skin undertone. You answer like a stylist's notes: structured, concise, exact.

Reply in EXACTLY this shape and nothing else:
1. First line: a one-sentence verdict, at most 18 words. No heading, no greeting.
2. Then 2–4 sections (only 1–2 if the question is about a single item). Each section starts on its own line \
   with "## " and a label of 1–3 words, chosen to fit the question — e.g. ## Outfit, ## Colours, ## Shoes & bag, \
   ## Jewellery, ## Makeup, ## Hair, ## Grooming, ## Avoid.
3. Under each section, 1–3 bullet lines in the form "- Key: value". Key is 1–3 words (e.g. Top, Bottom, \
   Lips, Metal, Shade). Value is at most 12 words and names a specific garment or product and its colour.
4. Give the hex the first time each distinct colour appears, e.g. warm terracotta (#B85D38). Colour names are \
   specific and evocative ("dusty rose", never just "pink"), and every colour comes from the client's palette.
5. Include a "## Avoid" section only when it genuinely helps; it lists colours from the client's avoid list.

Never write paragraphs, preambles, closing questions or generic advice. Never exceed 110 words before the \
follow-ups. Adapt to the client's gender (stated in context) and occasion; respect cultural dress when \
mentioned. Stay on style, beauty and wardrobe. Never claim to see the client's photo — you only know the \
analysis results in the context.

After the answer, on a new final line, output <<FOLLOWUPS>> followed by a JSON array of 3 short replies the \
CLIENT might tap next (each under 50 characters, in the client's voice). Nothing after it.

Client context
{context}"""


# The Studio's answers: always organised, never a paragraph — but the SHAPE follows the question.
SYSTEM_STRUCTURED = """You are Teinte, a precise personal stylist and colour analyst (seasonal colour and skin \
undertone). You answer like a stylist's notes: organised, concise and exact — never a block of prose.

Start with ONE verdict line (at most 18 words, no heading, no greeting) that directly answers the question.
Then choose the shape that best fits THIS question — do not reuse the same shape for every answer:

• Full look for an occasion (wedding, party, office, date, trip) → 2–4 sections, each "## Label" (pick labels that \
  fit: Outfit, Layer, Shoes & bag, Jewellery, Hair, Makeup, Grooming…), with rows "- Key: value".
• One item or shade (lipstick, watch, hair colour, foundation) → a ranked list "1. …", "2. …", "3. …", each \
  "shade or product (#hex) — when or why to wear it". No sections unless genuinely needed.
• A choice between options (gold or silver, saree or lehenga, black or navy) → the verdict names the winner, then \
  a markdown comparison table with a header row: | | Option A | Option B | and 3–4 rows of criteria. Then one \
  line "> Tip: …".
• "Does this work for me?" about a garment or colour → "## Why" with 2 bullets "- …", then "## Pair it with" \
  with 2 bullets.
• A routine or how-to (makeup routine, grooming, how to style something) → numbered steps "1. …" (3–5 steps), \
  optionally one "> Tip: …".
• Which colours suit me / palette questions → sections such as "## Wear most", "## Neutrals", "## Keep away" \
  with bullets "- colour (#hex) — where it works".
• Packing lists or capsule wardrobes → sections per group (Tops, Bottoms, Shoes…) with short bullets.

Rules for every shape:
- Bullets and rows are at most 14 words. No paragraphs, preambles, closing questions or generic advice.
- Give the hex the first time each distinct colour appears, e.g. warm terracotta (#B85D38). Colour names are \
  specific and evocative, and every recommended colour comes from the client's palette.
- Add a "keep away" / avoid part only when it genuinely helps the question.
- Keep the whole answer under 120 words before the follow-ups.
- Adapt to the client's gender (stated in context) and occasion; respect cultural dress when mentioned.
- Stay on style, beauty and wardrobe. Never claim to see the client's photo; you only know the analysis results.
- Never mention AI, models, algorithms or how the analysis works.

After the answer, on a new final line, output <<FOLLOWUPS>> followed by a JSON array of 3 short replies the \
CLIENT might tap next (each under 50 characters, in the client's voice). Nothing after it.

Client context
{context}"""


@app.post("/api/transcribe")
async def transcribe(request: Request):
    """Search-box microphone: raw 16 kHz mono int16 PCM in, text out. Called about once a second while the
    person speaks (live text) and once when they stop. Audio is transcribed in memory and discarded."""
    limited(request, "transcribe", 240, 60)
    if stt.state != "ready":
        raise HTTPException(503, "Voice input is getting ready — try again in a few seconds."
                            if stt.state in ("idle", "loading") else "Voice input is unavailable right now.")
    body = await request.body()
    if len(body) > STT_SR * 2 * 65:
        raise HTTPException(413, "That recording is too long — keep it under a minute.")
    audio = np.frombuffer(body[: len(body) // 2 * 2], dtype=np.int16).astype(np.float32) / 32768.0
    return await run_in_threadpool(stt.transcribe, audio)


@app.post("/api/chat")
async def chat(body: ChatIn, request: Request):
    limited(request, "chat", 20, 60)
    providers = active_providers()
    if not providers:
        return JSONResponse({"error": "no_llm", "detail": "No chat model is configured on the server."}, 503)
    system = SYSTEM_STRUCTURED if body.format == "structured" else SYSTEM
    messages = [{"role": "system", "content": system.format(context=body.context or "(no profile yet)")}]
    messages += [m.model_dump() for m in body.messages[-16:]]

    async def events():
        for name, model in attempts():
            sent = False
            try:
                async for delta in stream_provider(name, model, messages):
                    sent = True
                    yield f"data: {json.dumps({'delta': delta})}\n\n"
                if sent:
                    yield f"data: {json.dumps({'done': True, 'provider': model, 'model': model, 'via': name})}\n\n"
                    return
            except Exception as e:
                print("chat provider failed:", name, model, str(e)[:200], flush=True)
                if sent:      # mid-answer failure: close what we have rather than repeat it
                    yield f"data: {json.dumps({'done': True, 'provider': name, 'truncated': True})}\n\n"
                    return
            await asyncio.sleep(0)
        yield f"data: {json.dumps({'error': 'all_providers_failed'})}\n\n"

    return StreamingResponse(events(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


# ------------------------------------------------------------------ recommendation catalogue
# Served from frontend/public/catalog so a running ingest publishes new photos without a rebuild.
CATALOG = os.path.abspath(os.path.join(HERE, "..", "frontend", "public", "catalog"))


@app.get("/catalog/{name}.json")
def catalog(name: str):
    path = os.path.join(CATALOG, f"{name}.json")
    if not name.replace("-", "").isalpha() or not os.path.isfile(path):
        raise HTTPException(404, "No catalogue for this profile yet.")
    return FileResponse(path, media_type="application/json", headers={"Cache-Control": "public, max-age=300"})


# self-hosted catalogue photos (Pixabay forbids hotlinking)
MEDIA = os.path.abspath(os.path.join(HERE, "..", "frontend", "public", "media"))
os.makedirs(MEDIA, exist_ok=True)
app.mount("/media", StaticFiles(directory=MEDIA), name="media")


# ------------------------------------------------------------------ the built React app (single deployable)
if os.path.isdir(DIST):
    app.mount("/assets", StaticFiles(directory=os.path.join(DIST, "assets")), name="assets")

    @app.get("/{path:path}")
    def spa(path: str):
        f = os.path.join(DIST, path)
        if path and os.path.isfile(f) and os.path.realpath(f).startswith(os.path.realpath(DIST)):
            return FileResponse(f)
        return FileResponse(os.path.join(DIST, "index.html"))

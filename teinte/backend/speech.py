"""Speech to text for the search box's microphone — Whisper large-v3-turbo on our own GPU.

The browser records 16 kHz mono PCM and posts it here, repeatedly while the person speaks (for live text) and
once more when they stop (the final, most accurate pass). Audio is transcribed in memory and discarded; it is
never stored and never sent to any third party.
"""
import os
import threading
import time
import zlib

import numpy as np
import torch

MODEL = os.environ.get("TEINTE_STT_MODEL", "openai/whisper-large-v3-turbo")
LANGUAGE = os.environ.get("TEINTE_STT_LANGUAGE", "en")      # "" = detect per clip
SR = 16000
MAX_SECONDS = 60

# Whisper "hears" these in silence or noise; drop them when the clip is quiet
HALLUCINATIONS = {"thank you.", "thank you", "thanks for watching!", "thanks for watching.", "you", ".", "bye.",
                  "thank you for watching.", "subtitles by the amara.org community"}


class Transcriber:
    def __init__(self):
        self.state, self.error = "idle", None
        self.lock = threading.Lock()
        self.pipe = None

    def load(self):
        if self.state in ("loading", "ready"):
            return
        self.state = "loading"
        try:
            from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor, pipeline
            dev = "cuda" if torch.cuda.is_available() else "cpu"
            dtype = torch.float16 if dev == "cuda" else torch.float32
            model = AutoModelForSpeechSeq2Seq.from_pretrained(MODEL, torch_dtype=dtype, low_cpu_mem_usage=True).to(dev).eval()
            proc = AutoProcessor.from_pretrained(MODEL)
            self.pipe = pipeline("automatic-speech-recognition", model=model, tokenizer=proc.tokenizer,
                                 feature_extractor=proc.feature_extractor, torch_dtype=dtype, device=dev)
            self.transcribe(np.zeros(SR, np.float32))     # warm-up: the first real request is then fast
            self.state = "ready"
            print(f"speech: {MODEL} ready on {dev}", flush=True)
        except Exception as e:                            # chat and analysis keep working without the mic
            self.state, self.error = "error", str(e)[:300]
            print("speech: failed to load —", self.error, flush=True)

    def transcribe(self, audio: np.ndarray) -> dict:
        audio = audio[: SR * MAX_SECONDS]
        dur = len(audio) / SR
        rms = float(np.sqrt(np.mean(audio ** 2))) if len(audio) else 0.0
        if dur < 0.3 or rms < 0.004:                     # too short or silent: nothing to transcribe
            return dict(text="", seconds=round(dur, 2), ms=0)
        peak = float(np.abs(audio).max())
        if peak > 0:
            audio = (audio / peak * 0.9).astype(np.float32)   # quiet microphones → full scale
        # people speak at most ~4 words (≈6 tokens) a second: a budget from the clip length stops Whisper's
        # known failure of looping one phrase over a near-silent snippet
        kw = dict(task="transcribe", max_new_tokens=int(12 + dur * 7), no_repeat_ngram_size=0)
        if LANGUAGE:
            kw["language"] = LANGUAGE
        t0 = time.perf_counter()
        with self.lock, torch.inference_mode():
            out = self.pipe({"raw": audio, "sampling_rate": SR}, generate_kwargs=kw,
                            chunk_length_s=30 if dur > 30 else None, batch_size=4)
        text = out["text"].strip()
        if text.lower() in HALLUCINATIONS and rms < 0.02:
            text = ""
        if looping(text):                                 # "I'm sorry. I'm sorry. I'm sorry. …"
            text = ""
        return dict(text=text, seconds=round(dur, 2), ms=round((time.perf_counter() - t0) * 1000))


def looping(text: str) -> bool:
    """Whisper's repetition failure: real speech never compresses this well (same test Whisper itself uses)."""
    b = text.encode()
    return len(b) > 40 and len(b) / max(1, len(zlib.compress(b))) > 2.4


stt = Transcriber()

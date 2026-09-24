"""FastAPI server for the plant disease advisory PWA.

Run from the project root:
    .venv/Scripts/python -m uvicorn main:app --app-dir backend --host 0.0.0.0 --port 8000

Binding to 0.0.0.0 is deliberate: judges open the app on their own phone over
the same Wi-Fi, so the server has to be reachable from the LAN, not just localhost.
"""

from __future__ import annotations

import hashlib
import os
import socket
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal

from dotenv import load_dotenv

# Must run before `ai` is imported: the assistant reads GROQ_API_KEY at import.
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from fastapi import FastAPI, File, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

import advice
import outbreaks
import weather
from ai import AIRequestError, AIUnavailableError, assistant, build_advisory
from inference import (
    CONFIDENCE_THRESHOLD,
    SUPPORTED_LANGUAGES,
    ModelNotTrainedError,
    predictor,
)

BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR.parent / "frontend"
TTS_CACHE_DIR = BASE_DIR / "data" / "tts_cache"
TTS_CACHE_DIR.mkdir(parents=True, exist_ok=True)

MAX_UPLOAD_BYTES = 12 * 1024 * 1024  # phone photos are ~2-5 MB; 12 MB is generous
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}
MAX_AUDIO_BYTES = 5 * 1024 * 1024  # 30 s of opus is ~250 KB
AUDIO_EXTENSIONS = {"audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "mp4",
                    "audio/mpeg": "mp3", "audio/wav": "wav", "audio/x-m4a": "m4a"}
LANG_PATTERN = "^(mr|hi|en)$"


@asynccontextmanager
async def lifespan(_: FastAPI):
    warm_model()
    if assistant.enabled:
        for model in await assistant.missing_models():
            print(f"[warn] Groq model '{model}' is not available to this key - "
                  "set a current one in .env (https://console.groq.com/docs/models)")
    yield


app = FastAPI(
    title="Plant Disease Advisory API",
    description="CNN leaf-disease diagnosis with remedies in Marathi, Hindi and English, "
                "plus an optional Groq-powered assistant.",
    version="2.0.0",
    lifespan=lifespan,
)

# The PWA is served from this same origin in normal use. CORS stays open so the
# frontend can also be run from a separate dev server while you build it.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def warm_model() -> None:
    """Load the checkpoint at boot so the first farmer does not wait for it."""
    try:
        predictor.load()
        acc = predictor.metrics.get("val_accuracy")
        print(f"[ok] model loaded: {predictor.arch}, {len(predictor.class_names)} classes"
              + (f", val acc {acc:.2%}" if isinstance(acc, (int, float)) else ""))
    except ModelNotTrainedError as exc:
        print(f"[warn] {exc}")

    if assistant.enabled:
        print(f"[ok] AI assistant on: chat={assistant.chat_model}, "
              f"vision={assistant.vision_model}, speech={assistant.stt_model}")
    else:
        print("[info] AI assistant off - add GROQ_API_KEY to .env to enable it")

    # Printed to the console only — never returned by the API, since the tunnel
    # would otherwise publish this machine's private address to the internet.
    lan = _lan_url()
    if lan:
        print(f"[ok] open on a phone on the same Wi-Fi: {lan}")


# ------------------------------------------------------------------ meta APIs
@app.get("/api/health")
def health() -> dict:
    return {
        "status": "ok",
        "model_loaded": predictor.is_loaded,
        "arch": predictor.arch or None,
        "num_classes": len(predictor.class_names),
        "metrics": predictor.metrics,
        "languages": list(SUPPORTED_LANGUAGES),
        "confidence_threshold": CONFIDENCE_THRESHOLD,
        "ai": assistant.status(),
        "features": {
            "heatmap": True,
            # Offline "this is not a leaf I know" check; needs a checkpoint from
            # training/finetune_field.py, which stores the statistics it uses.
            "unknown_detection": predictor.ood is not None,
            "calibrated": predictor.temperature != 1.0,
        },
    }


@app.get("/api/classes")
def classes(lang: str = Query("mr", pattern=LANG_PATTERN)) -> dict:
    """Every crop and disease the model can name — used by the in-app info sheet."""
    items = []
    for key, entry in predictor.remedies.items():
        if key.startswith("_"):
            continue
        items.append({
            "class_name": key,
            "crop": entry["crop"][lang],
            "disease": entry["disease"][lang],
            "healthy": entry["healthy"],
            "severity": entry["severity"],
            # False for crops only the AI vision model can name so far.
            "cnn": key in predictor.class_names,
        })
    items.sort(key=lambda x: (x["crop"], x["disease"]))
    return {"count": len(items), "language": lang, "classes": items}


# --------------------------------------------------------------- diagnosis API
@app.post("/api/predict")
async def predict(
    file: UploadFile = File(...),
    lang: str = Query("mr", pattern=LANG_PATTERN),
) -> JSONResponse:
    if file.content_type and file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(415, f"Unsupported image type: {file.content_type}")

    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(400, "Empty file.")
    if len(image_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "Image larger than 12 MB. Please retake at lower resolution.")

    try:
        result = predictor.predict(image_bytes, lang=lang)
    except ModelNotTrainedError as exc:
        raise HTTPException(503, str(exc)) from exc
    except Exception as exc:  # corrupt or unreadable image
        raise HTTPException(400, f"Could not read the image: {exc}") from exc

    result["speech_text"] = predictor.speech_text(result, lang)
    return JSONResponse(result)


# --------------------------------------------------------------------- TTS API
class SpeakRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000)
    lang: str = Field("mr", pattern=LANG_PATTERN)


@app.post("/api/tts")
def tts(req: SpeakRequest) -> FileResponse:
    """Server-side speech, used when the phone has no Marathi or Hindi voice.

    Most Android phones ship a hi-IN voice but very few ship mr-IN, so the
    browser alone cannot be relied on for the Marathi demo. Needs internet.
    """
    try:
        from gtts import gTTS
    except ImportError as exc:
        raise HTTPException(503, "gTTS is not installed on the server.") from exc

    digest = hashlib.sha256(f"{req.lang}:{req.text}".encode("utf-8")).hexdigest()[:24]
    mp3_path = TTS_CACHE_DIR / f"{digest}.mp3"

    if not mp3_path.exists():
        try:
            # tld='co.in' gives noticeably better Indian pronunciation for en.
            gTTS(text=req.text, lang=req.lang, tld="co.in", slow=False).save(str(mp3_path))
        except Exception as exc:
            mp3_path.unlink(missing_ok=True)
            raise HTTPException(503, f"Speech generation failed (needs internet): {exc}") from exc

    return FileResponse(mp3_path, media_type="audio/mpeg", filename=f"advisory_{req.lang}.mp3")


# ---------------------------------------------------------------------- AI APIs
class RateLimiter:
    """Sliding-window limit per client.

    The Cloudflare tunnel makes this server public, and every AI call spends
    the owner's Groq quota, so one visitor must not be able to drain it.
    """

    def __init__(self, limit: int, window_s: float) -> None:
        self.limit = limit
        self.window_s = window_s
        self.hits: dict[str, deque] = defaultdict(deque)

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        q = self.hits[key]
        while q and now - q[0] > self.window_s:
            q.popleft()
        if len(q) >= self.limit:
            return False
        q.append(now)
        if len(self.hits) > 5000:  # forget idle clients so memory stays bounded
            for k in [k for k, v in self.hits.items() if not v]:
                del self.hits[k]
        return True


ai_limiter = RateLimiter(limit=int(os.environ.get("AI_RATE_LIMIT_PER_MIN", "20")), window_s=60)


def _client_key(request: Request) -> str:
    host = request.client.host if request.client else "unknown"
    # Behind cloudflared every request arrives from localhost; the real
    # visitor is in CF-Connecting-IP. Only trust that header from localhost.
    if host in ("127.0.0.1", "::1"):
        return request.headers.get("cf-connecting-ip", host)
    return host


def _guard_ai(request: Request) -> None:
    if not assistant.enabled:
        raise HTTPException(503, "AI assistant is off: set GROQ_API_KEY in .env.")
    if not ai_limiter.allow(_client_key(request)):
        raise HTTPException(429, "Too many AI requests. Please wait a minute.")


def _ai_error(exc: Exception) -> HTTPException:
    if isinstance(exc, AIRequestError):
        return HTTPException(exc.status, str(exc))
    return HTTPException(503, str(exc))


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1, max_length=1500)


class ChatRequest(BaseModel):
    lang: str = Field("mr", pattern=LANG_PATTERN)
    messages: list[ChatMessage] = Field(..., min_length=1, max_length=16)
    # Only the class name is taken from the client. The advisory text itself
    # is looked up here, so a tampered request cannot feed the model fake doses.
    class_name: str | None = Field(None, max_length=120)
    confidence: float | None = Field(None, ge=0, le=1)
    low_confidence: bool = False
    alternatives: list[str] = Field(default_factory=list, max_length=5)
    # The vision model's independent answer, when it disagreed with the CNN.
    vision_match: str | None = Field(None, max_length=120)
    # Optional location, so answers about spraying can account for the forecast.
    lat: float | None = Field(None, ge=-90, le=90)
    lon: float | None = Field(None, ge=-180, le=180)


def _remedy(class_name: str | None) -> dict | None:
    if not class_name or class_name.startswith("_"):
        return None
    return predictor.remedies.get(class_name)


@app.post("/api/ai/chat")
async def ai_chat(req: ChatRequest, request: Request) -> StreamingResponse:
    """Follow-up questions about a diagnosis. Streams plain UTF-8 text."""
    _guard_ai(request)
    if req.messages[-1].role != "user":
        raise HTTPException(422, "The last message must come from the user.")

    advisory = None
    entry = _remedy(req.class_name)
    if entry:
        alts = [
            f"{e['crop']['en']} - {e['disease']['en']}"
            for e in map(_remedy, req.alternatives) if e
        ]
        advisory = build_advisory(entry, req.lang, req.confidence, req.low_confidence, alts)

        second = _remedy(req.vision_match) if req.vision_match != req.class_name else None
        if second:
            advisory += (
                "\n\nSECOND OPINION — a separate vision AI looked at the same photo and "
                "thinks it may instead be the disease below. The two models disagree, so "
                "tell the farmer both possibilities and to confirm with an expert before "
                "spraying. Use this advisory's doses if discussing this disease:\n"
                + build_advisory(second, req.lang, None, False, [])
            )

    if req.lat is not None and req.lon is not None:
        try:
            forecast = weather.as_text(await weather.forecast(req.lat, req.lon))
            advisory = (advisory or "") + "\n\nLOCAL WEATHER (use it when advising when to spray):\n" + forecast
        except Exception:
            pass  # weather is a bonus; never fail the answer over it

    try:
        chunks = await assistant.chat_stream(
            [m.model_dump() for m in req.messages], req.lang, advisory
        )
    except (AIUnavailableError, AIRequestError) as exc:
        raise _ai_error(exc) from exc

    return StreamingResponse(
        chunks,
        media_type="text/plain; charset=utf-8",
        # Stops proxies (including the Cloudflare tunnel) from buffering the
        # stream, which would make the answer appear all at once at the end.
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/api/ai/second-opinion")
async def ai_second_opinion(
    request: Request,
    file: UploadFile = File(...),
    lang: str = Query("mr", pattern=LANG_PATTERN),
    cnn_class: str = Query(..., max_length=120),
) -> dict:
    """An independent vision-model read of the same photo, compared with the CNN."""
    _guard_ai(request)
    image_bytes = await file.read()
    if not image_bytes or len(image_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(400, "Missing or oversized image.")

    # Every class with an advisory, including crops the CNN has not been
    # trained on yet — for those the vision model is the only diagnosis.
    classes = [k for k in predictor.remedies if not k.startswith("_")]
    try:
        opinion = await assistant.second_opinion(image_bytes, classes)
    except (AIUnavailableError, AIRequestError) as exc:
        raise _ai_error(exc) from exc
    except Exception as exc:  # PIL could not decode the image
        raise HTTPException(400, f"Could not read the image: {exc}") from exc

    best = opinion["best_match"]
    if not opinion["is_plant_leaf"]:
        verdict = "not_leaf"
    elif best == cnn_class:
        verdict = "agrees"
    elif best == "OTHER":
        verdict = "unknown"
    elif best not in predictor.class_names:
        verdict = "extended"  # a crop the CNN cannot name, e.g. cotton or onion
    else:
        verdict = "disagrees"

    entry = _remedy(best)
    label = f"{entry['crop'][lang]} — {entry['disease'][lang]}" if entry else None
    return {**opinion, "verdict": verdict, "best_match_label": label, "model": assistant.vision_model}


@app.post("/api/ai/transcribe")
async def ai_transcribe(
    request: Request,
    file: UploadFile = File(...),
    lang: str = Query("mr", pattern=LANG_PATTERN),
) -> dict:
    """Speech to text for spoken questions."""
    _guard_ai(request)
    audio = await file.read()
    if not audio:
        raise HTTPException(400, "Empty recording.")
    if len(audio) > MAX_AUDIO_BYTES:
        raise HTTPException(413, "Recording too long.")

    # Groq detects the format from the file extension, and browsers differ:
    # Chrome records webm, Safari mp4.
    base_type = (file.content_type or "audio/webm").split(";")[0].strip().lower()
    ext = AUDIO_EXTENSIONS.get(base_type, "webm")
    try:
        text = await assistant.transcribe(audio, f"question.{ext}", lang)
    except (AIUnavailableError, AIRequestError) as exc:
        raise _ai_error(exc) from exc
    return {"text": text, "language": lang}


@app.get("/api/advisory/{class_name:path}")
def advisory(class_name: str, lang: str = Query("mr", pattern=LANG_PATTERN)) -> dict:
    """Full advisory for one class, without a photo.

    Used to reopen a saved scan in another language, and to show the remedy
    for a crop that only the AI vision model recognised.
    """
    entry = _remedy(class_name)
    if entry is None:
        raise HTTPException(404, f"Unknown class: {class_name}")
    result = {
        "language": lang,
        "prediction": predictor.describe(class_name, lang),
        "alternatives": [],
        "low_confidence": False,
        "advice": advice.plan(entry, lang),
        "disclaimer": predictor.remedies["_meta"]["disclaimer"][lang],
    }
    result["speech_text"] = predictor.speech_text(result, lang)
    return result


# ----------------------------------------------------------- weather + map APIs
@app.get("/api/weather")
async def spray_weather(lat: float = Query(..., ge=-90, le=90),
                        lon: float = Query(..., ge=-180, le=180)) -> dict:
    """48-hour spray windows, rain warning and humidity-driven disease risk."""
    try:
        return await weather.forecast(lat, lon)
    except Exception as exc:
        raise HTTPException(503, f"Weather service unavailable: {exc.__class__.__name__}") from exc


class ReportRequest(BaseModel):
    class_name: str = Field(..., max_length=120)
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)
    source: Literal["cnn", "vision"] = "cnn"


report_limiter = RateLimiter(limit=10, window_s=60)


@app.post("/api/report")
def report(req: ReportRequest, request: Request) -> dict:
    """Add one anonymous diagnosis to the outbreak map (opt-in on the phone)."""
    if not report_limiter.allow(_client_key(request)):
        raise HTTPException(429, "Too many reports.")
    entry = _remedy(req.class_name)
    if entry is None:
        raise HTTPException(422, "Unknown class.")
    if entry["healthy"]:
        return {"stored": False}  # the map shows disease, not healthy leaves
    outbreaks.record(req.class_name, req.lat, req.lon, req.source)
    return {"stored": True, "cell_km": 5}


@app.get("/api/outbreaks")
def outbreak_map(days: int = Query(30, ge=1, le=365),
                 lang: str = Query("mr", pattern=LANG_PATTERN)) -> dict:
    """Diseases reported per ~5 km cell, localised for the map popups."""
    cells = []
    for row in outbreaks.summary(days):
        entry = _remedy(row["class_name"])
        if entry is None:
            continue
        cells.append({**row, "crop": entry["crop"][lang], "disease": entry["disease"][lang],
                      "severity": entry["severity"]})
    return {"days": days, "cell_km": 5, "cells": cells}


# ------------------------------------------------------------- PWA static files
if FRONTEND_DIR.exists():
    app.mount("/app", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")

    @app.get("/")
    def root() -> FileResponse:
        return FileResponse(FRONTEND_DIR / "index.html")

    @app.get("/sw.js")
    def service_worker() -> FileResponse:
        # A service worker may only control pages at or below its own path, so
        # it has to be served from the site root, not from /app/.
        return FileResponse(FRONTEND_DIR / "sw.js", media_type="application/javascript")

    @app.get("/manifest.webmanifest")
    def manifest() -> FileResponse:
        return FileResponse(FRONTEND_DIR / "manifest.webmanifest",
                            media_type="application/manifest+json")


def _lan_url() -> str | None:
    """Best-effort LAN address, so you can open the app on a phone over Wi-Fi.

    Printed to the console at startup only. It is deliberately not returned by
    /api/health, because the Cloudflare tunnel would otherwise publish this
    machine's private address to anyone holding the public URL.
    """
    port = os.environ.get("PORT", "8000")
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))  # no packet is actually sent
            ip = s.getsockname()[0]
    except OSError:
        ip = "127.0.0.1"
    return f"http://{ip}:{port}"

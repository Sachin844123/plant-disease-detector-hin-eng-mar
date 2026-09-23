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
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

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

app = FastAPI(
    title="Plant Disease Advisory API",
    description="CNN leaf-disease diagnosis with remedies in Marathi, Hindi and English.",
    version="1.0.0",
)

# The PWA is served from this same origin in normal use. CORS stays open so the
# frontend can also be run from a separate dev server while you build it.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def warm_model() -> None:
    """Load the checkpoint at boot so the first farmer does not wait for it."""
    try:
        predictor.load()
        acc = predictor.metrics.get("val_accuracy")
        print(f"[ok] model loaded: {predictor.arch}, {len(predictor.class_names)} classes"
              + (f", val acc {acc:.2%}" if isinstance(acc, (int, float)) else ""))
    except ModelNotTrainedError as exc:
        print(f"[warn] {exc}")

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
    }


@app.get("/api/classes")
def classes(lang: str = Query("mr", pattern="^(mr|hi|en)$")) -> dict:
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
        })
    items.sort(key=lambda x: (x["crop"], x["disease"]))
    return {"count": len(items), "language": lang, "classes": items}


# --------------------------------------------------------------- diagnosis API
@app.post("/api/predict")
async def predict(
    file: UploadFile = File(...),
    lang: str = Query("mr", pattern="^(mr|hi|en)$"),
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
    lang: str = Field("mr", pattern="^(mr|hi|en)$")


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

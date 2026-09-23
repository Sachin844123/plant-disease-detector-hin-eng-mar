"""Loads the trained checkpoint and turns an uploaded photo into a diagnosis."""

from __future__ import annotations

import io
import json
import time
from pathlib import Path

import torch
import torch.nn.functional as F
from PIL import Image, ImageOps

from model import build_model, eval_transforms

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "models" / "plant_disease_model.pt"
REMEDIES_PATH = BASE_DIR / "data" / "remedies.json"

# Below this top-1 probability we tell the farmer we are unsure rather than
# naming a disease. A wrong confident answer costs them a spray they did not need.
CONFIDENCE_THRESHOLD = 0.60

SUPPORTED_LANGUAGES = ("mr", "hi", "en")


class ModelNotTrainedError(RuntimeError):
    """Raised when no checkpoint is present yet."""


class Predictor:
    def __init__(self) -> None:
        self.model = None
        self.class_names: list[str] = []
        self.arch: str = ""
        self.img_size: int = 224
        self.metrics: dict = {}
        self.transform = None
        self.remedies: dict = json.loads(REMEDIES_PATH.read_text(encoding="utf-8"))

    # ---------------------------------------------------------------- loading
    @property
    def is_loaded(self) -> bool:
        return self.model is not None

    def load(self) -> None:
        """Load the checkpoint into memory. Safe to call repeatedly."""
        if self.is_loaded:
            return
        if not MODEL_PATH.exists():
            raise ModelNotTrainedError(
                f"No trained model at {MODEL_PATH}. Run training/train_plantvillage.ipynb "
                "on Colab and copy plant_disease_model.pt into backend/models/."
            )

        ckpt = torch.load(MODEL_PATH, map_location="cpu", weights_only=False)
        self.class_names = ckpt["class_names"]
        self.arch = ckpt.get("arch", "mobilenet_v3_large")
        self.img_size = ckpt.get("img_size", 224)
        self.metrics = ckpt.get("metrics", {})

        model = build_model(len(self.class_names), arch=self.arch, pretrained=False)
        model.load_state_dict(ckpt["state_dict"])
        model.eval()
        # Inference-only server: gradients are pure overhead.
        for p in model.parameters():
            p.requires_grad_(False)

        self.model = model
        self.transform = eval_transforms(self.img_size)

        unknown = [c for c in self.class_names if c not in self.remedies]
        if unknown:
            print(f"[warn] {len(unknown)} class(es) have no remedy entry: {unknown[:5]}")

    # ------------------------------------------------------------- predicting
    def predict(self, image_bytes: bytes, lang: str = "mr", top_k: int = 3) -> dict:
        self.load()
        if lang not in SUPPORTED_LANGUAGES:
            lang = "mr"

        image = Image.open(io.BytesIO(image_bytes))
        # Phone cameras store rotation in EXIF; without this a sideways photo
        # gets cropped wrongly and accuracy drops for no good reason.
        image = ImageOps.exif_transpose(image).convert("RGB")

        tensor = self.transform(image).unsqueeze(0)

        started = time.perf_counter()
        with torch.inference_mode():
            probs = F.softmax(self.model(tensor), dim=1)[0]
        elapsed_ms = round((time.perf_counter() - started) * 1000, 1)

        k = min(top_k, len(self.class_names))
        top_probs, top_idx = torch.topk(probs, k)

        predictions = [
            self._describe(self.class_names[i], float(p), lang)
            for p, i in zip(top_probs.tolist(), top_idx.tolist())
        ]
        best = predictions[0]

        return {
            "language": lang,
            "inference_ms": elapsed_ms,
            "low_confidence": best["confidence"] < CONFIDENCE_THRESHOLD,
            "confidence_threshold": CONFIDENCE_THRESHOLD,
            "prediction": best,
            "alternatives": predictions[1:],
            "disclaimer": self.remedies["_meta"]["disclaimer"][lang],
        }

    def _describe(self, class_name: str, confidence: float, lang: str) -> dict:
        """Attach the localised advisory text to one raw class prediction."""
        entry = self.remedies.get(class_name)
        if entry is None:
            # Should not happen — but never crash a farmer's request over it.
            return {
                "class_name": class_name,
                "confidence": round(confidence, 4),
                "healthy": False,
                "crop": class_name.split("___")[0].replace("_", " "),
                "disease": class_name.split("___")[-1].replace("_", " "),
                "symptoms": "",
                "remedy": "",
                "prevention": "",
                "pathogen": "",
                "severity": "unknown",
            }

        return {
            "class_name": class_name,
            "confidence": round(confidence, 4),
            "healthy": entry["healthy"],
            "severity": entry["severity"],
            "pathogen": entry["pathogen"],
            "crop": entry["crop"][lang],
            "disease": entry["disease"][lang],
            "symptoms": entry["symptoms"][lang],
            "remedy": entry["remedy"][lang],
            "prevention": entry["prevention"][lang],
        }

    def speech_text(self, result: dict, lang: str) -> str:
        """Flatten a result into one paragraph for text-to-speech."""
        p = result["prediction"]
        joiner = {
            "mr": ("रोग", "खात्री", "लक्षणे", "उपाय", "प्रतिबंध", "निरोगी पान आहे"),
            "hi": ("रोग", "निश्चितता", "लक्षण", "उपाय", "बचाव", "पत्ती स्वस्थ है"),
            "en": ("Disease", "Confidence", "Symptoms", "Remedy", "Prevention", "The leaf is healthy"),
        }[lang]

        pct = int(round(p["confidence"] * 100))
        if p["healthy"]:
            head = f"{p['crop']}. {joiner[5]}. {joiner[1]} {pct} %."
        else:
            head = f"{p['crop']}. {joiner[0]}: {p['disease']}. {joiner[1]} {pct} %."

        return " ".join([
            head,
            f"{joiner[2]}: {p['symptoms']}",
            f"{joiner[3]}: {p['remedy']}",
            f"{joiner[4]}: {p['prevention']}",
        ])


predictor = Predictor()

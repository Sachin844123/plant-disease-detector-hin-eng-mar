# पीक रोग ओळख · Plant Disease Detector

**Avishkar 2026** — a CNN that identifies crop leaf diseases from a phone photo and gives the
farmer the disease name, symptoms, remedy and prevention **in Marathi, Hindi or English**, with
voice output for farmers who cannot read.

---

## What it does

1. The farmer opens the app on their phone and photographs a leaf.
2. A MobileNetV3 CNN trained on PlantVillage classifies it into one of **38 classes** across
   **14 crops** (tomato, potato, grape, maize, apple, bell pepper and more).
3. The app shows the disease, a confidence bar, symptoms, a **remedy with exact dosage**, and
   prevention advice — in the chosen language.
4. A **🔊 Listen** button reads the whole advisory aloud in Marathi or Hindi.
5. If the model is less than 60% confident it says so instead of naming a disease, because a
   wrong confident answer costs the farmer a spray they did not need.
6. **AI assistant (optional, via Groq):** a second AI model checks the photo independently, and
   the farmer can ask follow-up questions — typed or **spoken** — and hear the answer read aloud.

---

## Setup

### One time

```bat
scripts\setup.bat
```

Creates `.venv\` inside this folder and installs everything there. Nothing touches your
system Python.

### Train the model

The model is not included — you train it yourself, which is the point of the project.

1. Upload `training/train_plantvillage.ipynb` to [Google Colab](https://colab.research.google.com)
2. `Runtime` → `Change runtime type` → **T4 GPU**
3. `Runtime` → `Run all` (~25 minutes)
4. The last cell downloads `plant_disease_model.pt` — put it in `backend/models/`

### Turn on the AI assistant (optional, free)

1. Get a free API key at [console.groq.com/keys](https://console.groq.com/keys)
2. Paste it into `.env` (setup created it from `.env.example`):
   ```
   GROQ_API_KEY=gsk_...
   ```
3. Restart the server. The console prints `[ok] AI assistant on`.

Without a key everything else works exactly as before; the AI panel is simply hidden.

### Run

```bat
scripts\start.bat
```

Then open **http://localhost:8000**

**To demo on a phone:** connect the phone to the same Wi-Fi as the laptop and open the
`lan_url` that `/api/health` reports (something like `http://192.168.0.104:8000`). On Android,
Chrome will offer *Add to Home screen* — it installs as a real app icon.

---

## The AI assistant

The CNN stays the primary diagnosis — it is instant and runs on the laptop. Groq adds three
layers on top, each of which fails quietly if the internet or the key is missing:

| Feature | Groq model | What it does |
|---|---|---|
| **AI second opinion** | `qwen/qwen3.8-27b` (vision) | Looks at the same photo *without* being told the CNN's answer, then the server compares the two. Flags "this is not a leaf", "a different disease is likely", and photo problems (blurry, dark, too far). |
| **Krishi Mitra chat** | `openai/gpt-oss-120b` | Follow-up questions in Marathi, Hindi or English, streamed as they are generated. Suggested questions are one tap away. |
| **Voice questions** | `whisper-large-v3-turbo` | Tap 🎤, speak in Marathi or Hindi, and the answer is read back aloud automatically. |

**Why the chat cannot invent a dose.** The browser sends only the class name; the server looks
up that disease's advisory in `remedies.json` and hands it to the model with instructions to
recommend only those products at those doses, never banned pesticides, and to send the
farmer to their KVK or the Kisan Call Centre (1800-180-1551) otherwise. When the vision model
disagrees with the CNN, both advisories are given, so the answer covers both possibilities.

**Why the second opinion matters.** On a real field photo of tomato *early* blight, the CNN
said *late* blight at 41% — PlantVillage is shot on plain backgrounds, field photos are not.
The vision model named early blight correctly. Showing a judge this disagreement, and the
app handling it honestly, is a stronger demo than a perfect score.

**Protecting your key.** On the public Cloudflare URL anyone can use the app, so each visitor
is limited to 20 AI requests a minute (`AI_RATE_LIMIT_PER_MIN` in `.env`). The key never
leaves the server.

**Models change.** Groq retires models regularly. The server checks at startup and prints
`[warn] Groq model '...' is not available` if one of yours has gone — set a current one in
`.env` from [console.groq.com/docs/models](https://console.groq.com/docs/models).

**Voice input needs HTTPS.** Browsers only allow the microphone on `https://` or `localhost`,
so the 🎤 button is hidden on a plain `http://192.168.x.x` Wi-Fi address. It works on the
Cloudflare tunnel URL.

---

## Project layout

```
backend/
  main.py               FastAPI server: /api/predict, /api/tts, /api/classes, /api/health,
                        /api/ai/chat, /api/ai/second-opinion, /api/ai/transcribe
  ai.py                 Groq client: chat, vision second opinion, speech-to-text
  inference.py          checkpoint loading, prediction, advisory lookup
  model.py              architecture + transforms (shared with the notebook)
  data/remedies.json    38 diseases × {symptoms, remedy, prevention} × {en, hi, mr}
  models/               <- put plant_disease_model.pt here

frontend/               installable PWA (vanilla JS, no build step)
  index.html  app.js  styles.css  sw.js  manifest.webmanifest

training/
  train_plantvillage.ipynb   Colab notebook: data, training, evaluation, export

scripts/
  setup.bat  start.bat  tunnel.bat  make_dummy_model.py

.env.example            copy to .env and add GROQ_API_KEY (.env is git-ignored)
```

---

## Testing the app before the model is ready

```bat
.venv\Scripts\python scripts\make_dummy_model.py
```

Writes an **untrained** checkpoint so you can click through the whole app — upload, result
card, language switching, voice. Its predictions are random (~2.6% confidence, which is 1/38).
**Replace it with the real checkpoint before the presentation.**

---

## Notes for the viva

**Why MobileNetV3 and not ResNet50 or a custom CNN?**
The app has to run on a laptop CPU at the exhibition — there is no GPU on the demo machine.
MobileNetV3-Large does an image in ~30 ms on CPU and the checkpoint is 17 MB. A custom CNN
trained from scratch on 54k images would land around 90–95%; transfer learning from ImageNet
reaches ~99% because the low-level edge and texture filters come pre-learned.

**Why is the reported accuracy so high?**
PlantVillage images are all shot on a uniform background under good lighting, so ~99%
validation accuracy is a property of the dataset, not proof of field performance. Say this
before a judge points it out — it turns a weakness into evidence that you understand your
data. The training augmentation (colour jitter, rotation, random erasing) and the 60%
confidence cut-off are the two mitigations built in.

**Which classes does it confuse?**
Run section 8 of the notebook. Tomato *Early blight* vs *Target Spot* is the usual pair —
they genuinely look alike, both being brown ringed lesions. Know your top three confusions.

**Where do the remedies come from?**
`backend/data/remedies.json`, written against standard ICAR / Krishi Vigyan Kendra advisory
doses. Every result carries a disclaimer telling the farmer to confirm with their local
agriculture officer before spraying.

---

## Requirements

- Python 3.10+ (tested on 3.13)
- A Google account for Colab (free tier is enough)
- Internet for the voice feature — server-side speech uses gTTS. If the phone has an
  `hi-IN` voice installed the browser speaks it offline; almost no phone ships `mr-IN`, so
  Marathi falls back to the server.

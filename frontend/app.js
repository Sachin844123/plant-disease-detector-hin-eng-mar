/* Plant Disease Advisory — PWA front end
   Handles: language switching, camera capture, upload, result rendering,
   and voice output in Marathi / Hindi / English. */

const API = ""; // same origin; set to "http://192.168.x.x:8000" only for a split dev setup

const UI = {
  mr: {
    lang: "mr", htmlLang: "mr", speechLang: "mr-IN",
    title: "पीक रोग ओळख",
    tagline: "पानाचा फोटो काढा, रोग व उपाय मिळवा",
    takePhoto: "फोटो काढा",
    choosePhoto: "गॅलरीतून निवडा",
    hint: "एका पानाचा स्पष्ट फोटो घ्या. पान पूर्ण चौकटीत असावे.",
    diagnose: "रोग तपासा",
    analysing: "विश्लेषण सुरू आहे...",
    symptoms: "लक्षणे",
    remedy: "उपाय",
    prevention: "प्रतिबंध",
    otherPossible: "इतर शक्यता",
    again: "दुसरा फोटो तपासा",
    listen: "ऐका",
    stop: "थांबवा",
    loading: "आवाज तयार होत आहे...",
    confidence: "खात्री",
    healthy: "निरोगी पान",
    lowConf: "मॉडेलला पूर्ण खात्री नाही. कृपया अधिक स्पष्ट फोटो काढा किंवा कृषी अधिकाऱ्याचा सल्ला घ्या.",
    severity: { none: "निरोगी", low: "सौम्य", medium: "मध्यम", high: "गंभीर", unknown: "अज्ञात" },
    errNoModel: "मॉडेल अजून प्रशिक्षित नाही. प्रथम Colab वर मॉडेल प्रशिक्षित करून backend/models/ मध्ये ठेवा.",
    errNetwork: "सर्व्हरशी संपर्क होत नाही. इंटरनेट किंवा सर्व्हर तपासा.",
    errGeneric: "काहीतरी चूक झाली. पुन्हा प्रयत्न करा.",
    errSpeech: "आवाज उपलब्ध नाही. कृपया मजकूर वाचा.",
    offline: "तुम्ही ऑफलाइन आहात. निदानासाठी इंटरनेट आवश्यक आहे.",
    modelInfo: (n, a) => `मॉडेल: ${n} वर्ग${a ? ` · अचूकता ${a}` : ""}`,
  },
  hi: {
    lang: "hi", htmlLang: "hi", speechLang: "hi-IN",
    title: "फसल रोग पहचान",
    tagline: "पत्ती की फोटो लें, रोग और उपाय पाएँ",
    takePhoto: "फोटो लें",
    choosePhoto: "गैलरी से चुनें",
    hint: "एक पत्ती की साफ फोटो लें। पत्ती पूरी फ्रेम में हो।",
    diagnose: "रोग जाँचें",
    analysing: "जाँच हो रही है...",
    symptoms: "लक्षण",
    remedy: "उपाय",
    prevention: "बचाव",
    otherPossible: "अन्य संभावनाएँ",
    again: "दूसरी फोटो जाँचें",
    listen: "सुनें",
    stop: "रोकें",
    loading: "आवाज़ तैयार हो रही है...",
    confidence: "निश्चितता",
    healthy: "स्वस्थ पत्ती",
    lowConf: "मॉडेल पूरी तरह निश्चित नहीं है। कृपया अधिक साफ फोटो लें या कृषि अधिकारी से सलाह लें।",
    severity: { none: "स्वस्थ", low: "हल्का", medium: "मध्यम", high: "गंभीर", unknown: "अज्ञात" },
    errNoModel: "मॉडेल अभी प्रशिक्षित नहीं है। पहले Colab पर मॉडेल प्रशिक्षित करके backend/models/ में रखें।",
    errNetwork: "सर्वर से संपर्क नहीं हो रहा। इंटरनेट या सर्वर जाँचें।",
    errGeneric: "कुछ गलत हुआ। फिर से कोशिश करें।",
    errSpeech: "आवाज़ उपलब्ध नहीं है। कृपया पाठ पढ़ें।",
    offline: "आप ऑफलाइन हैं। जाँच के लिए इंटरनेट चाहिए।",
    modelInfo: (n, a) => `मॉडेल: ${n} वर्ग${a ? ` · सटीकता ${a}` : ""}`,
  },
  en: {
    lang: "en", htmlLang: "en", speechLang: "en-IN",
    title: "Plant Disease Detector",
    tagline: "Photograph a leaf, get the disease and its remedy",
    takePhoto: "Take Photo",
    choosePhoto: "Choose from Gallery",
    hint: "Take a clear photo of a single leaf filling the frame.",
    diagnose: "Diagnose",
    analysing: "Analysing...",
    symptoms: "Symptoms",
    remedy: "Remedy",
    prevention: "Prevention",
    otherPossible: "Other possibilities",
    again: "Check another photo",
    listen: "Listen",
    stop: "Stop",
    loading: "Preparing audio...",
    confidence: "Confidence",
    healthy: "Healthy leaf",
    lowConf: "The model is not fully confident. Please take a clearer photo or consult an agriculture officer.",
    severity: { none: "Healthy", low: "Mild", medium: "Moderate", high: "Severe", unknown: "Unknown" },
    errNoModel: "Model not trained yet. Train on Colab and place the checkpoint in backend/models/.",
    errNetwork: "Cannot reach the server. Check your connection or the server.",
    errGeneric: "Something went wrong. Please try again.",
    errSpeech: "Voice is not available. Please read the text.",
    offline: "You are offline. Diagnosis needs an internet connection.",
    modelInfo: (n, a) => `Model: ${n} classes${a ? ` · accuracy ${a}` : ""}`,
  },
};

let lang = localStorage.getItem("lang") || "mr";
let selectedFile = null;
let lastResult = null;

const $ = (id) => document.getElementById(id);
const t = () => UI[lang];

/* ------------------------------------------------------------ language */
function applyLanguage() {
  const s = t();
  document.documentElement.lang = s.htmlLang;
  document.title = `${s.title} | Plant Disease Detector`;

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n;
    if (s[key]) el.textContent = s[key];
  });

  document.querySelectorAll(".lang-btn").forEach((b) =>
    b.classList.toggle("is-active", b.dataset.lang === lang)
  );

  // Re-fetch the advisory in the new language so the whole card switches.
  if (lastResult && selectedFile) diagnose();
}

document.querySelectorAll(".lang-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    stopSpeaking();
    lang = btn.dataset.lang;
    localStorage.setItem("lang", lang);
    applyLanguage();
  });
});

/* --------------------------------------------------------- image input */
["fileInput", "galleryInput"].forEach((id) => {
  $(id).addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (file) onImageChosen(file);
    e.target.value = ""; // allow re-picking the same file
  });
});

function onImageChosen(file) {
  selectedFile = file;
  lastResult = null;
  $("preview").src = URL.createObjectURL(file);
  $("previewSection").hidden = false;
  $("result").hidden = true;
  $("error").hidden = true;
  $("previewSection").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

/* Shrink before upload: a 4 MB phone photo becomes ~150 KB, which matters a lot
   on a 2G/3G village connection. The model only sees 224px anyway. */
async function downscale(file, maxSide = 720, quality = 0.85) {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 900_000) return file;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();

    const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", quality));
    return blob ? new File([blob], "leaf.jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file; // createImageBitmap can fail on HEIC; let the server try
  }
}

/* ----------------------------------------------------------- diagnosis */
$("diagnoseBtn").addEventListener("click", diagnose);
$("againBtn").addEventListener("click", () => {
  stopSpeaking();
  selectedFile = null;
  lastResult = null;
  $("previewSection").hidden = true;
  $("result").hidden = true;
  window.scrollTo({ top: 0, behavior: "smooth" });
});

async function diagnose() {
  if (!selectedFile) return;
  if (!navigator.onLine) return showError(t().offline);

  stopSpeaking();
  $("loading").hidden = false;
  $("result").hidden = true;
  $("error").hidden = true;

  try {
    const upload = await downscale(selectedFile);
    const form = new FormData();
    form.append("file", upload, "leaf.jpg");

    const res = await fetch(`${API}/api/predict?lang=${lang}`, { method: "POST", body: form });

    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      if (res.status === 503) throw new Error(t().errNoModel);
      throw new Error(detail.detail || t().errGeneric);
    }

    lastResult = await res.json();
    render(lastResult);
  } catch (err) {
    const offlineish = err instanceof TypeError; // fetch network failure
    showError(offlineish ? t().errNetwork : err.message);
  } finally {
    $("loading").hidden = true;
  }
}

function render(data) {
  const s = t();
  const p = data.prediction;
  const sev = p.severity || "unknown";

  $("resultCard").className = `result-card sev-${sev}`;
  $("cropName").textContent = p.crop;
  $("diseaseName").textContent = p.healthy ? s.healthy : p.disease;

  const chip = $("severityChip");
  chip.textContent = s.severity[sev] || sev;
  chip.className = `chip sev-${sev}`;

  const pct = Math.round(p.confidence * 100);
  $("confidenceFill").style.width = `${pct}%`;
  $("confidenceFill").style.background =
    pct >= 80 ? "var(--green-500)" : pct >= 60 ? "var(--amber)" : "var(--red)";
  $("confidenceText").textContent = `${s.confidence} ${pct}%`;

  $("lowConfNote").hidden = !data.low_confidence;
  $("lowConfNote").textContent = s.lowConf;

  $("symptoms").textContent = p.symptoms;
  $("remedy").textContent = p.remedy;
  $("prevention").textContent = p.prevention;
  $("pathogen").textContent = p.pathogen && p.pathogen !== "None" ? `🔬 ${p.pathogen}` : "";
  $("disclaimer").textContent = data.disclaimer;

  const alts = data.alternatives || [];
  $("altBox").hidden = alts.length === 0;
  $("altList").innerHTML = alts
    .map((a) => {
      const name = a.healthy ? `${a.crop} — ${s.healthy}` : `${a.crop} — ${a.disease}`;
      return `<li><span>${escapeHtml(name)}</span><span>${Math.round(a.confidence * 100)}%</span></li>`;
    })
    .join("");

  $("speakLabel").textContent = s.listen;
  $("speakBtn").classList.remove("speaking");
  $("speakBtn").disabled = false;

  $("result").hidden = false;
  $("result").scrollIntoView({ behavior: "smooth", block: "start" });
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

function showError(msg) {
  $("errorText").textContent = msg;
  $("error").hidden = false;
}

/* --------------------------------------------------------------- voice */
/* Two paths. The browser's own speech engine is instant and works offline, but
   almost no Android phone ships a Marathi (mr-IN) voice. When that voice is
   missing we fall back to the server's gTTS endpoint, which needs internet. */

const audio = $("ttsAudio");
let speaking = false;

$("speakBtn").addEventListener("click", () => {
  if (speaking) return stopSpeaking();
  if (lastResult?.speech_text) speak(lastResult.speech_text);
});

function findVoice(target) {
  const voices = speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang.replace("_", "-") === target) ||
    voices.find((v) => v.lang.replace("_", "-").startsWith(target.split("-")[0]))
  );
}

async function speak(text) {
  const s = t();
  setSpeaking(true);

  const voice = "speechSynthesis" in window ? findVoice(s.speechLang) : null;

  if (voice) {
    const utter = new SpeechSynthesisUtterance(text);
    utter.voice = voice;
    utter.lang = voice.lang;
    utter.rate = 0.9; // slightly slow — these are instructions to act on
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => serverSpeak(text);
    speechSynthesis.cancel();
    speechSynthesis.speak(utter);
  } else {
    await serverSpeak(text);
  }
}

async function serverSpeak(text) {
  $("speakLabel").textContent = t().loading;
  $("speakBtn").disabled = true;
  try {
    const res = await fetch(`${API}/api/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, lang }),
    });
    if (!res.ok) throw new Error("tts failed");

    const url = URL.createObjectURL(await res.blob());
    audio.src = url;
    audio.onended = () => { setSpeaking(false); URL.revokeObjectURL(url); };
    audio.onerror = () => { setSpeaking(false); showError(t().errSpeech); };
    await audio.play();
    setSpeaking(true);
  } catch {
    setSpeaking(false);
    showError(t().errSpeech);
  } finally {
    $("speakBtn").disabled = false;
  }
}

function setSpeaking(on) {
  speaking = on;
  $("speakBtn").classList.toggle("speaking", on);
  $("speakLabel").textContent = on ? t().stop : t().listen;
  $("speakBtn").disabled = false;
}

function stopSpeaking() {
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  audio.pause();
  audio.currentTime = 0;
  setSpeaking(false);
}

// Chrome populates the voice list asynchronously.
if ("speechSynthesis" in window) speechSynthesis.onvoiceschanged = () => {};

/* --------------------------------------------------------- status/boot */
function setBanner(msg, isError = false) {
  const b = $("banner");
  b.hidden = !msg;
  b.textContent = msg || "";
  b.classList.toggle("error", isError);
}

async function checkHealth() {
  try {
    const res = await fetch(`${API}/api/health`);
    const h = await res.json();
    if (!h.model_loaded) {
      setBanner(t().errNoModel, true);
      return;
    }
    setBanner("");
    const acc = h.metrics?.val_accuracy;
    $("modelInfo").textContent = t().modelInfo(
      h.num_classes,
      typeof acc === "number" ? `${(acc * 100).toFixed(1)}%` : ""
    );
  } catch {
    setBanner(t().errNetwork, true);
  }
}

window.addEventListener("online", () => { setBanner(""); checkHealth(); });
window.addEventListener("offline", () => setBanner(t().offline));

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () =>
    navigator.serviceWorker.register("/sw.js").catch(() => {})
  );
}

applyLanguage();
checkHealth();

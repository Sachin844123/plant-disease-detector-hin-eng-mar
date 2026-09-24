/* Plant Disease Advisory — PWA front end
   Handles: language switching, camera capture, upload, result rendering,
   voice output in Marathi / Hindi / English, and the optional Groq-powered
   assistant (second opinion, follow-up chat, spoken questions). */

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
    aiOn: "एआय सहाय्यक चालू",
    // AI assistant
    aiCheckTitle: "एआय दुसरे मत",
    aiChecking: "दुसऱ्या एआय मॉडेलकडून फोटो तपासत आहे...",
    aiAgrees: "दुसरे एआय मॉडेलही हेच निदान करते.",
    aiDisagrees: (l) => `दुसऱ्या एआय मॉडेलला वेगळा रोग वाटतो: ${l}. कृपया कृषी अधिकाऱ्याकडून खात्री करा.`,
    aiUnknown: "दुसरे एआय मॉडेल हा रोग ओळखू शकले नाही — हे पीक किंवा रोग मॉडेलच्या यादीत नसू शकतो.",
    aiNotLeaf: "हा फोटो पानाचा दिसत नाही. कृपया एका पानाचा जवळून फोटो काढा.",
    quality: {
      blurry: "फोटो अस्पष्ट आहे — फोन स्थिर धरा.",
      dark: "फोटो खूप गडद आहे — उजेडात फोटो काढा.",
      too_far: "पान खूप दूर आहे — जवळून फोटो काढा.",
      multiple_leaves: "एकाच पानाचा फोटो काढा.",
    },
    askTitle: "कृषी मित्राला विचारा",
    askHint: "या रोगाबद्दल काहीही विचारा — लिहा किंवा 🎤 दाबून बोला.",
    askPlaceholder: "तुमचा प्रश्न लिहा...",
    suggestions: [
      "फवारणी कशी आणि कधी करावी?",
      "सेंद्रिय उपाय सांगा",
      "हा रोग इतर झाडांना पसरेल का?",
      "पीक वाचवण्यासाठी आत्ता काय करू?",
    ],
    recording: "ऐकत आहे... थांबवण्यासाठी 🎤 पुन्हा दाबा",
    transcribing: "आवाज समजून घेत आहे...",
    thinking: "विचार करत आहे...",
    errAI: "एआय सहाय्यक आत्ता उपलब्ध नाही. थोड्या वेळाने प्रयत्न करा.",
    errBusy: "खूप प्रश्न विचारले गेले. एक मिनिट थांबून पुन्हा विचारा.",
    errMic: "मायक्रोफोन वापरता आला नाही. परवानगी तपासा.",
    errHeard: "आवाज स्पष्ट ऐकू आला नाही. पुन्हा बोला.",
    micLabel: "बोलून प्रश्न विचारा",
    sendLabel: "पाठवा",
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
    aiOn: "AI सहायक चालू",
    aiCheckTitle: "AI दूसरी राय",
    aiChecking: "दूसरे AI मॉडल से फोटो जाँच रहे हैं...",
    aiAgrees: "दूसरा AI मॉडल भी यही निदान करता है।",
    aiDisagrees: (l) => `दूसरे AI मॉडल को अलग रोग लगता है: ${l}। कृपया कृषि अधिकारी से पुष्टि करें।`,
    aiUnknown: "दूसरा AI मॉडल यह रोग नहीं पहचान सका — हो सकता है यह फसल या रोग मॉडल की सूची में न हो।",
    aiNotLeaf: "यह फोटो पत्ती की नहीं लगती। कृपया एक पत्ती की नज़दीक से फोटो लें।",
    quality: {
      blurry: "फोटो धुंधली है — फोन स्थिर रखें।",
      dark: "फोटो बहुत अंधेरी है — रोशनी में फोटो लें।",
      too_far: "पत्ती बहुत दूर है — पास से फोटो लें।",
      multiple_leaves: "एक ही पत्ती की फोटो लें।",
    },
    askTitle: "कृषि मित्र से पूछें",
    askHint: "इस रोग के बारे में कुछ भी पूछें — लिखें या 🎤 दबाकर बोलें।",
    askPlaceholder: "अपना सवाल लिखें...",
    suggestions: [
      "छिड़काव कैसे और कब करें?",
      "जैविक उपाय बताइए",
      "क्या यह रोग दूसरे पौधों में फैलेगा?",
      "फसल बचाने के लिए अभी क्या करूँ?",
    ],
    recording: "सुन रहे हैं... रोकने के लिए 🎤 फिर दबाएँ",
    transcribing: "आवाज़ समझ रहे हैं...",
    thinking: "सोच रहे हैं...",
    errAI: "AI सहायक अभी उपलब्ध नहीं है। थोड़ी देर बाद कोशिश करें।",
    errBusy: "बहुत सारे सवाल पूछे गए। एक मिनट रुककर फिर पूछें।",
    errMic: "माइक्रोफ़ोन का उपयोग नहीं हो सका। अनुमति जाँचें।",
    errHeard: "आवाज़ साफ़ सुनाई नहीं दी। फिर से बोलें।",
    micLabel: "बोलकर सवाल पूछें",
    sendLabel: "भेजें",
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
    aiOn: "AI assistant on",
    aiCheckTitle: "AI second opinion",
    aiChecking: "Checking the photo with a second AI model...",
    aiAgrees: "A second AI model agrees with this diagnosis.",
    aiDisagrees: (l) => `A second AI model thinks it may be: ${l}. Please confirm with an agriculture officer.`,
    aiUnknown: "The second AI model could not match this to a known disease — this crop or disease may not be in the model's list.",
    aiNotLeaf: "This photo does not look like a plant leaf. Please take a close-up of a single leaf.",
    quality: {
      blurry: "The photo is blurry — hold the phone steady.",
      dark: "The photo is too dark — take it in daylight.",
      too_far: "The leaf is too far away — move closer.",
      multiple_leaves: "Photograph a single leaf.",
    },
    askTitle: "Ask Krishi Mitra",
    askHint: "Ask anything about this disease — type, or tap 🎤 and speak.",
    askPlaceholder: "Type your question...",
    suggestions: [
      "How and when should I spray?",
      "Tell me an organic remedy",
      "Will this spread to other plants?",
      "What should I do right now?",
    ],
    recording: "Listening... tap 🎤 again to stop",
    transcribing: "Understanding your voice...",
    thinking: "Thinking...",
    errAI: "The AI assistant is unavailable right now. Please try again shortly.",
    errBusy: "Too many questions. Please wait a minute and ask again.",
    errMic: "Could not use the microphone. Check the permission.",
    errHeard: "Couldn't hear that clearly. Please try again.",
    micLabel: "Ask by speaking",
    sendLabel: "Send",
  },
};

let lang = localStorage.getItem("lang") || "mr";
let selectedFile = null;
let lastResult = null;
let lastUpload = null;   // the downscaled image, reused for the AI second opinion
let aiEnabled = false;   // from /api/health — false when the server has no GROQ_API_KEY
let health = null;
let chat = [];           // [{role, content}] for the current diagnosis
let chatBusy = false;
let opinionSeq = 0;      // discards second opinions for a photo that is no longer shown
let lastOpinion = null;  // the vision model's verdict for the photo on screen

const $ = (id) => document.getElementById(id);
const t = () => UI[lang];

/* ------------------------------------------------------------ language */
function applyLanguage() {
  const s = t();
  document.documentElement.lang = s.htmlLang;
  document.title = `${s.title} | Plant Disease Detector`;

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n;
    if (typeof s[key] === "string") el.textContent = s[key];
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.placeholder = s[el.dataset.i18nPlaceholder];
  });
  $("micBtn").setAttribute("aria-label", s.micLabel);
  $("sendBtn").setAttribute("aria-label", s.sendLabel);

  document.querySelectorAll(".lang-btn").forEach((b) =>
    b.classList.toggle("is-active", b.dataset.lang === lang)
  );

  renderSuggestions();
  renderFooter();

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
  resetChat();
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
  resetChat();
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

    lastUpload = upload;
    lastResult = await res.json();
    render(lastResult);
    if (aiEnabled) secondOpinion(lastResult, upload);
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

  $("aiCheck").hidden = true;
  $("aiChat").hidden = !aiEnabled;

  setSpeaking(false);
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

/* ------------------------------------------------------ AI second opinion */
/* The CNN answers instantly and offline-capable; this runs afterwards so it
   never slows the main result down. If it fails, the box simply stays hidden. */
async function secondOpinion(data, upload) {
  const seq = ++opinionSeq;
  lastOpinion = null;
  const box = $("aiCheck");
  box.className = "ai-check is-loading";
  $("aiCheckText").textContent = t().aiChecking;
  $("aiCheckTip").hidden = true;
  box.hidden = false;

  try {
    const form = new FormData();
    form.append("file", upload, "leaf.jpg");
    const cls = encodeURIComponent(data.prediction.class_name);
    const res = await fetch(`${API}/api/ai/second-opinion?lang=${lang}&cnn_class=${cls}`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) throw new Error(res.status);
    const o = await res.json();
    if (seq !== opinionSeq) return; // a newer photo or language replaced this one
    lastOpinion = o;

    const s = t();
    const text = {
      agrees: s.aiAgrees,
      disagrees: s.aiDisagrees(o.best_match_label || ""),
      unknown: s.aiUnknown,
      not_leaf: s.aiNotLeaf,
    }[o.verdict];
    box.className = `ai-check verdict-${o.verdict}`;
    $("aiCheckText").textContent = text || s.aiUnknown;

    const tip = s.quality[o.quality_issue];
    $("aiCheckTip").hidden = !tip || o.verdict === "agrees";
    $("aiCheckTip").textContent = tip ? `💡 ${tip}` : "";
  } catch {
    if (seq === opinionSeq) box.hidden = true;
  }
}

/* ------------------------------------------------------------ AI chat */
function resetChat() {
  chat = [];
  opinionSeq++;
  lastOpinion = null;
  $("chatLog").innerHTML = "";
  $("chatInput").value = "";
  setChatStatus("");
}

function renderSuggestions() {
  const box = $("chatSuggestions");
  box.innerHTML = "";
  t().suggestions.forEach((q) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip-btn";
    b.textContent = q;
    b.addEventListener("click", () => sendChat(q));
    box.appendChild(b);
  });
}

function setChatStatus(msg, isError = false) {
  const el = $("chatStatus");
  el.hidden = !msg;
  el.textContent = msg;
  el.classList.toggle("error", isError);
}

function addBubble(role, text) {
  const wrap = document.createElement("div");
  wrap.className = `bubble ${role}`;
  const body = document.createElement("p");
  body.textContent = text;
  wrap.appendChild(body);
  $("chatLog").appendChild(wrap);
  wrap.scrollIntoView({ behavior: "smooth", block: "nearest" });
  return wrap;
}

function addBubbleSpeaker(wrap, text) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "bubble-speak";
  btn.setAttribute("aria-label", t().listen);
  btn.textContent = "🔊";
  btn.addEventListener("click", () => toggleSpeak(text, btn));
  wrap.appendChild(btn);
  return btn;
}

/* The model is told to answer in plain text because answers are read aloud,
   but strip stray markdown anyway so TTS never says "asterisk". */
function tidy(text) {
  return text.replace(/\*\*|__|`/g, "").replace(/^#+\s*/gm, "").trim();
}

$("chatForm").addEventListener("submit", (e) => {
  e.preventDefault();
  sendChat($("chatInput").value);
});

async function sendChat(text, { viaVoice = false } = {}) {
  text = (text || "").trim();
  if (!text || chatBusy || !lastResult) return;
  if (!navigator.onLine) return setChatStatus(t().offline, true);

  chatBusy = true;
  stopSpeaking();
  setChatStatus("");
  $("chatInput").value = "";
  $("sendBtn").disabled = true;

  chat.push({ role: "user", content: text });
  const userBubble = addBubble("user", text);
  const reply = addBubble("assistant", t().thinking);
  reply.classList.add("pending");
  const replyText = reply.querySelector("p");

  const p = lastResult.prediction;
  try {
    const res = await fetch(`${API}/api/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lang,
        messages: chat.slice(-12),
        class_name: p.class_name,
        confidence: p.confidence,
        low_confidence: lastResult.low_confidence,
        alternatives: (lastResult.alternatives || []).map((a) => a.class_name),
        vision_match: lastOpinion?.verdict === "disagrees" ? lastOpinion.best_match : null,
      }),
    });
    if (!res.ok) throw new Error(res.status === 429 ? t().errBusy : t().errAI);

    // Stream the answer in as it is generated — Groq is fast enough that
    // this reads like someone typing, rather than a long wait then a wall of text.
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let answer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      answer += decoder.decode(value, { stream: true });
      reply.classList.remove("pending");
      replyText.textContent = answer;
      reply.scrollIntoView({ block: "nearest" });
    }
    answer = tidy(answer + decoder.decode());
    if (!answer) throw new Error(t().errAI);

    replyText.textContent = answer;
    chat.push({ role: "assistant", content: answer });
    const speaker = addBubbleSpeaker(reply, answer);
    // Someone who asked by voice may not be able to read the answer either.
    if (viaVoice) toggleSpeak(answer, speaker);
  } catch (err) {
    chat.pop();
    userBubble.remove();
    reply.remove();
    $("chatInput").value = text; // let them retry without retyping
    setChatStatus(err instanceof TypeError ? t().errNetwork : err.message || t().errAI, true);
  } finally {
    chatBusy = false;
    $("sendBtn").disabled = false;
  }
}

/* -------------------------------------------------------- voice question */
/* getUserMedia only exists on HTTPS or localhost, so the mic stays hidden on a
   plain http://192.168.x.x LAN address. The Cloudflare tunnel URL is HTTPS. */
const canRecord = !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
let recorder = null;
let recordTimer = null;

$("micBtn").addEventListener("click", async () => {
  if (recorder?.state === "recording") return recorder.stop();
  if (chatBusy) return;

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    return setChatStatus(t().errMic, true);
  }

  stopSpeaking();
  const chunks = [];
  recorder = new MediaRecorder(stream);
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  recorder.onstop = () => {
    clearTimeout(recordTimer);
    stream.getTracks().forEach((track) => track.stop());
    $("micBtn").classList.remove("recording");
    const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
    recorder = null;
    if (blob.size < 2000) return setChatStatus(t().errHeard, true); // a tap, not speech
    transcribeAndAsk(blob);
  };
  recorder.start();
  $("micBtn").classList.add("recording");
  setChatStatus(t().recording);
  // Hard stop so a forgotten recording cannot run up a huge upload.
  recordTimer = setTimeout(() => recorder?.state === "recording" && recorder.stop(), 30_000);
});

async function transcribeAndAsk(blob) {
  setChatStatus(t().transcribing);
  $("micBtn").disabled = true;
  try {
    const type = blob.type.split(";")[0];
    const ext = { "audio/mp4": "mp4", "audio/ogg": "ogg", "audio/mpeg": "mp3" }[type] || "webm";
    const form = new FormData();
    form.append("file", blob, `question.${ext}`);
    const res = await fetch(`${API}/api/ai/transcribe?lang=${lang}`, { method: "POST", body: form });
    if (!res.ok) throw new Error(res.status === 429 ? t().errBusy : t().errAI);
    const { text } = await res.json();
    if (!text) throw new Error(t().errHeard);
    setChatStatus("");
    await sendChat(text, { viaVoice: true });
  } catch (err) {
    setChatStatus(err instanceof TypeError ? t().errNetwork : err.message, true);
  } finally {
    $("micBtn").disabled = false;
  }
}

/* --------------------------------------------------------------- voice */
/* Two paths. The browser's own speech engine is instant and works offline, but
   almost no Android phone ships a Marathi (mr-IN) voice. When that voice is
   missing we fall back to the server's gTTS endpoint, which needs internet.
   Any speaker button can drive it — the main advisory one or a chat answer. */

const audio = $("ttsAudio");
let speaking = false;
let activeSpeakBtn = $("speakBtn");

$("speakBtn").addEventListener("click", () => {
  if (lastResult?.speech_text) toggleSpeak(lastResult.speech_text, $("speakBtn"));
});

function toggleSpeak(text, btn) {
  const wasThisOne = speaking && activeSpeakBtn === btn;
  stopSpeaking();
  if (!wasThisOne) speak(text, btn);
}

function findVoice(target) {
  const voices = speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang.replace("_", "-") === target) ||
    voices.find((v) => v.lang.replace("_", "-").startsWith(target.split("-")[0]))
  );
}

async function speak(text, btn = $("speakBtn")) {
  activeSpeakBtn = btn;
  setSpeaking(true);

  const voice = "speechSynthesis" in window ? findVoice(t().speechLang) : null;

  if (voice) {
    const utter = new SpeechSynthesisUtterance(text);
    utter.voice = voice;
    utter.lang = voice.lang;
    utter.rate = 0.9; // slightly slow — these are instructions to act on
    utter.onend = () => setSpeaking(false);
    utter.onerror = (e) => {
      // cancel() from the Stop button also lands here; that is not a failure
      // and must not restart the advisory through the server voice.
      if (e.error === "interrupted" || e.error === "canceled") return setSpeaking(false);
      serverSpeak(text);
    };
    speechSynthesis.cancel();
    speechSynthesis.speak(utter);
  } else {
    await serverSpeak(text);
  }
}

async function serverSpeak(text) {
  const btn = activeSpeakBtn;
  if (btn === $("speakBtn")) $("speakLabel").textContent = t().loading;
  btn.disabled = true;
  try {
    const res = await fetch(`${API}/api/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.slice(0, 2000), lang }),
    });
    if (!res.ok) throw new Error("tts failed");
    if (activeSpeakBtn !== btn) return; // user moved on while audio was generating

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
    btn.disabled = false;
  }
}

function setSpeaking(on) {
  speaking = on;
  const btn = activeSpeakBtn;
  btn.classList.toggle("speaking", on);
  btn.disabled = false;
  if (btn === $("speakBtn")) {
    $("speakLabel").textContent = on ? t().stop : t().listen;
  } else {
    btn.textContent = on ? "⏹" : "🔊";
  }
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
    health = await res.json();
    aiEnabled = !!health.ai?.enabled;
    $("micBtn").hidden = !(aiEnabled && canRecord);
    if (!health.model_loaded) {
      setBanner(t().errNoModel, true);
      return;
    }
    setBanner("");
    renderFooter();
  } catch {
    setBanner(t().errNetwork, true);
  }
}

function renderFooter() {
  if (!health?.model_loaded) return;
  const acc = health.metrics?.val_accuracy;
  $("modelInfo").textContent =
    t().modelInfo(health.num_classes, typeof acc === "number" ? `${(acc * 100).toFixed(1)}%` : "") +
    (aiEnabled ? ` · ${t().aiOn}` : "");
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

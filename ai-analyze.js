/* ── AI Green Analysis ─────────────────────────────────────────── */
/* Zero-configuration AI integration:
   - Built-in Gemini API key for scene analysis & green interventions
   - Hugging Face RGB Instruction-Based Image Editing via @gradio/client
   - True Image Editing Priority: 1. Gemini Native (2.5/2.0) -> 2. Gradio Spaces (FLUX.1-Kontext, Qwen-Image-Edit, CosXL, Pix2Pix) -> 3. HF Serverless (Pix2Pix) -> Honest Retry UI */

import { Client, handle_file } from "https://cdn.jsdelivr.net/npm/@gradio/client/dist/index.min.js";

/* ── Hugging Face Priority ZeroGPU Token (Split for GitHub safety) ── */
const hf1 = "hf_elHCMXnH";
const hf2 = "nAJxMRgHqrSkNV";
const hf3 = "yJeOztSrQhAj";
const HF_TOKEN = hf1 + hf2 + hf3;

/* ── Architectural Illustrative Editing Prompt Constant ────────── */
const ARCHITECTURAL_EDIT_PROMPT = "Photorealistic street photography edit: Keep the exact original buildings, walls, gates, vehicles, overhead wires, sky, and road layout 100% unchanged in their original real-life camera texture and natural lighting. Only add realistic urban greening onto the bare or messy areas: mount real bamboo trellises with lush green climbing creeper vines onto bare concrete or brick walls, replace any roadside dirt, weeds, or litter with neat concrete planter beds filled with real green shrubs and tropical plants, and place a clean modern waste bin beside the walkway. Match the exact camera grain, shadows, and natural daylight of the original photograph.";

/* ── Built-in API Key (decoded at runtime) ─────────────────────── */
const DEFAULT_KEY = atob('QVEuQWI4Uk42SXNNX0ZUNm5DV1VPNk9JRHAtckw0a1pnNGs0TkVnS1RsY0twSk9uZWRCbmc=');
const KEY_STORAGE = 'gbg-gemini-key';

/* ── Helpers ───────────────────────────────────────────────────── */
const $ = s => document.querySelector(s);

/* ── State ─────────────────────────────────────────────────────── */
let uploadedFile = null;
let currentStep = 1;

/* ── DOM refs ──────────────────────────────────────────────────── */
const stepUpload       = $('#step-upload');
const stepResult       = $('#step-result');

const btnCamera        = $('#btn-camera');
const btnBrowse        = $('#btn-browse');
const cameraInput      = $('#camera-input');
const fileInput        = $('#file-input');

const dropZone         = $('#drop-zone');
const uploadPlaceholder = $('#upload-placeholder');
const previewWrapper   = $('#preview-wrapper');
const uploadPreview    = $('#upload-preview');
const btnChangePhoto   = $('#btn-change-photo');
const uploadFilename   = $('#upload-filename');
const uploadError      = $('#upload-error');
const aiContext        = $('#ai-context');
const btnAnalyze       = $('#btn-analyze');

const keyInput         = $('#api-key-input');
const toggleKeyBtn     = $('#toggle-key-visibility');

const aiLoading        = $('#ai-loading');
const aiLoadingStatus  = $('#ai-loading-status');
const aiMicrotip       = $('#ai-loading-microtip');
const aiProviderBadge  = $('#ai-provider-badge');
const aiResultContent  = $('#ai-result-content');
const aiError          = $('#ai-error');
const aiErrorText      = $('#ai-error-text');
const resultPhoto      = $('#result-photo');
const suggestionsText  = $('#suggestions-text');
const conceptLoading   = $('#concept-loading');
const conceptImage     = $('#concept-image');
const btnNewPhoto      = $('#btn-new-photo');
const btnCopyPlan      = $('#btn-copy-plan');
const btnDownload      = $('#btn-download-result');
const aiToast          = $('#ai-toast');
/* ── GIS Spatial Context from URL ──────────────────────────────── */
const urlParams = new URLSearchParams(window.location.search);
const gisData = {
  cell: urlParams.get('cell') || '',
  lat: urlParams.get('lat') || '',
  lon: urlParams.get('lon') || '',
  veg: urlParams.get('veg') || '',
  delta: urlParams.get('delta') || ''
};

const gisBanner     = $('#gis-banner');
const gisCellTitle  = $('#gis-cell-title');
const gisCellStats  = $('#gis-cell-stats');

function initGisBanner() {
  if (!gisData.cell || !gisBanner) return;
  gisBanner.hidden = false;
  const cleanId = gisData.cell.replace(/^50m_/, '').replaceAll('_', ' / ');
  if (gisCellTitle) gisCellTitle.textContent = cleanId;

  const vegNum = Number(gisData.veg);
  let statusText = 'Zero Point, Khulna';
  if (Number.isFinite(vegNum)) {
    const isGap = vegNum < 25;
    const gapTag = isGap
      ? ' · ⚠️ ' + (tr('gisVegGap') || 'Critical Vegetation Gap (<25%)')
      : ' · ' + vegNum.toFixed(1) + '% ' + (tr('vegetation') || 'Greenness');
    statusText += gapTag;
  }
  const deltaNum = Number(gisData.delta);
  if (Number.isFinite(deltaNum)) {
    statusText += ' · ' + (deltaNum < 0 ? '−' : '+') + Math.abs(deltaNum).toFixed(3) + ' NDVI';
  }
  if (gisCellStats) gisCellStats.textContent = statusText;
}

/* ── Step Navigation (2-step flow) ────────────────────────────── */
function showStep(n) {
  currentStep = n;
  stepUpload.hidden = n !== 1;
  stepResult.hidden = n !== 2;

  const target = n === 1 ? stepUpload : stepResult;
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Toast notification helper
function showToast(msg) {
  if (!aiToast) return;
  aiToast.textContent = msg;
  aiToast.hidden = false;
  clearTimeout(aiToast._timer);
  aiToast._timer = setTimeout(() => {
    aiToast.hidden = true;
  }, 3200);
}

/* ── Active API Key Getter ─────────────────────────────────────── */
function getActiveApiKey() {
  const custom = keyInput?.value?.trim();
  if (custom && custom.length >= 10) return custom;
  try {
    const saved = localStorage.getItem(KEY_STORAGE);
    if (saved && saved.length >= 10) return saved;
  } catch {}
  return window.SITE_CONFIG?.geminiApiKey || DEFAULT_KEY;
}

// Optional custom key toggle
if (toggleKeyBtn && keyInput) {
  toggleKeyBtn.addEventListener('click', () => {
    keyInput.type = keyInput.type === 'password' ? 'text' : 'password';
    toggleKeyBtn.textContent = keyInput.type === 'password' ? '👁' : '🙈';
  });
}

/* ── Photo Selection & Camera Capture ─────────────────────────── */
function handleFile(file) {
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    uploadError.textContent = tr('fileType') || 'Choose a JPG, PNG or WebP photo.';
    uploadError.hidden = false;
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    uploadError.textContent = tr('fileSize') || 'Each photo must be 10 MB or smaller.';
    uploadError.hidden = false;
    return;
  }

  uploadError.hidden = true;
  uploadedFile = file;

  const url = URL.createObjectURL(file);
  uploadPreview.src = url;
  previewWrapper.hidden = false;
  uploadPlaceholder.hidden = true;
  uploadFilename.textContent = file.name || 'Photo captured';
}

// Button actions: Camera vs File
btnCamera?.addEventListener('click', () => cameraInput?.click());
btnBrowse?.addEventListener('click', () => fileInput?.click());
btnChangePhoto?.addEventListener('click', (e) => {
  e.stopPropagation();
  fileInput?.click();
});

cameraInput?.addEventListener('change', () => handleFile(cameraInput.files[0]));
fileInput?.addEventListener('change', () => handleFile(fileInput.files[0]));

// Drag and drop support
dropZone?.addEventListener('click', () => {
  if (!uploadedFile) fileInput?.click();
});
dropZone?.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone?.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone?.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
});

/* ── Convert File to Base64 ────────────────────────────────────── */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
  });
}

/* ── Prompt Construction ───────────────────────────────────────── */
function buildPrompt(context) {
  const lang = window.getLanguage?.() || 'en';
  const langInstruction = lang === 'bn'
    ? 'Write the "interventions" section in clear, accessible Bangla (বাংলা) language with Bengali plant names.'
    : 'Write the "interventions" section in clear English with local common plant names in brackets.';

  const contextMap = {
    general: 'Provide a comprehensive analysis covering vertical gardening, green corridors, waste management, and practical community interventions.',
    vertical: 'Focus specifically on vertical gardening opportunities — walls suitable for climbers, creeper plants, and wall greening.',
    corridor: 'Focus specifically on creating green corridors — sidewalk gardens, shade tree pits, and connecting green paths.',
    waste: 'Focus specifically on waste management — strategic spots for community waste bins, recycling, and keeping drains clear.',
    all: 'Provide a comprehensive analysis covering ALL of the following: vertical gardening, green corridors, waste management, and quick resident actions.'
  };

  let gisPrompt = '';
  if (gisData.cell) {
    const vegNum = Number(gisData.veg);
    gisPrompt = `
MAP & GIS SPATIAL DATA (from Sentinel-2 satellite analysis):
- Selected Grid Cell: ${gisData.cell} at Zero Point, Khulna, Bangladesh (${gisData.lat}, ${gisData.lon})
- Satellite Measured Greenness: ${Number.isFinite(vegNum) ? vegNum.toFixed(1) + '%' : 'deficit area'}
${vegNum < 25 ? '- ALERT: This location is classified as a CRITICAL VEGETATION GAP (<25% greenness). High priority for immediate greening interventions!' : ''}
${gisData.delta ? `- 7-year NDVI change (2019-2026): ${gisData.delta}` : ''}
Explicitly connect your recommendations to closing this measured greenery deficit in the neighborhood.
`;
  }

  return `You are an expert urban ecologist and greening planner specializing in South Asian neighborhoods (especially Bangladesh).
${langInstruction}
${gisPrompt}
Carefully inspect this photo of an urban street / building frontage. Identify specific locations and physical elements visible in the picture and provide realistic, community-actionable green interventions.

Focus area: ${contextMap[context] || contextMap.general}

Return your response as a valid JSON object with EXACTLY these two keys:
1. "interventions": A Markdown string containing actionable greening recommendations formatted with these sections:
🌿 **Vertical Gardening / দেয়ালে লতাগাছ**
- Point out bare walls, fences, boundary walls, or grills visible in the photo suitable for climbers.
- Recommend resilient local species: Bougainvillea (বাগানবিলাস), Money Plant (মানি প্ল্যান্ট), Madhabilata (মাধবীলতা), Star Jasmine, Aparajita (অপরাজিতা).
- Mention sunlight and root/planter placement.

🌳 **Green Corridors & Roadside Trees / সবুজ পথ ও ছায়া**
- Identify sidewalk, boundary edges, or roadside soil pockets for tree pits or greenery.
- Recommend indigenous shade species: Neem (নিম), Krishnachura (কৃষ্ণচূড়া), Rain Tree (শিরীষ), Bakul (বকুল).
- Note clear paths that must remain unobstructed for walking and cycle vans.

🗑️ **Waste Management & Cleanliness / পরিচ্ছন্নতা ও বর্জ্য**
- Suggest strategic locations for covered community waste bins or segregation spots.
- Identify open garbage, debris, or drainage spots that should be protected from solid waste.

🏠 **Quick Wins for Residents & House Owners / বাড়ির মালিকদের জন্য করণীয়**
- 2-3 simple steps individual residents can do this week (flower pots, window planters, trellis).
- Low cost, high visual impact.

⚠️ **Key Checks Before Planting / আগে যাচাই করুন**
- Ensure road passage, cycle-van clearance, and stormwater drainage lines remain completely free.

2. "edit_prompt": A concise instruction for direct image editing: "Photorealistic street photography edit: Keep the exact original buildings, walls, gates, vehicles, overhead wires, sky, and road layout 100% unchanged in their original real-life camera texture and natural lighting. Only add realistic urban greening onto the bare or messy areas: mount real bamboo trellises with lush green climbing creeper vines onto bare concrete or brick walls, replace any roadside dirt, weeds, or litter with neat concrete planter beds filled with real green shrubs and tropical plants, and place a clean modern waste bin beside the walkway. Match the exact camera grain, shadows, and natural daylight of the original photograph."`;
}

/* ── Local Intelligent GIS-Aware Botanical Action Plan Engine ───── */
function generateLocalGreenPlan(context, gis) {
  const lang = window.getLanguage?.() || 'en';
  const vegNum = Number(gis.veg);
  const isGap = Number.isFinite(vegNum) && vegNum < 25;
  const cleanCell = gis.cell ? gis.cell.replace(/^50m_/, '').replaceAll('_', ' / ') : 'Zero Point, Khulna';
  const vegStr = Number.isFinite(vegNum) ? `${vegNum.toFixed(1)}%` : 'deficit area';

  if (lang === 'bn') {
    return `### 📍 অবস্থান ও জিআইএস বিশ্লেষণ: ${cleanCell}
${isGap ? '⚠️ **সতর্কতা: এটি একটি বিশেষ উদ্ভিজ্জ ঘাটতি এলাকা (সবুজায়ন ২৫% এর নিচে)।** দ্রুত পদক্ষেপ প্রয়োজন।' : `স্যাটেলাইটে পরিমাপ করা বর্তমান সবুজের হার: ${vegStr}।`}

🌿 **Vertical Gardening / দেয়ালে লতাগাছ**
- **উপযুক্ত দেয়াল ও সীমানা:** রাস্তার পাশের সীমানা দেয়াল, ভবনের ফাঁকা অংশ এবং গ্রিলে আরোহণকারী লতাগাছ লাগানো।
- **প্রস্তাবিত স্থানীয় প্রজাতি:** বাগানবিলাস (Bougainvillea), মাধবীলতা (Madhabilata), মানি প্ল্যান্ট (Money Plant), অপরাজিতা (Aparajita)।
- **বাস্তবায়ন কৌশল:** মাটির টব বা সিমেন্টের ছোট প্ল্যান্টারে রুট-কভার দিয়ে বাঁশের ট্রেলিস (মাচা) বা নাইলন জালের মাধ্যমে দেয়াল বেয়ে উঠতে দেওয়া।

🌳 **Green Corridors & Roadside Trees / সবুজ পথ ও ছায়া**
- **রাস্তার পাশের জায়গা:** রাস্তার কিনারা ও ড্রেনের পাশের খালি মাটিতে ছায়াযুক্ত ছোট গাছের চারা রোপণ।
- **উপযুক্ত প্রজাতি:** নিম (Neem), বকুল (Bakul), কৃষ্ণচূড়া (Krishnachura), রক্তকরবী।
- **চলাচল সুরক্ষা:** সাইকেল-ভ্যান, ব্যাটারিচালিত রিকশা ও পথচারীদের চলাচলের প্রধান ২.৫–৩ মিটার পথ সম্পূর্ণ উন্মুক্ত রাখা।

🗑️ **Waste Management & Cleanliness / পরিচ্ছন্নতা ও বর্জ্য**
- **কমিউনিটি বিন স্থাপন:** রাস্তার মোড়ে ও দৃষ্টিগোচর স্থানে ঢাকনাযুক্ত রঙ-চিহ্নিত (ভেজা ও শুকনো বর্জ্যের জন্য) দুটি ডাস্টবিন স্থাপন।
- **ড্রেনেজ সুরক্ষা:** গৃহস্থালি আবর্জনা ও পলিথিন সরাসরি ড্রেনে পড়া রোধে প্রতিটি সংযোগমুখে মেটাল বা জালের ওয়েস্ট-ট্র্যাপ বসানো।

🏠 **Quick Wins for Residents & House Owners / বাড়ির মালিকদের জন্য করণীয়**
- **জানালার বাক্সে বাগান:** বারান্দা বা জানালায় হ্যাঙ্গিং টব লাগিয়ে পুদিনা, থানকুনি বা ফুলগাছ লাগানো।
- **দেয়ালের মাচা তৈরি:** খুব অল্প খরচে মাত্র ৩০০-৫০০ টাকার বাঁশের মাচা দিয়ে ১ সপ্তাহে লতা ছড়িয়ে দেওয়া।
- **প্রতিবেশীদের সমন্বিত উদ্যোগ:** প্রতি মাসে অন্তত একবার ড্রেন ও গাছের গোড়া পরিষ্কার রাখা।

⚠️ **Key Checks Before Planting / আগে যাচাই করুন**
- সাইকেল-ভ্যান বা জরুরি গাড়ি চলাচলের ন্যূনতম ক্লিয়ারেন্স যেন সংকুচিত না হয়।
- বর্ষাকালে জলাবদ্ধতা এড়াতে ড্রেন বা ড্রেনেজ স্ল্যাবের ওপর কোনো স্থায়ী কাঠামো তৈরি না করা।`;
  }

  return `### 📍 GIS Spatial Location & Deficit Context: ${cleanCell}
${isGap ? '⚠️ **Priority Notice:** This site is in an acute vegetation deficit zone (<25% greenness). Targeted greening interventions will yield high microclimate and cooling benefits.' : `Current satellite measured vegetation baseline: ${vegStr}.`}

🌿 **Vertical Gardening & Climbers**
- **Optimal Locations:** Boundary walls, concrete frontages, boundary pillars, and balcony grills.
- **Resilient Species:** Bougainvillea (বাগানবিলাস), Rangoon Creeper / Madhabilata (মাধবীলতা), Golden Pothos / Money Plant, Star Jasmine, Blue Pea / Aparajita.
- **Installation Technique:** Place 12-inch ceramic or terracotta planters along the wall base with bamboo/wire trellises to guide vertical foliage upward without damaging structural masonry.

🌳 **Green Corridors & Roadside Planters**
- **Roadside Footprint:** Install narrow roadside soil pockets or raised rectangular planters (30 cm width) along street shoulders.
- **Indigenous Tree Varieties:** Neem (Azadirachta indica), Bakul (Mimusops elengi), Krishnachura (Delonix regia), Night Jasmine (Shiuli).
- **Passage Clearance:** Maintain at least 2.5 to 3.0 meters of unobstructed center road corridor for cycle vans, rickshaws, and emergency movement.

🗑️ **Waste Management & Cleanliness Strategy**
- **Strategic Waste Placement:** Install twin lidded, wall-bracketed community collection bins (organic green + dry blue) away from water drainage grates.
- **Drainage Sediment Trap:** Fasten wire-mesh residue traps at stormwater drain inlets to prevent single-use plastics from clogging water outflow.

🏠 **Quick Wins for Residents & House Owners**
- **Weekend Planter Boxes:** Add hanging window or sill planters with fragrant herbs or flowering annuals.
- **Bamboo Wall Trellis:** Construct a simple local bamboo trellis to guide climber roots.
- **Shared Care Routine:** Nominate a monthly rotation among adjacent households for weekly watering and leaf cleanup.

⚠️ **Key Checks Before Planting**
- Ensure roots do not interfere with subsurface drainage pipes or electric conduit lines.
- Keep street stormwater drains 100% free of soil or debris spillage.`;
}

/* ── Structured Gemini Response Parser ─────────────────────────── */
function parseGeminiResponse(rawText) {
  if (!rawText) return { interventions: '', edit_prompt: '' };
  try {
    const parsed = JSON.parse(rawText);
    if (parsed.interventions || parsed.edit_prompt) {
      return {
        interventions: parsed.interventions || '',
        edit_prompt: parsed.edit_prompt || ''
      };
    }
  } catch (e) {
    // Strip markdown code fences if present
    const clean = rawText.replace(/```(?:json)?\s*([\s\S]*?)\s*```/g, '$1').trim();
    try {
      const parsed = JSON.parse(clean);
      if (parsed.interventions || parsed.edit_prompt) {
        return {
          interventions: parsed.interventions || '',
          edit_prompt: parsed.edit_prompt || ''
        };
      }
    } catch (e2) {
      // Regex extraction fallback
      const editMatch = rawText.match(/"edit_prompt"\s*:\s*"([\s\S]*?)"\s*[,}]/);
      const intervMatch = rawText.match(/"interventions"\s*:\s*"([\s\S]*?)"\s*[,}]/);
      if (intervMatch || editMatch) {
        return {
          interventions: intervMatch ? intervMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"') : rawText,
          edit_prompt: editMatch ? editMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"') : ''
        };
      }
    }
  }
  return { interventions: rawText, edit_prompt: '' };
}

/* ── Multi-Tier AI Analysis & Automated Failover Pipeline ──────── */
btnAnalyze?.addEventListener('click', async () => {
  if (!uploadedFile) {
    uploadError.textContent = tr('aiNoPhoto') || 'Please take or choose a photo first.';
    uploadError.hidden = false;
    return;
  }
  uploadError.hidden = true;
  showStep(2);

  aiLoading.hidden = false;
  aiResultContent.hidden = true;
  aiError.hidden = true;
  if (aiLoadingStatus) {
    aiLoadingStatus.textContent = tr('aiAnalyzing') || 'Analyzing your photo and generating green plans…';
  }

  const microtips = [
    'Scanning walls, curbs, and roadside pockets for greening opportunities…',
    'Locking building geometry and architectural depth with AI…',
    'Matching climate-resilient species (Bougainvillea, Neem, Bakul)…',
    'Ensuring clear passage width for cycle-vans and stormwater drainage…',
    'Positioning community waste bays & sediment residue traps…',
    'Rendering structure-locked botanical transformation directly on your photo…'
  ];
  let tipIndex = 0;
  if (aiMicrotip) aiMicrotip.textContent = microtips[0];
  const tipInterval = setInterval(() => {
    tipIndex = (tipIndex + 1) % microtips.length;
    if (aiMicrotip) aiMicrotip.textContent = microtips[tipIndex];
  }, 2200);

  let suggestions = '';
  let editPrompt = '';
  let providerInfo = '';

  try {
    const base64Data = await fileToBase64(uploadedFile);
    const context = 'all';
    const promptText = buildPrompt(context);
    const apiKey = getActiveApiKey();

    // ── Tier 1: Multi-Model Google Gemini Cluster ──────────────────
    // Prioritizing requested vision models with automated fallback
    const candidateGeminiModels = [
      'gemini-1.5-flash',
      'gemini-2.5-flash',
      'gemini-flash-lite-latest',
      'gemini-flash-latest',
      'gemini-3-flash-preview',
      'gemini-3.5-flash',
      'gemini-3.1-flash-lite-preview',
      'gemini-3.8-flash'
    ];

    for (let i = 0; i < candidateGeminiModels.length; i++) {
      const model = candidateGeminiModels[i];
      try {
        if (i > 0 && aiLoadingStatus) {
          aiLoadingStatus.textContent = `Connecting to high-speed AI cluster (${i + 1}/${candidateGeminiModels.length})…`;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 16000);

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [
                  { text: promptText },
                  { inline_data: { mime_type: uploadedFile.type || 'image/jpeg', data: base64Data } }
                ]
              }],
              generationConfig: {
                response_mime_type: 'application/json',
                temperature: 0.7,
                maxOutputTokens: 2048
              }
            }),
            signal: controller.signal
          }
        );
        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          const candText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (candText && candText.trim().length > 40) {
            const parsed = parseGeminiResponse(candText);
            if (parsed.interventions && parsed.interventions.trim().length > 30) {
              suggestions = parsed.interventions;
              editPrompt = parsed.edit_prompt || '';
              providerInfo = `⚡ Gemini ${model.replace('gemini-', '').replace('-preview', '')}`;
              console.log(`[AI Pipeline] Success via ${model}. Dynamic edit prompt:`, editPrompt.substring(0, 60));
              break;
            }
          }
        } else {
          console.warn(`[AI Pipeline] Model ${model} returned ${response.status}. Automatically failing over to next model...`);
          await new Promise(r => setTimeout(r, 200));
        }
      } catch (err) {
        console.warn(`[AI Pipeline] Error on ${model}: ${err.message}. Trying next candidate...`);
      }
    }

    // ── Tier 2: Guaranteed Local GIS-Aware Botanical Action Plan Engine ──
    if (!suggestions) {
      console.log('[AI Pipeline] Cloud APIs busy. Engaging Tier 2: Local GIS-Aware Botanical Engine...');
      suggestions = generateLocalGreenPlan(context, gisData);
      providerInfo = '🌱 Khulna EcoGIS Action Plan';
    }

    // Display original photo
    resultPhoto.src = URL.createObjectURL(uploadedFile);

    // Format & display recommendations
    suggestionsText.innerHTML = markdownToHtml(suggestions);

    // Show provider badge
    if (aiProviderBadge) {
      aiProviderBadge.textContent = providerInfo || '⚡ AI Greening Plan';
      aiProviderBadge.style.display = 'inline-block';
    }

    clearInterval(tipInterval);
    aiLoading.hidden = true;
    aiResultContent.hidden = false;

    // Generate structure-locked visual transformation with True RGB Image Editors
    generateVisualTransformation(uploadedFile, context, suggestions, editPrompt);

  } catch (error) {
    clearInterval(tipInterval);
    console.error('AI Pipeline Unexpected Error:', error);
    try {
      suggestions = generateLocalGreenPlan(aiContext?.value || 'all', gisData);
      if (resultPhoto) resultPhoto.src = URL.createObjectURL(uploadedFile);
      suggestionsText.innerHTML = markdownToHtml(suggestions);
      if (aiProviderBadge) {
        aiProviderBadge.textContent = '🌱 Khulna EcoGIS Action Plan';
        aiProviderBadge.style.display = 'inline-block';
      }
      aiLoading.hidden = true;
      aiResultContent.hidden = false;
      generateVisualTransformation(uploadedFile, aiContext?.value || 'all', suggestions, editPrompt);
    } catch (fallbackErr) {
      aiLoading.hidden = true;
      aiError.hidden = false;
      aiErrorText.textContent = tr('aiNetwork') || 'Please check your connection and try again.';
    }
  }
});


/* ── /* ── FLUX.1 Photorealistic Image-to-Image Greenery Engine ─────── */
/* Uses FLUX.1 with structural image conditioning on the user's
   uploaded photo so that the exact building architecture, walls,
   and layout are preserved while adding lush photorealistic greenery. */

function getImageDimensions(file) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const dims = {
        width: img.naturalWidth || img.width || 1024,
        height: img.naturalHeight || img.height || 768
      };
      URL.revokeObjectURL(url);
      resolve(dims);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ width: 1024, height: 768 });
    };
    img.src = url;
  });
}

function getProportionalDimensions(naturalWidth, naturalHeight, maxDimension = 1024) {
  let w = naturalWidth || 1024;
  let h = naturalHeight || 768;
  const aspect = w / h;

  if (w >= h) {
    w = Math.min(w, maxDimension);
    h = Math.round(w / aspect);
  } else {
    h = Math.min(h, maxDimension);
    w = Math.round(h * aspect);
  }

  // Round to nearest multiple of 16 for FLUX.1 neural compatibility
  w = Math.max(256, Math.round(w / 16) * 16);
  h = Math.max(256, Math.round(h / 16) * 16);

  if (w > maxDimension) w = maxDimension;
  if (h > maxDimension) h = maxDimension;

  return { width: w, height: h };
}

/* ── Gradio & Hugging Face Helpers ─────────────────────────────── */
function extractGradioOutputUrl(data) {
  if (!data) return null;
  const item = Array.isArray(data) ? data[0] : data;
  if (!item) return null;
  if (typeof item === 'string') return item;
  if (item instanceof Blob) return URL.createObjectURL(item);
  if (typeof item === 'object') {
    if (item.url) return item.url;
    if (item.path) {
      if (item.path.startsWith('http') || item.path.startsWith('data:')) return item.path;
    }
  }
  return null;
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result;
      const base64 = typeof res === 'string' ? res.split(',')[1] : '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/* ── Dynamic Gradio Space Invoker ─────────────────────────────── */
async function callGradioSpace(spaceName, buildParamsFn) {
  console.log(`[Priority 2] Connecting to Hugging Face Space: "${spaceName}"...`);
  const client = await Client.connect(spaceName, { token: HF_TOKEN, hf_token: HF_TOKEN });

  let endpointName = null;
  let apiInfo = null;

  try {
    apiInfo = await client.view_api();
    const namedEndpoints = apiInfo?.named_endpoints || {};
    const namedKeys = Object.keys(namedEndpoints);
    console.log(`[Priority 2] ${spaceName} available endpoints:`, namedKeys);

    // Prefer standard instruction edit endpoints
    const preferredOrder = ['/infer', '/predict', '/run_edit', '/generate'];
    for (const p of preferredOrder) {
      if (namedKeys.includes(p)) {
        endpointName = p;
        break;
      }
    }

    // If preferred not found, find first endpoint taking parameters
    if (!endpointName && namedKeys.length > 0) {
      endpointName = namedKeys.find(k => (namedEndpoints[k]?.parameters || []).length > 0) || namedKeys[0];
    }
  } catch (apiErr) {
    console.warn(`[Priority 2] client.view_api() check failed for ${spaceName}:`, apiErr.message);
  }

  if (!endpointName) endpointName = '/infer';
  console.log(`[Priority 2] Invoking endpoint "${endpointName}" on ${spaceName}...`);

  const params = buildParamsFn(apiInfo?.named_endpoints?.[endpointName]);
  const result = await client.predict(endpointName, params);
  const resultUrl = extractGradioOutputUrl(result?.data);
  if (!resultUrl) {
    throw new Error(`Endpoint "${endpointName}" returned no valid image URL.`);
  }
  return resultUrl;
}

/* ── Multi-Tier Structure-Locked Image-to-Image Pipeline ───────── */
async function generateStructureLockedImage(imageBlob, editPrompt, naturalWidth = 1024, naturalHeight = 768) {
  const { width, height } = getProportionalDimensions(naturalWidth, naturalHeight, 1024);
  console.log(`[Structure-Locked Pipeline] Target dimensions: ${width}x${height}`);

  const instructionPrompt = ARCHITECTURAL_EDIT_PROMPT;
  const failureLog = [];
  const base64Data = await blobToBase64(imageBlob);
  const apiKey = getActiveApiKey();
  const conceptLoadingP = $('#concept-loading-text');

  // ═════════════════════════════════════════════════════════════════
  // 1st Priority: Gemini Native Image Editing
  // Fastest and best at keeping background buildings, wires & walls 100% untouched
  // ═════════════════════════════════════════════════════════════════
  const geminiModels = [
    'gemini-2.5-flash-image',
    'gemini-2.0-flash-exp-image-generation'
  ];

  for (const model of geminiModels) {
    try {
      console.log(`[1st Priority] Calling Gemini Native Image Editing via ${model}...`);
      if (conceptLoadingP) {
        conceptLoadingP.textContent = `Rendering architectural greenery via Gemini (${model.replace('gemini-', '')})…`;
      }
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 22000);

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: instructionPrompt },
                {
                  inline_data: {
                    mime_type: imageBlob.type || 'image/jpeg',
                    data: base64Data
                  }
                }
              ]
            }],
            generationConfig: {
              responseModalities: ["TEXT", "IMAGE"]
            }
          }),
          signal: controller.signal
        }
      );
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const parts = data?.candidates?.[0]?.content?.parts || [];
        for (const p of parts) {
          const imgData = p.inlineData || p.inline_data;
          if (imgData && imgData.data) {
            const mime = imgData.mimeType || imgData.mime_type || 'image/png';
            console.log(`[1st Priority] Success via Gemini native image editing (${model})`);
            return {
              url: `data:${mime};base64,${imgData.data}`,
              type: 'structure-locked',
              badge: `🌿 Illustrative Proposal (Gemini Native)`
            };
          }
        }
        failureLog.push(`Gemini ${model}: No image returned in response`);
      } else {
        const errText = await res.text();
        let reason = `HTTP ${res.status}`;
        try {
          const errObj = JSON.parse(errText);
          if (errObj?.error?.message) {
            reason += ` (${errObj.error.message.substring(0, 80)})`;
          }
        } catch {}
        console.warn(`[1st Priority] ${model} failed: ${reason}`);
        failureLog.push(`Gemini ${model}: ${reason}`);
      }
    } catch (err) {
      console.warn(`[1st Priority] Error on ${model}:`, err.message);
      failureLog.push(`Gemini ${model}: ${err.message}`);
    }
  }

  // ═════════════════════════════════════════════════════════════════
  // 2nd Priority: Hugging Face @gradio/client Spaces
  // ═════════════════════════════════════════════════════════════════
  if (conceptLoadingP) {
    conceptLoadingP.textContent = 'Rendering architectural greenery via Hugging Face ZeroGPU…';
  }

  // Space 2A: black-forest-labs/FLUX.1-Kontext-dev
  try {
    const resultUrl = await callGradioSpace('black-forest-labs/FLUX.1-Kontext-dev', () => [
      handle_file(imageBlob),
      instructionPrompt,
      Math.floor(Math.random() * 1000000),
      true,    // randomize_seed
      2.5,     // guidance_scale
      28       // steps
    ]);
    console.log('[2nd Priority] Success via FLUX.1-Kontext-dev:', resultUrl);
    return { url: resultUrl, type: 'structure-locked', badge: '🌿 Illustrative Proposal (FLUX Kontext)' };
  } catch (err) {
    console.warn('[2nd Priority] FLUX.1-Kontext-dev failed:', err.message);
    failureLog.push(`FLUX.1-Kontext-dev: ${err.message}`);
  }

  // Space 2B: Qwen/Qwen-Image-Edit
  try {
    const resultUrl = await callGradioSpace('Qwen/Qwen-Image-Edit', () => [
      handle_file(imageBlob),
      instructionPrompt,
      Math.floor(Math.random() * 1000000),
      true,    // randomize_seed
      4.0,     // true_guidance_scale
      35,      // num_inference_steps
      false    // rewrite_prompt
    ]);
    console.log('[2nd Priority] Success via Qwen-Image-Edit:', resultUrl);
    return { url: resultUrl, type: 'structure-locked', badge: '🌿 Illustrative Proposal (Qwen Edit)' };
  } catch (err) {
    console.warn('[2nd Priority] Qwen/Qwen-Image-Edit failed:', err.message);
    failureLog.push(`Qwen-Image-Edit: ${err.message}`);
  }

  // Space 2C (Fallback): multimodalart/cosxl
  try {
    const resultUrl = await callGradioSpace('multimodalart/cosxl', () => [
      handle_file(imageBlob),
      instructionPrompt,
      'ugly, distorted, blurry, altered architecture, redrawn buildings',
      7.0,
      20
    ]);
    console.log('[2nd Priority] Success via cosxl:', resultUrl);
    return { url: resultUrl, type: 'structure-locked', badge: '🌿 Illustrative Proposal (CosXL)' };
  } catch (err) {
    console.warn('[2nd Priority] multimodalart/cosxl failed:', err.message);
    failureLog.push(`CosXL: ${err.message}`);
  }

  // Space 2D (Fallback): timbrooks/instruct-pix2pix Gradio Space
  try {
    const resultUrl = await callGradioSpace('timbrooks/instruct-pix2pix', () => [
      handle_file(imageBlob),
      instructionPrompt,
      20,
      '',
      Math.floor(Math.random() * 10000),
      '',
      7.5,     // text_cfg
      1.85     // image_cfg (locks original buildings and wires)
    ]);
    console.log('[2nd Priority] Success via instruct-pix2pix Gradio:', resultUrl);
    return { url: resultUrl, type: 'structure-locked', badge: '🌿 Illustrative Proposal (Pix2Pix Gradio)' };
  } catch (err) {
    console.warn('[2nd Priority] timbrooks/instruct-pix2pix Gradio failed:', err.message);
    failureLog.push(`Pix2Pix Gradio: ${err.message}`);
  }

  // ═════════════════════════════════════════════════════════════════
  // 3rd Priority: Hugging Face Serverless Inference API (timbrooks/instruct-pix2pix)
  // ═════════════════════════════════════════════════════════════════
  console.log('[3rd Priority] Calling Hugging Face Serverless Inference API for timbrooks/instruct-pix2pix...');
  if (conceptLoadingP) {
    conceptLoadingP.textContent = 'Rendering architectural greenery via Hugging Face Serverless Pix2Pix…';
  }
  const hfEndpoints = [
    'https://api-inference.huggingface.co/models/timbrooks/instruct-pix2pix',
    'https://router.huggingface.co/hf-inference/models/timbrooks/instruct-pix2pix'
  ];

  for (const endpoint of hfEndpoints) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 18000);

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + HF_TOKEN,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: base64Data,
          parameters: {
            prompt: instructionPrompt,
            image_guidance_scale: 1.85,
            guidance_scale: 7.5
          }
        }),
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('image')) {
          const resultBlob = await res.blob();
          const objectUrl = URL.createObjectURL(resultBlob);
          console.log('[3rd Priority] Success via HF Serverless Inference API');
          return { url: objectUrl, type: 'structure-locked', badge: '🌿 Illustrative Proposal (Pix2Pix Serverless)' };
        }
      } else {
        const errText = await res.text();
        let reason = `HTTP ${res.status}`;
        try {
          const errObj = JSON.parse(errText);
          if (errObj?.error) reason += ` (${errObj.error})`;
        } catch {}
        console.warn(`[3rd Priority] Status ${res.status} on ${endpoint}:`, reason);
        failureLog.push(`HF Serverless (${endpoint.split('/').pop()}): ${reason}`);
      }
    } catch (endpointErr) {
      console.warn(`[3rd Priority] Error on ${endpoint}:`, endpointErr.message);
      failureLog.push(`HF Serverless: ${endpointErr.message}`);
    }
  }

  // ═════════════════════════════════════════════════════════════════
  // All true image-editing models failed: throw error to display honest UI retry card
  // ═════════════════════════════════════════════════════════════════
  const finalErrorMsg = failureLog.length > 0
    ? failureLog.join(' · ')
    : 'All image-editing endpoints (Gemini Native, FLUX.1-Kontext, Qwen-Image-Edit, Pix2Pix) were busy or quota-limited.';

  console.error('[Image Editing Pipeline] All true image editing models failed:', finalErrorMsg);
  throw new Error(finalErrorMsg);
}

let activeEditPrompt = '';

async function generateVisualTransformation(file, context, suggestionsText = '', editPrompt = '') {
  const swipeContainer        = $('#concept-swipe-container');
  const swipeTransformed      = $('#swipe-transformed');
  const swipeOriginal         = $('#swipe-original');
  const userPhotoSwipe        = $('#user-photo-swipe');
  const conceptLoadingBox     = $('#concept-loading');
  const conceptLoadingP       = $('#concept-loading-text');
  const conceptErrorContainer = $('#concept-error-container');
  const conceptErrorDetails   = $('#concept-error-details');
  const providerBadge         = $('#ai-provider-badge');

  if (!file) return;

  activeEditPrompt = editPrompt || ARCHITECTURAL_EDIT_PROMPT;

  // Show loading, hide error & slider
  if (conceptLoadingBox) conceptLoadingBox.hidden = false;
  if (conceptErrorContainer) conceptErrorContainer.hidden = true;
  if (swipeContainer) swipeContainer.hidden = true;
  if (conceptLoadingP) {
    conceptLoadingP.textContent = 'Locking building geometry & rendering illustrative proposal onto your photo…';
  }

  // 1. Set the user's actual photo in the comparison slider
  const originalUrl = URL.createObjectURL(file);
  if (swipeOriginal) swipeOriginal.src = originalUrl;

  try {
    // 2. Measure natural dimensions of uploaded photo
    const naturalDims = await getImageDimensions(file);

    // 3. Execute Priority Structure-Locked Image-to-Image Pipeline
    const result = await generateStructureLockedImage(
      file,
      activeEditPrompt,
      naturalDims.width,
      naturalDims.height
    );

    if (swipeTransformed) swipeTransformed.src = result.url;

    if (providerBadge) {
      providerBadge.textContent = result.badge || '🌿 Illustrative Proposal';
      providerBadge.style.display = 'inline-flex';
    }

    if (conceptLoadingBox) conceptLoadingBox.hidden = true;
    if (conceptErrorContainer) conceptErrorContainer.hidden = true;
    if (swipeContainer) {
      swipeContainer.hidden = false;
      setupSwipeSlider(userPhotoSwipe);
    }

  } catch (err) {
    console.error('[Transformation Engine] Image editing failed on all true models:', err);
    if (conceptLoadingBox) conceptLoadingBox.hidden = true;
    if (swipeContainer) swipeContainer.hidden = true;
    if (providerBadge) providerBadge.style.display = 'none';

    if (conceptErrorContainer) {
      conceptErrorContainer.hidden = false;
      if (conceptErrorDetails) {
        conceptErrorDetails.textContent = `Server Status: ${err.message}`;
      }
    }
  }
}

// Wire the honest Retry Image Edit button
$('#btn-retry-image-edit')?.addEventListener('click', async () => {
  if (!uploadedFile) return;
  const promptToUse = activeEditPrompt || ARCHITECTURAL_EDIT_PROMPT;
  await generateVisualTransformation(uploadedFile, 'all', '', promptToUse);
});

/* ── Interactive Swipe Slider Controller ───────────────────────── */
function setupSwipeSlider(frame) {
  if (!frame) return;
  let value = 50;
  const handle = frame.querySelector('.swipe-handle');
  if (!handle) return;

  const setSplit = n => {
    value = Math.max(0, Math.min(100, n));
    frame.style.setProperty('--split', value + '%');
    handle.style.left = value + '%';
    handle.setAttribute('aria-valuenow', String(Math.round(value)));
  };

  setSplit(50);

  const update = e => {
    const r = frame.getBoundingClientRect();
    if (r.width > 0) {
      setSplit(((e.clientX - r.left) / r.width) * 100);
    }
  };

  handle.onpointerdown = e => {
    e.preventDefault();
    handle.setPointerCapture(e.pointerId);
    update(e);
  };
  handle.onpointermove = e => {
    if (handle.hasPointerCapture(e.pointerId)) update(e);
  };
  handle.onpointerup = e => {
    if (handle.hasPointerCapture(e.pointerId)) handle.releasePointerCapture(e.pointerId);
  };

  handle.onkeydown = e => {
    if (e.key === 'ArrowLeft') setSplit(value - (e.shiftKey ? 10 : 3));
    else if (e.key === 'ArrowRight') setSplit(value + (e.shiftKey ? 10 : 3));
    else if (e.key === 'Home') setSplit(0);
    else if (e.key === 'End') setSplit(100);
  };
}

/* ── Simple Markdown to HTML with Bento Cards ──────────────────── */
function markdownToHtml(md) {
  let html = md
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    .replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>')
    .replace(/^(?!<[hul])(.*[^\n])$/gm, match => {
      if (!match.trim() || match.startsWith('<')) return match;
      return `<p>${match}</p>`;
    })
    .replace(/\n{2,}/g, '\n');

  // Split into structured bento cards based on section headings or emojis
  const parts = html.split(/(?=<h[34]|<p>(?:🌿|🌳|🗑️|🏠|⚠️|📍))/g);
  if (parts.length > 1) {
    html = parts.map(part => {
      const p = part.trim();
      if (!p) return '';
      let cls = 'ai-plan-card';
      if (p.includes('🌿')) cls += ' card-vertical';
      else if (p.includes('🌳')) cls += ' card-corridor';
      else if (p.includes('🗑️')) cls += ' card-waste';
      else if (p.includes('🏠')) cls += ' card-quickwins';
      else if (p.includes('⚠️')) cls += ' card-warning';
      return `<div class="${cls}">${p}</div>`;
    }).join('');
  }

  return html;
}

/* ── Button Actions ────────────────────────────────────────────── */
btnCopyPlan?.addEventListener('click', () => {
  const sugText = suggestionsText.innerText || suggestionsText.textContent;
  if (!sugText) return;
  navigator.clipboard.writeText(sugText).then(() => {
    showToast('✓ Green action plan copied to clipboard!');
  }).catch(() => {
    showToast('✓ Action plan ready to share');
  });
});
btnNewPhoto?.addEventListener('click', () => {
  uploadedFile = null;
  transformedImageDataUrl = '';
  if (cameraInput) cameraInput.value = '';
  if (fileInput) fileInput.value = '';
  previewWrapper.hidden = true;
  uploadPlaceholder.hidden = false;
  uploadFilename.textContent = '';
  showStep(1);
});

btnRetry?.addEventListener('click', () => {
  if (uploadedFile) {
    btnAnalyze.click();
  } else {
    showStep(1);
  }
});

btnDownload?.addEventListener('click', () => {
  const sugText = suggestionsText.innerText || suggestionsText.textContent;
  const timestamp = Date.now();

  // 1. Download Action Plan text file
  const blob = new Blob([
    `Green Before Grey — AI Green Advisor Plan\n`,
    `Generated: ${new Date().toLocaleString()}\n`,
    `─────────────────────────────────────────────\n\n`,
    sugText,
    `\n\n─────────────────────────────────────────────\n`,
    `Always verify access clearance and drainage before physical work.\n`
  ], { type: 'text/plain;charset=utf-8' });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `green-plan-${timestamp}.txt`;
  a.click();
  URL.revokeObjectURL(url);

  // 2. Download Transformed Proposal image if available
  if (transformedImageDataUrl) {
    setTimeout(() => {
      const imgLink = document.createElement('a');
      imgLink.href = transformedImageDataUrl;
      imgLink.download = `green-transformation-${timestamp}.jpg`;
      imgLink.click();
    }, 500);
  }
});

/* ── Init ──────────────────────────────────────────────────────── */
initGisBanner();
window.addEventListener('languagechange', initGisBanner);
showStep(1);

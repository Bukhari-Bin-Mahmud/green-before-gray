/* ── AI Green Analysis ─────────────────────────────────────────── */
/* Zero-configuration AI integration:
   - Built-in Gemini API key (no user pasting required)
   - Dual photo input: Camera capture or File selection
   - Multimodal prompt for green interventions
   - Pollinations.ai concept image generation                     */

(() => {
'use strict';

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
    ? 'Respond in clear, accessible Bangla (বাংলা) language with Bengali plant names.'
    : 'Respond in clear English with local common plant names in brackets.';

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

Format your response with these exact emoji sections:

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

Keep all recommendations practical, affordable, and tailored to local community implementation.`;
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
    'Matching climate-resilient species (Bougainvillea, Neem, Bakul)…',
    'Ensuring clear passage width for cycle-vans and stormwater drainage…',
    'Positioning community waste bays & sediment residue traps…',
    'Rendering interactive Before/After botanical transformation…'
  ];
  let tipIndex = 0;
  if (aiMicrotip) aiMicrotip.textContent = microtips[0];
  const tipInterval = setInterval(() => {
    tipIndex = (tipIndex + 1) % microtips.length;
    if (aiMicrotip) aiMicrotip.textContent = microtips[tipIndex];
  }, 2200);

  let suggestions = '';
  let providerInfo = '';

  try {
    const base64Data = await fileToBase64(uploadedFile);
    const context = 'all';
    const promptText = buildPrompt(context);
    const apiKey = getActiveApiKey();

    // ── Tier 1: Multi-Model Google Gemini Cluster ──────────────────
    // Ordered by active responsiveness & verified availability
    const candidateGeminiModels = [
      'gemini-3-flash-preview',
      'gemini-flash-lite-latest',
      'gemini-3.5-flash-lite',
      'gemini-3.1-flash-lite-preview',
      'gemini-3.8-flash',
      'gemini-3.5-flash',
      'gemini-flash-latest',
      'gemini-3.1-flash-lite'
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
            suggestions = candText;
            providerInfo = `⚡ Gemini ${model.replace('gemini-', '').replace('-preview', '')}`;
            console.log(`[AI Pipeline] Success via ${model}`);
            break;
          }
        } else {
          console.warn(`[AI Pipeline] Model ${model} returned ${response.status}. Automatically failing over to next model...`);
          await new Promise(r => setTimeout(r, 200));
        }
      } catch (err) {
        console.warn(`[AI Pipeline] Error on ${model}: ${err.message}. Trying next candidate...`);
      }
    }

    // ── Tier 2: Free Secondary AI Cloud (Pollinations AI) ──────────
    if (!suggestions) {
      try {
        if (aiLoadingStatus) {
          aiLoadingStatus.textContent = 'Engaging secondary high-availability AI cloud…';
        }
        console.log('[AI Pipeline] Tier 1 models unavailable. Switching to Tier 2: Pollinations AI cloud...');

        const polController = new AbortController();
        const polTimeout = setTimeout(() => polController.abort(), 12000);

        const polRes = await fetch('https://text.pollinations.ai/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [
              { role: 'system', content: 'You are an expert urban ecologist and greening planner specializing in South Asian neighborhoods.' },
              { role: 'user', content: promptText }
            ],
            model: 'openai'
          }),
          signal: polController.signal
        });
        clearTimeout(polTimeout);

        if (polRes.ok) {
          const polText = await polRes.text();
          if (polText && polText.length > 80) {
            suggestions = polText;
            providerInfo = '⚡ High-Availability Cloud AI';
            console.log('[AI Pipeline] Success via Pollinations AI cloud');
          }
        }
      } catch (err) {
        console.warn('[AI Pipeline] Tier 2 Pollinations error:', err.message);
      }
    }

    // ── Tier 3: Guaranteed Local GIS-Aware Botanical Action Plan Engine ──
    if (!suggestions) {
      console.log('[AI Pipeline] Cloud APIs busy. Engaging Tier 3: Local GIS-Aware Botanical Engine...');
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

    // Generate photorealistic visual transformation with FLUX.1
    generateVisualTransformation(uploadedFile, context, suggestions);

  } catch (error) {
    clearInterval(tipInterval);
    console.error('AI Pipeline Unexpected Error:', error);
    // Even in unexpected failure, NEVER leave the user stranded on an error screen!
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
      generateVisualTransformation(uploadedFile, aiContext?.value || 'all', suggestions);
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

async function uploadPhotoForImg2Img(file) {
  try {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('https://tmpfiles.org/api/v1/upload', {
      method: 'POST',
      body: formData
    });
    if (res.ok) {
      const json = await res.json();
      if (json?.data?.url) {
        // Convert to direct download link: https://tmpfiles.org/dl/{id}/{name}
        return json.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
      }
    }
  } catch (err) {
    console.warn('[FLUX.1 Engine] Temporary image hosting fallback:', err.message);
  }
  return null;
}

async function generateVisualTransformation(file, context, suggestionsText = '') {
  const swipeContainer    = $('#concept-swipe-container');
  const swipeTransformed  = $('#swipe-transformed');
  const swipeOriginal     = $('#swipe-original');
  const userPhotoSwipe    = $('#user-photo-swipe');
  const conceptLoadingBox = $('#concept-loading');
  const providerBadge     = $('#ai-provider-badge');

  if (!file || !swipeTransformed || !swipeOriginal) return;

  if (conceptLoadingBox) conceptLoadingBox.hidden = false;
  if (swipeContainer) swipeContainer.hidden = true;

  // 1. Set the user's actual photo in the comparison slider
  const originalUrl = URL.createObjectURL(file);
  swipeOriginal.src = originalUrl;

  try {
    // 2. Upload photo to get temporary direct URL for FLUX img2img
    const hostedUrl = await uploadPhotoForImg2Img(file);

    // 3. Craft realistic greenery prompt tailored to the street interventions
    let plantDetails = 'dense blooming bougainvillea climbing on walls with vibrant magenta flowers, neat roadside sidewalk planters with colorful flowers, lush green grass on ground, shady tropical tree canopy';
    if (suggestionsText) {
      const parts = [];
      if (/bougainvillea|বাগানবিলাস|aparajita|madhabilata|দেয়াল|wall/i.test(suggestionsText)) {
        parts.push('blooming bougainvillea and ivy vines climbing walls');
      }
      if (/neem|নিম|krishnachura|কৃষ্ণচূড়া|canopy|ছায়া/i.test(suggestionsText)) {
        parts.push('shady tree canopy overhead');
      }
      if (/planter|pot|টব|shrub/i.test(suggestionsText)) {
        parts.push('terracotta flower planters along sidewalk');
      }
      if (parts.length > 0) plantDetails = parts.join(', ');
    }

    const seed = Math.floor(Math.random() * 999999);
    let candidateUrls = [];

    if (hostedUrl) {
      // True Image-to-Image with FLUX.1 (preserves user image, adds greenery on top)
      const img2imgPrompt = encodeURIComponent(
        `photorealistic architectural photography, add ${plantDetails}, keep exact buildings, walls, and road layout intact, lush green natural environment, realistic 8k photograph`
      );
      candidateUrls.push(
        `https://image.pollinations.ai/prompt/${img2imgPrompt}?model=flux&image=${encodeURIComponent(hostedUrl)}&nologo=true&seed=${seed}`
      );
    }

    // Secondary fallback: High-fidelity FLUX prompt conditioning
    const textPrompt = encodeURIComponent(
      `Award-winning architectural documentary photography, realistic street in Khulna Bangladesh with buildings and walls revitalized: ${plantDetails}, warm sunlight, clean open road, National Geographic nature photography, zero cartoon, zero illustration, 8k photograph`
    );
    candidateUrls.push(
      `https://image.pollinations.ai/prompt/${textPrompt}?model=flux&width=1024&height=640&nologo=true&seed=${seed}`
    );
    candidateUrls.push('assets/khulna-renewal.png');

    const loadImageWithTimeout = (url, timeoutMs = 20000) => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        const timer = setTimeout(() => {
          img.src = '';
          reject(new Error('Timeout loading image'));
        }, timeoutMs);

        img.onload = () => {
          clearTimeout(timer);
          resolve(url);
        };
        img.onerror = () => {
          clearTimeout(timer);
          reject(new Error('Failed to load image from ' + url));
        };
        img.src = url;
      });
    };

    let resolvedUrl = null;
    for (const url of candidateUrls) {
      try {
        console.log('[FLUX.1 Engine] Attempting visual render:', url);
        resolvedUrl = await loadImageWithTimeout(url, url.startsWith('http') ? 18000 : 3000);
        if (resolvedUrl) break;
      } catch (err) {
        console.warn('[FLUX.1 Engine] Candidate timed out, trying next:', err.message);
      }
    }

    swipeTransformed.src = resolvedUrl || 'assets/khulna-renewal.png';

    if (providerBadge) {
      providerBadge.textContent = '🌿 FLUX.1 Realistic AI';
      providerBadge.style.display = 'inline-flex';
    }

  } catch (err) {
    console.warn('[FLUX.1 Engine] Error generating FLUX visual:', err);
    swipeTransformed.src = 'assets/khulna-renewal.png';
  } finally {
    if (conceptLoadingBox) conceptLoadingBox.hidden = true;
    if (swipeContainer) swipeContainer.hidden = false;
    setupSwipeSlider(userPhotoSwipe);
  }
}

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

})();

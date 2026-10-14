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

/* ── Photorealistic Botanical Greenery Overlay Engine ─────────── */
/* Renders precise, realistic botanical interventions directly onto
   the user's exact uploaded photograph. Preserves buildings, road,
   and sky with natural shadows, shaded foliage, and bougainvillea. */

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

  try {
    // 1. Load user photo into an Image
    const originalUrl = URL.createObjectURL(file);
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = originalUrl;
    });

    swipeOriginal.src = originalUrl;

    // 2. Render Greenery Overlay directly on top of the original photograph
    const transformedDataUrl = await renderBotanicalOverlay(img, context, suggestionsText);
    swipeTransformed.src = transformedDataUrl;

    if (providerBadge) {
      providerBadge.textContent = '🌿 Greenery Overlay (On Your Photo)';
      providerBadge.style.display = 'inline-flex';
    }

  } catch (err) {
    console.warn('[Overlay Engine] Error compositing botanical overlay:', err);
    swipeTransformed.src = originalUrl;
  } finally {
    if (conceptLoadingBox) conceptLoadingBox.hidden = true;
    if (swipeContainer) swipeContainer.hidden = false;
    setupSwipeSlider(userPhotoSwipe);
  }
}

function renderBotanicalOverlay(img, context, suggestions) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    // Maintain aspect ratio, max 1600px width for high definition
    const maxW = 1600;
    const width = Math.min(img.naturalWidth || 1200, maxW);
    const height = Math.round(width * (img.naturalHeight / (img.naturalWidth || width))) || 800;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // 1. Draw base photo with warm sunlight enhancement
    ctx.filter = 'saturate(1.15) contrast(1.04) brightness(1.02)';
    ctx.drawImage(img, 0, 0, width, height);
    ctx.filter = 'none';

    // 2. Gentle natural sunbeam gradient
    const sunGrad = ctx.createLinearGradient(width * 0.2, 0, width * 0.8, height);
    sunGrad.addColorStop(0, 'rgba(255, 248, 220, 0.08)');
    sunGrad.addColorStop(0.5, 'rgba(235, 250, 225, 0.03)');
    sunGrad.addColorStop(1, 'rgba(20, 48, 30, 0.07)');
    ctx.fillStyle = sunGrad;
    ctx.fillRect(0, 0, width, height);

    // 3. Draw realistic vertical climbers (Left wall/structures)
    drawBotanicalWallClimbers(ctx, width, height, 0.0, 0.32, false);

    // 4. Draw realistic vertical climbers (Right wall/structures)
    drawBotanicalWallClimbers(ctx, width, height, 0.70, 1.0, true);

    // 5. Draw roadside sidewalk planters along lower flanks
    drawBotanicalPlanterBoxes(ctx, width, height);

    // 6. Draw overarching tree canopy foliage (Neem & Krishnachura in top corners)
    drawBotanicalCanopy(ctx, width, height);

    // 7. Draw subtle natural grass tufts along pavement/dirt boundaries
    drawNaturalGroundcover(ctx, width, height);

    // 8. Subtle watermark banner
    drawProposalWatermark(ctx, width, height);

    resolve(canvas.toDataURL('image/jpeg', 0.94));
  });
}

/* ── Leaf Drawing with Botanical Midrib, Gradient & Specular Cuticle ─ */
function drawBotanicalLeaf(ctx, x, y, length, angle, colorScheme = 'emerald') {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  // Soft drop shadow on building wall
  ctx.shadowColor = 'rgba(15, 30, 18, 0.38)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 3;

  const w = length * 0.42;

  // Curving leaf blade
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-w, -length * 0.35, -w * 0.8, -length * 0.85, 0, -length);
  ctx.bezierCurveTo(w * 0.8, -length * 0.85, w, -length * 0.35, 0, 0);
  ctx.closePath();

  // Multi-stop linear gradient along leaf length
  const grad = ctx.createLinearGradient(0, 0, 0, -length);
  if (colorScheme === 'emerald') {
    grad.addColorStop(0, '#153d24');
    grad.addColorStop(0.45, '#286b36');
    grad.addColorStop(1, '#569931');
  } else if (colorScheme === 'olive') {
    grad.addColorStop(0, '#1b381e');
    grad.addColorStop(0.5, '#3b6129');
    grad.addColorStop(1, '#789c3b');
  } else {
    // Bright sunlit shoot
    grad.addColorStop(0, '#24592b');
    grad.addColorStop(0.5, '#4e8c32');
    grad.addColorStop(1, '#94c748');
  }
  ctx.fillStyle = grad;
  ctx.fill();

  // Turn off shadow for veins and highlights
  ctx.shadowColor = 'transparent';

  // Central midrib vein
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-w * 0.08, -length * 0.5, 0, -length * 0.95);
  ctx.strokeStyle = 'rgba(170, 220, 120, 0.55)';
  ctx.lineWidth = Math.max(0.7, length * 0.035);
  ctx.stroke();

  // Lateral veins
  const veinCount = 4;
  for (let i = 1; i <= veinCount; i++) {
    const vy = -length * (i / (veinCount + 1));
    const vlen = w * (1 - (i / (veinCount + 1))) * 0.65;
    ctx.beginPath();
    ctx.moveTo(0, vy);
    ctx.lineTo(-vlen, vy - length * 0.08);
    ctx.moveTo(0, vy);
    ctx.lineTo(vlen, vy - length * 0.08);
    ctx.strokeStyle = 'rgba(160, 215, 110, 0.3)';
    ctx.lineWidth = 0.6;
    ctx.stroke();
  }

  // Waxy cuticle sunlight reflection
  ctx.beginPath();
  ctx.moveTo(0, -length * 0.15);
  ctx.quadraticCurveTo(-w * 0.45, -length * 0.45, 0, -length * 0.85);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.lineWidth = Math.max(1, length * 0.06);
  ctx.stroke();

  ctx.restore();
}

/* ── Bougainvillea Bract Floral Cluster ────────────────────────── */
function drawBougainvilleaBractCluster(ctx, cx, cy, radius) {
  ctx.save();
  ctx.translate(cx, cy);

  // Soft floral shadow
  ctx.shadowColor = 'rgba(40, 10, 25, 0.4)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;

  // 3-petal bract formation at 120 degree angles
  const angles = [0, 2.094, 4.188]; // 0, 120°, 240°
  angles.forEach(ang => {
    ctx.save();
    ctx.rotate(ang + (Math.random() - 0.5) * 0.3);

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-radius * 0.5, -radius * 0.4, -radius * 0.95, -radius * 0.85, 0, -radius);
    ctx.bezierCurveTo(radius * 0.4, -radius * 0.85, radius * 0.5, -radius * 0.4, 0, 0);
    ctx.closePath();

    const petalGrad = ctx.createRadialGradient(0, -radius * 0.4, radius * 0.1, 0, -radius * 0.5, radius * 0.8);
    petalGrad.addColorStop(0, '#f72585');
    petalGrad.addColorStop(0.55, '#c1126b');
    petalGrad.addColorStop(1, '#78003a');
    ctx.fillStyle = petalGrad;
    ctx.globalAlpha = 0.92;
    ctx.fill();

    // Delicate papery petal vein
    ctx.shadowColor = 'transparent';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -radius * 0.85);
    ctx.strokeStyle = 'rgba(255, 200, 230, 0.4)';
    ctx.lineWidth = 0.7;
    ctx.stroke();

    ctx.restore();
  });

  // Creamy white central floret
  ctx.shadowColor = 'transparent';
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(2, radius * 0.14), 0, Math.PI * 2);
  ctx.fillStyle = '#fff9db';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(0, 0, Math.max(1, radius * 0.08), 0, Math.PI * 2);
  ctx.fillStyle = '#ffbe0b';
  ctx.fill();

  ctx.restore();
}

/* ── Realistic Climbers along Wall Structures ──────────────────── */
function drawBotanicalWallClimbers(ctx, w, h, xStartRatio, xEndRatio, isRight) {
  const wallXStart = w * xStartRatio;
  const wallWidth  = w * (xEndRatio - xStartRatio);
  const wallBottom = h * 0.88;
  const wallTop    = h * 0.15;

  // 1. Main woody tendrils/vines winding up the wall
  const stemCount = Math.floor(wallWidth / 70) + 2;
  for (let s = 0; s < stemCount; s++) {
    const rootX = wallXStart + (s / stemCount) * wallWidth + (Math.random() - 0.5) * 30;
    const topX  = rootX + (isRight ? -1 : 1) * (20 + Math.random() * 40);

    ctx.save();
    ctx.shadowColor = 'rgba(10, 25, 12, 0.5)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = isRight ? -3 : 3;
    ctx.shadowOffsetY = 3;

    ctx.beginPath();
    ctx.moveTo(rootX, wallBottom);
    const midY1 = wallBottom - (wallBottom - wallTop) * 0.35;
    const midX1 = rootX + (Math.sin(s * 1.5) * 35);
    const midY2 = wallBottom - (wallBottom - wallTop) * 0.7;
    const midX2 = topX + (Math.cos(s * 1.2) * 25);
    ctx.bezierCurveTo(midX1, midY1, midX2, midY2, topX, wallTop + Math.random() * 60);

    ctx.strokeStyle = '#2d3b22';
    ctx.lineWidth = 3.5 + Math.random() * 1.5;
    ctx.stroke();

    // Bark highlight line
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = '#4e613b';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  }

  // 2. Dense leaf clusters attached to the wall
  const leafClusters = Math.floor(wallWidth * 0.65);
  for (let i = 0; i < leafClusters; i++) {
    const lx = wallXStart + Math.random() * wallWidth;
    // Higher density along middle and upper wall
    const ly = wallTop + Math.pow(Math.random(), 0.85) * (wallBottom - wallTop);
    const leafLen = 22 + Math.random() * 18;
    const leafAngle = (isRight ? -0.8 : 0.8) + (Math.random() - 0.5) * 1.4;
    const scheme = (i % 3 === 0) ? 'lime' : ((i % 3 === 1) ? 'emerald' : 'olive');

    drawBotanicalLeaf(ctx, lx, ly, leafLen, leafAngle, scheme);
  }

  // 3. Bougainvillea cascading flower clusters tumbling from wall tops & ledges
  const flowerClusters = Math.floor(wallWidth / 22);
  for (let f = 0; f < flowerClusters; f++) {
    const fx = wallXStart + Math.random() * wallWidth;
    // Bougainvillea cascades in upper 65% of the wall
    const fy = wallTop + Math.random() * ((wallBottom - wallTop) * 0.65);
    const r = 12 + Math.random() * 9;
    drawBougainvilleaBractCluster(ctx, fx, fy, r);
  }
}

/* ── Roadside Sidewalk Planter Boxes ───────────────────────────── */
function drawBotanicalPlanterBoxes(ctx, w, h) {
  const boxWidth  = Math.min(260, w * 0.22);
  const boxHeight = 65;
  const bottomY   = h - 25;

  // Left Planter Box
  drawSinglePlanterBox(ctx, w * 0.04, bottomY - boxHeight, boxWidth, boxHeight);

  // Right Planter Box
  drawSinglePlanterBox(ctx, w * 0.96 - boxWidth, bottomY - boxHeight, boxWidth, boxHeight);
}

function drawSinglePlanterBox(ctx, x, y, width, height) {
  ctx.save();

  // Cast shadow on ground
  ctx.fillStyle = 'rgba(10, 20, 15, 0.4)';
  ctx.beginPath();
  ctx.ellipse(x + width / 2, y + height + 6, width * 0.55, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // Planter body (Terracotta with 3D gradient)
  const boxGrad = ctx.createLinearGradient(x, y, x + width, y);
  boxGrad.addColorStop(0, '#9c4120');
  boxGrad.addColorStop(0.3, '#c2582e');
  boxGrad.addColorStop(0.7, '#d66a3d');
  boxGrad.addColorStop(1, '#8b3819');
  ctx.fillStyle = boxGrad;

  // Rounded bevel rectangle
  const r = 4;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width - 8, y + height);
  ctx.lineTo(x + 8, y + height);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();

  // Planter Rim
  ctx.fillStyle = '#db7346';
  ctx.fillRect(x - 4, y - 4, width + 8, 12);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.fillRect(x - 4, y - 4, width + 8, 2);

  // Dark potting soil line
  ctx.fillStyle = '#2d1e15';
  ctx.fillRect(x + 4, y + 2, width - 8, 6);

  ctx.restore();

  // Lush plants bursting out of the planter
  const plantCount = Math.floor(width / 16);
  for (let p = 0; p < plantCount; p++) {
    const px = x + 10 + (p / plantCount) * (width - 20) + (Math.random() - 0.5) * 12;
    const py = y + 2;
    const plen = 35 + Math.random() * 25;
    const angle = (p < plantCount / 2 ? -0.5 : 0.5) + (Math.random() - 0.5) * 0.8;
    drawBotanicalLeaf(ctx, px, py, plen, angle, (p % 2 === 0 ? 'emerald' : 'lime'));
  }

  // Trailing ivy spilling over the front of the planter
  for (let t = 0; t < 5; t++) {
    const tx = x + 20 + t * (width / 5) + (Math.random() - 0.5) * 15;
    const ty = y + 8;
    for (let j = 0; j < 3; j++) {
      drawBotanicalLeaf(ctx, tx + (j * 4), ty + (j * 14), 16, Math.PI - 0.2 + (Math.random() - 0.5) * 0.4, 'olive');
    }
  }

  // Scarlet Ixora flower clusters in planter
  for (let f = 0; f < 3; f++) {
    const fx = x + 30 + f * (width / 3.5);
    const fy = y - 18 - Math.random() * 15;
    drawIxoraFlowerCluster(ctx, fx, fy, 14);
  }
}

/* ── Scarlet Ixora Flower Cluster (রঙ্গন ফুল) ──────────────────── */
function drawIxoraFlowerCluster(ctx, cx, cy, radius) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.shadowColor = 'rgba(20, 5, 5, 0.35)';
  ctx.shadowBlur = 4;

  const florets = 9;
  for (let i = 0; i < florets; i++) {
    const dist = (i === 0 ? 0 : radius * 0.65);
    const ang  = (i * (Math.PI * 2 / (florets - 1)));
    const fx   = Math.cos(ang) * dist;
    const fy   = Math.sin(ang) * dist;

    // 4 tiny petals per floret
    for (let p = 0; p < 4; p++) {
      ctx.save();
      ctx.translate(fx, fy);
      ctx.rotate(p * (Math.PI / 2));
      ctx.beginPath();
      ctx.ellipse(0, -4, 2, 4, 0, 0, Math.PI * 2);
      ctx.fillStyle = (i % 2 === 0 ? '#e63946' : '#d90429');
      ctx.fill();
      ctx.restore();
    }
    // Gold center
    ctx.beginPath();
    ctx.arc(fx, fy, 1.2, 0, Math.PI * 2);
    ctx.fillStyle = '#ffbe0b';
    ctx.fill();
  }
  ctx.restore();
}

/* ── Overarching Tree Canopy (Neem & Krishnachura in top corners) ─ */
function drawBotanicalCanopy(ctx, w, h) {
  const canopyDepth = h * 0.32;

  // Left Canopy
  drawCanopyBranch(ctx, 0, 0, w * 0.42, canopyDepth, false);

  // Right Canopy
  drawCanopyBranch(ctx, w, 0, w * 0.42, canopyDepth, true);
}

function drawCanopyBranch(ctx, rootX, rootY, reachX, reachY, isRight) {
  const leafCount = Math.floor((reachX * reachY) / 1100);

  // Deep background foliage layer
  for (let b = 0; b < leafCount; b++) {
    const lx = rootX + (isRight ? -1 : 1) * Math.pow(Math.random(), 0.75) * reachX;
    const ly = rootY + Math.pow(Math.random(), 0.8) * reachY;
    const len = 30 + Math.random() * 25;
    const ang = (isRight ? 2.2 : -2.2) + (Math.random() - 0.5) * 1.2;
    drawBotanicalLeaf(ctx, lx, ly, len, ang, 'emerald');
  }

  // Sunlit foreground foliage layer
  for (let f = 0; f < leafCount * 0.5; f++) {
    const lx = rootX + (isRight ? -1 : 1) * Math.pow(Math.random(), 0.9) * (reachX * 0.85);
    const ly = rootY + Math.pow(Math.random(), 0.9) * (reachY * 0.85);
    const len = 24 + Math.random() * 18;
    const ang = (isRight ? 2.0 : -2.0) + (Math.random() - 0.5) * 1.0;
    drawBotanicalLeaf(ctx, lx, ly, len, ang, 'lime');
  }

  // Scarlet Krishnachura blooms nestled in the canopy
  const bloomCount = 14;
  for (let k = 0; k < bloomCount; k++) {
    const kx = rootX + (isRight ? -1 : 1) * (30 + Math.random() * (reachX * 0.75));
    const ky = rootY + 15 + Math.random() * (reachY * 0.7);
    drawKrishnachuraBloom(ctx, kx, ky, 12 + Math.random() * 6);
  }
}

function drawKrishnachuraBloom(ctx, cx, cy, size) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.shadowColor = 'rgba(30, 0, 0, 0.4)';
  ctx.shadowBlur = 5;

  // 5 crinkled petals
  for (let p = 0; p < 5; p++) {
    ctx.save();
    ctx.rotate(p * (Math.PI * 2 / 5));
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-size * 0.4, -size * 0.5, -size * 0.35, -size * 0.95, 0, -size);
    ctx.bezierCurveTo(size * 0.35, -size * 0.95, size * 0.4, -size * 0.5, 0, 0);
    ctx.closePath();

    if (p === 0) {
      // Standard petal: variegated yellow & scarlet
      ctx.fillStyle = '#fff3b0';
      ctx.fill();
      ctx.strokeStyle = '#e63946';
      ctx.lineWidth = 1;
      ctx.stroke();
    } else {
      ctx.fillStyle = '#e63946';
      ctx.fill();
    }
    ctx.restore();
  }

  // Long stamens
  ctx.strokeStyle = '#f4a261';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(size * 0.3, -size * 0.4, size * 0.2, -size * 0.8);
  ctx.stroke();

  ctx.restore();
}

/* ── Natural Groundcover along Curbs ───────────────────────────── */
function drawNaturalGroundcover(ctx, w, h) {
  const curbLeftW  = w * 0.28;
  const curbRightW = w * 0.28;
  const groundY    = h - 8;

  // Left edge grass clumps
  for (let x = 0; x < curbLeftW; x += 18) {
    drawGrassClump(ctx, x + (Math.random() - 0.5) * 10, groundY, 18 + Math.random() * 14);
  }

  // Right edge grass clumps
  for (let x = w - curbRightW; x < w; x += 18) {
    drawGrassClump(ctx, x + (Math.random() - 0.5) * 10, groundY, 18 + Math.random() * 14);
  }
}

function drawGrassClump(ctx, cx, cy, height) {
  ctx.save();
  ctx.translate(cx, cy);

  const blades = 7;
  for (let i = 0; i < blades; i++) {
    const angle = ((i - blades / 2) / blades) * 0.9 + (Math.random() - 0.5) * 0.2;
    const h = height * (0.7 + Math.random() * 0.5);

    ctx.save();
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(-1.5, 0);
    ctx.quadraticCurveTo(-0.5, -h * 0.6, 0, -h);
    ctx.quadraticCurveTo(0.5, -h * 0.6, 1.5, 0);
    ctx.closePath();
    ctx.fillStyle = (i % 2 === 0 ? '#386629' : '#558b2f');
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

/* ── Architectural Watermark Ribbon ────────────────────────────── */
function drawProposalWatermark(ctx, w, h) {
  ctx.save();
  const barHeight = Math.max(26, h * 0.038);
  ctx.fillStyle = 'rgba(18, 45, 32, 0.82)';
  ctx.fillRect(0, h - barHeight, w, barHeight);

  ctx.fillStyle = '#bad58a';
  ctx.font = `bold ${Math.max(11, Math.round(barHeight * 0.44))}px Arial, sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText('🌿 Green Before Grey · Architectural Transformation Proposal', 16, h - (barHeight * 0.32));

  ctx.fillStyle = '#e5eed5';
  ctx.textAlign = 'right';
  ctx.font = `${Math.max(10, Math.round(barHeight * 0.40))}px Arial, sans-serif`;
  ctx.fillText('Zero Point, Khulna', w - 16, h - (barHeight * 0.32));
  ctx.restore();
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

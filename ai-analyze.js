/* ── AI Green Advisor ─────────────────────────────────────────── */
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
const aiResultContent  = $('#ai-result-content');
const aiError          = $('#ai-error');
const aiErrorText      = $('#ai-error-text');
const resultPhoto      = $('#result-photo');
const suggestionsText  = $('#suggestions-text');
const conceptLoading   = $('#concept-loading');
const conceptImage     = $('#concept-image');
const btnNewPhoto      = $('#btn-new-photo');
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

  $('#progress-one')?.classList.toggle('active', n === 1);
  $('#progress-two')?.classList.toggle('active', n === 2);

  const target = n === 1 ? stepUpload : stepResult;
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

/* ── Analyze with Gemini ───────────────────────────────────────── */
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

  try {
    const base64Data = await fileToBase64(uploadedFile);
    const context = aiContext.value;
    const promptText = buildPrompt(context);
    const apiKey = getActiveApiKey();

    // Fallback models in priority order
    const candidateModels = [
      'gemini-3-flash-preview',
      'gemini-3.8-flash',
      'gemini-3.5-flash',
      'gemini-flash-latest',
      'gemini-3.1-flash-lite'
    ];

    let data = null;
    let lastError = null;

    for (const model of candidateModels) {
      try {
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
            })
          }
        );

        if (response.ok) {
          data = await response.json();
          break;
        }

        const errData = await response.json().catch(() => ({}));
        const msg = errData?.error?.message || `API Error: ${response.status}`;
        lastError = new Error(msg);

        // On 404 or temporary 503 load, seamlessly try the next model
        if (response.status !== 404 && response.status !== 503) {
          throw lastError;
        }
      } catch (err) {
        lastError = err;
        if (!err.message.includes('404') && !err.message.includes('503') && !err.message.includes('demand') && !err.message.includes('not found')) {
          throw err;
        }
      }
    }

    if (!data) throw lastError || new Error('Failed to reach Gemini API.');

    if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
      throw new Error(tr('aiNoResult') || 'No suggestions were generated. Please try with a different photo.');
    }

    const suggestions = data.candidates[0].content.parts[0].text;

    // Display original photo
    resultPhoto.src = URL.createObjectURL(uploadedFile);

    // Format & display recommendations
    suggestionsText.innerHTML = markdownToHtml(suggestions);

    aiLoading.hidden = true;
    aiResultContent.hidden = false;

    // Generate visual transformation and interactive swipe slider
    generateVisualTransformation(uploadedFile, context);

  } catch (error) {
    console.error('AI Analysis Error:', error);
    aiLoading.hidden = true;
    aiError.hidden = false;

    let errorMessage = error.message;
    if (error.message.includes('API_KEY_INVALID') || error.message.includes('API key not valid')) {
      errorMessage = tr('aiKeyBad') || 'API key error. Please check your network or try again.';
    } else if (error.message.includes('RESOURCE_EXHAUSTED') || error.message.includes('quota')) {
      errorMessage = tr('aiQuota') || 'High traffic. Please wait a moment and try again.';
    } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      errorMessage = tr('aiNetwork') || 'Network error. Please check your internet connection and try again.';
    }

    aiErrorText.textContent = errorMessage;
  }
});

/* ── Interactive Before & After Visual Transformation Engine ──── */
let transformedImageDataUrl = '';

async function generateVisualTransformation(file, context) {
  const swipeContainer     = $('#concept-swipe-container');
  const watercolorContainer= $('#concept-watercolor-container');
  const swipeTransformed   = $('#swipe-transformed');
  const swipeOriginal      = $('#swipe-original');
  const userPhotoSwipe     = $('#user-photo-swipe');
  const conceptLoadingBox  = $('#concept-loading');

  if (!file || !swipeTransformed || !swipeOriginal) return;

  if (conceptLoadingBox) conceptLoadingBox.hidden = false;
  if (swipeContainer) swipeContainer.hidden = true;

  try {
    // 1. Load user photo into an image element for canvas processing
    const imgUrl = URL.createObjectURL(file);
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = imgUrl;
    });

    swipeOriginal.src = imgUrl;

    // 2. Render Green Transformation Canvas
    transformedImageDataUrl = await renderGreenProposalCanvas(img, context);
    swipeTransformed.src = transformedImageDataUrl;

    if (conceptLoadingBox) conceptLoadingBox.hidden = true;
    if (swipeContainer) swipeContainer.hidden = false;

    // 3. Setup Swipe Slider Interaction
    setupSwipeSlider(userPhotoSwipe);

  } catch (err) {
    console.warn('Canvas transformation fallback:', err);
    if (conceptLoadingBox) conceptLoadingBox.hidden = true;
    if (swipeContainer) swipeContainer.hidden = false;
    // Fallback to Khulna renewal watercolor if canvas fails
    if (swipeTransformed) swipeTransformed.src = 'assets/khulna-renewal.png';
  }
}

/* ── Botanical Procedural Canvas Rendering ────────────────────── */
function renderGreenProposalCanvas(img, context) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const width = 1200;
    const height = Math.round(1200 * (img.naturalHeight / (img.naturalWidth || 1200))) || 800;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // 1. Draw base photo with enhanced tropical sunlight and saturation
    ctx.filter = 'saturate(1.25) contrast(1.06) brightness(1.02)';
    ctx.drawImage(img, 0, 0, width, height);
    ctx.filter = 'none';

    // 2. Add subtle eco green atmospheric grading
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, 'rgba(255, 248, 220, 0.1)');
    grad.addColorStop(0.7, 'rgba(34, 139, 34, 0.04)');
    grad.addColorStop(1, 'rgba(21, 59, 46, 0.12)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // 3. Draw vertical climbing plants & Bougainvillea on walls
    drawClimbers(ctx, width, height, 0.05, 0.7); // Left wall
    drawClimbers(ctx, width, height, 0.88, 0.75); // Right wall

    // 4. Draw overarching tree canopy (Neem & Krishnachura) along upper corners
    drawOverheadCanopy(ctx, width, height);

    // 5. Draw roadside flower planters along the bottom edges
    drawGroundPlanters(ctx, width, height);

    // 6. Draw clean eco waste bin
    if (context === 'waste' || context === 'general' || context === 'all') {
      drawModernEcoBin(ctx, width, height);
    }

    // 7. Architectural proposal badge
    drawProposalBadge(ctx, width, height);

    resolve(canvas.toDataURL('image/jpeg', 0.92));
  });
}

function drawClimbers(ctx, w, h, xRatio, heightRatio) {
  const startX = w * xRatio;
  const startY = h * (1 - heightRatio * 0.2);
  const endY = h * (1 - heightRatio);

  ctx.save();
  // Winding vine stems
  ctx.strokeStyle = '#2d5a27';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.bezierCurveTo(startX + 30, (startY + endY) / 2, startX - 25, endY + 40, startX + 10, endY);
  ctx.stroke();

  // Dense leaf clusters
  const leafColors = ['#1b4332', '#2d6a4f', '#40916c', '#52b788', '#74c69d'];
  const flowerColors = ['#e63946', '#d90429', '#f72585', '#b5179e', '#ff4d6d'];

  for (let y = startY; y >= endY; y -= 16) {
    const xOffset = Math.sin(y * 0.05) * 35;
    const currentX = startX + xOffset;

    // Draw 3-5 leaves per node
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = leafColors[(i + y) % leafColors.length];
      ctx.beginPath();
      const lx = currentX + (Math.random() - 0.5) * 50;
      const ly = y + (Math.random() - 0.5) * 20;
      ctx.ellipse(lx, ly, 14, 8, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }

    // Bougainvillea flower clusters
    if (y % 32 < 20) {
      for (let f = 0; f < 3; f++) {
        ctx.fillStyle = flowerColors[(f + y) % flowerColors.length];
        ctx.beginPath();
        const fx = currentX + (Math.random() - 0.5) * 45;
        const fy = y + (Math.random() - 0.5) * 18;
        ctx.arc(fx, fy, 7, 0, Math.PI * 2);
        ctx.fill();
        // Golden flower center
        ctx.fillStyle = '#ffb703';
        ctx.beginPath();
        ctx.arc(fx, fy, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

function drawOverheadCanopy(ctx, w, h) {
  ctx.save();
  const canopyColors = ['#1b4332', '#2d6a4f', '#40916c', '#52b788'];

  // Left top canopy
  for (let i = 0; i < 35; i++) {
    const cx = Math.random() * (w * 0.45);
    const cy = Math.random() * (h * 0.28);
    const r = 25 + Math.random() * 40;
    ctx.fillStyle = canopyColors[i % canopyColors.length];
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Right top canopy
  for (let i = 0; i < 35; i++) {
    const cx = w - Math.random() * (w * 0.45);
    const cy = Math.random() * (h * 0.28);
    const r = 25 + Math.random() * 40;
    ctx.fillStyle = canopyColors[i % canopyColors.length];
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Scarlet Krishnachura blooms in canopy
  ctx.globalAlpha = 0.95;
  for (let k = 0; k < 40; k++) {
    const kx = (k % 2 === 0) ? Math.random() * (w * 0.4) : (w - Math.random() * (w * 0.4));
    const ky = Math.random() * (h * 0.25);
    ctx.fillStyle = '#ff4757';
    ctx.beginPath();
    ctx.arc(kx, ky, 5 + Math.random() * 4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawGroundPlanters(ctx, w, h) {
  ctx.save();
  // Terracotta flower pots at bottom corner
  const potX = w * 0.12;
  const potY = h - 60;

  // Pot 1
  ctx.fillStyle = '#c86432';
  ctx.beginPath();
  ctx.moveTo(potX - 25, potY);
  ctx.lineTo(potX + 25, potY);
  ctx.lineTo(potX + 18, potY + 45);
  ctx.lineTo(potX - 18, potY + 45);
  ctx.closePath();
  ctx.fill();

  // Flowering plant inside pot
  ctx.fillStyle = '#2d6a4f';
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    ctx.arc(potX + (Math.random() - 0.5) * 35, potY - 15 - Math.random() * 25, 12, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#ffbe0b';
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(potX + (Math.random() - 0.5) * 30, potY - 20 - Math.random() * 20, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawModernEcoBin(ctx, w, h) {
  ctx.save();
  const bx = w * 0.85;
  const by = h - 110;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(bx + 25, by + 85, 35, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  // Bin body
  ctx.fillStyle = '#2d6a4f';
  ctx.roundRect ? ctx.roundRect(bx, by, 50, 80, 6) : ctx.fillRect(bx, by, 50, 80);
  ctx.fill();

  // Bin lid
  ctx.fillStyle = '#1b4332';
  ctx.fillRect(bx - 4, by - 8, 58, 12);

  // Recycle symbol text
  ctx.fillStyle = '#d5e5a1';
  ctx.font = 'bold 22px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('♻', bx + 25, by + 48);

  ctx.restore();
}

function drawProposalBadge(ctx, w, h) {
  ctx.save();
  ctx.fillStyle = 'rgba(21, 59, 46, 0.88)';
  ctx.fillRect(0, h - 34, w, 34);

  ctx.fillStyle = '#bad58a';
  ctx.font = '14px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('🌿 Green Before Grey · AI Transformation Concept · Vertical Climbers & Shade Canopy', 20, h - 12);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#e8f0d4';
  ctx.fillText('Zero Point, Khulna', w - 20, h - 12);
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

/* ── Tab Switcher: Before/After Slider vs Watercolor Concept ───── */
const tabSlider = $('#tab-slider');
const tabWatercolor = $('#tab-watercolor');
const swipeContainer = $('#concept-swipe-container');
const watercolorContainer = $('#concept-watercolor-container');

tabSlider?.addEventListener('click', () => {
  tabSlider.classList.add('active');
  tabWatercolor?.classList.remove('active');
  if (swipeContainer) swipeContainer.hidden = false;
  if (watercolorContainer) watercolorContainer.hidden = true;
});

tabWatercolor?.addEventListener('click', () => {
  tabWatercolor.classList.add('active');
  tabSlider?.classList.remove('active');
  if (swipeContainer) swipeContainer.hidden = true;
  if (watercolorContainer) watercolorContainer.hidden = false;
});

/* ── Simple Markdown to HTML ───────────────────────────────────── */
function markdownToHtml(md) {
  return md
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
}

/* ── Button Actions ────────────────────────────────────────────── */
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

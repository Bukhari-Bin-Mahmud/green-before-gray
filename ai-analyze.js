/* ── AI Green Advisor ─────────────────────────────────────────── */
/* Connects to Google Gemini API (free tier) for photo analysis
   and Pollinations.ai for concept image generation.              */

(() => {
'use strict';

/* ── Helpers ───────────────────────────────────────────────────── */
const $ = s => document.querySelector(s);
const KEY_STORAGE = 'gbg-gemini-key';

/* ── State ─────────────────────────────────────────────────────── */
let apiKey = '';
let uploadedFile = null;
let currentStep = 1;

/* ── DOM refs ──────────────────────────────────────────────────── */
const stepKey     = $('#step-apikey');
const stepUpload  = $('#step-upload');
const stepResult  = $('#step-result');

const keyInput       = $('#api-key-input');
const saveKeyCheck   = $('#save-key-check');
const keyError       = $('#key-error');
const btnSetKey      = $('#btn-set-key');
const toggleKeyBtn   = $('#toggle-key-visibility');

const photoInput     = $('#photo-input');
const dropZone       = $('#drop-zone');
const uploadPreview  = $('#upload-preview');
const uploadPlaceholder = $('#upload-placeholder');
const uploadFilename = $('#upload-filename');
const uploadError    = $('#upload-error');
const aiContext      = $('#ai-context');
const btnAnalyze     = $('#btn-analyze');
const btnBackKey     = $('#btn-back-key');

const aiLoading      = $('#ai-loading');
const aiResultContent = $('#ai-result-content');
const aiError        = $('#ai-error');
const aiErrorText    = $('#ai-error-text');
const resultPhoto    = $('#result-photo');
const suggestionsText = $('#suggestions-text');
const conceptLoading = $('#concept-loading');
const conceptImage   = $('#concept-image');
const btnNewPhoto    = $('#btn-new-photo');
const btnDownload    = $('#btn-download-result');
const btnRetry       = $('#btn-retry');

/* ── Step Navigation ───────────────────────────────────────────── */
function showStep(n) {
  currentStep = n;
  stepKey.hidden    = n !== 1;
  stepUpload.hidden = n !== 2;
  stepResult.hidden = n !== 3;

  for (const [i, id] of [[1, 'one'], [2, 'two'], [3, 'three']]) {
    $('#progress-' + id).classList.toggle('active', i === n);
  }

  const target = n === 1 ? stepKey : n === 2 ? stepUpload : stepResult;
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ── API Key ───────────────────────────────────────────────────── */
// Try to restore saved key
try {
  const saved = localStorage.getItem(KEY_STORAGE);
  if (saved) {
    keyInput.value = saved;
    saveKeyCheck.checked = true;
  }
} catch {}

toggleKeyBtn.addEventListener('click', () => {
  keyInput.type = keyInput.type === 'password' ? 'text' : 'password';
  toggleKeyBtn.textContent = keyInput.type === 'password' ? '👁' : '🙈';
});

btnSetKey.addEventListener('click', () => {
  const key = keyInput.value.trim();
  if (!key || key.length < 10) {
    keyError.textContent = tr('aiKeyInvalid') || 'Please enter a valid API key.';
    keyError.hidden = false;
    return;
  }
  keyError.hidden = true;
  apiKey = key;

  // Save or remove from localStorage
  try {
    if (saveKeyCheck.checked) {
      localStorage.setItem(KEY_STORAGE, key);
    } else {
      localStorage.removeItem(KEY_STORAGE);
    }
  } catch {}

  showStep(2);
});

// Allow Enter key to proceed
keyInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') btnSetKey.click();
});

/* ── Photo Upload ──────────────────────────────────────────────── */
function handleFile(file) {
  if (!file) return;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
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
  uploadPreview.hidden = false;
  uploadPlaceholder.hidden = true;
  uploadFilename.textContent = file.name;
}

// Click to upload
dropZone.addEventListener('click', () => photoInput.click());
photoInput.addEventListener('change', () => handleFile(photoInput.files[0]));

// Drag and drop
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  handleFile(e.dataTransfer.files[0]);
});

btnBackKey.addEventListener('click', () => showStep(1));

/* ── File to Base64 ────────────────────────────────────────────── */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
  });
}

/* ── Build Prompt ──────────────────────────────────────────────── */
function buildPrompt(context) {
  const lang = window.getLanguage?.() || 'en';
  const langInstruction = lang === 'bn'
    ? 'Respond in Bangla (বাংলা) language.'
    : 'Respond in English.';

  const contextMap = {
    general: 'Provide a comprehensive analysis covering vertical gardening, green corridors, waste management, and any other green interventions.',
    vertical: 'Focus specifically on vertical gardening opportunities — walls suitable for climbers, creeper plants, and hanging gardens.',
    corridor: 'Focus specifically on creating green corridors — sidewalk gardens, roadside tree planting, and connecting green spaces.',
    waste: 'Focus specifically on waste management — optimal placement of waste bins, recycling stations, and community composting spots.',
    all: 'Provide a comprehensive analysis covering ALL of the following: vertical gardening, green corridors, waste management, and community greening.'
  };

  return `You are an urban greening expert specializing in South Asian neighborhoods (especially Bangladesh).
${langInstruction}

Analyze this photo of an urban neighborhood and provide practical, actionable green intervention suggestions.

Focus area: ${contextMap[context] || contextMap.general}

Structure your response EXACTLY like this with these emoji headers:

🌿 **Vertical Gardening / দেয়ালে সবুজ**
- Identify bare walls, fences, or vertical surfaces suitable for climbers or creeper plants
- Suggest specific climate-resilient species: Bougainvillea (বাগানবিলাস), Money Plant (মানি প্ল্যান্ট), Madhabilata (মাধবীলতা), Star Jasmine, Pothos, Aparajita (অপরাজিতা)
- Note which walls get enough sunlight

🌳 **Green Corridors / সবুজ পথ**
- Identify sidewalk/roadside patches suitable for planting beds or tree pits
- Suggest shade trees: Neem (নিম), Rain Tree (শিরীষ), Krishnachura (কৃষ্ণচূড়া), Bakul (বকুল)
- Note areas for ground cover, small hedges, or border plants

🗑️ **Waste & Cleanliness / পরিচ্ছন্নতা**
- Recommend strategic spots for public waste bins or recycling points
- Identify areas needing cleanup before greening
- Suggest community composting if space allows

🏠 **Quick Wins for Homeowners / বাড়ির মালিকদের জন্য**
- Simple things residents can do immediately
- Container gardening, window boxes, rooftop options
- Estimated cost range (low/medium/high)

⚠️ **Things to Check First / আগে যাচাই করুন**
- Access paths that must stay clear
- Drainage that must not be blocked
- Structural concerns for wall-mounted gardens

Keep suggestions practical and affordable for individual homeowners and small communities in Bangladesh. Use bullet points. Be specific about locations visible in the photo.`;
}

/* ── Analyze with Gemini ───────────────────────────────────────── */
btnAnalyze.addEventListener('click', async () => {
  if (!uploadedFile) {
    uploadError.textContent = tr('aiNoPhoto') || 'Please select a photo first.';
    uploadError.hidden = false;
    return;
  }
  uploadError.hidden = true;
  showStep(3);

  // Show loading
  aiLoading.hidden = false;
  aiResultContent.hidden = true;
  aiError.hidden = true;

  try {
    const base64Data = await fileToBase64(uploadedFile);
    const context = aiContext.value;
    const promptText = buildPrompt(context);

    // Model fallback: try gemini-2.0-flash, then gemini-1.5-flash
    let data = null;
    let lastError = null;
    const candidateModels = ['gemini-2.0-flash', 'gemini-1.5-flash'];

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
                  { inline_data: { mime_type: uploadedFile.type, data: base64Data } }
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

        // If the error isn't 404 (model not found), don't try next model (e.g. invalid key or quota)
        if (response.status !== 404) {
          throw lastError;
        }
      } catch (err) {
        lastError = err;
        if (!err.message.includes('404') && !err.message.includes('not found')) {
          throw err;
        }
      }
    }

    if (!data) throw lastError || new Error('Failed to reach Gemini API.');

    if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
      throw new Error(tr('aiNoResult') || 'No suggestions were generated. Please try with a different photo.');
    }

    const suggestions = data.candidates[0].content.parts[0].text;

    // Show results
    aiLoading.hidden = true;
    aiResultContent.hidden = false;

    // Show uploaded photo
    resultPhoto.src = URL.createObjectURL(uploadedFile);

    // Render suggestions as formatted HTML
    suggestionsText.innerHTML = markdownToHtml(suggestions);

    // Generate concept image with Pollinations
    generateConceptImage(suggestions);

  } catch (error) {
    console.error('Gemini API error:', error);
    aiLoading.hidden = true;
    aiError.hidden = false;

    let errorMessage = error.message;
    if (error.message.includes('API_KEY_INVALID') || error.message.includes('API key not valid')) {
      errorMessage = tr('aiKeyBad') || 'Invalid API key. Please go back and enter a valid Gemini API key.';
    } else if (error.message.includes('RESOURCE_EXHAUSTED') || error.message.includes('quota')) {
      errorMessage = tr('aiQuota') || 'API quota exceeded. Free tier allows 15 requests/minute. Please wait and try again.';
    } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      errorMessage = tr('aiNetwork') || 'Network error. Please check your internet connection and try again.';
    }

    aiErrorText.textContent = errorMessage;
  }
});

/* ── Generate Concept Image (Pollinations.ai — free, no key) ─── */
function generateConceptImage(suggestions) {
  conceptLoading.hidden = false;
  conceptImage.hidden = true;

  // Extract key themes from suggestions for the image prompt
  const visualPrompt = encodeURIComponent(
    `Photorealistic urban street in Bangladesh transformed with lush green interventions: ` +
    `vertical climbing plants like bougainvillea and money plant on walls, ` +
    `neem and rain trees providing shade along sidewalks, ` +
    `colorful flower pots and hanging gardens on balconies, ` +
    `clean tidy waste bins at corners, ` +
    `green ground cover along drainage edges, ` +
    `community garden patches between buildings, ` +
    `warm tropical sunlight, vibrant colors, hopeful atmosphere, ` +
    `before-and-after green transformation, South Asian neighborhood`
  );

  const imgUrl = `https://image.pollinations.ai/prompt/${visualPrompt}?width=800&height=500&nologo=true&seed=${Date.now()}`;

  conceptImage.onload = () => {
    conceptLoading.hidden = true;
    conceptImage.hidden = false;
  };
  conceptImage.onerror = () => {
    conceptLoading.hidden = true;
    // Silently fail — concept image is a bonus feature
    console.warn('Pollinations concept image failed to load.');
  };
  conceptImage.src = imgUrl;
}

/* ── Simple Markdown → HTML ────────────────────────────────────── */
function markdownToHtml(md) {
  return md
    // Headers
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Bullet points
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    // Wrap consecutive <li> in <ul>
    .replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>')
    // Paragraphs (lines that aren't wrapped in tags)
    .replace(/^(?!<[hul])(.*[^\n])$/gm, (match) => {
      if (match.trim() === '') return '';
      if (match.startsWith('<')) return match;
      return `<p>${match}</p>`;
    })
    // Clean up extra newlines
    .replace(/\n{2,}/g, '\n');
}

/* ── Navigation buttons ────────────────────────────────────────── */
btnNewPhoto.addEventListener('click', () => {
  // Reset upload state
  uploadedFile = null;
  uploadPreview.hidden = true;
  uploadPreview.src = '';
  uploadPlaceholder.hidden = false;
  uploadFilename.textContent = '';
  photoInput.value = '';
  conceptImage.hidden = true;
  conceptImage.src = '';
  showStep(2);
});

btnRetry.addEventListener('click', () => {
  if (uploadedFile) {
    btnAnalyze.click();
  } else {
    showStep(2);
  }
});

/* ── Download Results ──────────────────────────────────────────── */
btnDownload.addEventListener('click', () => {
  // Create a text summary to download
  const sugText = suggestionsText.innerText || suggestionsText.textContent;
  const blob = new Blob([
    `Green Before Grey — AI Green Advisor Results\n`,
    `Generated: ${new Date().toLocaleString()}\n`,
    `─────────────────────────────────────────────\n\n`,
    sugText,
    `\n\n─────────────────────────────────────────────\n`,
    `Note: Concept images are AI-generated illustrations.\n`,
    `Always verify access, drainage, and structural suitability before making changes.\n`
  ], { type: 'text/plain;charset=utf-8' });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `green-advisor-${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
});

/* ── Init ──────────────────────────────────────────────────────── */
showStep(1);

})();

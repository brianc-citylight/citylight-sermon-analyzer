<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>City Light Sermon Analyzer</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --gold: #C9A84C;
      --gold-light: #F0D98A;
      --black: #111111;
      --gray: #555555;
      --light-gray: #F5F5F5;
      --border: #E0E0E0;
      --white: #FFFFFF;
    }

    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      background: #F8F8F6;
      color: var(--black);
      min-height: 100vh;
    }

    .header {
      background: var(--white);
      border-bottom: 1px solid var(--border);
      padding: 1.25rem 2rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .header-left { display: flex; flex-direction: column; }
    .church-name { font-size: 11px; font-weight: 600; letter-spacing: 0.15em; text-transform: uppercase; color: var(--gold); }
    .app-name { font-size: 18px; font-weight: 700; color: var(--black); letter-spacing: -0.02em; }

    .gold-bar { height: 3px; background: var(--gold); width: 100%; }

    .container { max-width: 760px; margin: 0 auto; padding: 2rem 1.5rem; }

    .login-wrapper { display: flex; justify-content: center; align-items: center; min-height: 70vh; }
    .login-card {
      background: var(--white);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 2.5rem;
      width: 100%;
      max-width: 400px;
      text-align: center;
    }
    .login-card h2 { font-size: 20px; font-weight: 700; margin-bottom: 0.5rem; }
    .login-card p { font-size: 14px; color: var(--gray); margin-bottom: 1.5rem; }
    .login-card input {
      width: 100%;
      padding: 10px 14px;
      border: 1px solid var(--border);
      border-radius: 8px;
      font-size: 15px;
      margin-bottom: 1rem;
      outline: none;
    }
    .login-card input:focus { border-color: var(--gold); }
    .login-error { font-size: 13px; color: #c0392b; margin-top: -0.5rem; margin-bottom: 0.75rem; }

    .main { display: none; }
    .main.visible { display: block; }

    .card {
      background: var(--white);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }

    .card-label {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--gold);
      margin-bottom: 1rem;
    }

    .input-group { margin-bottom: 1rem; }
    .input-group label { display: block; font-size: 13px; font-weight: 600; color: var(--gray); margin-bottom: 6px; }
    .input-group input[type="text"], .input-group textarea {
      width: 100%;
      padding: 10px 14px;
      border: 1px solid var(--border);
      border-radius: 8px;
      font-size: 14px;
      outline: none;
      font-family: inherit;
      color: var(--black);
    }
    .input-group input[type="text"]:focus, .input-group textarea:focus { border-color: var(--gold); }
    .input-group textarea { height: 130px; resize: vertical; font-size: 13px; }

    .options-row { display: flex; gap: 1.5rem; margin-bottom: 1.25rem; flex-wrap: wrap; }
    .option-group label { display: block; font-size: 12px; font-weight: 600; color: var(--gray); margin-bottom: 5px; text-transform: uppercase; letter-spacing: 0.08em; }
    .option-group select {
      padding: 7px 12px;
      border: 1px solid var(--border);
      border-radius: 8px;
      font-size: 14px;
      background: var(--white);
      color: var(--black);
      outline: none;
    }
    .option-group select:focus { border-color: var(--gold); }

    .transcript-toggle {
      font-size: 12px;
      color: var(--gold);
      cursor: pointer;
      text-decoration: underline;
      margin-bottom: 0.75rem;
      display: inline-block;
    }

    .transcript-box { display: none; margin-bottom: 1rem; }
    .transcript-box.visible { display: block; }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 11px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      border: none;
      transition: opacity 0.15s, transform 0.1s;
    }
    .btn:active { transform: scale(0.98); }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-gold { background: var(--gold); color: var(--white); width: 100%; font-size: 15px; padding: 13px; }
    .btn-gold:hover:not(:disabled) { background: #b8923f; }
    .btn-outline {
      background: var(--white);
      border: 1px solid var(--border);
      color: var(--black);
      font-size: 13px;
      padding: 8px 14px;
    }
    .btn-outline:hover { background: var(--light-gray); }

    .api-note { font-size: 12px; color: var(--gray); text-align: center; margin-top: 0.75rem; }

    .status-bar {
      background: var(--light-gray);
      border-radius: 8px;
      padding: 12px 16px;
      font-size: 13px;
      color: var(--gray);
      margin-bottom: 1.5rem;
      display: none;
      align-items: center;
      gap: 10px;
    }
    .status-bar.visible { display: flex; }
    .spinner {
      width: 16px; height: 16px;
      border: 2px solid var(--border);
      border-top-color: var(--gold);
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      flex-shrink: 0;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .error-card {
      background: #fdf2f2;
      border: 1px solid #f5c6cb;
      border-radius: 8px;
      padding: 1rem;
      font-size: 14px;
      color: #c0392b;
      margin-bottom: 1rem;
      display: none;
    }
    .error-card.visible { display: block; }

    .results-section { display: none; }
    .results-section.visible { display: block; }

    .sermon-title-bar {
      background: var(--black);
      color: var(--white);
      border-radius: 10px;
      padding: 1rem 1.25rem;
      margin-bottom: 1.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }
    .sermon-title-bar .stitle { font-size: 15px; font-weight: 700; }
    .sermon-title-bar .sdate { font-size: 12px; color: var(--gold); }

    .tab-row {
      display: flex;
      border-bottom: 2px solid var(--border);
      margin-bottom: 1.5rem;
    }
    .tab-btn {
      padding: 10px 20px;
      font-size: 14px;
      font-weight: 600;
      border: none;
      background: none;
      color: var(--gray);
      cursor: pointer;
      border-bottom: 3px solid transparent;
      margin-bottom: -2px;
      transition: color 0.15s;
    }
    .tab-btn.active { color: var(--gold); border-bottom-color: var(--gold); }

    .tab-content { display: none; }
    .tab-content.active { display: block; }

    .question-card {
      background: var(--white);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 1.25rem;
      margin-bottom: 1rem;
    }
    .q-meta { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
    .q-number { font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--gold); }
    .q-timestamp { font-size: 12px; color: var(--gray); background: var(--light-gray); padding: 3px 8px; border-radius: 6px; }
    .q-question { font-size: 15px; font-weight: 700; color: var(--black); margin-bottom: 10px; line-height: 1.4; }
    .q-caption-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--gray); margin-bottom: 5px; }
    .q-caption {
      font-size: 13px; color: var(--gray); line-height: 1.6;
      padding: 10px 12px;
      background: var(--light-gray);
      border-radius: 8px;
      border-left: 3px solid var(--gold);
      margin-bottom: 8px;
    }

    .slide-card {
      background: var(--white);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 1.25rem;
      margin-bottom: 1rem;
    }
    .slide-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid var(--border);
    }
    .slide-label-text { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--gold); }
    .slide-field { margin-bottom: 10px; }
    .slide-field-key { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--gray); margin-bottom: 4px; }
    .slide-field-val {
      font-size: 14px; color: var(--black); line-height: 1.5;
      padding: 8px 12px;
      background: var(--light-gray);
      border-radius: 7px;
    }

    .canva-banner {
      background: var(--black);
      border-radius: 10px;
      padding: 1rem 1.25rem;
      margin-bottom: 1.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }
    .canva-banner p { font-size: 13px; color: #cccccc; line-height: 1.5; }
    .canva-banner p strong { color: var(--white); }
    .canva-banner a {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: var(--gold);
      color: var(--white);
      padding: 9px 16px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 700;
      text-decoration: none;
      white-space: nowrap;
    }
    .canva-banner a:hover { background: #b8923f; }

    .action-row { display: flex; gap: 0.75rem; margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--border); }
    .action-row button { flex: 1; }

    .copied-flash { color: var(--gold) !important; }
  </style>
</head>
<body>

<div class="gold-bar"></div>
<div class="header">
  <div class="header-left">
    <span class="church-name">City Light Church · Vicksburg, MS</span>
    <span class="app-name">Sermon Analyzer</span>
  </div>
</div>

<div class="container">

  <!-- LOGIN -->
  <div class="login-wrapper" id="loginWrapper">
    <div class="login-card">
      <h2>Staff Access</h2>
      <p>Enter your City Light staff password to continue.</p>
      <input type="password" id="passwordInput" placeholder="Password" />
      <div class="login-error" id="loginError"></div>
      <button class="btn btn-gold" onclick="handleLogin()">Sign In</button>
    </div>
  </div>

  <!-- MAIN APP -->
  <div class="main" id="mainSection">

    <div class="card">
      <div class="card-label">New Sermon Analysis</div>

      <div class="input-group">
        <label>YouTube Sermon Link</label>
        <input type="text" id="youtubeUrl" placeholder="https://www.youtube.com/watch?v=..." />
      </div>

      <div class="options-row">
        <div class="option-group">
          <label>Seeker Questions</label>
          <select id="questionCount">
            <option value="5">Top 5</option>
            <option value="10" selected>Top 10</option>
          </select>
        </div>
        <div class="option-group">
          <label>Sermon Notes Slides</label>
          <select id="slideCount">
            <option value="3">3 slides</option>
            <option value="4">4 slides</option>
            <option value="5" selected>5 slides</option>
          </select>
        </div>
      </div>

      <span class="transcript-toggle" onclick="toggleTranscript()">+ Paste transcript manually (recommended)</span>
      <div class="transcript-box" id="transcriptBox">
        <div class="input-group" style="margin-top: 0.75rem; margin-bottom: 0;">
          <label>Sermon Transcript</label>
          <textarea id="transcriptInput" placeholder="Paste the YouTube transcript here for best results. Go to the YouTube video → click '...' → Show transcript → copy and paste."></textarea>
        </div>
      </div>

      <button class="btn btn-gold" id="analyzeBtn" onclick="analyzeSermon()" style="margin-top: 1.25rem;">
        Analyze Sermon
      </button>
      <div class="api-note">Both outputs ready in approximately 30–45 seconds</div>
    </div>

    <div class="error-card" id="errorCard"></div>

    <div class="status-bar" id="statusBar">
      <div class="spinner"></div>
      <span id="statusText">Analyzing...</span>
    </div>

    <div class="results-section" id="resultsSection">

      <div class="sermon-title-bar">
        <span class="stitle" id="sermonTitleDisplay"></span>
        <span class="sdate" id="sermonDateDisplay"></span>
      </div>

      <div class="tab-row">
        <button class="tab-btn active" onclick="switchTab('seekers')">&#9655; Seeker Questions</button>
        <button class="tab-btn" onclick="switchTab('notes')">&#9633; Sermon Notes Slides</button>
      </div>

      <!-- SEEKERS TAB -->
      <div class="tab-content active" id="tab-seekers">
        <div id="questionsContainer"></div>
        <div class="action-row">
          <button class="btn btn-outline" onclick="downloadQuestions()">&#8595; Download .txt</button>
          <button class="btn btn-outline" onclick="copyAllQuestions()">&#10697; Copy All Questions</button>
        </div>
      </div>

      <!-- NOTES TAB -->
      <div class="tab-content" id="tab-notes">
        <div class="canva-banner">
          <p><strong>Ready to build your slides.</strong><br>Copy each slide's content below, then open your branded Canva template.</p>
          <a href="https://www.canva.com/design?create=true&template=EAHKE92RscA" target="_blank">Open Canva Template &#8599;</a>
        </div>
        <div id="slidesContainer"></div>
        <div class="action-row">
          <button class="btn btn-outline" onclick="downloadSlides()">&#8595; Download .txt</button>
          <button class="btn btn-outline" onclick="copyAllSlides()">&#10697; Copy All Slides</button>
        </div>
      </div>

    </div>
  </div>
</div>

<script>
const CORRECT_PASSWORD = 'citylight2026';
let currentQuestions = null;
let currentSlides = null;
let sermonTitle = '';
const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

function handleLogin() {
  const pw = document.getElementById('passwordInput').value;
  if (pw === CORRECT_PASSWORD) {
    document.getElementById('loginWrapper').style.display = 'none';
    document.getElementById('mainSection').classList.add('visible');
  } else {
    document.getElementById('loginError').textContent = 'Incorrect password. Please try again.';
  }
}

document.getElementById('passwordInput').addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach((b, i) => b.classList.toggle('active', (i === 0 && tab === 'seekers') || (i === 1 && tab === 'notes')));
  document.getElementById('tab-seekers').classList.toggle('active', tab === 'seekers');
  document.getElementById('tab-notes').classList.toggle('active', tab === 'notes');
}

function toggleTranscript() {
  document.getElementById('transcriptBox').classList.toggle('visible');
}

function extractVideoId(url) {
  const patterns = [/(?:youtube\.com\/watch\?v=)([^&\n?#]+)/, /(?:youtu\.be\/)([^&\n?#]+)/, /(?:youtube\.com\/embed\/)([^&\n?#]+)/];
  for (const p of patterns) { const m = url.match(p); if (m) return m[1]; }
  return null;
}

function setStatus(msg) {
  document.getElementById('statusText').textContent = msg;
  document.getElementById('statusBar').classList.add('visible');
}

function showError(msg) {
  const c = document.getElementById('errorCard');
  c.textContent = msg; c.classList.add('visible');
  document.getElementById('statusBar').classList.remove('visible');
}

function hideError() { document.getElementById('errorCard').classList.remove('visible'); }

async function fetchYouTubeTitle(videoId) {
  try {
    const res = await fetch(`/api/title?videoId=${videoId}`);
    const data = await res.json();
    return data.title || 'Untitled Sermon';
  } catch (e) { return 'Untitled Sermon'; }
}

async function fetchTranscriptAuto(videoId) {
  try {
    const res = await fetch(`/api/transcript?videoId=${videoId}`);
    const data = await res.json();
    return data.transcript || null;
  } catch (e) { return null; }
}

async function analyzeSermon() {
  hideError();
  const url = document.getElementById('youtubeUrl').value.trim();
  const manualTranscript = document.getElementById('transcriptInput').value.trim();
  const questionCount = document.getElementById('questionCount').value;
  const slideCount = document.getElementById('slideCount').value;

  if (!url) { showError('Please enter a YouTube link.'); return; }
  const videoId = extractVideoId(url);
  if (!videoId) { showError('Could not parse a YouTube video ID. Please check the URL.'); return; }

  document.getElementById('analyzeBtn').disabled = true;
  document.getElementById('resultsSection').classList.remove('visible');
  setStatus('Fetching sermon title...');

  sermonTitle = await fetchYouTubeTitle(videoId);

  let transcript = manualTranscript;
  if (!transcript) {
    setStatus('Fetching transcript from YouTube...');
    transcript = await fetchTranscriptAuto(videoId);
    if (!transcript) {
      transcript = '[No transcript available — manual transcript recommended for best results.]';
    }
  }

  setStatus('Claude is analyzing the sermon — this takes about 30 seconds...');

  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sermonTitle, url, transcript, questionCount, slideCount, date: today })
    });

    const data = await response.json();
    if (!response.ok) { showError('Analysis error: ' + (data.error || 'Unknown error')); document.getElementById('analyzeBtn').disabled = false; return; }

    const rawText = data.result || '';
    const parts = rawText.split('---SLIDES---');
    const questionsRaw = parts[0] || '';
    const slidesRaw = parts[1] || '';

    currentQuestions = questionsRaw.trim().split('\n').filter(l => l.startsWith('Q')).map(line => {
      const p = line.split('|');
      return { question: p[1] || '', timestamp: p[2] || '', caption: p[3] || '' };
    });

    currentSlides = parseSlidesFromRaw(slidesRaw);
    renderResults(currentQuestions, currentSlides);

  } catch (e) {
    showError('Network error: ' + e.message);
  }

  document.getElementById('analyzeBtn').disabled = false;
  document.getElementById('statusBar').classList.remove('visible');
}

function parseSlidesFromRaw(raw) {
  const slides = [];
  const sections = raw.split(/\n(?=TITLE_SLIDE|INTRO_SLIDE|SLIDE_\d)/);
  sections.forEach(section => {
    const lines = section.trim().split('\n');
    const header = lines[0].trim();
    const fields = {};
    lines.slice(1).forEach(l => {
      const colon = l.indexOf(':');
      if (colon > -1) {
        const key = l.substring(0, colon).trim();
        const val = l.substring(colon + 1).trim();
        if (key && val) fields[key] = val;
      }
    });
    if (header && Object.keys(fields).length > 0) slides.push({ header, fields });
  });
  return slides;
}

function renderResults(questions, slides) {
  document.getElementById('sermonTitleDisplay').textContent = sermonTitle;
  document.getElementById('sermonDateDisplay').textContent = today;

  const qContainer = document.getElementById('questionsContainer');
  qContainer.innerHTML = '';
  questions.forEach((q, i) => {
    const card = document.createElement('div');
    card.className = 'question-card';
    card.innerHTML = `
      <div class="q-meta">
        <span class="q-number">Question ${i + 1}</span>
        <span class="q-timestamp">&#9201; ${q.timestamp}</span>
      </div>
      <div class="q-question">${q.question}</div>
      <div class="q-caption-label">Social media caption</div>
      <div class="q-caption">${q.caption}</div>
      <button class="btn btn-outline" onclick="copySingleQ(${i}, this)" style="margin-top: 8px; font-size: 12px; padding: 6px 12px;">Copy Caption</button>
    `;
    qContainer.appendChild(card);
  });

  const sContainer = document.getElementById('slidesContainer');
  sContainer.innerHTML = '';
  const labelMap = { 'TITLE_SLIDE': 'Title Slide', 'INTRO_SLIDE': 'Intro Slide — Scripture & Key Point' };
  slides.forEach((slide, idx) => {
    const num = slide.header.match(/\d+/);
    const label = labelMap[slide.header] || `Takeaway Slide ${num ? num[0] : ''}`;
    let fieldsHtml = Object.entries(slide.fields).map(([k, v]) => `
      <div class="slide-field">
        <div class="slide-field-key">${k}</div>
        <div class="slide-field-val">${v}</div>
      </div>`).join('');
    const card = document.createElement('div');
    card.className = 'slide-card';
    card.innerHTML = `
      <div class="slide-header">
        <span class="slide-label-text">${label}</span>
        <button class="btn btn-outline" onclick="copySingleSlide(${idx}, this)" style="font-size: 12px; padding: 6px 12px;">Copy Slide</button>
      </div>
      ${fieldsHtml}
    `;
    sContainer.appendChild(card);
  });

  document.getElementById('resultsSection').classList.add('visible');
}

function copySingleQ(i, btn) {
  const q = currentQuestions[i];
  navigator.clipboard.writeText(`${q.question}\n\nTimestamp: ${q.timestamp}\n\n${q.caption}`).then(() => {
    const orig = btn.textContent; btn.textContent = 'Copied!'; btn.classList.add('copied-flash');
    setTimeout(() => { btn.textContent = orig; btn.classList.remove('copied-flash'); }, 1500);
  }).catch(() => {});
}

function copySingleSlide(i, btn) {
  const s = currentSlides[i];
  let text = s.header + '\n';
  Object.entries(s.fields).forEach(([k, v]) => { text += `${k}: ${v}\n`; });
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.textContent; btn.textContent = 'Copied!'; btn.classList.add('copied-flash');
    setTimeout(() => { btn.textContent = orig; btn.classList.remove('copied-flash'); }, 1500);
  }).catch(() => {});
}

function copyAllQuestions() {
  if (!currentQuestions) return;
  let text = `SEEKER QUESTIONS\n${sermonTitle}\n${today}\n${'='.repeat(40)}\n\n`;
  currentQuestions.forEach((q, i) => { text += `Q${i + 1}: ${q.question}\nTimestamp: ${q.timestamp}\nCaption: ${q.caption}\n\n`; });
  navigator.clipboard.writeText(text).catch(() => {});
}

function copyAllSlides() {
  if (!currentSlides) return;
  let text = `SERMON NOTES SLIDES\n${sermonTitle}\n${today}\n${'='.repeat(40)}\n\n`;
  currentSlides.forEach(s => {
    text += s.header + '\n';
    Object.entries(s.fields).forEach(([k, v]) => { text += `${k}: ${v}\n`; });
    text += '\n';
  });
  navigator.clipboard.writeText(text).catch(() => {});
}

function downloadQuestions() {
  if (!currentQuestions) return;
  let text = `SEEKER QUESTIONS\n${sermonTitle}\n${today}\n${'='.repeat(40)}\n\n`;
  currentQuestions.forEach((q, i) => { text += `Q${i + 1}: ${q.question}\nTimestamp: ${q.timestamp}\nCaption: ${q.caption}\n\n`; });
  download(text, `${slugify(sermonTitle)}_questions.txt`);
}

function downloadSlides() {
  if (!currentSlides) return;
  let text = `SERMON NOTES SLIDES\n${sermonTitle}\n${today}\n${'='.repeat(40)}\n\n`;
  currentSlides.forEach(s => {
    text += s.header + '\n';
    Object.entries(s.fields).forEach(([k, v]) => { text += `${k}: ${v}\n`; });
    text += '\n';
  });
  download(text, `${slugify(sermonTitle)}_slides.txt`);
}

function download(text, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  a.download = filename; a.click();
}

function slugify(str) {
  return (str || 'sermon').replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 40);
}
</script>
</body>
</html>

/* ============================================================
   analyze.js – Upload, Validation, Analysis Flow
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  if (!Auth.requireAuth()) return;
  Sidebar.render('analyze');
  initAnalyze();
});

const state = {
  files: [],    // { name, type, size, content }
  isAnalyzing: false
};

function initAnalyze() {
  setupDropZone();
  setupBrowse();
  setupStartBtn();
}

/* ── Drop Zone ────────────────────────────────────────────── */
function setupDropZone() {
  const zone = document.getElementById('upload-zone');
  if (!zone) return;

  zone.addEventListener('dragover', e => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    handleFiles(Array.from(e.dataTransfer.files));
  });
  zone.addEventListener('click', () => {
    document.getElementById('file-input').click();
  });
}

function setupBrowse() {
  const input = document.getElementById('file-input');
  if (!input) return;
  input.addEventListener('change', () => {
    handleFiles(Array.from(input.files));
    input.value = '';
  });
}

/* ── File Handling ────────────────────────────────────────── */
function handleFiles(rawFiles) {
  clearError();
  const rejected = [];

  rawFiles.forEach(file => {
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'py' && ext !== 'txt') {
      rejected.push(file.name);
      return;
    }
    // avoid duplicates
    if (state.files.find(f => f.name === file.name)) return;

    const reader = new FileReader();
    reader.onload = e => {
      state.files.push({
        name:    file.name,
        type:    ext,
        size:    file.size,
        content: e.target.result
      });
      renderFileList();
      updateStartBtn();
    };
    reader.readAsText(file);
  });

  if (rejected.length) {
    showError(`Only .py and .txt files are supported. Rejected: ${rejected.join(', ')}`);
  }
}

/* ── File List Render ─────────────────────────────────────── */
function renderFileList() {
  const section = document.getElementById('selected-section');
  const list    = document.getElementById('file-list');
  const counter = document.getElementById('file-counter');
  if (!section || !list) return;

  section.style.display = state.files.length ? 'block' : 'none';
  if (counter) counter.textContent = state.files.length;

  list.innerHTML = state.files.map((f, i) => {
    const emoji = f.type === 'py' ? '🐍' : '📄';
    const sizeLabel = f.size < 1024
      ? f.size + ' B'
      : f.size < 1048576
        ? (f.size / 1024).toFixed(1) + ' KB'
        : (f.size / 1048576).toFixed(1) + ' MB';

    return `
      <div class="file-item" id="file-item-${i}">
        <span class="file-emoji">${emoji}</span>
        <div class="file-info">
          <div class="file-name" title="${f.name}">${f.name}</div>
          <div class="file-meta">${sizeLabel}</div>
        </div>
        <span class="file-tag ${f.type}">.${f.type}</span>
        <button class="file-remove" onclick="removeFile(${i})" title="Remove file">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>`;
  }).join('');
}

function removeFile(idx) {
  state.files.splice(idx, 1);
  renderFileList();
  updateStartBtn();
  if (!state.files.length) {
    document.getElementById('selected-section').style.display = 'none';
  }
}

function updateStartBtn() {
  const btn = document.getElementById('start-analysis-btn');
  if (!btn) return;
  const hasPairs = canAnalyze();
  btn.disabled = !hasPairs;

  const hint = document.getElementById('analysis-hint');
  if (hint) {
    if (!state.files.length) {
      hint.textContent = 'Upload at least 2 files of the same type to start analysis.';
    } else if (!hasPairs) {
      hint.textContent = 'Need at least 2 .py files or 2 .txt files to compare.';
    } else {
      const pairs = countPairs();
      hint.textContent = `${state.files.length} file${state.files.length > 1 ? 's' : ''} selected — ${pairs} comparison${pairs > 1 ? 's' : ''} will be generated.`;
    }
  }
}

function canAnalyze() {
  const py  = state.files.filter(f => f.type === 'py').length;
  const txt = state.files.filter(f => f.type === 'txt').length;
  return py >= 2 || txt >= 2;
}

function countPairs() {
  const py  = state.files.filter(f => f.type === 'py').length;
  const txt = state.files.filter(f => f.type === 'txt').length;
  const pairs = (py * (py - 1)) / 2 + (txt * (txt - 1)) / 2;
  return pairs;
}

/* ── Error Display ────────────────────────────────────────── */
function showError(msg) {
  const el = document.getElementById('upload-error');
  if (!el) return;
  el.innerHTML = `
    <div class="alert alert-danger" style="margin-bottom:0;">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      ${msg}
    </div>`;
  el.style.display = 'block';
}

function clearError() {
  const el = document.getElementById('upload-error');
  if (el) { el.innerHTML = ''; el.style.display = 'none'; }
}

/* ── Start Analysis ───────────────────────────────────────── */
function setupStartBtn() {
  const btn = document.getElementById('start-analysis-btn');
  if (!btn) return;
  btn.addEventListener('click', startAnalysis);
}

async function startAnalysis() {
  if (state.isAnalyzing || !canAnalyze()) return;
  state.isAnalyzing = true;

  const btn = document.getElementById('start-analysis-btn');
  if (btn) btn.disabled = true;

  showProgressSection();

  const steps = [
    { id: 'step-upload',    label: 'Uploading Files' },
    { id: 'step-process',   label: 'Processing Files' },
    { id: 'step-ast',       label: 'AST Analysis' },
    { id: 'step-similarity',label: 'Similarity Calculation' },
    { id: 'step-complete',  label: 'Analysis Completed' },
  ];

  // Animate through steps
  for (let i = 0; i < steps.length - 1; i++) {
    setStepActive(steps[i].id);
    await delay(600);
    setStepDone(steps[i].id);
  }

  // Actually run the analysis
  const results = await Analyzer.analyzeFiles(state.files);

  setStepActive(steps[steps.length - 1].id);
  await delay(400);
  setStepDone(steps[steps.length - 1].id);

  // Save to localStorage
  Storage.saveAnalyses(results);

  // Set last result for the Results page
  if (results.length > 0) {
    Storage.setLastResult(results[0].reportId);
  }

  await delay(700);
  showToast('Analysis complete! Redirecting to results…', 'success');
  await delay(900);
  window.location.href = 'results.html';
}

function showProgressSection() {
  const zone = document.getElementById('upload-card');
  const prog = document.getElementById('progress-card');
  if (zone) zone.style.display = 'none';
  if (prog) prog.style.display = 'block';
}

function setStepActive(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('done');
  el.classList.add('active');
  el.querySelector('.step-icon').innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>`;
}

function setStepDone(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('active');
  el.classList.add('done');
  el.querySelector('.step-icon').innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>`;
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

/* ── Toast ────────────────────────────────────────────────── */
function showToast(msg, type = '') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
    ${msg}`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

/* ============================================================
   results.js – Results Page Rendering
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  if (!Auth.requireAuth()) return;
  Sidebar.render('results');
  initResults();
});

function initResults() {
  const id = Storage.getLastResult();
  if (!id) {
    showNoResult();
    return;
  }

  const analysis = Storage.getAnalysisById(id);
  if (!analysis) {
    showNoResult();
    return;
  }

  renderComparedFiles(analysis);
  renderBreakdown(analysis);
  renderDetectionDetails(analysis);

  // Build pair selector if multiple analyses
  buildAnalysisSelector(id);
}

/* ── Selector (if multiple results) ──────────────────────── */
function buildAnalysisSelector(currentId) {
  const analyses = Storage.getAnalyses();
  const sel = document.getElementById('result-selector');
  if (!sel || analyses.length <= 1) {
    if (sel) sel.style.display = 'none';
    return;
  }
  sel.style.display = 'flex';
  const select = document.getElementById('result-select');
  if (!select) return;

  select.innerHTML = analyses.map(a =>
    `<option value="${a.reportId}" ${a.reportId === currentId ? 'selected' : ''}>
       ${a.file1} ↔ ${a.file2} (${a.overallSimilarity}%)
     </option>`
  ).join('');

  select.addEventListener('change', () => {
    Storage.setLastResult(select.value);
    initResults();
  });
}

/* ── Compared Files ───────────────────────────────────────── */
function renderComparedFiles(a) {
  setText('res-file1-name', a.file1);
  setText('res-file2-name', a.file2);
  setText('res-file1-type', `.${a.fileType} file`);
  setText('res-file2-type', `.${a.fileType} file`);
  setText('res-report-id',  a.reportId);
  setText('res-date',       a.analysisDate);
  setText('res-overall',    a.overallSimilarity + '%');
}

/* ── Similarity Breakdown ─────────────────────────────────── */
function renderBreakdown(a) {
  const isPy = a.fileType === 'py';

  const metrics = [
    { id: 'bd-code-structure', label: 'Code Structure',   value: a.codeStructure,     primary: isPy },
    { id: 'bd-ast-pattern',    label: 'AST Pattern',      value: a.astPattern,         primary: isPy },
    { id: 'bd-logic',          label: 'Logic Similarity', value: a.logicSimilarity,    primary: isPy },
    { id: 'bd-text',           label: 'Text Similarity',  value: a.textSimilarity,     primary: !isPy },
  ];

  const container = document.getElementById('breakdown-list');
  if (!container) return;

  container.innerHTML = metrics.map(m => {
    const pct     = m.value;
    const fillCls = pct >= 80 ? 'danger' : pct >= 70 ? 'orange' : pct >= 50 ? 'warning' : 'success';
    const weight  = m.primary ? ' (Primary)' : '';
    return `
      <div class="breakdown-item">
        <div class="breakdown-label">
          <span>${m.label}<span style="font-size:.7rem;color:var(--text-3);font-weight:400;">${weight}</span></span>
          <span class="breakdown-pct">${pct}%</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill ${fillCls}" style="width:${pct}%"></div>
        </div>
      </div>`;
  }).join('');
}

/* ── Detection Details ────────────────────────────────────── */
function renderDetectionDetails(a) {
  const container = document.getElementById('details-list');
  if (!container) return;

  const details = a.details || ['Analysis details not available.'];

  container.innerHTML = details.map(d => `
    <div class="detail-item">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
      ${d}
    </div>`).join('');

  // Status badge
  const badgeEl = document.getElementById('detection-status-badge');
  if (badgeEl) {
    const key = a.classificationKey;
    const cls = key === 'duplicate' ? 'duplicate' : key === 'high' ? 'high' : key === 'similar' ? 'similar' : 'low';
    badgeEl.className = `status-badge ${cls}`;
    badgeEl.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="width:15px;height:15px;">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      ${a.classification}`;
  }
}

/* ── Helpers ──────────────────────────────────────────────── */
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function showNoResult() {
  const content = document.getElementById('results-content');
  const empty   = document.getElementById('results-empty');
  if (content) content.style.display = 'none';
  if (empty)   empty.style.display   = 'block';
}

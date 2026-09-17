/* ============================================================
   dashboard.js – Dashboard Stats, Charts & High Matches
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  if (!Auth.requireAuth()) return;
  Sidebar.render('dashboard');
  initDashboard();
});

function initDashboard() {
  renderGreeting();
  renderStats();
  renderHighMatches();
  renderBarChart();
  renderPieChart();
}

/* ── Greeting ─────────────────────────────────────────────── */
function renderGreeting() {
  const user = Auth.getCurrentUser();
  const name = user ? user.username : 'User';
  const hour = new Date().getHours();
  const tod  = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';

  const el = document.getElementById('greeting-text');
  if (el) el.textContent = `Good ${tod}, ${name} 👋`;
}

/* ── Stats Cards ──────────────────────────────────────────── */
function renderStats() {
  const s = Storage.getDashboardStats();

  setText('stat-total-files',  s.totalFiles);
  setText('stat-high-matches', s.highMatches);
  setText('stat-avg-sim',      s.avgSimilarity > 0 ? s.avgSimilarity + '%' : '0%');
  setText('stat-duplicates',   s.duplicates);
  setText('stat-py-count',     s.pyCount);
  setText('stat-txt-count',    s.txtCount);

  const hmSub = document.getElementById('stat-high-matches-sub');
  if (hmSub) hmSub.textContent = s.highMatches === 1 ? '1 file pair detected' : `${s.highMatches} file pairs detected`;
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

/* ── High Match Section ───────────────────────────────────── */
function renderHighMatches() {
  const s   = Storage.getDashboardStats();
  const container = document.getElementById('high-matches-container');
  const countBadge = document.getElementById('hm-count-badge');
  if (!container) return;

  const pairs = s.highMatchPairs;
  if (countBadge) countBadge.textContent = pairs.length;

  if (!pairs.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🎯</div>
        <div class="empty-state-title">No high matches detected</div>
        <div class="empty-state-sub">Upload and analyze files to see high similarity pairs here.</div>
      </div>`;
    return;
  }

  const pyPairs  = pairs.filter(p => p.fileType === 'py');
  const txtPairs = pairs.filter(p => p.fileType === 'txt');

  let html = '';

  if (pyPairs.length) {
    html += `<div class="match-group-label">🐍 Python Files</div>
             <div class="match-grid">${pyPairs.map(matchCardHtml).join('')}</div>`;
  }
  if (txtPairs.length) {
    html += `<div class="match-group-label">📄 Text Files</div>
             <div class="match-grid">${txtPairs.map(matchCardHtml).join('')}</div>`;
  }

  container.innerHTML = html;

  // View buttons
  container.querySelectorAll('[data-view-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.viewId;
      Storage.setLastResult(id);
      window.location.href = 'results.html';
    });
  });
}

function matchCardHtml(pair) {
  const isDup   = pair.overallSimilarity >= 80;
  const cls     = isDup ? 'very-high-match' : 'high-match';
  const label   = isDup ? 'Very High Match / Duplicate' : 'High Match';
  const pctCls  = isDup ? 'danger' : '';

  return `
    <div class="match-card ${cls}">
      <div class="match-file" title="${pair.file1}">${pair.file1}</div>
      <div class="match-arrow">
        <span style="color:var(--text-3);">↕</span>
        <span class="match-pct ${pctCls}">${pair.overallSimilarity}%</span>
      </div>
      <div class="match-file" title="${pair.file2}">${pair.file2}</div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px;">
        <span class="match-badge ${cls}">
          <span class="dot"></span>${label}
        </span>
        <button class="btn btn-sm btn-outline" data-view-id="${pair.reportId}" style="font-size:.72rem;padding:4px 10px;">View</button>
      </div>
    </div>`;
}

/* ── Bar Chart ────────────────────────────────────────────── */
function renderBarChart() {
  const container = document.getElementById('bar-chart-content');
  if (!container) return;

  const analyses = Storage.getAnalyses();

  if (!analyses.length) {
    container.innerHTML = `<div class="empty-state" style="padding:24px 0;">
      <div class="empty-state-icon">📊</div>
      <div class="empty-state-title">No analysis data available</div>
      <div class="empty-state-sub">Upload files to view similarity statistics.</div>
    </div>`;
    return;
  }

  const items = analyses.slice(0, 8); // show up to 8
  const html  = items.map(a => {
    const pct     = a.overallSimilarity;
    const label   = `${truncate(a.file1, 14)} / ${truncate(a.file2, 14)}`;
    const fillCls = pct >= 80 ? 'danger' : pct >= 70 ? 'orange' : pct >= 50 ? 'success' : '';
    return `
      <div class="bar-item">
        <div class="bar-label">
          <span>${label}</span>
          <span class="pct">${pct}%</span>
        </div>
        <div class="bar-track">
          <div class="bar-fill ${fillCls}" style="width:${pct}%"></div>
        </div>
      </div>`;
  }).join('');

  container.innerHTML = `<div class="bar-chart-list">${html}</div>`;
}

/* ── Pie Chart ────────────────────────────────────────────── */
function renderPieChart() {
  const wrap = document.getElementById('pie-chart-wrap');
  if (!wrap) return;

  const analyses = Storage.getAnalyses();

  if (!analyses.length) {
    wrap.innerHTML = `<div class="empty-state" style="padding:24px 0;">
      <div class="empty-state-icon">🥧</div>
      <div class="empty-state-title">No analysis data available</div>
      <div class="empty-state-sub">Upload files to view similarity statistics.</div>
    </div>`;
    return;
  }

  const cats = { duplicate: 0, high: 0, similar: 0, low: 0 };
  analyses.forEach(a => { cats[a.classificationKey]++; });
  const total = analyses.length;

  const segments = [
    { label: 'Very High / Duplicate', key: 'duplicate', color: '#ef4444', count: cats.duplicate },
    { label: 'High Match',            key: 'high',      color: '#f97316', count: cats.high },
    { label: 'Similar',               key: 'similar',   color: '#f59e0b', count: cats.similar },
    { label: 'Low Similarity',        key: 'low',       color: '#94a3b8', count: cats.low },
  ].filter(s => s.count > 0);

  wrap.innerHTML = `
    <div class="pie-wrap">
      <div class="pie-canvas-wrap">
        <canvas id="pie-canvas" width="150" height="150"></canvas>
      </div>
      <div class="pie-legend" id="pie-legend"></div>
    </div>`;

  // Draw pie
  const canvas = document.getElementById('pie-canvas');
  const ctx    = canvas.getContext('2d');
  const cx = 75, cy = 75, r = 68;
  let startAngle = -Math.PI / 2;

  if (segments.every(s => s.count === 0)) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#e2e8f0';
    ctx.fill();
  } else {
    segments.forEach(seg => {
      const slice = (seg.count / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, startAngle, startAngle + slice);
      ctx.closePath();
      ctx.fillStyle = seg.color;
      ctx.fill();
      startAngle += slice;
    });
    // white center
    ctx.beginPath();
    ctx.arc(cx, cy, 36, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    // center text
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 18px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(total, cx, cy - 7);
    ctx.font = '10px Inter, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('total', cx, cy + 10);
  }

  // Legend
  const legend = document.getElementById('pie-legend');
  if (legend) {
    legend.innerHTML = segments.map(s => {
      const pct = Math.round((s.count / total) * 100);
      return `<div class="legend-item">
        <span class="legend-dot" style="background:${s.color}"></span>
        <span>${s.label}</span>
        <span class="legend-pct">${pct}%</span>
      </div>`;
    }).join('');

    if (!segments.length) {
      legend.innerHTML = '<div style="font-size:.8rem;color:var(--text-3);">No data</div>';
    }
  }
}

function truncate(str, max) {
  return str.length > max ? str.slice(0, max) + '…' : str;
}

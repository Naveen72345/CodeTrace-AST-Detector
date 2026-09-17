/* ============================================================
   history.js – History Table
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  if (!Auth.requireAuth()) return;
  Sidebar.render('history');
  renderHistory();
});

function renderHistory() {
  const analyses  = Storage.getAnalyses();
  const tbody     = document.getElementById('history-tbody');
  const emptyEl   = document.getElementById('history-empty');
  const tableWrap = document.getElementById('history-table-wrap');
  const countEl   = document.getElementById('history-count');

  if (countEl) countEl.textContent = analyses.length;

  if (!analyses.length) {
    if (tableWrap) tableWrap.style.display = 'none';
    if (emptyEl)   emptyEl.style.display   = 'flex';
    return;
  }

  if (tableWrap) tableWrap.style.display = 'block';
  if (emptyEl)   emptyEl.style.display   = 'none';

  if (!tbody) return;
  tbody.innerHTML = analyses.map((a, i) => {
    const cls  = simClass(a.classificationKey);
    const num  = i + 1;
    return `
      <tr>
        <td><span class="report-id">${a.reportId}</span></td>
        <td><span class="file-bold">${a.file1}</span></td>
        <td><span class="file-bold">${a.file2}</span></td>
        <td style="white-space:nowrap;">${a.analysisDate}</td>
        <td><span class="sim-badge ${cls}">${a.overallSimilarity}%</span></td>
        <td><span class="sim-badge ${cls}">${a.classification}</span></td>
        <td>
          <button class="btn btn-sm btn-outline" onclick="viewResult('${a.reportId}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:13px;height:13px;">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            View
          </button>
        </td>
      </tr>`;
  }).join('');
}

function viewResult(id) {
  Storage.setLastResult(id);
  window.location.href = 'results.html';
}

function simClass(key) {
  const map = { duplicate: 'duplicate', high: 'high', similar: 'similar', low: 'low' };
  return map[key] || 'low';
}

/* ============================================================
   reports.js – Reports Table + Real .xlsx Export (SheetJS)
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  if (!Auth.requireAuth()) return;
  Sidebar.render('reports');
  renderReports();
});

function renderReports() {
  const analyses  = Storage.getAnalyses();
  const tbody     = document.getElementById('reports-tbody');
  const emptyEl   = document.getElementById('reports-empty');
  const tableWrap = document.getElementById('reports-table-wrap');
  const countEl   = document.getElementById('reports-count');

  if (countEl) countEl.textContent = analyses.length;

  if (!analyses.length) {
    if (tableWrap) tableWrap.style.display = 'none';
    if (emptyEl)   emptyEl.style.display   = 'flex';
    return;
  }

  if (tableWrap) tableWrap.style.display = 'block';
  if (emptyEl)   emptyEl.style.display   = 'none';

  if (!tbody) return;
  tbody.innerHTML = analyses.map((a) => {
    const cls = simClass(a.classificationKey);
    return `
      <tr>
        <td><span class="report-id">${a.reportId}</span></td>
        <td><span class="file-bold">${a.file1}</span></td>
        <td><span class="file-bold">${a.file2}</span></td>
        <td style="white-space:nowrap;">${a.analysisDate}</td>
        <td><span class="sim-badge ${cls}">${a.overallSimilarity}%</span></td>
        <td><span class="sim-badge ${cls}">${a.classification}</span></td>
        <td>
          <div class="action-btns">
            <button class="btn btn-sm btn-outline" onclick="viewReport('${a.reportId}')" title="View Details">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:13px;height:13px;">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              View Details
            </button>
            <button class="btn btn-sm btn-primary" onclick="downloadExcel('${a.reportId}')" title="Download Excel">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:13px;height:13px;">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Excel
            </button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

function viewReport(id) {
  Storage.setLastResult(id);
  window.location.href = 'results.html';
}

function simClass(key) {
  const map = { duplicate: 'duplicate', high: 'high', similar: 'similar', low: 'low' };
  return map[key] || 'low';
}

/* ── Excel Export ─────────────────────────────────────────── */
function downloadExcel(reportId) {
  if (typeof XLSX === 'undefined') {
    showToast('SheetJS library not loaded. Check internet connection.', 'error');
    return;
  }

  const a = Storage.getAnalysisById(reportId);
  if (!a) { showToast('Report not found.', 'error'); return; }

  // Worksheet 1: Summary
  const summaryData = [
    ['CodeTrace – Analysis Report'],
    [],
    ['Report ID',          a.reportId],
    ['Analysis Date',      a.analysisDate],
    ['File Type',          `.${a.fileType}`],
    [],
    ['File 1',             a.file1],
    ['File 2',             a.file2],
    [],
    ['Overall Similarity', a.overallSimilarity + '%'],
    ['Classification',     a.classification],
    [],
    ['Similarity Breakdown'],
    ['Code Structure',     a.codeStructure + '%'],
    ['AST Pattern',        a.astPattern + '%'],
    ['Logic Similarity',   a.logicSimilarity + '%'],
    ['Text Similarity',    a.textSimilarity + '%'],
    [],
    ['Detection Details'],
    ...(a.details || []).map(d => ['', d]),
  ];

  const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
  ws1['!cols'] = [{ wch: 24 }, { wch: 48 }];

  // Worksheet 2: All Reports
  const all = Storage.getAnalyses();
  const allData = [
    ['Report ID', 'File 1', 'File 2', 'File Type', 'Overall Similarity', 'Code Structure', 'AST Pattern', 'Logic Similarity', 'Text Similarity', 'Classification', 'Date'],
    ...all.map(r => [
      r.reportId,
      r.file1,
      r.file2,
      `.${r.fileType}`,
      r.overallSimilarity + '%',
      r.codeStructure + '%',
      r.astPattern + '%',
      r.logicSimilarity + '%',
      r.textSimilarity + '%',
      r.classification,
      r.analysisDate
    ])
  ];

  const ws2 = XLSX.utils.aoa_to_sheet(allData);
  ws2['!cols'] = [
    {wch:18},{wch:24},{wch:24},{wch:10},{wch:18},{wch:16},{wch:14},{wch:18},{wch:16},{wch:28},{wch:22}
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, 'Report Summary');
  XLSX.utils.book_append_sheet(wb, ws2, 'All Reports');

  const filename = `CodeTrace_${a.reportId}_${a.file1.replace(/\s/g, '_')}.xlsx`;
  XLSX.writeFile(wb, filename);
  showToast('Excel report downloaded!', 'success');
}

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
  const icon = type === 'success'
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="width:15px;height:15px;flex-shrink:0"><polyline points="20 6 9 17 4 12"/></svg>`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="width:15px;height:15px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
  toast.innerHTML = `${icon} ${msg}`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

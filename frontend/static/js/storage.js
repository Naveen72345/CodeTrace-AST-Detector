/* ============================================================
   storage.js – LocalStorage Helpers
   ============================================================ */

const Storage = (() => {
  const ANALYSES_KEY  = 'ct_analyses';
  const LAST_RES_KEY  = 'ct_last_result';

  /* ── Analyses ─────────────────────────────────────────────── */
  function getAnalyses() {
    return JSON.parse(localStorage.getItem(ANALYSES_KEY) || '[]');
  }

  function saveAnalysis(result) {
    const list = getAnalyses();
    // Replace if same ID already exists
    const idx = list.findIndex(a => a.reportId === result.reportId);
    if (idx !== -1) list[idx] = result;
    else list.unshift(result);
    localStorage.setItem(ANALYSES_KEY, JSON.stringify(list));
  }

  function saveAnalyses(results) {
    results.forEach(r => saveAnalysis(r));
  }

  function getAnalysisById(id) {
    return getAnalyses().find(a => a.reportId === id) || null;
  }

  function clearAnalyses() {
    localStorage.removeItem(ANALYSES_KEY);
  }

  function clearHistory() {
    localStorage.removeItem(ANALYSES_KEY);
    localStorage.removeItem(LAST_RES_KEY);
    sessionStorage.clear();
  }

  /* ── Last Result (for Results page) ─────────────────────── */
  function setLastResult(id) {
    localStorage.setItem(LAST_RES_KEY, id);
  }

  function getLastResult() {
    return localStorage.getItem(LAST_RES_KEY);
  }

  /* ── Computed Dashboard Stats ────────────────────────────── */
  function getDashboardStats() {
    const analyses = getAnalyses();

    if (!analyses.length) {
      return {
        totalFiles: 0,
        highMatches: 0,
        avgSimilarity: 0,
        duplicates: 0,
        pyCount: 0,
        txtCount: 0,
        highMatchPairs: [],
        allPairs: []
      };
    }

    // Collect unique filenames + types from all analyses
    const fileSet = new Map(); // filename → type
    analyses.forEach(a => {
      fileSet.set(a.file1, a.fileType);
      fileSet.set(a.file2, a.fileType);
    });

    let pyCount  = 0;
    let txtCount = 0;
    fileSet.forEach((type) => {
      if (type === 'py')  pyCount++;
      else if (type === 'txt') txtCount++;
    });

    const totalFiles = pyCount + txtCount;

    // Similarity stats
    const similarities = analyses.map(a => a.overallSimilarity);
    const avgSimilarity = similarities.length
      ? Math.round(similarities.reduce((s, v) => s + v, 0) / similarities.length * 10) / 10
      : 0;

    const highMatchPairs = analyses.filter(a => a.overallSimilarity >= 70);
    const duplicates     = analyses.filter(a => a.overallSimilarity >= 80).length;

    return {
      totalFiles,
      highMatches: highMatchPairs.length,
      avgSimilarity,
      duplicates,
      pyCount,
      txtCount,
      highMatchPairs,
      allPairs: analyses
    };
  }

  return {
    getAnalyses,
    saveAnalysis,
    saveAnalyses,
    getAnalysisById,
    clearAnalyses,
    clearHistory,
    setLastResult,
    getLastResult,
    getDashboardStats
  };
})();

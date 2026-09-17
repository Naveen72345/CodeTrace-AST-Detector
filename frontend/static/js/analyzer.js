/* ============================================================
   analyzer.js – Frontend Similarity Engine
   Handles both .py (structural) and .txt (token-based) analysis.
   Designed to be swapped for a real Flask/Python backend later.
   ============================================================ */

const Analyzer = (() => {

  /* ── Utilities ──────────────────────────────────────────── */
  function generateReportId() {
    const ts   = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substr(2, 4).toUpperCase();
    return `CT-${ts}-${rand}`;
  }

  function formatDate(ts) {
    return new Date(ts).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  /* ── Classify Similarity ────────────────────────────────── */
  function classify(score) {
    if (score >= 80) return 'Very High Match / Duplicate';
    if (score >= 70) return 'High Match';
    if (score >= 50) return 'Similar';
    return 'Low Similarity';
  }

  function classifyKey(score) {
    if (score >= 80) return 'duplicate';
    if (score >= 70) return 'high';
    if (score >= 50) return 'similar';
    return 'low';
  }

  /* ── Tokenise text ──────────────────────────────────────── */
  function tokenize(text) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9_\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 1);
  }

  /* ── Jaccard Similarity ─────────────────────────────────── */
  function jaccard(tokensA, tokensB) {
    if (!tokensA.length && !tokensB.length) return 1;
    const setA = new Set(tokensA);
    const setB = new Set(tokensB);
    let inter = 0;
    setA.forEach(t => { if (setB.has(t)) inter++; });
    const union = setA.size + setB.size - inter;
    return union === 0 ? 0 : inter / union;
  }

  /* ── Bigram Similarity ─────────────────────────────────── */
  function bigrams(s) {
    const b = new Set();
    const clean = s.toLowerCase().replace(/\s+/g, ' ').trim();
    for (let i = 0; i < clean.length - 1; i++) b.add(clean.slice(i, i + 2));
    return b;
  }

  function bigramSim(a, b) {
    const ba = bigrams(a); const bb = bigrams(b);
    if (!ba.size && !bb.size) return 1;
    let inter = 0;
    ba.forEach(g => { if (bb.has(g)) inter++; });
    return (2 * inter) / (ba.size + bb.size);
  }

  /* ── Python Structural Extractor ────────────────────────── */
  function extractPyFeatures(code) {
    const lines = code.split('\n');

    const defs      = [];
    const classes   = [];
    const imports   = [];
    const loops     = [];
    const conditionals = [];
    const variables = [];

    lines.forEach(line => {
      const trimmed = line.trim();

      // Function defs
      const defMatch = trimmed.match(/^def\s+([a-zA-Z_]\w*)\s*\(/);
      if (defMatch) defs.push(defMatch[1]);

      // Class defs
      const classMatch = trimmed.match(/^class\s+([a-zA-Z_]\w*)/);
      if (classMatch) classes.push(classMatch[1]);

      // Imports
      const impMatch = trimmed.match(/^(?:import|from)\s+([a-zA-Z_][\w.]*)/);
      if (impMatch) imports.push(impMatch[1]);

      // Loops
      if (/^for\s+/.test(trimmed) || /^while\s+/.test(trimmed)) loops.push(trimmed.slice(0, 40));

      // Conditionals
      if (/^if\s+/.test(trimmed) || /^elif\s+/.test(trimmed)) conditionals.push(trimmed.slice(0, 40));

      // Variable assignments (simple)
      const varMatch = trimmed.match(/^([a-zA-Z_]\w*)\s*=/);
      if (varMatch && !trimmed.startsWith('def') && !trimmed.startsWith('class')) {
        variables.push(varMatch[1]);
      }
    });

    return { defs, classes, imports, loops, conditionals, variables, allLines: lines };
  }

  /* ── Overlap ratio between two arrays ───────────────────── */
  function overlapRatio(arrA, arrB) {
    if (!arrA.length && !arrB.length) return 1;
    if (!arrA.length || !arrB.length) return 0;
    const setA = new Set(arrA.map(s => s.toLowerCase()));
    const setB = new Set(arrB.map(s => s.toLowerCase()));
    let inter = 0;
    setA.forEach(v => { if (setB.has(v)) inter++; });
    return inter / Math.max(setA.size, setB.size);
  }

  /* ── Python Similarity Calculation ──────────────────────── */
  function calcPySimilarity(contentA, contentB) {
    const fA = extractPyFeatures(contentA);
    const fB = extractPyFeatures(contentB);

    // Code Structure: def + class names
    const structA = [...fA.defs, ...fA.classes];
    const structB = [...fB.defs, ...fB.classes];
    const codeStructure = Math.round(overlapRatio(structA, structB) * 100);

    // AST Pattern: imports + loops + conditionals
    const astA = [...fA.imports, ...fA.loops, ...fA.conditionals];
    const astB = [...fB.imports, ...fB.loops, ...fB.conditionals];
    const astPattern = astA.length || astB.length
      ? Math.round((jaccard(tokenize(astA.join(' ')), tokenize(astB.join(' '))) * 100))
      : Math.round(bigramSim(contentA.slice(0, 400), contentB.slice(0, 400)) * 100);

    // Logic: variable names + overall token jaccard
    const varOverlap  = overlapRatio(fA.variables, fB.variables);
    const tokenSim    = jaccard(tokenize(contentA), tokenize(contentB));
    const logicSim    = Math.round(((varOverlap * 0.5) + (tokenSim * 0.5)) * 100);

    // Text: raw bigram similarity
    const textSim = Math.round(bigramSim(contentA, contentB) * 100);

    // Overall weighted score
    const overall = Math.round(
      codeStructure * 0.30 +
      astPattern    * 0.25 +
      logicSim      * 0.25 +
      textSim       * 0.20
    );

    // Detection details
    const details = [];
    if (overlapRatio(fA.defs, fB.defs) > 0.3)
      details.push(`${Math.round(overlapRatio(fA.defs, fB.defs)*100)}% of function definitions match`);
    if (overlapRatio(fA.classes, fB.classes) > 0.3)
      details.push(`${Math.round(overlapRatio(fA.classes, fB.classes)*100)}% of class definitions match`);
    if (overlapRatio(fA.imports, fB.imports) > 0.3)
      details.push(`${Math.round(overlapRatio(fA.imports, fB.imports)*100)}% of import statements match`);
    if (fA.loops.length && fB.loops.length)
      details.push('Similar loop structures detected');
    if (fA.conditionals.length && fB.conditionals.length)
      details.push('Matching conditional patterns found');
    if (varOverlap > 0.4)
      details.push('Similar variable naming conventions identified');
    if (tokenSim > 0.5)
      details.push('High overall code token overlap detected');
    if (overall >= 80)
      details.push('Code duplication strongly indicated by AST pattern analysis');
    if (!details.length)
      details.push('Low structural similarity between the two files');

    return {
      codeStructure: clamp(codeStructure, 0, 100),
      astPattern:    clamp(astPattern,    0, 100),
      logicSim:      clamp(logicSim,      0, 100),
      textSim:       clamp(textSim,       0, 100),
      overall:       clamp(overall,       0, 100),
      details
    };
  }

  /* ── Text Similarity Calculation ────────────────────────── */
  function calcTxtSimilarity(contentA, contentB) {
    const tokA = tokenize(contentA);
    const tokB = tokenize(contentB);

    const textSim  = Math.round(jaccard(tokA, tokB) * 100);
    const bgSim    = Math.round(bigramSim(contentA, contentB) * 100);

    // For text files, structure/ast/logic are estimated from content patterns
    const sentA = contentA.split(/[.!?]+/).filter(s => s.trim().length > 10);
    const sentB = contentB.split(/[.!?]+/).filter(s => s.trim().length > 10);
    const sentSim = Math.round(overlapRatio(
      sentA.map(s => s.trim().toLowerCase().slice(0, 30)),
      sentB.map(s => s.trim().toLowerCase().slice(0, 30))
    ) * 100);

    const logicSim   = Math.round((textSim * 0.6 + bgSim * 0.4));
    const astPattern  = Math.round((bgSim * 0.5 + sentSim * 0.5));
    const codeStructure = sentSim;

    const overall = Math.round(
      textSim       * 0.45 +
      bgSim         * 0.25 +
      logicSim      * 0.20 +
      astPattern    * 0.10
    );

    const details = [];
    if (textSim > 60)   details.push(`${textSim}% word token overlap detected`);
    if (bgSim > 60)     details.push(`High character-level similarity (${bgSim}%) found`);
    if (sentSim > 40)   details.push('Similar sentence structures identified');
    if (overall >= 80)  details.push('Content duplication strongly indicated');
    if (overall >= 70)  details.push('Significant content overlap detected');
    if (!details.length) details.push('Low content similarity between the two files');

    return {
      codeStructure: clamp(codeStructure, 0, 100),
      astPattern:    clamp(astPattern,    0, 100),
      logicSim:      clamp(logicSim,      0, 100),
      textSim:       clamp(textSim,       0, 100),
      overall:       clamp(overall,       0, 100),
      details
    };
  }

  /* ── Generate Comparison Pairs ──────────────────────────── */
  function generatePairs(fileDataArray) {
    // Separate by type
    const pyFiles  = fileDataArray.filter(f => f.type === 'py');
    const txtFiles = fileDataArray.filter(f => f.type === 'txt');
    const pairs    = [];

    const makePairs = (arr) => {
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          pairs.push([arr[i], arr[j]]);
        }
      }
    };

    makePairs(pyFiles);
    makePairs(txtFiles);
    return pairs;
  }

  /* ── Main Analyze Entry Point ───────────────────────────── */
  async function analyzeFiles(fileDataArray) {
    const pairs   = generatePairs(fileDataArray);
    const results = [];
    const now     = Date.now();

    for (const [fileA, fileB] of pairs) {
      const type  = fileA.type; // both will be same type
      const scores = type === 'py'
        ? calcPySimilarity(fileA.content, fileB.content)
        : calcTxtSimilarity(fileA.content, fileB.content);

      const reportId = generateReportId();
      results.push({
        reportId,
        file1:              fileA.name,
        file2:              fileB.name,
        fileType:           type,
        overallSimilarity:  scores.overall,
        codeStructure:      scores.codeStructure,
        astPattern:         scores.astPattern,
        logicSimilarity:    scores.logicSim,
        textSimilarity:     scores.textSim,
        classification:     classify(scores.overall),
        classificationKey:  classifyKey(scores.overall),
        detectionStatus:    classify(scores.overall),
        details:            scores.details,
        analysisDate:       formatDate(now),
        timestamp:          now
      });
    }

    return results;
  }

  return { analyzeFiles, classify, classifyKey, generateReportId };
})();

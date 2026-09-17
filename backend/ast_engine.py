"""
ast_engine.py – Real AST parsing and similarity analysis engine for CodeTrace.

Python files (.py):
  Uses Python's stdlib `ast` module to build Abstract Syntax Trees.
  Similarity is computed on STRUCTURAL features only — identifiers/names
  are deliberately ignored so that plagiarism with renamed variables is
  detected at high similarity, just like a real plagiarism detector.

Text files (.txt):
  Uses tokenisation, stop-word removal, Jaccard similarity, bigram
  character similarity, and a lightweight TF-IDF cosine computation.

Sub-scores (0-100) returned for every pair:
  codeStructure  – node-type count vector cosine similarity
  astPattern     – DFS node-type sequence LCS ratio (via difflib)
  logicSimilarity– control-flow structure + function arity similarity
  textSimilarity – token Jaccard (py) or weighted text measures (txt)
  overall        – weighted combination of the four sub-scores
"""

import ast
import difflib
import math
import re
from collections import Counter
from typing import Any


# ══════════════════════════════════════════════════════════════
#  UTILITIES
# ══════════════════════════════════════════════════════════════

def _clamp(v: float, lo: int = 0, hi: int = 100) -> int:
    return max(lo, min(hi, round(v * 100)))


def _cosine(vec_a: dict, vec_b: dict) -> float:
    """Cosine similarity between two frequency / weight dicts."""
    all_keys = set(vec_a) | set(vec_b)
    dot  = sum(vec_a.get(k, 0.0) * vec_b.get(k, 0.0) for k in all_keys)
    mag_a = math.sqrt(sum(v ** 2 for v in vec_a.values()))
    mag_b = math.sqrt(sum(v ** 2 for v in vec_b.values()))
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot / (mag_a * mag_b)


def _seq_ratio(seq_a: list, seq_b: list) -> float:
    """LCS-based similarity via difflib (handles empty sequences)."""
    if not seq_a and not seq_b:
        return 1.0
    if not seq_a or not seq_b:
        return 0.0
    return difflib.SequenceMatcher(None, seq_a, seq_b).ratio()


def _jaccard(set_a: set, set_b: set) -> float:
    if not set_a and not set_b:
        return 1.0
    union = set_a | set_b
    return len(set_a & set_b) / len(union) if union else 0.0


def _overlap_ratio(list_a: list, list_b: list) -> float:
    """Overlap ÷ max-size (order-insensitive)."""
    if not list_a and not list_b:
        return 1.0
    if not list_a or not list_b:
        return 0.0
    sa = {s.lower() for s in list_a}
    sb = {s.lower() for s in list_b}
    return len(sa & sb) / max(len(sa), len(sb))


# ══════════════════════════════════════════════════════════════
#  PYTHON AST HELPERS
# ══════════════════════════════════════════════════════════════

def _parse(code: str) -> ast.AST | None:
    """Parse Python source code; return None on SyntaxError."""
    try:
        return ast.parse(code)
    except SyntaxError:
        return None


def _node_type_seq(tree: ast.AST) -> list[str]:
    """
    DFS walk returning the *type name* of every AST node.
    Identifiers (Name, arg, alias) are EXCLUDED so that variable
    renaming does NOT reduce structural similarity.
    """
    SKIP = {ast.Name, ast.arg, ast.alias, ast.Constant,
            ast.Load, ast.Store, ast.Del, ast.Starred}
    seq = []
    for node in ast.walk(tree):
        if type(node) not in SKIP:
            seq.append(type(node).__name__)
    return seq


def _feature_vector(tree: ast.AST) -> dict[str, int]:
    """Count of each AST node type (used for cosine similarity)."""
    return dict(Counter(type(n).__name__ for n in ast.walk(tree)))


def _control_flow_seq(tree: ast.AST) -> list[str]:
    """
    Ordered sequence of control-flow node types:
    FunctionDef, AsyncFunctionDef, ClassDef, For, While, If, Try,
    With, Return, ListComp, DictComp, GeneratorExp.
    Preserves structural 'shape' of the program.
    """
    CF = (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef,
          ast.For, ast.While, ast.If, ast.Try, ast.With,
          ast.Return, ast.ListComp, ast.DictComp, ast.GeneratorExp,
          ast.ExceptHandler, ast.Assert, ast.Raise)
    return [type(n).__name__ for n in ast.walk(tree) if isinstance(n, CF)]


def _function_names(tree: ast.AST) -> list[str]:
    return [n.name for n in ast.walk(tree)
            if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))]


def _class_names(tree: ast.AST) -> list[str]:
    return [n.name for n in ast.walk(tree) if isinstance(n, ast.ClassDef)]


def _import_names(tree: ast.AST) -> list[str]:
    names = []
    for n in ast.walk(tree):
        if isinstance(n, ast.Import):
            names += [a.name.split(".")[0] for a in n.names]
        elif isinstance(n, ast.ImportFrom) and n.module:
            names.append(n.module.split(".")[0])
    return names


def _py_token_set(code: str) -> set[str]:
    """Identifier tokens from Python code, minus language keywords."""
    KW = {
        "def", "class", "import", "from", "return", "if", "elif", "else",
        "for", "while", "try", "except", "with", "as", "pass", "break",
        "continue", "True", "False", "None", "and", "or", "not", "in",
        "is", "lambda", "yield", "raise", "del", "global", "nonlocal",
        "assert", "finally", "async", "await", "print", "self", "cls",
    }
    tokens = re.findall(r"\b[a-zA-Z_]\w*\b", code)
    return {t.lower() for t in tokens if t.lower() not in KW and len(t) > 1}


# ══════════════════════════════════════════════════════════════
#  PYTHON SIMILARITY ENGINE
# ══════════════════════════════════════════════════════════════

def calculate_py_similarity(code_a: str, code_b: str) -> dict[str, Any]:
    """
    Full Python-file similarity using real AST analysis.
    Falls back to text comparison if either file has a syntax error.
    """
    tree_a = _parse(code_a)
    tree_b = _parse(code_b)

    # ── Graceful degradation on parse failure ─────────────────
    if tree_a is None or tree_b is None:
        result = calculate_txt_similarity(code_a, code_b)
        result["details"].insert(
            0,
            "⚠ One or both files could not be parsed as valid Python — "
            "text-based comparison was used instead.",
        )
        return result

    # ── 1. Code Structure (30 %) ──────────────────────────────
    #    Cosine similarity of AST node-type count vectors.
    #    Completely insensitive to identifier names.
    vec_a = _feature_vector(tree_a)
    vec_b = _feature_vector(tree_b)
    code_struct: float = _cosine(vec_a, vec_b)

    # ── 2. AST Pattern (25 %) ─────────────────────────────────
    #    LCS ratio over the DFS sequence of node types.
    #    Detects structural plagiarism even after renaming.
    seq_a = _node_type_seq(tree_a)
    seq_b = _node_type_seq(tree_b)
    ast_pat: float = _seq_ratio(seq_a, seq_b)

    # ── 3. Logic Similarity (25 %) ────────────────────────────
    #    Control-flow sequence similarity + function-name overlap.
    #    (Name overlap intentional here — same function names = stronger signal.)
    cf_a = _control_flow_seq(tree_a)
    cf_b = _control_flow_seq(tree_b)
    cf_sim  = _seq_ratio(cf_a, cf_b)
    fn_sim  = _overlap_ratio(_function_names(tree_a), _function_names(tree_b))
    logic   = cf_sim * 0.65 + fn_sim * 0.35

    # ── 4. Text Similarity (20 %) ─────────────────────────────
    #    Token-set Jaccard after removing Python keywords.
    tok_a = _py_token_set(code_a)
    tok_b = _py_token_set(code_b)
    text  = _jaccard(tok_a, tok_b)

    # ── Overall weighted score ────────────────────────────────
    overall = (
        code_struct * 0.30
        + ast_pat   * 0.25
        + logic     * 0.25
        + text      * 0.20
    )

    # ── Detection detail sentences ────────────────────────────
    details: list[str] = []

    fn_overlap = _overlap_ratio(_function_names(tree_a), _function_names(tree_b))
    if fn_overlap > 0.3:
        details.append(
            f"{round(fn_overlap * 100)}% of function definitions match"
        )

    cls_overlap = _overlap_ratio(_class_names(tree_a), _class_names(tree_b))
    if cls_overlap > 0.3:
        details.append(
            f"{round(cls_overlap * 100)}% of class definitions match"
        )

    imp_overlap = _overlap_ratio(_import_names(tree_a), _import_names(tree_b))
    if imp_overlap > 0.3:
        details.append(
            f"{round(imp_overlap * 100)}% of import statements match"
        )

    if cf_a and cf_b and cf_sim > 0.5:
        details.append(
            f"Control-flow structures are {round(cf_sim * 100)}% similar"
        )

    if ast_pat > 0.75:
        details.append(
            f"AST node-type sequence similarity: {round(ast_pat * 100)}% "
            "— strong structural match (rename-resistant)"
        )

    if code_struct > 0.85:
        details.append(
            "Near-identical AST node distribution — highly similar program shape"
        )

    if text > 0.55:
        details.append(
            f"Token-level identifier overlap: {round(text * 100)}%"
        )

    if overall >= 0.80:
        details.append(
            "Code duplication strongly indicated by multi-metric AST analysis"
        )
    elif overall >= 0.70:
        details.append(
            "Significant structural similarity detected — possible plagiarism"
        )

    if not details:
        details.append("Low structural similarity between the two Python files")

    return {
        "codeStructure":  _clamp(code_struct),
        "astPattern":     _clamp(ast_pat),
        "logicSimilarity":_clamp(logic),
        "textSimilarity": _clamp(text),
        "overall":        _clamp(overall),
        "details":        details,
    }


# ══════════════════════════════════════════════════════════════
#  TEXT SIMILARITY ENGINE  (.txt files)
# ══════════════════════════════════════════════════════════════

_STOPWORDS: frozenset[str] = frozenset({
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
    "have", "has", "had", "will", "would", "could", "should", "may",
    "might", "can", "it", "its", "this", "that", "these", "those", "he",
    "she", "they", "we", "i", "you", "what", "which", "who", "whom",
    "when", "where", "why", "how", "all", "each", "every", "both", "few",
    "more", "most", "other", "some", "such", "no", "not", "only", "same",
    "so", "than", "too", "very", "just", "because", "as", "until", "while",
    "about", "above", "after", "also", "am", "any", "do", "does", "did",
    "get", "got", "her", "him", "his", "into", "its", "let", "like",
    "make", "me", "my", "now", "our", "out", "own", "say", "see", "their",
    "them", "then", "there", "us", "up", "use", "your",
})


def _tokenize_text(text: str) -> list[str]:
    tokens = re.findall(r"\b[a-zA-Z]{2,}\b", text.lower())
    return [t for t in tokens if t not in _STOPWORDS]


def _bigram_char_sim(text_a: str, text_b: str) -> float:
    """Sørensen–Dice coefficient on character bigrams."""
    def bigrams(s: str) -> Counter:
        s = s.lower()
        return Counter(s[i : i + 2] for i in range(len(s) - 1))

    bg_a, bg_b = bigrams(text_a), bigrams(text_b)
    total_a, total_b = sum(bg_a.values()), sum(bg_b.values())
    if total_a == 0 or total_b == 0:
        return 0.0
    inter = sum(min(bg_a[k], bg_b.get(k, 0)) for k in bg_a)
    return 2 * inter / (total_a + total_b)


def _tfidf_cosine(tokens_a: list[str], tokens_b: list[str]) -> float:
    """
    Lightweight TF-IDF cosine similarity over a 2-document corpus.
    IDF = log(2 / df) where df is 1 or 2.
    """
    if not tokens_a or not tokens_b:
        return 0.0
    all_terms = set(tokens_a) | set(tokens_b)

    def tf(tokens: list, term: str) -> float:
        return tokens.count(term) / len(tokens) if tokens else 0.0

    def idf(term: str) -> float:
        df = int(term in tokens_a) + int(term in tokens_b)
        return math.log(2.0 / df) if df else 0.0

    vec_a = {t: tf(tokens_a, t) * idf(t) for t in all_terms}
    vec_b = {t: tf(tokens_b, t) * idf(t) for t in all_terms}
    return _cosine(vec_a, vec_b)


def _sentence_overlap(text_a: str, text_b: str) -> float:
    """Approximate sentence-level overlap using first 50 chars as fingerprint."""
    def sentences(t: str) -> list[str]:
        return [
            s.strip().lower()[:50]
            for s in re.split(r"[.!?]+", t)
            if len(s.strip()) > 15
        ]

    return _overlap_ratio(sentences(text_a), sentences(text_b))


def calculate_txt_similarity(text_a: str, text_b: str) -> dict[str, Any]:
    """Full text-file similarity using multi-method approach."""
    tok_a = _tokenize_text(text_a)
    tok_b = _tokenize_text(text_b)

    # Individual measures
    jaccard = _jaccard(set(tok_a), set(tok_b))
    bigram  = _bigram_char_sim(text_a, text_b)
    tfidf   = _tfidf_cosine(tok_a, tok_b)
    sent    = _sentence_overlap(text_a, text_b)

    # Map to sub-scores
    text_sim   = jaccard * 0.40 + tfidf * 0.35 + bigram * 0.25
    logic      = text_sim * 0.60 + bigram * 0.40
    ast_pattern = bigram * 0.50 + sent * 0.50
    code_struct = sent

    overall = (
        text_sim    * 0.45
        + bigram     * 0.25
        + logic      * 0.20
        + ast_pattern * 0.10
    )

    details: list[str] = []
    if jaccard > 0.45:
        details.append(f"{round(jaccard * 100)}% word-token overlap detected")
    if tfidf > 0.45:
        details.append(f"TF-IDF cosine similarity: {round(tfidf * 100)}%")
    if bigram > 0.55:
        details.append(
            f"High character-level similarity ({round(bigram * 100)}%) detected"
        )
    if sent > 0.35:
        details.append("Similar sentence structures identified")
    if overall >= 0.80:
        details.append("Content duplication strongly indicated")
    elif overall >= 0.70:
        details.append("Significant content overlap detected")
    if not details:
        details.append("Low content similarity between the two text files")

    return {
        "codeStructure":   _clamp(code_struct),
        "astPattern":      _clamp(ast_pattern),
        "logicSimilarity": _clamp(logic),
        "textSimilarity":  _clamp(text_sim),
        "overall":         _clamp(overall),
        "details":         details,
    }


# ══════════════════════════════════════════════════════════════
#  PUBLIC ENTRY POINT
# ══════════════════════════════════════════════════════════════

def analyze_pair(
    content_a: str, content_b: str, file_type: str
) -> dict[str, Any]:
    """
    Analyse a single file pair and return similarity scores.

    Args:
        content_a: decoded text content of file 1
        content_b: decoded text content of file 2
        file_type: 'py' or 'txt'

    Returns:
        dict with keys: codeStructure, astPattern, logicSimilarity,
                        textSimilarity, overall, details
    """
    if file_type == "py":
        return calculate_py_similarity(content_a, content_b)
    return calculate_txt_similarity(content_a, content_b)

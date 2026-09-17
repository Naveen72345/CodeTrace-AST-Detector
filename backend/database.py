"""
database.py – SQLite persistence layer for CodeTrace.
Uses raw sqlite3 (stdlib) – no extra ORM dependency needed.
"""

import sqlite3
import hashlib
import json
import os
from datetime import datetime

# ── DB path sits next to this file ────────────────────────────
DB_PATH = os.path.join(os.path.dirname(__file__), "codetrace.db")


# ── Connection factory ─────────────────────────────────────────
def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row          # access columns by name
    conn.execute("PRAGMA journal_mode=WAL") # safe concurrent writes
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


# ─────────────────────────────────────────────────────────────
# SCHEMA INITIALISATION
# ─────────────────────────────────────────────────────────────
def init_db() -> None:
    """Create tables if they do not exist and seed the default user."""
    conn = _connect()
    cur  = conn.cursor()

    cur.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            username      TEXT    UNIQUE NOT NULL,
            email         TEXT    NOT NULL,
            password_hash TEXT    NOT NULL,
            role          TEXT    NOT NULL DEFAULT 'Analyst',
            created_at    TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS files (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            filename    TEXT    NOT NULL,
            file_type   TEXT    NOT NULL CHECK(file_type IN ('py','txt')),
            file_size   INTEGER NOT NULL DEFAULT 0,
            upload_date TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS comparisons (
            report_id          TEXT PRIMARY KEY,
            file1_name         TEXT    NOT NULL,
            file2_name         TEXT    NOT NULL,
            file_type          TEXT    NOT NULL,
            overall_similarity INTEGER NOT NULL,
            code_struct_score  INTEGER NOT NULL,
            ast_pattern_score  INTEGER NOT NULL,
            logic_score        INTEGER NOT NULL,
            text_score         INTEGER NOT NULL,
            classification     TEXT    NOT NULL,
            classification_key TEXT    NOT NULL,
            detection_status   TEXT    NOT NULL,
            details_json       TEXT    NOT NULL DEFAULT '[]',
            analysis_date      TEXT    NOT NULL,
            timestamp_ms       INTEGER NOT NULL
        );
    """)

    # ── Seed default admin account ────────────────────────────
    exists = cur.execute(
        "SELECT 1 FROM users WHERE username = 'admin'"
    ).fetchone()
    if not exists:
        cur.execute(
            "INSERT INTO users (username, email, password_hash, role) "
            "VALUES (?, ?, ?, ?)",
            ("admin", "admin@codetrace.io", _hash("admin123"), "Analyst"),
        )

    conn.commit()
    conn.close()


# ─────────────────────────────────────────────────────────────
# PASSWORD HELPERS
# ─────────────────────────────────────────────────────────────
def _hash(plaintext: str) -> str:
    return hashlib.sha256(plaintext.encode("utf-8")).hexdigest()


def hash_password(plaintext: str) -> str:
    return _hash(plaintext)


def verify_password(plaintext: str, hashed: str) -> bool:
    return _hash(plaintext) == hashed


# ─────────────────────────────────────────────────────────────
# USER QUERIES
# ─────────────────────────────────────────────────────────────
def get_user_by_username(username: str) -> dict | None:
    conn = _connect()
    row  = conn.execute(
        "SELECT * FROM users WHERE LOWER(username) = LOWER(?)", (username,)
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def update_user_profile(old_username: str, new_username: str, email: str) -> bool:
    """Returns False if the new username is already taken by another account."""
    conn = _connect()
    try:
        # Check collision
        clash = conn.execute(
            "SELECT 1 FROM users "
            "WHERE LOWER(username)=LOWER(?) AND LOWER(username)!=LOWER(?)",
            (new_username, old_username),
        ).fetchone()
        if clash:
            return False

        conn.execute(
            "UPDATE users SET username=?, email=? "
            "WHERE LOWER(username)=LOWER(?)",
            (new_username, email, old_username),
        )
        conn.commit()
        return True
    finally:
        conn.close()


def update_user_password(username: str, new_hash: str) -> None:
    conn = _connect()
    conn.execute(
        "UPDATE users SET password_hash=? WHERE LOWER(username)=LOWER(?)",
        (new_hash, username),
    )
    conn.commit()
    conn.close()


# ─────────────────────────────────────────────────────────────
# FILE QUERIES  (lightweight tracking – content not stored in DB)
# ─────────────────────────────────────────────────────────────
def record_files(file_list: list[dict]) -> None:
    """Log uploaded filenames/types for auditing."""
    conn = _connect()
    conn.executemany(
        "INSERT INTO files (filename, file_type, file_size) VALUES (?,?,?)",
        [(f["name"], f["type"], f.get("size", 0)) for f in file_list],
    )
    conn.commit()
    conn.close()


# ─────────────────────────────────────────────────────────────
# COMPARISON QUERIES
# ─────────────────────────────────────────────────────────────
def _row_to_dict(row: sqlite3.Row) -> dict:
    r = dict(row)
    return {
        "reportId":          r["report_id"],
        "file1":             r["file1_name"],
        "file2":             r["file2_name"],
        "fileType":          r["file_type"],
        "overallSimilarity": r["overall_similarity"],
        "codeStructure":     r["code_struct_score"],
        "astPattern":        r["ast_pattern_score"],
        "logicSimilarity":   r["logic_score"],
        "textSimilarity":    r["text_score"],
        "classification":    r["classification"],
        "classificationKey": r["classification_key"],
        "detectionStatus":   r["detection_status"],
        "details":           json.loads(r["details_json"]),
        "analysisDate":      r["analysis_date"],
        "timestamp":         r["timestamp_ms"],
    }


def save_comparison(comp: dict) -> None:
    conn = _connect()
    conn.execute(
        """
        INSERT OR REPLACE INTO comparisons
        (report_id, file1_name, file2_name, file_type,
         overall_similarity, code_struct_score, ast_pattern_score,
         logic_score, text_score, classification, classification_key,
         detection_status, details_json, analysis_date, timestamp_ms)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """,
        (
            comp["reportId"],
            comp["file1"],
            comp["file2"],
            comp["fileType"],
            comp["overallSimilarity"],
            comp["codeStructure"],
            comp["astPattern"],
            comp["logicSimilarity"],
            comp["textSimilarity"],
            comp["classification"],
            comp["classificationKey"],
            comp["detectionStatus"],
            json.dumps(comp.get("details", [])),
            comp["analysisDate"],
            comp["timestamp"],
        ),
    )
    conn.commit()
    conn.close()


def get_all_comparisons() -> list[dict]:
    conn  = _connect()
    rows  = conn.execute(
        "SELECT * FROM comparisons ORDER BY timestamp_ms DESC"
    ).fetchall()
    conn.close()
    return [_row_to_dict(r) for r in rows]


def get_comparison_by_id(report_id: str) -> dict | None:
    conn = _connect()
    row  = conn.execute(
        "SELECT * FROM comparisons WHERE report_id=?", (report_id,)
    ).fetchone()
    conn.close()
    return _row_to_dict(row) if row else None


# ─────────────────────────────────────────────────────────────
# DASHBOARD STATS  (computed from comparisons table)
# ─────────────────────────────────────────────────────────────
def get_dashboard_stats() -> dict:
    comps = get_all_comparisons()

    if not comps:
        return {
            "totalFiles":     0,
            "highMatches":    0,
            "avgSimilarity":  0,
            "duplicates":     0,
            "pyCount":        0,
            "txtCount":       0,
            "highMatchPairs": [],
            "allPairs":       [],
        }

    # Collect unique file names per type
    file_set: dict[str, str] = {}   # filename → type
    for c in comps:
        file_set[c["file1"]] = c["fileType"]
        file_set[c["file2"]] = c["fileType"]

    py_count  = sum(1 for t in file_set.values() if t == "py")
    txt_count = sum(1 for t in file_set.values() if t == "txt")

    sims = [c["overallSimilarity"] for c in comps]
    avg  = round(sum(sims) / len(sims), 1) if sims else 0.0

    high_match_pairs = [c for c in comps if c["overallSimilarity"] >= 70]
    duplicates       = sum(1 for c in comps if c["overallSimilarity"] >= 80)

    return {
        "totalFiles":     py_count + txt_count,
        "highMatches":    len(high_match_pairs),
        "avgSimilarity":  avg,
        "duplicates":     duplicates,
        "pyCount":        py_count,
        "txtCount":       txt_count,
        "highMatchPairs": high_match_pairs,
        "allPairs":       comps,
    }

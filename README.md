# 🔍 CodeTrace - AST-Based Duplicate Detector

> An intelligent code and notes plagiarism detection system using Python, Flask, and Abstract Syntax Tree (AST) parsing.

---

## 📌 Project Overview
**CodeTrace** is designed to detect structural similarity and code plagiarism beyond simple string matching. By analyzing the **Abstract Syntax Tree (AST)** of source code, it identifies structural patterns, logic duplication, and variable/function renaming tactics.

---

## ✨ Key Features
* 🧬 **AST Code Analysis:** Parses python source code into syntax trees to identify structural logic duplicates.
* 📝 **Notes Duplicate Detection:** Compares textual content and logic snippets effectively.
* ⚡ **Unified Flask Framework:** Seamless integration between backend evaluation logic and responsive UI templates.
* 📊 **Clean Visual Reporting:** Direct feedback on similarity metrics for quick evaluation.

---

## 🛠️ Tech Stack
* **Language:** Python 3.x
* **Backend:** Flask
* **Logic Parsing:** `ast` module / Custom AST Parsers
* **Frontend:** HTML5, CSS3, JavaScript (Jinja2 Templates)

---

## 📁 Repository Structure
```text
CodeTrace-AST-Detector/
├── backend/          # Flask app, AST parsing algorithms, API routes
├── frontend/         # UI templates, static assets (CSS/JS)
├── requirements.txt  # Project dependencies
└── README.md         # Project documentation
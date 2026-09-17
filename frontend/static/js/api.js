/* ============================================================
   api.js  –  CodeTrace Frontend ↔ Backend Adapter
   ============================================================
   Loaded AFTER auth.js / storage.js / analyzer.js / sidebar.js.

   What this file does:
     1. Augments Auth with a real backend login path (writes the
        actual Bearer token via Auth._setToken / Auth._setUser).
     2. Patches Auth.requireAuth / getCurrentUser / logout so that
        sidebar.js and every page's auth-guard uses the backend
        token stored by auth.js (no duplication of storage keys).
     3. Exposes the global API object with async methods for every
        backend endpoint.
     4. On any 401 response: clears session + redirects once to
        login page. No reload(), no loops.

   Token storage keys (localStorage) — same as auth.js:
     ct_api_token   – Bearer token from POST /api/auth/login
     ct_api_user    – Cached user object {username, email, role}
     ct_last_result – Report-ID of the most-recently viewed result
   ============================================================ */

(() => {
  /* ── Configuration ──────────────────────────────────────── */
  const BASE = 'https://codetrace-ast-detector1.onrender.com/api';
  const R_KEY = 'ct_last_result';

  /* ── Guard: prevent redirect storms ────────────────────── */
  let _redirecting = false;

  function safeRedirect(url) {
    if (_redirecting) return;
    _redirecting = true;
    window.location.href = url;
  }

  /* ── Core fetch wrapper ─────────────────────────────────── */
  async function req(method, path, body = null, isForm = false) {
    const headers = {};
    const token   = Auth.getToken ? Auth.getToken() : localStorage.getItem('ct_api_token');
    if (token && token !== 'local-session-token') {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const opts = { method, headers };

    if (body !== null) {
      if (isForm) {
        opts.body = body;          // FormData – browser sets Content-Type
      } else {
        headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(body);
      }
    }

    let res;
    try {
      res = await fetch(`${BASE}${path}`, opts);
    } catch (networkErr) {
      throw new Error(
        'Cannot reach the CodeTrace backend. '
        + 'Make sure  python app.py  is running on port 5000.'
      );
    }

    if (res.status === 401) {
      Auth.clearSession();
      safeRedirect('index.html');
      throw new Error('Session expired — please log in again.');
    }

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json.error || `HTTP ${res.status}`);
    }

    return res;
  }

  /* ── Patch Auth module ──────────────────────────────────── */
  // auth.js already uses the same storage keys, so we only need to
  // patch the methods that need backend-aware behaviour.
  if (typeof Auth !== 'undefined') {

    // Override login to hit the real backend first, fall back to local
    const _localLogin = Auth.login.bind(Auth);
    Auth.login = async function(username, password) {
      try {
        const data = await window.API.login(username, password);
        return { ok: true, user: data.user };
      } catch (err) {
        if (err.message.includes('backend') || err.message.includes('port 5000')) {
          // Backend offline → fall back to local credentials
          return _localLogin(username, password);
        }
        return { ok: false, error: err.message };
      }
    };

    // requireAuth: already correct in auth.js, but ensure one-redirect guard
    const _originalRequireAuth = Auth.requireAuth.bind(Auth);
    Auth.requireAuth = function() {
      if (_redirecting) return false;
      return _originalRequireAuth();
    };

    // Logout: also calls the backend endpoint (fire-and-forget)
    Auth.logout = function() {
      req('POST', '/auth/logout').catch(() => {});
      Auth.clearSession();
      safeRedirect('index.html');
    };
  }

  /* ── Public API object ──────────────────────────────────── */
  window.API = {

    /* ── Auth ──────────────────────────────────────────────── */
    async login(username, password) {
      const res  = await req('POST', '/auth/login', { username, password });
      const data = await res.json();
      // Write real token via auth.js setters
      if (Auth._setToken) Auth._setToken(data.token);
      if (Auth._setUser)  Auth._setUser(data.user);
      return data;
    },

    async updateProfile(username, email) {
      const res  = await req('POST', '/auth/update-profile', { username, email });
      const data = await res.json();
      // Update cached user
      if (Auth._setUser) {
        const cached = Auth.getCurrentUser() || {};
        Auth._setUser({ ...cached, username: data.username, email: data.email });
      }
      return data;
    },

    async changePassword(currentPassword, newPassword) {
      const res = await req('POST', '/auth/change-password', {
        currentPassword, newPassword,
      });
      return res.json();
    },

    /* ── Dashboard ─────────────────────────────────────────── */
    async getDashboardStats() {
      const res = await req('GET', '/dashboard/stats');
      return res.json();
    },

    /* ── Analysis ──────────────────────────────────────────── */
    async analyze(fileObjects) {
      const form = new FormData();
      for (const f of fileObjects) {
        form.append('files', f.file, f.name);
      }
      const res     = await req('POST', '/analyze', form, true);
      const data    = await res.json();
      const results = data.results || [];
      if (results.length > 0) {
        localStorage.setItem(R_KEY, results[0].reportId);
      }
      return results;
    },

    /* ── Results ───────────────────────────────────────────── */
    async getResults() {
      const res = await req('GET', '/results');
      return res.json();
    },

    async getResultById(id) {
      const res = await req('GET', `/results/${encodeURIComponent(id)}`);
      return res.json();
    },

    /* ── History ───────────────────────────────────────────── */
    async getHistory() {
      const res = await req('GET', '/history');
      return res.json();
    },

    async clearHistory() {
      const res = await req('POST', '/clear-history');
      return res.json();
    },

    /* ── Reports ───────────────────────────────────────────── */
    async getReports() {
      const res = await req('GET', '/reports');
      return res.json();
    },

    async downloadReport(reportId) {
      const token = Auth.getToken ? Auth.getToken() : null;
      const headers = (token && token !== 'local-session-token')
        ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(
        `${BASE}/reports/export/${encodeURIComponent(reportId)}`,
        { headers }
      );
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      _triggerDownload(blob, `CodeTrace_${reportId}.xlsx`);
    },

    async downloadAll() {
      const token = Auth.getToken ? Auth.getToken() : null;
      const headers = (token && token !== 'local-session-token')
        ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`${BASE}/reports/export-all`, { headers });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const ts   = new Date().toISOString().slice(0, 16).replace(/[-T:]/g, '');
      _triggerDownload(blob, `CodeTrace_AllReports_${ts}.xlsx`);
    },

    /* ── Last result ID helpers ────────────────────────────── */
    getLastResultId()   { return localStorage.getItem(R_KEY); },
    setLastResultId(id) { localStorage.setItem(R_KEY, id); },
  };

  /* ── Private download helper ────────────────────────────── */
  function _triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

})();

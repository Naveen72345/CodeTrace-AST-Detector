/* ============================================================
   auth.js – Session Management (Single Source of Truth)

   KEY DESIGN:
   - Uses ONE storage key: ct_api_token  (Bearer token from backend)
                           ct_api_user   (cached user object)
   - auth.js is loaded first on EVERY page. api.js then optionally
     augments the API object, but auth.js is already self-sufficient
     for auth guarding and session reads.
   - NO calls to window.location.reload() anywhere — ever.
   - requireAuth() on the login page is NEVER called; only called on
     protected pages.
   ============================================================ */

const Auth = (() => {
  const T_KEY = 'ct_api_token';
  const U_KEY = 'ct_api_user';

  /* ── One-time legacy key migration ──────────────────────── */
  // Remove old ct_session key written by previous auth.js version.
  // Also remove ct_users (local user DB) — no longer needed.
  (function migrateLegacyKeys() {
    ['ct_session', 'ct_users'].forEach(k => localStorage.removeItem(k));
  })();

  /* ── Token helpers ──────────────────────────────────────── */
  function getToken()  { return localStorage.getItem(T_KEY) || null; }
  function getUser()   {
    try { return JSON.parse(localStorage.getItem(U_KEY)) || null; }
    catch { return null; }
  }

  function setToken(t) { localStorage.setItem(T_KEY, t); }
  function setUser(u)  { localStorage.setItem(U_KEY, JSON.stringify(u)); }

  function clearSession() {
    localStorage.removeItem(T_KEY);
    localStorage.removeItem(U_KEY);
    // keep ct_last_result so results page still works after re-login
  }

  /* ── Public API ─────────────────────────────────────────── */

  /**
   * Returns the cached user object if a token exists, otherwise null.
   * Safe to call on ANY page — never throws, never redirects.
   */
  function getSession() {
    if (!getToken()) return null;
    return getUser();
  }

  /**
   * Returns the cached user. Safe alias used by sidebar.js.
   */
  function getCurrentUser() {
    return getUser();
  }

  /**
   * Auth guard for PROTECTED pages only (dashboard, analyze, etc.)
   * If no token → redirect to login once, return false.
   * Never creates a loop because index.html never calls requireAuth().
   */
  function requireAuth() {
    if (!getToken()) {
      // Only redirect if we aren't already on the login page
      if (!window.location.pathname.endsWith('index.html') &&
          window.location.pathname !== '/' &&
          !window.location.pathname.endsWith('/')) {
        window.location.href = 'index.html';
      }
      return false;
    }
    return true;
  }

  /**
   * Local-only login (fallback when backend is offline).
   * Validates against the hardcoded default credentials so the app
   * is still usable without a running Flask server.
   */
  function login(username, password) {
    // Hardcoded default account — mirrors backend default
    const DEFAULT = { username: 'admin', password: 'admin123',
                      email: 'admin@codetrace.io', role: 'Analyst' };

    const ok = username.toLowerCase() === DEFAULT.username.toLowerCase()
            && password === DEFAULT.password;

    if (!ok) return { ok: false, error: 'Invalid username or password.' };

    const user = { username: DEFAULT.username, email: DEFAULT.email, role: DEFAULT.role };
    // Use a stable local token so api.js can detect it
    setToken('local-session-token');
    setUser(user);
    return { ok: true, user };
  }

  /**
   * Logout: clear storage and go to login page.
   * Called by sidebar.js and api.js. Safe to call multiple times.
   */
  function logout() {
    clearSession();
    window.location.href = 'index.html';
  }

  /* Expose setters so api.js can write the real backend token/user */
  function _setToken(t) { setToken(t); }
  function _setUser(u)  { setUser(u);  }

  return {
    getSession,
    getCurrentUser,
    requireAuth,
    login,
    logout,
    _setToken,
    _setUser,
    getToken,
    clearSession,
  };
})();

/* ============================================================
   settings.js – Profile & Password Management
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  if (!Auth.requireAuth()) return;
  Sidebar.render('settings');
  initSettings();
});

function initSettings() {
  populateProfile();
  setupProfileForm();
  setupPasswordForm();
}

/* ── Populate Profile ─────────────────────────────────────── */
function populateProfile() {
  const user = Auth.getCurrentUser();
  if (!user) return;

  const usernameEl = document.getElementById('profile-username');
  const emailEl    = document.getElementById('profile-email');
  const avatarEl   = document.getElementById('profile-avatar');

  if (usernameEl) usernameEl.value = user.username || '';
  if (emailEl)    emailEl.value    = user.email || '';
  if (avatarEl)   avatarEl.textContent = (user.username || 'U').charAt(0).toUpperCase();
}

/* ── Profile Form ─────────────────────────────────────────── */
function setupProfileForm() {
  const form = document.getElementById('profile-form');
  if (!form) return;

  form.addEventListener('submit', e => {
    e.preventDefault();
    clearMessages('profile');

    const username = document.getElementById('profile-username').value.trim();
    const email    = document.getElementById('profile-email').value.trim();

    if (!username) { showMsg('profile', 'error', 'Username is required.'); return; }
    if (!email || !email.includes('@')) { showMsg('profile', 'error', 'Enter a valid email address.'); return; }

    const result = Auth.updateProfile(username, email);
    if (result.ok) {
      showMsg('profile', 'success', 'Profile updated successfully.');
      // Update avatar & sidebar
      const avatarEl = document.getElementById('profile-avatar');
      if (avatarEl) avatarEl.textContent = username.charAt(0).toUpperCase();
      Sidebar.render('settings');
    } else {
      showMsg('profile', 'error', result.error);
    }
  });
}

/* ── Password Form ────────────────────────────────────────── */
function setupPasswordForm() {
  const form = document.getElementById('password-form');
  if (!form) return;

  form.addEventListener('submit', e => {
    e.preventDefault();
    clearMessages('password');

    const currentPw  = document.getElementById('current-password').value;
    const newPw      = document.getElementById('new-password').value;
    const confirmPw  = document.getElementById('confirm-password').value;

    if (!currentPw) { showMsg('password', 'error', 'Current password is required.'); return; }
    if (!newPw)     { showMsg('password', 'error', 'New password is required.'); return; }
    if (newPw.length < 6) { showMsg('password', 'error', 'New password must be at least 6 characters.'); return; }
    if (newPw !== confirmPw) { showMsg('password', 'error', 'New passwords do not match.'); return; }
    if (newPw === currentPw) { showMsg('password', 'error', 'New password must differ from current password.'); return; }

    const result = Auth.changePassword(currentPw, newPw);
    if (result.ok) {
      showMsg('password', 'success', 'Password changed successfully.');
      form.reset();
    } else {
      showMsg('password', 'error', result.error);
    }
  });
}

/* ── Message Helpers ──────────────────────────────────────── */
function showMsg(section, type, text) {
  const el = document.getElementById(`${section}-msg`);
  if (!el) return;
  const icon = type === 'success'
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="width:15px;height:15px;flex-shrink:0"><polyline points="20 6 9 17 4 12"/></svg>`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="width:15px;height:15px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
  el.className = `alert alert-${type === 'success' ? 'success' : 'danger'}`;
  el.innerHTML = `${icon} ${text}`;
  el.style.display = 'flex';

  // Auto-hide success messages
  if (type === 'success') setTimeout(() => clearMessages(section), 4000);
}

function clearMessages(section) {
  const el = document.getElementById(`${section}-msg`);
  if (el) { el.innerHTML = ''; el.style.display = 'none'; }
}

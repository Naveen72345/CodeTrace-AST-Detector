/* ============================================================
   sidebar.js – Shared Sidebar Injection + Navigation
   ============================================================ */

const Sidebar = (() => {

  const PAGES = [
    { id: 'dashboard', label: 'Dashboard',  href: 'dashboard.html', icon: 'grid' },
    { id: 'analyze',   label: 'Analyze',    href: 'analyze.html',   icon: 'search' },
    { id: 'results',   label: 'Results',    href: 'results.html',   icon: 'bar-chart' },
    { id: 'history',   label: 'History',    href: 'history.html',   icon: 'clock' },
    { id: 'reports',   label: 'Reports',    href: 'reports.html',   icon: 'file-text' },
    { id: 'settings',  label: 'Settings',   href: 'settings.html',  icon: 'settings' },
  ];

  const ICONS = {
    grid: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
             <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
             <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
           </svg>`,
    search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
               <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
             </svg>`,
    'bar-chart': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
                    <line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
                  </svg>`,
    clock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>`,
    'file-text': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                    <polyline points="10 9 9 9 8 9"/>
                  </svg>`,
    settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                 <circle cx="12" cy="12" r="3"/>
                 <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
               </svg>`,
    logout: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
               <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
               <polyline points="16 17 21 12 16 7"/>
               <line x1="21" y1="12" x2="9" y2="12"/>
             </svg>`,
    code: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
             <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
           </svg>`
  };

  function render(activePage) {
    const user = Auth.getCurrentUser();
    const name = user ? user.username : 'User';
    const initials = name.charAt(0).toUpperCase();

    const navItems = PAGES.map(p => `
      <li>
        <a class="nav-item ${activePage === p.id ? 'active' : ''}" href="${p.href}" id="nav-${p.id}">
          ${ICONS[p.icon]}
          <span>${p.label}</span>
        </a>
      </li>
    `).join('');

    const html = `
      <aside class="sidebar" id="app-sidebar">
        <div class="sidebar-brand">
          <div class="brand-icon">${ICONS.code}</div>
          <div>
            <div class="brand-name">CodeTrace</div>
            <div class="brand-sub">Duplicate Detector</div>
          </div>
        </div>

        <nav class="sidebar-nav">
          <div class="nav-label">Navigation</div>
          <ul style="display:flex;flex-direction:column;gap:2px;">
            ${navItems}
            <li>
              <div class="nav-item logout-item" id="sidebar-logout" style="margin-top:12px;">
                ${ICONS.logout}
                <span>Logout</span>
              </div>
            </li>
          </ul>
        </nav>

        <div class="sidebar-footer">
          <div class="sidebar-user">
            <div class="user-avatar">${initials}</div>
            <div class="user-info">
              <div class="user-name">${name}</div>
              <div class="user-role">${user ? user.role || 'Analyst' : ''}</div>
            </div>
          </div>
        </div>
      </aside>
    `;

    const target = document.getElementById('sidebar-container');
    if (target) target.innerHTML = html;

    // Logout handler
    const logoutBtn = document.getElementById('sidebar-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        showLogoutModal();
      });
    }
  }

  function showLogoutModal() {
    const existing = document.getElementById('logout-modal-backdrop');
    if (existing) existing.remove();

    const backdrop = document.createElement('div');
    backdrop.id = 'logout-modal-backdrop';
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal">
        <div class="modal-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </div>
        <h3>Logout</h3>
        <p>Are you sure you want to logout from CodeTrace?</p>
        <div class="modal-actions">
          <button class="btn btn-outline" id="logout-cancel">Cancel</button>
          <button class="btn btn-danger" id="logout-confirm">Yes, Logout</button>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);
    requestAnimationFrame(() => backdrop.classList.add('show'));

    document.getElementById('logout-cancel').addEventListener('click', () => {
      backdrop.classList.remove('show');
      setTimeout(() => backdrop.remove(), 250);
    });
    document.getElementById('logout-confirm').addEventListener('click', () => {
      Auth.logout();
    });
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        backdrop.classList.remove('show');
        setTimeout(() => backdrop.remove(), 250);
      }
    });
  }

  return { render };
})();

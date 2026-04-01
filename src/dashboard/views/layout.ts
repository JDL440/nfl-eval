/**
 * layout.ts — Base HTML layout for the editorial workstation.
 */

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  // SQLite datetime('now') produces 'YYYY-MM-DD HH:MM:SS' in UTC without Z suffix.
  // Normalize to ISO 8601 so JS Date parses it as UTC.
  const normalized = iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z';
  const d = new Date(normalized);
  if (isNaN(d.getTime())) return iso;
  const now = Date.now();
  const diff = now - d.getTime();

  if (diff < 0) return 'just now';
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;

  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function renderLayout(title: string, content: string, labName: string): string {
  const pageKey = title === 'Dashboard'
    ? 'dashboard'
    : title === 'New Idea'
      ? 'new-idea'
      : title === 'Settings'
        ? 'settings'
        : title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'dashboard';
  const activeNav = title === 'New Idea'
    ? 'new-idea'
    : title === 'Settings'
      ? 'settings'
      : 'dashboard';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>${escapeHtml(title)} — ${escapeHtml(labName)} Dashboard</title>
  <link rel="stylesheet" href="/static/styles.css">
  <script src="/static/htmx.min.js"></script>
  <script src="/static/sse.js"></script>
</head>
<body class="app-shell page-${escapeHtml(pageKey)}" hx-ext="sse" sse-connect="/events">
  <header class="site-header shared-mobile-header">
    <div class="header-inner">
      <div class="header-brand">
        <a href="/" class="logo">${escapeHtml(labName)}</a>
        <span class="header-tagline">Editorial desk</span>
      </div>
      <nav id="primary-nav" class="header-nav shared-mobile-nav" aria-label="Primary">
        <a href="/" class="btn btn-header header-nav-link${activeNav === 'dashboard' ? ' is-active' : ''}">Dashboard</a>
        <a href="/ideas/new" class="btn btn-header header-nav-link${activeNav === 'new-idea' ? ' is-active' : ''}">New Idea</a>
        <a href="/config" class="btn btn-header header-nav-link${activeNav === 'settings' ? ' is-active' : ''}">Settings</a>
      </nav>
      <div id="nav-backdrop" class="nav-backdrop" aria-hidden="true"></div>
      <div class="header-meta">
        <!-- TODO: receive NODE_ENV via template param instead of direct process.env read -->
        <span class="env-badge header-env-badge">${escapeHtml(process.env.NODE_ENV || 'development')}</span>
        <button id="theme-toggle" class="btn btn-header btn-icon" title="Toggle theme" onclick="toggleTheme()">🌓</button>
        <button
          id="nav-toggle"
          class="btn btn-header btn-icon nav-toggle"
          type="button"
          aria-label="Toggle navigation"
          aria-expanded="false"
          aria-controls="primary-nav"
        ><span class="nav-toggle-icon" aria-hidden="true">☰</span><span class="nav-toggle-label">Menu</span></button>
      </div>
    </div>
  </header>
  <main class="content">
    <div class="content-shell">
      ${content}
    </div>
  </main>
  <footer class="site-footer">
    <p>${escapeHtml(labName)} editorial desk</p>
    <p class="site-footer-meta">The queue, the draft, and the publish moment.</p>
  </footer>
  <script>
    function toggleTheme() {
      var html = document.documentElement;
      var current = html.getAttribute('data-theme');
      var next = current === 'dark' ? 'light' : (current === 'light' ? 'dark' : 'dark');
      html.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
      document.getElementById('theme-toggle').textContent = next === 'dark' ? '☀️' : '🌓';
    }
    (function() {
      var saved = localStorage.getItem('theme');
      if (saved) {
        document.documentElement.setAttribute('data-theme', saved);
        var btn = document.getElementById('theme-toggle');
        if (btn) btn.textContent = saved === 'dark' ? '☀️' : '🌓';
      }
    })();
    (function() {
      var navToggle = document.getElementById('nav-toggle');
      var nav = document.getElementById('primary-nav');
      var backdrop = document.getElementById('nav-backdrop');
      if (!navToggle || !nav) return;
      function setNavHidden(hidden) {
        if (hidden) {
          nav.setAttribute('aria-hidden', 'true');
          nav.setAttribute('inert', '');
          if (backdrop) backdrop.setAttribute('aria-hidden', 'true');
        } else {
          nav.removeAttribute('aria-hidden');
          nav.removeAttribute('inert');
          if (backdrop) backdrop.removeAttribute('aria-hidden');
        }
      }
      setNavHidden(true);
      function closeNav() {
        nav.classList.remove('is-open');
        document.body.classList.remove('nav-open');
        navToggle.setAttribute('aria-expanded', 'false');
        setNavHidden(true);
      }
      navToggle.addEventListener('click', function() {
        var nextOpen = !nav.classList.contains('is-open');
        nav.classList.toggle('is-open', nextOpen);
        document.body.classList.toggle('nav-open', nextOpen);
        navToggle.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
        setNavHidden(!nextOpen);
      });
      if (backdrop) backdrop.addEventListener('click', closeNav);
      nav.querySelectorAll('a').forEach(function(link) {
        link.addEventListener('click', function() {
          if (window.innerWidth < 768) closeNav();
        });
      });
      document.addEventListener('click', function(event) {
        var target = event.target;
        if (!(target instanceof Element)) return;
        if (!nav.classList.contains('is-open')) return;
        if (nav.contains(target) || navToggle.contains(target)) return;
        closeNav();
      });
      document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') closeNav();
      });
      window.addEventListener('resize', function() {
        if (window.innerWidth >= 768) closeNav();
      });
    })();
  </script>
</body>
</html>`;
}

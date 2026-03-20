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
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const now = Date.now();
  const diff = now - d.getTime();

  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;

  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function renderLayout(title: string, content: string, labName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} — ${escapeHtml(labName)} Dashboard</title>
  <link rel="stylesheet" href="/static/styles.css">
  <script src="https://unpkg.com/htmx.org@2.0.4"></script>
  <script src="https://unpkg.com/htmx-ext-sse@2.2.2/sse.js"></script>
</head>
<body hx-ext="sse" sse-connect="/events">
  <header class="site-header">
    <div class="header-inner">
      <a href="/" class="logo">${escapeHtml(labName)}</a>
      <nav class="header-nav">
        <a href="/ideas/new" class="btn btn-header">+ New Idea</a>
        <button id="theme-toggle" class="btn btn-header btn-icon" title="Toggle theme" onclick="toggleTheme()">🌓</button>
        <span class="env-badge">${escapeHtml(process.env.NODE_ENV || 'development')}</span>
      </nav>
    </div>
  </header>
  <main class="content">
    ${content}
  </main>
  <footer class="site-footer">
    <p>${escapeHtml(labName)} Editorial Workstation</p>
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
  </script>
</body>
</html>`;
}

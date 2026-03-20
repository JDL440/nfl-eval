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
</head>
<body>
  <header class="site-header">
    <div class="header-inner">
      <a href="/" class="logo">${escapeHtml(labName)}</a>
      <nav class="header-nav">
        <a href="/ideas/new" class="btn btn-header">+ New Idea</a>
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
</body>
</html>`;
}

import { escapeHtml } from './layout.js';

export function renderLoginPage(data: {
  labName: string;
  returnTo?: string;
  username?: string;
  error?: string;
}): string {
  const { labName, returnTo, username, error } = data;
  const hiddenReturnTo = returnTo
    ? `<input type="hidden" name="returnTo" value="${escapeHtml(returnTo)}">`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login — ${escapeHtml(labName)} Dashboard</title>
  <link rel="stylesheet" href="/static/styles.css">
</head>
<body>
  <main class="content">
    <section class="detail-section" style="max-width: 28rem; margin: 4rem auto;">
      <h1>🔐 Dashboard Login</h1>
      <p class="subtitle">Sign in to access the editorial dashboard.</p>
      ${error ? `<div class="advance-result error" style="margin-bottom: 1rem;">${escapeHtml(error)}</div>` : ''}
      <form method="post" action="/login" class="publisher-form" style="display: grid; gap: 1rem;">
        ${hiddenReturnTo}
        <label>
          <span>Username</span>
          <input type="text" name="username" value="${escapeHtml(username ?? '')}" autocomplete="username" required>
        </label>
        <label>
          <span>Password</span>
          <input type="password" name="password" autocomplete="current-password" required>
        </label>
        <button type="submit" class="btn btn-primary">Log in</button>
      </form>
    </section>
  </main>
</body>
</html>`;
}

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
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>Login — ${escapeHtml(labName)} Dashboard</title>
  <link rel="stylesheet" href="/static/styles.css">
</head>
<body class="login-shell">
  <main class="content login-content">
    <section class="detail-section login-card">
      <div class="login-header">
        <span class="login-icon">🔐</span>
        <h1>Dashboard Login</h1>
      </div>
      <p class="login-subtitle">Sign in to access the editorial dashboard.</p>
      ${error ? `<div class="login-error">${escapeHtml(error)}</div>` : ''}
      <form method="post" action="/login" class="login-form">
        ${hiddenReturnTo}
        <div class="login-field">
          <label for="login-username">Username</label>
          <input id="login-username" type="text" name="username" value="${escapeHtml(username ?? '')}" autocomplete="username" placeholder="Enter your username" required>
        </div>
        <div class="login-field">
          <label for="login-password">Password</label>
          <input id="login-password" type="password" name="password" autocomplete="current-password" placeholder="Enter your password" required>
        </div>
        <button type="submit" class="btn btn-primary login-btn">Log in</button>
      </form>
    </section>
  </main>
</body>
</html>`;
}

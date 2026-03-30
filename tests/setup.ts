/**
 * Vitest global setup — runs before every test file.
 *
 * Prevents the local (gitignored) .env from leaking DASHBOARD_AUTH_MODE=local
 * into the test process via loadDotEnv(process.cwd()). The loadDotEnv helper
 * only sets keys that are NOT already present, so pre-setting the key here
 * is enough to block the .env value without affecting tests that explicitly
 * override it.
 */
process.env.DASHBOARD_AUTH_MODE = process.env.DASHBOARD_AUTH_MODE ?? 'off';

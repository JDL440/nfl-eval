import type { Repository } from '../db/repository.js';

/**
 * Ensure a bootstrap admin user exists in the DB.
 * Called during server startup, after DB init but before routes serve.
 *
 * If `username` is provided (from env DASHBOARD_AUTH_USERNAME), uses that.
 * Otherwise defaults to 'admin'.
 *
 * This is idempotent — calling it multiple times with the same username is safe.
 */
export function ensureBootstrapAdmin(
  repo: Repository,
  username?: string | null,
): { id: string; username: string; created: boolean } {
  const effectiveUsername = username?.trim() || 'admin';

  // Check if user already exists
  const existing = repo.getUserByUsername(effectiveUsername);
  if (existing) {
    return { id: existing.id, username: existing.username, created: false };
  }

  // Create the bootstrap admin
  const user = repo.ensureBootstrapAdmin(effectiveUsername);
  return { id: user.id, username: user.username, created: true };
}

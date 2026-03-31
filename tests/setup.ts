/**
 * Vitest global setup — runs before every test file.
 *
 * 1. Forces NFL_DATA_DIR to a temp directory so tests never touch prod/dev data.
 * 2. Sets NODE_ENV=test so config resolvers behave correctly.
 * 3. Prevents the local (gitignored) .env from leaking DASHBOARD_AUTH_MODE=local
 *    into the test process via loadDotEnv(process.cwd()). The loadDotEnv helper
 *    only sets keys that are NOT already present, so pre-setting the key here
 *    is enough to block the .env value without affecting tests that explicitly
 *    override it.
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const TEST_DATA_DIR = mkdtempSync(join(tmpdir(), 'nfl-lab-test-global-'));
process.env.NFL_DATA_DIR = TEST_DATA_DIR;
process.env.NODE_ENV = 'test';
process.env.DASHBOARD_AUTH_MODE = process.env.DASHBOARD_AUTH_MODE ?? 'off';

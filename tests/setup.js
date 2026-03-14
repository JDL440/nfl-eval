// Global test setup for nfl-eval
// Ensure consistent test environment

// Suppress console noise during tests (override per-test if needed)
if (process.env.SUPPRESS_CONSOLE !== 'false') {
  jest.spyOn(console, 'debug').mockImplementation(() => {});
}

// Set default test timeout
jest.setTimeout(30000);

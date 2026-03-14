export default {
  // Test environment
  testEnvironment: 'node',

  // Test match patterns
  testMatch: [
    '**/tests/**/*.test.js',
    '!**/node_modules/**'
  ],

  // Module paths
  moduleNameMapper: {
    '^@mocks/(.*)$': '<rootDir>/tests/mocks/$1',
    '^@fixtures/(.*)$': '<rootDir>/tests/fixtures/$1',
    '^@helpers/(.*)$': '<rootDir>/tests/helpers/$1'
  },

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.js',
    'scripts/**/*.js',
    '!src/**/*.test.js',
    '!src/**/index.js'
  ],

  // Coverage thresholds (fixed typo: coverageThreshold not coverageThresholds)
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  // Timeout
  testTimeout: 30000,

  // Verbose output
  verbose: true,

  // Transform files
  transform: {
    '^.+\\.js$': ['babel-jest', { configFile: './babel.config.js' }]
  },

  // Module file extensions
  moduleFileExtensions: ['js', 'json'],

  // Bail on first test failure
  bail: false,

  // Max workers for CI
  maxWorkers: '50%'
};

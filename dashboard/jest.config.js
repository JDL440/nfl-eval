export default {
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '\\.(css|less)$': 'identity-obj-proxy',
  },
  transform: {
    '^.+\.(js|jsx)$': 'babel-jest',
  },
  testMatch: ['**/__tests__/**/*.test.{js,jsx}'],
  extensionsToTreatAsEsm: ['.jsx'],
};

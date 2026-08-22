module.exports = {
  testEnvironment: 'node',
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  collectCoverageFrom: ['background/**/*.js', 'src/core/**/*.js', '!**/*.test.js', '!**/node_modules/**'],
  testMatch: ['**/__tests__/**/*.js', '**/*.test.js'],
  transformIgnorePatterns: ['node_modules'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};

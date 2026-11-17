const { getMaxWorkers } = require('./test/setup/testEnvironment');

/**
 * Unit test configuration.
 *
 * Each Jest worker gets its own PostgreSQL/Redis resources (see
 * test/setup/global-setup.js and test/setup/testEnvironment.js), so tests can
 * run in parallel while staying isolated.
 */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  setupFiles: ['<rootDir>/../test/setup/jest-env.ts'],
  globalSetup: '<rootDir>/../test/setup/global-setup.js',
  testRegex: '.spec.ts$',
  transform: {
    '^.+\.(ts|tsx)$': 'ts-jest',
    '\.md$': '<rootDir>/../test/markdown-transformer.js',
  },
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  moduleDirectories: ['node_modules', 'src'],
  maxWorkers: getMaxWorkers(),
  // Test-file startup (Nest compile + TypeORM schema sync) competes with other
  // workers. The previous 30s limit produced spurious timeouts on busy machines.
  testTimeout: 60000,
};

const { getMaxWorkers } = require('./setup/testEnvironment');

/**
 * Integration test configuration.
 *
 * Every worker owns a set of databases (`test_<id>`, `chatbot_test_<id>`,
 * `lti_test_<id>`) and a Redis logical database. Jest still runs the tests
 * within a given file sequentially, which is what keeps suites deterministic.
 */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  setupFiles: ['<rootDir>/setup/jest-env.ts'],
  globalSetup: '<rootDir>/setup/global-setup.js',
  testEnvironment: 'node',
  testRegex: '.integration.ts$',
  transform: {
    // Transpile-only: `yarn tsc` is the authoritative type check, so duplicating
    // it for every test file only slows tests down. See docs/PLAN.md.
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      { tsconfig: '<rootDir>/../tsconfig.jest.json' },
    ],
    '\\.md$': '<rootDir>/markdown-transformer.js',
  },
  moduleDirectories: ['node_modules', 'src'],
  maxWorkers: getMaxWorkers(),
  // Test-file startup (Nest compile + TypeORM schema sync) competes with other
  // workers. The previous 30s limit produced spurious timeouts on busy machines.
  testTimeout: 60000,
};

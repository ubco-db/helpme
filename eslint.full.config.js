const { defineConfig } = require('eslint/config')
const fastConfig = require('./eslint.fast.config.js')

const projects = {
  frontend: './packages/frontend/tsconfig.json',
  server: './packages/server/tsconfig.json',
  common: './packages/common/tsconfig.json',
}

const typeAwareRules = {
  '@typescript-eslint/no-floating-promises': 'warn',
  '@typescript-eslint/no-misused-promises': 'warn',
  '@typescript-eslint/await-thenable': 'warn',
  // Surfaces `@deprecated` JSDoc from dependencies (for example Zod 4's
  // `.passthrough()`). `tsc` and non-type-aware ESLint do not report these.
  '@typescript-eslint/no-deprecated': 'warn',
}

module.exports = defineConfig([
  ...fastConfig,
  ...Object.entries(projects).map(([workspace, project]) => ({
    name: `helpme/${workspace}-type-aware`,
    basePath: __dirname,
    files: [`packages/${workspace}/**/*.{ts,tsx}`],
    languageOptions: {
      parserOptions: {
        // Scope each file to its own project instead of loading unrelated workspaces.
        project: [project],
        tsconfigRootDir: __dirname,
      },
    },
    rules: typeAwareRules,
  })),
])

const { defineConfig } = require('eslint/config')
const fastConfig = require('./eslint.fast.config.js')

const projects = {
  frontend: './packages/frontend/tsconfig.json',
  server: './packages/server/tsconfig.json',
  common: './packages/common/tsconfig.json',
}

const promiseRules = {
  '@typescript-eslint/no-floating-promises': 'warn',
  '@typescript-eslint/no-misused-promises': 'warn',
  '@typescript-eslint/await-thenable': 'warn',
}

module.exports = defineConfig([
  ...fastConfig,
  ...Object.entries(projects).map(([workspace, project]) => ({
    name: `helpme/${workspace}-promise-safety`,
    basePath: __dirname,
    files: [`packages/${workspace}/**/*.{ts,tsx}`],
    languageOptions: {
      parserOptions: {
        // Scope each file to its own project instead of loading unrelated workspaces.
        project: [project],
        tsconfigRootDir: __dirname,
      },
    },
    rules: promiseRules,
  })),
])

const { defineConfig, globalIgnores } = require('eslint/config')
const tsPlugin = require('@typescript-eslint/eslint-plugin')
const noOnlyTests = require('eslint-plugin-no-only-tests')
const react = require('eslint-plugin-react')
const reactHooks = require('eslint-plugin-react-hooks')
const next = require('@next/eslint-plugin-next')
const prettier = require('eslint-config-prettier')
const globals = require('globals')

module.exports = defineConfig([
  globalIgnores([
    '**/node_modules/**',
    '**/.next/**',
    '**/dist/**',
    '**/build/**',
    '**/out/**',
    '**/coverage/**',
    '**/next-env.d.ts',
    '**/.eslintrc.js',
    'langchain-services/**',
  ]),
  {
    name: 'helpme/typescript',
    files: ['packages/**/*.{ts,tsx}'],
    extends: [tsPlugin.configs['flat/recommended'], prettier],
    languageOptions: {
      parserOptions: {
        // Fast commit fixes and optional editor fallback avoid TypeScript program loading.
        project: false,
        projectService: false,
        // Preserve runtime imports used by Nest DI, DTOs, and TypeORM metadata.
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
      },
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
    plugins: {
      'no-only-tests': noOnlyTests,
    },
    rules: {
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          varsIgnorePattern: '^_',
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      'no-duplicate-imports': ['warn', { allowSeparateTypeImports: true }],
      'no-only-tests/no-only-tests': 'error',
    },
  },
  {
    name: 'helpme/frontend',
    files: ['packages/frontend/**/*.{ts,tsx}'],
    extends: [next.configs['core-web-vitals']],
    languageOptions: {
      parserOptions: {
        jsxPragma: null,
      },
      globals: globals.browser,
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    settings: {
      next: { rootDir: `${__dirname}/packages/frontend/` },
    },
    rules: {
      // Use the classic correctness checks, not the React Compiler migration preset.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react/jsx-key': 'warn',
      'react/jsx-no-duplicate-props': 'error',
      'react/jsx-no-target-blank': 'warn',
      '@next/next/no-html-link-for-pages': 'off',
    },
  },
  {
    name: 'helpme/entities',
    files: ['packages/server/**/*.entity.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
]).map((config) => ({
  ...config,
  // The frontend config re-exports this file; keep its globs rooted here too.
  basePath: __dirname,
}))

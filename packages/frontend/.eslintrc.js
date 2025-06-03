module.exports = {
  root: true,
  extends: [
    "plugin:@typescript-eslint/eslint-recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier",
    "next/core-web-vitals"
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    // Only parse the frontend tsconfig for better performance
    project: ["./tsconfig.json"],
    tsconfigRootDir: __dirname,
    sourceType: "module",
  },
  plugins: ["@typescript-eslint/eslint-plugin", "no-only-tests"],
  ignorePatterns: [
    ".eslintrc.js",
    "node_modules/**",
    ".next/**",
    "dist/**",
    "build/**",
    "coverage/**",
  ],
  env: {
    node: true,
    jest: true,
    browser: true,
    es6: true,
  },
  rules: {
    "@typescript-eslint/interface-name-prefix": "off",
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/no-explicit-any": "off",
    "no-only-tests/no-only-tests": "error",
    "@typescript-eslint/no-unused-vars": [1, { varsIgnorePattern: "^_" }],
    "@next/next/no-html-link-for-pages": "off",
  },
  overrides: [
    {
      files: ["*.entity.ts"],
      rules: {
        "@typescript-eslint/no-unused-vars": "off",
      },
    },
  ],
};
const {
    defineConfig,
    globalIgnores,
} = require("eslint/config");

const tsParser = require("@typescript-eslint/parser");
const typescriptEslintEslintPlugin = require("@typescript-eslint/eslint-plugin");
const noOnlyTests = require("eslint-plugin-no-only-tests");
const globals = require("globals");
const js = require("@eslint/js");

const {
    FlatCompat,
} = require("@eslint/eslintrc");

const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

module.exports = defineConfig([
    {
        extends: compat.extends(
            "plugin:@typescript-eslint/eslint-recommended",
            "plugin:@typescript-eslint/recommended",
            "prettier",
            "next/core-web-vitals",
        ),

        languageOptions: {
            parser: tsParser,
            sourceType: "module",

            parserOptions: {
                project: ["./tsconfig.json"],
                tsconfigRootDir: __dirname,
            },

            globals: {
                ...globals.node,
                ...globals.jest,
                ...globals.browser,
            },
        },

        plugins: {
            "@typescript-eslint": typescriptEslintEslintPlugin,
            "no-only-tests": noOnlyTests,
        },

        rules: {
            "@typescript-eslint/interface-name-prefix": "off",
            "@typescript-eslint/no-unused-expressions": "off",
            "@typescript-eslint/explicit-function-return-type": "off",
            "@typescript-eslint/no-explicit-any": "off",
            "no-only-tests/no-only-tests": "error",

            "@typescript-eslint/no-unused-vars": [1, {
                varsIgnorePattern: "^_",
            }],

            "@next/next/no-html-link-for-pages": "off",
        },
    },
    globalIgnores([
        "**/.eslintrc.js",
        "node_modules/**/*",
        ".next/**/*",
        "dist/**/*",
        "build/**/*",
        "coverage/**/*",
    ]),
]);
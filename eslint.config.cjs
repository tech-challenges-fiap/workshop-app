const tsParser = require("@typescript-eslint/parser");
const tsPlugin = require("@typescript-eslint/eslint-plugin");

const scopedWorkOrderNamingFiles = [
  "src/presentation/work-orders.ts",
  "src/presentation/work-orders/**/*.ts",
  "src/application/work-order/create-work-order-with-full-payload.ts",
  "src/application/work-order/create-work-order-with-full-payload/**/*.ts",
  "src/application/work-order/complete-diagnosis.ts",
  "src/application/work-order/complete-diagnosis/**/*.ts",
];

/** @type {import("eslint").Linter.FlatConfig[]} */
module.exports = [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "bun.lock",
      "package-lock.json",
      "docs/fase-4/*.ts",
      "features/**",
    ],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: "./tsconfig.json",
        sourceType: "module",
        ecmaVersion: 2022,
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: "error",
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      security: require("eslint-plugin-security"),
      sonarjs: require("eslint-plugin-sonarjs"),
      "no-secrets": require("eslint-plugin-no-secrets"),
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...tsPlugin.configs["recommended-requiring-type-checking"].rules,
      // Regras TypeScript
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/no-misused-promises": [
        "error",
        {
          checksVoidReturn: {
            attributes: false,
          },
        },
      ],
      // Plugins de segurança
      "security/detect-object-injection": "off",
      "no-secrets/no-secrets": "error",
      "sonarjs/no-duplicate-string": "warn",
      "sonarjs/no-identical-functions": "warn",
    },
  },
  {
    files: scopedWorkOrderNamingFiles,
    rules: {
      "@typescript-eslint/naming-convention": [
        "error",
        {
          selector: "default",
          format: ["camelCase"],
          leadingUnderscore: "allow",
          trailingUnderscore: "allow",
        },
        {
          selector: "import",
          format: ["camelCase", "PascalCase"],
        },
        {
          selector: "variable",
          format: ["camelCase", "UPPER_CASE"],
          leadingUnderscore: "allow",
          trailingUnderscore: "allow",
        },
        {
          selector: "function",
          format: ["camelCase"],
        },
        {
          selector: "typeLike",
          format: ["PascalCase"],
        },
      ],
    },
  },
  {
    files: ["**/*.test.ts"],
    rules: {
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/only-throw-error": "off",
      "sonarjs/no-duplicate-string": "off",
    },
  },
  {
    files: ["src/domain/person/value-object/person-role.ts"],
    rules: {
      "@typescript-eslint/no-unsafe-enum-comparison": "off",
    },
  },
];

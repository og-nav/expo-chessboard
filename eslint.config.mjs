import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**", "coverage/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooks,
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        __DEV__: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        require: "readonly",
      },
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      // React 17+ JSX transform — no need to import React just for JSX
      "react/react-in-jsx-scope": "off",
      // We use TypeScript for prop validation
      "react/prop-types": "off",
      // Hooks rules — these catch real bugs
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      // TS handles unused checking better than the base rule
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Allow `any` only with explicit comment — chess.ts types are
      // sometimes loose and we cast at boundaries
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  {
    // RN's Metro bundler resolves static assets via require("./foo.png").
    // ES imports don't work for binary assets, so this rule has to be off
    // anywhere we register asset modules.
    files: ["src/constants.ts"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  }
);

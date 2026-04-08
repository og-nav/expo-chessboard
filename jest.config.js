/**
 * Two jest projects:
 *
 * - "node": pure-JS tests (square-utils, reconciliation). Uses ts-jest
 *   directly with no react-native shim — these test files only import
 *   types from react-native (TypeScript erases them) and don't touch
 *   any RN runtime, so the jest-expo preset would be wasted overhead
 *   and trips on pnpm's nested node_modules layout.
 *
 * - "expo": component tests (chessboard.test.tsx). Uses jest-expo so
 *   Reanimated mocks, RN components, and asset modules resolve. The
 *   pnpm node_modules layout is handled via the transformIgnorePatterns
 *   override that allows transformation of files anywhere under .pnpm.
 */
/** @type {import('jest').Config} */
module.exports = {
  projects: [
    {
      displayName: "node",
      preset: "ts-jest",
      testEnvironment: "node",
      testMatch: [
        "<rootDir>/__tests__/square-utils.test.ts",
        "<rootDir>/__tests__/reconciliation.test.ts",
      ],
    },
    {
      displayName: "expo",
      preset: "jest-expo",
      setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
      testMatch: ["<rootDir>/__tests__/chessboard.test.tsx"],
      transformIgnorePatterns: [
        // pnpm puts react-native and friends under
        // node_modules/.pnpm/<hash>/node_modules/<pkg>, so we have to
        // allow transformation of files anywhere under that tree.
        "node_modules/(?!(\\.pnpm/.+/)?((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?|@expo-google-fonts|react-navigation|@react-navigation|@unimodules|unimodules|sentry-expo|native-base|react-native-svg))",
      ],
    },
  ],
};

// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

// The example app at <repo>/example consumes the package at the repo
// root via `file:..`, which creates a symlink at
// example/node_modules/@og-nav/expo-chessboard → ../../.. — but the
// symlinked dist/ files live OUTSIDE example/.
//
// Two problems to solve:
//
//  1. Metro's default project root only watches example/, so it can't
//     see the symlinked dist files. Fix: watchFolders includes the
//     parent.
//
//  2. When dist/Chessboard.js does `require("react-native-reanimated")`,
//     Metro's HIERARCHICAL lookup walks up from dist/ and finds the
//     parent's pnpm-installed copy at /<repo>/node_modules/react-native-reanimated
//     BEFORE it ever consults extraNodeModules (which is a fallback,
//     not an override). That's a different reanimated than the one
//     example/ios/Pods has linked natively → JSI host function not
//     registered → "Exception in HostFunction" at the import site.
//
//     Fix: a custom resolveRequest that intercepts the peer-dep
//     module names and forces them to example/node_modules. This
//     wins over hierarchical lookup. Everything else falls through
//     to Metro's default resolver, so npm's nested layout (e.g.
//     react-native/node_modules/@react-native/virtualized-lists)
//     keeps working.

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];

// Peer deps of @og-nav/expo-chessboard PLUS anything else that must
// be a singleton across the JS bundle (react, react-native, etc).
const SINGLETON_DEPS = new Set([
  "react",
  "react-dom",
  "react-native",
  "react-native-reanimated",
  "react-native-gesture-handler",
  "react-native-svg",
  "react-native-worklets",
  "expo",
  "expo-audio",
  "expo-haptics",
  "chess.ts",
]);

const exampleNodeModules = path.resolve(projectRoot, "node_modules");

const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Match exact module name OR subpath imports like
  // "react-native-reanimated/lib/...".
  const topLevel = moduleName.split("/")[0].startsWith("@")
    ? moduleName.split("/").slice(0, 2).join("/")
    : moduleName.split("/")[0];

  if (SINGLETON_DEPS.has(topLevel)) {
    const remapped = path.join(exampleNodeModules, moduleName);
    return context.resolveRequest(context, remapped, platform);
  }

  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;

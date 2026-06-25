const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [...(config.watchFolders || []), workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// Force React packages to resolve from mobile's own node_modules.
// react-native 0.81.5 ships a renderer compiled against React 19.1.0 —
// if the monorepo root has a different React version (e.g. 19.2.4 from
// the web frontend) pnpm hoisting would pick the wrong one without this.
// With pnpm hoisted linker, react is at the workspace root.
// Explicitly resolve from there so Metro always uses one copy.
config.resolver.extraNodeModules = {
  react: path.resolve(workspaceRoot, "node_modules/react"),
  "react-dom": path.resolve(workspaceRoot, "node_modules/react-dom"),
  "react-native": path.resolve(workspaceRoot, "node_modules/react-native"),
};

module.exports = withNativeWind(config, { input: "./global.css" });

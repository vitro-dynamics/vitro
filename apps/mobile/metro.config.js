// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Required for workspace packages that use the "exports" field in package.json.
// Without this, Metro can't resolve @app/ui/components/ui/button etc.
config.resolver.unstable_enablePackageExports = true;

module.exports = config;

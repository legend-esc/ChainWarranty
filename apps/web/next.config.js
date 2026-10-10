/** @type {import('next').NextConfig} */
const nextConfig = {
  // Transpile the workspace SDK package (ESM source, no compiled dist yet)
  transpilePackages: ["@chainwarranty/sdk"],

  // pg and related native modules should not be bundled by Next.js webpack;
  // they are only used in server-side API routes (runtime: "nodejs").
  webpack(config, { isServer }) {
    if (isServer) {
      // Prevent webpack from trying to bundle native pg bindings
      config.externals = [...(config.externals ?? []), "pg-native"];
    }
    return config;
  },
};

module.exports = nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow the workspace SDK package to be transpiled
  transpilePackages: ["@chainwarranty/sdk"],
};

module.exports = nextConfig;

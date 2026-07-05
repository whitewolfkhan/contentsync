/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // @uiw/react-md-editor ships ESM; transpile so the App Router build works.
    optimizePackageImports: ["@uiw/react-md-editor"],
  },
};
module.exports = nextConfig;

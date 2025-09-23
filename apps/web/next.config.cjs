/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  reactStrictMode: true,
  // When deploying behind a reverse proxy you might set a basePath here.
  // basePath: '/app',
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  output: 'standalone',
};

module.exports = nextConfig;
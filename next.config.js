/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  // Transpile React Query to fix SSR issues
  transpilePackages: ['@tanstack/react-query'],
  // Skip linting during build (we run it separately)
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Skip type checking during build (we run it separately)
  typescript: {
    ignoreBuildErrors: false,
  },
};

module.exports = nextConfig;

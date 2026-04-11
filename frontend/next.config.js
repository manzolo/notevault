const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin('./i18n.ts');

// Server-side only: used by Next.js rewrites to proxy /api/* to the backend.
// Set BACKEND_INTERNAL_URL=http://notevault-backend:8000 in production.
const BACKEND_INTERNAL_URL = process.env.BACKEND_INTERNAL_URL || 'http://localhost:8000';

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || 'dev';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  generateBuildId: async () => APP_VERSION,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${BACKEND_INTERNAL_URL}/api/:path*`,
      },
    ];
  },
};

module.exports = withNextIntl(nextConfig);

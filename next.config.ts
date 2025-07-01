import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Netlify-specific optimizations
  experimental: {
    serverComponentsExternalPackages: ['openai'],
  },
  // API route timeout configuration
  api: {
    responseLimit: false,
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};

export default nextConfig;

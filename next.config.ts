import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Netlify-specific optimizations
  serverExternalPackages: ['openai'],

  // ESLint configuration for build
  eslint: {
    // Ignore test files during build
    ignoreDuringBuilds: false,
    dirs: ['src/app', 'src/components', 'src/hooks', 'src/utils', 'src/theme', 'src/contexts', 'src/stores', 'src/services', 'src/types']
  },

  // TypeScript configuration
  typescript: {
    // Ignore TypeScript errors in test files during build
    ignoreBuildErrors: false,
  },
};

export default nextConfig;

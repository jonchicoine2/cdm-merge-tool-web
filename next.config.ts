import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Netlify-specific optimizations
  serverExternalPackages: ['openai'],
};

export default nextConfig;

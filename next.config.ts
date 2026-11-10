import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hume EVI requires server-side token generation; static export is disabled.
  devIndicators: false,
  turbopack: {},
};

export default nextConfig;

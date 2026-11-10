import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The app uses a server route to mint short-lived Inworld session tokens.
  devIndicators: false,
  turbopack: {},
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces a minimal self-contained build for Docker
  output: "standalone",
};

export default nextConfig;

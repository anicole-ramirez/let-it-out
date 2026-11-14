import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Let phones on the LAN load the dev server (matched per hostname label).
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*"],
};

export default nextConfig;

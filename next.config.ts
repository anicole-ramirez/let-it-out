import type { NextConfig } from "next";

// `npm run build:pages` / `dev:pages`: static single-player build for GitHub Pages, served
// from /let-it-out. Only .tsx files are routes there, which leaves out the API (route.ts).
const pages = process.env.npm_lifecycle_event?.endsWith(":pages") ?? false;
const base = pages ? "/let-it-out" : "";

const nextConfig: NextConfig = {
  // Let phones on the LAN load the dev server (matched per hostname label).
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*"],
  ...(pages && { output: "export", basePath: base, pageExtensions: ["tsx"] }),
  env: { NEXT_PUBLIC_STATIC: pages ? "1" : "", NEXT_PUBLIC_BASE_PATH: base },
};

export default nextConfig;

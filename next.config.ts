import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // lamejs uses CommonJS with internal IIFE-scoped variables (MPEGMode etc.)
  // that break when Turbopack bundles them. Marking it external forces Node's
  // native require() at runtime, preserving the original module scope.
  serverExternalPackages: ['lamejs'],
};

export default nextConfig;

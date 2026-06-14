import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // lamejs uses CommonJS with internal IIFE-scoped variables (MPEGMode etc.)
  // that break when Turbopack bundles them. Marking it external forces Node's
  // native require() at runtime, preserving the original module scope.
  serverExternalPackages: ['lamejs'],

  experimental: {
    // The Clerk auth proxy buffers every request body in memory, capped at 10MB
    // by default. Saving a DAW master uploads an uncompressed WAV (~10MB per
    // minute of stereo 44.1kHz audio), so anything over ~1 minute was silently
    // truncated, corrupting the multipart boundary and breaking formData parsing
    // on /api/projects/[id]/master. Raise the cap to comfortably fit long mixes.
    proxyClientMaxBodySize: '200mb',
  },
};

export default nextConfig;

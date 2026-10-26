import fs from "node:fs";
import path from "node:path";

// In monorepos, load workspace root .env files if present
if (typeof process.loadEnvFile === "function") {
  const rootDir = path.resolve(process.cwd(), "../..");
  const nodeEnv = process.env.NODE_ENV || "development";
  const envCandidates = [
    `.env.${nodeEnv}.local`,
    ".env.local",
    `.env.${nodeEnv}`,
    ".env",
  ];
  for (const file of envCandidates) {
    const fullPath = path.resolve(rootDir, file);
    if (fs.existsSync(fullPath)) {
      try {
        process.loadEnvFile(fullPath);
      } catch {
        // Ignore parse errors
      }
    }
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const apiUrl = process.env.INTERNAL_API_URL || "http://localhost:4000";
    return [
      {
        source: "/api/:path*",
        destination: `${apiUrl}/api/:path*`,
      },
      {
        source: "/uploads/:path*",
        destination: `${apiUrl}/uploads/:path*`,
      },
      {
        source: "/webhooks/:path*",
        destination: `${apiUrl}/webhooks/:path*`,
      },
    ];
  },
};

export default nextConfig;

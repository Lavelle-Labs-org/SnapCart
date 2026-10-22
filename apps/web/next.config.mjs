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
        source: "/webhooks/:path*",
        destination: `${apiUrl}/webhooks/:path*`,
      },
    ];
  },
};

export default nextConfig;

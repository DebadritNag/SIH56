import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    // EC2_BACKEND_URL is a server-only env var (no NEXT_PUBLIC_ prefix).
    // It is set in Vercel → Project → Settings → Environment Variables.
    // It never reaches the browser and never appears in built JS bundles.
    // NEXT_PUBLIC_API_BASE_URL is always /backend-api (same-origin proxy path).
    const ec2Backend = process.env.EC2_BACKEND_URL || "http://54.234.16.107";

    return [
      {
        source: "/backend-api/:path*",
        destination: `${ec2Backend}/:path*`,
      },
    ];
  },
};

export default nextConfig;

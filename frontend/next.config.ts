import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        // /backend-api/... is rewritten to the EC2 backend at the Next.js layer.
        // The EC2 IP is kept here and never exposed to React components or the browser.
        // On Vercel, set NEXT_PUBLIC_API_BASE_URL=http://54.234.16.107 as an env var
        // so the proxy route also resolves correctly during SSR/ISR.
        source: "/backend-api/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_BASE_URL || "http://54.234.16.107"}/:path*`,
      },
    ];
  },
};

export default nextConfig;

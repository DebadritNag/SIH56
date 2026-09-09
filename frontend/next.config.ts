import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const configured = process.env.BACKEND_ORIGIN;
    if (process.env.NODE_ENV === "production" && !configured) {
      throw new Error("Set server-only BACKEND_ORIGIN before building/deploying the frontend.");
    }
    const backend = new URL(configured || "http://127.0.0.1:8000");
    if (!["http:", "https:"].includes(backend.protocol) || backend.username || backend.password || backend.search || backend.hash || backend.pathname !== "/") {
      throw new Error("BACKEND_ORIGIN must be an HTTP(S) origin without credentials, path, query or fragment.");
    }
    const devToken = process.env.NEXT_PUBLIC_DEV_BEARER_TOKEN;
    if (devToken && (process.env.NODE_ENV === "production" || devToken !== "demo-token")) {
      throw new Error("NEXT_PUBLIC_DEV_BEARER_TOKEN must be empty in production; only the non-secret demo-token is supported locally.");
    }

    return [
      {
        source: "/backend-api/:path*",
        destination: `${backend.origin}/:path*`,
      },
    ];
  },
};

export default nextConfig;

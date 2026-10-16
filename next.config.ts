import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Parsers run only on the server; keep them out of the client bundle.
  serverExternalPackages: ["mammoth", "unpdf"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;

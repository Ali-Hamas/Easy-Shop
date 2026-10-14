import type { NextConfig } from "next";
const config: NextConfig = {
  devIndicators: false,
  async headers() {
    return [
      {
        source: "/uploads/products/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/admin",
        destination: "/dashboard",
        permanent: false,
      },
    ];
  },
};
export default config;

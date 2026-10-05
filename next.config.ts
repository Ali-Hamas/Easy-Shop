import type { NextConfig } from "next";
const config: NextConfig = {
  devIndicators: false,
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

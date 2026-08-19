import type { NextConfig } from "next";
import { getWebEnv } from "@magazine/config/env/web";

const env = getWebEnv();
const mediaPublicBaseUrl = new URL(env.MEDIA_PUBLIC_BASE_URL);

const nextConfig: NextConfig = {
  transpilePackages: ["@magazine/config", "@magazine/domain", "@magazine/db"],
  images: {
    remotePatterns: [
      {
        protocol: mediaPublicBaseUrl.protocol.replace(":", "") as "http" | "https",
        hostname: mediaPublicBaseUrl.hostname,
        port: mediaPublicBaseUrl.port,
        pathname: `${mediaPublicBaseUrl.pathname.replace(/\/$/, "")}/**`,
      },
    ],
  },
};

export default nextConfig;

import type { NextConfig } from "next";
import { getWebEnv } from "@magazine/config/env/web";
import { sameOriginLocalMediaRewrite } from "./src/lib/local-media";
import { publicWebContentSecurityPolicy } from "./src/lib/web-csp";

const env = getWebEnv();
const mediaPublicBaseUrl = new URL(env.MEDIA_PUBLIC_BASE_URL);
const localMediaRewrite = sameOriginLocalMediaRewrite({
  siteUrl: env.SITE_URL,
  mediaPublicBaseUrl: env.MEDIA_PUBLIC_BASE_URL,
});

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
  async rewrites() {
    if (!localMediaRewrite) {
      return [];
    }
    return {
      beforeFiles: [localMediaRewrite],
    };
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: publicWebContentSecurityPolicy(),
          },
        ],
      },
    ];
  },
};

export default nextConfig;

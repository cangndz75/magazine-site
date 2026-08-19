import type { NextConfig } from "next";
import { getEditorEnv } from "@magazine/config/env/editor";

getEditorEnv();

const nextConfig: NextConfig = {
  transpilePackages: ["@magazine/config", "@magazine/domain", "@magazine/db"],
  experimental: {
    proxyClientMaxBodySize: "16mb",
  },
};

export default nextConfig;

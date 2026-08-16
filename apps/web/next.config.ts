import type { NextConfig } from "next";
import { getWebEnv } from "@magazine/config/env/web";

getWebEnv();

const nextConfig: NextConfig = {
  transpilePackages: ["@magazine/config"],
};

export default nextConfig;

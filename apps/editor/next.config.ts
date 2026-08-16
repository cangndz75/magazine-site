import type { NextConfig } from "next";
import { getEditorEnv } from "@magazine/config/env/editor";

getEditorEnv();

const nextConfig: NextConfig = {
  transpilePackages: ["@magazine/config"],
};

export default nextConfig;

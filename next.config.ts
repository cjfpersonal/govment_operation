import type { NextConfig } from "next";

/**
 * 不设 `ASSET_PREFIX` 时无 `assetPrefix`，资源与页面同源，路径为站点根下的 `/_next/static`。
 * 仅当静态文件要从「别的完整 URL 根」加载时再设（不要末尾 /）。
 */
const assetPrefix =
  process.env.ASSET_PREFIX?.replace(/\/+$/, "") || undefined;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  ...(assetPrefix ? { assetPrefix } : {}),
  /** 设为 1 时打 Docker / 单机 Node 包：`.next/standalone`，需再执行 scripts/copy-standalone-assets.sh */
  ...(process.env.STANDALONE === "1" ? { output: "standalone" as const } : {}),
};

export default nextConfig;

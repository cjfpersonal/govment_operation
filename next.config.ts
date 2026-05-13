import type { NextConfig } from "next";

/**
 * 不设 `ASSET_PREFIX` 时无 `assetPrefix`，资源与页面同源，路径为站点根下的 `/_next/static`。
 * 仅当静态文件要从「别的完整 URL 根」加载时再设（不要末尾 /）。
 */
const assetPrefix =
  process.env.ASSET_PREFIX?.replace(/\/+$/, "") || undefined;

/** 挂在站点子路径时设置，如 `/gov`（不要末尾 /）。须与 Nginx `location ^~ /gov/` 一致，且构建与运行一致 */
const rawBase = process.env.NEXT_BASE_PATH?.trim();
const basePath =
  rawBase && rawBase !== "/"
    ? `/${rawBase.replace(/^\/+|\/+$/g, "")}`
    : undefined;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath ?? "",
  },
  ...(basePath ? { basePath } : {}),
  ...(assetPrefix ? { assetPrefix } : {}),
  /** 设为 1 时打 Docker / 单机 Node 包：`.next/standalone`，需再执行 scripts/copy-standalone-assets.sh */
  ...(process.env.STANDALONE === "1" ? { output: "standalone" as const } : {}),
};

export default nextConfig;

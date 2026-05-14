import type { NextConfig } from "next";

/**
 * 不设 `ASSET_PREFIX` 时无 `assetPrefix`，静态资源与 `basePath` 同源。
 * 仅当 JS/CSS 要从另一完整 URL 根加载时再设（不要末尾 /）。
 */
const rawAssetPrefix =
  process.env.ASSET_PREFIX?.replace(/\/+$/, "") || undefined;

/**
 * 仅当显式设置 `NEXT_BASE_PATH`（如 `/gov`）时启用 `basePath`。
 * 不设时静态资源与 API 为 `/_next/...`、`/api/...`（与 Nginx 下「根路径反代 + /gov 剥前缀」方案一致）。
 */
function resolveBasePath(): string | undefined {
  const v = process.env.NEXT_BASE_PATH?.trim();
  if (!v || v === "/") return undefined;
  return `/${v.replace(/^\/+|\/+$/g, "")}`;
}

const basePath = resolveBasePath();

/** `ASSET_PREFIX` 若已包含与 `basePath` 相同的路径尾缀，会与 Next 的 `basePath` 叠成 `/gov/gov/_next` */
function resolveAssetPrefix(
  prefix: string | undefined,
  base: string | undefined
): string | undefined {
  if (!prefix || !base) return prefix;
  const b = base.replace(/\/+$/, "");
  let p = prefix.replace(/\/+$/, "");
  if (p.endsWith(b)) {
    p = p.slice(0, -b.length).replace(/\/+$/, "");
  }
  return p || undefined;
}

const assetPrefix = resolveAssetPrefix(rawAssetPrefix, basePath);

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

#!/usr/bin/env bash
set -euo pipefail
# 将 .next/static 打成独立目录，便于放到任意静态服务（子路径、另一域名、对象存储、Nginx 目录等）
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
OUT="${1:-./dist-static-assets}"
if [[ ! -d .next/static ]]; then
  echo "请先执行: npm run build（若静态资源与页面不同源/不同路径，构建时需带 ASSET_PREFIX）" >&2
  exit 1
fi
rm -rf "$OUT"
mkdir -p "$OUT/_next"
cp -R .next/static "$OUT/_next/static"
echo "已生成: $OUT/_next/static"
echo "部署目标须与构建时资源 URL 一致："
echo "  未设 ASSET_PREFIX → 与页面同源，对外路径为 /_next/static/..."
echo '  设了 ASSET_PREFIX → 对外为 ${ASSET_PREFIX}/_next/static/...（变量为构建时所设完整 URL 根）'

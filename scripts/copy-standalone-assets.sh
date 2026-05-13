#!/usr/bin/env bash
set -euo pipefail
# Next standalone 运行前需把静态资源拷入 standalone 目录（官方要求）
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if [[ ! -d .next/standalone ]]; then
  echo "请先执行: STANDALONE=1 npm run build" >&2
  exit 1
fi
mkdir -p .next/standalone/.next
cp -R .next/static .next/standalone/.next/static
if [[ -d public ]]; then
  cp -R public .next/standalone/public
fi
echo "已同步 .next/static → .next/standalone/.next/static"
[[ -d public ]] && echo "已同步 public → .next/standalone/public" || true

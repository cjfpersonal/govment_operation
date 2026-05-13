/** 与 `next.config` 中 `NEXT_PUBLIC_BASE_PATH` 一致；子路径部署时客户端请求须带此前缀 */
export function withBasePath(path: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

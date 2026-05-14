/** 与 Next 运行时 `basePath` 一致（优先读框架注入变量） */
function clientBase(): string {
  if (typeof process === "undefined") return "";
  return (
    (process.env.__NEXT_ROUTER_BASEPATH as string | undefined) ||
    (process.env.NEXT_PUBLIC_BASE_PATH as string | undefined) ||
    ""
  ).replace(/\/+$/, "");
}

/** 折叠误拼接的 `/gov/gov/...` */
function collapseRepeatedBase(base: string, url: string): string {
  if (!base) return url;
  const double = `${base}${base}`;
  let out = url;
  while (out.startsWith(`${double}/`) || out === double) {
    out = base + out.slice(double.length);
  }
  return out;
}

/** 为 `fetch` 拼 API 路径：若已带 `basePath` 前缀则不再加，避免 `/gov/gov/...` */
export function withBasePath(path: string): string {
  const base = clientBase();
  const p = path.startsWith("/") ? path : `/${path}`;
  if (!base) return p;
  if (p === base || p.startsWith(`${base}/`)) {
    return collapseRepeatedBase(base, p);
  }
  return collapseRepeatedBase(base, `${base}${p}`);
}

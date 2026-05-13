import { NextResponse } from "next/server";
import { scrapeAll } from "@/lib/scrape";
import type { PoliciesResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 短缓存：减轻官网压力，同时接近实时 */
const CACHE_SEC = 120;

export async function GET(request: Request) {
  const bypass = new URL(request.url).searchParams.get("nocache") === "1";

  try {
    const { items, sources } = await scrapeAll();
    const body: PoliciesResponse = {
      meta: {
        fetchedAt: new Date().toISOString(),
        sources,
      },
      items,
    };
    return NextResponse.json(body, {
      status: 200,
      headers: bypass
        ? { "Cache-Control": "no-store" }
        : {
            "Cache-Control": `public, s-maxage=${CACHE_SEC}, stale-while-revalidate=60`,
          },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json(
      { error: message } satisfies { error: string },
      { status: 502 },
    );
  }
}

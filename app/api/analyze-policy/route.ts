import { NextResponse } from "next/server";
import { analyzePolicyBestEffort } from "@/lib/policy-risk-analysis";
import type { PolicyItem } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

function isPolicyItem(x: unknown): x is PolicyItem {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  const publishedAt = o.publishedAt;
  if (publishedAt !== null && typeof publishedAt !== "string") return false;
  return (
    typeof o.title === "string" &&
    typeof o.url === "string" &&
    typeof o.id === "string" &&
    typeof o.department === "string" &&
    typeof o.departmentLabel === "string" &&
    Array.isArray(o.moneySignals) &&
    o.moneySignals.every((s) => typeof s === "string") &&
    typeof o.moneyScore === "number" &&
    typeof o.kind === "string" &&
    typeof o.applicantHint === "string" &&
    (o.riskLevel === "低" || o.riskLevel === "中" || o.riskLevel === "高")
  );
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { item?: unknown };
    if (!isPolicyItem(body.item)) {
      return NextResponse.json(
        { error: "Invalid payload: expected PolicyItem as item" },
        { status: 400 },
      );
    }
    const analysis = await analyzePolicyBestEffort(body.item);
    return NextResponse.json(analysis, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "analyze failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

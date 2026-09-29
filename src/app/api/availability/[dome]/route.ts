import { NextResponse } from "next/server";
import { getDome } from "@/data/domes";
import { getCombinedAvailability } from "@/lib/combined-availability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ dome: string }> }) {
  const { dome } = await context.params;
  if (!getDome(dome)) return NextResponse.json({ error: "Unknown dome" }, { status: 404 });
  try {
    const result = await getCombinedAvailability(dome);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ status: "error", blocked: [], checkedAt: null },
      { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

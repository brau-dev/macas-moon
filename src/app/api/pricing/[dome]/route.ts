import { NextResponse } from "next/server";
import { isDomeActive } from "@/lib/active-domes";
import { getPool } from "@/lib/booking-db";
import { BookingError } from "@/lib/booking-error";
import { readNightlyPricing } from "@/lib/nightly-pricing-db";
import { logServerError } from "@/lib/safe-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ dome: string }> }) {
  const headers = { "Cache-Control": "no-store" };
  try {
    const { dome } = await context.params;
    if (process.env.BOOKING_ENABLED !== "true" || !isDomeActive(dome)) throw new BookingError("Domo no disponible.", 404);
    const query = new URL(request.url).searchParams;
    const pricing = await readNightlyPricing(getPool(), dome, query.get("start") ?? "", query.get("end") ?? "");
    return NextResponse.json(pricing, { headers });
  } catch (error) {
    if (error instanceof BookingError) return NextResponse.json({ error: error.message }, { status: error.status, headers });
    logServerError("Nightly prices unavailable", error);
    return NextResponse.json({ error: "No se pudieron consultar los precios. Intenta actualizar de nuevo." }, { status: 503, headers });
  }
}

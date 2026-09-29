import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const romantic = Number(process.env.PRICE_DOMO_ROMANTICO_CENTS);
  const ample = Number(process.env.PRICE_DOMO_AMPLIO_CENTS);
  const currency = process.env.BOOKING_CURRENCY;
  if (process.env.BOOKING_ENABLED !== "true" || !currency || !/^[A-Z]{3}$/.test(currency) ||
    !Number.isSafeInteger(romantic) || romantic <= 0 || !Number.isSafeInteger(ample) || ample <= 0) {
    return NextResponse.json({ error: "Tarifas no configuradas" }, { status: 503 });
  }
  return NextResponse.json({ currency, perNight: {
    "domo-romantico": romantic,
    "domo-amplio": ample,
  } }, { headers: { "Cache-Control": "no-store" } });
}

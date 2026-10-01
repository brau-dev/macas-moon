import { NextResponse } from "next/server";
import { getActiveDomeSlugs } from "@/lib/active-domes";

export const dynamic = "force-dynamic";

export async function GET() {
  const activeDomes = getActiveDomeSlugs();
  const priceKeys: Record<string, string> = {
    "domo-romantico": "PRICE_DOMO_ROMANTICO_CENTS",
    "domo-amplio": "PRICE_DOMO_AMPLIO_CENTS",
  };
  const perNight = Object.fromEntries(activeDomes.map((slug) =>
    [slug, Number(process.env[priceKeys[slug]])]));
  const currency = process.env.BOOKING_CURRENCY;
  if (process.env.BOOKING_ENABLED !== "true" || !currency || !/^[A-Z]{3}$/.test(currency) ||
    activeDomes.length === 0 || Object.values(perNight).some((price) =>
      !Number.isSafeInteger(price) || price <= 0)) {
    return NextResponse.json({ error: "Tarifas no configuradas" }, { status: 503 });
  }
  return NextResponse.json({ currency, perNight }, { headers: { "Cache-Control": "no-store" } });
}

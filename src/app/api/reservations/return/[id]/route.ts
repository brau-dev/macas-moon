import { NextResponse } from "next/server";
import { reconcilePayment } from "@/lib/reservation-service";
import { getSiteOrigin } from "@/lib/site-origin";
import { validReservationId } from "@/lib/booking-validation";
import { logServerError } from "@/lib/safe-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const siteUrl = getSiteOrigin();
  if (!validReservationId(id) || !siteUrl) {
    return NextResponse.json({ error: "Retorno inválido" }, { status: 400 });
  }
  try { await reconcilePayment(id); }
  catch (error) { logServerError("Tilopay return reconciliation failed", error); }
  // Any code in the browser query is informational, never proof of payment.
  const response = NextResponse.redirect(`${siteUrl.replace(/\/$/, "")}/reservar/estado?id=${id}`);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

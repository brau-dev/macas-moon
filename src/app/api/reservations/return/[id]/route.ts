import { NextResponse } from "next/server";
import { reconcilePayment } from "@/lib/reservation-service";
import { getSiteOrigin } from "@/lib/site-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const siteUrl = getSiteOrigin();
  if (!/^[a-f0-9-]{36}$/.test(id) || !siteUrl) {
    return NextResponse.json({ error: "Retorno inválido" }, { status: 400 });
  }
  try { await reconcilePayment(id); }
  catch (error) { console.error("Tilopay return reconciliation failed", error); }
  // Any code in the browser query is informational, never proof of payment.
  return NextResponse.redirect(`${siteUrl.replace(/\/$/, "")}/reservar/estado?id=${id}`);
}

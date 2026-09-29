import { NextResponse } from "next/server";
import { getPool } from "@/lib/booking-db";
import { reconcilePayment } from "@/lib/reservation-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length")) > 10_000) return new Response(null, { status: 413 });
  let data: Record<string, unknown>;
  try { data = await request.json(); } catch { return new Response(null, { status: 400 }); }
  const reference = data.orderNumber ?? data.order;
  if (typeof reference !== "string" || !/^MM[A-F0-9]{32}$/.test(reference)) {
    return new Response(null, { status: 400 });
  }
  try {
    const result = await getPool().query<{ id: string }>(
      "SELECT id FROM reservations WHERE payment_reference = $1", [reference]);
    if (result.rows[0]) await reconcilePayment(result.rows[0].id);
    // Webhook content alone cannot confirm a booking: reconcilePayment queries Tilopay.
    return new Response(null, { status: 200 });
  } catch (error) {
    console.error("Tilopay webhook reconciliation failed", error);
    return NextResponse.json({ error: "Reconciliation failed" }, { status: 503 });
  }
}

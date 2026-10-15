import { NextResponse } from "next/server";
import { requireAdmin, requireSameOrigin } from "@/lib/admin-auth";
import { adminError, privateHeaders } from "@/lib/admin-http";
import { removeManualBlock } from "@/lib/admin-reservations";
import { BookingError } from "@/lib/booking-error";
import { validReservationId } from "@/lib/booking-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(request);
    await requireAdmin();
    const { id } = await context.params;
    if (!validReservationId(id)) throw new BookingError("Bloqueo inválido.", 400);
    const result = await removeManualBlock(id);
    return NextResponse.json({ ok: true, ...result }, { headers: privateHeaders });
  } catch (error) { return adminError(error); }
}

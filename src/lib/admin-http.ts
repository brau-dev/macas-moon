import { NextResponse } from "next/server";
import { BookingError } from "@/lib/booking-error";
import { logServerError } from "@/lib/safe-log";
import { readJsonObject } from "@/lib/request-body";

export const privateHeaders = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

export function adminError(error: unknown) {
  if (error instanceof BookingError) return NextResponse.json({ error: error.message }, { status: error.status, headers: privateHeaders });
  logServerError("Admin request failed", error);
  return NextResponse.json({ error: "No se pudo completar la operación. Revisa la configuración y las migraciones." },
    { status: 503, headers: privateHeaders });
}

export async function readAdminJson(request: Request) {
  return readJsonObject(request);
}

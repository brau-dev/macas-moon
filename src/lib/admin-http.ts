import { NextResponse } from "next/server";
import { BookingError } from "@/lib/booking-error";
import { CheckoutError } from "@/lib/checkout-error";
import { logServerError } from "@/lib/safe-log";
import { readJsonObject } from "@/lib/request-body";

export const privateHeaders = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

export function adminError(error: unknown) {
  if (error instanceof BookingError) return NextResponse.json({ error: error.message }, { status: error.status, headers: privateHeaders });
  logServerError("Admin request failed", error);
  if (error instanceof CheckoutError && error.stage.startsWith("tilopay_")) {
    const environmentMismatch = error.reason === "environment_mismatch";
    const message = environmentMismatch
      ? "La solicitud pertenece a otro entorno de pago. Revísala en su entorno original de Tilopay."
      : ["tilopay_check", "tilopay_auth"].includes(error.stage)
        ? "No se pudo verificar el pago con Tilopay. Consulta el aviso «Pago sin verificar» de la reserva; este error no confirma ni descarta un cobro."
        : "No se pudo completar la operación con Tilopay. Consulta la información para soporte de la reserva.";
    // A provider's HTTP 401 must not be mistaken for an expired admin session.
    return NextResponse.json({ error: message }, { status: environmentMismatch ? 409 : 502, headers: privateHeaders });
  }
  return NextResponse.json({ error: "No se pudo completar la operación. Revisa la configuración y las migraciones." },
    { status: 503, headers: privateHeaders });
}

export async function readAdminJson(request: Request) {
  return readJsonObject(request);
}

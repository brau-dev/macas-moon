import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { adminError, privateHeaders } from "@/lib/admin-http";
import { adminCalendar } from "@/lib/admin-reservations";
import { validDate } from "@/lib/booking-validation";
import { BookingError } from "@/lib/booking-error";
import { addDays, nightsBetween } from "@/lib/date-range";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const query = new URL(request.url).searchParams;
    const start = query.get("start") ?? "";
    const end = query.get("end") ?? "";
    if (!validDate(start) || !validDate(end) || nightsBetween(start, end) < 1 || nightsBetween(start, end) > 62 || end > addDays(start, 62)) {
      throw new BookingError("Rango de consulta inválido.", 400);
    }
    const result = await adminCalendar(query.get("dome") ?? "", start, end, query.get("refresh") === "true");
    return NextResponse.json(result, { headers: privateHeaders });
  } catch (error) { return adminError(error); }
}

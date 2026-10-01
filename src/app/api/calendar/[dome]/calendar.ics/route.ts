import { createHash } from "node:crypto";
import { getDome } from "@/data/domes";
import { isDomeActive } from "@/lib/active-domes";
import { getPool } from "@/lib/booking-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ dome: string }> }) {
  const { dome } = await context.params;
  if (!getDome(dome) || !isDomeActive(dome)) return new Response(null, { status: 404 });
  try {
    const { rows } = await getPool().query<{ id: string; start: string; end: string }>(`
      SELECT id, to_char(check_in,'YYYYMMDD') AS start, to_char(check_out,'YYYYMMDD') AS end
      FROM reservations WHERE dome = $1 AND
      status = 'confirmed'`, [dome]);
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Macas Moon//Reservas//ES",
      "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:Macas Moon - " + dome,
      ...rows.flatMap((row) => ["BEGIN:VEVENT", `UID:${createHash("sha256").update(row.id).digest("hex")}@macasmoon.com`, `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${row.start}`, `DTEND;VALUE=DATE:${row.end}`,
        "SUMMARY:No disponible", "TRANSP:OPAQUE", "END:VEVENT"]), "END:VCALENDAR", ""];
    return new Response(lines.join("\r\n"), { headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      "X-Robots-Tag": "noindex, nofollow",
    } });
  } catch (error) {
    console.error("iCal export failed", error);
    return new Response(null, { status: 503 });
  }
}

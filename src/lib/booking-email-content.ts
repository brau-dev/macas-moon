import "server-only";
import type { Booking } from "@/lib/booking-db";
import { getDome } from "@/data/domes";
import { nightsBetween } from "@/lib/date-range";

const BRAND = "Macas Moon Glampings";
type Row = [string, string];
const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char]!));

function date(value: string) {
  return new Date(`${value}T12:00:00Z`).toLocaleDateString("es-CR", {
    day: "numeric", month: "long", year: "numeric", timeZone: "America/Costa_Rica",
  });
}

function message(title: string, intro: string, rows: Row[], footer: string, test: boolean,
  action?: { label: string; url: string }) {
  const warning = "PRUEBA: esta reserva no acredita un cobro real.";
  return {
    text: [BRAND, title, intro, ...(test ? [warning] : []), "",
      ...rows.map(([label, value]) => `${label}: ${value}`), "", footer,
      ...(action ? [`${action.label}: ${action.url}`] : []),
      "Este comprobante de reserva no es una factura electrónica tributaria.", BRAND].join("\n"),
    html: `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:24px 12px;background:#f4f1eb;color:#292d25;font-family:Arial,Helvetica,sans-serif;line-height:1.6">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #e1ddcf;border-radius:12px">
<tr><td style="padding:28px 32px;background:#35432f;color:#ffffff;border-radius:12px 12px 0 0">
<p style="margin:0;font-size:12px;letter-spacing:2px">MONTEVERDE · COSTA RICA</p>
<p style="margin:6px 0 0;font-family:Georgia,serif;font-size:26px">${BRAND}</p></td></tr>
<tr><td style="padding:28px 32px"><h1 style="margin:0 0 12px;font-family:Georgia,serif;font-size:26px;line-height:1.3">${escape(title)}</h1>
<p style="margin:0 0 20px">${escape(intro)}</p>
${test ? `<p style="padding:12px;background:#fff3cd;color:#6b4e00;border-radius:6px;font-weight:bold">${warning}</p>` : ""}
<table aria-label="Detalles de la reserva" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px">
${rows.map(([label, value]) => `<tr><th scope="row" align="left" style="width:40%;padding:12px 8px 12px 0;vertical-align:top;border-bottom:1px solid #ece9e0;color:#626951;font-weight:normal">${escape(label)}</th><td style="padding:12px 0;border-bottom:1px solid #ece9e0;overflow-wrap:anywhere">${escape(value)}</td></tr>`).join("")}
</table><p style="margin:24px 0 12px;font-size:14px">${escape(footer)}</p>
${action ? `<p style="margin:24px 0"><a href="${escape(action.url)}" style="display:inline-block;background:#35432f;color:#ffffff;padding:12px 20px;text-decoration:none;border-radius:6px;font-weight:bold">${escape(action.label)}</a></p>` : ""}
<p style="margin:24px 0 0;color:#777b70;font-size:12px">Este comprobante de reserva no es una factura electrónica tributaria.</p>
</td></tr></table><p style="font-size:12px;color:#777b70">${BRAND} · Monteverde, Costa Rica</p>
</td></tr></table></body></html>`,
  };
}

export function bookingEmails(booking: Booking, environment: string | undefined, siteOrigin: string | null) {
  const test = booking.payment_provider === "test" || environment === "Test";
  const prefix = test ? "[PRUEBA] " : "";
  const reference = booking.id.slice(0, 8).toUpperCase();
  const total = new Intl.NumberFormat("es-CR", { style: "currency", currency: booking.currency }).format(booking.amount_cents / 100);
  const country = /^[A-Z]{2}$/.test(booking.billing_country)
    ? new Intl.DisplayNames(["es"], { type: "region" }).of(booking.billing_country) ?? booking.billing_country
    : booking.billing_country || "No indicado";
  const stay: Row[] = [
    ["Alojamiento", getDome(booking.dome)?.name ?? booking.dome],
    ["Llegada", date(booking.check_in)], ["Salida", date(booking.check_out)],
    ["Noches", String(nightsBetween(booking.check_in, booking.check_out))],
    ["Huéspedes", String(booking.guests)],
  ];
  const payment: Row[] = [
    [booking.payment_provider === "test" ? "Importe de referencia" : test ? "Importe simulado" : "Total pagado", `${total} (${booking.currency})`],
    ["Estado", "Reserva confirmada"],
    ["Pago", booking.payment_provider === "test" ? "Prueba gratuita, sin cobro" : test ? "Tilopay Test, pago simulado verificado" : "Tilopay, pago verificado"],
  ];
  const guest = message("Tu reserva está confirmada", `Hola ${booking.guest_name}. Gracias por elegir ${BRAND}. Será un gusto recibirte. Estos son los detalles de tu estancia:`,
    [["Referencia", reference], ["Titular", booking.guest_name], ...stay, ...payment],
    "Conserva este correo como comprobante. Si necesitas ayuda, responde a este mensaje e indica la referencia de tu reserva.", test,
    siteOrigin ? { label: "Ver mi reserva", url: `${siteOrigin}/reservar/estado?id=${encodeURIComponent(booking.id)}` } : undefined);
  const owner = message("Nueva reserva confirmada", "Se ha efectuado una reserva directa en la página web. Este es el aviso para el equipo de Macas Moon Glampings:",
    [["ID de reserva", booking.id], ["Titular", booking.guest_name], ["Correo", booking.guest_email],
      ["Teléfono", booking.guest_phone], ["País de residencia", country], ...stay, ...payment,
      ["Origen", "Reserva directa desde la web"], ["Referencia de pago", booking.payment_reference ?? "Prueba sin pago"]],
    "Revisa el panel administrativo para gestionar la reserva. La actualización de Airbnb y Expedia depende de sus consultas iCal y no es inmediata.", test,
    siteOrigin ? { label: "Abrir panel administrativo", url: `${siteOrigin}/admin` } : undefined);
  return {
    guest: { ...guest, subject: `${prefix}Reserva confirmada · ${BRAND} · ${reference}` },
    owner: { ...owner, subject: `${prefix}Nueva reserva · ${BRAND} · ${reference}` },
  };
}

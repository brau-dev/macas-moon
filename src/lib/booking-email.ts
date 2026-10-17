import "server-only";
import nodemailer from "nodemailer";
import { bookingColumns, transaction, type Booking } from "@/lib/booking-db";
import { gmailOptions, missingEmailConfig } from "@/lib/gmail-config.mjs";
import { bookingEmails } from "@/lib/booking-email-content";
import { getSiteOrigin } from "@/lib/site-origin";
import { logServerError } from "@/lib/safe-log";

type Audience = "guest" | "owner";

async function deliver(id: string, audience: Audience) {
  // Only these two hardcoded identifiers can become part of the SQL query.
  const column = audience === "guest" ? "confirmation_email_sent_at" : "owner_notification_sent_at";
  // Each delivery has its own transaction: if one fails, the other's accepted
  // delivery remains recorded. Row locking serializes webhook/admin/cron retries.
  return transaction(async (client) => {
    const { rows } = await client.query<Booking>(
      "SELECT " + bookingColumns + " FROM reservations WHERE id = $1 FOR UPDATE", [id]);
    const booking = rows[0];
    if (!booking || booking.kind !== "booking" || booking.status !== "confirmed" || booking[column] ||
      (audience === "owner" && !booking.owner_notification_required)) return false;

    const sender = process.env.SMTP_USER!.trim();
    const content = bookingEmails(booking, getSiteOrigin())[audience];
    const transport = nodemailer.createTransport(gmailOptions(process.env));
    try {
      const result = await transport.sendMail({
        from: { name: "Macas Moon Glampings", address: sender },
        to: audience === "guest" ? { address: booking.guest_email, name: booking.guest_name }
          : { address: sender, name: "Administración Macas Moon Glampings" },
        replyTo: audience === "guest" ? process.env.BOOKING_REPLY_TO?.trim() || sender
          : { address: booking.guest_email, name: booking.guest_name },
        messageId: "<booking-" + (audience === "guest" ? "confirmed." : "owner.") + booking.id + "@macasmoon.com>",
        ...content,
      });
      if (!result.accepted?.length || result.rejected?.length) throw new Error("SMTP did not accept the notification");
      await client.query("UPDATE reservations SET " + column + " = now() WHERE id = $1", [id]);
      return true;
    } finally { transport.close(); }
  });
}

export async function sendConfirmation(booking: Booking) {
  if (booking.kind !== "booking" || booking.status !== "confirmed" || missingEmailConfig(process.env).length) return false;
  const results = await Promise.allSettled([deliver(booking.id, "guest"), deliver(booking.id, "owner")]);
  results.forEach((result, index) => {
    if (result.status === "rejected") logServerError(index === 0 ? "Guest confirmation failed" : "Owner notification failed", result.reason);
  });
  if (results.some((result) => result.status === "rejected")) throw new Error("Reservation notifications remain pending");
  // SMTP has no idempotency API. A crash after acceptance and before COMMIT may
  // still duplicate a notification despite row locks and stable Message-IDs.
  return results.some((result) => result.status === "fulfilled" && result.value);
}

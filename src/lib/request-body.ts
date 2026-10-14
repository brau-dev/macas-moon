import { BookingError } from "@/lib/booking-error";

export async function readBoundedText(body: ReadableStream<Uint8Array> | null, maxBytes: number) {
  if (!body) return "";
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      bytes += result.value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        throw new BookingError("Solicitud demasiado grande.", 413);
      }
      text += decoder.decode(result.value, { stream: true });
    }
    return text + decoder.decode();
  } finally { reader.releaseLock(); }
}

export async function readJsonObject(request: Request) {
  if (Number(request.headers.get("content-length")) > 10_000) throw new BookingError("Solicitud demasiado grande.", 413);
  const text = await readBoundedText(request.body, 10_000);
  let value: unknown;
  try { value = JSON.parse(text); }
  catch { throw new BookingError("Solicitud inválida.", 400); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new BookingError("Solicitud inválida.", 400);
  return value as Record<string, unknown>;
}

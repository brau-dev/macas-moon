import type { AvailabilityResponse, OccupiedRange } from "@/lib/availability-types";

const CACHE_MS = 5 * 60 * 1000;
const MAX_BYTES = 2_000_000;
const URLS: Record<string, Array<string | undefined>> = {
  "domo-romantico": [process.env.ICAL_DOMO_ROMANTICO_AIRBNB_URL, process.env.ICAL_DOMO_ROMANTICO_EXPEDIA_URL],
  "domo-amplio": [process.env.ICAL_DOMO_AMPLIO_AIRBNB_URL, process.env.ICAL_DOMO_AMPLIO_EXPEDIA_URL],
};

const cache = new Map<string, { expires: number; result: AvailabilityResponse }>();

function isoDate(raw: string) {
  if (!/^\d{8}$/.test(raw)) throw new Error("Invalid iCal date");
  const iso = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== iso) {
    throw new Error("Invalid iCal date");
  }
  return iso;
}

function addDay(iso: string) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function dateFromProperty(property: string, value: string) {
  const date = isoDate(value.slice(0, 8));
  if (!value.includes("T")) return date;
  // OTA exports normally use all-day dates. For timed events, use the date part
  // supplied by the source so their booking dates remain stable.
  if (!/^\d{8}T\d{6}Z?$/.test(value)) throw new Error("Unsupported iCal date");
  if (property.includes("VALUE=DATE")) throw new Error("Invalid iCal date type");
  return date;
}

export function parseIcal(text: string): OccupiedRange[] {
  if (!text.includes("BEGIN:VCALENDAR") || !text.includes("END:VCALENDAR")) throw new Error("Invalid iCal calendar");
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const unfolded: string[] = [];
  for (const line of lines) {
    if (/^[ \t]/.test(line) && unfolded.length) unfolded[unfolded.length - 1] += line.slice(1);
    else unfolded.push(line);
  }

  const ranges: OccupiedRange[] = [];
  let event: Record<string, { key: string; value: string }> | null = null;
  for (const line of unfolded) {
    if (line === "BEGIN:VEVENT") { event = {}; continue; }
    if (line === "END:VEVENT") {
      if (event && event.STATUS?.value !== "CANCELLED" && event.TRANSP?.value !== "TRANSPARENT") {
        if (!event.DTSTART) throw new Error("iCal event without start date");
        const start = dateFromProperty(event.DTSTART.key, event.DTSTART.value);
        const end = event.DTEND
          ? dateFromProperty(event.DTEND.key, event.DTEND.value)
          : addDay(start);
        if (end > start) ranges.push({ start, end });
      }
      event = null;
      continue;
    }
    if (!event) continue;
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const key = line.slice(0, separator).toUpperCase();
    const name = key.split(";")[0];
    event[name] = { key, value: line.slice(separator + 1).trim().toUpperCase() };
  }
  if (event) throw new Error("Incomplete iCal event");
  return ranges;
}

function mergeRanges(ranges: OccupiedRange[]) {
  const sorted = ranges.sort((a, b) => a.start.localeCompare(b.start));
  const merged: OccupiedRange[] = [];
  for (const range of sorted) {
    const last = merged.at(-1);
    if (last && range.start <= last.end) last.end = last.end > range.end ? last.end : range.end;
    else merged.push({ ...range });
  }
  return merged;
}

async function readCalendar(rawUrl: string) {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("Invalid iCal URL");
  const response = await fetch(url, {
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(8000),
    headers: { Accept: "text/calendar" },
  });
  if (!response.ok || Number(response.headers.get("content-length")) > MAX_BYTES) {
    throw new Error("Calendar unavailable");
  }
  const body = await response.text();
  if (body.length > MAX_BYTES) throw new Error("Calendar too large");
  return parseIcal(body);
}

export async function getAvailability(dome: string, forceRefresh = false): Promise<AvailabilityResponse> {
  const urls = URLS[dome];
  if (!urls) throw new Error("Unknown dome");
  const configured = urls.map((url) => url?.trim()).filter((url): url is string => Boolean(url));
  if (!configured.length) return { status: "unconfigured", blocked: [], checkedAt: null };
  if (new Set(configured).size !== configured.length) return { status: "error", blocked: [], checkedAt: null };
  const existing = cache.get(dome);
  if (!forceRefresh && existing && existing.expires > Date.now()) return existing.result;

  const feeds = await Promise.allSettled(configured.map(readCalendar));
  const successful = feeds.filter((feed): feed is PromiseFulfilledResult<OccupiedRange[]> => feed.status === "fulfilled");
  const status: AvailabilityResponse["status"] = successful.length === 0
    ? "error"
    : successful.length === urls.length ? "ready" : "partial";
  const result: AvailabilityResponse = {
    status,
    blocked: mergeRanges(successful.flatMap((feed) => feed.value)),
    checkedAt: new Date().toISOString(),
  };
  cache.set(dome, { expires: Date.now() + CACHE_MS, result });
  return result;
}

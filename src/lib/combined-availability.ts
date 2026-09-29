import { getAvailability } from "@/lib/ical";
import { getLocalBlocked } from "@/lib/booking-db";
import type { AvailabilityResponse } from "@/lib/availability-types";

export async function getCombinedAvailability(dome: string, forceRefresh = false): Promise<AvailabilityResponse> {
  const imported = await getAvailability(dome, forceRefresh);
  const local = await getLocalBlocked(dome);
  return { ...imported, blocked: [...imported.blocked, ...local] };
}

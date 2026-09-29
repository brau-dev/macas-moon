export type OccupiedRange = { start: string; end: string };

export type AvailabilityResponse = {
  status: "ready" | "partial" | "unconfigured" | "error";
  blocked: OccupiedRange[];
  checkedAt: string | null;
};

export function overlapsBlocked(start: string, end: string, blocked: OccupiedRange[]) {
  return blocked.some((range) => start < range.end && end > range.start);
}

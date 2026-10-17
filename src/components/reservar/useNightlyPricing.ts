"use client";

import { useEffect, useState } from "react";
import type { NightlyPricing } from "@/lib/nightly-pricing";

export function useNightlyPricing(dome: string, start: string, end: string, version: number) {
  const key = `${dome}:${start}:${end}:${version}`;
  const [result, setResult] = useState<{ key: string; value: NightlyPricing | null; error: string } | null>(null);
  const valid = Boolean(dome && /^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end) && end > start);
  useEffect(() => {
    if (!valid) return;
    const controller = new AbortController();
    let inFlight = false;
    async function load() {
      if (document.hidden || inFlight) return;
      inFlight = true;
      try {
        const response = await fetch(`/api/pricing/${encodeURIComponent(dome)}?${new URLSearchParams({ start, end })}`,
          { cache: "no-store", signal: controller.signal });
        const value = await response.json();
        if (!response.ok) throw new Error(value.error ?? "No se pudieron consultar los precios.");
        if (value.dome !== dome || value.start !== start || value.end !== end) throw new Error("Precios no disponibles.");
        if (!controller.signal.aborted) setResult({ key, value, error: "" });
      } catch (error) {
        if (!controller.signal.aborted) setResult({ key, value: null, error: error instanceof Error ? error.message : "Precios no disponibles." });
      } finally { inFlight = false; }
    }
    load();
    document.addEventListener("visibilitychange", load);
    return () => { controller.abort(); document.removeEventListener("visibilitychange", load); };
  }, [dome, start, end, version, key, valid]);
  return { pricing: valid && result?.key === key ? result.value : null,
    error: valid && result?.key === key ? result.error : "" };
}

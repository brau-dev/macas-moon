import type { NightPrice } from "@/lib/nightly-pricing";
import { cn } from "@/lib/cn";

/** Presentation only: use the already-loaded price, never infer a missing rate. */
export function AdminNightPrice({ day, night, currency }: {
  day: string; night?: NightPrice; currency: string | null;
}) {
  if (!night || night.date !== day || !Number.isSafeInteger(night.amountCents) || night.amountCents <= 0 ||
    !currency || !/^[A-Z]{3}$/.test(currency)) {
    return <span className="mt-1 block rounded-md bg-sand-200 px-1 py-1 text-[10px] leading-tight text-muted"
      title="No se pudo obtener el precio de esta noche.">Sin tarifa</span>;
  }
  const amount = new Intl.NumberFormat("es-CR", { style: "currency", currency,
    currencyDisplay: "narrowSymbol", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(night.amountCents / 100);
  const description = `Precio de la noche del ${day}: ${amount} ${currency} por noche. ${night.special ? "Tarifa especial." : "Tarifa base."}`;
  return <span title={description} className={cn(
    "mt-1 flex flex-col items-center gap-0.5 rounded-lg border border-teal-200 bg-teal-50 px-1 py-1 text-teal-950",
    night.special && "border-teal-400 bg-teal-100",
  )}>
    <span className="sr-only">{description}</span>
    <span aria-hidden="true" className="whitespace-nowrap text-[10px] font-bold leading-tight tabular-nums sm:text-xs">{amount}</span>
    <span aria-hidden="true" className="flex flex-wrap justify-center text-[9px] font-medium leading-tight">
      <span>{currency}</span><span>/noche</span>
    </span>
  </span>;
}

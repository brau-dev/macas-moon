// Tilopay's live detail endpoint labels single-use links as "Just Once".
// Keep the numeric/API aliases, but never infer single use from an unknown type.
export function isSingleUsePaymentLink(value: unknown) {
  return value === 1 || (typeof value === "string" &&
    /^(1|just[ -]?once|single[ -]?use|single|one[ -]?time)$/i.test(value.trim()));
}

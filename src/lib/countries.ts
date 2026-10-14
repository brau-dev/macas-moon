import { getCountries } from "libphonenumber-js";

// ISO 3166-1 alpha-2 catalogue, shared by the form and server validation.
export const residenceCountries = getCountries();

export function isResidenceCountry(value: string) {
  return residenceCountries.some((country) => country === value);
}

// Never log provider bodies, credentials, URLs, SQL details, guest data or stacks.
export function logServerError(event: string, error: unknown) {
  const details: { code?: string; status?: number } = {};
  if (error && typeof error === "object") {
    const value = error as { code?: unknown; status?: unknown };
    if (typeof value.code === "string" && (/^[0-9A-Z]{5}$/.test(value.code) ||
      ["EAI_AGAIN", "ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND"].includes(value.code))) details.code = value.code;
    if (typeof value.status === "number" && Number.isInteger(value.status) && value.status >= 400 && value.status <= 599) details.status = value.status;
  }
  console.error(event, details);
}

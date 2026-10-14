/** @param {Record<string, string | undefined>} env */
export function missingEmailConfig(env) {
  const missing = [];
  if (!/^[^\s<>@]+@gmail\.com$/i.test(env.SMTP_USER?.trim() ?? "")) missing.push("SMTP_USER");
  if (!/^[A-Za-z0-9]{16}$/.test((env.SMTP_PASSWORD ?? "").replace(/\s/g, ""))) missing.push("SMTP_PASSWORD");
  return missing;
}

/**
 * @param {Record<string, string | undefined>} env
 * @returns {import("nodemailer/lib/smtp-transport").Options}
 */
export function gmailOptions(env) {
  if (missingEmailConfig(env).length) throw new Error("Gmail SMTP is not configured");
  return {
    host: "smtp.gmail.com", port: 465, secure: true,
    auth: { user: env.SMTP_USER.trim(), pass: env.SMTP_PASSWORD.replace(/\s/g, "") },
    tls: { minVersion: "TLSv1.2", rejectUnauthorized: true },
    connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 10000, dnsTimeout: 5000,
    disableFileAccess: true, disableUrlAccess: true, logger: false, debug: false,
  };
}

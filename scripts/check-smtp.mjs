import { readFileSync } from "node:fs";
import nodemailer from "nodemailer";
import { parseBookingEnv } from "./booking-env.mjs";
import { gmailOptions } from "../src/lib/gmail-config.mjs";

let transport;
try {
  const { values, errors } = parseBookingEnv(readFileSync(".env.netlify", "utf8"));
  if (errors.length) throw new Error("Invalid environment file");
  transport = nodemailer.createTransport(gmailOptions(Object.fromEntries(values)));
  await transport.verify();
  console.log("Gmail aceptó la conexión y la autenticación. No se envió ningún correo. Esto no verifica la conexión desde Netlify ni la llegada a la bandeja de entrada.");
} catch (error) {
  const code = error && typeof error === "object" && "code" in error ? error.code : "";
  console.error(code === "EAUTH" ? "Gmail rechazó el acceso: revisa SMTP_USER y una contraseña de aplicación, no la contraseña normal."
    : "No se pudo verificar Gmail. Revisa SMTP_USER, SMTP_PASSWORD, tu conexión y la autorización de Google. No se mostraron datos privados.");
  process.exitCode = 1;
} finally { transport?.close(); }

import { hashAdminPassword } from "../src/lib/admin-password.mjs";

async function hiddenInput(prompt) {
  if (!process.stdin.isTTY) throw new Error("Ejecuta este comando en una terminal interactiva.");
  process.stdout.write(prompt);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise((resolve, reject) => {
    let value = "";
    function finish(error) {
      process.stdin.off("data", read);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
      if (error) reject(error); else resolve(value);
    }
    function read(chunk) {
      for (const char of chunk.toString()) {
        if (char === "\u0003") { finish(new Error("Cancelado.")); return; }
        if (char === "\r" || char === "\n") { finish(); return; }
        if (char === "\u007f" || char === "\b") value = value.slice(0, -1);
        else if (char >= " " && value.length < 257) value += char;
      }
    }
    process.stdin.on("data", read);
  });
}

try {
  const password = await hiddenInput("Contraseña nueva (mínimo 12 caracteres; no se muestra): ");
  const confirmation = await hiddenInput("Repite la contraseña: ");
  if (password !== confirmation) throw new Error("Las contraseñas no coinciden.");
  console.log(`ADMIN_PASSWORD_HASH=${await hashAdminPassword(password)}`);
  console.log("Guarda ese valor completo en Netlify (privado, solo Functions) y define ADMIN_USERNAME.");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

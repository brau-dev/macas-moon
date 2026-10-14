"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminLogin({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const fields = new FormData(event.currentTarget);
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: fields.get("username"), password: fields.get("password") }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "No se pudo iniciar sesión.");
      router.replace("/admin"); router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Error de conexión."); setBusy(false); }
  }
  return <section className="mx-auto max-w-md px-5 py-16 sm:py-24">
    <p className="eyebrow text-olive-700">Macas Moon · Acceso privado</p>
    <h1 className="mt-3 font-serif text-3xl text-ink">Administración</h1>
    <p className="mt-3 text-sm text-muted">Introduce tu usuario y contraseña para gestionar el calendario.</p>
    {!configured ? <p role="alert" className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
      El acceso administrativo no está disponible. Contacta al responsable del sitio.</p> : null}
    <form onSubmit={submit} className="mt-7 space-y-5 rounded-2xl border border-border bg-warm-white p-6">
      <label className="block text-sm font-medium">Usuario
        <input required name="username" autoComplete="username" maxLength={100}
          className="mt-2 w-full rounded-xl border border-border p-3" /></label>
      <label className="block text-sm font-medium">Contraseña
        <input required type="password" name="password" autoComplete="current-password" maxLength={256}
          className="mt-2 w-full rounded-xl border border-border p-3" /></label>
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      <button disabled={busy || !configured} className="w-full rounded-xl bg-olive-700 p-3 font-medium text-white disabled:opacity-50">
        {busy ? "Verificando…" : "Ingresar"}</button>
    </form>
  </section>;
}

"use client";

import { usePathname } from "next/navigation";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { WhatsAppButton } from "@/components/layout/WhatsAppButton";

export function SiteChrome({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const admin = path === "/admin" || path.startsWith("/admin/");
  return <>
    {!admin ? <Navbar /> : null}
    <main id="contenido" className="flex-1">{children}</main>
    {!admin ? <><Footer /><WhatsAppButton /></> : null}
  </>;
}

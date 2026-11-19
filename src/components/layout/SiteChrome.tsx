"use client";

import { GoogleAnalytics } from "@next/third-parties/google";
import { usePathname } from "next/navigation";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { WhatsAppButton } from "@/components/layout/WhatsAppButton";

const gaId = process.env.NEXT_PUBLIC_GA_ID;

export function SiteChrome({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const admin = path === "/admin" || path.startsWith("/admin/");
  const privateStatus = path === "/reservar/estado";
  return <>
    {!admin && !privateStatus && /^G-[A-Z0-9]+$/.test(gaId ?? "") ? <GoogleAnalytics gaId={gaId!} /> : null}
    {!admin ? <Navbar /> : null}
    <main id="contenido" className="flex-1">{children}</main>
    {!admin ? <><Footer /><WhatsAppButton /></> : null}
  </>;
}

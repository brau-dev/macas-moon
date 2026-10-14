import type { Metadata } from "next";

export const metadata: Metadata = { title: "Administración", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-sand-50">{children}</div>;
}

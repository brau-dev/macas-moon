import type { Metadata } from "next";
import { Lora, Nunito_Sans } from "next/font/google";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { WhatsAppButton } from "@/components/layout/WhatsAppButton";
import { LanguageProvider } from "@/i18n/LanguageProvider";
import { JsonLd } from "@/components/seo/JsonLd";
import { websiteJsonLd } from "@/lib/jsonLd";
import { site } from "@/lib/site";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.macasmoon.com";

const lora = Lora({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-lora",
  display: "swap",
});

const nunito = Nunito_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-nunito",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Macas Moon | Glamping en Monteverde, Costa Rica",
    template: "%s | Macas Moon Glamping",
  },
  description:
    "Glamping en Monteverde, Costa Rica: los domos de Macas Moon ofrecen naturaleza, tranquilidad y comodidad entre las montañas del bosque nuboso.",
  openGraph: {
    title: "Macas Moon | Glamping en Monteverde, Costa Rica",
    description:
      "Glamping en Monteverde, Costa Rica: los domos de Macas Moon ofrecen naturaleza, tranquilidad y comodidad entre las montañas del bosque nuboso.",
    type: "website",
    locale: "es_CR",
    siteName: site.name,
    url: siteUrl,
    images: [
      {
        url: "/assets/domo2/IMG_7051.webp",
        alt: "Domos de Macas Moon rodeados de vegetación y las montañas de Monteverde",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${lora.variable} ${nunito.variable} h-full`}>
      <body className="flex min-h-full flex-col bg-warm-white font-sans text-main antialiased">
        <JsonLd data={websiteJsonLd()} />
        <LanguageProvider>
          <Navbar />
          <main id="contenido" className="flex-1">
            {children}
          </main>
          <Footer />
          <WhatsAppButton />
        </LanguageProvider>
      </body>
    </html>
  );
}

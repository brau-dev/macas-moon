import type { Metadata } from "next";
import localFont from "next/font/local";
import { SiteChrome } from "@/components/layout/SiteChrome";
import { LanguageProvider } from "@/i18n/LanguageProvider";
import { JsonLd } from "@/components/seo/JsonLd";
import { websiteJsonLd } from "@/lib/jsonLd";
import { site, siteUrl } from "@/lib/site";
import "./globals.css";

// Keep font assets in Git: builds must not depend on Google's CSS/URL format.
const lora = localFont({
  src: "./fonts/Lora-Variable.ttf",
  weight: "500 700",
  style: "normal",
  fallback: ["Georgia", "serif"],
  adjustFontFallback: "Times New Roman",
  variable: "--font-lora",
  display: "swap",
});

const nunito = localFont({
  src: "./fonts/NunitoSans-Variable.ttf",
  weight: "400 700",
  style: "normal",
  fallback: ["Arial", "sans-serif"],
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
          <SiteChrome>{children}</SiteChrome>
        </LanguageProvider>
      </body>
    </html>
  );
}

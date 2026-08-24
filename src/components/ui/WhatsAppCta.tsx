"use client";

import { Button } from "@/components/ui/Button";
import { useLanguage } from "@/i18n/LanguageProvider";
import { whatsappMessageUrl } from "@/lib/site";

type WhatsAppCtaProps = {
  message: string;
  children: React.ReactNode;
  size?: "md" | "lg";
  variant?: "primary" | "outline";
  className?: string;
};

export function WhatsAppCta({
  message,
  children,
  size = "lg",
  variant = "primary",
  className,
}: WhatsAppCtaProps) {
  const { t } = useLanguage();

  return (
    <Button href={whatsappMessageUrl(t(message))} size={size} variant={variant} className={className}>
      {children}
    </Button>
  );
}

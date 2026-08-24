"use client";

import Image, { type ImageProps } from "next/image";
import { useLanguage } from "@/i18n/LanguageProvider";

export function TranslatedImage({ alt, ...props }: ImageProps) {
  const { t } = useLanguage();
  return <Image {...props} alt={typeof alt === "string" ? t(alt) : alt} />;
}

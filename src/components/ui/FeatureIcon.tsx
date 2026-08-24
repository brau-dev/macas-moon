"use client";

import { cn } from "@/lib/cn";
import { useLanguage } from "@/i18n/LanguageProvider";
import { icons } from "@/lib/icons";
import type { IconName } from "@/types/dome";

type FeatureIconProps = {
  name: IconName;
  label: string;
  text?: string;
  className?: string;
};

export function FeatureIcon({ name, label, text, className }: FeatureIconProps) {
  const Icon = icons[name];
  const { t } = useLanguage();

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-olive-50 text-olive-500">
        <Icon aria-hidden="true" className="h-6 w-6" strokeWidth={1.5} />
      </span>
      <h3 className="heading-card text-2xl text-ink">{t(label)}</h3>
      {text ? <p className="max-w-xs text-[0.95rem] leading-relaxed font-normal text-muted">{t(text)}</p> : null}
    </div>
  );
}

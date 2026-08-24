"use client";

import { cn } from "@/lib/cn";
import { useLanguage } from "@/i18n/LanguageProvider";

type BadgeProps = {
  children: React.ReactNode;
  tone?: "olive" | "sand";
  className?: string;
};

export function Badge({ children, tone = "olive", className }: BadgeProps) {
  const { t } = useLanguage();
  const content = typeof children === "string" ? t(children) : children;

  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full px-3 py-1 text-[0.72rem] font-bold tracking-[0.2em] uppercase",
        tone === "olive" && "bg-olive-100 text-olive-800",
        tone === "sand" && "bg-sand-300 text-olive-900",
        className,
      )}
    >
      {content}
    </span>
  );
}

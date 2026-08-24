"use client";

import { cn } from "@/lib/cn";
import { useLanguage } from "@/i18n/LanguageProvider";

type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  className?: string;
  id?: string;
  as?: "h1" | "h2";
};

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  className,
  id,
  as: HeadingTag = "h2",
}: SectionHeadingProps) {
  const { t } = useLanguage();

  return (
    <div
      className={cn(
        "max-w-2xl",
        align === "center" && "mx-auto text-center",
        className,
      )}
    >
      {eyebrow ? (
        <p className="eyebrow mb-3 text-olive-700">
          {t(eyebrow)}
        </p>
      ) : null}
      <HeadingTag
        id={id}
        className="heading-section text-ink"
      >
        {t(title)}
      </HeadingTag>
      {description ? (
        <p className="mt-4 text-base leading-relaxed font-normal text-muted sm:text-lg">
          {t(description)}
        </p>
      ) : null}
    </div>
  );
}

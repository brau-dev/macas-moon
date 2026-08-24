"use client";

import { Container } from "@/components/ui/Container";
import { icons } from "@/lib/icons";
import type { Dome } from "@/types/dome";
import { useLanguage } from "@/i18n/LanguageProvider";

export function DomeStats({ dome }: { dome: Dome }) {
  const { t } = useLanguage();

  return (
    <section className="dome-stats bg-warm-white">
      <Container className="py-8 sm:py-12 lg:py-5">
        <ul className="grid grid-cols-2 gap-x-5 gap-y-6 sm:grid-cols-3 sm:gap-6 lg:grid-cols-6 lg:items-center lg:gap-x-6 lg:gap-y-0">
          {dome.stats.map((stat) => {
            const Icon = icons[stat.icon];
            return (
              <li key={stat.label} className="flex flex-col gap-2 lg:justify-center">
                <Icon className="h-6 w-6 text-olive-500" strokeWidth={1.5} />
                <div>
                  <p className="eyebrow text-[0.72rem] text-muted">{t(stat.label)}</p>
                  <p className="mt-1 font-medium text-ink">{t(stat.value)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </Container>
    </section>
  );
}

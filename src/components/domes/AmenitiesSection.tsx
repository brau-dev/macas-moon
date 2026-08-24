"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Modal } from "@/components/ui/Modal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { icons } from "@/lib/icons";
import { useLanguage } from "@/i18n/LanguageProvider";
import type { Dome } from "@/types/dome";

export function AmenitiesSection({ dome }: { dome: Dome }) {
  const [open, setOpen] = useState(false);
  const { t } = useLanguage();
  const preview = dome.amenities.slice(0, 8);

  return (
    <section className="bg-cream">
      <Container className="py-16 sm:py-24 lg:py-28">
        <SectionHeading title="Todo lo que necesitas para tu estadía" />
        <ul className="mt-12 grid grid-cols-2 gap-x-5 gap-y-9 sm:grid-cols-3 sm:gap-x-6 sm:gap-y-10 lg:grid-cols-4 lg:gap-y-11">
          {preview.map((amenity) => {
            const Icon = icons[amenity.icon];
            return (
              <li key={amenity.id} className="flex min-w-0 items-start gap-3">
                <Icon
                  className="mt-0.5 h-[22px] w-[22px] shrink-0 text-olive-500 sm:h-6 sm:w-6 lg:h-[26px] lg:w-[26px]"
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
                <span className="min-w-0 text-[15px] leading-snug font-medium break-words text-ink sm:text-base">
                  {t(amenity.label)}
                </span>
              </li>
            );
          })}
        </ul>
        <div className="mt-10">
          <Button variant="outline" onClick={() => setOpen(true)}>
            Ver todas las amenidades
          </Button>
        </div>
      </Container>
      <Modal open={open} onClose={() => setOpen(false)} title="Amenidades" size="md">
        <ul className="grid gap-5 sm:grid-cols-2">
          {dome.amenities.map((amenity) => {
            const Icon = icons[amenity.icon];
            return (
              <li key={amenity.id} className="flex items-center gap-3">
                <Icon className="h-5 w-5 text-olive-500" strokeWidth={1.5} aria-hidden="true" />
                <span className="text-sm font-medium text-ink">{t(amenity.label)}</span>
              </li>
            );
          })}
        </ul>
      </Modal>
    </section>
  );
}

"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { faqItems } from "@/data/faq";
import { useLanguage } from "@/i18n/LanguageProvider";
import { cn } from "@/lib/cn";

export function FaqSection() {
  const { t } = useLanguage();
  const baseId = useId();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="bg-sand-100">
      <Container className="py-16 sm:py-20 lg:py-28">
        <div className="w-full max-w-[70rem]">
          <SectionHeading title="Preguntas frecuentes" className="max-w-none" />
          <div className="mt-8 flex flex-col gap-3 lg:mt-10">
          {faqItems.map((item, index) => {
            const open = openIndex === index;
            const panelId = `${baseId}-panel-${index}`;
            const buttonId = `${baseId}-button-${index}`;

            return (
              <div
                key={item.question}
                className="rounded-[20px] bg-sand-50 px-5 sm:px-6"
              >
                <h3>
                  <button
                    id={buttonId}
                    type="button"
                    aria-expanded={open}
                    aria-controls={panelId}
                    className="flex min-h-14 w-full items-center justify-between gap-4 py-5 text-left sm:min-h-16 sm:py-6"
                    onClick={() => setOpenIndex(open ? null : index)}
                  >
                    <span className="heading-card text-lg text-ink sm:text-xl">
                      {t(item.question)}
                    </span>
                    <ChevronDown
                      className={cn(
                        "h-5 w-5 shrink-0 text-olive-600 transition-transform duration-300 ease-out",
                        open && "rotate-180",
                      )}
                      strokeWidth={1.6}
                      aria-hidden="true"
                    />
                  </button>
                </h3>
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  className={cn(
                    "grid transition-[grid-template-rows] duration-300 ease-out",
                    open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                  )}
                >
                  <div className="overflow-hidden">
                    <p className="pb-5 text-[0.98rem] leading-relaxed text-muted sm:pb-6 sm:text-base">
                      {t(item.answer)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        </div>
      </Container>
    </section>
  );
}

"use client";

import { Container } from "@/components/ui/Container";
import { useLanguage } from "@/i18n/LanguageProvider";
import type { Dome } from "@/types/dome";

export function DomeVideoSection({ dome }: { dome: Dome }) {
  const { t } = useLanguage();

  if (!dome.video) return null;

  return (
    <section className="bg-warm-white">
      <Container className="py-10 sm:py-14 lg:py-16">
        <div className="mx-auto w-full max-w-[22rem]">
          <div className="relative aspect-[9/16] overflow-hidden rounded-[24px] bg-black shadow-lift">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${dome.video.youtubeId}?rel=0`}
              title={t(dome.video.title)}
              className="absolute inset-0 h-full w-full"
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
        </div>
      </Container>
    </section>
  );
}

"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { reviews, reviewSummary } from "@/data/reviews";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";
import { useLanguage } from "@/i18n/LanguageProvider";

export function ReviewsSection() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const { t } = useLanguage();

  function scrollByCard(direction: -1 | 1) {
    const root = scrollerRef.current;
    if (!root) return;
    const card = root.querySelector("article");
    const gap = Number.parseFloat(getComputedStyle(root).columnGap || getComputedStyle(root).gap) || 16;
    const amount = card ? card.getBoundingClientRect().width + gap : 300;
    root.scrollBy({
      left: amount * direction,
      behavior: reduced ? "auto" : "smooth",
    });
  }

  return (
    <section id="resenas" className="home-screen bg-sand-100">
      <Container className="home-screen-inner py-16 sm:py-20 lg:py-0">
        <div className="flex shrink-0 flex-col gap-6 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
          <SectionHeading
            title={reviewSummary.label}
            description="Palabras de quienes ya se quedaron, publicadas en Google Maps."
          />
          <div className="flex items-center gap-4">
            <div>
              <p className="font-serif text-5xl leading-none font-semibold text-ink">{reviewSummary.rating}</p>
              <p className="mt-2 flex items-center gap-1 text-olive-500" aria-label={t("5 de 5 estrellas")}>
                {Array.from({ length: 5 }).map((_, index) => (
                  <Star key={index} className="h-4 w-4 fill-current" />
                ))}
              </p>
              <p className="mt-2 text-xs font-medium tracking-wide text-muted uppercase">
                {reviewSummary.source}
              </p>
            </div>
            <div className="ml-4 hidden gap-2 sm:flex">
              <button
                type="button"
                onClick={() => scrollByCard(-1)}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-warm-white text-ink transition-colors duration-200 hover:bg-olive-50"
                aria-label={t("Reseña anterior")}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => scrollByCard(1)}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-warm-white text-ink transition-colors duration-200 hover:bg-olive-50"
                aria-label={t("Siguiente reseña")}
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        <div
          ref={scrollerRef}
          className="reviews-scroller mt-10 lg:mt-6"
        >
          {reviews.map((review) => (
            <article
              key={review.id}
              className="review-card flex snap-start flex-col rounded-[24px] border border-border-soft bg-warm-white p-7"
            >
              <p className="flex gap-1 text-olive-500" aria-hidden="true">
                {Array.from({ length: review.rating }).map((_, index) => (
                  <Star key={index} className="h-4 w-4 fill-current" />
                ))}
              </p>
              <blockquote className="mt-5 font-serif font-medium text-ink">
                “{t(review.quote)}”
              </blockquote>
              <div className="mt-4">
                <p className="text-sm font-semibold text-olive-800">{review.name}</p>
                <p className="text-sm text-muted">{review.source}</p>
              </div>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}

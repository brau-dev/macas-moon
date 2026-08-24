"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useLanguage } from "@/i18n/LanguageProvider";
import { cn } from "@/lib/cn";
import {
  siteGalleryImages,
  type SiteGalleryCategory,
} from "@/data/siteGallery";

const filters: Array<{ value: "all" | SiteGalleryCategory; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "general", label: "Naturaleza y entorno" },
  { value: "domo1", label: "Domo 1" },
  { value: "domo2", label: "Domo 2" },
  { value: "monteverde", label: "Monteverde" },
];

const categoryLabels: Record<SiteGalleryCategory, string> = {
  general: "Naturaleza y entorno",
  domo1: "Domo 1",
  domo2: "Domo 2",
  monteverde: "Monteverde",
};

const INITIAL_VISIBLE = 12;
const LOAD_MORE = 12;

export function SiteGallery() {
  const { t } = useLanguage();
  const [filter, setFilter] = useState<"all" | SiteGalleryCategory>("all");
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const filteredImages = useMemo(
    () => filter === "all"
      ? siteGalleryImages
      : siteGalleryImages.filter((image) => image.category === filter),
    [filter],
  );

  const mountedImages = filteredImages.slice(0, visibleCount);
  const hasMore = visibleCount < filteredImages.length;
  const selectedImage = selectedIndex === null ? null : filteredImages[selectedIndex];

  useEffect(() => {
    if (selectedIndex === null) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowLeft") {
        setSelectedIndex((current) =>
          current === null ? null : (current - 1 + filteredImages.length) % filteredImages.length,
        );
      }
      if (event.key === "ArrowRight") {
        setSelectedIndex((current) =>
          current === null ? null : (current + 1) % filteredImages.length,
        );
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedIndex, filteredImages.length]);

  function selectFilter(nextFilter: "all" | SiteGalleryCategory) {
    setFilter(nextFilter);
    setVisibleCount(INITIAL_VISIBLE);
    setSelectedIndex(null);
  }

  const closeGallery = useCallback(() => setSelectedIndex(null), []);

  function showPrevious() {
    setSelectedIndex((current) =>
      current === null ? null : (current - 1 + filteredImages.length) % filteredImages.length,
    );
  }

  function showNext() {
    setSelectedIndex((current) =>
      current === null ? null : (current + 1) % filteredImages.length,
    );
  }

  return (
    <>
      <div className="sticky top-[var(--header-h)] z-20 mt-10 bg-warm-white pt-2 pb-1 sm:mt-12">
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto pb-2">
          {filters.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => selectFilter(item.value)}
              className={cn(
                "min-h-11 shrink-0 rounded-full px-5 py-2 text-sm font-semibold transition-colors duration-200",
                filter === item.value
                  ? "bg-olive-600 text-white"
                  : "border border-sand-300 bg-sand-50 text-olive-800 hover:bg-olive-50",
              )}
            >
              {t(item.label)}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
        {mountedImages.map((image, index) => (
          <button
            key={image.src}
            type="button"
            onClick={() => setSelectedIndex(index)}
            className={cn(
              "group relative mb-4 block w-full break-inside-avoid overflow-hidden rounded-[20px] bg-sand-100 text-left shadow-soft",
              image.orientation === "portrait" ? "aspect-[3/4]" : "aspect-[4/3]",
            )}
            aria-label={`${t("Abrir foto")}: ${t(image.alt)}`}
          >
            <Image
              src={image.src}
              alt={t(image.alt)}
              fill
              sizes="(min-width: 1280px) 20vw, (min-width: 1024px) 28vw, (min-width: 640px) 44vw, calc(100vw - 2.5rem)"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.025]"
            />
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/65 to-transparent px-4 pt-12 pb-4 text-xs font-bold tracking-[0.12em] text-white uppercase opacity-90 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-visible:opacity-100">
              {t(categoryLabels[image.category])}
            </span>
          </button>
        ))}
      </div>

      {hasMore ? (
        <div className="mt-6 flex justify-center sm:mt-8">
          <Button
            type="button"
            variant="outline"
            onClick={() => setVisibleCount((current) => current + LOAD_MORE)}
          >
            Ver más
          </Button>
        </div>
      ) : null}

      <Modal
        open={selectedImage !== null}
        onClose={closeGallery}
        title="Galería"
        size="full"
        className="bg-ink"
        headerClassName="border-white/10 bg-ink text-white [&_h2]:text-white [&_button]:text-white [&_button:hover]:bg-white/10"
        bodyClassName="p-0 sm:p-0"
      >
        {selectedImage && selectedIndex !== null ? (
          <div className="relative flex h-[calc(100svh-4.6rem)] items-center justify-center bg-ink sm:h-[calc(92svh-4.6rem)]">
            <Image
              src={selectedImage.src}
              alt={t(selectedImage.alt)}
              fill
              priority
              sizes="100vw"
              className="object-contain px-2 pb-20 sm:px-16 sm:pb-16"
            />
            <button
              type="button"
              onClick={showPrevious}
              className="absolute left-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-warm-white/90 text-ink shadow-soft transition-colors hover:bg-white sm:left-6"
              aria-label={t("Foto anterior")}
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              type="button"
              onClick={showNext}
              className="absolute right-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-warm-white/90 text-ink shadow-soft transition-colors hover:bg-white sm:right-6"
              aria-label={t("Foto siguiente")}
            >
              <ChevronRight className="h-6 w-6" />
            </button>
            <div className="absolute inset-x-4 bottom-4 z-10 text-center text-sm text-sand-100 sm:bottom-5">
              <p>{t(selectedImage.alt)}</p>
              <p className="mt-1 text-xs text-sand-400">
                {t("Foto {current} de {total}", {
                  current: selectedIndex + 1,
                  total: filteredImages.length,
                })}
              </p>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}

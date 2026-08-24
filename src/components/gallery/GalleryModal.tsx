"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useLanguage } from "@/i18n/LanguageProvider";
import { galleryCategories, type GalleryCategory, type GalleryImage } from "@/types/dome";
import { cn } from "@/lib/cn";

type GalleryModalProps = {
  open: boolean;
  onClose: () => void;
  images: GalleryImage[];
  labels: Record<GalleryCategory, string>;
  title: string;
};

export function GalleryModal({ open, onClose, images, labels, title }: GalleryModalProps) {
  const { t } = useLanguage();
  const [filter, setFilter] = useState<"todas" | GalleryCategory>("todas");

  const filters = useMemo(() => {
    const present = galleryCategories.filter((category) =>
      images.some((image) => image.category === category),
    );
    return present;
  }, [images]);

  const visible = filter === "todas" ? images : images.filter((image) => image.category === filter);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("Fotos · {title}", { title })}
      size="full"
      bodyClassName="px-0 py-0 sm:px-0 sm:py-0"
    >
      <div className="sticky top-0 z-10 bg-warm-white px-5 pt-6 pb-3 sm:px-8 sm:pt-8 sm:pb-4">
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto pb-1">
          <FilterChip active={filter === "todas"} onClick={() => setFilter("todas")}>
            {t("Todas")}
          </FilterChip>
          {filters.map((category) => (
            <FilterChip
              key={category}
              active={filter === category}
              onClick={() => setFilter(category)}
            >
              {labels[category]}
            </FilterChip>
          ))}
        </div>
      </div>
      <div className="grid gap-3 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:grid-cols-2 sm:px-8 sm:pb-8 lg:grid-cols-3">
        {visible.map((image) => (
          <figure key={image.src} className="relative aspect-[4/3] overflow-hidden rounded-[20px]">
            <Image src={image.src} alt={t(image.alt)} fill sizes="(min-width: 1024px) 33vw, 100vw" className="object-cover" />
          </figure>
        ))}
      </div>
    </Modal>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-11 rounded-full px-4 py-2 text-sm whitespace-nowrap transition-colors duration-200",
        active ? "bg-olive-500 text-white" : "bg-olive-50 text-olive-800 hover:bg-olive-100",
      )}
    >
      {children}
    </button>
  );
}

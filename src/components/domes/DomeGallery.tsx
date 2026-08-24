"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { GalleryModal } from "@/components/gallery/GalleryModal";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import type { Dome, GalleryCategory } from "@/types/dome";
import { useLanguage } from "@/i18n/LanguageProvider";

const categoryLabels: Record<GalleryCategory, string> = {
  habitacion: "Habitación",
  cocina: "Cocina",
  bano: "Baño",
  jacuzzi: "Jacuzzi",
  exterior: "Exterior",
  vistas: "Vistas",
};

function findByCategory(dome: Dome, category: GalleryCategory) {
  return dome.gallery.find((image) => image.category === category) ?? dome.gallery[0];
}

export function DomeGallery({ dome }: { dome: Dome }) {
  const [open, setOpen] = useState(false);
  const { t } = useLanguage();
  const tiles = useMemo(
    () => [
      { image: dome.gallery[0], label: null as string | null, className: "sm:col-span-2 sm:row-span-2" },
      { image: findByCategory(dome, "habitacion"), label: "Interior", className: "" },
      { image: findByCategory(dome, "jacuzzi"), label: "Jacuzzi", className: "" },
      { image: findByCategory(dome, "cocina"), label: "Cocina", className: "" },
      { image: findByCategory(dome, "exterior"), label: "Exterior", className: "" },
    ],
    [dome],
  );

  return (
    <section className="bg-warm-white">
      <Container className="py-16 sm:py-20 lg:py-24">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 sm:grid-rows-2 sm:gap-3">
          {tiles.map((tile, index) => (
            <button
              key={`${tile.image.src}-${index}`}
              type="button"
              onClick={() => setOpen(true)}
              aria-label={`${t("Abrir foto")}: ${t(tile.image.alt)}`}
              className={`group relative aspect-[4/3] overflow-hidden rounded-[20px] sm:aspect-auto sm:min-h-[200px] sm:rounded-[22px] ${index === 0 ? "sm:min-h-[420px]" : ""} ${tile.className}`}
            >
              <Image
                src={tile.image.src}
                alt={t(tile.image.alt)}
                fill
                sizes={index === 0 ? "(min-width: 640px) 50vw, 100vw" : "(min-width: 640px) 25vw, 100vw"}
                className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
              {tile.label ? (
                <span className="absolute right-3 bottom-3 rounded-full bg-warm-white/92 px-3 py-1 text-[0.72rem] font-bold tracking-[0.2em] text-olive-800 uppercase">
                  {t(tile.label)}
                </span>
              ) : null}
            </button>
          ))}
        </div>
        <div className="mt-8">
          <Button variant="outline" onClick={() => setOpen(true)}>
            Ver todas las fotos
          </Button>
        </div>
      </Container>
      <GalleryModal
        open={open}
        onClose={() => setOpen(false)}
        images={dome.gallery}
        labels={Object.fromEntries(
          Object.entries(categoryLabels).map(([key, label]) => [key, t(label)]),
        ) as Record<GalleryCategory, string>}
        title={t(dome.name)}
      />
    </section>
  );
}

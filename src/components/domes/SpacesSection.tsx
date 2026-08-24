"use client";

import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { cn } from "@/lib/cn";
import type { Dome, Space } from "@/types/dome";
import { useLanguage } from "@/i18n/LanguageProvider";

function SpaceBlock({
  space,
  className,
  imageClassName,
  sizes = "(min-width: 1024px) 80vw, calc(100vw - 2.5rem)",
}: {
  space: Space;
  className?: string;
  imageClassName?: string;
  sizes?: string;
}) {
  const { t } = useLanguage();

  return (
    <article className={className}>
      <div className={cn("relative overflow-hidden rounded-[24px]", imageClassName)}>
        <Image
          src={space.image}
          alt={t(space.name)}
          fill
          sizes={sizes}
          className="object-cover"
        />
      </div>
      <h3 className="heading-card mt-5 text-2xl text-ink sm:text-3xl">{t(space.name)}</h3>
      <p className="mt-2 max-w-xl text-[0.98rem] leading-relaxed text-muted">{t(space.description)}</p>
    </article>
  );
}

export function SpacesSection({ dome }: { dome: Dome }) {
  const [first, ...rest] = dome.spaces;
  const pairs: Space[][] = [];
  const leftover: Space[] = [];

  rest.forEach((space) => {
    if (space.layout === "full" || space.layout === "wide") {
      leftover.push(space);
    } else {
      const last = pairs[pairs.length - 1];
      if (last && last.length === 1) last.push(space);
      else pairs.push([space]);
    }
  });

  const trailingHalves = pairs.filter((pair) => pair.length === 1).flat();
  const completePairs = pairs.filter((pair) => pair.length === 2);

  return (
    <section className="bg-warm-white">
      <Container className="py-16 sm:py-24 lg:py-28">
        <SectionHeading title="Conoce cada espacio" />
        <div className="mt-14 space-y-16">
          {first ? (
            <SpaceBlock space={first} imageClassName="aspect-[16/10] sm:aspect-[16/9] sm:min-h-[420px]" />
          ) : null}

          {completePairs.map((pair) => (
            <div key={pair.map((item) => item.id).join("-")} className="grid gap-10 lg:grid-cols-2">
              {pair.map((space) => (
                <SpaceBlock
                  key={space.id}
                  space={space}
                  imageClassName="aspect-[4/3]"
                  sizes="(min-width: 1024px) 40vw, calc(100vw - 2.5rem)"
                />
              ))}
            </div>
          ))}

          {leftover.map((space) => (
            <SpaceBlock
              key={space.id}
              space={space}
              className="lg:max-w-[85%]"
              imageClassName="aspect-[16/9] sm:aspect-[21/9] sm:min-h-[320px]"
              sizes="(min-width: 1024px) 70vw, calc(100vw - 2.5rem)"
            />
          ))}

          {trailingHalves.length > 0 ? (
            <div className="grid gap-10 lg:grid-cols-2 lg:pt-4">
              {trailingHalves.map((space) => (
                <SpaceBlock
                  key={space.id}
                  space={space}
                  className="lg:col-start-2"
                  imageClassName="aspect-[4/3]"
                  sizes="(min-width: 1024px) 40vw, calc(100vw - 2.5rem)"
                />
              ))}
            </div>
          ) : null}
        </div>
      </Container>
    </section>
  );
}

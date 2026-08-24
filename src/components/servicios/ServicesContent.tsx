import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { WhatsAppCta } from "@/components/ui/WhatsAppCta";
import {
  decorationGallery,
  decorationItems,
  decorationPackages,
  serviceWhatsappMessages,
  tourExperiences,
} from "@/data/services";
import { TranslatedText } from "@/i18n/LanguageProvider";
import { TranslatedImage } from "@/i18n/TranslatedImage";

function ServiceNote({ children }: { children: string }) {
  return (
    <p className="rounded-2xl bg-olive-50 px-4 py-3 text-sm leading-relaxed text-olive-800">
      <TranslatedText>{children}</TranslatedText>
    </p>
  );
}

export function ServicesContent() {
  return (
    <>
      <section className="bg-warm-white">
        <Container className="grid gap-10 pt-28 pb-16 sm:pt-36 sm:pb-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16 lg:pt-40">
          <div>
            <p className="eyebrow mb-4 text-olive-700">
              <TranslatedText>Servicios adicionales</TranslatedText>
            </p>
            <h1 className="heading-display max-w-3xl text-ink">
              <TranslatedText>Haz que tu estancia sea aún más especial</TranslatedText>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
              <TranslatedText>
                Desde preparar una celebración hasta organizar tus aventuras por Monteverde. Nosotros te ayudamos con los detalles.
              </TranslatedText>
            </p>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-[28px] shadow-lift lg:aspect-[5/6]">
            <TranslatedImage
              src="/assets/servicios/decoracion-propuesta-ok.webp"
              alt="Decoración para una ocasión especial dentro de un domo de Macas Moon, con vista al bosque de Monteverde"
              fill
              priority
              sizes="(min-width: 1024px) 42vw, 100vw"
              className="object-cover"
            />
          </div>
        </Container>
      </section>

      <section id="decoraciones" className="scroll-mt-[calc(var(--header-h)+1.25rem)] bg-sand-50">
        <Container className="py-16 sm:py-24 lg:py-28">
          <div className="grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-stretch lg:gap-16">
            <div>
              <h2 className="heading-section text-ink">
                <TranslatedText>¿Celebras algo especial en Monteverde?</TranslatedText>
              </h2>
              <div className="mt-6 space-y-5 text-base leading-relaxed text-muted">
                <p>
                  <TranslatedText>
                    Hay momentos que merecen ser recordados, y nos encantaría ayudarte a convertirlos en una experiencia aún más especial.
                  </TranslatedText>
                </p>
                <p>
                  <TranslatedText>
                    Contamos con servicio de decoración para ocasiones especiales, ideal para cumpleaños, aniversarios, celebraciones románticas, propuestas y otras fechas importantes.
                  </TranslatedText>
                </p>
                <p>
                  <TranslatedText>Podemos preparar detalles como:</TranslatedText>
                </p>
              </div>
              <ul className="mt-4 space-y-2 text-base text-ink">
                {decorationItems.map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-olive-500" aria-hidden="true" />
                    <TranslatedText>{item}</TranslatedText>
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-base leading-relaxed text-muted">
                <TranslatedText>
                  Cuéntanos qué quieres celebrar y nos encargaremos de preparar cada detalle para que, al llegar, encuentres un espacio pensado especialmente para ese momento.
                </TranslatedText>
              </p>
              <div className="mt-6">
                <ServiceNote>Servicio disponible con reserva previa.</ServiceNote>
              </div>
              <p className="mt-6 text-base leading-relaxed text-muted">
                <TranslatedText>
                  Porque algunas ocasiones no necesitan ser grandes para convertirse en recuerdos inolvidables.
                </TranslatedText>
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:flex lg:h-full lg:min-h-0 lg:flex-col">
              {decorationGallery.map((image) => (
                <div
                  key={image.src}
                  className="relative aspect-[4/3] min-h-0 overflow-hidden rounded-[24px] lg:aspect-auto lg:min-h-0 lg:flex-1"
                >
                  <TranslatedImage
                    src={image.src}
                    alt={image.alt}
                    fill
                    sizes="(min-width: 1024px) 48vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:mt-16">
            {decorationPackages.map((pack) => (
              <article
                key={pack.id}
                className="flex flex-col overflow-hidden rounded-[24px] border border-sand-300 bg-warm-white shadow-soft"
              >
                <div className="relative aspect-[16/10] overflow-hidden">
                  <TranslatedImage
                    src={pack.image}
                    alt={pack.alt}
                    fill
                    sizes="(min-width: 640px) 45vw, 100vw"
                    className="object-cover"
                  />
                </div>
                <div className="flex flex-1 flex-col px-6 py-7 sm:px-8 sm:py-8">
                  <h3 className="heading-card text-2xl text-ink">
                    <TranslatedText>{pack.title}</TranslatedText>
                  </h3>
                  <p className="mt-4 text-sm font-medium text-olive-800">
                    <TranslatedText>Incluye</TranslatedText>
                  </p>
                  <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-muted">
                    {pack.items.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-olive-500" aria-hidden="true" />
                        <TranslatedText>{item}</TranslatedText>
                      </li>
                    ))}
                  </ul>
                  <p className="heading-card mt-5 text-3xl text-olive-700">{pack.price}</p>
                  <div className="mt-6">
                    <WhatsAppCta message={pack.whatsapp} size="md">
                      {pack.cta}
                    </WhatsAppCta>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </Container>
      </section>

      <section id="tours" className="scroll-mt-[calc(var(--header-h)+1.25rem)] bg-sand-50">
        <Container className="py-16 sm:py-24 lg:py-28">
          <div className="rounded-[28px] border border-sand-300 bg-warm-white p-7 shadow-soft sm:p-12 lg:p-16">
            <h2 className="heading-section max-w-3xl text-ink">
              <TranslatedText>Descubre Monteverde, nosotros nos encargamos del resto</TranslatedText>
            </h2>
            <div className="mt-6 max-w-3xl space-y-5 text-base leading-relaxed text-muted">
              <p>
                <TranslatedText>
                  Queremos que aproveches al máximo tu visita a Monteverde. Por eso, ponemos a tu disposición nuestro servicio de organización y reserva de tours, sin ningún costo adicional.
                </TranslatedText>
              </p>
              <p>
                <TranslatedText>
                  Cuéntanos qué te gustaría vivir y nos encargamos de ayudarte a crear un itinerario a tu medida y gestionar tus reservas. Tú solo tendrás que elegir tus experiencias favoritas y disfrutar.
                </TranslatedText>
              </p>
            </div>

            <ul className="mt-10 grid gap-x-10 gap-y-4 sm:grid-cols-2">
              {tourExperiences.map((item) => (
                <li key={item} className="flex gap-3 text-base text-ink">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-olive-500" aria-hidden="true" />
                  <TranslatedText>{item}</TranslatedText>
                </li>
              ))}
            </ul>

            <div className="mt-10 max-w-2xl space-y-6">
              <ServiceNote>
                El pago de cada tour se realiza directamente con el proveedor de la actividad.
              </ServiceNote>
              <p className="text-base leading-relaxed text-muted">
                <TranslatedText>
                  Nuestro objetivo es hacer que planificar tu experiencia en Monteverde sea fácil, cómodo y sin complicaciones.
                </TranslatedText>
              </p>
              <p className="text-base leading-relaxed text-muted">
                <TranslatedText>
                  Déjanos ayudarte a descubrir todo lo que este mágico destino tiene para ofrecer.
                </TranslatedText>
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <WhatsAppCta message={serviceWhatsappMessages.tours}>
                  Ayúdame a planear mi experiencia
                </WhatsAppCta>
                <Button href="/experiencias" variant="outline" size="lg">
                  Ver todas las experiencias
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          </div>
        </Container>
      </section>

      <section id="masajes" className="scroll-mt-[calc(var(--header-h)+1.25rem)] bg-sand-50">
        <Container className="grid gap-12 py-16 sm:py-24 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-16 lg:py-28">
          <div className="relative aspect-[4/5] overflow-hidden rounded-[28px] sm:aspect-[4/3] lg:aspect-[4/5]">
            <TranslatedImage
              src="/assets/servicios/masaje-relajante.webp"
              alt="Masaje relajante coordinado durante la estancia en Macas Moon"
              fill
              sizes="(min-width: 1024px) 40vw, 100vw"
              className="object-cover object-top"
            />
          </div>
          <div>
            <h2 className="heading-section text-ink">
              <TranslatedText>Un momento para desconectar</TranslatedText>
            </h2>
            <div className="mt-6 space-y-5 text-base leading-relaxed text-muted">
              <p>
                <TranslatedText>
                  Durante tu estancia en Monteverde, también puedes disfrutar de un momento de relajación sin salir de tu alojamiento.
                </TranslatedText>
              </p>
              <p>
                <TranslatedText>
                  Contamos con servicio de masajes bajo reserva, realizado por profesionales, para que puedas regalarte un espacio de descanso y bienestar después de un día de aventuras.
                </TranslatedText>
              </p>
              <p>
                <TranslatedText>
                  Nos encargamos de coordinar la experiencia para ti, para que solo tengas que relajarte y disfrutar.
                </TranslatedText>
              </p>
            </div>
            <div className="mt-6">
              <ServiceNote>
                Servicio disponible con reserva previa y sujeto a disponibilidad.
              </ServiceNote>
            </div>
            <p className="mt-6 text-base leading-relaxed text-muted">
              <TranslatedText>
                Porque después de explorar Monteverde, también mereces un momento para simplemente parar, respirar y disfrutar.
              </TranslatedText>
            </p>
            <div className="mt-8">
              <WhatsAppCta message={serviceWhatsappMessages.massage}>Consultar masajes</WhatsAppCta>
            </div>
          </div>
        </Container>
      </section>

      <section className="bg-cream">
        <Container className="py-16 text-center sm:py-24 lg:py-28">
          <h2 className="heading-display text-ink">
            <TranslatedText>Tu estancia puede ser aún más especial</TranslatedText>
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-muted">
            <TranslatedText>
              Elige tu domo y cuéntanos si quieres una celebración, tours o un momento de descanso durante tu visita a Monteverde.
            </TranslatedText>
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button href="/reservar" size="lg">
              Reservar estancia
            </Button>
            <Link
              href="/#domos"
              className="inline-flex min-h-12 items-center gap-2 px-2 text-sm font-semibold text-olive-700"
            >
              <TranslatedText>Elegir domo</TranslatedText>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </Container>
      </section>
    </>
  );
}

import { Container } from "@/components/ui/Container";
import { FeatureIcon } from "@/components/ui/FeatureIcon";
import { SectionHeading } from "@/components/ui/SectionHeading";

export function IntroSection() {
  return (
    <section id="introduccion" className="home-screen bg-sand-50">
      <Container className="home-screen-inner py-16 sm:py-20 lg:py-0">
        <SectionHeading
          title="Una forma diferente de vivir Monteverde"
          description="Dos domos en medio del bosque, pensados para bajar el ritmo, mirar las nubes y quedarse un rato en silencio."
          className="max-w-3xl shrink-0"
        />
        <div className="mt-10 grid gap-12 sm:grid-cols-3 sm:gap-10 lg:mt-8">
          <FeatureIcon
            name="leaf"
            label="Naturaleza"
            text="Rodeado de bosque, aire fresco y tranquilidad."
          />
          <FeatureIcon
            name="home"
            label="Desconexión"
            text="Un espacio creado para desconectar del ritmo cotidiano."
          />
          <FeatureIcon
            name="mountain"
            label="Monteverde"
            text="Vive uno de los destinos naturales más especiales de Costa Rica."
          />
        </div>
      </Container>
    </section>
  );
}

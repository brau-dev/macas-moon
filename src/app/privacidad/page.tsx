import { PolicyContent } from "@/components/legal/PolicyContent";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({ path: "/privacidad", title: "Política de privacidad",
  description: "Información sobre el uso de los datos de las reservas y los medios de contacto de Macas Moon Glamping." });

export default function PrivacyPage() { return <PolicyContent kind="privacy" />; }

import { redirect } from "next/navigation";
import { adminSession } from "@/lib/admin-auth";
import { getAdminDomeOptions } from "@/lib/active-domes";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { missingCheckoutConfig } from "@/lib/checkout-config";
import { missingEmailConfig } from "@/lib/gmail-config.mjs";
import { getSiteOrigin } from "@/lib/site-origin";

export const runtime = "nodejs";

export default async function AdminPage() {
  if (!await adminSession()) redirect("/admin/login");
  return <AdminDashboard checkout={{ enabled: process.env.TILOPAY_CHECKOUT_ENABLED === "true",
    freeTest: process.env.NEXT_PUBLIC_BOOKING_TEST_MODE === "true",
    environment: process.env.TILOPAY_EXPECTED_ENVIRONMENT ?? "Sin definir", missing: missingCheckoutConfig(),
    emailMissing: missingEmailConfig(process.env) }}
    domes={getAdminDomeOptions()} siteOrigin={getSiteOrigin()} />;
}

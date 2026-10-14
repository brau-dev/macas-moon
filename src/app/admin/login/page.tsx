import { redirect } from "next/navigation";
import { adminConfigured, adminSession } from "@/lib/admin-auth";
import { AdminLogin } from "@/components/admin/AdminLogin";

export const runtime = "nodejs";

export default async function AdminLoginPage() {
  if (await adminSession()) redirect("/admin");
  return <AdminLogin configured={adminConfigured()} />;
}

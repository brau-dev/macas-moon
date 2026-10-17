import { NextResponse } from "next/server";
import { requireAdmin, requireSameOrigin } from "@/lib/admin-auth";
import { adminError, privateHeaders, readAdminJson } from "@/lib/admin-http";
import { changeNightPrices } from "@/lib/admin-pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function update(request: Request, restore: boolean) {
  try {
    requireSameOrigin(request);
    await requireAdmin();
    await changeNightPrices(await readAdminJson(request), process.env.ADMIN_USERNAME!, restore);
    return NextResponse.json({ ok: true }, { headers: privateHeaders });
  } catch (error) { return adminError(error); }
}

export async function PUT(request: Request) { return update(request, false); }
export async function DELETE(request: Request) { return update(request, true); }

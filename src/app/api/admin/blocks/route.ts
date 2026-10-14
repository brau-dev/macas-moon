import { NextResponse } from "next/server";
import { requireAdmin, requireSameOrigin } from "@/lib/admin-auth";
import { adminError, privateHeaders, readAdminJson } from "@/lib/admin-http";
import { createManualBlock } from "@/lib/admin-reservations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    await requireAdmin();
    const id = await createManualBlock(await readAdminJson(request));
    return NextResponse.json({ id }, { status: 201, headers: privateHeaders });
  } catch (error) { return adminError(error); }
}

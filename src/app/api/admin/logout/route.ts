import { NextResponse } from "next/server";
import { ADMIN_COOKIE, logoutAdmin, requireSameOrigin } from "@/lib/admin-auth";
import { adminError, privateHeaders } from "@/lib/admin-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    await logoutAdmin();
    const response = NextResponse.json({ ok: true }, { headers: privateHeaders });
    response.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV !== "development",
      sameSite: "strict", path: "/", maxAge: 0 });
    return response;
  } catch (error) { return adminError(error); }
}

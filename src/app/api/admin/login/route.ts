import { NextResponse } from "next/server";
import { ADMIN_COOKIE, SESSION_SECONDS, loginAdmin, requireSameOrigin } from "@/lib/admin-auth";
import { adminError, privateHeaders, readAdminJson } from "@/lib/admin-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const body = await readAdminJson(request);
    const token = await loginAdmin(body.username, body.password, request);
    const response = NextResponse.json({ ok: true }, { headers: privateHeaders });
    response.cookies.set(ADMIN_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV !== "development",
      sameSite: "strict", path: "/", maxAge: SESSION_SECONDS });
    return response;
  } catch (error) { return adminError(error); }
}

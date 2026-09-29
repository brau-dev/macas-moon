import { GET as getCalendar } from "../route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ dome: string; token: string }> }) {
  return getCalendar(request, context);
}

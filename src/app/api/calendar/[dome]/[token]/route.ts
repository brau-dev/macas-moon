// Legacy tokenized feed URL. Use /api/calendar/{dome}/calendar.ics instead.
export async function GET() {
  return new Response(null, { status: 404 });
}

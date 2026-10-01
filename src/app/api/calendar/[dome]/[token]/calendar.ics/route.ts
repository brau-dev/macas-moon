// Old tokenized links no longer export availability.
export async function GET() {
  return new Response(null, { status: 404 });
}

import { pingDatabase } from "@/shared/db/ping";

export const dynamic = "force-dynamic";

export async function GET() {
  const isUp = await pingDatabase(2000);
  return Response.json({ ok: isUp }, { status: isUp ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}

import { dispatch } from "@/lib/game";

// Clients POST actions here: join | clap | boo | start | reset (see Action in lib/game.ts).
export async function POST(request: Request) {
  const result = dispatch(await request.json().catch(() => null));
  return Response.json({ ok: !!result, ...result }, { status: result ? 200 : 400 });
}

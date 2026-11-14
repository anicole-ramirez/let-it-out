import { dispatch } from "@/lib/game";

// Phones POST actions here: {type:"join",id,party} | {type:"clap",id} | {type:"reset"}
export async function POST(request: Request) {
  const ok = dispatch(await request.json());
  return Response.json({ ok }, { status: ok ? 200 : 400 });
}

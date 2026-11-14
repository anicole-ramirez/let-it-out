import { connect, getState, subscribe, type State } from "@/lib/game";

// Server-Sent Events: pushes the full state to the projector screen and phones on every change.
// Phones pass ?id= so the server knows which players are still connected.
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  const enc = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream({
    start(controller) {
      const send = (s: State) =>
        controller.enqueue(enc.encode(`data: ${JSON.stringify(s)}\n\n`));
      const unsubscribe = subscribe(send);
      const disconnect = id ? connect(id) : () => {};
      send(getState());
      const ping = setInterval(
        () => controller.enqueue(enc.encode(": ping\n\n")),
        15000,
      );
      let done = false;
      cleanup = () => {
        if (done) return;
        done = true;
        unsubscribe();
        clearInterval(ping);
        disconnect();
      };
      request.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {}
      });
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

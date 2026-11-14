import { getState, subscribe, type State } from "@/lib/game";

// Server-Sent Events: pushes the full state to the projector screen (and phones) on every change.
export async function GET(request: Request) {
  const enc = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream({
    start(controller) {
      const send = (s: State) =>
        controller.enqueue(enc.encode(`data: ${JSON.stringify(s)}\n\n`));
      send(getState());
      const unsubscribe = subscribe(send);
      const ping = setInterval(
        () => controller.enqueue(enc.encode(": ping\n\n")),
        15000,
      );
      cleanup = () => {
        unsubscribe();
        clearInterval(ping);
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

"use client";
import { useEffect, useState } from "react";
import { connect, dispatch, getState, subscribe, type Action, type State } from "./game";

export const COLORS = { orange: "#C8693A", blue: "#3A8CB0" } as const;
export const SHADE = { orange: "#8E4526", blue: "#25607C" } as const;
export const GOLD = "#C9A43A";

// Static build (GitHub Pages): no server, the game runs in this tab and only single player works.
export const STATIC = process.env.NEXT_PUBLIC_STATIC === "1";
// Prefix for files in public/ (the static build is served from a subpath).
export const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

// Per-tab id that survives reloads (crypto.randomUUID needs HTTPS, the LAN server has none).
export function getId() {
  let id = sessionStorage.getItem("id");
  if (!id) {
    id = Math.random().toString(36).slice(2);
    sessionStorage.setItem("id", id);
  }
  return id;
}

// Live game state, from the server (EventSource reconnects on its own) or, in the static
// build, from the game running in this tab. The id lets the game track who is connected.
export function useGameState() {
  const [state, setState] = useState<State | null>(null);
  useEffect(() => {
    if (STATIC) {
      // The game mutates one object: copy it so React sees a new state.
      const update = (s: State) => setState(structuredClone(s));
      const unsubscribe = subscribe(update);
      const disconnect = connect(getId());
      update(getState());
      return () => {
        unsubscribe();
        disconnect();
      };
    }
    const es = new EventSource(`/api/events?id=${getId()}`);
    es.onmessage = (e) => setState(JSON.parse(e.data));
    return () => es.close();
  }, []);
  return state;
}

export async function send(action: Action): Promise<{ right?: boolean } | null> {
  if (STATIC) return dispatch(action);
  return (await fetch("/api/action", { method: "POST", body: JSON.stringify(action) })).json();
}

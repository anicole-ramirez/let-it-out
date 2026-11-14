"use client";
import { useEffect, useState } from "react";
import type { Action, State } from "./game";

export const COLORS = { orange: "#e8833a", purple: "#7b3fc4" } as const;

// Live game state from the server (EventSource reconnects on its own).
export function useGameState() {
  const [state, setState] = useState<State | null>(null);
  useEffect(() => {
    const es = new EventSource("/api/events");
    es.onmessage = (e) => setState(JSON.parse(e.data));
    return () => es.close();
  }, []);
  return state;
}

export const send = (action: Action) =>
  fetch("/api/action", { method: "POST", body: JSON.stringify(action) });

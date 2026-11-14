"use client";
import { useEffect, useState } from "react";
import type { Action, State } from "./game";

export const COLORS = { orange: "#e8833a", purple: "#7b3fc4" } as const;

// Live game state from the server (EventSource reconnects on its own).
// Phones pass their id so the server can track who is connected.
export function useGameState(getId?: () => string) {
  const [state, setState] = useState<State | null>(null);
  useEffect(() => {
    const es = new EventSource(`/api/events${getId ? `?id=${getId()}` : ""}`);
    es.onmessage = (e) => setState(JSON.parse(e.data));
    return () => es.close();
  }, [getId]);
  return state;
}

export const send = (action: Action) =>
  fetch("/api/action", { method: "POST", body: JSON.stringify(action) });

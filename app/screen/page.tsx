"use client";
import { useEffect, useState } from "react";
import { COLORS, send, useGameState } from "@/lib/client";
import { PARTIES } from "@/lib/game";

// Projector view: join URL, player counts and one clap bar per party.
export default function Screen() {
  const state = useGameState();
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  if (!state) return <main style={{ padding: "2rem" }}>Connecting…</main>;

  const max = Math.max(20, ...PARTIES.map((p) => state.claps[p]));
  const players = Object.values(state.players);

  return (
    <main style={{ height: "100dvh", boxSizing: "border-box", display: "flex", flexDirection: "column", padding: "2rem", gap: "1rem" }}>
      <h1 style={{ margin: 0 }}>Let it out!</h1>
      <div style={{ fontSize: "2rem" }}>
        Join on your phone: <b>{origin}</b>
      </div>
      <div style={{ flex: 1, display: "flex", gap: "2rem" }}>
        {PARTIES.map((p) => (
          <div key={p} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
            <div style={{ fontSize: "2rem" }}>
              {p}: {state.claps[p]} claps, {players.filter((x) => x.party === p).length} players
            </div>
            <div
              style={{
                height: `${(state.claps[p] / max) * 90}%`,
                minHeight: 4,
                background: COLORS[p],
                transition: "height 0.1s",
              }}
            />
          </div>
        ))}
      </div>
      <button style={{ alignSelf: "flex-start" }} onClick={() => send({ type: "reset" })}>
        Reset
      </button>
    </main>
  );
}

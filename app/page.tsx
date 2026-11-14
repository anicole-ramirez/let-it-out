"use client";
import { useState } from "react";
import { COLORS, send, useGameState } from "@/lib/client";
import { PARTIES, type Party } from "@/lib/game";

// Phone view: pick a party, then tap to clap.
// crypto.randomUUID needs HTTPS, which the LAN dev server does not have.
const id = Math.random().toString(36).slice(2);

export default function Phone() {
  const state = useGameState();
  const [party, setParty] = useState<Party | null>(null);
  // Server forgets players on restart/reset: fall back to the party picker.
  const joined = party && state?.players[id];

  if (!joined)
    return (
      <main style={{ display: "flex", flexDirection: "column", height: "100dvh" }}>
        {PARTIES.map((p) => (
          <button
            key={p}
            style={{ flex: 1, background: COLORS[p], color: "#fff", fontSize: "2rem", border: 0 }}
            onClick={() => {
              setParty(p);
              send({ type: "join", id, party: p });
            }}
          >
            Join {p}
          </button>
        ))}
      </main>
    );

  return (
    <main style={{ height: "100dvh" }}>
      <button
        style={{
          width: "100%",
          height: "100%",
          background: COLORS[party],
          color: "#fff",
          fontSize: "4rem",
          border: 0,
          touchAction: "manipulation",
          userSelect: "none",
        }}
        onPointerDown={() => send({ type: "clap", id })}
      >
        CLAP
        <div style={{ fontSize: "1.5rem" }}>{state.claps[party]}</div>
      </button>
    </main>
  );
}

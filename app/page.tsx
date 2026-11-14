"use client";
import { useState, type CSSProperties } from "react";
import { COLORS, send, useGameState } from "@/lib/client";
import { PARTIES } from "@/lib/game";

// Phone view: pick a party, then clap or boo while watching the projector.
// Per-tab id that survives reloads (crypto.randomUUID needs HTTPS, the LAN server has none).
function getId() {
  let id = sessionStorage.getItem("id");
  if (!id) {
    id = Math.random().toString(36).slice(2);
    sessionStorage.setItem("id", id);
  }
  return id;
}

const full: CSSProperties = {
  height: "100dvh",
  display: "flex",
  flexDirection: "column",
  color: "#fff",
  textAlign: "center",
};
const big: CSSProperties = {
  flex: 1,
  border: 0,
  color: "#fff",
  fontSize: "3rem",
  fontWeight: 700,
  touchAction: "manipulation",
  userSelect: "none",
};
const center: CSSProperties = { ...full, justifyContent: "center", fontSize: "2rem", padding: "1rem", boxSizing: "border-box" };

export default function Phone() {
  const state = useGameState();
  const [wrong, setWrong] = useState(false);
  if (!state) return <main style={{ padding: "2rem" }}>Connecting…</main>;

  const party = state.players[getId()]?.party;

  if (!party)
    return (
      <main style={full}>
        {PARTIES.map((p) => (
          <button
            key={p}
            style={{ ...big, background: COLORS[p] }}
            onClick={() => send({ type: "join", id: getId(), party: p })}
          >
            Join {p}
          </button>
        ))}
      </main>
    );

  if (state.phase === "lobby")
    return (
      <main style={{ ...center, background: COLORS[party] }}>
        You are {party}.
        <br />
        Watch the big screen!
      </main>
    );

  if (state.phase === "ended") {
    const w = state.winner;
    return (
      <main style={{ ...center, background: COLORS[party] }}>
        {w === null ? "Draw!" : w === party ? "You won!" : "You lost!"}
      </main>
    );
  }

  // A wrong reaction flashes red and buzzes, so you notice without looking down.
  const react = async (type: "clap" | "boo") => {
    const r = await (await send({ type, id: getId() })).json();
    if (r.right === false) {
      navigator.vibrate?.(80);
      setWrong(true);
      setTimeout(() => setWrong(false), 200);
    }
  };

  return (
    <main style={{ ...full, background: wrong ? "#d00" : COLORS[party] }}>
      <button style={{ ...big, background: "transparent" }} onPointerDown={() => react("clap")}>
        👏 CLAP
        <div style={{ fontSize: "1rem", fontWeight: 400 }}>when {party} speaks</div>
      </button>
      <button style={{ ...big, background: "rgba(0,0,0,0.45)" }} onPointerDown={() => react("boo")}>
        👎 BOO
        <div style={{ fontSize: "1rem", fontWeight: 400 }}>when the other party speaks</div>
      </button>
    </main>
  );
}

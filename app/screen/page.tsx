"use client";
import { useEffect, useState } from "react";
import { COLORS, send, useGameState } from "@/lib/client";
import { PARTIES, type Speaker, type State } from "@/lib/game";

// Projector view: tug-of-war bar, debate stage with stick figures, audience.
const FIG = { ...COLORS, moderator: "#444" } as const;
const button = { fontSize: "2rem", padding: "0.5rem 2rem" } as const;

function StickFigure({ color, lectern }: { color: string; lectern?: boolean }) {
  return (
    <svg viewBox="0 0 60 100" style={{ height: "100%" }} stroke={color} strokeWidth={4} strokeLinecap="round" fill="none">
      <circle cx={30} cy={14} r={10} />
      <path d="M30 24V60M30 34L12 48M30 34L48 48M30 60L16 92M30 60L44 92" />
      {lectern && <rect x={10} y={50} width={40} height={46} fill={color} />}
    </svg>
  );
}

// One bar, like a rope: the knot moves toward the side that is winning.
function Rope({ state }: { state: State }) {
  return (
    <div style={{ position: "relative", height: 48, borderRadius: 24, background: `linear-gradient(90deg, ${COLORS.orange} 50%, ${COLORS.purple} 50%)` }}>
      <div style={{ position: "absolute", left: "50%", top: -6, bottom: -6, width: 2, background: "#000" }} />
      <div
        style={{
          position: "absolute",
          left: `${50 + (state.rope / state.goal) * 50}%`,
          top: -10,
          bottom: -10,
          width: 20,
          marginLeft: -10,
          borderRadius: 10,
          background: "#fff",
          border: "4px solid #000",
          boxSizing: "border-box",
          transition: "left 0.15s",
        }}
      />
    </div>
  );
}

const HINT: Record<Speaker, string> = {
  orange: "Orange: clap! Purple: boo!",
  purple: "Purple: clap! Orange: boo!",
  moderator: "Quiet! Do not touch your phone.",
};

function Lobby({ count }: { count: number }) {
  const [join, setJoin] = useState<{ url: string; qr: string } | null>(null);
  useEffect(() => {
    fetch("/api/join").then((r) => r.json()).then(setJoin);
  }, []);
  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1rem", fontSize: "2rem" }}>
      {join && (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt="Join QR code" style={{ flex: 1, minHeight: 0 }} src={`data:image/svg+xml;utf8,${encodeURIComponent(join.qr)}`} />
      )}
      <div>
        Scan to join, or open <b>{join?.url}</b>
      </div>
      <button style={button} disabled={count === 0} onClick={() => send({ type: "start" })}>
        {count === 0 ? "Waiting for players…" : `Start (${count} joined)`}
      </button>
    </div>
  );
}

function Stage({ state }: { state: State }) {
  const on = (who: Speaker) => state.phase !== "playing" || state.speaker === who;
  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
      <div style={{ flex: 1, minHeight: 0, width: "100%", display: "flex", justifyContent: "space-around", alignItems: "flex-end" }}>
        {(["orange", "moderator", "purple"] as Speaker[]).map((who) => (
          <div
            key={who}
            style={{
              height: who === "moderator" ? "70%" : "100%",
              opacity: on(who) ? 1 : 0.15,
              transform: state.speaker === who ? "scale(1.1)" : "none",
              transition: "opacity 0.2s, transform 0.2s",
            }}
          >
            <StickFigure color={FIG[who]} lectern={who !== "moderator"} />
          </div>
        ))}
      </div>
      {state.phase === "playing" && state.speaker && (
        <div style={{ fontSize: "2.5rem", fontWeight: 700 }}>{HINT[state.speaker]}</div>
      )}
      {state.phase === "ended" && (
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <b style={{ fontSize: "3.5rem", color: state.winner ? COLORS[state.winner] : "#000" }}>
            {state.winner ? `${state.winner.toUpperCase()} WINS!` : "DRAW!"}
          </b>
          <button style={button} onClick={() => send({ type: "start" })}>
            Play again
          </button>
          <button style={button} onClick={() => send({ type: "reset" })}>
            Reset game
          </button>
        </div>
      )}
    </div>
  );
}

export default function Screen() {
  const state = useGameState();
  if (!state) return <main style={{ padding: "2rem" }}>Connecting…</main>;

  const players = Object.values(state.players);

  return (
    <main style={{ height: "100dvh", boxSizing: "border-box", display: "flex", flexDirection: "column", padding: "2rem", gap: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: "2rem" }}>
        <b>Let it out!</b>
        <b style={{ fontSize: "3rem" }}>0:{String(state.timeLeft).padStart(2, "0")}</b>
      </div>
      <Rope state={state} />
      {state.phase === "lobby" ? <Lobby count={players.length} /> : <Stage state={state} />}
      {/* Audience: one small figure per joined phone, split by party. */}
      <div style={{ height: "12%", display: "flex", justifyContent: "space-between" }}>
        {PARTIES.map((p) => (
          <div key={p} style={{ display: "flex", height: "100%" }}>
            {players.filter((x) => x.party === p).map((_, i) => (
              <StickFigure key={i} color={COLORS[p]} />
            ))}
          </div>
        ))}
      </div>
    </main>
  );
}

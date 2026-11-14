"use client";
import { useEffect, useState, type CSSProperties } from "react";
import { COLORS, send, useGameState } from "@/lib/client";
import { PARTIES, type Party, type Speaker, type State } from "@/lib/game";
import { useSounds } from "@/lib/sound";

// Projector view: tug-of-war bar, debate stage with stick figures, audience.
const FIG = { ...COLORS, moderator: "#444" } as const;
const button: CSSProperties = { fontSize: "2rem", padding: "0.75rem 2rem", background: "#222", color: "#fff" };
const quiet: CSSProperties = { ...button, background: "#ddd", color: "#222" };
const panel: CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "1rem",
  padding: "1rem",
  borderRadius: 24,
  fontSize: "2rem",
  textAlign: "center",
};

function StickFigure({ color, lectern }: { color: string; lectern?: boolean }) {
  return (
    <svg viewBox="0 0 60 100" style={{ height: "100%" }} stroke={color} strokeWidth={4} strokeLinecap="round" fill="none">
      <circle cx={30} cy={14} r={10} />
      <path d="M30 24V60M30 34L12 48M30 34L48 48M30 60L16 92M30 60L44 92" />
      {lectern && <rect x={10} y={50} width={40} height={46} fill={color} />}
    </svg>
  );
}

// One bar: each party's colour fills its share, so the bigger colour is winning.
// 50/50 at the start; a party that fills the whole bar wins instantly.
function Rope({ state }: { state: State }) {
  const orange = 50 - (state.rope / state.goal) * 50;
  const pct = { orange: Math.round(orange), purple: 100 - Math.round(orange) };
  return (
    <div style={{ position: "relative", height: 56, borderRadius: 28, overflow: "hidden", background: COLORS.purple, color: "#fff", fontSize: "1.75rem", fontWeight: 800 }}>
      <div style={{ position: "absolute", inset: 0, width: `${orange}%`, background: COLORS.orange, borderRight: "4px solid #fff", boxSizing: "border-box", transition: "width 0.15s" }} />
      <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 2, background: "rgba(0,0,0,0.4)" }} />
      <div style={{ position: "absolute", inset: 0, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 1.5rem" }}>
        {PARTIES.map((p) => (
          <span key={p}>
            {p.toUpperCase()} {pct[p]}%
          </span>
        ))}
      </div>
    </div>
  );
}

// What each party must do for the current speaker.
const todo = (party: Party, speaker: Speaker) =>
  speaker === "moderator" ? "QUIET" : speaker === party ? "CLAP" : "BOO";

function Lobby({ state, count }: { state: State; count: number }) {
  const [join, setJoin] = useState<{ url: string; qr: string } | null>(null);
  useEffect(() => {
    fetch("/api/join").then((r) => r.json()).then(setJoin);
  }, []);
  if (!state.mode)
    return (
      <div style={panel}>
        <b style={{ fontSize: "3rem" }}>How do you want to play?</b>
        <div style={{ display: "flex", gap: "2rem" }}>
          <button style={{ ...button, padding: "2rem 3rem" }} onClick={() => send({ type: "mode", mode: "single" })}>
            Single player
            <div style={{ fontSize: "1.25rem" }}>you against the computer</div>
          </button>
          <button style={{ ...button, padding: "2rem 3rem" }} onClick={() => send({ type: "mode", mode: "multi" })}>
            Multiplayer
            <div style={{ fontSize: "1.25rem" }}>orange against purple</div>
          </button>
        </div>
      </div>
    );
  return (
    <div style={{ ...panel, flexDirection: "row", gap: "3rem", textAlign: "left" }}>
      {join && (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt="Join QR code" style={{ alignSelf: "stretch", aspectRatio: "1", minHeight: 0, minWidth: 0 }} src={`data:image/svg+xml;utf8,${encodeURIComponent(join.qr)}`} />
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", alignItems: "flex-start" }}>
        <div>
          <b>1.</b> Scan to join, or open <b>{join?.url}</b>
        </div>
        <div>
          <b>2.</b> Pick a party on your phone{state.mode === "single" && ". The computer plays the other one"}.
        </div>
        <div>
          <b>3.</b> Clap your politician, boo the other one, stay quiet for the moderator.
        </div>
        <div style={{ display: "flex", gap: "1rem" }}>
          <button style={button} disabled={count === 0} onClick={() => send({ type: "start" })}>
            {count === 0 ? "Waiting for players…" : `Start (${count} joined)`}
          </button>
          <button style={quiet} onClick={() => send({ type: "reset" })}>
            Back
          </button>
        </div>
      </div>
    </div>
  );
}

function Stage({ state }: { state: State }) {
  // While playing, the whole stage takes the speaker's colour ("camera" on them):
  // the speaker is big and white, the others shrink into the background.
  const live = state.phase === "playing" ? state.speaker : null;
  const voters = Object.values(state.players).filter((p) => p.online);
  return (
    <div style={{ ...panel, justifyContent: "flex-start", background: live ? FIG[live] : "transparent", transition: "background 0.2s" }}>
      {live && (
        <div style={{ fontSize: "4rem", fontWeight: 800, color: "#fff", lineHeight: 1 }}>
          {live === "moderator" ? "MODERATOR SPEAKS" : `${live.toUpperCase()} SPEAKS`}
        </div>
      )}
      {state.phase === "ended" && (
        <b style={{ fontSize: "5rem", lineHeight: 1, color: state.winner ? COLORS[state.winner] : "#000" }}>
          {state.winner ? `${state.winner.toUpperCase()} WINS!` : "DRAW!"}
        </b>
      )}
      <div style={{ flex: 1, minHeight: 0, width: "100%", display: "flex", justifyContent: "space-around", alignItems: "flex-end" }}>
        {(["orange", "moderator", "purple"] as Speaker[]).map((who) => (
          <div
            key={who}
            style={{
              height: live ? (live === who ? "100%" : "35%") : state.winner === who ? "100%" : "60%",
              opacity: live ? (live === who ? 1 : 0.3) : !state.winner || state.winner === who ? 1 : 0.3,
              transition: "height 0.2s, opacity 0.2s",
            }}
          >
            <StickFigure color={live ? "#fff" : FIG[who]} lectern={who !== "moderator"} />
          </div>
        ))}
      </div>
      {live && (
        <div style={{ width: "100%", display: "flex", justifyContent: "space-between", gap: "1rem" }}>
          {PARTIES.map((p) => (
            <div key={p} style={{ padding: "0.5rem 1.5rem", borderRadius: 16, background: "#fff", color: COLORS[p], fontSize: "3rem", fontWeight: 800 }}>
              {p.toUpperCase()}: {todo(p, live)}
            </div>
          ))}
        </div>
      )}
      {state.phase === "ended" && (
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <span>
            Tap <b>Play again</b> on your phone ({voters.filter((p) => p.ready).length}/{voters.length} ready)
          </span>
          <button style={button} onClick={() => send({ type: "start" })}>
            Start now
          </button>
          <button style={quiet} onClick={() => send({ type: "reset" })}>
            Reset game
          </button>
        </div>
      )}
    </div>
  );
}

export default function Screen() {
  const state = useGameState();
  useSounds(state);
  if (!state) return <main style={{ padding: "2rem", fontSize: "2rem" }}>Connecting…</main>;

  const players = Object.values(state.players);
  const count = players.filter((p) => p.online).length;
  const inRound = state.phase === "playing" || state.phase === "ended";

  return (
    <main style={{ height: "100dvh", boxSizing: "border-box", display: "flex", flexDirection: "column", padding: "2rem", gap: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: "2rem" }}>
        <b>Let it out!</b>
        {/* Timer turns red for the last 5 seconds. */}
        <b style={{ fontSize: "3rem", color: state.phase === "playing" && state.timeLeft <= 5 ? "#d00" : "#000", visibility: inRound ? "visible" : "hidden" }}>
          0:{String(state.timeLeft).padStart(2, "0")}
        </b>
      </div>
      <Rope state={state} />
      {state.phase === "lobby" && <Lobby state={state} count={count} />}
      {state.phase === "countdown" && (
        <div style={{ ...panel, background: "#222", color: "#fff" }}>
          <div>Get ready! Watch this screen, not your phone.</div>
          <b style={{ fontSize: "12rem", lineHeight: 1 }}>{state.countdown}</b>
        </div>
      )}
      {inRound && <Stage state={state} />}
      {/* Audience: one small figure per joined phone, split by party; disconnected phones fade. */}
      <div style={{ height: "12%", display: "flex", justifyContent: "space-between" }}>
        {PARTIES.map((p, i) => (
          <div key={p} style={{ display: "flex", flexDirection: i ? "row-reverse" : "row", height: "100%", alignItems: "center", gap: "0.5rem", fontSize: "1.5rem", fontWeight: 700, color: COLORS[p] }}>
            {state.bot === p ? "COMPUTER" : players.filter((x) => x.party === p && x.online).length}
            {state.phase !== "lobby" && state.weight[p] > 1 && ` (each tap x${+state.weight[p].toFixed(1)})`}
            {players.filter((x) => x.party === p).map((x, j) => (
              <div key={j} style={{ height: "100%", opacity: x.online ? 1 : 0.25 }}>
                <StickFigure color={COLORS[p]} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </main>
  );
}

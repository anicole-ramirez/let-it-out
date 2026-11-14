"use client";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { COLORS, send, useGameState } from "@/lib/client";
import { PARTIES, type Party } from "@/lib/game";

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

const big: CSSProperties = { flex: 1, borderRadius: 0, color: "#fff", fontSize: "3rem", fontWeight: 700 };
const small: CSSProperties = { fontSize: "1rem", fontWeight: 400 };

// Full-height page with an optional "You are ORANGE" strip.
function Frame({ party, row, children }: { party?: Party; row?: boolean; children: ReactNode }) {
  return (
    <main style={{ height: "100dvh", display: "flex", flexDirection: "column", background: "#222", color: "#fff", textAlign: "center" }}>
      <div style={{ padding: "0.5rem", fontSize: "1.25rem", fontWeight: 700 }}>
        {party ? (
          <>
            You are <span style={{ color: COLORS[party] }}>{party.toUpperCase()}</span>
          </>
        ) : (
          "Let it out!"
        )}
      </div>
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: row ? "row" : "column",
          justifyContent: "center",
          gap: row ? 0 : "1.5rem",
          padding: row ? 0 : "1.5rem",
          fontSize: "1.75rem",
        }}
      >
        {children}
      </div>
    </main>
  );
}

export default function Phone() {
  const state = useGameState(getId);
  const [wrong, setWrong] = useState(false);
  // The vote button appears under the thumbs of people still tapping, so it
  // only becomes active a moment after the round ends.
  const [armed, setArmed] = useState(false);
  const ended = state?.phase === "ended";
  useEffect(() => {
    if (!ended) return setArmed(false);
    const t = setTimeout(() => setArmed(true), 1500);
    return () => clearTimeout(t);
  }, [ended]);
  if (!state) return <Frame>Connecting…</Frame>;

  const id = getId();
  const me = state.players[id];
  const online = Object.values(state.players).filter((p) => p.online);

  if (!me)
    return (
      <Frame>
        Pick your party
        {PARTIES.map((p) => {
          const n = online.filter((x) => x.party === p).length;
          return (
            <button key={p} style={{ ...big, borderRadius: 16, background: COLORS[p] }} onClick={() => send({ type: "join", id, party: p })}>
              {p.toUpperCase()}
              <div style={small}>{n === 1 ? "1 player" : `${n} players`}</div>
            </button>
          );
        })}
      </Frame>
    );

  const { party } = me;
  const other: Party = party === "orange" ? "purple" : "orange";

  if (state.phase === "lobby")
    return (
      <Frame party={party}>
        <b>You are in!</b>
        <div>Look at the big screen. The round starts soon.</div>
        <div style={small}>
          Tap {party.toUpperCase()} to clap when your politician speaks, {other.toUpperCase()} to boo the other one. Hands off during the moderator.
        </div>
      </Frame>
    );

  if (state.phase === "countdown")
    return (
      <Frame party={party}>
        <div>Get ready, eyes on the big screen!</div>
        <b style={{ fontSize: "8rem", lineHeight: 1 }}>{state.countdown}</b>
      </Frame>
    );

  if (state.phase === "ended") {
    const w = state.winner;
    return (
      <Frame party={party}>
        <b style={{ fontSize: "3rem", color: w ? COLORS[w] : "#fff" }}>{w === null ? "Draw!" : w === party ? "You won!" : "You lost!"}</b>
        {me.ready ? (
          <div>
            Waiting for the others… ({online.filter((p) => p.ready).length}/{online.length} ready)
          </div>
        ) : (
          <button style={{ ...big, flex: "none", padding: "2rem", borderRadius: 16, fontSize: "2rem", background: COLORS[party] }} disabled={!armed} onClick={() => send({ type: "vote", id })}>
            Play again
          </button>
        )}
      </Frame>
    );
  }

  // A wrong reaction flashes both buttons red and buzzes, so you notice without looking down.
  const react = async (type: "clap" | "boo") => {
    const r = await (await send({ type, id })).json();
    if (r.right === false) {
      navigator.vibrate?.(80);
      setWrong(true);
      setTimeout(() => setWrong(false), 200);
    }
  };

  // Each button has the colour of the party it applies to: press the colour the big screen shows.
  return (
    <Frame party={party} row>
      <button style={{ ...big, background: wrong ? "#d00" : COLORS[party] }} onPointerDown={() => react("clap")}>
        CLAP
        <div style={small}>when {party} speaks</div>
      </button>
      <button style={{ ...big, background: wrong ? "#d00" : COLORS[other] }} onPointerDown={() => react("boo")}>
        BOO
        <div style={small}>when {other} speaks</div>
      </button>
    </Frame>
  );
}

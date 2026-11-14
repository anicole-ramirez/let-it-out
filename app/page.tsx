"use client";
import { useEffect, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { COLORS, STATIC, getId, send, useGameState } from "@/lib/client";
import { PARTIES, type Party } from "@/lib/game";
import Screen from "./screen/page";

// Phone view: pick a party, then clap or boo while watching the projector.
// The static build has no server for phones: there this page is the screen.
export default function Home() {
  return STATIC ? <Screen /> : <Phone />;
}

// Ripple from the touch point (plain DOM: it removes itself when the animation ends).
function ripple(e: PointerEvent<HTMLButtonElement>) {
  const box = e.currentTarget.getBoundingClientRect();
  const dot = document.createElement("span");
  dot.className = "ripple";
  dot.style.left = `${e.clientX - box.left}px`;
  dot.style.top = `${e.clientY - box.top}px`;
  dot.addEventListener("animationend", () => dot.remove());
  e.currentTarget.appendChild(dot);
}

const big: CSSProperties = { position: "relative", overflow: "hidden", flex: 1, fontSize: "3rem", boxShadow: "none" };
const small: CSSProperties = { fontFamily: "VT323", fontSize: "1.4rem", fontWeight: 400, textTransform: "none" };

// Full-height page with a "You are ORANGE" strip; `row` = the two game buttons side by side.
function Frame({ party, row, alarm, children }: { party?: Party; row?: boolean; alarm?: boolean; children: ReactNode }) {
  return (
    <main style={{ height: "100dvh", display: "flex", flexDirection: "column", background: "var(--grain), var(--wall)", textAlign: "center", boxSizing: "border-box", border: alarm ? "8px solid var(--error)" : "8px solid var(--ink)" }}>
      <div className="silk" style={{ padding: "0.5rem", fontSize: "1.1rem", background: "var(--ink)", color: "var(--gold)" }}>
        {party ? (
          <>
            You are <span style={{ color: COLORS[party] }}>{party}</span>
          </>
        ) : (
          "Let it out!"
        )}
      </div>
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: row ? "row" : "column", justifyContent: "center", gap: row ? 0 : "1.2rem", padding: row ? 0 : "1.2rem", fontSize: "1.9rem", lineHeight: 1.1 }}>
        {children}
      </div>
    </main>
  );
}

function Phone() {
  const state = useGameState();
  const [wrong, setWrong] = useState(false);
  const [name, setName] = useState(() => (typeof window === "undefined" ? "" : localStorage.getItem("name") ?? ""));
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
        <input
          autoFocus
          placeholder="Your name"
          maxLength={12}
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ font: "inherit", padding: "0.6rem", border: "5px solid var(--ink)", borderRadius: 0, background: "var(--paper)", color: "var(--ink)", textAlign: "center" }}
        />
        {name.trim() ? "Pick your party" : "Type your name first"}
        {PARTIES.map((p) => {
          const n = online.filter((x) => x.party === p).length;
          return (
            <button
              key={p}
              style={{ ...big, boxShadow: "5px 5px 0 #000", background: COLORS[p] }}
              disabled={!name.trim()}
              onClick={() => {
                localStorage.setItem("name", name.trim());
                send({ type: "join", id, party: p, name });
              }}
            >
              {p}
              <div style={small}>{n === 1 ? "1 player" : `${n} players`}</div>
            </button>
          );
        })}
      </Frame>
    );

  const { party } = me;
  const other: Party = party === "orange" ? "blue" : "orange";

  if (state.phase === "lobby")
    return (
      <Frame party={party}>
        <b className="silk">You are in!</b>
        <div>Look at the big screen. The round starts soon.</div>
        <div className="panel silk" style={{ fontSize: "1.3rem", padding: "0.8rem", lineHeight: 1.4 }}>
          Tap the colour of the background.
          <br />
          Stop when the moderator speaks.
        </div>
      </Frame>
    );

  if (state.phase === "countdown")
    return (
      <Frame party={party}>
        <div>Get ready, eyes on the big screen!</div>
        <b key={state.countdown} className="silk punch" style={{ fontSize: "9rem", lineHeight: 1 }}>
          {state.countdown}
        </b>
      </Frame>
    );

  if (state.phase === "ended") {
    const w = state.winner;
    return (
      <Frame party={party}>
        <b className="silk" style={{ fontSize: "2.6rem", color: w ? COLORS[w] : "var(--cream)" }}>
          {w === null ? "Draw!" : w === party ? "You won!" : "You lost!"}
        </b>
        <div className="panel" style={{ padding: "0.8rem" }}>
          {me.name}: <b>{me.right}</b> good taps{me.wrong > 0 && `, ${me.wrong} wrong`}
        </div>
        {me.ready ? (
          <div>
            Waiting for the others… ({online.filter((p) => p.ready).length}/{online.length} ready)
          </div>
        ) : (
          <button style={{ ...big, flex: "none", padding: "1.6rem", fontSize: "2rem", boxShadow: "5px 5px 0 #000", background: "var(--gold)" }} disabled={!armed} onClick={() => send({ type: "vote", id })}>
            Play again
          </button>
        )}
      </Frame>
    );
  }

  // A wrong reaction turns the frame and both buttons red and buzzes, so you notice without looking down.
  const react = async (type: "clap" | "boo", e: PointerEvent<HTMLButtonElement>) => {
    ripple(e);
    const r = await send({ type, id });
    if (r?.right === false) {
      navigator.vibrate?.(80);
      setWrong(true);
      setTimeout(() => setWrong(false), 200);
    }
  };

  // Each button has the colour of the party it applies to: press the colour the big screen shows.
  // Only the first finger on the screen counts (isPrimary); the server also drops taps faster than one finger can make.
  return (
    <Frame party={party} row alarm={wrong}>
      <button style={{ ...big, background: wrong ? "var(--error)" : COLORS[party] }} onPointerDown={(e) => e.isPrimary && react("clap", e)}>
        Clap
        <div style={small}>when {party} speaks</div>
      </button>
      <button style={{ ...big, background: wrong ? "var(--error)" : COLORS[other] }} onPointerDown={(e) => e.isPrimary && react("boo", e)}>
        Boo
        <div style={small}>when {other} speaks</div>
      </button>
    </Frame>
  );
}

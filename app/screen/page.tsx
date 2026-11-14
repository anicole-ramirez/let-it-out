"use client";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
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

// Plays a short one-off animation on its box every time `on` changes (a tap landed, the bar moved).
function Pop({ on, frames, ms = 150, style, children }: { on: unknown; frames: Keyframe[]; ms?: number; style?: CSSProperties; children?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current) ref.current?.animate(frames, ms);
    mounted.current = true;
  }, [on, frames, ms]);
  return (
    <div ref={ref} style={style}>
      {children}
    </div>
  );
}
const HOP: Keyframe[] = [{ transform: "translateY(0)" }, { transform: "translateY(-45%)" }, { transform: "translateY(0)" }];
const SHAKE: Keyframe[] = [{ transform: "translateX(-20%)" }, { transform: "translateX(20%)" }, { transform: "translateX(-10%)" }, { transform: "translateX(0)" }];
const BUMP: Keyframe[] = [{ transform: "scaleY(1.25)" }, { transform: "scaleY(1)" }];
const FLASH: Keyframe[] = [{ opacity: 0.6 }, { opacity: 0 }];

// talking: bobs, waves an arm and moves the mouth. shh: finger to the lips (moderator).
function StickFigure({ color, lectern, talking, shh }: { color: string; lectern?: boolean; talking?: boolean; shh?: boolean }) {
  return (
    <svg viewBox="0 0 60 100" className={talking || shh ? "bob" : undefined} style={{ height: "100%", overflow: "visible" }} stroke={color} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <circle cx={30} cy={14} r={10} />
      <path d="M30 24V60M30 34L12 48M30 60L16 92M30 60L44 92" />
      <path className={talking ? "wave" : undefined} style={{ transformOrigin: "30px 34px" }} d={shh ? "M30 34L44 32L33 18" : "M30 34L48 48"} />
      {talking && <ellipse className="mouth" style={{ transformOrigin: "30px 18px" }} cx={30} cy={18} rx={3.5} ry={2.5} fill={color} stroke="none" />}
      {lectern && <rect x={10} y={50} width={40} height={46} fill={color} />}
    </svg>
  );
}

// Winner-coloured confetti over the whole screen at the end of a round.
function Confetti({ color }: { color: string }) {
  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      {Array.from({ length: 40 }, (_, i) => (
        <div
          key={i}
          className="confetti"
          style={{ left: `${(i * 37) % 100}%`, background: i % 3 ? color : "#222", animationDuration: `${2 + (i % 5) * 0.4}s`, animationDelay: `${(i % 10) * 0.15}s` }}
        />
      ))}
    </div>
  );
}

// One bar: each party's colour fills its share, so the bigger colour is winning.
// 50/50 at the start; a party that fills the whole bar wins instantly.
function Rope({ state }: { state: State }) {
  const orange = 50 - (state.rope / state.goal) * 50;
  const pct = { orange: Math.round(orange), purple: 100 - Math.round(orange) };
  const playing = state.phase === "playing";
  const leader = orange >= 75 ? "orange" : orange <= 25 ? "purple" : null;
  return (
    <Pop on={state.rope} frames={BUMP} ms={120}>
    <div
      className={playing && leader ? "glow" : undefined}
      style={{ position: "relative", height: 56, borderRadius: 28, overflow: "hidden", background: COLORS.purple, color: "#fff", fontSize: "1.75rem", fontWeight: 800, ["--glow" as string]: leader ? COLORS[leader] : "transparent" }}
    >
      <div style={{ position: "absolute", inset: 0, width: `${orange}%`, background: COLORS.orange, transition: "width 0.15s" }} />
      <div className={playing ? "wobble" : undefined} style={{ position: "absolute", left: `${orange}%`, top: 0, bottom: 0, width: 4, marginLeft: -2, background: "#fff", transition: "left 0.15s" }} />
      <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 2, background: "rgba(0,0,0,0.4)" }} />
      <div style={{ position: "absolute", inset: 0, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 1.5rem" }}>
        {PARTIES.map((p) => (
          <span key={p}>
            {p.toUpperCase()} {pct[p]}%
          </span>
        ))}
      </div>
    </div>
    </Pop>
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

// End of round: taps per player, best first.
function Scores({ state }: { state: State }) {
  return (
    <div style={{ flex: 1, minHeight: 0, width: "100%", display: "flex", gap: "3rem", overflow: "hidden" }}>
      {PARTIES.map((p) => (
        <div key={p} style={{ flex: 1, textAlign: "left", color: COLORS[p] }}>
          <b>{p.toUpperCase()}</b>
          {state.bot === p && <div>Computer</div>}
          {Object.values(state.players)
            .filter((x) => x.party === p)
            .sort((a, b) => b.right - a.right)
            .map((x, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", borderTop: "2px solid #ddd" }}>
                <span>{x.name}</span>
                <span>
                  <b>{x.right}</b> taps{x.wrong > 0 && `, ${x.wrong} wrong`}
                </span>
              </div>
            ))}
        </div>
      ))}
    </div>
  );
}

// translateX (% of the 150%-wide row) that centres each speaker on the stage.
const PAN: Record<Speaker, number> = { orange: 16.667, moderator: -16.667, purple: -50 };

function Stage({ state }: { state: State }) {
  // While playing, the whole stage takes the speaker's colour ("camera" on them):
  // the speaker is big and white, the others shrink into the background.
  const live = state.phase === "playing" ? state.speaker : null;
  const voters = Object.values(state.players).filter((p) => p.online);
  const wrong = (p: Party) => Object.values(state.players).reduce((n, x) => n + (x.party === p ? x.wrong : 0), 0);
  return (
    <div style={{ ...panel, position: "relative", overflow: "hidden", justifyContent: "flex-start", background: live ? FIG[live] : "transparent", transition: "background 0.2s" }}>
      {/* A wrong tap flashes that party's half of the stage red. */}
      {PARTIES.map((p, i) => (
        <Pop key={p} on={wrong(p)} frames={FLASH} ms={300} style={{ position: "absolute", top: 0, bottom: 0, [i ? "right" : "left"]: 0, width: "50%", background: "#d00", opacity: 0, pointerEvents: "none" }} />
      ))}
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
      {state.phase === "ended" && <Scores state={state} />}
      {/* The camera pans: the row is wider than the stage and slides until the speaker is centred. */}
      <div style={{ flex: 1, minHeight: 0, width: "100%", display: live ? "block" : "none" }}>
        <div style={{ height: "100%", width: "150%", display: "flex", transform: `translateX(${PAN[live ?? "moderator"]}%)`, transition: "transform 0.45s cubic-bezier(0.2, 0.8, 0.2, 1)" }}>
          {(["orange", "moderator", "purple"] as Speaker[]).map((who) => (
            <div key={who} style={{ flex: 1, height: "100%", display: "flex", justifyContent: "center", alignItems: "flex-end" }}>
              <div style={{ height: live === who ? "100%" : "35%", opacity: live === who ? 1 : 0.3, transition: "height 0.3s, opacity 0.3s" }}>
                <StickFigure color="#fff" lectern={who !== "moderator"} talking={live === who && who !== "moderator"} shh={live === who && who === "moderator"} />
              </div>
            </div>
          ))}
        </div>
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
          <b key={state.countdown} className="punch" style={{ fontSize: "12rem", lineHeight: 1 }}>
            {state.countdown}
          </b>
        </div>
      )}
      {inRound && <Stage state={state} />}
      {state.phase === "ended" && state.winner && <Confetti color={COLORS[state.winner]} />}
      {/* Audience: one small figure per joined phone, split by party; disconnected phones fade. */}
      <div style={{ height: "12%", display: "flex", justifyContent: "space-between" }}>
        {PARTIES.map((p, i) => (
          <div key={p} style={{ display: "flex", flexDirection: i ? "row-reverse" : "row", height: "100%", alignItems: "center", gap: "0.5rem", fontSize: "1.5rem", fontWeight: 700, color: COLORS[p] }}>
            {state.bot === p ? "COMPUTER" : players.filter((x) => x.party === p && x.online).length}
            {state.phase !== "lobby" && state.weight[p] > 1 && ` (each tap x${+state.weight[p].toFixed(1)})`}
            {Object.entries(state.players).filter(([, x]) => x.party === p).map(([id, x], j) => (
              <div key={id} style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", fontSize: "1rem", opacity: x.online ? 1 : 0.25 }}>
                {/* Each figure hops on its player's right taps and shakes on wrong ones; winners keep jumping. */}
                <div className={state.phase === "ended" && state.winner === p ? "jump" : undefined} style={{ flex: 1, minHeight: 0, animationDelay: `${j * 0.1}s` }}>
                  <Pop on={x.right} frames={HOP} style={{ height: "100%" }}>
                    <Pop on={x.wrong} frames={SHAKE} ms={200} style={{ height: "100%" }}>
                      <StickFigure color={COLORS[p]} />
                    </Pop>
                  </Pop>
                </div>
                {x.name}
              </div>
            ))}
          </div>
        ))}
      </div>
    </main>
  );
}

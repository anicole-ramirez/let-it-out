"use client";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { COLORS, GOLD, SHADE, send, useGameState } from "@/lib/client";
import { PARTIES, type Party, type Speaker, type State } from "@/lib/game";
import { HAIR, PixelSprite, SLOTS, type SpriteName } from "@/lib/PixelSprite";
import { play, unlock, useSounds } from "@/lib/sound";
import THROWABLES from "@/lib/throwables.json";

// Projector view: everything happens inside an old TV. HUD (timer + one bar) on top, then
// the lobby form, the countdown, the debate studio or the results newspaper.

const INK = "var(--ink)";
const silk: CSSProperties = { fontFamily: "Silkscreen, monospace", fontWeight: 700, textTransform: "uppercase" };
const center: CSSProperties = { flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "2vh", padding: "3vh 3vw" };
const btn: CSSProperties = { fontSize: "3vh", padding: "1vh 2vw" };
const other = (p: Party): Party => (p === "orange" ? "blue" : "orange");
const share = (state: State) => {
  const orange = Math.round(50 - (state.rope / state.goal) * 50);
  return { orange, blue: 100 - orange };
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
const QUAKE: Keyframe[] = [{ transform: "translateX(-8px)" }, { transform: "translateX(8px)" }, { transform: "translateX(-8px)" }, { transform: "translateX(0)" }];
const BUMP: Keyframe[] = [{ transform: "scaleY(1.25)" }, { transform: "scaleY(1)" }];
const FLASH: Keyframe[] = [{ opacity: 1 }, { opacity: 0 }];

// Flips between false and true every `ms`: the idle/talk sprite swap.
function useFlip(ms: number) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setOn((v) => !v), ms);
    return () => clearInterval(t);
  }, [ms]);
  return on;
}

// One bar: orange fills from the left, blue is the rest, so the bigger colour is winning.
// 50/50 at the start; a party that fills the whole bar wins instantly.
function Bar({ state }: { state: State }) {
  const orange = 50 - (state.rope / state.goal) * 50;
  const pct = share(state);
  const playing = state.phase === "playing";
  const leader = orange >= 75 ? "orange" : orange <= 25 ? "blue" : null;
  const square = (p: Party) => <div style={{ width: "3.5vh", height: "3.5vh", background: COLORS[p], border: `4px solid ${INK}`, flex: "none" }} />;
  return (
    <div style={{ width: "100%", display: "flex", alignItems: "center", gap: "1.2vw" }}>
      {square("orange")}
      <Pop on={state.rope} frames={BUMP} ms={120} style={{ flex: 1 }}>
        <div
          className={playing && leader ? "glow" : undefined}
          style={{ ...silk, position: "relative", height: "5vh", background: COLORS.blue, border: `5px solid ${INK}`, outline: "4px solid #6B5A44", color: "var(--cream)", fontSize: "2.6vh", ["--glow" as string]: leader ? COLORS[leader] : "transparent" }}
        >
          <div style={{ position: "absolute", inset: 0, width: `${orange}%`, background: COLORS.orange, transition: "width 0.15s" }} />
          <div className={playing ? "wobble" : undefined} style={{ position: "absolute", left: `${orange}%`, top: 0, bottom: 0, width: 6, marginLeft: -3, background: "var(--cream)", transition: "left 0.15s" }} />
          <div style={{ position: "absolute", inset: 0, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 1vw", textShadow: "2px 2px 0 #000" }}>
            {PARTIES.map((p) => (
              <span key={p}>{pct[p]}%</span>
            ))}
          </div>
        </div>
      </Pop>
      {square("blue")}
    </div>
  );
}

// Names of everyone who joined, per party; disconnected phones are dimmed. With `scores`, taps
// per player (wrong ones in red). The text shrinks and splits into columns to fit 20+ players a side.
function Roster({ state, scores }: { state: State; scores?: boolean }) {
  const lists = PARTIES.map((p) => Object.values(state.players).filter((x) => x.party === p).sort((a, b) => b.right - a.right));
  const most = Math.max(1, ...lists.map((l) => l.length));
  const cols = Math.ceil(most / (scores ? 8 : 6));
  const size = scores ? [3.6, 2.8, 2.3, 1.9][Math.min(cols, 4) - 1] : [3.2, 2.6, 2.2, 1.9][Math.min(cols, 4) - 1];
  return (
    <div style={{ flex: 1, minHeight: 0, width: "100%", display: "flex", gap: "2vw", overflow: "hidden", fontSize: `${size}vh`, lineHeight: 1.15 }}>
      {PARTIES.map((p, i) => (
        <div key={p} style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...silk, fontSize: "2.2vh", color: SHADE[p], borderBottom: `3px solid ${INK}` }}>
            {p} camp ({lists[i].length}){state.weight[p] > 1 && scores && ` · taps x${+state.weight[p].toFixed(1)}`}
          </div>
          {state.bot === p && <div>The computer</div>}
          <div style={{ columnCount: Math.min(cols, 4), columnGap: "1.5vw" }}>
            {lists[i].map((x, j) => (
              <div key={j} style={{ display: "flex", justifyContent: "space-between", gap: "0.5vw", opacity: x.online ? 1 : 0.4, breakInside: "avoid" }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.name}</span>
                {scores && (
                  <span style={{ whiteSpace: "nowrap" }}>
                    <b>{x.right}</b>
                    {cols === 1 && " taps"}
                    {x.wrong > 0 && <span style={{ color: "var(--brick)" }}> −{x.wrong}</span>}
                  </span>
                )}
              </div>
            ))}
          </div>
          {lists[i].length === 0 && state.bot !== p && <div style={{ opacity: 0.5 }}>nobody yet</div>}
        </div>
      ))}
    </div>
  );
}

function HowTo({ size }: { size: string }) {
  return (
    <div style={{ ...silk, fontSize: size, lineHeight: 1.25 }}>
      <div>
        Tap the <span style={{ color: SHADE.orange }}>colour</span> of the <span style={{ color: SHADE.blue }}>background</span>.
      </div>
      <div>
        Stop when the <span style={{ background: "#5E5A52", color: "var(--cream)", padding: "0 0.4em" }}>moderator</span> speaks.
      </div>
    </div>
  );
}

function Lobby({ state, count }: { state: State; count: number }) {
  const [join, setJoin] = useState<{ url: string; qr: string } | null>(null);
  useEffect(() => {
    fetch("/api/join").then((r) => r.json()).then(setJoin);
  }, []);
  if (!state.mode)
    return (
      <div style={center}>
        <div className="panel" style={{ ...center, flex: "none", fontSize: "3.5vh" }}>
          <b style={{ ...silk, fontSize: "5vh" }}>How do you want to play?</b>
          <div style={{ display: "flex", gap: "2vw" }}>
            <button style={{ ...btn, padding: "3vh 3vw" }} onClick={() => send({ type: "mode", mode: "single" })}>
              Single player
              <div style={{ fontFamily: "VT323", fontWeight: 400, textTransform: "none" }}>you against the computer</div>
            </button>
            <button style={{ ...btn, padding: "3vh 3vw" }} onClick={() => send({ type: "mode", mode: "multi" })}>
              Multiplayer
              <div style={{ fontFamily: "VT323", fontWeight: 400, textTransform: "none" }}>orange against blue</div>
            </button>
          </div>
        </div>
      </div>
    );
  return (
    <div style={center}>
      <div className="panel" style={{ width: "92%", height: "100%", boxSizing: "border-box", padding: "2vh 2vw", display: "flex", gap: "2.5vw", fontSize: "3.6vh", lineHeight: 1.1 }}>
        {join && (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="Join QR code" style={{ alignSelf: "center", height: "100%", maxWidth: "36%", aspectRatio: "1", minHeight: 0, minWidth: 0, border: `5px solid ${INK}`, imageRendering: "pixelated" }} src={`data:image/svg+xml;utf8,${encodeURIComponent(join.qr)}`} />
        )}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "1.2vh" }}>
          <div>
            Scan to join, or open <b>{join?.url}</b>
            {state.mode === "single" && ". The computer plays the other party."}
          </div>
          <HowTo size="4.4vh" />
          <Roster state={state} />
          <div style={{ display: "flex", gap: "1vw" }}>
            <button style={{ ...btn, background: GOLD }} disabled={count === 0} onClick={() => send({ type: "start" })}>
              {count === 0 ? "Waiting for players…" : `Start (${count} joined)`}
            </button>
            <button style={btn} onClick={() => send({ type: "reset" })}>
              Back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Countdown({ state }: { state: State }) {
  return (
    <div style={{ ...center, background: "var(--void)", fontSize: "4vh" }}>
      <div>Get ready! Watch this screen, not your phone.</div>
      <b key={state.countdown} className="punch" style={{ ...silk, fontSize: "28vh", lineHeight: 1 }}>
        {state.countdown}
      </b>
    </div>
  );
}

const SPRITE: Record<Speaker, [SpriteName, SpriteName]> = {
  orange: ["cand_a_idle", "cand_a_talk"],
  blue: ["cand_b_idle", "cand_b_talk"],
  moderator: ["moderator_idle", "moderator_talk"],
};
// Where each character stands (% from the left); the spotlight follows the speaker.
const SPOT: Record<Speaker, number> = { orange: 22, moderator: 50, blue: 78 };

const tag: CSSProperties = { ...silk, display: "block", position: "relative", zIndex: 1, padding: "0 0.2vw", boxShadow: "none", borderWidth: 2, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

// The audience from behind: one figure per joined phone (orange left, blue right) with a name
// tag; each hops on its player's right taps and shakes on wrong ones. Grey extras fill the rest.
function Crowd({ state }: { state: State }) {
  const entries = Object.entries(state.players);
  const extra = (i: number, p?: Party, style?: CSSProperties) => (
    <PixelSprite key={i} name="crowd_back" style={style ?? { width: "100%", height: "auto" }} slots={{ C: p ? COLORS[p] : "#6E6A60", c: p ? SHADE[p] : "#4E4A42", H: HAIR[i % HAIR.length][0], h: HAIR[i % HAIR.length][1] }} />
  );
  return (
    <div style={{ height: "27%", position: "relative", background: INK, overflow: "hidden" }}>
      <div style={{ position: "absolute", top: "4%", left: 0, right: 0, height: "42%", display: "flex", justifyContent: "space-around", filter: "brightness(0.5)" }}>
        {Array.from({ length: 22 }, (_, i) => extra(i * 3, i < 8 ? "orange" : i > 13 ? "blue" : undefined, {}))}
      </div>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "1vw", padding: "0 1vw" }}>
        {PARTIES.map((p, i) => (
          <div key={p} style={{ width: "47%", display: "flex", flexDirection: i ? "row-reverse" : "row", alignItems: "flex-end" }}>
            {state.bot === p && (
              <div style={{ width: "6.5vw" }}>
                <b className="panel" style={{ ...tag, fontSize: "1.8vh" }}>CPU</b>
                {extra(2, p)}
              </div>
            )}
            {entries.filter(([, x]) => x.party === p).map(([id, x], j, all) => (
              // Up to 7 figures a side at full size; beyond that they share the width.
              <div key={id} style={{ flex: "0 1 6.5vw", minWidth: 0, opacity: x.online ? 1 : 0.3 }}>
                <b className="panel" style={{ ...tag, fontSize: all.length > 14 ? "1.2vh" : all.length > 7 ? "1.5vh" : "1.8vh" }}>{x.name}</b>
                <Pop on={x.right} frames={HOP}>
                  <Pop on={x.wrong} frames={SHAKE} ms={200}>
                    {extra(j, p)}
                  </Pop>
                </Pop>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// What the crowd throws (drawings from the second design, pitch/second design.html).
const BOOED = ["tomato", "can", "egg", "shoe", "banana", "paper"] as const;
const CHEERED = ["bouquet", "rose", "bra", "teddy", "heart", "laurel"] as const;

// Wide shot of the studio: both candidates and the moderator are always visible; the speaker
// is lit by the spotlight and talks, the others are dimmed. No text: the whole set takes the
// colour of the phone button to tap.
function Stage({ state }: { state: State }) {
  const live = state.speaker ?? "moderator";
  const talk = useFlip(180);
  const wrongs = Object.values(state.players).reduce((n, x) => n + x.wrong, 0);
  const x = SPOT[live];
  // Every time the bar moves, the side that gained throws something at the speaker from its part
  // of the crowd: flowers and teddies for its own candidate, tomatoes and shoes for the other one.
  // At most one throw per 100 ms and 24 in the air.
  const air = useRef<HTMLDivElement>(null);
  const seen = useRef({ rope: state.rope, at: 0 });
  useEffect(() => {
    const moved = state.rope - seen.current.rope;
    seen.current.rope = state.rope;
    const box = air.current;
    const now = performance.now();
    if (!moved || !box || live === "moderator" || now - seen.current.at < 100 || box.childElementCount >= 24) return;
    seen.current.at = now;
    const from: Party = moved < 0 ? "orange" : "blue";
    const kinds = from === live ? CHEERED : BOOED;
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    const { width: w, height: h } = box.getBoundingClientRect();
    const size = h * 0.16;
    const sx = (from === "orange" ? 0.04 + Math.random() * 0.2 : 0.76 + Math.random() * 0.2) * w;
    const dx = (SPOT[live] / 100 + (Math.random() - 0.5) * 0.08) * w - sx;
    const dy = -h * (0.45 + Math.random() * 0.15);
    const item = document.createElement("div");
    item.style.cssText = `position:absolute;left:${sx - size / 2}px;top:${h - size / 2}px;width:${size}px;height:${size}px`;
    item.innerHTML = `<svg viewBox="0 0 120 120" width="100%" height="100%"><g transform="rotate(${Math.round(Math.random() * 60 - 30)} 60 60)">${THROWABLES[kind]}</g></svg>`;
    box.appendChild(item);
    // Arc up to the speaker, then drop and fade.
    item.animate(
      [
        { transform: "translate(0, 0)" },
        { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - h * 0.2}px)` },
        { transform: `translate(${dx}px, ${dy}px)` },
        { transform: `translate(${dx}px, ${dy + h * 0.14}px)`, opacity: 0 },
      ],
      { duration: 900, easing: "ease-in" },
    ).onfinish = () => item.remove();
  }, [state.rope, live]);
  // The curtains take the colour of the button to tap; grey for the moderator (no button is grey).
  const [c1, c2] = live === "moderator" ? ["#5E5A52", "#4E4A42"] : [COLORS[live], SHADE[live]];
  return (
    // Any wrong tap: the studio shakes and a red frame flashes.
    <Pop on={wrongs} frames={QUAKE} ms={300} style={{ flex: 1, minWidth: 0, position: "relative", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, minHeight: 0, position: "relative", overflow: "hidden", background: `repeating-linear-gradient(90deg, ${c1} 0 5vw, ${c2} 5vw 10vw)` }}>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "9%", background: "var(--floor)", borderTop: `5px solid ${INK}` }} />
        <div style={{ position: "absolute", inset: 0, background: "rgba(232, 224, 200, 0.2)", clipPath: `polygon(${x - 4}% 0, ${x + 4}% 0, ${x + 16}% 100%, ${x - 16}% 100%)`, transition: "clip-path 0.3s" }} />
        <div style={{ position: "absolute", left: 0, right: 0, top: "8%", bottom: "4%" }}>
          {(["orange", "moderator", "blue"] as Speaker[]).map((who) => {
            const on = live === who;
            return (
              <div key={who} style={{ position: "absolute", bottom: 0, left: `${SPOT[who]}%`, height: who === "moderator" ? "72%" : "100%", transform: "translateX(-50%)", filter: on ? "none" : "brightness(0.5)", transition: "filter 0.3s" }}>
                <div className={on ? "bob" : undefined} style={{ position: "relative", height: "100%" }}>
                  <PixelSprite name={SPRITE[who][on && talk ? 1 : 0]} slots={SLOTS[who]} flip={who === "blue"} />
                  {who !== "moderator" && (
                    <div style={{ position: "absolute", bottom: 0, height: "94%", [who === "orange" ? "left" : "right"]: "104%" }}>
                      <PixelSprite name="mic_stand" />
                    </div>
                  )}
                </div>
                {who === "moderator" && <div style={{ position: "absolute", left: "-25%", right: "-25%", bottom: 0, height: "36%", background: "#3A332C", border: `5px solid ${INK}` }} />}
              </div>
            );
          })}
        </div>
      </div>
      <Crowd state={state} />
      <div ref={air} style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }} />
      <Pop on={wrongs} frames={FLASH} ms={300} style={{ position: "absolute", inset: 0, border: "10px solid var(--error)", opacity: 0, pointerEvents: "none" }} />
    </Pop>
  );
}

// Winner-coloured confetti over the whole screen at the end of a round.
function Confetti({ color }: { color: string }) {
  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      {Array.from({ length: 40 }, (_, i) => (
        <div key={i} className="confetti" style={{ left: `${(i * 37) % 100}%`, background: i % 3 ? color : "#E8E0C8", animationDuration: `${2 + (i % 5) * 0.4}s`, animationDelay: `${(i % 10) * 0.15}s` }} />
      ))}
    </div>
  );
}

// Results as a newspaper front page, kept bare: masthead, headline, photo, per-player tally, rematch.
function Newspaper({ state }: { state: State }) {
  const pct = share(state);
  const w = state.winner;
  const lead = w ? pct[w] - 50 : 0;
  const headline = !w ? "Debate ends in deadlock" : `${w} ${lead > 25 ? "wins in landslide" : lead > 10 ? "takes the debate" : "wins photo finish"}`;
  const voters = Object.values(state.players).filter((p) => p.online);
  return (
    <div style={{ ...center, background: "var(--void)", padding: "2.5vh" }}>
      <div style={{ transform: "rotate(-1.2deg)", width: "88%", height: "96%", boxSizing: "border-box", padding: "2vh 3vw", background: "#EAE4CE", color: INK, boxShadow: "10px 10px 0 #000", fontFamily: "'Old Standard TT', serif", display: "flex", flexDirection: "column", gap: "1.5vh" }}>
        <div style={{ fontFamily: "UnifrakturMaguntia, serif", fontSize: "6vh", lineHeight: 1, textAlign: "center", borderBottom: `3px double ${INK}`, paddingBottom: "1vh" }}>The Daily Debate</div>
        <b style={{ fontSize: "9vh", lineHeight: 1, textAlign: "center", textTransform: "uppercase", color: w ? SHADE[w] : INK }}>{headline}</b>
        <div style={{ flex: 1, minHeight: 0, display: "flex", gap: "3vw" }}>
          <div style={{ width: "32%", boxSizing: "border-box", border: `4px solid ${INK}`, background: "#CFC8AE", filter: "grayscale(1) contrast(1.1)", display: "flex", justifyContent: "space-around", alignItems: "flex-end", padding: "1vh 1vw 0", overflow: "hidden" }}>
            <div style={{ width: "46%" }}>
              <PixelSprite name={w === "orange" ? "cand_a_talk" : "cand_a_idle"} slots={SLOTS.orange} style={{ width: "100%", height: "auto" }} />
            </div>
            <div style={{ width: "46%" }}>
              <PixelSprite name={w === "blue" ? "cand_b_talk" : "cand_b_idle"} slots={SLOTS.blue} flip style={{ width: "100%", height: "auto" }} />
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "1.5vh", fontSize: "4vh", lineHeight: 1.2 }}>
            <Roster state={state} scores />
            <div style={{ display: "flex", alignItems: "center", gap: "1vw", fontSize: "3vh" }}>
              <span style={{ flex: 1 }}>
                Tap <b>Play again</b> on your phone ({voters.filter((p) => p.ready).length}/{voters.length} ready)
              </span>
              <button style={{ ...btn, fontSize: "2.4vh" }} onClick={() => send({ type: "start" })}>
                Rematch now
              </button>
              <button style={{ ...btn, fontSize: "2.4vh" }} onClick={() => send({ type: "reset" })}>
                Menu
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// The designer's intro animation (public/intro.html) plays in a frame over the start screen
// until any key or tap ("PRESS ANY KEY TO TUNE IN"). Then the camera dives into the TV and the
// game's own TV switches on underneath.
function Intro({ onLeave, onDone }: { onLeave: () => void; onDone: () => void }) {
  const ref = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const frame = ref.current;
    if (!frame) return;
    let left = false;
    const leave = () => {
      if (left) return;
      left = true;
      play("knock", { rate: 0.7 });
      onLeave();
      frame
        .animate([{ transform: "scale(1)", opacity: 1 }, { transform: "scale(5)", opacity: 1, offset: 0.7 }, { transform: "scale(8)", opacity: 0 }], { duration: 800, easing: "cubic-bezier(0.7, 0, 0.8, 0.3)", fill: "forwards" })
        .finished.then(onDone);
    };
    const hook = () => {
      const doc = frame.contentDocument;
      if (!doc?.head) return;
      doc.head.insertAdjacentHTML("beforeend", "<style>#replay{display:none}</style>");
      doc.addEventListener("keydown", leave, true);
      doc.addEventListener("pointerdown", leave);
    };
    // The intro tells us when the logo knocks on the glass and when the screen breaks.
    const sound = (e: MessageEvent) => {
      if (e.origin !== location.origin) return;
      if (e.data?.intro === "knock") play("knock");
      if (e.data?.intro === "break") play("crack");
    };
    hook();
    frame.addEventListener("load", hook);
    window.addEventListener("keydown", leave);
    window.addEventListener("message", sound);
    return () => {
      frame.removeEventListener("load", hook);
      window.removeEventListener("keydown", leave);
      window.removeEventListener("message", sound);
    };
  }, [onLeave, onDone]);
  // The zoom aims at the TV screen inside the intro picture.
  return <iframe ref={ref} src="/intro.html" title="Intro" style={{ position: "fixed", inset: 0, width: "100%", height: "100%", border: 0, zIndex: 10, transformOrigin: "46.6% 50.6%" }} />;
}

export default function Screen() {
  const state = useGameState();
  useSounds(state);
  // Start-up on a fresh game: click to start (unlocks sound) -> intro -> dive into the TV -> game.
  const [boot, setBoot] = useState<"gate" | "intro" | "leaving" | "game">("gate");
  const leaveIntro = useCallback(() => setBoot("leaving"), []);
  const endIntro = useCallback(() => setBoot("game"), []);
  if (!state) return <main style={{ padding: "2rem", fontSize: "2rem" }}>Connecting…</main>;

  const count = Object.values(state.players).filter((p) => p.online).length;
  const inRound = state.phase === "playing" || state.phase === "ended";
  const hurry = state.phase === "playing" && state.timeLeft < 10;
  const fresh = state.phase === "lobby" && !state.mode;

  return (
    <main style={{ height: "100dvh", boxSizing: "border-box", padding: "1.5vh", background: "var(--void)" }}>
      {/* The TV: bezel, HUD strip, then the current screen, all under the CRT glass. */}
      <div className={boot === "leaving" ? "crt-on" : undefined} style={{ position: "relative", height: "100%", boxSizing: "border-box", border: "22px solid #3A332C", borderRadius: 30, overflow: "hidden", background: "var(--wall)", display: "flex", flexDirection: "column" }}>
        <div style={{ background: INK, padding: "1vh 2vw 1.6vh", display: "flex", flexDirection: "column", gap: "1vh" }}>
          <div style={{ ...silk, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "2.4vh", color: GOLD }}>
            <span style={{ flex: 1, visibility: inRound ? "hidden" : "visible" }}>Let it out!</span>
            {/* Timer turns red for the last 10 seconds. */}
            <b style={{ fontSize: "4.6vh", lineHeight: 1, padding: "0.4vh 1.5vw", border: `5px solid ${hurry ? "var(--error)" : "var(--cream)"}`, color: hurry ? "var(--error)" : "var(--cream)", visibility: inRound ? "visible" : "hidden" }}>
              0:{String(state.timeLeft).padStart(2, "0")}
            </b>
            <span style={{ flex: 1, textAlign: "right", visibility: inRound ? "hidden" : "visible" }}>
              {count} {count === 1 ? "player" : "players"} · CH 01
            </span>
          </div>
          <Bar state={state} />
        </div>
        <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
          {state.phase === "lobby" && <Lobby state={state} count={count} />}
          {state.phase === "countdown" && <Countdown state={state} />}
          {state.phase === "playing" && <Stage state={state} />}
          {state.phase === "ended" && <Newspaper state={state} />}
        </div>
        <div className="crt" />
      </div>
      {state.phase === "ended" && state.winner && <Confetti color={COLORS[state.winner]} />}
      {fresh && boot === "gate" && (
        <div style={{ ...center, position: "fixed", inset: 0, zIndex: 10, background: "var(--void)" }}>
          <button
            style={{ ...btn, fontSize: "5vh", padding: "3vh 4vw", background: GOLD }}
            onClick={() => {
              unlock();
              setBoot("intro");
            }}
          >
            Click to start
          </button>
        </div>
      )}
      {fresh && (boot === "intro" || boot === "leaving") && <Intro onLeave={leaveIntro} onDone={endIntro} />}
    </main>
  );
}

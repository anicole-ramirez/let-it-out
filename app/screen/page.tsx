"use client";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { COLORS, GOLD, SHADE, send, useGameState } from "@/lib/client";
import { PARTIES, type Party, type Speaker, type State } from "@/lib/game";
import { HAIR, PixelSprite, SLOTS, type SpriteName } from "@/lib/PixelSprite";
import { useSounds } from "@/lib/sound";

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
const FLOAT: Keyframe[] = [{ opacity: 1, transform: "translateY(0)" }, { opacity: 0, transform: "translateY(-50px)" }];

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
              <span key={p}>
                {p} {pct[p]}%
              </span>
            ))}
          </div>
        </div>
      </Pop>
      {square("blue")}
    </div>
  );
}

// Names of everyone who joined, per party; disconnected phones are dimmed.
function Roster({ state, scores }: { state: State; scores?: boolean }) {
  return (
    <div style={{ flex: 1, minHeight: 0, width: "100%", display: "flex", gap: "2vw", overflow: "hidden" }}>
      {PARTIES.map((p) => {
        const list = Object.values(state.players).filter((x) => x.party === p).sort((a, b) => b.right - a.right);
        return (
          <div key={p} style={{ flex: 1, minWidth: 0 }}>
            <div style={{ ...silk, color: SHADE[p], borderBottom: `3px solid ${INK}` }}>
              {p} camp{state.weight[p] > 1 && scores && ` · taps x${+state.weight[p].toFixed(1)}`}
            </div>
            {state.bot === p && <div>The computer</div>}
            {list.map((x, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: "1vw", opacity: x.online ? 1 : 0.4 }}>
                <span>{x.name}</span>
                {scores && (
                  <span>
                    <b>{x.right}</b> taps{x.wrong > 0 && `, ${x.wrong} wrong`}
                  </span>
                )}
              </div>
            ))}
            {list.length === 0 && state.bot !== p && <div style={{ opacity: 0.5 }}>nobody yet</div>}
          </div>
        );
      })}
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
          <b style={{ ...silk, fontSize: "2.6vh", borderBottom: `3px solid ${INK}` }}>Form 01 · Party registration</b>
          <div>
            <b>1.</b> Scan to join, or open <b>{join?.url}</b>
          </div>
          <div>
            <b>2.</b> Type your name and pick a party{state.mode === "single" && ". The computer plays the other one"}.
          </div>
          <div>
            <b>3.</b> Clap your candidate, boo the other one, stay quiet for the moderator.
          </div>
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
  const chip = (text: string, bg: string) => <b style={{ ...silk, background: bg, color: INK, border: `4px solid ${INK}`, padding: "0.3vh 1vw" }}>{text}</b>;
  return (
    <div style={{ ...center, background: "var(--void)", fontSize: "4vh" }}>
      <div>Get ready! Watch this screen, not your phone.</div>
      <b key={state.countdown} className="punch" style={{ ...silk, fontSize: "28vh", lineHeight: 1 }}>
        {state.countdown}
      </b>
      <div style={{ display: "flex", gap: "2vw", alignItems: "center" }}>
        <span>your candidate {chip("Clap!", "var(--paper)")}</span>
        <span>the other one {chip("Boo!", "var(--paper)")}</span>
        <span>the moderator {chip("Shhh!", GOLD)}</span>
      </div>
    </div>
  );
}

// What each party must do for the current speaker.
const todo = (party: Party, speaker: Speaker) => (speaker === "moderator" ? "Shhh" : speaker === party ? "Clap" : "Boo");

const LINES: Record<Speaker, string[]> = {
  orange: ["Free naps for everyone!", "More holidays, fewer Mondays!", "Pizza is a vegetable!", "Wifi in every forest!", "Two desserts per meal!"],
  blue: ["Naps are a trap!", "Mondays build character!", "Broccoli for breakfast!", "Shorter queues, shorter speeches!", "Tax the loud chewers!"],
  moderator: ["Order! Order!", "Quiet in the studio!", "One at a time, please!", "Shhh! We are live!"],
};
const SPRITE: Record<Speaker, [SpriteName, SpriteName]> = {
  orange: ["cand_a_idle", "cand_a_talk"],
  blue: ["cand_b_idle", "cand_b_talk"],
  moderator: ["moderator_idle", "moderator_talk"],
};
// translateX (% of the 150%-wide row) that centres each speaker under the spotlight.
const PAN: Record<Speaker, number> = { orange: 16.667, moderator: -16.667, blue: -50 };

// The audience from behind: one figure per joined phone (orange left, blue right) with a name
// tag; each hops on its player's right taps and shakes on wrong ones. Grey extras fill the rest.
function Crowd({ state }: { state: State }) {
  const entries = Object.entries(state.players);
  const extra = (i: number, p?: Party) => <PixelSprite key={i} name="crowd_back" slots={{ C: p ? COLORS[p] : "#6E6A60", c: p ? SHADE[p] : "#4E4A42", H: HAIR[i % HAIR.length][0], h: HAIR[i % HAIR.length][1] }} />;
  return (
    <div style={{ height: "27%", position: "relative", background: INK, overflow: "hidden" }}>
      <div style={{ position: "absolute", top: "4%", left: 0, right: 0, height: "42%", display: "flex", justifyContent: "space-around", filter: "brightness(0.5)" }}>
        {Array.from({ length: 22 }, (_, i) => extra(i * 3, i < 8 ? "orange" : i > 13 ? "blue" : undefined))}
      </div>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "1vw", padding: "0 1vw" }}>
        {PARTIES.map((p, i) => (
          <div key={p} style={{ height: "78%", display: "flex", flexDirection: i ? "row-reverse" : "row", alignItems: "flex-end", gap: "0.6vw" }}>
            {state.bot === p && (
              <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
                <b className="panel" style={{ ...silk, fontSize: "1.8vh", padding: "0 0.4vw", boxShadow: "none", borderWidth: 3 }}>CPU</b>
                <div style={{ flex: 1, minHeight: 0 }}>{extra(2, p)}</div>
              </div>
            )}
            {entries.filter(([, x]) => x.party === p).map(([id, x], j) => (
              <div key={id} style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", opacity: x.online ? 1 : 0.3 }}>
                <b className="panel" style={{ ...silk, fontSize: "1.8vh", padding: "0 0.4vw", boxShadow: "none", borderWidth: 3, whiteSpace: "nowrap", position: "relative", zIndex: 1 }}>{x.name}</b>
                <Pop on={x.right} frames={HOP} style={{ flex: 1, minHeight: 0 }}>
                  <Pop on={x.wrong} frames={SHAKE} ms={200} style={{ height: "100%" }}>
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

function Stage({ state }: { state: State }) {
  const live = state.speaker ?? "moderator";
  const talk = useFlip(180);
  // A new line every time the camera moves.
  const [shown, setShown] = useState({ live, n: 0 });
  if (shown.live !== live) setShown({ live, n: shown.n + 1 });
  const sum = (p: Party, k: "right" | "wrong") => Object.values(state.players).reduce((n, x) => n + (x.party === p ? x[k] : 0), 0);
  const wrongs = sum("orange", "wrong") + sum("blue", "wrong");
  const accent = live === "moderator" ? GOLD : COLORS[live];
  return (
    // Any wrong tap: the studio shakes and a red frame flashes.
    <Pop on={wrongs} frames={QUAKE} ms={300} style={{ flex: 1, minWidth: 0, position: "relative", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, minHeight: 0, position: "relative", overflow: "hidden", background: "repeating-linear-gradient(90deg, #4a211d 0 5vw, #3d1a17 5vw 10vw)" }}>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "9%", background: "var(--floor)", borderTop: `5px solid ${INK}` }} />
        {/* Spotlight: fixed at the centre, the camera brings the speaker under it. */}
        <div style={{ position: "absolute", inset: 0, background: "rgba(232, 224, 200, 0.2)", clipPath: "polygon(45% 0, 55% 0, 68% 100%, 32% 100%)" }} />
        <div style={{ position: "absolute", top: "2%", left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5vh" }}>
          <b style={{ ...silk, fontSize: "3.4vh", letterSpacing: "0.3vw", color: GOLD, background: INK, border: `4px solid ${GOLD}`, padding: "0.3vh 2vw" }}>The great debate</b>
          <b style={{ ...silk, fontSize: "2.4vh", color: accent, textShadow: "2px 2px 0 #000" }}>Live · {live === "moderator" ? "moderator" : `${live} candidate`} speaks</b>
        </div>
        {/* The camera pans: the row is wider than the stage and slides until the speaker is centred. */}
        <div style={{ position: "absolute", left: 0, right: 0, top: "24%", bottom: "4%" }}>
          <div style={{ height: "100%", width: "150%", display: "flex", transform: `translateX(${PAN[live]}%)`, transition: "transform 0.45s cubic-bezier(0.2, 0.8, 0.2, 1)" }}>
            {(["orange", "moderator", "blue"] as Speaker[]).map((who) => {
              const on = live === who;
              return (
                <div key={who} style={{ flex: 1, height: "100%", display: "flex", justifyContent: "center", alignItems: "flex-end", filter: on ? "none" : "brightness(0.55)", transition: "filter 0.3s" }}>
                  <div className={on ? "bob" : undefined} style={{ position: "relative", height: on ? "100%" : "60%", transition: "height 0.3s" }}>
                    <PixelSprite name={SPRITE[who][on && talk ? 1 : 0]} slots={SLOTS[who]} flip={who === "blue"} />
                    {who !== "moderator" && (
                      <div style={{ position: "absolute", bottom: 0, height: "94%", [who === "orange" ? "left" : "right"]: "104%" }}>
                        <PixelSprite name="mic_stand" />
                      </div>
                    )}
                    {who === "moderator" && (
                      <b style={{ ...silk, position: "absolute", left: "-45%", right: "-45%", bottom: 0, height: "36%", background: "#3A332C", border: `5px solid ${INK}`, color: GOLD, fontSize: "2.4vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        Moderator
                      </b>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div key={shown.n} className="pop-in" style={{ position: "absolute", left: "59%", top: "26%", maxWidth: "32%", background: "var(--cream)", color: INK, border: `5px solid ${INK}`, boxShadow: "6px 6px 0 #000", fontSize: "4.6vh", lineHeight: 1, padding: "1vh 1vw", textTransform: "uppercase" }}>
          “{LINES[live][shown.n % LINES[live].length]}”
        </div>
        {/* What each party must do now, in the colour of the button to press. */}
        {PARTIES.map((p, i) => (
          <div key={p} style={{ position: "absolute", bottom: "5%", [i ? "right" : "left"]: "2%", display: "flex", flexDirection: "column", alignItems: i ? "flex-end" : "flex-start" }}>
            <Pop on={sum(p, "wrong")} frames={FLOAT} ms={600} style={{ ...silk, opacity: 0, color: "var(--error)", fontSize: "4vh", textShadow: "3px 3px 0 #000" }}>
              Order!
            </Pop>
            <Pop on={sum(p, "right")} frames={FLOAT} ms={500} style={{ ...silk, opacity: 0, color: "var(--cream)", fontSize: "3vh", textShadow: "3px 3px 0 #000" }}>
              {todo(p, live) === "Boo" ? "Booo!" : "Clap clap"}
            </Pop>
            <b style={{ ...silk, fontSize: "2.2vh", background: INK, color: COLORS[p], padding: "0.2vh 0.8vw" }}>
              {state.bot === p ? "computer" : `${p} team`}
              {state.weight[p] > 1 && ` · taps x${+state.weight[p].toFixed(1)}`}
            </b>
            <b key={live} className="pop-in" style={{ ...silk, fontSize: "7vh", lineHeight: 1, background: accent, color: INK, border: `5px solid ${INK}`, boxShadow: "6px 6px 0 #000", padding: "1vh 1.5vw" }}>
              {todo(p, live)}!
            </b>
          </div>
        ))}
      </div>
      <Crowd state={state} />
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

// Results as a newspaper front page: headline, "photo", per-player tally, final share, rematch vote.
function Newspaper({ state }: { state: State }) {
  const pct = share(state);
  const w = state.winner;
  const lead = w ? pct[w] - 50 : 0;
  const headline = !w ? "Debate ends in deadlock" : `${w} ${lead > 25 ? "wins in landslide" : lead > 10 ? "takes the debate" : "wins photo finish"}`;
  const sub = !w ? "Both camps claim victory; moderator demands silence" : `${other(w)[0].toUpperCase()}${other(w).slice(1)} camp demands recount; moderator demands silence`;
  const voters = Object.values(state.players).filter((p) => p.online);
  const small: CSSProperties = { display: "flex", justifyContent: "space-between", fontSize: "2vh", textTransform: "uppercase" };
  const rule = `3px double ${INK}`;
  return (
    <div style={{ ...center, background: "var(--void)", padding: "2.5vh" }}>
      <div style={{ position: "relative", transform: "rotate(-1.2deg)", width: "88%", height: "96%", boxSizing: "border-box", padding: "1.5vh 2.5vw", background: "var(--grain), #EAE4CE", color: INK, boxShadow: "10px 10px 0 #000", fontFamily: "'Old Standard TT', serif", display: "flex", flexDirection: "column", gap: "0.8vh" }}>
        <div style={{ ...small, borderBottom: rule }}>
          <span>Vol. I · No. 30</span>
          <span>Late city edition</span>
          <span>Price: one boo</span>
        </div>
        <div style={{ fontFamily: "UnifrakturMaguntia, serif", fontSize: "8vh", lineHeight: 1, textAlign: "center" }}>The Daily Debate</div>
        <div style={{ ...small, borderTop: rule, borderBottom: rule }}>
          <span>Berlin, Saturday</span>
          <span>“All the noise that’s fit to print”</span>
          <span>Election night</span>
        </div>
        <b style={{ fontSize: "7.5vh", lineHeight: 1, textAlign: "center", textTransform: "uppercase" }}>{headline}</b>
        <i style={{ fontSize: "3vh", textAlign: "center", borderBottom: `2px solid ${INK}`, paddingBottom: "0.5vh" }}>{sub}</i>
        <div style={{ flex: 1, minHeight: 0, display: "flex", gap: "2vw" }}>
          <div style={{ width: "30%", display: "flex", flexDirection: "column", gap: "0.5vh" }}>
            <div style={{ flex: 1, minHeight: 0, position: "relative", border: `4px solid ${INK}`, background: "#CFC8AE", filter: "grayscale(1) contrast(1.1)", display: "flex", justifyContent: "space-around", alignItems: "flex-end", padding: "1vh 1vw 0" }}>
              <div style={{ height: "92%" }}>
                <PixelSprite name={w === "orange" ? "cand_a_talk" : "cand_a_idle"} slots={SLOTS.orange} />
              </div>
              <div style={{ height: "92%" }}>
                <PixelSprite name={w === "blue" ? "cand_b_talk" : "cand_b_idle"} slots={SLOTS.blue} flip />
              </div>
              <div style={{ position: "absolute", inset: 0, background: "var(--grain)" }} />
            </div>
            <i style={{ fontSize: "1.9vh" }}>The candidates exchange words. Photo: Studio CH 01.</i>
          </div>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "1vh", fontSize: "3vh", lineHeight: 1.15 }}>
            <Roster state={state} scores />
            <div style={{ border: `3px solid ${INK}`, padding: "0.8vh 1vw" }}>
              <div style={{ ...silk, fontSize: "1.8vh" }}>Final crowd share</div>
              <div style={{ height: "3.5vh", background: COLORS.blue, border: `3px solid ${INK}` }}>
                <div style={{ height: "100%", width: `${pct.orange}%`, background: COLORS.orange, borderRight: `3px solid ${INK}`, boxSizing: "border-box" }} />
              </div>
              <div style={{ ...silk, fontSize: "2vh", display: "flex", justifyContent: "space-between" }}>
                <span>Orange {pct.orange}%</span>
                <span>Blue {pct.blue}%</span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "1vw" }}>
              <span style={{ flex: 1 }}>
                Rematch? Tap <b>Play again</b> on your phone ({voters.filter((p) => p.ready).length}/{voters.length} ready)
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
        <b style={{ ...silk, position: "absolute", right: "5%", top: "30%", transform: "rotate(-14deg)", color: "var(--brick)", border: "6px solid var(--brick)", padding: "0.3vh 1.2vw", fontSize: "3.4vh", letterSpacing: "0.3vw", opacity: 0.85 }}>
          {w ? "Recount denied" : "Recount ordered"}
        </b>
      </div>
    </div>
  );
}

export default function Screen() {
  const state = useGameState();
  useSounds(state);
  if (!state) return <main style={{ padding: "2rem", fontSize: "2rem" }}>Connecting…</main>;

  const count = Object.values(state.players).filter((p) => p.online).length;
  const inRound = state.phase === "playing" || state.phase === "ended";
  const hurry = state.phase === "playing" && state.timeLeft < 10;

  return (
    <main style={{ height: "100dvh", boxSizing: "border-box", padding: "1.5vh", background: "var(--void)" }}>
      {/* The TV: bezel, HUD strip, then the current screen, all under the CRT glass. */}
      <div style={{ position: "relative", height: "100%", boxSizing: "border-box", border: "22px solid #3A332C", borderRadius: 30, overflow: "hidden", background: "var(--wall)", display: "flex", flexDirection: "column" }}>
        <div style={{ background: INK, padding: "1vh 2vw 1.6vh", display: "flex", flexDirection: "column", gap: "1vh" }}>
          <div style={{ ...silk, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "2.4vh", color: GOLD }}>
            <span style={{ flex: 1 }}>Let it out!</span>
            {/* Timer turns red for the last 10 seconds. */}
            <b style={{ fontSize: "4.6vh", lineHeight: 1, padding: "0.4vh 1.5vw", border: `5px solid ${hurry ? "var(--error)" : "var(--cream)"}`, color: hurry ? "var(--error)" : "var(--cream)", visibility: inRound ? "visible" : "hidden" }}>
              0:{String(state.timeLeft).padStart(2, "0")}
            </b>
            <span style={{ flex: 1, textAlign: "right" }}>
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
    </main>
  );
}

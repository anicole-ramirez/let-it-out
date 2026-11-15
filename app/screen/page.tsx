"use client";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { BASE, COLORS, GOLD, SHADE, STATIC, getId, send, useGameState } from "@/lib/client";
import { LEVELS, PARTIES, type Party, type Speaker, type State } from "@/lib/game";
import { Character, FIRST_CAST, rollCast, type Cast } from "@/lib/Character";
import { HAIR, PixelSprite } from "@/lib/PixelSprite";
import { play, unlock, useSounds } from "@/lib/sound";
import THROWABLES from "@/lib/throwables.json";

// Projector view: everything happens inside an old TV. HUD (timer + one bar) on top, then
// the lobby form, the countdown, the debate studio or the results newspaper.
// Single player plays on this screen alone, without a phone.

const INK = "var(--ink)";
const silk: CSSProperties = { fontFamily: "Silkscreen, monospace", fontWeight: 700, textTransform: "uppercase" };
const center: CSSProperties = { flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "calc(2 * var(--u))", padding: "calc(3 * var(--u)) 3vw" };
const btn: CSSProperties = { fontSize: "max(calc(3 * var(--u)), 12px)", padding: "calc(1 * var(--u)) 2vw" };
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
const NOD: Keyframe[] = [{ transform: "translateY(0)" }, { transform: "translateY(-12%)" }, { transform: "translateY(0)" }];
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
  const playing = state.phase === "playing";
  const leader = orange >= 75 ? "orange" : orange <= 25 ? "blue" : null;
  // The party names sit at the ends of the bar, in their colours: no legend to decode.
  const me = state.mode === "single" ? state.players[getId()]?.party : undefined;
  const label = (p: Party) => (
    <span style={{ ...silk, flex: "none", display: "flex", flexDirection: "column", alignItems: "center", fontSize: "max(calc(2.4 * var(--u)), 12px)", lineHeight: 1.1, color: COLORS[p] }}>
      {p}
      {me === p && <span style={{ fontSize: "max(calc(1.7 * var(--u)), 12px)", padding: "0 0.5em", background: "var(--cream)", color: INK }}>You</span>}
    </span>
  );
  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: "1.2vw" }}>
      {label("orange")}
      <Pop on={state.rope} frames={BUMP} ms={120} style={{ flex: 1 }}>
        <div
          className={playing && leader ? "glow" : undefined}
          style={{ ...silk, position: "relative", height: "calc(5 * var(--u))", background: COLORS.blue, border: `5px solid ${INK}`, outline: "4px solid #6B5A44", color: "var(--cream)", fontSize: "max(calc(2.6 * var(--u)), 12px)", ["--glow" as string]: leader ? COLORS[leader] : "transparent" }}
        >
          <div style={{ position: "absolute", inset: 0, width: `${orange}%`, background: COLORS.orange, transition: "width 0.15s" }} />
          <div className={playing ? "wobble" : undefined} style={{ position: "absolute", left: `${orange}%`, top: 0, bottom: 0, width: 6, marginLeft: -3, background: "var(--cream)", transition: "left 0.15s" }} />
        </div>
      </Pop>
      {label("blue")}
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
    <div style={{ flex: 1, minHeight: 0, width: "100%", display: "flex", gap: "2vw", overflow: "hidden", fontSize: `max(calc(${size} * var(--u)), 13px)`, lineHeight: 1.15 }}>
      {PARTIES.map((p, i) => (
        <div key={p} style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...silk, fontSize: "max(calc(2.2 * var(--u)), 12px)", color: SHADE[p], borderBottom: `3px solid ${INK}` }}>
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

// The three rules, in the same words as the prompt under the stage.
function HowTo({ size }: { size: string }) {
  const chip = (word: string, bg: string = INK, color = "var(--cream)") => <span style={{ ...silk, fontSize: "0.8em", display: "inline-block", minWidth: "3.6em", textAlign: "center", marginRight: "0.5em", background: bg, color }}>{word}</span>;
  return (
    <div style={{ fontSize: size, lineHeight: 1.35, textAlign: "left" }}>
      <div>{chip("Clap")}when your candidate talks</div>
      <div>{chip("Boo")}when the other one talks</div>
      <div>{chip("Shhh", GOLD, INK)}when the moderator talks</div>
    </div>
  );
}

function Lobby({ state, count }: { state: State; count: number }) {
  if (!state.mode)
    return (
      <div style={center}>
        <div className="panel" style={{ ...center, flex: "none", fontSize: "max(calc(3.5 * var(--u)), 12px)" }}>
          <b style={{ ...silk, fontSize: "calc(5 * var(--u))" }}>How do you want to play?</b>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "2vw" }}>
            <button style={{ ...btn, padding: "calc(3 * var(--u)) 3vw" }} onClick={() => send({ type: "mode", mode: "single" })}>
              Single player
              <div style={{ fontFamily: "VT323", fontWeight: 400, textTransform: "none" }}>you against the computer</div>
            </button>
            <button style={{ ...btn, padding: "calc(3 * var(--u)) 3vw" }} disabled={STATIC} onClick={() => send({ type: "mode", mode: "multi" })}>
              Multiplayer
              <div style={{ fontFamily: "VT323", fontWeight: 400, textTransform: "none" }}>{STATIC ? "only on the local server" : "orange against blue"}</div>
            </button>
          </div>
        </div>
      </div>
    );
  return state.mode === "single" ? <Solo /> : <Join state={state} count={count} />;
}

// Single player: name and party on this screen; picking the party starts the round.
function Solo() {
  const [name, setName] = useState(() => localStorage.getItem("name") ?? "");
  const pick = async (party: Party) => {
    localStorage.setItem("name", name.trim());
    await send({ type: "join", id: getId(), party, name });
    send({ type: "start" });
  };
  return (
    <div style={center}>
      <div className="panel" style={{ ...center, flex: "none", fontSize: "max(calc(3.6 * var(--u)), 12px)" }}>
        <HowTo size="max(calc(4.4 * var(--u)), 18px)" />
        {/* The name is optional: nothing should stand between the player and the first round. */}
        <input
          autoFocus
          placeholder="Your name (optional)"
          aria-label="Your name (optional)"
          maxLength={12}
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ font: "inherit", padding: "calc(1 * var(--u)) 1vw", border: `5px solid ${INK}`, borderRadius: 0, background: "var(--paper)", color: INK, textAlign: "center" }}
        />
        Pick your party to start
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "2vw" }}>
          {PARTIES.map((p) => (
            <button key={p} style={{ ...btn, padding: "calc(2 * var(--u)) 3vw", background: COLORS[p] }} onClick={() => pick(p)}>
              {p}
            </button>
          ))}
          <button style={btn} onClick={() => send({ type: "reset" })}>
            Back
          </button>
        </div>
      </div>
    </div>
  );
}

// Multiplayer: phones scan the QR code to join.
function Join({ state, count }: { state: State; count: number }) {
  const [join, setJoin] = useState<{ url: string; qr: string } | null>(null);
  useEffect(() => {
    fetch("/api/join").then((r) => r.json()).then(setJoin);
  }, []);
  return (
    <div style={center}>
      <div className="panel" style={{ width: "92%", height: "100%", boxSizing: "border-box", padding: "calc(2 * var(--u)) 2vw", display: "flex", flexWrap: "wrap", overflowY: "auto", gap: "2.5vw", fontSize: "max(calc(3.6 * var(--u)), 12px)", lineHeight: 1.1 }}>
        {join && (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="Join QR code" style={{ alignSelf: "center", height: "min(100%, 60vw)", maxWidth: "36%", aspectRatio: "1", minHeight: 0, minWidth: 0, border: `5px solid ${INK}`, imageRendering: "pixelated" }} src={`data:image/svg+xml;utf8,${encodeURIComponent(join.qr)}`} />
        )}
        <div style={{ flex: "1 1 240px", minWidth: 0, display: "flex", flexDirection: "column", gap: "calc(1.2 * var(--u))" }}>
          <div>
            Scan to join, or open <b>{join?.url}</b>
          </div>
          <HowTo size="max(calc(4 * var(--u)), 17px)" />
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
    <div style={{ ...center, background: "var(--void)", fontSize: "max(calc(4 * var(--u)), 12px)" }}>
      <b style={{ ...silk, color: GOLD, textAlign: "center" }}>
        Round {state.level} of {LEVELS.length}: {LEVELS[state.level - 1].name}
      </b>
      <div style={{ textAlign: "center" }}>
        <Typed text={LEVELS[state.level - 1].hint} />
      </div>
      <div style={{ textAlign: "center" }}>{state.mode === "multi" ? "Watch this screen, not your phone." : "Use the ← → keys or tap the buttons."}</div>
      <b key={state.countdown} className="punch" style={{ ...silk, fontSize: "calc(28 * var(--u))", lineHeight: 1 }}>
        {state.countdown}
      </b>
    </div>
  );
}

// Where each character stands (% from the left); the spotlight follows the speaker.
const SPOT: Record<Speaker, number> = { orange: 22, moderator: 50, blue: 78 };

// Types its text out, two letters at a time. The untyped rest is already there, invisible,
// so nothing moves while it types; screen readers get the whole sentence at once.
function Typed({ text }: { text: string }) {
  const [shown, setShown] = useState({ text, n: 0 });
  if (shown.text !== text) setShown({ text, n: 0 });
  const n = shown.text === text ? shown.n : 0;
  useEffect(() => {
    if (n >= text.length) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(() => setShown({ text, n: still ? text.length : n + 2 }), 22);
    return () => clearTimeout(t);
  }, [n, text]);
  return (
    <span aria-label={text}>
      <span aria-hidden>{text.slice(0, n)}</span>
      <span aria-hidden style={{ visibility: "hidden" }}>
        {text.slice(n)}
      </span>
    </span>
  );
}

// A lectern with a microphone for each candidate (its badge in the party colour) and a desk
// for the moderator, drawn in front of the figure.
function Podium({ who, dim }: { who: Speaker; dim: boolean }) {
  const K = "#1E1A16";
  const desk = who === "moderator";
  return (
    <svg
      viewBox={desk ? "0 0 44 14" : "0 -9 24 25"}
      shapeRendering="crispEdges"
      aria-hidden
      style={{ position: "absolute", left: "50%", bottom: "-3%", height: desk ? "34%" : "52%", transform: `translateX(-50%)${who === "blue" ? " scaleX(-1)" : ""}`, filter: dim ? "brightness(0.7) saturate(0.55)" : undefined, transition: "filter 0.15s" }}
    >
      {desk ? (
        <>
          <rect x="0" y="0" width="44" height="4" fill={K} />
          <rect x="1" y="1" width="42" height="2" fill="#6B5A44" />
          <rect x="2" y="4" width="40" height="10" fill={K} />
          <rect x="3" y="4" width="38" height="9" fill="#3A332C" />
          <rect x="15" y="6" width="14" height="4" fill={GOLD} />
        </>
      ) : (
        <>
          <rect x="19" y="-7" width="1" height="8" fill={K} />
          <rect x="18" y="-9" width="3" height="3" fill={K} />
          <rect x="1" y="0" width="22" height="4" fill={K} />
          <rect x="2" y="1" width="20" height="2" fill="#8A6E4E" />
          <rect x="3" y="4" width="18" height="12" fill={K} />
          <rect x="4" y="4" width="16" height="11" fill="#5E4A36" />
          <rect x="9" y="6" width="6" height="6" fill="#E8E0C8" />
          <rect x="10" y="7" width="4" height="4" fill={COLORS[who as Party]} />
        </>
      )}
    </svg>
  );
}

const tag: CSSProperties = { ...silk, display: "block", position: "relative", zIndex: 1, padding: "0 0.2vw", boxShadow: "none", borderWidth: 2, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

// Multiplayer only: one small figure per joined phone (orange left, blue right) with a name
// tag; each hops on its player's right taps and shakes on wrong ones, so everyone can find
// their own feedback on the big screen.
function Crowd({ state }: { state: State }) {
  const entries = Object.entries(state.players);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "1vw", padding: "calc(0.8 * var(--u)) 1vw 0", background: INK, overflow: "hidden" }}>
      {PARTIES.map((p, i) => (
        <div key={p} style={{ width: "47%", display: "flex", flexDirection: i ? "row-reverse" : "row", alignItems: "flex-end" }}>
          {entries.filter(([, x]) => x.party === p).map(([id, x], j, all) => (
            // Up to 6 figures a side at full size; beyond that they share the width.
            <div key={id} style={{ flex: "0 1 7vw", minWidth: 0, opacity: x.online ? 1 : 0.3 }}>
              <b className="panel" style={{ ...tag, fontSize: all.length > 14 ? "calc(1.2 * var(--u))" : all.length > 6 ? "calc(1.5 * var(--u))" : "calc(1.8 * var(--u))" }}>{x.name}</b>
              <Pop on={x.right} frames={HOP}>
                <Pop on={x.wrong} frames={SHAKE} ms={200}>
                  <PixelSprite name="crowd_back" style={{ width: "60%", height: "auto", margin: "0 auto" }} slots={{ C: COLORS[p], c: SHADE[p], H: HAIR[j % HAIR.length][0], h: HAIR[j % HAIR.length][1] }} />
                </Pop>
              </Pop>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// What the crowd throws (drawings from the second design, pitch/second design.html).
const BOOED = ["tomato", "can", "egg", "shoe", "banana", "paper"] as const;
const CHEERED = ["bouquet", "rose", "bra", "teddy", "heart", "laurel"] as const;

// What the speakers say (from the design handoff's reference game). Shown above the speaker.
const LINES: Record<Speaker, string[]> = {
  orange: ["Free naps for everyone!", "Pizza counts as a vegetable!", "Three-day weekends, forever!", "Every dog gets a vote!", "Homework is hereby cancelled!", "Free wifi on every cloud!", "Ice cream for breakfast!"],
  blue: ["Mondays twice a week!", "Socks with sandals: mandatory!", "We will ban the snooze button!", "A tax on fun, starting now!", "All coffee will be decaf!", "Pineapple on every pizza!", "Meetings that could be emails!"],
  moderator: ["Order! Next question...", "Please, let them speak.", "Silence in the studio!", "Time check: keep it short.", "Who ate the last biscuit?"],
};
// The statements each candidate made this round: the front page turns the winner's into law.
const spoken: Record<Party, string[]> = { orange: [], blue: [] };
// How the three look this round (rolled when the round begins); the front page shows the same faces.
let cast: Cast = FIRST_CAST;
// The set is one flat, dark colour, tinted by whoever speaks.
const TINT: Record<Speaker, string> = { orange: "#3F2C20", blue: "#2C3436", moderator: "#3C3423" };

// The one instruction on screen: a band under the stage in the colour of the button to press,
// with the action in big letters and a plain sentence below it.
function Prompt({ state, live }: { state: State; live: Speaker }) {
  const me = state.mode === "single" ? state.players[getId()] : undefined;
  // Single player: a wrong tap says so here for a moment, where the eyes already are.
  const wrong = me?.wrong ?? 0;
  const [oops, setOops] = useState(false);
  const seen = useRef(wrong);
  useEffect(() => {
    const more = wrong > seen.current;
    seen.current = wrong;
    if (!more) return;
    setOops(true);
    const t = setTimeout(() => setOops(false), 700);
    return () => clearTimeout(t);
  }, [wrong]);

  const quiet = live === "moderator";
  const word: CSSProperties = { ...silk, fontSize: "calc(9 * var(--u))", lineHeight: 1 };
  let big: ReactNode;
  let hint: string;
  if (oops) {
    big = <b style={word}>Order!</b>;
    hint = quiet ? "Hands off while the moderator talks" : "Wrong button: press the colour of this band";
  } else if (quiet) {
    big = <b style={word}>Shhh!</b>;
    hint = "The moderator is talking: don't touch anything";
  } else if (me) {
    const mine = live === me.party;
    big = <b style={word}>{mine ? "Clap!" : "Boo!"}</b>;
    hint = mine ? "Your candidate is talking: mash CLAP" : "The other candidate is talking: mash BOO";
  } else {
    // Multiplayer: one screen for both camps, so each reads its own action.
    big = (
      <div style={{ display: "flex", alignItems: "baseline", gap: "6vw" }}>
        {PARTIES.map((p) => (
          <span key={p} style={{ display: "flex", alignItems: "baseline", gap: "1vw" }}>
            <span style={{ ...silk, fontSize: "max(calc(2.6 * var(--u)), 12px)" }}>{p} team</span>
            <b style={word}>{p === live ? "Clap!" : "Boo!"}</b>
          </span>
        ))}
      </div>
    );
    hint = `Everyone taps the ${live} button`;
  }
  return (
    <div role="status" style={{ flex: "none", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "calc(0.6 * var(--u))", padding: "calc(1.6 * var(--u)) 2vw", borderTop: `5px solid ${INK}`, background: oops ? "var(--error)" : quiet ? GOLD : COLORS[live], color: INK }}>
      <div key={`${live}${oops}`} className="pop-in">
        {big}
      </div>
      <div style={{ fontSize: "max(calc(3.4 * var(--u)), 16px)", lineHeight: 1, textAlign: "center" }}>
        <Typed text={hint} />
      </div>
    </div>
  );
}

// The studio, kept bare: only the speaker is lit and full size, with the statement above and
// the instruction below. The other two wait small and dimmed.
function Stage({ state }: { state: State }) {
  const live = state.speaker ?? "moderator";
  const pan = (50 - SPOT[live]) * 0.55; // % of the stage width the set slides
  const at = SPOT[live] + pan; // where the speaker ends up on screen
  const talk = useFlip(180);
  const wrongs = Object.values(state.players).reduce((n, x) => n + x.wrong, 0);
  // A new statement every time the floor changes.
  const [said, setSaid] = useState({ who: live, n: 0 });
  if (said.who !== live) setSaid({ who: live, n: said.n + 1 });
  const line = LINES[live][said.n % LINES[live].length];
  const [looks] = useState(rollCast);
  useEffect(() => {
    spoken.orange = [];
    spoken.blue = [];
    cast = looks;
  }, [looks]);
  useEffect(() => {
    if (live !== "moderator" && !spoken[live].includes(line)) spoken[live].push(line);
  }, [live, line]);
  const me = state.mode === "single" ? state.players[getId()]?.party : undefined;
  // Every time the bar moves, the side that gained throws something at the speaker from its
  // side: flowers and teddies for its own candidate, tomatoes and shoes for the other one.
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
    const size = Math.min(h, w * 0.6) * 0.16; // sized by the smaller side, so upright phones get no giant tomatoes
    const sx = (from === "orange" ? 0.04 + Math.random() * 0.2 : 0.76 + Math.random() * 0.2) * w;
    const dx = ((SPOT[live] + (50 - SPOT[live]) * 0.55) / 100 + (Math.random() - 0.5) * 0.08) * w - sx;
    const dy = -h * (0.4 + Math.random() * 0.15);
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
  return (
    // Any wrong tap: the studio shakes and a red frame flashes.
    <Pop on={wrongs} frames={QUAKE} ms={300} style={{ flex: 1, minWidth: 0, position: "relative", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, minHeight: 0, position: "relative", overflow: "hidden", background: TINT[live], transition: "background-color 0.2s" }}>
        {/* Spotlight: a beam from the rig down to the speaker; it swings with the camera. */}
        <div style={{ position: "absolute", inset: 0, background: "rgba(232, 224, 200, 0.16)", clipPath: `polygon(${at - 3}% 0, ${at + 3}% 0, ${at + 14}% 79%, ${at - 14}% 79%)`, transition: "clip-path 0.3s ease-out", pointerEvents: "none" }} />
        {/* The statement, above whoever says it. */}
        <div style={{ ["--bw" as string]: "min(94%, max(40%, 280px))", position: "absolute", top: "4%", left: `clamp(calc(var(--bw) / 2 + 2%), ${at}%, calc(98% - var(--bw) / 2))`, transition: "left 0.3s ease-out", width: "var(--bw)", transform: "translateX(-50%)", display: "flex", justifyContent: "center", zIndex: 2 }}>
          <div key={said.n} className="panel pop-in" style={{ padding: "calc(1 * var(--u)) 1.4vw", fontSize: "max(calc(4.6 * var(--u)), 18px)", lineHeight: 1, textAlign: "center", textTransform: "uppercase", boxShadow: "5px 5px 0 #000" }}>
            <Typed text={`“${line}”`} />
          </div>
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: "24%", height: "min(54%, 42vw)", transform: `translateX(${pan}%)`, transition: "transform 0.3s ease-out" }}>
          {(["orange", "moderator", "blue"] as Speaker[]).map((who) => {
            const on = live === who;
            const mine = me === who;
            return (
              <div key={who} style={{ position: "absolute", bottom: 0, left: `${SPOT[who]}%`, height: on ? "100%" : "60%", transform: "translateX(-50%)", transition: "height 0.15s" }}>
                {/* Pool of light under the speaker. */}
                {on && <div style={{ position: "absolute", left: "-30%", right: "-30%", bottom: "-5%", height: "16%", borderRadius: "50%", background: "rgba(232, 224, 200, 0.28)" }} />}
                <div className={on ? "bob" : undefined} style={{ position: "relative", height: "100%", filter: on ? "none" : "brightness(0.7) saturate(0.55)", transition: "filter 0.15s" }}>
                  <Character who={who} look={looks[who]} talk={on && talk} flip={who === "blue"} />
                </div>
                <Podium who={who} dim={!on} />
                {/* Who is who: the player's own candidate is always marked. */}
                <div style={{ ...silk, position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)", marginTop: "0.5em", padding: "0 0.5em", whiteSpace: "nowrap", fontSize: "max(calc(1.9 * var(--u)), 10px)", lineHeight: 1.4, background: mine ? "var(--cream)" : who === "moderator" ? GOLD : COLORS[who], color: INK, outline: mine ? `3px solid ${COLORS[who]}` : undefined, opacity: on || mine ? 1 : 0.55 }}>
                  {mine ? "You" : state.bot === who ? "CPU" : who}
                </div>
              </div>
            );
          })}
        </div>
        <Pop on={state.rope} frames={NOD} ms={160} style={{ position: "absolute", left: "-2%", right: "-2%", bottom: 0, height: "min(13%, 8vw)", display: "flex", justifyContent: "space-between", filter: "brightness(0.55)", pointerEvents: "none" }}>
          {Array.from({ length: 18 }, (_, i) => {
            const p: Party | undefined = i < 7 ? "orange" : i > 10 ? "blue" : undefined;
            return <PixelSprite key={i} name="crowd_back" slots={{ C: p ? COLORS[p] : "#6E6A60", c: p ? SHADE[p] : "#4E4A42", H: HAIR[(i * 3) % HAIR.length][0], h: HAIR[(i * 3) % HAIR.length][1] }} />;
          })}
        </Pop>
        <div ref={air} style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }} />
      </div>
      <Prompt state={state} live={live} />
      {state.mode === "multi" && <Crowd state={state} />}
      <Pop on={wrongs} frames={FLASH} ms={300} style={{ position: "absolute", inset: 0, border: "10px solid var(--error)", opacity: 0, pointerEvents: "none" }} />
    </Pop>
  );
}

// Single player's buttons under the studio, also on the ← and → keys: the left one is orange,
// the right one blue, as on the stage. Press the colour of whoever speaks.
function Controls({ state }: { state: State }) {
  const id = getId();
  const me = state.players[id]?.party;
  const refs = useRef<Partial<Record<Party, HTMLButtonElement | null>>>({});
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const p: Party | null = e.key === "ArrowLeft" ? "orange" : e.key === "ArrowRight" ? "blue" : null;
      if (!p || !me) return;
      e.preventDefault();
      if (e.repeat) return;
      refs.current[p]?.animate([{ transform: "translate(3px, 3px)", boxShadow: "2px 2px 0 #000" }, {}], 120);
      send({ type: p === me ? "clap" : "boo", id });
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, [me, id]);
  if (!me) return null;
  return (
    <div style={{ display: "flex", gap: "1.5vw", padding: "calc(1.2 * var(--u)) 1.5vw calc(1.8 * var(--u))", background: INK }}>
      {PARTIES.map((p) => (
        <button
          key={p}
          ref={(el) => {
            refs.current[p] = el;
          }}
          style={{ ...btn, flex: 1, fontSize: "max(calc(4 * var(--u)), 12px)", background: COLORS[p] }}
          onPointerDown={(e) => e.isPrimary && send({ type: p === me ? "clap" : "boo", id })}
        >
          {p === "orange" && "← "}
          {p === me ? "Clap" : "Boo"}
          {p === "blue" && " →"}
        </button>
      ))}
    </div>
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

// Results as the front page of a broadsheet: masthead with "ears", a date rule, a stacked
// headline, then three columns (what the vote passed, the winner's photo, the tally).
// The winner's statements from this round "become law"; the loser's are thrown out.
function Newspaper({ state }: { state: State }) {
  const pct = share(state);
  const w = state.winner;
  const loser = w && other(w);
  const lead = w ? pct[w] - 50 : 0;
  const passed = w ? spoken[w].slice(0, 4) : [];
  const rejected = loser ? spoken[loser].slice(0, 2) : [];
  const voters = Object.values(state.players).filter((p) => p.online);
  const multi = state.mode === "multi";
  const me = multi ? undefined : state.players[getId()]?.party;
  const serif = "'Old Standard TT', serif";
  const small = "max(calc(2.3 * var(--u)), 13px)";
  const text = "max(calc(2.9 * var(--u)), 15px)";
  const rule = `2px solid ${INK}`;
  const ear: CSSProperties = { flex: "1 1 0", minWidth: 0, fontSize: small, lineHeight: 1.15, fontStyle: "italic" };
  const kicker: CSSProperties = { fontWeight: 700, fontStyle: "italic", fontSize: "max(calc(3.6 * var(--u)), 17px)", lineHeight: 1.05 };
  const label: CSSProperties = { ...silk, fontSize: "max(calc(1.9 * var(--u)), 11px)", padding: "0 0.4em", marginRight: "0.5em", color: "#EAE4CE" };
  const champ = state.champion;
  const score = `${Math.max(state.wins.orange, state.wins.blue)} to ${Math.min(state.wins.orange, state.wins.blue)}`;
  const lines = state.final
    ? [champ ? `${champ} wins the election, ${score};` : "Election ends in a tie;", w && passed[0] ? `“${passed[0].replace(/[!.]+$/, "")}” becomes law;` : "Nothing new becomes law;", champ ? `${other(champ)} camp demands recount` : "Moderator demands silence"]
    : !w
    ? ["Debate ends in deadlock;", "Nothing becomes law;", "Moderator demands silence"]
    : [`${w} ${lead > 25 ? "wins in landslide" : lead > 10 ? "takes the debate" : "wins photo finish"};`, passed[0] ? `“${passed[0].replace(/[!.]+$/, "")}” becomes law;` : `Crowd share ${pct[w]} to ${pct[loser!]};`, `${loser} camp demands recount`];
  return (
    <div style={{ ...center, background: "var(--void)", padding: "calc(2 * var(--u))" }}>
      <div style={{ width: "min(94%, 1100px)", maxHeight: "100%", overflow: "hidden", boxSizing: "border-box", padding: "calc(1.6 * var(--u)) max(2vw, 12px)", background: "#EAE4CE", color: INK, boxShadow: "8px 8px 0 #000", fontFamily: serif, display: "flex", flexDirection: "column", gap: "calc(1.2 * var(--u))" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "2vw" }}>
          <div className="ear" style={{ ...ear, border: `1px solid ${INK}`, padding: "0.3em 0.6em", textAlign: "center", flex: "0 1 auto" }}>
            “All the Noise
            <br />
            That’s Fit to Print”
          </div>
          <div style={{ flex: "1 1 auto", fontFamily: "UnifrakturMaguntia, serif", fontSize: "max(calc(7.5 * var(--u)), 30px)", lineHeight: 1, textAlign: "center" }}>The Daily Debate</div>
          <div className="ear" style={{ ...ear, flex: "0 1 auto", textAlign: "right" }}>
            <b style={{ fontStyle: "normal" }}>Late Edition</b>
            <br />
            Price: one boo
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1em", flexWrap: "wrap", borderTop: rule, borderBottom: rule, padding: "0.15em 0", fontSize: small, textTransform: "uppercase" }}>
          <span>
            Round {state.level} of {LEVELS.length} · Rounds won: orange {state.wins.orange}, blue {state.wins.blue}
          </span>
          <span>{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</span>
          <span>
            Final crowd share: {pct.orange} to {pct.blue}
          </span>
        </div>
        <h1 style={{ margin: 0, fontSize: "max(calc(5.4 * var(--u)), 22px)", lineHeight: 1.05, fontStyle: "italic", fontWeight: 700, textAlign: "center", textTransform: "uppercase" }}>
          {lines.map((l, i) => (
            <div key={i} style={{ color: i === 0 && (state.final ? champ : w) ? SHADE[(state.final ? champ : w)!] : INK }}>
              {l}
            </div>
          ))}
        </h1>
        <div style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 230px), 1fr))", gap: "calc(2 * var(--u)) 2.5vw", borderTop: rule, paddingTop: "calc(1.2 * var(--u))", fontSize: text, lineHeight: 1.2 }}>
          <div>
            <div style={kicker}>{w ? `What the ${w} victory also passed` : "No promise survives the night"}</div>
            {passed.map((l) => (
              <div key={l} style={{ marginTop: "0.5em" }}>
                <span style={{ ...label, background: SHADE[w!] }}>Now law</span>
                {l}
              </div>
            ))}
            {rejected.map((l) => (
              <div key={l} style={{ marginTop: "0.5em", opacity: 0.7 }}>
                <span style={{ ...label, background: "#6E6A60" }}>Thrown out</span>
                <s>{l}</s>
              </div>
            ))}
            {!w && <div style={{ marginTop: "0.5em" }}>Both candidates promised a great deal. The crowd could not agree on any of it.</div>}
          </div>
          <figure style={{ margin: 0 }}>
            <div style={{ height: "max(calc(21 * var(--u)), 120px)", border: `3px solid ${INK}`, background: "#CFC8AE", filter: "grayscale(1) contrast(1.1)", display: "flex", justifyContent: "center", alignItems: "flex-end", gap: "6%", paddingTop: "4%", overflow: "hidden" }}>
              {(w ? [w] : PARTIES).map((p) => (
                <Character key={p} who={p} look={cast[p]} talk={!!w} flip={p === "blue"} style={{ height: "94%" }} />
              ))}
            </div>
            <figcaption style={{ fontSize: small, fontStyle: "italic", marginTop: "0.3em" }}>
              {w ? `The ${w} candidate early this morning, after a tense night of clapping and booing.` : "The candidates, still arguing after the studio lights went out."}
            </figcaption>
          </figure>
          <div style={{ display: "flex", flexDirection: "column", minHeight: "max(calc(18 * var(--u)), 110px)" }}>
            <div style={{ ...silk, fontSize: "max(calc(2.2 * var(--u)), 12px)", textAlign: "center", borderBottom: `1px solid ${INK}`, marginBottom: "0.4em" }}>
              {!me ? "The tally" : state.final ? (champ === me ? "You won the election" : champ ? "You lost the election" : "A tie") : w === me ? "You won this round" : w ? "You lost this round" : "A draw"}
            </div>
            <Roster state={state} scores />
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "max(1vw, 8px)", borderTop: rule, paddingTop: "calc(1.2 * var(--u))", fontSize: text }}>
          <span style={{ flex: "1 1 12ch" }}>
            {multi && (
              <>
                Tap <b>{state.final ? "New match" : "Next round"}</b> on your phone ({voters.filter((p) => p.ready).length}/{voters.length} ready)
              </>
            )}
          </span>
          <button style={{ ...btn, background: multi ? undefined : GOLD }} onClick={() => send({ type: "start" })}>
            {state.final ? (multi ? "New match now" : "New election") : multi ? "Next round now" : "Next round"}
          </button>
          <button style={btn} onClick={() => send({ type: "reset" })}>
            Menu
          </button>
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
  return <iframe ref={ref} src={`${BASE}/intro.html`} title="Intro" style={{ position: "fixed", inset: 0, width: "100%", height: "100%", border: 0, zIndex: 10, transformOrigin: "46.6% 50.6%" }} />;
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
    <main style={{ height: "100dvh", boxSizing: "border-box", padding: "calc(1.5 * var(--u))", background: "var(--void)" }}>
      {/* The TV: bezel, HUD strip, then the current screen, all under the CRT glass. */}
      <div className={boot === "leaving" ? "crt-on" : undefined} style={{ position: "relative", height: "100%", boxSizing: "border-box", border: "22px solid #3A332C", borderRadius: 30, overflow: "hidden", background: "var(--wall)", display: "flex", flexDirection: "column" }}>
        {/* HUD: during a round only the bar and the timer; otherwise the title. */}
        <div style={{ ...silk, background: INK, padding: "calc(1.4 * var(--u)) 2vw", minHeight: "calc(7 * var(--u))", display: "flex", alignItems: "center", gap: "1.5vw", fontSize: "max(calc(2.4 * var(--u)), 12px)", color: GOLD }}>
          {inRound ? (
            <>
              <span style={{ flex: "none", textAlign: "center", fontSize: "max(calc(1.9 * var(--u)), 10px)", lineHeight: 1.2 }}>
                Round
                <br />
                <b style={{ fontSize: "1.5em", color: "var(--cream)" }}>
                  {state.level}/{LEVELS.length}
                </b>
              </span>
              <Bar state={state} />
              {/* Timer turns red for the last 10 seconds. */}
              <b style={{ flex: "none", fontSize: "max(calc(4.6 * var(--u)), 12px)", lineHeight: 1, padding: "calc(0.4 * var(--u)) 1.2vw", border: `5px solid ${hurry ? "var(--error)" : "var(--cream)"}`, color: hurry ? "var(--error)" : "var(--cream)" }}>0:{String(state.timeLeft).padStart(2, "0")}</b>
            </>
          ) : (
            <>
              <span style={{ flex: 1 }}>Let it out!</span>
              <span>
                {count} {count === 1 ? "player" : "players"} · CH 01
              </span>
            </>
          )}
        </div>
        <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
          {state.phase === "lobby" && <Lobby state={state} count={count} />}
          {state.phase === "countdown" && <Countdown state={state} />}
          {state.phase === "playing" && <Stage state={state} />}
          {state.phase === "ended" && <Newspaper state={state} />}
        </div>
        {state.mode === "single" && (state.phase === "countdown" || state.phase === "playing") && <Controls state={state} />}
        <div className="crt" />
      </div>
      {state.phase === "ended" && state.champion && <Confetti color={COLORS[state.champion]} />}
      {fresh && boot === "gate" && (
        <div style={{ ...center, position: "fixed", inset: 0, zIndex: 10, background: "var(--void)" }}>
          <button
            style={{ ...btn, fontSize: "calc(5 * var(--u))", padding: "calc(3 * var(--u)) 4vw", background: GOLD }}
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

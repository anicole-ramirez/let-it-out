"use client";
import { useEffect, useRef } from "react";
import type { Party, State } from "./game";

// Sound effects on the projector, from the recordings in public/audio (Web Audio).
const FILES = { knock: "/audio/knock.wav", crack: "/audio/break.wav", clap: "/audio/clap.wav", boo: "/audio/boo.wav", tada: "/audio/tada.wav" } as const;
type Name = keyof typeof FILES;

let ctx: AudioContext | null = null;
const buffers: Partial<Record<Name, AudioBuffer>> = {};
const last: Partial<Record<Name, number>> = {};
let boo: GainNode | null = null; // one looping boo track, faded in while a team boos
let booOff: ReturnType<typeof setTimeout>;

// Browsers only allow audio after a user gesture: call this from a click.
export function unlock() {
  if (!ctx) {
    const c = (ctx = new AudioContext());
    for (const [name, url] of Object.entries(FILES) as [Name, string][])
      fetch(url)
        .then((r) => r.arrayBuffer())
        .then((b) => c.decodeAudioData(b))
        .then((buf) => (buffers[name] = buf))
        .catch(() => {});
  }
  ctx.resume();
}

// Plays a sound once; `gap` (ms) is the minimum time between two plays of the same sound,
// so a room full of fast tappers stays a crowd and not a wall of noise.
export function play(name: Name, { vol = 1, rate = 1, gap = 0 } = {}) {
  const buf = buffers[name];
  const now = performance.now();
  if (!ctx || !buf || now - (last[name] ?? 0) < gap) return;
  last[name] = now;
  const src = ctx.createBufferSource();
  const gain = ctx.createGain();
  src.buffer = buf;
  src.playbackRate.value = rate;
  gain.gain.value = vol;
  src.connect(gain).connect(ctx.destination);
  src.start();
}

// Fades the looping boo track to `vol`.
function booTo(vol: number) {
  if (!ctx || !buffers.boo) return;
  if (!boo) {
    const src = ctx.createBufferSource();
    src.buffer = buffers.boo;
    src.loop = true;
    boo = ctx.createGain();
    boo.gain.value = 0;
    src.connect(boo).connect(ctx.destination);
    src.start();
  }
  boo.gain.setTargetAtTime(vol, ctx.currentTime, 0.08);
}

// Plays sounds for state changes on the projector.
export function useSounds(state: State | null) {
  const prev = useRef<State | null>(null);

  useEffect(() => {
    window.addEventListener("pointerdown", unlock);
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  useEffect(() => {
    const p = prev.current;
    prev.current = state;
    if (!p || !state) return;
    const playing = state.phase === "playing";
    if (state.phase === "countdown" && state.countdown !== p.countdown) play("knock"); // 3, 2, 1
    if (playing && p.phase !== "playing") play("knock", { rate: 1.5 }); // go
    else if (playing && state.speaker !== p.speaker) play("knock", { rate: state.speaker === "moderator" ? 0.7 : 1.2, vol: 0.8 }); // spotlight moves
    // The bar moved: the side that gained was clapping its own candidate or booing the other one.
    if (playing && state.rope !== p.rope && state.speaker && state.speaker !== "moderator") {
      const gained: Party = state.rope < p.rope ? "orange" : "blue";
      if (gained === state.speaker) play("clap", { gap: 90, rate: 0.9 + Math.random() * 0.25 });
      else {
        booTo(0.8);
        clearTimeout(booOff);
        booOff = setTimeout(() => booTo(0), 450); // stops shortly after the last boo
      }
    }
    if (playing && state.timeLeft !== p.timeLeft && state.timeLeft <= 5) play("knock", { rate: 2, vol: 0.5 }); // last seconds
    if (state.phase === "ended" && p.phase === "playing") {
      booTo(0);
      play("tada");
    }
  }, [state]);
}

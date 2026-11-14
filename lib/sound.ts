"use client";
import { useEffect, useRef } from "react";
import type { State } from "./game";

// Synthesised beeps (Web Audio), no audio files.
let ctx: AudioContext | null = null;

function beep(freq: number, ms = 120, type: OscillatorType = "square", vol = 0.15, delay = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + ms / 1000);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + ms / 1000);
}

const SPEAKER_TONE = { orange: 520, blue: 660, moderator: 200 } as const;

// Plays sounds for state changes on the projector.
export function useSounds(state: State | null) {
  const prev = useRef<State | null>(null);

  // Browsers only allow audio after a user gesture (e.g. clicking Start).
  useEffect(() => {
    const unlock = () => {
      ctx ??= new AudioContext();
      ctx.resume();
    };
    window.addEventListener("pointerdown", unlock);
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  useEffect(() => {
    const p = prev.current;
    prev.current = state;
    if (!p || !state) return;
    const playing = state.phase === "playing";
    if (state.phase === "countdown" && state.countdown !== p.countdown) beep(440); // 3, 2, 1
    if (playing && p.phase !== "playing") beep(880, 400); // go
    else if (playing && state.speaker && state.speaker !== p.speaker) beep(SPEAKER_TONE[state.speaker], 200, "triangle", 0.3); // camera moves
    if (playing && state.rope !== p.rope) beep(state.rope < p.rope ? 900 : 700, 30, "square", 0.05); // a tap landed
    if (playing && state.timeLeft !== p.timeLeft && state.timeLeft <= 5) beep(1000, 80); // last seconds
    if (state.phase === "ended" && p.phase === "playing") [523, 659, 784, 1047].forEach((f, i) => beep(f, 250, "square", 0.15, i * 0.15)); // fanfare
  }, [state]);
}

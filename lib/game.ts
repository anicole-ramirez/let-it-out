// In-memory game state, shared by all route handlers in the single Node process.
export type Party = "orange" | "purple";
export type Speaker = Party | "moderator";
export const PARTIES: Party[] = ["orange", "purple"];
const SPEAKERS: Speaker[] = [...PARTIES, "moderator"];
export const ROUND_SECONDS = 30;
const GOAL_PER_PLAYER = 20; // rope steps per player on a team to win instantly

export type State = {
  phase: "lobby" | "playing" | "ended";
  players: Record<string, { party: Party }>;
  rope: number; // tug of war: -goal = orange wins, +goal = purple wins
  goal: number;
  speaker: Speaker | null; // who the camera is on
  timeLeft: number; // seconds
  winner: Party | null; // set when ended; null = draw
};

type Store = {
  state: State;
  listeners: Set<(s: State) => void>;
  timer?: ReturnType<typeof setInterval>;
  switchIn: number; // seconds until the camera moves
};

const lobby = (): State => ({
  phase: "lobby",
  players: {},
  rope: 0,
  goal: GOAL_PER_PLAYER,
  speaker: null,
  timeLeft: ROUND_SECONDS,
  winner: null,
});

// globalThis survives dev hot reloads and is shared across route bundles.
const g = globalThis as unknown as { __tug2?: Store };
const store: Store = (g.__tug2 ??= {
  state: lobby(),
  listeners: new Set(),
  switchIn: 0,
});

export const getState = () => store.state;

export function subscribe(fn: (s: State) => void) {
  store.listeners.add(fn);
  return () => {
    store.listeners.delete(fn);
  };
}

function emit() {
  for (const fn of store.listeners) fn(store.state);
}

function switchSpeaker() {
  const others = SPEAKERS.filter((x) => x !== store.state.speaker);
  store.state.speaker = others[Math.floor(Math.random() * others.length)];
  store.switchIn = 2 + Math.floor(Math.random() * 3); // 2-4 s
}

function end() {
  const s = store.state;
  clearInterval(store.timer);
  s.phase = "ended";
  s.speaker = null;
  s.winner = s.rope === 0 ? null : s.rope < 0 ? "orange" : "purple";
}

function tick() {
  if (--store.state.timeLeft <= 0) end();
  else if (--store.switchIn <= 0) switchSpeaker();
  emit();
}

function start(seconds: number) {
  const s = store.state;
  clearInterval(store.timer);
  s.phase = "playing";
  s.rope = 0;
  s.winner = null;
  s.timeLeft = seconds;
  // Bigger teams pull faster, so the rope gets longer.
  s.goal = GOAL_PER_PLAYER * Math.max(1, Math.ceil(Object.keys(s.players).length / 2));
  switchSpeaker();
  store.timer = setInterval(tick, 1000);
}

// Right reaction (clap your own politician, boo the other one) pulls the rope
// one step to your side. Anything else, incl. any input during the moderator,
// gives a step to the opponent.
function react(id: string, kind: "clap" | "boo") {
  const s = store.state;
  const me = s.players[id]?.party;
  if (!me || s.phase !== "playing") return null;
  const other: Party = me === "orange" ? "purple" : "orange";
  const right =
    (kind === "clap" && s.speaker === me) ||
    (kind === "boo" && s.speaker === other);
  const mySide = me === "orange" ? -1 : 1;
  s.rope += right ? mySide : -mySide;
  if (Math.abs(s.rope) >= s.goal) end();
  return { right };
}

export type Action =
  | { type: "join"; id: string; party: Party }
  | { type: "clap" | "boo"; id: string }
  | { type: "start"; seconds?: number } // seconds: shorter rounds for tests
  | { type: "reset" }; // back to the lobby, everyone rejoins

// Returns null if the action is rejected.
export function dispatch(a: Action): { right?: boolean } | null {
  const s = store.state;
  let result: { right?: boolean } | null = {};
  if (a?.type === "join" && a.id && PARTIES.includes(a.party)) {
    s.players[a.id] = { party: a.party };
  } else if (a?.type === "clap" || a?.type === "boo") {
    result = react(a.id, a.type);
  } else if (a?.type === "start" && s.phase !== "playing") {
    start(Number(a.seconds) > 0 ? Number(a.seconds) : ROUND_SECONDS);
  } else if (a?.type === "reset") {
    clearInterval(store.timer);
    store.state = lobby();
  } else {
    result = null;
  }
  if (result) emit();
  return result;
}

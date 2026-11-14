// In-memory game state, shared by all route handlers in the single Node process.
export type Party = "orange" | "purple";
export type Speaker = Party | "moderator";
export const PARTIES: Party[] = ["orange", "purple"];
const SPEAKERS: Speaker[] = [...PARTIES, "moderator"];
export const ROUND_SECONDS = 30;
const COUNTDOWN_SECONDS = 3;
const MIN_TAP_MS = 80; // faster taps are ignored: beyond one finger, so multi-finger tapping gains nothing
const GOAL_PER_PLAYER = 40; // rope steps per player on a team to win instantly

export type Player = {
  party: Party;
  name: string;
  right: number; // correct taps this round
  wrong: number; // wrong taps this round
  online: boolean; // phone currently connected
  ready: boolean; // voted for the next round
};

export type State = {
  phase: "lobby" | "countdown" | "playing" | "ended";
  players: Record<string, Player>;
  rope: number; // tug of war: -goal = orange wins, +goal = purple wins
  goal: number;
  weight: Record<Party, number>; // rope steps per tap; >1 for the smaller team
  speaker: Speaker | null; // who the camera is on
  countdown: number; // seconds until the round begins
  timeLeft: number; // seconds
  winner: Party | null; // set when ended; null = draw
  mode: "single" | "multi" | null; // chosen first on the big screen
  bot: Party | null; // single player: the party the computer plays
};

type Store = {
  state: State;
  listeners: Set<(s: State) => void>;
  conns: Record<string, number>; // open phone connections per player id
  lastTap: Record<string, number>; // time of each player's last counted tap
  timer?: ReturnType<typeof setInterval>;
  botTimer?: ReturnType<typeof setInterval>;
  switchIn: number; // seconds until the camera moves
};

const lobby = (): State => ({
  phase: "lobby",
  players: {},
  rope: 0,
  goal: GOAL_PER_PLAYER,
  weight: { orange: 1, purple: 1 },
  speaker: null,
  countdown: 0,
  timeLeft: ROUND_SECONDS,
  winner: null,
  mode: null,
  bot: null,
});

// globalThis survives dev hot reloads and is shared across route bundles.
const g = globalThis as unknown as { __tug6?: Store };
const store: Store = (g.__tug6 ??= {
  state: lobby(),
  listeners: new Set(),
  conns: {},
  lastTap: {},
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

const online = () => Object.values(store.state.players).filter((p) => p.online);

// A phone opened its event stream. Returns the disconnect function.
export function connect(id: string) {
  const setOnline = () => {
    const p = store.state.players[id];
    if (!p || p.online === store.conns[id] > 0) return;
    p.online = store.conns[id] > 0;
    maybeRestart(); // a leaver must not block the vote
    emit();
  };
  store.conns[id] = (store.conns[id] ?? 0) + 1;
  setOnline();
  return () => {
    store.conns[id]--;
    setOnline();
  };
}

function switchSpeaker() {
  const others = SPEAKERS.filter((x) => x !== store.state.speaker);
  store.state.speaker = others[Math.floor(Math.random() * others.length)];
  store.switchIn = 2 + Math.floor(Math.random() * 3); // 2-4 s
}

function end() {
  const s = store.state;
  clearInterval(store.timer);
  clearInterval(store.botTimer);
  s.phase = "ended";
  s.speaker = null;
  s.winner = s.rope === 0 ? null : s.rope < 0 ? "orange" : "purple";
}

function begin() {
  const s = store.state;
  s.phase = "playing";
  switchSpeaker();
  if (s.bot) store.botTimer = setInterval(botPull, 350);
}

function tick() {
  const s = store.state;
  if (s.phase === "countdown") {
    if (--s.countdown <= 0) begin();
  } else if (--s.timeLeft <= 0) end();
  else if (--store.switchIn <= 0) switchSpeaker();
  emit();
}

// Move the rope `steps` toward `party`'s side.
function pull(party: Party, steps: number) {
  const s = store.state;
  s.rope += party === "orange" ? -steps : steps;
  if (Math.abs(s.rope) >= s.goal) {
    s.rope = Math.sign(s.rope) * s.goal;
    end();
  }
}

// The bot never makes mistakes but is slower than a fast human.
function botPull() {
  const s = store.state;
  if (!s.bot || s.speaker === "moderator") return;
  pull(s.bot, s.weight[s.bot]);
  emit();
}

function start(seconds = ROUND_SECONDS, countdown = COUNTDOWN_SECONDS) {
  const s = store.state;
  clearInterval(store.timer);
  clearInterval(store.botTimer);
  s.rope = 0;
  s.winner = null;
  s.speaker = null;
  s.timeLeft = seconds;
  s.countdown = countdown;
  for (const p of Object.values(s.players)) Object.assign(p, { ready: false, right: 0, wrong: 0 });
  // Single player: the computer plays the party nobody joined.
  const taken = Object.values(s.players).map((p) => p.party);
  s.bot = (s.mode === "single" && PARTIES.find((p) => !taken.includes(p))) || null;
  // Fair fight for uneven teams: the rope length follows the bigger team, and a
  // tap from the smaller team (or the computer) counts for more, so the same
  // effort per person moves the rope equally for both sides.
  const size = (p: Party) => Math.max(1, online().filter((x) => x.party === p).length);
  const biggest = Math.max(size("orange"), size("purple"));
  s.goal = GOAL_PER_PLAYER * biggest;
  s.weight = { orange: biggest / size("orange"), purple: biggest / size("purple") };
  if (countdown > 0) s.phase = "countdown";
  else begin();
  store.timer = setInterval(tick, 1000);
}

// Next round starts once every connected phone has voted for it.
function maybeRestart() {
  const voters = online();
  if (store.state.phase === "ended" && voters.length > 0 && voters.every((p) => p.ready)) start();
}

// Right reaction (clap your own politician, boo the other one) pulls the rope
// to your side. Anything else, incl. any input during the moderator, gives the
// same distance to the opponent.
function react(id: string, kind: "clap" | "boo") {
  const s = store.state;
  const me = s.players[id]?.party;
  if (!me || s.phase !== "playing") return null;
  const now = Date.now();
  if (now - (store.lastTap[id] ?? 0) < MIN_TAP_MS) return {}; // too fast: not counted
  store.lastTap[id] = now;
  const other: Party = me === "orange" ? "purple" : "orange";
  const right =
    (kind === "clap" && s.speaker === me) ||
    (kind === "boo" && s.speaker === other);
  s.players[id][right ? "right" : "wrong"]++;
  pull(right ? me : other, s.weight[me]);
  return { right };
}

export type Action =
  | { type: "join"; id: string; party: Party; name?: string }
  | { type: "clap" | "boo"; id: string }
  | { type: "vote"; id: string } // phone: ready for the next round
  | { type: "start"; seconds?: number; countdown?: number } // overrides: shorter rounds for tests
  | { type: "mode"; mode: "single" | "multi" }
  | { type: "reset" }; // back to the mode choice, everyone rejoins

// Returns null if the action is rejected.
export function dispatch(a: Action): { right?: boolean } | null {
  const s = store.state;
  const idle = s.phase === "lobby" || s.phase === "ended";
  let result: { right?: boolean } | null = {};
  if (a?.type === "join" && a.id && PARTIES.includes(a.party)) {
    const name = String(a.name ?? "").trim().slice(0, 12) || "Player";
    s.players[a.id] = { party: a.party, name, right: 0, wrong: 0, online: store.conns[a.id] > 0, ready: false };
  } else if (a?.type === "clap" || a?.type === "boo") {
    result = react(a.id, a.type);
  } else if (a?.type === "vote" && s.phase === "ended" && s.players[a.id]) {
    s.players[a.id].ready = true;
    maybeRestart();
  } else if (a?.type === "start" && idle) {
    start(
      Number(a.seconds) > 0 ? Number(a.seconds) : undefined,
      a.countdown === undefined ? undefined : Number(a.countdown),
    );
  } else if (a?.type === "mode" && s.phase === "lobby" && ["single", "multi"].includes(a.mode)) {
    s.mode = a.mode;
  } else if (a?.type === "reset") {
    clearInterval(store.timer);
    clearInterval(store.botTimer);
    store.state = lobby();
  } else {
    result = null;
  }
  if (result) emit();
  return result;
}

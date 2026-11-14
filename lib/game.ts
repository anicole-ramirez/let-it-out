// In-memory game state, shared by all route handlers in the single Node process.
export type Party = "orange" | "purple";
export const PARTIES: Party[] = ["orange", "purple"];

export type State = {
  players: Record<string, { party: Party }>;
  claps: Record<Party, number>;
};

type Store = { state: State; listeners: Set<(s: State) => void> };

// globalThis survives dev hot reloads and is shared across route bundles.
const g = globalThis as unknown as { __game?: Store };
const store: Store = (g.__game ??= {
  state: { players: {}, claps: { orange: 0, purple: 0 } },
  listeners: new Set(),
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

export type Action =
  | { type: "join"; id: string; party: Party }
  | { type: "clap"; id: string }
  | { type: "reset" };

export function dispatch(a: Action) {
  const s = store.state;
  if (a.type === "join" && PARTIES.includes(a.party)) {
    s.players[a.id] = { party: a.party };
  } else if (a.type === "clap" && s.players[a.id]) {
    s.claps[s.players[a.id].party]++;
  } else if (a.type === "reset") {
    s.players = {};
    s.claps = { orange: 0, purple: 0 };
  } else {
    return false;
  }
  emit();
  return true;
}

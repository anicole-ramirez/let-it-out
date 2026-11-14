// Unit tests for lib/game.ts. Run: npm test
import { afterEach, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import * as nodeModule from "node:module";
import type { Party } from "./game";

type Game = typeof import("./game");
let game: Game;
let n = 0; // cache-busting counter: each test gets a fresh module + store
let r = 0; // Math.random value: 0 → orange speaks first, 0.4 → blue, 0.7 → moderator

// Resolve the "@/" alias (used by route handlers), keeping the importer's query
// so the route shares the test's fresh game module.
const hooks = nodeModule as unknown as { registerHooks: (h: object) => void };
const root = new URL("../", import.meta.url);
hooks.registerHooks({
  resolve(spec: string, ctx: { parentURL?: string }, next: (s: string, c: object) => unknown) {
    if (!spec.startsWith("@/")) return next(spec, ctx);
    const search = ctx.parentURL ? new URL(ctx.parentURL).search : "";
    return { url: new URL(spec.slice(2) + ".ts" + search, root).href, shortCircuit: true };
  },
});

beforeEach(async () => {
  mock.timers.enable({ apis: ["setInterval", "Date"], now: 1_000_000 });
  mock.method(Math, "random", () => r);
  r = 0;
  delete (globalThis as { __tug8?: unknown }).__tug8;
  game = await import(`./game.ts?t=${++n}`);
});

afterEach(() => {
  game.dispatch({ type: "reset" });
  mock.timers.reset();
  mock.restoreAll();
});

const ms = (t: number) => mock.timers.tick(t);
const state = () => game.getState();
const player = (id: string) => state().players[id];
const join = (id: string, party: Party) => {
  game.dispatch({ type: "join", id, party, name: id });
  return game.connect(id);
};
const tap = (id: string, kind: "clap" | "boo") => game.dispatch({ type: kind, id });
// Taps right or wrong for whoever is speaking now.
const react = (id: string, right: boolean) => {
  const sp = state().speaker;
  const own = sp === player(id).party;
  return tap(id, sp === "moderator" || own === right ? "clap" : "boo");
};
// Starts a round with no countdown; the speaker follows `r`.
const play = (seconds = 30) => game.dispatch({ type: "start", seconds, countdown: 0 });

test("online: connect before join", () => {
  const off = game.connect("a");
  game.dispatch({ type: "join", id: "a", party: "orange" });
  assert.equal(player("a").online, true);
  off();
  assert.equal(player("a").online, false);
});

test("online: join before connect", () => {
  game.dispatch({ type: "join", id: "a", party: "orange" });
  assert.equal(player("a").online, false);
  const off = game.connect("a");
  assert.equal(player("a").online, true);
  off();
  assert.equal(player("a").online, false);
});

test("online: two connections, one closes", () => {
  const off1 = join("a", "orange");
  const off2 = game.connect("a");
  off1();
  assert.equal(player("a").online, true);
  off2();
  assert.equal(player("a").online, false);
});

test("online: SSE request already aborted counts as offline", async () => {
  const { GET } = await import(`../app/api/events/route.ts?t=${n}`);
  game.dispatch({ type: "join", id: "a", party: "orange" });
  await GET(new Request("http://x/api/events?id=a", { signal: AbortSignal.abort() }));
  assert.equal(player("a").online, false);
  // A live stream is online until aborted.
  const ctl = new AbortController();
  await GET(new Request("http://x/api/events?id=a", { signal: ctl.signal }));
  assert.equal(player("a").online, true);
  ctl.abort();
  assert.equal(player("a").online, false);
});

test("vote: next round starts when every online player voted", () => {
  join("a", "orange");
  join("b", "blue");
  game.dispatch({ type: "join", id: "c", party: "blue" }); // offline: no vote needed
  play(1);
  ms(1000);
  assert.equal(state().phase, "ended");
  game.dispatch({ type: "vote", id: "a" });
  assert.equal(state().phase, "ended");
  game.dispatch({ type: "vote", id: "b" });
  assert.equal(state().phase, "countdown");
});

test("vote: a leaver does not block the vote", () => {
  join("a", "orange");
  const offB = join("b", "blue");
  play(1);
  ms(1000);
  game.dispatch({ type: "vote", id: "a" });
  offB();
  assert.equal(state().phase, "countdown");
});

test("round: countdown → playing → ended by timer", () => {
  const phases: string[] = [];
  game.subscribe((s) => phases.push(s.phase));
  join("a", "orange");
  game.dispatch({ type: "start" });
  assert.equal(state().phase, "countdown");
  assert.equal(state().countdown, 3);
  ms(3000);
  assert.equal(state().phase, "playing");
  assert.equal(state().speaker, "orange");
  ms(30_000);
  assert.equal(state().phase, "ended");
  assert.equal(state().winner, null); // rope 0 = draw
  assert.equal(state().speaker, null);
  assert.ok(phases.includes("playing") && phases.at(-1) === "ended");
  ms(10_000); // timer stopped
  assert.equal(state().timeLeft, 0);
});

test("round: filling the bar wins instantly and stops the timer", () => {
  join("a", "orange");
  play();
  const goal = state().goal;
  for (let i = 0; i < goal - 1; i++, ms(80)) react("a", true);
  assert.equal(state().phase, "playing");
  react("a", true);
  assert.equal(state().phase, "ended");
  assert.equal(state().winner, "orange");
  assert.equal(state().rope, -goal);
  const left = state().timeLeft;
  ms(60_000);
  assert.equal(state().timeLeft, left);
});

test("round: no stale timers after reset or restart", () => {
  join("a", "orange");
  game.dispatch({ type: "start" });
  ms(1000);
  game.dispatch({ type: "reset" });
  ms(5000);
  assert.equal(state().phase, "lobby");
  join("a", "orange");
  game.dispatch({ type: "start" });
  ms(1000);
  assert.equal(state().countdown, 2); // one timer, not two
  // Restart via vote after the round ends.
  ms(2000 + 30_000);
  assert.equal(state().phase, "ended");
  game.dispatch({ type: "vote", id: "a" });
  ms(1000);
  assert.equal(state().countdown, 2);
});

test("score: right and wrong reactions, per player", () => {
  join("a", "orange");
  join("b", "blue");
  play(); // orange speaks
  assert.deepEqual(tap("a", "clap"), { right: true }); // clap own
  assert.equal(state().rope, -1);
  assert.deepEqual(tap("b", "boo"), { right: true }); // boo other
  assert.equal(state().rope, 0);
  ms(100);
  assert.deepEqual(tap("a", "boo"), { right: false }); // boo own
  assert.equal(state().rope, 1);
  ms(100);
  assert.deepEqual(tap("b", "clap"), { right: false }); // clap other
  assert.equal(state().rope, 0);
  assert.deepEqual([player("a").right, player("a").wrong], [1, 1]);
  assert.deepEqual([player("b").right, player("b").wrong], [1, 1]);
});

test("score: any tap during the moderator is wrong", () => {
  r = 0.7;
  join("a", "orange");
  play();
  assert.equal(state().speaker, "moderator");
  tap("a", "clap");
  ms(100);
  tap("a", "boo");
  assert.equal(player("a").wrong, 2);
  assert.equal(state().rope, 2); // toward blue
});

test("score: taps faster than MIN_TAP_MS are ignored", () => {
  join("a", "orange");
  play();
  tap("a", "clap");
  ms(79);
  assert.deepEqual(tap("a", "clap"), {});
  assert.equal(player("a").right, 1);
  ms(1);
  tap("a", "clap");
  assert.equal(player("a").right, 2);
});

test("score: uneven teams get weights, goal and a clamped rope", () => {
  const perPlayer = state().goal; // lobby goal = one player per team
  join("a1", "orange");
  join("a2", "orange");
  join("b", "blue");
  game.dispatch({ type: "join", id: "a3", party: "orange" }); // offline: not counted
  play();
  const goal = state().goal;
  assert.equal(goal, 2 * perPlayer);
  assert.deepEqual(state().weight, { orange: 1, blue: 2 });
  react("a1", false); // +1 toward blue
  // b's wrong taps pull 2 each toward orange; stop one step before the goal.
  while (state().rope > 1 - goal && state().phase === "playing") {
    react("b", false);
    ms(80);
  }
  assert.equal(state().rope, 1 - goal);
  react("b", false); // overshoots by 1 → clamped
  assert.equal(state().rope, -goal);
  assert.equal(state().winner, "orange");
});

test("single player: bot plays the empty party, not during the moderator", () => {
  game.dispatch({ type: "mode", mode: "single" });
  join("a", "orange");
  r = 0.7;
  play(1);
  assert.equal(state().bot, "blue");
  ms(1000);
  assert.equal(state().rope, 0); // moderator the whole round
  r = 0; // next round: orange speaks
  game.dispatch({ type: "vote", id: "a" });
  ms(3000); // countdown; separate tick so the mock runs the bot interval it creates
  ms(350); // too soon after the spotlight moved (450 ms reaction time): no pull
  assert.equal(state().rope, 0);
  ms(350);
  assert.equal(state().rope, 1); // then one pull every 350 ms
});

test("multi player: no bot", () => {
  game.dispatch({ type: "mode", mode: "multi" });
  join("a", "orange");
  play();
  assert.equal(state().bot, null);
});

test("speakers: candidates take turns, exchanges are quick, the moderator never follows himself", () => {
  join("a", "orange");
  const seen: [string, number][] = []; // [speaker, ms held]
  let since = 0;
  const watch = () => {
    for (let t = 0; t < 4000; t += 100) {
      const before = state().speaker!;
      ms(100);
      since += 100;
      if (state().speaker !== before) {
        seen.push([before, since]);
        since = 0;
      }
    }
  };
  play(60);
  watch(); // r = 0: an exchange, orange first
  r = 0.7;
  watch(); // moderator cuts in, then a speech
  r = 0.5;
  watch(); // speeches
  assert.equal(seen[0][0], "orange");
  assert.ok(seen.slice(0, 3).every(([, held]) => held <= 1200), "exchange turns are short");
  assert.ok(seen.some(([who]) => who === "moderator"));
  assert.ok(seen.some(([, held]) => held >= 2500), "speeches are long");
  for (let i = 1; i < seen.length; i++) assert.notEqual(seen[i][0], seen[i - 1][0], "the speaker always changes");
});

test("speakers: the pace picks up in the last 10 seconds", () => {
  join("a", "orange");
  r = 0.5; // speeches of 3250 ms
  play(12);
  const first = state().speaker;
  ms(3200);
  assert.equal(state().speaker, first); // still the first speech
  ms(100);
  const second = state().speaker;
  assert.notEqual(second, first);
  ms(2400); // timeLeft was 9 when the second one started: 3250 * 0.7 = 2275 ms
  assert.notEqual(state().speaker, second);
});

// Orange fills the bar and wins the round.
const winRound = () => {
  play();
  const goal = state().goal;
  for (let i = 0; i < goal; i++, ms(80)) react("a", true);
};

test("levels: two round wins end the match early; the next start is a new match", () => {
  join("a", "orange");
  winRound();
  assert.deepEqual([state().level, state().wins.orange, state().final, state().champion], [1, 1, false, null]);
  winRound();
  assert.deepEqual([state().level, state().wins.orange, state().final, state().champion], [2, 2, true, "orange"]);
  play();
  assert.deepEqual([state().level, state().wins.orange, state().final], [1, 0, false]);
});

test("levels: drawn rounds go to the third level, and an even match is a tie", () => {
  join("a", "orange");
  for (const level of [1, 2, 3]) {
    play(1);
    assert.equal(state().level, level);
    ms(1000);
    assert.equal(state().phase, "ended");
    assert.equal(state().final, level === 3);
  }
  assert.equal(state().champion, null);
});

test("levels: speeches get shorter with each level", () => {
  join("a", "orange");
  r = 0.5; // a speech, not an exchange, on every level
  const speech = () => {
    play();
    const first = state().speaker;
    let t = 0;
    while (state().speaker === first) (ms(100), (t += 100));
    game.dispatch({ type: "reset" });
    return t;
  };
  const one = speech();
  join("a", "orange");
  winRound();
  r = 0.5;
  const two = speech();
  assert.ok(two < one, `${two} < ${one}`);
});

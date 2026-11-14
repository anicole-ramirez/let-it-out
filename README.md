# Let it out!

Hackathon party game. Design: [DESIGN.md](DESIGN.md).

- `/` phone: join a party, then CLAP or BOO; vote "Play again" after a round.
- `/screen` projector: mode choice, QR code to join, countdown, debate stage, percentage bar. Plays the sound effects (`lib/sound.ts`).
- Phone → `POST /api/action` → in-memory state (`lib/game.ts`) → SSE `GET /api/events` → screen and phones.

## Rules

- The camera switches between both politicians and the moderator.
- Clap your own politician or boo the other one to grow your share of the bar. Any other tap, incl. during the moderator, grows the other side.
- Filling the whole bar wins instantly; otherwise the bigger share after 30 s wins.
- Uneven teams: the bar takes more taps to fill and taps from the smaller team count for more.
- Players enter a name; the end screen lists correct and wrong taps per player.
- Anti-cheat: only the first finger on the phone counts, and the server ignores taps less than 80 ms apart.
- Single player: the computer plays the party nobody joined.
- The next round starts when every connected phone voted "Play again" (or "Start now" on the screen).

## Run

```
npm install
npm run dev
```

Open `http://localhost:3000/screen` on the projector; phones on the same Wi-Fi scan the QR code.

State lives in one Node process: run a single instance, restart clears it.

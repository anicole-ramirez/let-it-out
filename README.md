# Let it out!

Hackathon party game. Design: [DESIGN.md](DESIGN.md).

- `/` phone: join a party, then CLAP or BOO; vote "Play again" after a round.
- `/screen` projector: mode choice, QR code to join, countdown, debate stage, tug-of-war bar.
- Phone → `POST /api/action` → in-memory state (`lib/game.ts`) → SSE `GET /api/events` → screen and phones.

## Rules

- The camera switches between both politicians and the moderator.
- Clap your own politician or boo the other one to pull the rope. Any other tap, incl. during the moderator, pulls it the other way.
- Rope end wins instantly; otherwise the side the knot is on after 30 s wins.
- Uneven teams: the rope gets longer and taps from the smaller team count for more.
- Single player: the computer plays the party nobody joined.
- The next round starts when every connected phone voted "Play again" (or "Start now" on the screen).

## Run

```
npm install
npm run dev
```

Open `http://localhost:3000/screen` on the projector; phones on the same Wi-Fi scan the QR code.

State lives in one Node process: run a single instance, restart clears it.

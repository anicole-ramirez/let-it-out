# Let it out!

Hackathon party game. Design: [DESIGN.md](DESIGN.md).

- `/` phone: join a party, then CLAP or BOO.
- `/screen` projector: QR code to join, debate stage, tug-of-war bar.
- Rules: the camera switches between both politicians and the moderator. Clap your own politician or boo the other one to pull the rope; any other tap (incl. during the moderator) gives a step to the opponent. Rope end or the higher side after 30 s wins.
- Phone → `POST /api/action` → in-memory state (`lib/game.ts`) → SSE `GET /api/events` → screen.

## Run

```
npm install
npm run dev
```

Open `http://localhost:3000/screen` on the projector; phones on the same Wi-Fi scan the QR code.

State lives in one Node process: run a single instance, restart clears it.

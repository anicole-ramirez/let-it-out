# Let it out!

Hackathon party game. Design: [DESIGN.md](DESIGN.md).

- `/` phone: join a party, tap to clap.
- `/screen` projector: live bars per party.
- Phone → `POST /api/action` → in-memory state (`lib/game.ts`) → SSE `GET /api/events` → screen.

## Run

```
npm install
npm run dev
```

Open `http://<laptop-LAN-IP>:3000/screen` on the projector; phones on the same Wi-Fi open the URL it shows.

State lives in one Node process: run a single instance, restart clears it.

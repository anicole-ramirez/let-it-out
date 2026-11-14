# Let it out! — visual design brief

Restyle our existing game to this design. **Keep all game logic as it is; change only visuals and screen flow.**
Look at `screens/*.png` first: they are the target. This file explains them.

## Folder
- `screens/01-08*.png` — target screens (1280×720): logo, 3 intro frames, gameplay, results newspaper, sprite sheet, style guide
- `assets/pixel/` — pixel-art characters as SVG + `sprites.json` (pixel maps + palette; `.` = transparent)
- `assets/bobbleheads/` — alternative smooth characters (transparent SVG). **Use one character set, not both** (default: pixel)
- `fonts/` — Silkscreen, VT323, UnifrakturMaguntia, Old Standard TT (all OFL, load with @font-face)
- `reference-game.html` — a working prototype with the same rules, for reference only

## Vibe
Gritty retro pixel art: a bureaucratic TV studio seen on an old CRT. Muted colors, hard black outlines, no gradients, no rounded corners, no emoji. Characters look a bit angry. The player should feel like they are **in the audience, between the two candidates**.

## Fonts
- **Silkscreen 700** — headings, buttons, prompts, numbers. UPPERCASE.
- **VT323** — body, speech bubbles, hints. Min 24px.
- Newspaper only: **UnifrakturMaguntia** (masthead) + **Old Standard TT** (headline, body).

## Colors
```
--void:  #17130F  (outside the TV)     --wall:  #2B2420     --floor: #4A4038
--ink:   #1E1A16  (all outlines)       --paper: #D9D2B6     --cream: #E8E0C8
--mod:   #C9A43A  (moderator gold)     --brick: #A8443A     --error: #D9473A
--teamA: player's choice (default #C8693A, shade #8E4526)
--teamB: teamA hue + 180°, same S/L (default #3A8CB0, shade #25607C)
```
Characters wear their team color. The moderator is always grey with a gold sash.

## Components
- **Button**: Silkscreen 700, 5px ink border, `box-shadow: 5px 5px 0 #000`, square. Pressed = translate(3px,3px).
- **Panel**: paper bg, 5px ink border, 8px hard shadow.
- **Tug bar**: ONE bar. Team A fills from the left, team B is the background. 6px cream divider at the split, 5px ink border + 4px #6B5A44 outline, a team-color square at each end.
- **Timer**: Silkscreen 38px, box with a 5px cream border; under 10s red border and red text.
- **Speech bubble**: cream, 5px ink border, hard shadow, VT323 32px, text in quotes, UPPERCASE.
- **Action prompt** (bottom center): big Silkscreen box: `CLAP!` (team A) / `BOO!` (team B) / `SHHH!` (gold).
- **Grain** on everything: `radial-gradient(#00000040 1px, transparent 1px) 0 0/4px 4px`.

## Screen flow
1. **Intro** (~3.7s, any key/tap skips) — `screens/02-04`
   a) Dark room, old wooden CRT on a table, screen shows grey static.
   b) Channel clicks on: "WELCOME TO" (gold) / "LET IT OUT!" / "PRESS ANY KEY TO TUNE IN", with scanlines; flicker twice.
   c) Zoom into the screen: scale the TV 1 → 6 with `steps(8)`; the bezel leaves the frame; the game is now inside the TV.
2. **Title / logo** — `screens/01`
   Black background. Blocky extruded letters: "LET IT" with an extrusion in team A shade, "OUT!" in team B shade, cream faces. Emblem above: shield split orange/blue with a megaphone, flanked by equalizer bars (orange left, blue right) that pulse. Menu items in VT323 with dotted underlines.
3. **Color pick**: paper panel styled as a form ("FORM 01 · PARTY REGISTRATION"), 6 square swatches, "YOU vs THEM" preview with the auto-opposite color.
4. **Gameplay (inside the TV)** — `screens/05`
   - HUD strip (ink): timer centered, tug bar below.
   - Studio: red/brown curtain stripes, "THE GREAT DEBATE" banner in gold, two hanging stage lights.
   - Candidate A on the left, candidate B on the right (B mirrored, so they face each other), each with a mic stand. Moderator smaller, center back, behind a desk labeled MODERATOR.
   - Spotlight beam (light trapezoid, ~20% opacity) on whoever talks; the others dim to ~55–70%.
   - Speech bubble near the speaker.
   - Foreground: the audience **from behind** (`crowd_back` sprite, 2 rows, the back row smaller and dimmer, random hair colors): team A left, grey middle, team B right. A few hold signs (`sign` sprite + text like YES! / BOO).
   - The reacting side brightens; pixel words (CLAP CLAP, BOOO!, YEAH!) float up 50px and fade.
   - CRT overlay: scanlines `repeating-linear-gradient(0deg,#00000026 0 2px,transparent 2px 4px)`, vignette, 22px TV bezel frame (#3A332C) with rounded inner corners.
   - Wrong action: 10px red border flash + 8px shake for 300ms, "ORDER!" floater.
5. **Results newspaper** — `screens/06`
   Old broadsheet, rotated −1.2°, on a dark background. Masthead "The Daily Debate" (blackletter) with double rules; small text "VOL. I · No. 30", "PRICE: ONE BOO", "ALL THE NOISE THAT'S FIT TO PRINT".
   Headline: `[COLOR] WINS IN LANDSLIDE` (> 25 points from 50%), `TAKES THE DEBATE` (> 10), else `WINS PHOTO FINISH`. Italic subhead (e.g. "Blue camp demands recount; moderator demands silence").
   Grayscale halftone photo of both candidates, 2 short text columns, "FINAL CROWD SHARE" bar, red rotated stamp "RECOUNT DENIED". Buttons: REMATCH, MENU.

## Characters (pixel set)
- Draw sprites at a whole-number scale (×6–×7) with `image-rendering: pixelated` / `shape-rendering: crispEdges`.
- Talking = swap `*_idle` / `*_talk` every 180ms + 1px head nod.
- Recolor per team using the palette slots `C` (suit) and `c` (shade) in `sprites.json`.
- No sound and no microphone: BOO is a held button (or a held key).

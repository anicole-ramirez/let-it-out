# Let it out! — Design

Source: 4 photos in `pitch/`. Images 1-3 are hand-drawn storyboard panels on one large sheet (blue pen, purple and orange/brown markers). Image 4 is a handwritten text page. All photos carry EXIF orientation 3 (180°), which appears wrong; descriptions below use the upright orientation (text readable).

## 1. High-level design

Literal (from image 4 text + image 1 mockup):
- Title: **"Let it out!"**
- Political support game: players interact with the screen to win support for their party.
- Clap when your politician talks, boo the opposing party.
- Three character types on screen: your party (clap by pressing the screen), not your party (boo into the camera), moderator (be quiet).
- Camera pans between your party, the other party and the moderator; you must react appropriately.
- One running score bar per party; cheering fills the party's bar, booing reduces the party's bar.
- Timer: text says 00:30; mockup shows "2:30 TIME". Win: cheer/boo more than the other party by the time the timer ends.

Interpretation [inferred]:
- Core loop: watch who the camera shows → give the matching reaction (tap = clap, voice = boo, silence = moderator) → bars change → higher bar at timer end wins.
- Inputs: touchscreen taps for clapping; "boo into the camera" suggests webcam/microphone (likely mic loudness).
- Two factions color-coded orange/brown and purple. In image 1, orange audience claps, purple audience boos.
- Setting: political debate stage — lecterns, moderator in the middle, audience split in two halves.
- Art direction: simple, cartoony, two-color party identity.
- Scope: one short timed round; single- vs multiplayer not specified.

## 2. Extracted content per image

### 20261114_150824.JPG — main gameplay screen mockup

Text (literal):
- `CLAP` — label above left bar
- `BOO` — label above right bar
- `2:30 TIME` — top right [unsure: "2:30" vs "2:39"; last digit drawn like "∂", most likely 0]
- `Boo` — inside a cloud/speech bubble on the right

Drawing:
- One framed storyboard cell; edges of neighbouring cells visible.
- Top center: two vertical bar gauges.
  - `CLAP` bar: orange/brown fill, nearly full.
  - `BOO` bar: purple fill, about 2/3 full.
- Between the bars: small orange head on a line, attached to a lectern/podium (cylinder) below — politician speaking [inferred: orange party's politician].
- Below podium: large fan/semicircle audience area split by a vertical line.
  - Left half: ~11 orange/brown audience members (circle head + line body). One near the top has a raised arm with a large drawn hand — clapping/waving.
  - Right half: ~9 purple audience members with agitation/motion strokes; a line from one leads to the `Boo` bubble.

### 20261114_150830.JPG — camera pan storyboard

Text: none. Two small squiggles in the audience area `[illegible]`, probably doodled people, not text.

Drawing:
- Three overlapping frames (camera views):
  - Left frame: lectern/podium with a head on a stick behind it; crosshair (horizontal + vertical line) over it.
  - Right frame: second lectern with a head behind it; crosshair.
  - Center frame, raised above the other two: heavily scribbled figure [unsure: moderator]; crosshair.
- Double-headed arrow between left and right frames.
- Below: large curved fan/bowl shape (audience area, same shape as image 1).
- Top edge: part of a neighbouring cell (arc + vertical line, the audience fan of another cell).

Interpretation [inferred]: camera panning between your politician, the opposing politician and the moderator (center) — matches "Camera pans between your party, the other party and the moderator" in image 4.

### 20261114_150833.JPG — two characters with up/down markers

Text: none.

Drawing:
- One framed storyboard cell.
- Left: stick figure (round head, single-line body, small loop at the bottom) next to a large purple filled rectangle; up-triangle above, down-triangle below the rectangle.
- Right: stick figure (round head, body with two short arm lines angled down) next to an orange/brown filled rounded rectangle; up-triangle above, down-triangle below.

Interpretation [unsure]: character/party selection (up/down arrows to cycle), or per-party meters with up/down indicators. Not explained in the text.

### 20261114_150940.JPG — written pitch (English)

Transcription (strikethroughs noted):

> **Let it out!**
>
> - Political support game where players need to interact with the screen to win their party support
> - Support your political party!
> - Clap when your politician ~~[illegible]~~ is talking
> - Boo the oppossing party
> - Interact the most ~~[illegible]~~ w/ ~~[illegible]~~ the screen to win support for your party.
> - Three types of characters:
>   - Your party; where you have to ~~[illegible]~~ support by clapping when pressing on the screen
>   - Not your party, where you have to boo into the camera.
>   - moderator, where you have to be quiet.
> - You win once the timer is over ( ~~[illegible]~~ 00:30 minutes)
> - You have to cheer/boo more than the other party cheers/boos.
>
> *How it works:* (margin note)
> Camera pans between your party, the other party and the moderator and you have to react appropriately
> - ~~[illegible, unsure: "If you make..."]~~ There is a running scorebar for each party that fills based on how much you cheer or boo
>   - cheering fills up the ~~[illegible]~~ party's bar
>   - booing reduces the party's bar

Notes:
- "00:30" written above a crossed-out value; "minutes" kept [unsure: 30 seconds or 30 minutes].
- A corner of an orange/purple drawing from the other sheet is visible at the edge.

## 3. Open questions / unclear parts

- Round length: text "00:30 minutes" vs mockup "2:30".
- Win condition: "win once the timer is over" vs "cheer/boo more than the other party" — score comparison at the end?
- Who is "the other party": AI, local second player, online? Single- or multiplayer?
- Which bar does booing reduce — the opposing party's? Text only says "the party's bar".
- Bars: mockup labels them `CLAP` / `BOO`; text says one bar per party.
- Boo input: mic volume, webcam (face/mouth detection), or both? Target platform (mobile, web, desktop)?
- Clap: does tap rate matter? Any cap?
- Moderator: what counts as "quiet"? Penalty for noise?
- Penalties for wrong reactions (clapping for opponent, booing your own)?
- Camera pan timing: random, scripted, speeding up?
- Do politicians speak (audio/text) or only animate?
- Meaning of image 3 (stick figures + colored blocks + up/down arrows).
- Image 2 center figure: moderator?
- Party colors orange/purple: fixed or chosen? Fictional parties?
- Art style, audio, menus, end screen: not specified.

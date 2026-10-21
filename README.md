# Button Boxer

A quizzer for memorizing the treble buttons of a two-row half-step button accordion
(currently a 21-button C#/D). It highlights an anchor button inside a hand-span box,
lights up a nearby button with a bellows direction (← pull, → push), and you name the note.

- **Practice:** tap to reveal, then swipe → if you got it right or ← if you didn't. You can
  swipe without revealing; the answer flashes briefly. On desktop: Space reveals, ←/→
  mark wrong/right.
- **Blitz:** automatic. The box moves to a new anchor, the target lights up, and the
  answer is shown after the timer runs out.

See [SPEC.md](SPEC.md) for the full design.

## Running locally

The page loads layout JSON, so serve it over HTTP:

```sh
python3 -m http.server 8000   # or: npm run serve
# open http://localhost:8000
```

Tests (Node 18+, no dependencies): `npm test`

## Photo view and calibration

Layouts can include a photo of the keyboard from the player's view. Button positions
are calibrated in the layout JSON. To adjust them, switch Mode to **Edit circles**,
drag or resize the circles, then **Download** (or **Copy JSON**) and replace the layout
file with the result.

## Adding a layout

Copy `layouts/cs-d-21.json`, edit the rows (inner row first, buttons lowest pitch
first, `offset: -0.5` / `0.5` for the half-button stagger), and add it to
`layouts/index.json`. A Layout dropdown appears once there's more than one.
For a photo, add the image under `layouts/photos/` (strip its EXIF/GPS metadata
first) and a `photo` block with a rough point for every button. Then fine-tune the
points in Edit circles mode.

## Hosting

Plain static files with no build step. Enable GitHub Pages on the default branch (root).

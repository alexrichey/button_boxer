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

## Adding a layout

Copy `layouts/cs-d-21.json`, edit the rows (inner row first, buttons lowest pitch
first, `offset: -0.5` / `0.5` for the half-button stagger), and add it to
`layouts/index.json`. A Layout dropdown appears once there's more than one.

## Hosting

Plain static files with no build step. Enable GitHub Pages on the default branch (root).

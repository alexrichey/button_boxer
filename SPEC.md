# Button Box Quizzer — Spec

A small static web app that helps you memorize the treble side of a 21-button C#/D
half-step chromatic button accordion (Saltarelle Aether II). It shows an **anchor** button
inside a box you can reach with one hand, lights up a **quiz** button with a bellows
direction, and asks: *what note is that?*

Sources: `the_work.md` (goals), `questions.md` (answers to the design questions),
`media/layout.png` (button chart).

---

## 1. Instrument model

### 1.1 Rows

| Row | Position | Buttons | Notes |
|-----|----------|---------|-------|
| **D row** | inner (left on screen, closer to the bellows) | 10 | main row |
| **C# row** | outer (right on screen) | 11 | half-step row |

### 1.2 Button chart (push / pull), lowest pitch first

Transcribed from `media/layout.png`. Button numbers count from the lowest pitch.

**D row (inner, 10 buttons)**

| # | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|----|
| Push | F# | A | D | F# | A | D | F# | A | D | F# |
| Pull | B | C# | E | G | B | C# | E | G | B | C# |

**C# row (outer, 11 buttons)**

| # | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 |
|---|---|---|---|---|---|---|---|---|---|----|----|
| Push | F | G# | C# | F | G# | C# | F | G# | C# | F | G# |
| Pull | A# | C | D# | F# | A# | C | D# | F# | A# | C | D# |

### 1.2a Pluggable layouts

Layouts are JSON files in `layouts/`, listed in `layouts/index.json`. A layout gives
its rows from inner to outer, each with a vertical `offset` (the stagger) and its
buttons from lowest pitch up as `{push, pull}`. It also names the `boxRow` the box is
measured along and an optional `reference` button. Adding an instrument (e.g. a B/C)
means adding a JSON file and an index entry. When there's more than one layout, a
Layout dropdown appears. `js/layout.js` checks and normalizes the file, and no other
code knows about specific instruments. Notes are stored as
pitch classes in sharp spelling. How they're displayed depends on the key (§2.2).

### 1.3 Geometry (stagger)

The two rows are offset by half a button. In the chart, C# button *k* sits
between D buttons *k − 1* and *k*. Internally each button gets a vertical
position `pos`:

- D row button *j* → `pos = j`
- C# row button *k* → `pos = k − 0.5`

Rendering and the box logic both use `pos`.

### 1.4 Photo calibration

A layout can include a `photo`: an image of the instrument from the player's view
(`layouts/photos/`, with metadata stripped) and, per button, its centre in photo pixels
`{x, y}` and a radius `r` in keyboard units. `js/photo.js` fits a homography (perspective
transform) from flat keyboard coordinates (x = row index, y = pos) to those centres.
Each button's outline is a circle of radius `r` mapped through it, so it gets the
photo's perspective, and is shifted so its centre lands on the calibrated point. The
box outline is the box rectangle mapped the same way.

In the C#/D photo, the **end nearest the camera is the low end** (button 1).

(The middle-D reference fill was removed. The quiz works better without it.)

---

## 2. Keys

### 2.1 Supported keys (v1)

Major keys: **F, C, G, D, A, E, B**, picked from a dropdown. Default: D.

### 2.2 Spelling

- F major uses flats (A# shows as **Bb**).
- Every other key uses sharps.

### 2.3 What's "in play"

A **quiz item** is a `(button, direction)` pair, where direction is push or pull. An item
is in play for a key if the note it sounds is in that major scale. Example: in D major,
every D-row item is in play, plus the C#-row items that sound F# or C#.

Anchors and quiz targets are always drawn from the in-play items.

---

## 3. Core concepts

### 3.1 Anchor

- A random in-play `(button, direction)`, on either row.
- Shown with a **thick magenta outline**, plus a magenta **badge with the direction
  arrow and the anchor's note name**. With the rows drawn vertically, "above" the button
  is where the next button sits, so the badge goes **left of the inner row** at the
  anchor's height. For an outer-row anchor, a
  leader line runs from the badge through the gap in the staggered inner row.
- Stays highlighted for the whole round (all quizzes on that anchor).

### 3.2 Direction arrows

- **→ (right arrow) = pull**
- **← (left arrow) = push**

The same arrows are used for both the anchor and the quiz button.

### 3.3 Box (hand span)

- The box is a window over the keyboard, measured as *N* consecutive **D-row**
  buttons plus **every C#-row button beside them**. Because of the stagger, that's
  *N + 1* C# buttons.
- D buttons *j … j+N−1* and C# buttons *j … j+N* (C# positions *j−0.5 … j+N−0.5*).
- Default (Easy) *N* = 5, which gives **11 buttons**: 5 on the D row and 6 on the C# row.
- Hard (*N* = 10, *j* = 1) covers the whole keyboard: 10 D + 11 C#.
- The box is placed so the anchor falls inside it, at a random spot within the box
  (not always centered). The start index is clamped so the box stays on the keyboard.
- **Quiz targets** are in-play items inside the box. A target can be on either row and
  in either direction. It can be the anchor button with the other bellows direction,
  but never exactly the same `(button, direction)` as the anchor.
- If a box has fewer than 2 in-play items besides the anchor, pick a new box/anchor.

### 3.4 Difficulty

Difficulty sets the box height and the blitz timer:

| Level | Box height (D + C# buttons) | Blitz guess time |
|-------|-----------------------------|------------------|
| Easy | 5 + 6 | 3 s |
| Medium | 7 + 8 | 2 s |
| Hard | 10 + 11 (whole keyboard) | 1.5 s |

The non-Easy values are starting guesses and are easy to tune (a single config object).

---

## 4. Screen layout

Mobile-first, portrait. It should also work on desktop.

```
┌─────────────────────────────┐
│ Key [D ▾]  Mode [Practice ▾]│  ┌──────┐
│ Difficulty [Easy ▾]         │  │mini- │
│                             │  │map   │
│                             │  └──────┘
│        ┌───────────┐        │
│        │  zoomed   │        │
│        │  box view │        │
│        │  (D | C#) │        │
│        └───────────┘        │
│                             │
│     [ answer appears here ] │
│     [✗]   round 3/10   [✓]  │
└─────────────────────────────┘
```

### 4.1 Orientation

- The rows are vertical, the way you see them while playing: **lowest notes at the
  top**, D row (inner) on the left, C# row (outer) on the right, with the half-button
  stagger.
- **View** dropdown:
  - **Photo** (default when the layout has one): the zoomed view is a crop of the photo
    around the box, with everything outside the box dimmed. The anchor ring, target
    fill and box are drawn through the perspective transform. Labels stay upright
    and have a minimum size, so far-away buttons stay readable.
  - **Drawn 10° / 20° / 30°**: the vector keyboard, rotated clockwise and squashed
    horizontally so the box is a slanted parallelogram and the buttons are ovals.
  - **Flat**: the vector keyboard, upright.

### 4.2 Zoomed box view

Most of the screen. It draws only the buttons in the current box, large enough to tap.
Buttons are blank (no note names) except when an answer is being shown.

### 4.3 Minimap

A small panel in the top-right that draws the whole 21-button keyboard with the
current box outlined and the anchor and quiz buttons marked. It's for display only;
tapping it does nothing.

---

## 5. Modes

### 5.1 Practice mode (self-paced)

One **round** = one anchor + box, with **10 quizzes** on it. Then a new round starts.

Per quiz:
1. The quiz button lights up with its direction arrow.
2. **Tap anywhere** (or press **Space**) → the note name appears (on the button and in
   the answer area).
3. Mark yourself and move on:
   - **Swipe right** / **→ key** / **✓ button** = correct
   - **Swipe left** / **← key** / **✗ button** = wrong
   - **You don't have to reveal first.** If you mark before revealing, the correct
     answer flashes briefly (~0.8 s, on the button and in the answer area, tinted
     green for ✓ / red for ✗) before the next quiz. If you already revealed it, the
     next quiz comes up right away.
   - Inputs are ignored while that flash is showing, so a double-swipe can't skip a quiz.
4. Next quiz on the same anchor. After the 10th quiz, a new anchor + box is chosen.

There's no scoring or persistence in v1. Right/wrong marks are only used to move on.
(Results are still passed through one `recordResult()` function, so stats or
weighted repeats can be added later without rewiring the UI.)

### 5.2 Blitz mode (timed / automatic)

No input needed once it starts (there's a Start/Pause control).

Per round:
1. The box moves to a new anchor. **Pause 3 s** so you can find it.
2. Repeat 10 times:
   1. The quiz button flashes/lights up with its direction.
   2. Wait the **guess time** (3 s on Easy, per §3.4).
   3. Show the answer for a short hold (1.5 s), then move to the next quiz.
3. New round.

There's no self-grading in blitz.

All timings live in one config object.

### 5.3 Edit circles mode

Only offered when the layout has a photo. It shows the photo with every button's
outline and label. You select a button by tapping it, from the dropdown, or with
‹ / › (Tab / Shift-Tab). Dragging anywhere moves the selected centre (arrow keys nudge
1 px, Shift for 10 px). The Size slider (or `[` / `]`) sets its radius, and
**Size → all** copies it to every button. Edits are saved in the browser and used by
the quiz right away. **Copy JSON** / **Download** export the whole layout file with
the new calibration, ready to commit. **Reset** discards the edits.

---

## 6. Tech

- Plain **HTML + CSS + vanilla JS (ES modules)**. No framework, no build step.
- Hosted on **GitHub Pages** straight from the repo.
- Keyboard drawn as **SVG** (it scales cleanly, works for both the zoomed view and the
  minimap, and makes rotation for the tilt setting easy).
- Swipes via Pointer Events (horizontal movement over a threshold, ~50 px).
- Proposed files:
  - `index.html`
  - `css/style.css`
  - `layouts/*.json`: button charts (see §1.2a)
  - `js/layout.js`: loads and checks a layout JSON, computes geometry
  - `js/theory.js`: keys, scales, spelling, in-play filtering
  - `js/quiz.js`: anchor/box/target selection, round state (no DOM)
  - `js/render.js`: SVG drawing for the drawn views + minimap
  - `js/render-photo.js`: quiz and circle editor drawn over the photo
  - `js/photo.js`, `js/homography.js`: photo calibration and perspective math
  - `js/format.js`: JSON export formatting
  - `js/main.js`: wiring, input handling, mode timers
- Unit tests for the pure modules (`layout`, `theory`, `quiz`) using Node's built-in
  `node --test` (`npm test`). No dependencies.
- The page loads JSON with `fetch`, so it must be served over HTTP (it won't work
  opened as `file://`). Use `npm run serve` / `python3 -m http.server`.

---

## 7. Future ideas (out of scope for v1)

- **Ear mode:** play the anchor and the target notes (Web Audio), and you find the
  button + direction.
- Persisted stats (localStorage), with missed items coming up more often.
- More keys (minor keys, modes), and other tunings via `layout.js`.
- Octave display.

---

## 8. Open questions

Resolved: the chart in §1.2 was checked against the instrument. Also resolved: the box covers N + 1 C# buttons; lowest pitch at the top; blitz answer
hold is 1.5 s.

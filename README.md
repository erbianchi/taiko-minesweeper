# たいこ地雷 — Taiko Minesweeper

A browser-based Minesweeper game with a Taiko no Tatsujin-inspired presentation: Don-chan animations, taiko drum sounds, rhythm combos, and progressive level system.

## Running

No build step required. Open `index.html` directly in a browser, or serve as a static site:

```bash
python -m http.server
```

Then open `http://localhost:8000`.

## Testing

Unit tests cover all core game logic (level config, rhythm levels, mine placement, flood reveal, mini-run sequencing, win condition). They run in Node with no external dependencies:

```bash
node js/app.test.js
```

## Repository Structure

```
index.html       — game markup and SEO metadata
css/script.css   — all styles (responsive, mobile-first)
js/app.js        — all game logic, audio engine
js/app.test.js   — unit tests (Node.js, no dependencies)
music/           — background music tracks (music1–6.mp3)
```

## Gameplay

### Level Progression

The game starts at **Level 1** and advances automatically on each clear:

| Level | Board size | Mines (~12%) |
|-------|-----------|--------------|
| 1     | 8 × 8     | 8            |
| 2     | 9 × 9     | 10           |
| 3     | 10 × 10   | 12           |
| N     | (7+N) × (7+N) | ~12%     |

- Clearing the board advances to the next level with a full-screen splash and drum fanfare.
- Hitting a mine ends the game with a **ゲームオーバー** overlay and a crying Don-chan. The game restarts from Level 1.
- On first load, a **たいこ地雷 / LEVEL 1** intro splash plays with a DON–DON–KA–DO-DON drum roll.

### Rules

1. Reveal all safe cells without clicking a mine.
2. The first click is always safe — mines are placed outside the 3×3 area around it.
3. A revealed number shows how many of the eight neighboring cells contain mines.
4. Zero-mine cells auto-flood-reveal connected empty cells and their numbered borders.
5. Flag cells you suspect contain mines (right-click or long-press on desktop, 🚩 + tap on mobile).

## Controls

| Action | Desktop | Mobile |
|--------|---------|--------|
| Reveal cell | Left-click | Tap |
| Flag cell | Right-click / long-press | 🚩 + tap |
| Toggle flag mode | — | 🚩 button |
| Menu (restart / sound / music) | ⋮ button | ⋮ button |

## HUD

- **SCORE** — total score, animates up on every increment
- **Mines ●** — `totalMines − flags − defused` remaining
- **⏱ timer** — elapsed seconds
- **Mini-run bar** — current DON/KATSU sequence challenge with 15-second countdown; Don-chan animates on the right
- **Combo bar** — combo count, rhythm rank, energy bar, accumulated combo score

## Scoring

| Action | Points |
|--------|--------|
| Reveal safe cell | 10 base × combo multiplier |
| Flood reveal | revealed cells × 10 base × multiplier |
| Correct flag (KATSU hit) | 5 base × multiplier |
| Complete mini-run sequence | length × 50 × multiplier |
| Win time bonus | 500 + max(0, 300 − 2 × seconds) |
| Score milestone (every 1 000 pts) | One random mine auto-defused |

### Combo & Rhythm Ranks

| Combo | Rank | Multiplier |
|-------|------|-----------|
| 0     | –    | 1×        |
| 3     | GOOD!      | 2× |
| 6     | GREAT!     | 3× |
| 10    | FEVER! 🔥  | 5× |
| 15    | DON FEVER!!| 8× |

Combo resets to 0 when the mini-run timer expires or when a wrong step is made.

### Mini-Run Sequences

- Random DON / KATSU sequences, length 2–5 (grows with consecutive completions, max 5).
- The 15-second countdown starts on the first correct step.
- **KATSU steps are capped to the number of unflagged mines remaining** — the sequence never asks you to flag more mines than exist.
- Completing a sequence instantly generates the next one (longer if on a streak).
- A wrong step or timer expiry resets the combo and regenerates the sequence.
- Flagging a safe cell during a KATSU step counts the step but voids the run bonus.

## 1UP Bonus

- Each board contains one hidden 1UP card on a random safe cell.
- Revealing it grants an extra life (shown as a gold card next to the score).
- When you have multiple lives a small **×N** counter appears next to the card.
- If you click a mine while holding a 1UP, the mine is defused instead of ending the game.
- **Extra lives carry over between levels** — they are never reset on level advance.

## Audio

All sounds are synthesised with the **Web Audio API** (no external sound files for SFX):

| Sound | Trigger |
|-------|---------|
| DON (deep taiko centre hit) | Reveal a cell |
| KATSU (rim hit — sharp crack) | Flag a cell |
| DO-DON (double hit) | Large flood reveal |
| Beat Drop | Reaching a new rhythm rank |
| Clear fanfare | Completing a level |
| Boom | Hitting a mine |
| Save chime | 1UP extra life used |
| Pickup | 1UP collected |

Background music cycles randomly through `music/music1–6.mp3`. Autoplay is unlocked on first user interaction and retries automatically if the browser blocks it. Sound effects and music have independent mute controls in the ⋮ menu.

## Responsive Design

- Mobile (< 521 px): full-viewport app shell, fluid cell sizes
- Desktop (≥ 521 px): HUD spans full width, game content centred at max 520 px, scrollable page

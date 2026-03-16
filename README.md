# たいこ地雷 — Taiko Minesweeper

A browser-based Minesweeper game with a Taiko no Tatsujin-inspired presentation: Don-chan animations, taiko drum sounds, rhythm combos, and progressive level system.

## Running

No build step required. Open `index.html` directly in a browser, or serve as a static site:

```bash
python -m http.server
```

Then open `http://localhost:8000`.

## Repository Structure

```
index.html       — game markup
css/script.css   — all styles
js/app.js        — all game logic, audio engine
music/           — background music tracks (music1–6.mp3)
game.py          — placeholder (unused)
```

## Gameplay

### Level Progression

The game has no fixed difficulty selection. It starts at **Level 1** and advances automatically:

| Level | Board size | Mines (~15%) |
|-------|-----------|--------------|
| 1     | 7 × 7     | 7            |
| 2     | 8 × 8     | 9            |
| 3     | 9 × 9     | 12           |
| …     | (6+N) × (6+N) | ~15%     |

- Clearing the board advances to the next level with a full-screen level splash and drum fanfare.
- Hitting a mine ends the game with a **ゲームオーバー** overlay and a crying Don-chan. The game restarts from Level 1.
- On first load, a **たいこ地雷 / LEVEL 1** intro splash plays with a DON–DON–KA–DO-DON drum roll.

### Rules

1. Reveal all safe cells without clicking a mine.
2. The first click is always safe — mines are placed outside the 3×3 area around it.
3. A revealed number shows how many of the eight neighboring cells contain mines.
4. Zero-mine cells auto-flood-reveal connected empty cells and their numbered borders.
5. Flag cells you suspect contain mines.

## Controls

| Action | Desktop | Mobile |
|--------|---------|--------|
| Reveal cell | Left-click | Tap |
| Flag cell | Right-click | 🚩 + tap |
| Toggle flag mode | — | 🚩 button |
| Menu (restart / sound / music) | ⋮ button | ⋮ button |

## HUD

- **SCORE** — total score, bounces and scales up on every increment
- **Mines ●** — unflagged mines remaining
- **⏱ timer** — elapsed seconds
- **Mini-run bar** — current DON/KATSU sequence challenge with countdown timer; Don-chan animates on the right end
- **Combo bar** — combo count, rhythm rank, energy bar, accumulated combo score

## Scoring

| Action | Points |
|--------|--------|
| Reveal safe cell | 10 base (× combo multiplier) |
| Flood reveal | revealed cells × 10 base |
| Correct flag (KATSU hit) | 5 base |
| Complete mini-run sequence | length × 50 × multiplier |
| Win time bonus | 500 + max(0, 300 − 2 × seconds) |
| Score milestone (every 1 000 pts) | One random mine auto-defused |

Points are **only awarded when the action matches the current mini-run step** (DON click advances DON step, flag advances KATSU step).

### Combo & Rhythm Ranks

| Combo | Rank | Multiplier |
|-------|------|-----------|
| 0     | –    | 1×        |
| 5     | GOOD! | 2×       |
| 10    | GREAT! | 3×      |
| 20    | FEVER! | 5×      |
| 35    | DON FEVER!! | 8× |

Combo resets to 0 when the mini-run timer expires.

### Mini-Run Sequences

- Random DON / KATSU sequences, length 2–5.
- The 15-second countdown starts on the first correct step.
- Completing a sequence instantly generates the next one.
- A wrong step or timer expiry resets the combo and generates a new sequence.

## Audio

All sounds are synthesized with the **Web Audio API** (no external sound files required):

| Sound | Trigger |
|-------|---------|
| DON (deep taiko center hit) | Reveal a cell |
| KATSU (rim hit — sharp crack + mid punch) | Flag a cell |
| DO-DON (double hit) | Large flood reveal |
| Beat Drop | Reaching a new rhythm rank |
| Clear fanfare | Completing a level |
| Boom | Hitting a mine |

Background music is chosen randomly from `music/music1–6.mp3`, and when one track ends the game picks another automatically. Sound effects and music have independent mute controls in the ⋮ menu.

## Responsive Design

- Mobile (< 521 px): full-viewport app shell, fluid cell sizes via `clamp()`
- Desktop (≥ 521 px): HUD spans full width, game content centered at max 520 px, scrollable page

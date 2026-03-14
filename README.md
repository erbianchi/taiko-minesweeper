# Taiko Minesweeper (たいこ地雷)

Taiko Minesweeper is a browser-based Minesweeper game with a Taiko no Tatsujin-inspired presentation. The current playable implementation in this repository lives in `index.html` and uses inline JavaScript, CSS, Web Audio sound effects, and local background music files.

Note: repository metadata still mentions a Python version in `game.py`, but `game.py` is currently empty in this checkout. This README documents the game that is actually implemented.

## Running

No build step is required.

Open `index.html` directly in a browser, or serve the folder as a static site:

```bash
python -m http.server
```

Then open `http://localhost:8000`.

## Game Details

- Theme: Taiko no Tatsujin-inspired visual style with Don-chan animations and Japanese taiko hit callouts.
- Platform: desktop and mobile web browser.
- Difficulty levels:
  - Easy: `9 x 9` board with `10` mines
  - Medium: `16 x 16` board with `40` mines
  - Hard: `30 x 16` board with `99` mines
- HUD elements:
  - Mines remaining counter
  - Timer
  - Total score
  - Combo / rhythm meter
  - Mini-run sequence bar
  - End-of-game message
  - Persistent statistics table
- Audio:
  - Synthesized sound effects generated with the Web Audio API
  - Random looping background music chosen from `music/music1.mp3` to `music/music4.mp3`
  - Separate mute buttons for sound effects and music
- Persistence:
  - Per-difficulty stats are stored in `localStorage`
  - Tracked stats: played, wins, win rate, best time, streak / best streak, best score
- Responsive behavior:
  - Board cell size is recalculated from screen width
  - Mobile-friendly flag mode button is provided for touch devices

## Controls

- Click or tap a cell to reveal it.
- Right-click a cell to place or remove a flag.
- On touch devices, use the `🚩` button to toggle Flag Mode:
  - Flag Mode ON: tapping places or removes a flag
  - Flag Mode OFF: tapping reveals a cell
- Use `↺ Easy`, `↺ Med`, `↺ Hard`, or `RESTART` to start a new game.
- Use `🔊` to mute sound effects.
- Use `🎵` to mute background music.

## Rules Of The Game

1. Reveal safe cells without clicking a mine.
2. The first click is always safe.
3. The implementation goes further than standard Minesweeper: mines are not placed in the full `3 x 3` area centered on the first clicked cell.
4. A revealed number shows how many mines are in the eight neighboring cells.
5. If a revealed cell has `0` adjacent mines, the game automatically flood-reveals connected empty cells and their numbered border cells.
6. Flag cells you think contain mines.
7. Clicking a mine ends the game immediately.
8. You win when all non-mine cells are revealed.
9. The current implementation also declares a win when `placed flags + auto-defused mines == total mines`.

## Scoring And Special Systems

- Revealing a normal safe cell adds a base `10` points.
- Flagging a cell adds a base `5` points.
- Large flood reveals award more base points because they score by revealed cell count.
- Consecutive successful actions build combo.
- Combo changes the rhythm rank and score multiplier:
  - `–` at 1x
  - `GOOD!` at 2x
  - `GREAT!` at 3x
  - `FEVER!` at 5x
  - `DON FEVER!!` at 8x
- The game generates random `DON` / `KATSU` mini-run sequences:
  - Sequence length starts at 2 and grows up to 5
  - The timer starts at 15 seconds when the first correct step is entered
  - Completing a sequence grants `length x 50 x current multiplier`
- Every time the animated total score crosses a `1000` point milestone, one random unrevealed and unflagged mine is automatically revealed as a safe, defused mine.
- Winning grants a time bonus:
  - `500 + max(0, 300 - 2 x seconds)`

## Repository Structure

- `index.html`: main game UI, styling, and JavaScript game logic
- `music/`: looping background music tracks
- `game.py`: currently empty placeholder

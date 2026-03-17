// app.test.js — Unit tests for Taiko Minesweeper game logic
// Run with: node js/app.test.js

// ── Minimal browser stubs ────────────────────────────────────────────────────
const noop = () => {};
const domEl = () => ({
  style: {}, textContent: '', innerHTML: '', children: [], offsetWidth: 0,
  classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
  appendChild: noop, removeEventListener: noop, addEventListener: noop,
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }),
  animate: () => ({ onfinish: null }),
  getAnimations: () => [],
  remove: noop,
});
global.document = {
  getElementById: () => domEl(),
  createElement:  () => domEl(),
  querySelectorAll: () => [],
  addEventListener: noop,
  removeEventListener: noop,
  body: { ...domEl(), classList: { add: noop, remove: noop, toggle: noop, contains: () => false } },
};
global.window          = { innerWidth: 800, innerHeight: 600 };
global.performance     = { now: () => 0 };
global.requestAnimationFrame = noop;
global.cancelAnimationFrame  = noop;
global.clearInterval   = noop;
global.setInterval     = () => 0;
global.clearTimeout    = noop;
global.setTimeout      = () => 0;
global.Audio = function () {
  return { play: () => Promise.resolve(), pause: noop, volume: 0, src: '', loop: false, addEventListener: noop };
};

// ── Pure logic extracted from app.js ─────────────────────────────────────────

const RHYTHM_LEVELS = [
  { label: '–',           min: 0,  mult: 1 },
  { label: 'GOOD!',       min: 3,  mult: 2 },
  { label: 'GREAT!',      min: 6,  mult: 3 },
  { label: 'FEVER! 🔥',   min: 10, mult: 5 },
  { label: 'DON FEVER!!', min: 15, mult: 8 },
];

const MINI_RUN_POOL = [
  { id: 'don',   label: 'DON' },
  { id: 'katsu', label: 'KATSU' },
];

function levelConfig(level) {
  const size = 7 + level;
  const mines = Math.max(1, Math.round(size * size * 0.12));
  return { cols: size, rows: size, mines };
}

function calcRhythmLevel(c) {
  let lvl = 0;
  for (let i = 0; i < RHYTHM_LEVELS.length; i++)
    if (c >= RHYTHM_LEVELS[i].min) lvl = i;
  return lvl;
}

function shuffleMiniRun(steps) {
  for (let i = steps.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [steps[i], steps[j]] = [steps[j], steps[i]];
  }
  return steps;
}

function buildMiniRun(len, maxKatsu) {
  const donStep   = MINI_RUN_POOL.find(s => s.id === 'don');
  const katsuStep = MINI_RUN_POOL.find(s => s.id === 'katsu');
  const katsuCount = Math.min(Math.floor(len / 2), maxKatsu);
  const donCount   = len - katsuCount;
  return shuffleMiniRun([
    ...Array.from({ length: donCount },   () => donStep),
    ...Array.from({ length: katsuCount }, () => katsuStep),
  ]);
}

// Grid globals (mirror app.js)
let rows, cols, grid, totalMines, revealedCount;

function makeGrid(r, c) {
  return Array.from({ length: r }, () =>
    Array.from({ length: c }, () => ({
      mine: false, revealed: false, flagged: false, adjacent: 0,
      defused: false, bonus: null, bonusCollected: false,
    }))
  );
}

function neighbors(r, c) {
  const result = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) result.push([nr, nc]);
    }
  return result;
}

function placeMines(safeR, safeC) {
  let placed = 0;
  while (placed < totalMines) {
    const r = Math.floor(Math.random() * rows);
    const c = Math.floor(Math.random() * cols);
    if (!grid[r][c].mine && !(Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1)) {
      grid[r][c].mine = true;
      placed++;
    }
  }
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (!grid[r][c].mine)
        grid[r][c].adjacent = neighbors(r, c).filter(([nr, nc]) => grid[nr][nc].mine).length;
}

function revealBFS(r, c) {
  const order = [];
  const queue = [[r, c, 0, true]];
  const seen  = new Set();
  const key   = (row, col) => row * 10000 + col;
  while (queue.length) {
    const [cr, cc, dist, direct] = queue.shift();
    const k = key(cr, cc);
    if (seen.has(k)) continue;
    seen.add(k);
    if (grid[cr][cc].revealed || grid[cr][cc].flagged || grid[cr][cc].mine) continue;
    if (grid[cr][cc].bonus && !direct) continue;
    grid[cr][cc].revealed = true;
    revealedCount++;
    order.push({ r: cr, c: cc, dist });
    if (grid[cr][cc].adjacent === 0)
      neighbors(cr, cc).forEach(([nr, nc]) => {
        if (!seen.has(key(nr, nc))) queue.push([nr, nc, dist + 1, false]);
      });
  }
  return order;
}

// Mini-run state (mirror app.js)
let miniRun, miniRunStep, miniRunBonusEligible, miniRunCompletions;

function advanceMiniRun(actionId, isValidHit = true) {
  if (!miniRun || miniRunStep >= miniRun.length) return false;
  if (miniRun[miniRunStep].id === actionId) {
    if (actionId === 'katsu' && !isValidHit) miniRunBonusEligible = false;
    miniRunStep++;
    if (miniRunStep >= miniRun.length) miniRunCompletions++;
    return true;
  } else if (miniRunStep > 0) {
    miniRunStep = 0;
  }
  return false;
}

function setupMiniRun(sequence) {
  miniRun = sequence.map(id => MINI_RUN_POOL.find(s => s.id === id));
  miniRunStep = 0;
  miniRunBonusEligible = true;
  miniRunCompletions   = 0;
}

// Win condition (extracted)
function checkWinCondition() {
  return revealedCount === rows * cols - totalMines;
}

// ── Test runner ───────────────────────────────────────────────────────────────
let passed = 0, failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓  ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗  ${name}`);
    console.error(`     ${e.message}`);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

function assertEqual(a, b, msg) {
  if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

function section(name) {
  console.log(`\n── ${name} ${'─'.repeat(Math.max(0, 50 - name.length))}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// levelConfig
// ═══════════════════════════════════════════════════════════════════════════════
section('levelConfig');

test('level 1 → 8×8 board', () => {
  const cfg = levelConfig(1);
  assertEqual(cfg.cols, 8); assertEqual(cfg.rows, 8);
});
test('level 5 → 12×12 board', () => {
  const cfg = levelConfig(5);
  assertEqual(cfg.cols, 12); assertEqual(cfg.rows, 12);
});
test('board size = 7 + level', () => {
  for (let lvl = 1; lvl <= 10; lvl++)
    assertEqual(levelConfig(lvl).cols, 7 + lvl, `level ${lvl}`);
});
test('board size grows by 1 each level', () => {
  for (let lvl = 2; lvl <= 8; lvl++)
    assertEqual(levelConfig(lvl).cols, levelConfig(lvl - 1).cols + 1);
});
test('mine count is Math.round(size² × 0.12)', () => {
  for (let lvl = 1; lvl <= 10; lvl++) {
    const size = 7 + lvl;
    const expected = Math.max(1, Math.round(size * size * 0.12));
    assertEqual(levelConfig(lvl).mines, expected, `level ${lvl}`);
  }
});
test('always at least 1 mine', () => {
  for (let lvl = 1; lvl <= 20; lvl++)
    assert(levelConfig(lvl).mines >= 1);
});

// ═══════════════════════════════════════════════════════════════════════════════
// calcRhythmLevel
// ═══════════════════════════════════════════════════════════════════════════════
section('calcRhythmLevel');

test('combo 0 → level 0 (–)',           () => assertEqual(calcRhythmLevel(0),   0));
test('combo 2 → level 0 (below GOOD)',  () => assertEqual(calcRhythmLevel(2),   0));
test('combo 3 → level 1 (GOOD)',        () => assertEqual(calcRhythmLevel(3),   1));
test('combo 5 → level 1 (GOOD)',        () => assertEqual(calcRhythmLevel(5),   1));
test('combo 6 → level 2 (GREAT)',       () => assertEqual(calcRhythmLevel(6),   2));
test('combo 9 → level 2 (GREAT)',       () => assertEqual(calcRhythmLevel(9),   2));
test('combo 10 → level 3 (FEVER)',      () => assertEqual(calcRhythmLevel(10),  3));
test('combo 14 → level 3 (FEVER)',      () => assertEqual(calcRhythmLevel(14),  3));
test('combo 15 → level 4 (DON FEVER)', () => assertEqual(calcRhythmLevel(15),  4));
test('combo 999 → level 4 (max)',       () => assertEqual(calcRhythmLevel(999), 4));

test('each boundary exactly triggers the right level', () => {
  const boundaries = [0, 3, 6, 10, 15];
  boundaries.forEach((min, i) => assertEqual(calcRhythmLevel(min), i, `boundary min=${min}`));
});
test('one below each boundary stays at previous level', () => {
  [3, 6, 10, 15].forEach((min, i) => assertEqual(calcRhythmLevel(min - 1), i, `min-1=${min-1}`));
});

// ═══════════════════════════════════════════════════════════════════════════════
// buildMiniRun
// ═══════════════════════════════════════════════════════════════════════════════
section('buildMiniRun — composition');

test('returns exactly `len` steps', () => {
  for (const len of [2, 3, 4, 5])
    assertEqual(buildMiniRun(len, 99).length, len, `len=${len}`);
});
test('all steps are DON or KATSU', () => {
  for (const len of [2, 3, 4, 5])
    assert(buildMiniRun(len, 99).every(s => s.id === 'don' || s.id === 'katsu'));
});
test('katsu count ≤ floor(len/2) regardless of maxKatsu', () => {
  for (const len of [2, 3, 4, 5]) {
    const run = buildMiniRun(len, 99);
    assert(run.filter(s => s.id === 'katsu').length <= Math.floor(len / 2), `len=${len}`);
  }
});
test('len=2, maxKatsu=1 → 1 DON + 1 KATSU', () => {
  const run = buildMiniRun(2, 1);
  assertEqual(run.filter(s => s.id === 'don').length,   1);
  assertEqual(run.filter(s => s.id === 'katsu').length, 1);
});
test('len=5, maxKatsu=2 → 3 DON + 2 KATSU', () => {
  const run = buildMiniRun(5, 2);
  assertEqual(run.filter(s => s.id === 'don').length,   3);
  assertEqual(run.filter(s => s.id === 'katsu').length, 2);
});

section('buildMiniRun — maxKatsu constraint');

test('maxKatsu=0 → all DON, no KATSU', () => {
  for (const len of [2, 3, 4, 5])
    assertEqual(buildMiniRun(len, 0).filter(s => s.id === 'katsu').length, 0, `len=${len}`);
});
test('maxKatsu=1 → at most 1 KATSU (stress test)', () => {
  for (let i = 0; i < 30; i++) {
    const run = buildMiniRun(5, 1);
    assert(run.filter(s => s.id === 'katsu').length <= 1, `got >1 katsu with maxKatsu=1`);
  }
});
test('katsu count never exceeds remaining bombs across all len/bomb combos', () => {
  for (let bombs = 0; bombs <= 5; bombs++)
    for (const len of [2, 3, 4, 5]) {
      const run = buildMiniRun(len, bombs);
      const katsu = run.filter(s => s.id === 'katsu').length;
      assert(katsu <= bombs, `len=${len}, bombs=${bombs}: got ${katsu} katsu`);
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// shuffleMiniRun
// ═══════════════════════════════════════════════════════════════════════════════
section('shuffleMiniRun');

test('preserves array length', () => {
  const s = [{id:'don'},{id:'katsu'},{id:'don'}];
  assertEqual(shuffleMiniRun([...s]).length, 3);
});
test('preserves element counts after shuffle', () => {
  const steps = Array.from({length:10}, (_, i) => ({id: i % 2 === 0 ? 'don' : 'katsu'}));
  const shuffled = shuffleMiniRun([...steps]);
  assertEqual(shuffled.filter(s => s.id === 'don').length,   5);
  assertEqual(shuffled.filter(s => s.id === 'katsu').length, 5);
});
test('single-element array is unchanged', () => {
  assertEqual(shuffleMiniRun([{id:'don'}])[0].id, 'don');
});
test('empty array returns empty array', () => {
  assertEqual(shuffleMiniRun([]).length, 0);
});

// ═══════════════════════════════════════════════════════════════════════════════
// neighbors
// ═══════════════════════════════════════════════════════════════════════════════
section('neighbors');

test('1×1 grid has 0 neighbors', () => {
  rows = 1; cols = 1;
  assertEqual(neighbors(0, 0).length, 0);
});
test('corner (0,0) on 5×5 → 3 neighbors', () => {
  rows = 5; cols = 5;
  assertEqual(neighbors(0, 0).length, 3);
});
test('edge (0,2) on 5×5 → 5 neighbors', () => {
  rows = 5; cols = 5;
  assertEqual(neighbors(0, 2).length, 5);
});
test('center (2,2) on 5×5 → 8 neighbors', () => {
  rows = 5; cols = 5;
  assertEqual(neighbors(2, 2).length, 8);
});
test('never includes self', () => {
  rows = 5; cols = 5;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      assert(!neighbors(r, c).some(([nr, nc]) => nr === r && nc === c), `self at (${r},${c})`);
});
test('all returned cells are in-bounds', () => {
  rows = 4; cols = 6;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      for (const [nr, nc] of neighbors(r, c))
        assert(nr >= 0 && nr < rows && nc >= 0 && nc < cols, `out of bounds at (${nr},${nc})`);
});
test('non-square grid (2×6) — corner has 3 neighbors', () => {
  rows = 2; cols = 6;
  assertEqual(neighbors(0, 0).length, 3);
});

// ═══════════════════════════════════════════════════════════════════════════════
// placeMines
// ═══════════════════════════════════════════════════════════════════════════════
section('placeMines');

test('places exactly totalMines mines', () => {
  rows = 8; cols = 8; totalMines = 10;
  grid = makeGrid(rows, cols);
  placeMines(0, 0);
  assertEqual(grid.flat().filter(c => c.mine).length, totalMines);
});
test('no mine in 3×3 safe zone (center click)', () => {
  rows = 9; cols = 9; totalMines = 10;
  for (let trial = 0; trial < 5; trial++) {
    grid = makeGrid(rows, cols);
    placeMines(4, 4);
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++)
        assert(!grid[4+dr][4+dc].mine, `mine in safe zone at (${4+dr},${4+dc})`);
  }
});
test('no mine in safe zone at corner (0,0)', () => {
  rows = 8; cols = 8; totalMines = 8;
  for (let trial = 0; trial < 5; trial++) {
    grid = makeGrid(rows, cols);
    placeMines(0, 0);
    assert(!grid[0][0].mine && !grid[0][1].mine && !grid[1][0].mine && !grid[1][1].mine);
  }
});
test('adjacent counts match actual mine neighbors', () => {
  rows = 6; cols = 6; totalMines = 5;
  grid = makeGrid(rows, cols);
  placeMines(3, 3);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      if (grid[r][c].mine) continue;
      const expected = neighbors(r, c).filter(([nr, nc]) => grid[nr][nc].mine).length;
      assertEqual(grid[r][c].adjacent, expected, `cell (${r},${c})`);
    }
});
test('no duplicate mines (mine count matches totalMines)', () => {
  rows = 10; cols = 10; totalMines = 20;
  grid = makeGrid(rows, cols);
  placeMines(5, 5);
  assertEqual(grid.flat().filter(c => c.mine).length, totalMines);
});

// ═══════════════════════════════════════════════════════════════════════════════
// revealBFS
// ═══════════════════════════════════════════════════════════════════════════════
section('revealBFS');

test('numbered cell reveals only itself', () => {
  rows = 3; cols = 3;
  grid = makeGrid(rows, cols);
  grid[2][2].adjacent = 1; // not zero → no flood
  revealedCount = 0;
  const order = revealBFS(2, 2);
  assertEqual(order.length,   1);
  assertEqual(revealedCount, 1);
});
test('1×5 all-zero grid flood-reveals all 5 cells from left end', () => {
  rows = 1; cols = 5;
  grid = makeGrid(rows, cols);
  revealedCount = 0;
  revealBFS(0, 0);
  assertEqual(revealedCount, 5);
});
test('1×5 all-zero grid flood-reveals all 5 cells from right end', () => {
  rows = 1; cols = 5;
  grid = makeGrid(rows, cols);
  revealedCount = 0;
  revealBFS(0, 4);
  assertEqual(revealedCount, 5);
});
test('flood does not cross a flagged cell', () => {
  rows = 1; cols = 3;
  grid = makeGrid(rows, cols);
  grid[0][1].flagged = true;
  revealedCount = 0;
  revealBFS(0, 0);
  assert(!grid[0][1].revealed, 'flagged cell should not be revealed');
  assert(!grid[0][2].revealed, 'cell beyond flag should not be revealed');
});
test('flood does not reveal mine cells', () => {
  rows = 1; cols = 3;
  grid = makeGrid(rows, cols);
  grid[0][2].mine = true;
  revealedCount = 0;
  revealBFS(0, 0);
  assert(!grid[0][2].revealed);
});
test('bonus cell skipped during flood (not direct click)', () => {
  rows = 1; cols = 3;
  grid = makeGrid(rows, cols);
  grid[0][1].bonus = 'life';
  revealedCount = 0;
  revealBFS(0, 0);
  assert(!grid[0][1].revealed, 'bonus cell must not flood-reveal');
});
test('already-revealed cell is not counted twice', () => {
  rows = 3; cols = 3;
  grid = makeGrid(rows, cols);
  grid[1][1].revealed = true;
  revealedCount = 1;
  revealBFS(0, 0);
  const actual = grid.flat().filter(c => c.revealed).length;
  assertEqual(revealedCount, actual);
});
test('return order has non-decreasing dist (wave animation order)', () => {
  rows = 1; cols = 5;
  grid = makeGrid(rows, cols);
  revealedCount = 0;
  const order = revealBFS(0, 0);
  for (let i = 1; i < order.length; i++)
    assert(order[i].dist >= order[i-1].dist, `dist decreased at index ${i}`);
});
test('single mine surrounded by zeros — mine not included in flood', () => {
  rows = 3; cols = 3;
  grid = makeGrid(rows, cols);
  grid[1][1].mine = true;
  // set adjacents
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++)
      if (!grid[r][c].mine)
        grid[r][c].adjacent = neighbors(r, c).filter(([nr, nc]) => grid[nr][nc].mine).length;
  revealedCount = 0;
  revealBFS(0, 0);
  assert(!grid[1][1].revealed, 'mine must not be revealed by flood');
});

// ═══════════════════════════════════════════════════════════════════════════════
// advanceMiniRun
// ═══════════════════════════════════════════════════════════════════════════════
section('advanceMiniRun');

test('correct first step increments miniRunStep', () => {
  setupMiniRun(['don', 'don']);
  advanceMiniRun('don');
  assertEqual(miniRunStep, 1);
});
test('correct full sequence triggers completion', () => {
  setupMiniRun(['don', 'katsu']);
  advanceMiniRun('don');
  advanceMiniRun('katsu');
  assertEqual(miniRunCompletions, 1);
});
test('wrong step after progress resets to 0', () => {
  setupMiniRun(['don', 'don', 'don']);
  advanceMiniRun('don');
  advanceMiniRun('don');
  advanceMiniRun('katsu'); // wrong
  assertEqual(miniRunStep, 0);
});
test('wrong first step (step=0) does not reset', () => {
  setupMiniRun(['don', 'don']);
  advanceMiniRun('katsu'); // wrong at step 0
  assertEqual(miniRunStep, 0);
});
test('returns true on match', () => {
  setupMiniRun(['don']);
  assertEqual(advanceMiniRun('don'), true);
});
test('returns false on mismatch', () => {
  setupMiniRun(['don']);
  assertEqual(advanceMiniRun('katsu'), false);
});
test('invalid katsu (non-mine flag) clears bonus eligibility', () => {
  setupMiniRun(['katsu', 'don']);
  advanceMiniRun('katsu', false);
  assertEqual(miniRunBonusEligible, false);
});
test('valid katsu (mine flag) keeps bonus eligibility', () => {
  setupMiniRun(['katsu', 'don']);
  advanceMiniRun('katsu', true);
  assertEqual(miniRunBonusEligible, true);
});
test('null miniRun always returns false', () => {
  miniRun = null;
  assertEqual(advanceMiniRun('don'),   false);
  assertEqual(advanceMiniRun('katsu'), false);
});
test('step past end of sequence returns false', () => {
  setupMiniRun(['don']);
  advanceMiniRun('don'); // completes, step = 1 = length
  assertEqual(advanceMiniRun('don'), false);
});
test('three-step all-don sequence completes correctly', () => {
  setupMiniRun(['don', 'don', 'don']);
  advanceMiniRun('don');
  advanceMiniRun('don');
  advanceMiniRun('don');
  assertEqual(miniRunCompletions, 1);
  assertEqual(miniRunStep, 3);
});

// ═══════════════════════════════════════════════════════════════════════════════
// Win condition
// ═══════════════════════════════════════════════════════════════════════════════
section('checkWin condition');

test('not won when no cells revealed', () => {
  rows = 3; cols = 3; totalMines = 1; revealedCount = 0;
  assert(!checkWinCondition());
});
test('not won when one safe cell still hidden', () => {
  rows = 3; cols = 3; totalMines = 1; revealedCount = 7; // 9-1=8 needed
  assert(!checkWinCondition());
});
test('won when all safe cells revealed', () => {
  rows = 3; cols = 3; totalMines = 1; revealedCount = 8; // 9-1=8
  assert(checkWinCondition());
});
test('win condition = rows×cols − totalMines cells revealed', () => {
  rows = 8; cols = 8; totalMines = 10; revealedCount = 54; // 64-10=54
  assert(checkWinCondition());
});
test('one short of win is not won', () => {
  rows = 8; cols = 8; totalMines = 10; revealedCount = 53;
  assert(!checkWinCondition());
});

// ═══════════════════════════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════════════════════════
console.log(`\n${'═'.repeat(54)}`);
const icon = failed === 0 ? '✓' : '✗';
console.log(`${icon}  ${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

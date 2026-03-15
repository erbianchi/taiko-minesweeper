function levelConfig(level) {
  const size = 6 + level;                          // level 1 → 7×7, level 2 → 8×8, …
  const mines = Math.max(1, Math.round(size * size * 0.15));
  return { cols: size, rows: size, mines };
}

const COLORS = ['', 'n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8'];

const TAIKO_THEME = {
  mine: '💣',
  flag: '🎵',
  winMsg:  s => `クリア！ ${s}秒でクリア！🎉`,
  loseMsg: () => 'ドカーン！ ゲームオーバー！💥',
};

let grid, cols, rows, totalMines, flagCount, revealedCount, gameOver, firstClick;
let timerInterval, seconds;
let currentLevel = 1;
let flagMode = false;

// ── Rhythm / Combo / Score ────────────────────────────────────────────────
const RHYTHM_LEVELS = [
  { label: '–',           min: 0,  mult: 1, color: '#ffffff', musicVol: 0.20 },
  { label: 'GOOD!',       min: 3,  mult: 2, color: '#4cd964', musicVol: 0.25 },
  { label: 'GREAT!',      min: 6,  mult: 3, color: '#ffd700', musicVol: 0.30 },
  { label: 'FEVER! 🔥',   min: 10, mult: 5, color: '#ff9500', musicVol: 0.38 },
  { label: 'DON FEVER!!', min: 15, mult: 8, color: '#ff2d55', musicVol: 0.45 },
];
let combo = 0, score = 0, comboScore = 0, rhythmLevel = 0;
let _scoreDisplay = 0, _scoreRAF = null, lastMilestone = 0;

const MINI_RUN_POOL = [
  { id: 'don',   label: 'DON',   color: '#e53935' },
  { id: 'katsu', label: 'KATSU', color: '#0984e3' },
];
let miniRun = null, miniRunStep = 0, miniRunTimer = null, miniRunSeconds = 0, miniRunCount = 0, defusedCount = 0;

function computeCellSize() {
  const boardPad = 24;
  const gap = 4;
  const bodyPad  =  window.innerWidth <= 520 ? 16 : 32;
  const available = window.innerWidth - bodyPad - boardPad - gap * (cols - 1);
  return Math.max(18, Math.min(40, Math.floor(available / cols)));
}

function toggleFlagMode() {
  flagMode = !flagMode;
  const btn = document.getElementById('flag-mode-btn');
  btn.classList.toggle('active', flagMode);
  btn.title = flagMode ? 'Flag mode ON — tap to flag' : 'Flag mode OFF — tap to reveal';
}

function startMiniRunTimer() {
  clearInterval(miniRunTimer);
  miniRunSeconds = 15;
  updateMiniRunTimer();
  miniRunTimer = setInterval(() => {
    miniRunSeconds--;
    updateMiniRunTimer();
    if (miniRunSeconds <= 0) {
      clearInterval(miniRunTimer);
      miniRunStep = 0;
      generateMiniRun();
    }
  }, 1000);
}

function stopMiniRunTimer() {
  clearInterval(miniRunTimer);
  miniRunTimer = null;
  const el = document.getElementById('mini-run-timer');
  if (el) el.textContent = '';
}

function updateMiniRunTimer() {
  const el = document.getElementById('mini-run-timer');
  if (!el) return;
  el.textContent = miniRunSeconds + 's';
  el.classList.toggle('urgent', miniRunSeconds <= 5);
}

function generateMiniRun() {
  const len = Math.min(2 + miniRunCount, 5);
  miniRun = Array.from({ length: len }, () =>
    MINI_RUN_POOL[Math.floor(Math.random() * MINI_RUN_POOL.length)]
  );
  miniRunStep = 0;
  document.getElementById('mini-run-bar').classList.remove('complete');
  document.getElementById('mini-run-label').textContent = '🥁 ×' + len;
  updateMiniRunUI();
}

function advanceMiniRun(actionId) {
  if (!miniRun || gameOver || miniRunStep >= miniRun.length) return;
  if (miniRun[miniRunStep].id === actionId) {
    if (miniRunStep === 0) startMiniRunTimer(); // start timer on first hit
    miniRunStep++;
    updateMiniRunUI();
    if (miniRunStep >= miniRun.length) completeMiniRun();
  } else if (miniRunStep > 0) {
    miniRunStep = 0;
    stopMiniRunTimer(); // abort timer on mistake
    updateMiniRunUI();
  }
}

function completeMiniRun() {
  miniRunCount++;
  stopMiniRunTimer();
  const bonus = miniRun.length * 50 * RHYTHM_LEVELS[rhythmLevel].mult;
  score += bonus;
  updateRhythmUI();
  const bar = document.getElementById('mini-run-bar');
  bar.classList.add('complete');
  document.getElementById('mini-run-label').textContent = '✨ Perfect run!';
  tkScorePopup(window.innerWidth / 2, window.innerHeight * 0.35, '+' + bonus + ' PERFECT!', '#ffd700');
  spawnScoreParticle(bonus, '#ffd700');
  tkFlash('#ffd700');
  playSound('win');
  setTimeout(() => generateMiniRun(), 2200);
}

function updateMiniRunUI() {
  const container = document.getElementById('mini-run-steps');
  if (!container || !miniRun) return;
  container.innerHTML = '';
  miniRun.forEach((step, i) => {
    if (i > 0) {
      const arrow = document.createElement('span');
      arrow.className = 'mr-arrow';
      arrow.textContent = '▶';
      container.appendChild(arrow);
    }
    const el = document.createElement('span');
    const state = i < miniRunStep ? 'done' : i === miniRunStep ? 'active' : 'pending';
    const typeClass = step.id === 'katsu' ? 'katsu-step' : 'don-step';
    el.className = 'mr-step ' + typeClass + ' ' + state;
    if (state !== 'done') el.textContent = step.label;
    container.appendChild(el);
  });
}

function revealFreeMine() {
  if (gameOver || firstClick || !grid) return;
  const candidates = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (grid[r][c].mine && !grid[r][c].revealed && !grid[r][c].flagged)
        candidates.push([r, c]);
  if (candidates.length === 0) return;

  const [r, c] = candidates[Math.floor(Math.random() * candidates.length)];
  grid[r][c].revealed = true;
  grid[r][c].defused  = true;
  defusedCount++;
  document.getElementById('mines-left').textContent = totalMines - flagCount - defusedCount;
  renderBoard();

  // Grab the cell from the freshly rendered DOM
  const board  = document.getElementById('board');
  const cellEl = board.children[r * cols + c];
  const rect   = cellEl.getBoundingClientRect();
  const x = rect.left + rect.width  / 2;
  const y = rect.top  + rect.height / 2;

  // Cell entrance spin-in
  cellEl.animate([
    { transform: 'scale(0) rotate(-180deg)', opacity: 0   },
    { transform: 'scale(1.35) rotate(12deg)', opacity: 1, offset: 0.65 },
    { transform: 'scale(1) rotate(0deg)',     opacity: 1  },
  ], { duration: 560, easing: 'ease-out' });

  tkRipple(x, y, '#ffd700', 46);
  tkPopup(x, y, 'SAFE! 💣', '#ffd700');
  tkFlash('#ffd700');
  donAnim('bounce');
  playSound('flood');
  checkWin();
}

function animateScoreCounter(target) {
  const el = document.getElementById('total-score');
  if (!el) return;
  if (_scoreRAF) cancelAnimationFrame(_scoreRAF);
  const from = _scoreDisplay;
  const startTime = performance.now();
  const duration = Math.min(600, 80 + Math.abs(target - from) * 0.4);
  function tick(now) {
    const t = Math.min((now - startTime) / duration, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    const prev = _scoreDisplay;
    _scoreDisplay = Math.round(from + (target - from) * ease);
    el.textContent = _scoreDisplay.toLocaleString();

    // Fire mine reveal exactly when counter crosses each 1000-pt threshold
    const prevM = Math.floor(prev        / 1000);
    const currM = Math.floor(_scoreDisplay / 1000);
    if (currM > prevM) {
      for (let m = prevM + 1; m <= currM; m++) {
        if (m > lastMilestone) {
          lastMilestone = m;
          setTimeout(revealFreeMine, (m - prevM - 1) * 900);
        }
      }
    }

    if (t < 1) {
      _scoreRAF = requestAnimationFrame(tick);
    } else {
      _scoreRAF = null;
      el.classList.remove('pop');
      void el.offsetWidth;
      el.classList.add('pop');
      setTimeout(() => el.classList.remove('pop'), 220);
    }
  }
  _scoreRAF = requestAnimationFrame(tick);
}

function spawnScoreParticle(points, color) {
  const fromEl = document.getElementById('combo-score');
  const toEl   = document.getElementById('total-score');
  if (!fromEl || !toEl) return;
  const fr = fromEl.getBoundingClientRect();
  const tr = toEl.getBoundingClientRect();
  const startX = fr.left + fr.width  / 2;
  const startY = fr.top  + fr.height / 2;
  const dx = tr.left + tr.width  / 2 - startX;
  const dy = tr.top  + tr.height / 2 - startY;
  const target = score; // capture total at spawn time
  const el = document.createElement('div');
  el.textContent = '+' + points.toLocaleString();
  el.style.cssText = `
    position:fixed; left:${startX}px; top:${startY}px;
    font-family:'Fredoka One','Kosugi Maru',sans-serif;
    font-size:1.15rem; color:${color};
    text-shadow:2px 2px 0 #000,-1px -1px 0 #000;
    pointer-events:none; z-index:9005; white-space:nowrap;
    transform:translate(-50%,-50%);
  `;
  document.body.appendChild(el);
  el.animate([
    { transform:'translate(-50%,-50%) scale(1.3)',                                                        opacity:1, offset:0   },
    { transform:`translate(calc(-50% + ${dx*.45}px),calc(-50% + ${dy*.4 - 22}px)) scale(1.05)`,          opacity:1, offset:0.5 },
    { transform:`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(0.45)`,                      opacity:0, offset:1   },
  ], { duration:680, easing:'ease-in' }).onfinish = () => {
    el.remove();
    animateScoreCounter(target);
  };
}

function calcRhythmLevel(c) {
  let lvl = 0;
  for (let i = 0; i < RHYTHM_LEVELS.length; i++)
    if (c >= RHYTHM_LEVELS[i].min) lvl = i;
  return lvl;
}

function addCombo(basePoints, x, y) {
  combo++;
  const earned = basePoints * RHYTHM_LEVELS[rhythmLevel].mult;
  score += earned;
  comboScore += earned;
  const prev = rhythmLevel;
  rhythmLevel = calcRhythmLevel(combo);
  updateRhythmUI();
  updateMusicIntensity();
  if (rhythmLevel > prev && rhythmLevel >= 3) triggerBeatDrop();
  if (x !== undefined) tkScorePopup(x, y, '+' + earned, RHYTHM_LEVELS[rhythmLevel].color);
  spawnScoreParticle(earned, RHYTHM_LEVELS[rhythmLevel].color);
}

function breakCombo() {
  combo = 0;
  comboScore = 0;
  rhythmLevel = 0;
  document.body.classList.remove('fever');
  updateRhythmUI();
  updateMusicIntensity();
}

function triggerBeatDrop() {
  document.body.classList.add('fever');
  playSound('beatdrop');
  tkFlash('#ff4500');
  setTimeout(() => tkBanner(RHYTHM_LEVELS[rhythmLevel].label), 60);
}

function updateRhythmUI() {
  const rl      = RHYTHM_LEVELS[rhythmLevel];
  const isMax   = rhythmLevel === RHYTHM_LEVELS.length - 1;
  const nextMin = isMax ? rl.min + 5 : RHYTHM_LEVELS[rhythmLevel + 1].min;
  const fill    = isMax ? 100 : Math.min(100, ((combo - rl.min) / (nextMin - rl.min)) * 100);
  document.getElementById('combo-count').textContent   = combo + ' combo';
  const labelEl = document.getElementById('rhythm-label');
  labelEl.textContent      = rl.label;
  labelEl.style.background = rl.color + '33';
  labelEl.style.color      = rl.color;
  document.getElementById('energy-bar').style.width      = fill + '%';
  document.getElementById('energy-bar').style.background = rl.color;
  document.getElementById('combo-score').textContent     = comboScore > 0 ? '+' + comboScore.toLocaleString() : '+0';
}

function updateMusicIntensity() {
  if (!musicMuted) bgMusic.volume = RHYTHM_LEVELS[rhythmLevel].musicVol;
}

function tkScorePopup(x, y, text, color) {
  const el = document.createElement('div');
  el.textContent = text;
  el.style.cssText = `
    position:fixed; left:${x}px; top:${y + 24}px;
    font-size:0.9rem; font-weight:900; color:${color};
    text-shadow:1px 1px 0 #000,-1px -1px 0 #000;
    pointer-events:none; z-index:9001; white-space:nowrap;
    font-family:'Kosugi Maru','Arial Rounded MT Bold',sans-serif;
  `;
  document.body.appendChild(el);
  el.animate([
    { transform:'translate(-50%,0)',     opacity:1 },
    { transform:'translate(-50%,-44px)', opacity:0 },
  ], { duration:750, easing:'ease-out' }).onfinish = () => el.remove();
}

function startGame(level) {
  currentLevel = level || 1;
  document.body.classList.remove('game-over', 'game-lost');
  hideGameOverSplash();
  const cfg = levelConfig(currentLevel);
  cols = cfg.cols;
  rows = cfg.rows;
  totalMines = cfg.mines;

  flagCount = 0;
  revealedCount = 0;
  gameOver = false;
  firstClick = true;
  seconds = 0;

  clearInterval(timerInterval);
  document.getElementById('timer').textContent = '0';
  document.getElementById('message').textContent = '';
  document.getElementById('mines-left').textContent = totalMines;

  // reset flag mode
  flagMode = false;
  const flagBtn = document.getElementById('flag-mode-btn');
  flagBtn.classList.remove('active');

  // reset rhythm / score / mini-run
  combo = 0; score = 0; comboScore = 0; rhythmLevel = 0; lastMilestone = 0; miniRunCount = 0; defusedCount = 0;
  _scoreDisplay = 0;
  if (_scoreRAF) { cancelAnimationFrame(_scoreRAF); _scoreRAF = null; }
  const tsEl = document.getElementById('total-score');
  if (tsEl) tsEl.textContent = '0';
  document.body.classList.remove('fever');
  updateRhythmUI();
  generateMiniRun();

  // stop don-chan celebrate loop
  const don = document.getElementById('don-chan');
  don.classList.remove('bounce', 'scared', 'celebrate');

  grid = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({
      mine: false, revealed: false, flagged: false, adjacent: 0,
    }))
  );

  renderBoard();
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

function renderBoard() {
  const board = document.getElementById('board');
  const cellPx = computeCellSize();
  board.style.setProperty('--cell', cellPx + 'px');
  board.style.gridTemplateColumns = `repeat(${cols}, ${cellPx}px)`;
  board.innerHTML = '';

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      const d = grid[r][c];

      if (d.revealed) {
        if (d.mine) {
          cell.classList.add('mine-revealed');
          if (d.defused) cell.classList.add('mine-defused');
          cell.textContent = TAIKO_THEME.mine;
        } else {
          cell.classList.add('revealed');
          if (d.adjacent > 0) {
            cell.textContent = d.adjacent;
            cell.classList.add(COLORS[d.adjacent]);
          }
        }
      } else if (d.flagged) {
        cell.classList.add('flagged');
        cell.textContent = TAIKO_THEME.flag;
      } else {
        cell.classList.add('hidden');
      }

      cell.addEventListener('click', () => handleClick(r, c));
      cell.addEventListener('contextmenu', e => { e.preventDefault(); handleFlag(r, c); });
      board.appendChild(cell);
    }
  }
}

function getCellCenter(r, c) {
  const board = document.getElementById('board');
  const cell  = board.children[r * cols + c];
  if (!cell) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const rect = cell.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function handleClick(r, c) {
  if (flagMode) { handleFlag(r, c); return; }
  if (gameOver || grid[r][c].revealed || grid[r][c].flagged) return;

  if (firstClick) {
    firstClick = false;
    placeMines(r, c);
    timerInterval = setInterval(() => {
      seconds++;
      document.getElementById('timer').textContent = seconds;
    }, 1000);
  }

  // Get position BEFORE renderBoard recreates DOM
  const pos = getCellCenter(r, c);

  if (grid[r][c].mine) {
    grid[r][c].revealed = true;
    endGame(false, r, c);
    // Taiko mine hit animations
    tkRipple(pos.x, pos.y, '#e53935', 40);
    tkPopup(pos.x, pos.y, 'ドカーン！', '#e53935');
    tkScreenShake();
    tkFlash('#ff0000');
    donAnim('scared');
    breakCombo();
    return;
  }

  const before = revealedCount;
  reveal(r, c);
  const revealed = revealedCount - before;
  playSound(revealed > 1 ? 'flood' : 'click');

  // Taiko reveal animations
  if (revealed > 1) {
    tkRipple(pos.x, pos.y, '#0984e3', 40);
    tkPopup(pos.x, pos.y, 'ドドン！', '#0984e3');
  } else {
    tkRipple(pos.x, pos.y, '#e53935', 34);
    tkPopup(pos.x, pos.y, 'ドン！', '#e53935');
  }
  donAnim('bounce');
  addCombo(revealed > 1 ? revealed * 10 : 10, pos.x, pos.y);
  advanceMiniRun('don');

  checkWin();
  renderBoard();
}

function reveal(r, c) {
  if (grid[r][c].revealed || grid[r][c].flagged || grid[r][c].mine) return;
  grid[r][c].revealed = true;
  revealedCount++;
  if (grid[r][c].adjacent === 0)
    neighbors(r, c).forEach(([nr, nc]) => reveal(nr, nc));
}

function handleFlag(r, c) {
  if (gameOver || grid[r][c].revealed) return;
  const pos = getCellCenter(r, c);
  grid[r][c].flagged = !grid[r][c].flagged;
  playSound(grid[r][c].flagged ? 'flag' : 'unflag');
  flagCount += grid[r][c].flagged ? 1 : -1;
  document.getElementById('mines-left').textContent = totalMines - flagCount - defusedCount;

  // Taiko flag animation (katsu = blue rim hit)
  tkRipple(pos.x, pos.y, '#0984e3', 34);
  tkPopup(pos.x, pos.y, grid[r][c].flagged ? 'カツ！' : 'カツ…', '#0984e3');
  donAnim('bounce');
  if (grid[r][c].flagged) { addCombo(5, pos.x, pos.y); advanceMiniRun('katsu'); }

  renderBoard();
  checkWin();
}

function checkWin() {
  if (revealedCount === rows * cols - totalMines) { endGame(true); return; }
}

function endGame(won, hitR, hitC) {
  gameOver = true;
  clearInterval(timerInterval);
  document.body.classList.add('game-over');
  if (!won) document.body.classList.add('game-lost');

  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      if (grid[r][c].mine && !grid[r][c].flagged) grid[r][c].revealed = true;
      if (won && !grid[r][c].mine) grid[r][c].revealed = true;
    }

  renderBoard();

  if (!won && hitR !== undefined) {
    const board = document.getElementById('board');
    board.children[hitR * cols + hitC].classList.add('mine-hit');
  }

  playSound(won ? 'win' : 'boom');
  document.getElementById('message').textContent = won ? TAIKO_THEME.winMsg(seconds) : TAIKO_THEME.loseMsg();

  if (!won) setTimeout(showGameOverSplash, 500);

  // freeze mini-run display on game end
  miniRun = null;
  stopMiniRunTimer();
  document.getElementById('mini-run-steps').innerHTML = '';
  document.getElementById('mini-run-label').textContent = '';

  if (won) {
    const bonus = 500 + Math.max(0, 300 - seconds * 2);
    score += bonus;
    updateRhythmUI();
    setTimeout(() => {
      tkScorePopup(window.innerWidth / 2, window.innerHeight / 3, '+' + bonus + ' BONUS!', '#ffd700');
      spawnScoreParticle(bonus, '#ffd700');
    }, 400);
  }

  recordGame(won, seconds);

  // Taiko win celebration
  if (won) {
    donAnim('celebrate');
    setTimeout(() => {
      tkBanner('クリア！🎉');
      tkFlash('#ffd700');
      const boardEl = document.getElementById('board');
      const br = boardEl.getBoundingClientRect();
      for (let i = 0; i < 6; i++) {
        setTimeout(() => {
          tkConfetti(
            br.left + Math.random() * br.width,
            br.top  + Math.random() * br.height
          );
        }, i * 180);
      }
    }, 200);
    // Auto-advance to next level after celebration
    setTimeout(() => {
      const nextLevel = currentLevel + 1;
      showLevelSplash(nextLevel, () => startGame(nextLevel));
    }, 2200);
  }
}

function showLevelSplash(level, onDone) {
  const el = document.getElementById('level-splash');
  el.textContent = 'LEVEL ' + level;
  el.classList.add('show');
  setTimeout(() => {
    el.classList.remove('show');
    onDone();
  }, 1400);
}

function showGameOverSplash() {
  donAnim('cry');
  document.getElementById('gameover-splash').classList.add('show');
}

function hideGameOverSplash() {
  document.getElementById('gameover-splash').classList.remove('show');
}

// ── Taiko Animations ─────────────────────────────────────────────────────

function tkRipple(x, y, color, size) {
  const el = document.createElement('div');
  el.style.cssText = `
    position:fixed; left:${x}px; top:${y}px;
    width:${size}px; height:${size}px; border-radius:50%;
    background:${color}; pointer-events:none; z-index:9000;
  `;
  document.body.appendChild(el);
  el.animate([
    { transform:'translate(-50%,-50%) scale(0)', opacity: 0.85 },
    { transform:'translate(-50%,-50%) scale(5.5)', opacity: 0 },
  ], { duration: 480, easing: 'ease-out' }).onfinish = () => el.remove();
}

function tkPopup(x, y, text, color) {
  const el = document.createElement('div');
  el.textContent = text;
  el.style.cssText = `
    position:fixed; left:${x}px; top:${y}px;
    font-size:1.5rem; font-weight:900;
    color:${color};
    text-shadow:2px 2px 0 #000,-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000;
    pointer-events:none; z-index:9001; white-space:nowrap;
    font-family:'Kosugi Maru','Arial Rounded MT Bold',sans-serif;
  `;
  document.body.appendChild(el);
  el.animate([
    { transform:'translate(-50%,0) scale(0.2)',   opacity:1 },
    { transform:'translate(-50%,-12px) scale(1.5)', opacity:1, offset:0.25 },
    { transform:'translate(-50%,-38px) scale(1.1)', opacity:1, offset:0.65 },
    { transform:'translate(-50%,-70px) scale(0.8)', opacity:0 },
  ], { duration: 900, easing: 'ease-out' }).onfinish = () => el.remove();
}

function tkBanner(text) {
  const el = document.createElement('div');
  el.textContent = text;
  el.style.cssText = `
    position:fixed; left:50%; top:40%;
    font-size:4.5rem; font-weight:900;
    color:#ffd700;
    text-shadow:4px 4px 0 #000,-2px -2px 0 #000,2px -2px 0 #000,-2px 2px 0 #000;
    pointer-events:none; z-index:9002; white-space:nowrap;
    font-family:'Kosugi Maru','Arial Rounded MT Bold',sans-serif;
  `;
  document.body.appendChild(el);
  el.animate([
    { transform:'translate(-50%,-50%) scale(0.1) rotate(-15deg)', opacity:0 },
    { transform:'translate(-50%,-50%) scale(1.25) rotate(4deg)',  opacity:1, offset:0.5 },
    { transform:'translate(-50%,-50%) scale(1) rotate(0deg)',     opacity:1, offset:0.75 },
    { transform:'translate(-50%,-50%) scale(2) rotate(0deg)',     opacity:0 },
  ], { duration: 2200, easing: 'ease-out' }).onfinish = () => el.remove();
}

function tkScreenShake() {
  const board = document.getElementById('board');
  board.style.animation = 'none';
  void board.offsetWidth;
  board.style.animation = 'tk-shake 0.5s ease-out';
  setTimeout(() => { board.style.animation = ''; }, 520);
}

function tkFlash(color) {
  const el = document.createElement('div');
  el.style.cssText = `
    position:fixed; inset:0; background:${color};
    pointer-events:none; z-index:8999; opacity:0;
  `;
  document.body.appendChild(el);
  el.animate([
    { opacity:0 }, { opacity:0.5 }, { opacity:0 }
  ], { duration: 450, easing: 'ease-out' }).onfinish = () => el.remove();
}

function tkConfetti(x, y) {
  const palette = ['#ff2d55','#ffd700','#00c4ff','#4cd964','#ff9500','#ff6b3d','#fff'];
  for (let i = 0; i < 28; i++) {
    const el = document.createElement('div');
    const size = 6 + Math.random() * 8;
    const color = palette[Math.floor(Math.random() * palette.length)];
    const angle = Math.random() * Math.PI * 2;
    const dist  = 60 + Math.random() * 120;
    const dx = Math.cos(angle) * dist;
    const dy = -(Math.abs(Math.sin(angle)) * dist + 30);
    el.style.cssText = `
      position:fixed; left:${x}px; top:${y}px;
      width:${size}px; height:${size}px;
      border-radius:${Math.random() > 0.5 ? '50%' : '2px'};
      background:${color}; pointer-events:none; z-index:9000;
      transform:translate(-50%,-50%);
    `;
    document.body.appendChild(el);
    el.animate([
      { transform:`translate(-50%,-50%) rotate(0deg)`, opacity:1 },
      { transform:`translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${540 + Math.random()*360}deg)`, opacity:0 },
    ], {
      duration: 800 + Math.random() * 600,
      easing: 'cubic-bezier(0.25,0.46,0.45,0.94)',
      delay: Math.random() * 200,
    }).onfinish = () => el.remove();
  }
}

function donAnim(state) {
  const don = document.getElementById('don-chan');
  don.classList.remove('bounce', 'scared', 'celebrate', 'cry');
  void don.offsetWidth; // restart animation
  don.classList.add(state);
  if (state !== 'celebrate' && state !== 'cry') {
    setTimeout(() => don.classList.remove(state), 1000);
  }
}

// ── Stats (localStorage) ─────────────────────────────────────────────────
const STATS_KEY = 'deminer_stats';

function defaultStats() {
  return { played: 0, won: 0, bestTime: null, streak: 0, maxStreak: 0, bestScore: 0 };
}

function loadStats() {
  try {
    return JSON.parse(localStorage.getItem(STATS_KEY)) ||
      { easy: defaultStats(), medium: defaultStats(), hard: defaultStats() };
  } catch { return { easy: defaultStats(), medium: defaultStats(), hard: defaultStats() }; }
}

function saveStats(stats) {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

function recordGame(won, timeSecs) {
  const stats = loadStats();
  const key = 'level_' + currentLevel;
  if (!stats[key]) stats[key] = defaultStats();
  const d = stats[key];
  d.played++;
  if (won) {
    d.won++;
    d.streak++;
    if (d.streak > d.maxStreak) d.maxStreak = d.streak;
    if (d.bestTime === null || timeSecs < d.bestTime) d.bestTime = timeSecs;
    if (score > (d.bestScore || 0)) d.bestScore = score;
  } else {
    d.streak = 0;
  }
  saveStats(stats);
  renderStats();
}

function renderStats() {
  const stats = loadStats();
  const tbody = document.getElementById('stats-body');
  const keys = Object.keys(stats).filter(k => k.startsWith('level_'))
    .sort((a, b) => parseInt(a.split('_')[1]) - parseInt(b.split('_')[1]));
  if (!keys.length) { tbody.innerHTML = '<tr><td colspan="7">No games yet</td></tr>'; return; }
  tbody.innerHTML = keys.map(key => {
    const level = key.split('_')[1];
    const d = stats[key];
    const pct = d.played ? Math.round(d.won / d.played * 100) : 0;
    const best = d.bestTime !== null ? d.bestTime + 's' : '—';
    const streak = d.maxStreak > 0
      ? `${d.streak} <span class="stats-streak-best">(best ${d.maxStreak})</span>`
      : '0';
    const topScore = d.bestScore ? d.bestScore.toLocaleString() : '—';
    return `<tr>
      <td>Level ${level}</td>
      <td>${d.played}</td>
      <td>${d.won}</td>
      <td>${pct}%</td>
      <td class="best">${best}</td>
      <td>${streak}</td>
      <td class="best">${topScore}</td>
    </tr>`;
  }).join('');
}

function resetStats() {
  if (!confirm('Reset all statistics?')) return;
  localStorage.removeItem(STATS_KEY);
  renderStats();
}

startGame(1);
renderStats();

// ── Sound Engine (Web Audio API, no external files) ──────────────────────
const ac = new (window.AudioContext || window.webkitAudioContext)();
let muted = false;

function toggleMute() {
  muted = !muted;
  document.getElementById('mute-btn').textContent = muted ? '🔇' : '🔊';
}

function resume() { if (ac.state === 'suspended') ac.resume(); }

function osc(type, freq, start, dur, gainPeak, dest) {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(gainPeak, start + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g); g.connect(dest);
  o.start(start); o.stop(start + dur);
}

function noise(dur, freq, q, gainPeak, start, dest) {
  const buf = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const flt = ac.createBiquadFilter();
  flt.type = 'bandpass';
  flt.frequency.value = freq;
  flt.Q.value = q;
  const g = ac.createGain();
  g.gain.setValueAtTime(gainPeak, start);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(flt); flt.connect(g); g.connect(dest);
  src.start(start); src.stop(start + dur);
}

// ── Taiko theme sounds ──
function sfxTaikoDon() {
  const t = ac.currentTime;
  // Pitched body: fast sweep from 160→50 Hz (the "DON" thump)
  const o1 = ac.createOscillator(), g1 = ac.createGain();
  o1.type = 'sine';
  o1.frequency.setValueAtTime(160, t);
  o1.frequency.exponentialRampToValueAtTime(50, t + 0.3);
  g1.gain.setValueAtTime(0, t);
  g1.gain.linearRampToValueAtTime(1.0, t + 0.004);
  g1.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
  o1.connect(g1); g1.connect(ac.destination);
  o1.start(t); o1.stop(t + 0.45);
  // Sub punch
  const o2 = ac.createOscillator(), g2 = ac.createGain();
  o2.type = 'sine';
  o2.frequency.setValueAtTime(80, t);
  o2.frequency.exponentialRampToValueAtTime(38, t + 0.22);
  g2.gain.setValueAtTime(0.75, t);
  g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
  o2.connect(g2); g2.connect(ac.destination);
  o2.start(t); o2.stop(t + 0.28);
  // Skin slap (short noise transient)
  noise(0.05, 350, 1.2, 0.7, t, ac.destination);
  // Body resonance noise
  noise(0.35, 90, 0.35, 0.45, t, ac.destination);
}
function sfxTaikoDodoon() {
  const t = ac.currentTime;
  sfxTaikoDon();
  // Second hit slightly lower
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(140, t + 0.2);
  o.frequency.exponentialRampToValueAtTime(44, t + 0.48);
  g.gain.setValueAtTime(0, t + 0.2);
  g.gain.linearRampToValueAtTime(0.85, t + 0.204);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
  o.connect(g); g.connect(ac.destination);
  o.start(t + 0.2); o.stop(t + 0.55);
  noise(0.32, 85, 0.35, 0.38, t + 0.2, ac.destination);
}
function sfxTaikoKatsu() {
  const t = ac.currentTime;
  // Hard rim crack: tight high-freq noise burst
  noise(0.07, 3200, 10, 0.9, t, ac.destination);
  noise(0.05, 1400,  5, 0.5, t, ac.destination);
  // Woody click tone
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = 'square';
  o.frequency.setValueAtTime(900, t);
  o.frequency.exponentialRampToValueAtTime(350, t + 0.06);
  g.gain.setValueAtTime(0.35, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
  o.connect(g); g.connect(ac.destination);
  o.start(t); o.stop(t + 0.09);
  // High overtone crack
  noise(0.025, 6000, 4, 0.4, t, ac.destination);
}
function sfxTaikoBoom() {
  const t = ac.currentTime;
  noise(0.55, 80, 0.6, 1.0, t, ac.destination);
  osc('sine', 60, t, 0.45, 0.9, ac.destination);
  // Comic descending pitch
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(500, t);
  o.frequency.exponentialRampToValueAtTime(40, t + 0.55);
  g.gain.setValueAtTime(0.55, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
  o.connect(g); g.connect(ac.destination);
  o.start(t); o.stop(t + 0.55);
}
function sfxTaikoClear() {
  const t = ac.currentTime;
  // Upbeat ascending fanfare
  const notes = [523, 659, 784, 1047, 1319];
  notes.forEach((f, i) => {
    osc('sine',   f,     t + i * 0.1, 0.28, 0.38, ac.destination);
    osc('square', f * 2, t + i * 0.1, 0.18, 0.09, ac.destination);
  });
  // Final chord
  [523, 659, 784, 1047].forEach(f =>
    osc('sine', f, t + 0.62, 0.6, 0.28, ac.destination)
  );
}

function sfxBeatDrop() {
  const t = ac.currentTime;
  // Rising whoosh
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(80, t);
  o.frequency.exponentialRampToValueAtTime(600, t + 0.25);
  g.gain.setValueAtTime(0.6, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  o.connect(g); g.connect(ac.destination);
  o.start(t); o.stop(t + 0.3);
  // Impact double-don
  noise(0.35, 90, 0.55, 1.0, t + 0.27, ac.destination);
  osc('sine', 72, t + 0.27, 0.28, 1.0, ac.destination);
  noise(0.28, 80, 0.5, 0.8, t + 0.44, ac.destination);
  osc('sine', 60, t + 0.44, 0.22, 0.7, ac.destination);
}

function playSound(name) {
  if (muted) return;
  resume();
  switch (name) {
    case 'click':    sfxTaikoDon();    break;
    case 'flood':    sfxTaikoDodoon(); break;
    case 'flag':     sfxTaikoKatsu();  break;
    case 'unflag':   sfxTaikoKatsu();  break;
    case 'boom':     sfxTaikoBoom();   break;
    case 'win':      sfxTaikoClear();  break;
    case 'beatdrop': sfxBeatDrop();    break;
  }
}
// Re-compute cell size on resize (e.g. orientation change)
let _resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(renderBoard, 150);
});

// ── Background Music ──────────────────────────────────────────────────────
const bgMusic = new Audio(`music/music${Math.floor(Math.random() * 6) + 1}.mp3`);
bgMusic.loop = true;
bgMusic.volume = 0.2; // kept low so game sounds stay louder

let musicMuted = false;

function tryPlayMusic() {
  if (!musicMuted) bgMusic.play().catch(() => {});
  document.removeEventListener('click',       tryPlayMusic);
  document.removeEventListener('contextmenu', tryPlayMusic);
}

// Browsers block autoplay until the user interacts with the page
document.addEventListener('click',       tryPlayMusic);
document.addEventListener('contextmenu', tryPlayMusic);

function toggleMusic() {
  musicMuted = !musicMuted;
  if (musicMuted) {
    bgMusic.pause();
  } else {
    bgMusic.play().catch(() => {});
  }
  document.getElementById('music-btn').textContent = musicMuted ? '🔇' : '🎵';
}

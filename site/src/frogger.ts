import type { Game } from './types.js';

type LaneType = 'goal' | 'water' | 'safe' | 'road' | 'start';

interface Lane {
  type: LaneType;
  speed?: number;
  dir?: 1 | -1;
  spawn?: [number, number];
  len?: [number, number];
  entities: { x: number; len: number }[];
  nextSpawn: number;
}

interface Frog {
  x: number;
  y: number;
  lives: number;
  score: number;
}

interface FroggerState {
  frog: Frog;
  level: number;
  highestRow: number;
  running: boolean;
  pendingReset: boolean;
  columns: number;
  rows: number;
  tileSize: number;
  lanes: Lane[];
  host: HTMLDivElement;
  frame: HTMLDivElement;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  scoreEl: HTMLElement;
  levelEl: HTMLElement;
  livesEl: HTMLElement;
  overlay: HTMLDivElement;
  overlayTitle: HTMLElement;
  overlayText: HTMLElement;
  restartBtn: HTMLButtonElement;
  exitBtns: HTMLElement[];
  lastTime: number;
  animationId: number | null;
  styleEl: HTMLStyleElement;
  unsubscribe: (() => void) | null;
  resizeHandler: () => void;
}

let state: FroggerState | null = null;

const styleContent = `
  * { box-sizing: border-box; }
  .frogger-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(5, 12, 20, 0.9);
    backdrop-filter: blur(2px);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 18px;
  }
  .frogger-container {
    width: min(920px, 100%);
    background: linear-gradient(#0b1b2c, #0f2d44);
    border: 2px solid #1f4c73;
    border-radius: 12px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.35);
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    color: #f2f2f2;
    font-family: "Segoe UI", Roboto, Arial, sans-serif;
  }
  .frogger-hud {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
  }
  .frogger-title {
    font-size: 26px;
    letter-spacing: 1px;
    font-weight: 700;
    text-transform: uppercase;
  }
  .frogger-stats {
    display: flex;
    gap: 14px;
    font-weight: 600;
  }
  .frogger-button {
    background: #2b8a3e;
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 10px 14px;
    font-size: 14px;
    cursor: pointer;
    transition: background 0.2s ease, transform 0.1s ease;
  }
  .frogger-button:hover { background: #2fa54a; }
  .frogger-button:active { transform: translateY(1px); }
  #frogger-canvas {
    width: 100%;
    border-radius: 10px;
    background: #0a1624;
    display: block;
  }
  .frogger-instructions {
    background: #0f2236;
    border: 1px solid #174065;
    border-radius: 8px;
    padding: 10px 12px;
    font-size: 14px;
    color: #d9e7fa;
    line-height: 1.5;
  }
  .frogger-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.65);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  }
  .frogger-overlay.hidden { display: none; }
  .frogger-overlay-content {
    background: #0e2135;
    border: 1px solid #1c4463;
    border-radius: 10px;
    padding: 20px;
    text-align: center;
    max-width: 320px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.45);
    color: #f2f8ff;
  }
  .frogger-controls {
    display: grid;
    grid-template-columns: repeat(3, 70px);
    grid-template-rows: repeat(2, 70px);
    gap: 10px;
    justify-content: center;
    margin: 4px auto 2px;
    width: 230px;
  }
  .frogger-control-btn {
    background: #1d3e5c;
    color: #e9f4ff;
    border: 1px solid #2e5f85;
    border-radius: 10px;
    font-size: 22px;
    font-weight: 700;
    cursor: pointer;
    touch-action: manipulation;
    box-shadow: 0 4px 10px rgba(0,0,0,0.18);
  }
  .frogger-control-btn:active {
    transform: translateY(2px);
  }
  @media (max-width: 640px) {
    .frogger-container { padding: 12px; }
    .frogger-controls { grid-template-columns: repeat(3, 1fr); width: 100%; }
    .frogger-control-btn { font-size: 20px; padding: 10px 0; }
  }
`;

const laneLayout: Omit<Lane, 'entities' | 'nextSpawn'>[] = [
  { type: 'goal' },
  { type: 'water', speed: 1.6, dir: 1, spawn: [1.3, 2.0], len: [2, 3] },
  { type: 'water', speed: 1.9, dir: -1, spawn: [1.1, 1.8], len: [2, 3] },
  { type: 'water', speed: 1.4, dir: 1, spawn: [1.4, 2.1], len: [2, 4] },
  { type: 'safe' },
  { type: 'road', speed: 2.6, dir: -1, spawn: [1.0, 1.5], len: [1, 2] },
  { type: 'road', speed: 2.1, dir: 1, spawn: [1.1, 1.7], len: [1, 2] },
  { type: 'road', speed: 1.7, dir: -1, spawn: [1.3, 1.9], len: [1, 2] },
  { type: 'safe' },
  { type: 'start' },
];

function canPlay(): boolean {
  return window.game.players.length >= 1;
}

function start(): void {
  if (!canPlay()) {
    alert('Join a room to play Frogger!');
    return;
  }

  if (state) {
    stop();
  }

  const styleEl = document.createElement('style');
  styleEl.textContent = styleContent;
  document.head.appendChild(styleEl);

  const backdrop = document.createElement('div');
  backdrop.className = 'frogger-backdrop';

  const frame = document.createElement('div');
  frame.className = 'frogger-container';
  frame.innerHTML = `
    <div class="frogger-hud">
      <button class="frogger-button" data-frogger-exit>Return to chat</button>
      <div class="frogger-title">Frogger</div>
      <div class="frogger-stats">
        <span id="frogger-score">Score: 0</span>
        <span id="frogger-level">Level: 1</span>
        <span id="frogger-lives">Lives: 3</span>
      </div>
    </div>
    <canvas id="frogger-canvas" width="728" height="520"></canvas>
    <div class="frogger-instructions">
      <strong>Move</strong>: Arrow keys or WASD. <strong>Goal</strong>: reach the top without getting hit or falling in the water.
      Logs carry you across. Cars hurt. Clearing a stage speeds things up.
    </div>
    <div class="frogger-controls" aria-label="Touch controls">
      <div></div>
      <button class="frogger-control-btn" data-move="up">▲</button>
      <div></div>
      <button class="frogger-control-btn" data-move="left">◀</button>
      <button class="frogger-control-btn" data-move="down">▼</button>
      <button class="frogger-control-btn" data-move="right">▶</button>
    </div>
  `;

  const statusOverlay = document.createElement('div');
  statusOverlay.className = 'frogger-overlay hidden';
  statusOverlay.innerHTML = `
    <div class="frogger-overlay-content">
      <h2 id="frogger-overlay-title">Paused</h2>
      <p id="frogger-overlay-text"></p>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
        <button class="frogger-button" id="frogger-restart-btn">Play again</button>
        <button class="frogger-button" data-frogger-exit>Exit</button>
      </div>
    </div>
  `;

  backdrop.appendChild(frame);
  backdrop.appendChild(statusOverlay);
  document.body.appendChild(backdrop);

  const canvas = frame.querySelector<HTMLCanvasElement>('#frogger-canvas');
  const scoreEl = frame.querySelector<HTMLElement>('#frogger-score');
  const levelEl = frame.querySelector<HTMLElement>('#frogger-level');
  const livesEl = frame.querySelector<HTMLElement>('#frogger-lives');
  const overlay = statusOverlay;
  const overlayTitle = statusOverlay.querySelector<HTMLElement>(
    '#frogger-overlay-title',
  );
  const overlayText = statusOverlay.querySelector<HTMLElement>(
    '#frogger-overlay-text',
  );
  const restartBtn = statusOverlay.querySelector<HTMLButtonElement>(
    '#frogger-restart-btn',
  );
  const exitBtns = Array.from(
    document.querySelectorAll<HTMLElement>('[data-frogger-exit]'),
  );

  if (
    !canvas ||
    !scoreEl ||
    !levelEl ||
    !livesEl ||
    !overlay ||
    !overlayTitle ||
    !overlayText ||
    !restartBtn
  ) {
    stop();
    return;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    stop();
    return;
  }

  const columns = 13;
  const rows = laneLayout.length;
  const tileSize = Math.floor(canvas.width / columns);
  canvas.height = tileSize * rows;

  const lanes = laneLayout.map((lane) => ({
    ...lane,
    entities: [],
    nextSpawn: nowSeconds() + Math.random() * (lane.spawn ? lane.spawn[1] : 2),
  })) as Lane[];

  const frog: Frog = {
    x: Math.floor(columns / 2),
    y: rows - 1,
    lives: 3,
    score: 0,
  };

  state = {
    frog,
    level: 1,
    highestRow: rows - 1,
    running: true,
    pendingReset: false,
    columns,
    rows,
    tileSize,
    lanes,
    host: backdrop,
    frame,
    canvas,
    ctx,
    scoreEl,
    levelEl,
    livesEl,
    overlay,
    overlayTitle,
    overlayText,
    restartBtn,
    exitBtns,
    lastTime: performance.now(),
    animationId: null,
    styleEl,
    unsubscribe: window.game.subscribeToMessages(() => {}),
    resizeHandler: () => {},
  };

  const resizeHandler = () => updateCanvasSize();
  state.resizeHandler = resizeHandler;
  window.addEventListener('resize', resizeHandler, { passive: true });

  restartBtn.addEventListener('click', () => {
    if (!state) return;
    if (state.frog.lives <= 0) {
      resetFull();
    } else {
      continueGame();
    }
  });

  exitBtns.forEach((btn) => btn.addEventListener('click', stop));
  window.addEventListener('keydown', handleInput);

  setupControlButtons();
  updateCanvasSize();
  updateHud();
  drawBackground();
  drawEntities();
  drawFrog();
  state.animationId = requestAnimationFrame(loop);
}

function stop(): void {
  if (!state) return;

  const { host, styleEl, animationId, unsubscribe, resizeHandler } = state;
  state.running = false;
  if (animationId) cancelAnimationFrame(animationId);
  if (unsubscribe) unsubscribe();
  window.removeEventListener('keydown', handleInput);
  window.removeEventListener('resize', resizeHandler);
  if (host.parentElement) host.remove();
  if (styleEl.parentElement) styleEl.remove();
  state = null;
}

function nowSeconds(): number {
  return performance.now() / 1000;
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function updateCanvasSize(): void {
  if (!state) return;
  const frameWidth =
    state.frame.clientWidth || state.frame.getBoundingClientRect().width || 720;
  const targetWidth = Math.max(320, Math.min(920, Math.floor(frameWidth - 8)));
  const tileSize = Math.max(20, Math.floor(targetWidth / state.columns));
  state.tileSize = tileSize;
  state.canvas.width = tileSize * state.columns;
  state.canvas.height = tileSize * state.rows;
  draw();
}

function spawnEntities(now: number): void {
  const currentState = state;
  if (!currentState) return;
  currentState.lanes.forEach((lane) => {
    if (lane.type !== 'road' && lane.type !== 'water') return;
    if (now < lane.nextSpawn) return;
    const length = lane.len
      ? Math.floor(randomBetween(lane.len[0], lane.len[1]))
      : 2;
    const startX =
      lane.dir && lane.dir > 0 ? -length : currentState.columns + length;
    lane.entities.push({ x: startX, len: length });
    const baseDelay = lane.spawn
      ? randomBetween(lane.spawn[0], lane.spawn[1])
      : 1.5;
    lane.nextSpawn = now + baseDelay * Math.pow(0.9, currentState.level - 1);
  });
}

function moveEntities(delta: number): void {
  const currentState = state;
  if (!currentState) return;
  const speedBoost = 1 + (currentState.level - 1) * 0.18;
  currentState.lanes.forEach((lane) => {
    if (lane.type !== 'road' && lane.type !== 'water') return;
    lane.entities.forEach((entity) => {
      const dir = lane.dir ?? 1;
      const speed = lane.speed ?? 1;
      entity.x += dir * speed * speedBoost * delta;
      if (dir > 0 && entity.x - entity.len > currentState.columns) {
        entity.x = -entity.len;
      } else if (dir < 0 && entity.x + entity.len < -0.5) {
        entity.x = currentState.columns + entity.len;
      }
    });
  });
}

function handleWater(lane: Lane, delta: number): void {
  const currentState = state;
  if (!currentState) return;
  const frogX = currentState.frog.x;
  const onLog = lane.entities.find(
    (log) => frogX >= log.x && frogX <= log.x + log.len,
  );
  if (!onLog) {
    loseLife('Fell into the water!');
    return;
  }
  const dir = lane.dir ?? 1;
  const speed = lane.speed ?? 1;
  currentState.frog.x += dir * speed * delta;
  if (
    currentState.frog.x < -0.5 ||
    currentState.frog.x > currentState.columns - 0.5
  ) {
    loseLife('Fell off the log!');
  }
}

function handleRoad(lane: Lane): void {
  const currentState = state;
  if (!currentState) return;
  const frogX = currentState.frog.x;
  const hit = lane.entities.some(
    (car) => frogX >= car.x - 0.4 && frogX <= car.x + car.len + 0.4,
  );
  if (hit) {
    loseLife('Got hit by a car!');
  }
}

function loseLife(reason: string): void {
  if (!state || state.pendingReset) return;
  state.frog.lives -= 1;
  state.frog.score = Math.max(0, state.frog.score - 50);
  updateHud();
  if (state.frog.lives <= 0) {
    state.pendingReset = true;
    showOverlay('Game Over', `${reason} Press "Play again" or Exit.`);
    return;
  }
  resetFrog();
}

function reachGoal(): void {
  if (!state) return;
  state.frog.score += 250 + (state.level - 1) * 25;
  state.level += 1;
  state.pendingReset = true;
  updateHud();
  showOverlay('Stage Cleared', 'Speed increases! Press Play to continue.');
}

function clampFrog(): void {
  if (!state) return;
  state.frog.x = Math.max(0, Math.min(state.columns - 1, state.frog.x));
  state.frog.y = Math.max(0, Math.min(state.rows - 1, state.frog.y));
  if (state.frog.y < state.highestRow) {
    state.highestRow = state.frog.y;
    state.frog.score += 10;
    updateHud();
  }
}

function handleInput(event: KeyboardEvent): void {
  if (!state || !state.running) return;
  const key = event.key.toLowerCase();
  if (['arrowup', 'w'].includes(key)) {
    moveFrog(0, -1);
  } else if (['arrowdown', 's'].includes(key)) {
    moveFrog(0, 1);
  } else if (['arrowleft', 'a'].includes(key)) {
    moveFrog(-1, 0);
  } else if (['arrowright', 'd'].includes(key)) {
    moveFrog(1, 0);
  }
  event.preventDefault();
}

function moveFrog(dx: number, dy: number): void {
  if (!state || !state.running) return;
  state.frog.x += dx;
  state.frog.y += dy;
  clampFrog();
  if (state.frog.y === 0) {
    reachGoal();
  }
}

function setupControlButtons(): void {
  if (!state) return;
  const buttons =
    state.frame.querySelectorAll<HTMLButtonElement>('[data-move]');
  const activate = (dir: string | undefined) => {
    if (!state || !state.running) return;
    switch (dir) {
      case 'up':
        moveFrog(0, -1);
        break;
      case 'down':
        moveFrog(0, 1);
        break;
      case 'left':
        moveFrog(-1, 0);
        break;
      case 'right':
        moveFrog(1, 0);
        break;
      default:
        break;
    }
  };

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => activate(btn.dataset.move));
    btn.addEventListener(
      'touchstart',
      (e) => {
        e.preventDefault();
        activate(btn.dataset.move);
      },
      { passive: false },
    );
  });
}

function drawBackground(): void {
  if (!state) return;
  const { ctx, tileSize, canvas } = state;
  state.lanes.forEach((lane, rowIndex) => {
    const y = rowIndex * tileSize;
    if (lane.type === 'goal') {
      ctx.fillStyle = '#1b4c36';
    } else if (lane.type === 'safe' || lane.type === 'start') {
      ctx.fillStyle = '#133024';
    } else if (lane.type === 'road') {
      ctx.fillStyle = '#1a1a1a';
    } else {
      ctx.fillStyle = '#0d354d';
    }
    ctx.fillRect(0, y, canvas.width, tileSize);

    if (lane.type === 'road') {
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.setLineDash([8, 12]);
      ctx.beginPath();
      ctx.moveTo(0, y + tileSize / 2);
      ctx.lineTo(canvas.width, y + tileSize / 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  });
}

function drawEntities(): void {
  if (!state) return;
  const { ctx, tileSize } = state;
  state.lanes.forEach((lane, rowIndex) => {
    if (lane.type === 'road') {
      ctx.fillStyle = '#c0392b';
      lane.entities.forEach((car) => {
        const x = car.x * tileSize;
        ctx.fillRect(
          x,
          rowIndex * tileSize + 6,
          car.len * tileSize * 0.95,
          tileSize - 12,
        );
      });
    } else if (lane.type === 'water') {
      ctx.fillStyle = '#1abc9c';
      lane.entities.forEach((log) => {
        const x = log.x * tileSize;
        ctx.fillRect(
          x,
          rowIndex * tileSize + 8,
          log.len * tileSize,
          tileSize - 16,
        );
      });
    }
  });
}

function drawFrog(): void {
  if (!state) return;
  const { ctx, tileSize } = state;
  ctx.save();
  ctx.translate(
    state.frog.x * tileSize + tileSize / 2,
    state.frog.y * tileSize + tileSize / 2,
  );
  ctx.fillStyle = '#3ec46d';
  ctx.beginPath();
  ctx.arc(0, 0, tileSize * 0.32, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1f9b4c';
  ctx.beginPath();
  ctx.arc(-tileSize * 0.15, -tileSize * 0.05, tileSize * 0.1, 0, Math.PI * 2);
  ctx.arc(tileSize * 0.15, -tileSize * 0.05, tileSize * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function update(delta: number): void {
  if (!state) return;
  const now = nowSeconds();
  spawnEntities(now);
  moveEntities(delta);

  const lane = state.lanes[state.frog.y];
  if (lane.type === 'water') {
    handleWater(lane, delta);
  } else if (lane.type === 'road') {
    handleRoad(lane);
  }
  clampFrog();
}

function draw(): void {
  if (!state) return;
  state.ctx.clearRect(0, 0, state.canvas.width, state.canvas.height);
  drawBackground();
  drawEntities();
  drawFrog();
}

function loop(time: number): void {
  if (!state) return;
  const delta = (time - state.lastTime) / 1000;
  state.lastTime = time;
  if (state.running) {
    update(delta);
    draw();
    state.animationId = requestAnimationFrame(loop);
  }
}

function updateHud(): void {
  if (!state) return;
  state.scoreEl.textContent = `Score: ${state.frog.score}`;
  state.levelEl.textContent = `Level: ${state.level}`;
  state.livesEl.textContent = `Lives: ${state.frog.lives}`;
}

function showOverlay(title: string, text: string): void {
  if (!state) return;
  state.overlayTitle.textContent = title;
  state.overlayText.textContent = text;
  state.overlay.classList.remove('hidden');
  state.running = false;
}

function hideOverlay(): void {
  if (!state) return;
  state.overlay.classList.add('hidden');
  if (!state.pendingReset) {
    state.running = true;
    state.lastTime = performance.now();
    state.animationId = requestAnimationFrame(loop);
  }
}

function resetFrog(): void {
  if (!state) return;
  state.frog.x = Math.floor(state.columns / 2);
  state.frog.y = state.rows - 1;
  state.highestRow = state.rows - 1;
}

function resetLanes(): void {
  if (!state) return;
  state.lanes.forEach((lane) => {
    lane.entities = [];
    lane.nextSpawn =
      nowSeconds() + Math.random() * (lane.spawn ? lane.spawn[1] : 2);
  });
}

function resetFull(): void {
  if (!state) return;
  state.pendingReset = false;
  state.level = 1;
  state.frog.score = 0;
  state.frog.lives = 3;
  updateHud();
  resetLanes();
  resetFrog();
  hideOverlay();
}

function continueGame(): void {
  if (!state) return;
  state.pendingReset = false;
  resetLanes();
  resetFrog();
  hideOverlay();
}

function saveState(): unknown {
  if (!state) return null;

  return {
    frog: {
      x: state.frog.x,
      y: state.frog.y,
      lives: state.frog.lives,
      score: state.frog.score,
    },
    level: state.level,
    highestRow: state.highestRow,
  };
}

function loadState(savedState: unknown): void {
  if (!state || !savedState) return;

  const data = savedState as {
    frog: { x: number; y: number; lives: number; score: number };
    level: number;
    highestRow: number;
  };

  // Restore frog state
  state.frog.x = data.frog.x;
  state.frog.y = data.frog.y;
  state.frog.lives = data.frog.lives;
  state.frog.score = data.frog.score;
  state.level = data.level;
  state.highestRow = data.highestRow;

  // Update UI
  updateHud();
  draw();
}

const froggerGame: Game = {
  canPlay,
  start,
  stop,
  saveState,
  loadState,
};

if (!window.games) {
  window.games = {};
}

window.games.frogger = froggerGame;

export {};

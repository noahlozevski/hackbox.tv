import { getPlayerIds } from './player-utils.js';
import type { Game, MessageCallback } from './types.js';
import { registerGame } from './game-registry.js';
import { showGameContainer, hideGameContainer } from './game-container.js';

interface TrailPoint {
  x: number;
  y: number;
}

interface PlayerRuntimeState {
  id: string;
  color: string;
  isLocal: boolean;
  alive: boolean;
  headX: number;
  headY: number;
  dirX: number;
  dirY: number;
  trail: TrailPoint[];
}

interface LightcycleState {
  gridCols: number;
  gridRows: number;
  grid: (string | null)[][];
  players: Map<string, PlayerRuntimeState>;
  localPlayerId: string | null;
  running: boolean;
  canvas: HTMLCanvasElement | null;
  ctx: CanvasRenderingContext2D | null;
  statusEl: HTMLDivElement | null;
  hudEl: HTMLDivElement | null;
  touchButtons: NodeListOf<HTMLButtonElement> | null;
  resizeHandler: (() => void) | null;
  keyDownHandler: ((e: KeyboardEvent) => void) | null;
  keyUpHandler: ((e: KeyboardEvent) => void) | null;
  tickTimer: number | null;
  animationFrameId: number | null;
  unsubscribeMessages: (() => void) | null;
  previousOnMessage: MessageCallback | null;
}

const NET_EVENT_STEP = 'lightcycle-step';

const GRID_COLS = 40;
const GRID_ROWS = 24;
const STEP_INTERVAL_MS = 80;

let state: LightcycleState | null = null;

type Direction = 'up' | 'down' | 'left' | 'right';

let pendingDirection: Direction | null = null;

function canPlay(): boolean {
  const count = window.game.players.length;
  return count >= 2 && count <= 6;
}

function start(): void {
  if (!canPlay()) {
    alert('Lightcycles needs 2–6 players in the room.');
    return;
  }

  if (state) {
    stop();
  }

  const localPlayerId = window.game.state.playerId;
  if (!localPlayerId) {
    alert('Join a room before starting Lightcycles.');
    return;
  }

  const content = showGameContainer('Lightcycles', stop);

  const styleEl = document.createElement('style');
  styleEl.textContent = installStyles();
  document.head.appendChild(styleEl);

  const overlay = document.createElement('div');
  overlay.innerHTML = `
    <div class="lightcycle-frame">
      <div class="lightcycle-header">
        <div>
          <div class="lightcycle-subtitle">Turn to survive. Hitting any trail is instant death.</div>
        </div>
      </div>
      <div class="lightcycle-canvas-wrap">
        <canvas id="lightcycle-canvas"></canvas>
        <div class="lightcycle-hud" id="lightcycle-hud"></div>
      </div>
      <div class="lightcycle-status" id="lightcycle-status"></div>
      <div class="lightcycle-controls" aria-label="Touch controls">
        <button class="lightcycle-control-btn" data-dir="up">▲</button>
        <div></div>
        <button class="lightcycle-control-btn" data-dir="right">▶</button>
        <button class="lightcycle-control-btn" data-dir="left">◀</button>
        <div></div>
        <button class="lightcycle-control-btn" data-dir="down">▼</button>
      </div>
    </div>
  `;

  content.appendChild(overlay);

  const canvas = overlay.querySelector<HTMLCanvasElement>('#lightcycle-canvas');
  const hudEl = overlay.querySelector<HTMLDivElement>('#lightcycle-hud');
  const statusEl = overlay.querySelector<HTMLDivElement>('#lightcycle-status');
  const touchButtons = overlay.querySelectorAll<HTMLButtonElement>(
    '.lightcycle-control-btn',
  );

  if (!canvas || !hudEl || !statusEl) {
    overlay.remove();
    return;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    overlay.remove();
    return;
  }

  const grid: (string | null)[][] = Array.from({ length: GRID_ROWS }, () =>
    Array<string | null>(GRID_COLS).fill(null),
  );

  const players = setupPlayers(localPlayerId, grid);

  const resizeHandler = () => handleResize(canvas, ctx);
  const keyDownHandler = (e: KeyboardEvent) => handleKeyDown(e);
  const keyUpHandler = () => handleKeyUp();

  window.addEventListener('resize', resizeHandler, { passive: true });
  window.addEventListener('keydown', keyDownHandler);
  window.addEventListener('keyup', keyUpHandler);

  touchButtons.forEach((btn) => {
    const dir = btn.dataset.dir as Direction | undefined;
    if (!dir) return;
    btn.addEventListener('click', () => {
      setPendingDirection(dir);
    });
  });

  const previousOnMessage = window.game.onMessage;
  const unsubscribeMessages =
    window.game.subscribeToMessages(handleRemoteMessage);

  state = {
    gridCols: GRID_COLS,
    gridRows: GRID_ROWS,
    grid,
    players,
    localPlayerId,
    running: true,
    canvas,
    ctx,
    statusEl,
    hudEl,
    touchButtons,
    resizeHandler,
    keyDownHandler,
    keyUpHandler,
    tickTimer: null,
    animationFrameId: null,
    unsubscribeMessages,
    previousOnMessage,
  };

  pendingDirection = null;
  resizeHandler();
  updateHud();
  updateStatus('Steer with arrows / WASD. Don’t hit any trail.');

  state.tickTimer = window.setInterval(() => tick(), STEP_INTERVAL_MS);
  const frame = () => {
    render();
    if (state?.running) {
      state.animationFrameId = requestAnimationFrame(frame);
    }
  };
  state.animationFrameId = requestAnimationFrame(frame);
}

function stop(): void {
  if (!state) return;

  state.running = false;

  if (state.animationFrameId !== null) {
    cancelAnimationFrame(state.animationFrameId);
  }

  if (state.tickTimer !== null) {
    clearInterval(state.tickTimer);
  }

  if (state.resizeHandler) {
    window.removeEventListener('resize', state.resizeHandler);
  }
  if (state.keyDownHandler) {
    window.removeEventListener('keydown', state.keyDownHandler);
  }
  if (state.keyUpHandler) {
    window.removeEventListener('keyup', state.keyUpHandler);
  }

  if (state.unsubscribeMessages) {
    state.unsubscribeMessages();
  }

  if (state.previousOnMessage) {
    window.game.onMessage = state.previousOnMessage;
  } else {
    window.game.onMessage = null;
  }

  state = null;
  pendingDirection = null;

  hideGameContainer();
}

function setupPlayers(
  localPlayerId: string,
  grid: (string | null)[][],
): Map<string, PlayerRuntimeState> {
  const ids = getPlayerIds(window.game.players).sort();
  const colors = generateColorPalette(ids.length);
  const players = new Map<string, PlayerRuntimeState>();

  ids.forEach((id, index) => {
    const config = getStartConfig(index, GRID_COLS, GRID_ROWS);
    const player: PlayerRuntimeState = {
      id,
      color: colors[index],
      isLocal: id === localPlayerId,
      alive: true,
      headX: config.x,
      headY: config.y,
      dirX: config.dirX,
      dirY: config.dirY,
      trail: [{ x: config.x, y: config.y }],
    };

    if (grid[config.y] && grid[config.y][config.x] === null) {
      grid[config.y][config.x] = id;
    }

    players.set(id, player);
  });

  return players;
}

function getStartConfig(
  index: number,
  cols: number,
  rows: number,
): { x: number; y: number; dirX: number; dirY: number } {
  const configs = [
    {
      x: 2,
      y: Math.floor(rows / 2),
      dirX: 1,
      dirY: 0,
    },
    {
      x: cols - 3,
      y: Math.floor(rows / 2),
      dirX: -1,
      dirY: 0,
    },
    {
      x: Math.floor(cols / 2),
      y: 2,
      dirX: 0,
      dirY: 1,
    },
    {
      x: Math.floor(cols / 2),
      y: rows - 3,
      dirX: 0,
      dirY: -1,
    },
    {
      x: 2,
      y: 2,
      dirX: 1,
      dirY: 0,
    },
    {
      x: cols - 3,
      y: rows - 3,
      dirX: -1,
      dirY: 0,
    },
  ];

  return configs[index % configs.length];
}

function installStyles(): string {
  return `
  .lightcycle-frame {
    background: radial-gradient(circle at top, #020617 0, #020617 60%);
    border-radius: 18px;
    box-shadow: 0 18px 45px rgba(0,0,0,0.7);
    max-width: 900px;
    width: 100%;
    color: #e5e7eb;
    display: flex;
    flex-direction: column;
    padding: 12px;
    gap: 8px;
    border: 1px solid rgba(148,163,184,0.4);
  }
  .lightcycle-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .lightcycle-title {
    font-weight: 700;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    font-size: 0.9rem;
    color: #38bdf8;
  }
  .lightcycle-subtitle {
    font-size: 0.8rem;
    opacity: 0.85;
  }
  .lightcycle-button {
    background: #ef4444;
    border: none;
    color: #fee2e2;
    font-size: 0.8rem;
    padding: 6px 10px;
    border-radius: 999px;
    cursor: pointer;
    white-space: nowrap;
  }
  .lightcycle-button:hover {
    background: #b91c1c;
  }
  .lightcycle-canvas-wrap {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    border-radius: 16px;
    overflow: hidden;
    background: radial-gradient(circle at 50% -10%, #020617 0, #000000 70%);
  }
  #lightcycle-canvas {
    width: 100%;
    height: 100%;
    touch-action: none;
    display: block;
  }
  .lightcycle-hud {
    position: absolute;
    top: 8px;
    left: 8px;
    right: 8px;
    display: flex;
    justify-content: space-between;
    font-size: 0.78rem;
    color: #cbd5f5;
    pointer-events: none;
  }
  .lightcycle-hud span {
    background: rgba(15,23,42,0.75);
    padding: 4px 8px;
    border-radius: 999px;
    backdrop-filter: blur(6px);
  }
  .lightcycle-status {
    margin-top: 4px;
    font-size: 0.82rem;
    color: #e5e7eb;
    text-align: center;
    min-height: 1.3em;
  }
  .lightcycle-controls {
    margin-top: 6px;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }
  .lightcycle-control-btn {
    background: #020617;
    border-radius: 999px;
    border: 1px solid #334155;
    color: #e5e7eb;
    font-size: 0.95rem;
    padding: 10px 0;
    cursor: pointer;
    touch-action: manipulation;
    box-shadow: 0 4px 10px rgba(0,0,0,0.35);
  }
  .lightcycle-control-btn:active {
    transform: translateY(1px);
  }
  @media (min-width: 768px) {
    .lightcycle-frame {
      padding: 16px;
    }
    .lightcycle-controls {
      max-width: 360px;
      margin: 6px auto 0;
    }
  }
  @media (max-width: 640px) {
    .lightcycle-frame {
      max-width: 480px;
    }
    .lightcycle-title {
      font-size: 0.8rem;
    }
    .lightcycle-subtitle {
      display: none;
    }
  }
  `;
}

function handleResize(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
): void {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function setPendingDirection(dir: Direction): void {
  pendingDirection = dir;
}

function handleKeyDown(event: KeyboardEvent): void {
  if (event.defaultPrevented) return;

  switch (event.key) {
    case 'ArrowUp':
    case 'w':
    case 'W':
      setPendingDirection('up');
      event.preventDefault();
      break;
    case 'ArrowDown':
    case 's':
    case 'S':
      setPendingDirection('down');
      event.preventDefault();
      break;
    case 'ArrowLeft':
    case 'a':
    case 'A':
      setPendingDirection('left');
      event.preventDefault();
      break;
    case 'ArrowRight':
    case 'd':
    case 'D':
      setPendingDirection('right');
      event.preventDefault();
      break;
    default:
      break;
  }
}

function handleKeyUp(): void {
  // No-op for now; we treat input as instant turns only.
}

function applyPendingDirection(player: PlayerRuntimeState): void {
  if (!pendingDirection) return;

  const { dirX, dirY } = player;
  let nextX = dirX;
  let nextY = dirY;

  switch (pendingDirection) {
    case 'up':
      nextX = 0;
      nextY = -1;
      break;
    case 'down':
      nextX = 0;
      nextY = 1;
      break;
    case 'left':
      nextX = -1;
      nextY = 0;
      break;
    case 'right':
      nextX = 1;
      nextY = 0;
      break;
  }

  if (nextX === -dirX && nextY === -dirY) {
    pendingDirection = null;
    return;
  }

  player.dirX = nextX;
  player.dirY = nextY;
  pendingDirection = null;
}

function tick(): void {
  if (!state || !state.running || !state.localPlayerId) return;

  const player = state.players.get(state.localPlayerId);
  if (!player || !player.alive) {
    checkWinCondition();
    return;
  }

  applyPendingDirection(player);

  const nextX = player.headX + player.dirX;
  const nextY = player.headY + player.dirY;

  if (
    nextX < 0 ||
    nextX >= state.gridCols ||
    nextY < 0 ||
    nextY >= state.gridRows ||
    (state.grid[nextY] && state.grid[nextY][nextX] !== null)
  ) {
    player.alive = false;
    updateStatus('You crashed. Watch the remaining riders.');
    window.game.sendMessage(NET_EVENT_STEP, {
      x: player.headX,
      y: player.headY,
      alive: false,
    });
    checkWinCondition();
    return;
  }

  player.headX = nextX;
  player.headY = nextY;
  player.trail.push({ x: nextX, y: nextY });

  if (state.grid[nextY]) {
    state.grid[nextY][nextX] = player.id;
  }

  window.game.sendMessage(NET_EVENT_STEP, {
    x: nextX,
    y: nextY,
    alive: true,
  });

  updateHud();
}

function handleRemoteMessage(
  playerId: string,
  event: string,
  payload: unknown,
): void {
  if (!state || event !== NET_EVENT_STEP) return;

  const data = payload as { x: number; y: number; alive: boolean };

  const player = state.players.get(playerId);
  if (!player) {
    // Ignore messages from players not in the current roster
    return;
  }

  if (!data.alive) {
    player.alive = false;
    updateHud();
    checkWinCondition();
    return;
  }

  const { x, y } = data;
  if (
    x < 0 ||
    x >= state.gridCols ||
    y < 0 ||
    y >= state.gridRows ||
    (state.grid[y] && state.grid[y][x] !== null)
  ) {
    player.alive = false;
    updateHud();
    checkWinCondition();
    return;
  }

  player.headX = x;
  player.headY = y;
  player.trail.push({ x, y });

  if (state.grid[y]) {
    state.grid[y][x] = player.id;
  }

  updateHud();
}

function checkWinCondition(): void {
  if (!state) return;

  const alivePlayers = [...state.players.values()].filter((p) => p.alive);
  if (alivePlayers.length <= 1) {
    const winner = alivePlayers[0];
    if (!winner) {
      updateStatus('Everyone crashed. No survivors.');
    } else if (winner.id === state.localPlayerId) {
      updateStatus('You win! Last lightcycle standing.');
    } else {
      updateStatus('Winner: ' + abbreviateId(winner.id));
    }
  }
}

function abbreviateId(id: string): string {
  if (id.length <= 6) return id;
  return id.slice(0, 3) + '…' + id.slice(-2);
}

function updateHud(): void {
  if (!state || !state.hudEl) return;

  const total = state.players.size;
  const alive = [...state.players.values()].filter((p) => p.alive).length;

  state.hudEl.innerHTML = '';
  const left = document.createElement('span');
  left.textContent = `${alive}/${total} riders alive`;

  const right = document.createElement('span');
  const local = state.localPlayerId
    ? state.players.get(state.localPlayerId)
    : null;
  right.textContent = local && local.alive ? 'You are alive' : 'You are out';

  state.hudEl.appendChild(left);
  state.hudEl.appendChild(right);
}

function updateStatus(text: string): void {
  if (!state || !state.statusEl) return;
  state.statusEl.textContent = text;
}

function render(): void {
  if (!state || !state.canvas || !state.ctx) return;

  const { canvas, ctx } = state;
  const rect = canvas.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;

  ctx.clearRect(0, 0, width, height);

  const gradient = ctx.createRadialGradient(
    width / 2,
    height / 2,
    0,
    width / 2,
    height / 2,
    Math.max(width, height),
  );
  gradient.addColorStop(0, '#020617');
  gradient.addColorStop(1, '#000000');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const cellSize = Math.min(width / state.gridCols, height / state.gridRows);
  const gridWidth = cellSize * state.gridCols;
  const gridHeight = cellSize * state.gridRows;
  const offsetX = (width - gridWidth) / 2;
  const offsetY = (height - gridHeight) / 2;

  ctx.save();
  ctx.translate(offsetX, offsetY);

  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, gridWidth, gridHeight);
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, gridWidth, gridHeight);

  ctx.lineWidth = Math.max(2, cellSize * 0.4);
  ctx.lineCap = 'round';

  const sortedPlayers = [...state.players.values()].sort((a, b) =>
    a.id.localeCompare(b.id),
  );

  for (const player of sortedPlayers) {
    if (player.trail.length < 2) continue;

    ctx.beginPath();
    for (let i = 0; i < player.trail.length; i++) {
      const pt = player.trail[i];
      const cx = (pt.x + 0.5) * cellSize;
      const cy = (pt.y + 0.5) * cellSize;
      if (i === 0) {
        ctx.moveTo(cx, cy);
      } else {
        ctx.lineTo(cx, cy);
      }
    }
    ctx.strokeStyle = player.color;
    ctx.stroke();

    const head = player.trail[player.trail.length - 1];
    const hx = (head.x + 0.5) * cellSize;
    const hy = (head.y + 0.5) * cellSize;

    ctx.beginPath();
    ctx.arc(hx, hy, cellSize * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = player.alive ? '#f9fafb' : 'rgba(148,163,184,0.4)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(hx, hy, cellSize * 0.35, 0, Math.PI * 2);
    ctx.strokeStyle = player.color;
    ctx.lineWidth = 2;
    ctx.stroke();

    if (player.isLocal) {
      ctx.beginPath();
      ctx.arc(hx, hy, cellSize * 0.55, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(56,189,248,0.9)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  ctx.restore();
}

function generateColorPalette(count: number): string[] {
  const palette: string[] = [];
  const baseHues = [200, 30, 140, 80, 260, 0, 320, 180];
  for (let i = 0; i < count; i++) {
    const hue = baseHues[i % baseHues.length];
    const sat = 90;
    const light = 60;
    palette.push(`hsl(${hue} ${sat}% ${light}%)`);
  }
  return palette;
}

const lightcycleGame: Game = {
  canPlay,
  start,
  stop,
};

registerGame('lightcycle', lightcycleGame);

export {};

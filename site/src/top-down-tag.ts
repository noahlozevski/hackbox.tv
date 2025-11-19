import type {
  Game,
  PlayerInfo,
  MessageCallback,
  PlayersChangedCallback,
} from './types.js';
import { getPlayerIds, getFirstPlayerId } from './player-utils.js';
import { registerGame } from './game-registry.js';

interface NetPlayerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface PlayerRuntimeState extends NetPlayerState {
  id: string;
  radius: number;
  color: string;
  isLocal: boolean;
  isIt: boolean;
}

interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

let backdropEl: HTMLDivElement | null = null;
let canvasEl: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let styleEl: HTMLStyleElement | null = null;

let animationFrameId: number | null = null;
let lastTimestamp: number | null = null;

let players: Map<string, PlayerRuntimeState> = new Map();
let localPlayerId: string | null = null;
let itPlayerId: string | null = null;
let hostPlayerId: string | null = null;

const input: InputState = {
  up: false,
  down: false,
  left: false,
  right: false,
};

let stateSendTimer: number | null = null;
let lastSentStateAt = 0;

let prevOnMessage: MessageCallback | null = null;
let prevOnPlayersChanged: PlayersChangedCallback | null = null;

const WORLD_WIDTH = 2; // normalized world units
const WORLD_HEIGHT = 1.2;
const PLAYER_RADIUS = 0.08;
const BASE_SPEED = 0.9; // units / second
const IT_SPEED_MULTIPLIER = 1.2;

const NET_EVENT_STATE = 'top-down-tag-state';
const NET_EVENT_IT = 'top-down-tag-it';

function canPlay(): boolean {
  const count = window.game.players.length;
  return count >= 3 && count <= 10;
}

function start(): void {
  if (!canPlay()) {
    alert('Top-Down Tag needs 3–10 players in the room.');
    return;
  }

  if (backdropEl) {
    stop();
  }

  localPlayerId = window.game.state.playerId;
  if (!localPlayerId) {
    alert('Join a room before starting Top-Down Tag.');
    return;
  }

  hostPlayerId = getFirstPlayerId(window.game.players) ?? null;
  itPlayerId = getFirstPlayerId(window.game.players) ?? null;

  installStyles();
  createUI();
  setupPlayers();
  attachInputHandlers();
  setupNetworking();

  lastTimestamp = null;
  animationFrameId = requestAnimationFrame(loop);
}

function stop(): void {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  if (stateSendTimer !== null) {
    clearInterval(stateSendTimer);
    stateSendTimer = null;
  }

  detachInputHandlers();
  teardownNetworking();

  if (backdropEl && backdropEl.parentNode) {
    backdropEl.parentNode.removeChild(backdropEl);
  }
  backdropEl = null;
  canvasEl = null;
  ctx = null;

  if (styleEl && styleEl.parentNode) {
    styleEl.parentNode.removeChild(styleEl);
  }
  styleEl = null;

  players = new Map();
  localPlayerId = null;
  itPlayerId = null;
  hostPlayerId = null;
  lastTimestamp = null;
}

function installStyles(): void {
  const css = `
  .tag-backdrop {
    position: fixed;
    inset: 0;
    background: radial-gradient(circle at top, #020617 0, #000000 55%);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px;
  }
  .tag-frame {
    background: rgba(15,23,42,0.98);
    border-radius: 18px;
    box-shadow: 0 18px 45px rgba(0,0,0,0.7);
    max-width: 900px;
    width: 100%;
    color: #e5e7eb;
    display: flex;
    flex-direction: column;
    padding: 12px;
    gap: 8px;
  }
  .tag-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .tag-title {
    font-weight: 700;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    font-size: 0.9rem;
    color: #f97316;
  }
  .tag-subtitle {
    font-size: 0.8rem;
    opacity: 0.85;
  }
  .tag-button {
    background: #ef4444;
    border: none;
    color: #fee2e2;
    font-size: 0.8rem;
    padding: 6px 10px;
    border-radius: 999px;
    cursor: pointer;
    white-space: nowrap;
  }
  .tag-button:hover {
    background: #b91c1c;
  }
  .tag-canvas-wrap {
    position: relative;
    width: 100%;
    aspect-ratio: 5 / 3;
    border-radius: 14px;
    overflow: hidden;
    background: radial-gradient(circle at 50% -10%, #0f172a 0, #020617 60%);
  }
  #top-down-tag-canvas {
    width: 100%;
    height: 100%;
    touch-action: none;
    display: block;
  }
  .tag-hud {
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
  .tag-hud span {
    background: rgba(15,23,42,0.75);
    padding: 4px 8px;
    border-radius: 999px;
    backdrop-filter: blur(6px);
  }
  .tag-status {
    margin-top: 4px;
    font-size: 0.82rem;
    color: #e5e7eb;
    text-align: center;
    min-height: 1.3em;
  }
  .tag-controls {
    margin-top: 6px;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }
  .tag-control-btn {
    background: #1f2937;
    border-radius: 999px;
    border: 1px solid #374151;
    color: #e5e7eb;
    font-size: 0.95rem;
    padding: 10px 0;
    cursor: pointer;
    touch-action: manipulation;
    box-shadow: 0 4px 10px rgba(0,0,0,0.35);
  }
  .tag-control-btn:active {
    transform: translateY(1px);
  }
  .tag-control-btn[data-tag-dir="up"] {
    grid-column: 2 / span 1;
  }
  .tag-control-btn[data-tag-dir="left"] {
    grid-column: 1 / span 1;
  }
  .tag-control-btn[data-tag-dir="down"] {
    grid-column: 2 / span 1;
  }
  .tag-control-btn[data-tag-dir="right"] {
    grid-column: 3 / span 1;
  }
  @media (min-width: 768px) {
    .tag-frame {
      padding: 16px;
    }
    .tag-controls {
      max-width: 360px;
      margin: 6px auto 0;
    }
  }
  @media (max-width: 640px) {
    .tag-frame {
      max-width: 480px;
    }
    .tag-title {
      font-size: 0.8rem;
    }
    .tag-subtitle {
      display: none;
    }
  }
  `;

  styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);
}

function createUI(): void {
  const backdrop = document.createElement('div');
  backdrop.className = 'tag-backdrop';

  const frame = document.createElement('div');
  frame.className = 'tag-frame';
  frame.innerHTML = `
    <div class="tag-header">
      <div>
        <div class="tag-title">Top-Down Tag</div>
        <div class="tag-subtitle">One player is IT and runs faster. Tag someone to pass it.</div>
      </div>
      <button class="tag-button" data-tag-exit>Return to chat</button>
    </div>
    <div class="tag-canvas-wrap">
      <canvas id="top-down-tag-canvas"></canvas>
      <div class="tag-hud">
        <span id="tag-hud-role"></span>
        <span id="tag-hud-players"></span>
      </div>
    </div>
    <div class="tag-status" id="tag-status-text"></div>
    <div class="tag-controls" aria-label="Touch controls">
      <button class="tag-control-btn" data-tag-dir="up">▲ Up</button>
      <button class="tag-control-btn" data-tag-dir="left">◀ Left</button>
      <button class="tag-control-btn" data-tag-dir="down">▼ Down</button>
      <button class="tag-control-btn" data-tag-dir="right">▶ Right</button>
    </div>
  `;

  backdrop.appendChild(frame);
  document.body.appendChild(backdrop);

  backdropEl = backdrop;

  const canvas = frame.querySelector<HTMLCanvasElement>(
    '#top-down-tag-canvas',
  );
  canvasEl = canvas;
  if (canvasEl) {
    const ctx2d = canvasEl.getContext('2d');
    if (ctx2d) {
      ctx = ctx2d;
    }
  }

  const exitButtons =
    frame.querySelectorAll<HTMLButtonElement>('[data-tag-exit]');
  exitButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      stop();
    });
  });

  const controlButtons = frame.querySelectorAll<HTMLButtonElement>(
    '.tag-control-btn',
  );

  controlButtons.forEach((btn) => {
    const dir = btn.dataset.tagDir;
    if (!dir) return;

    const setFlag = (value: boolean) => {
      if (dir === 'up') input.up = value;
      if (dir === 'down') input.down = value;
      if (dir === 'left') input.left = value;
      if (dir === 'right') input.right = value;
    };

    btn.addEventListener('pointerdown', () => setFlag(true));
    btn.addEventListener('pointerup', () => setFlag(false));
    btn.addEventListener('pointerleave', () => setFlag(false));
  });

  handleResize();
  window.addEventListener('resize', handleResize);
}

function setupPlayers(): void {
  players = new Map();

  const ids = getPlayerIds(window.game.players).sort();
  const colors = generateColorPalette(ids.length);

  const cols = Math.max(2, Math.ceil(Math.sqrt(ids.length)));
  const rows = Math.ceil(ids.length / cols);

  ids.forEach((id, index) => {
    const colIndex = index % cols;
    const rowIndex = Math.floor(index / cols);

    const safeMarginX = WORLD_WIDTH * 0.1;
    const safeMarginY = WORLD_HEIGHT * 0.1;
    const cellWidth = (WORLD_WIDTH - safeMarginX * 2) / cols;
    const cellHeight = (WORLD_HEIGHT - safeMarginY * 2) / rows;

    const startX =
      -WORLD_WIDTH / 2 +
      safeMarginX +
      cellWidth * colIndex +
      cellWidth * 0.5;
    const startY =
      -WORLD_HEIGHT / 2 +
      safeMarginY +
      cellHeight * rowIndex +
      cellHeight * 0.5;

    const isLocal = id === localPlayerId;
    const isIt = id === itPlayerId;

    const state: PlayerRuntimeState = {
      id,
      x: startX,
      y: startY,
      vx: 0,
      vy: 0,
      radius: PLAYER_RADIUS,
      color: colors[index],
      isLocal,
      isIt,
    };

    players.set(id, state);
  });

  updateHud();
  updateStatusText('Move with WASD or arrows. If you are IT, chase and tag someone!');
}

function generateColorPalette(count: number): string[] {
  const palette: string[] = [];
  const baseHues = [30, 200, 140, 80, 260, 0, 320, 180];
  for (let i = 0; i < count; i++) {
    const hue = baseHues[i % baseHues.length];
    palette.push(`hsl(${hue}, 80%, 60%)`);
  }
  return palette;
}

function handleResize(): void {
  if (!canvasEl || !ctx) return;
  const rect = canvasEl.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvasEl.width = rect.width * dpr;
  canvasEl.height = rect.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, rect.width / 2, rect.height / 2);

  const arenaWidth = rect.width * 0.9;
  const arenaHeight = rect.height * 0.8;
  const scaleX = arenaWidth / WORLD_WIDTH;
  const scaleY = arenaHeight / WORLD_HEIGHT;
  const worldScale = Math.min(scaleX, scaleY);

  const radiusPx = worldScale * (Math.min(WORLD_WIDTH, WORLD_HEIGHT) / 2);
  ctx.scale(worldScale / radiusPx, worldScale / radiusPx);
}

function attachInputHandlers(): void {
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
}

function detachInputHandlers(): void {
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('keyup', handleKeyUp);
  window.removeEventListener('resize', handleResize);
}

function handleKeyDown(event: KeyboardEvent): void {
  if (event.key === 'ArrowUp' || event.key === 'w' || event.key === 'W') {
    input.up = true;
  } else if (
    event.key === 'ArrowDown' ||
    event.key === 's' ||
    event.key === 'S'
  ) {
    input.down = true;
  } else if (
    event.key === 'ArrowLeft' ||
    event.key === 'a' ||
    event.key === 'A'
  ) {
    input.left = true;
  } else if (
    event.key === 'ArrowRight' ||
    event.key === 'd' ||
    event.key === 'D'
  ) {
    input.right = true;
  }
}

function handleKeyUp(event: KeyboardEvent): void {
  if (event.key === 'ArrowUp' || event.key === 'w' || event.key === 'W') {
    input.up = false;
  } else if (
    event.key === 'ArrowDown' ||
    event.key === 's' ||
    event.key === 'S'
  ) {
    input.down = false;
  } else if (
    event.key === 'ArrowLeft' ||
    event.key === 'a' ||
    event.key === 'A'
  ) {
    input.left = false;
  } else if (
    event.key === 'ArrowRight' ||
    event.key === 'd' ||
    event.key === 'D'
  ) {
    input.right = false;
  }
}

function setupNetworking(): void {
  prevOnMessage = window.game.onMessage;
  prevOnPlayersChanged = window.game.handlePlayersChanged;

  window.game.onMessage = (playerId, event, payload) => {
    if (prevOnMessage) {
      prevOnMessage(playerId, event, payload);
    }

    if (event === NET_EVENT_STATE) {
      handleRemoteState(playerId, payload as NetPlayerState);
    } else if (event === NET_EVENT_IT) {
      const data = payload as { itId: string };
      applyItUpdate(data.itId);
    }
  };

  window.game.handlePlayersChanged = (playersList) => {
    if (prevOnPlayersChanged) {
      prevOnPlayersChanged(playersList);
    }
    handlePlayersChanged(playersList);
  };

  stateSendTimer = window.setInterval(sendLocalState, 40);
}

function teardownNetworking(): void {
  if (prevOnMessage) {
    window.game.onMessage = prevOnMessage;
  } else {
    window.game.onMessage = null;
  }

  if (prevOnPlayersChanged) {
    window.game.handlePlayersChanged = prevOnPlayersChanged;
  } else {
    window.game.handlePlayersChanged = null;
  }

  prevOnMessage = null;
  prevOnPlayersChanged = null;
}

function handlePlayersChanged(playersList: PlayerInfo[]): void {
  const playerIds = getPlayerIds(playersList);
  const remaining = new Set(playerIds);
  for (const id of players.keys()) {
    if (!remaining.has(id)) {
      players.delete(id);
    }
  }

  const ids = playerIds.sort();
  const colors = generateColorPalette(ids.length);

  ids.forEach((id, index) => {
    if (!players.has(id)) {
      const colIndex = index % Math.max(2, Math.ceil(Math.sqrt(ids.length)));
      const rowIndex = Math.floor(
        index / Math.max(2, Math.ceil(Math.sqrt(ids.length))),
      );

      const cols = Math.max(2, Math.ceil(Math.sqrt(ids.length)));
      const rows = Math.ceil(ids.length / cols);

      const safeMarginX = WORLD_WIDTH * 0.1;
      const safeMarginY = WORLD_HEIGHT * 0.1;
      const cellWidth = (WORLD_WIDTH - safeMarginX * 2) / cols;
      const cellHeight = (WORLD_HEIGHT - safeMarginY * 2) / rows;

      const startX =
        -WORLD_WIDTH / 2 +
        safeMarginX +
        cellWidth * colIndex +
        cellWidth * 0.5;
      const startY =
        -WORLD_HEIGHT / 2 +
        safeMarginY +
        cellHeight * rowIndex +
        cellHeight * 0.5;

      const isLocal = id === localPlayerId;
      const isIt = id === itPlayerId;

      const state: PlayerRuntimeState = {
        id,
        x: startX,
        y: startY,
        vx: 0,
        vy: 0,
        radius: PLAYER_RADIUS,
        color: colors[index],
        isLocal,
        isIt,
      };
      players.set(id, state);
    }
  });

  if (!hostPlayerId) {
    hostPlayerId = getFirstPlayerId(playersList) ?? null;
  }

  if (!itPlayerId && playersList.length > 0) {
    const firstId = getFirstPlayerId(playersList);
    if (firstId) {
      itPlayerId = firstId;
      applyItUpdate(firstId);
    }
  }

  updateHud();
}

function handleRemoteState(id: string, net: NetPlayerState): void {
  if (id === localPlayerId) {
    return;
  }

  const existing = players.get(id);
  if (!existing) {
    const ids = getPlayerIds(window.game.players).sort();
    const colors = generateColorPalette(ids.length);
    const idx = ids.indexOf(id);
    const color = colors[idx] ?? '#f97316';

    players.set(id, {
      id,
      x: net.x,
      y: net.y,
      vx: net.vx,
      vy: net.vy,
      radius: PLAYER_RADIUS,
      color,
      isLocal: false,
      isIt: id === itPlayerId,
    });
    updateHud();
    return;
  }

  existing.x = net.x;
  existing.y = net.y;
  existing.vx = net.vx;
  existing.vy = net.vy;
}

function sendLocalState(): void {
  if (!localPlayerId) return;
  const local = players.get(localPlayerId);
  if (!local) return;

  const now = performance.now();
  if (now - lastSentStateAt < 30) {
    return;
  }
  lastSentStateAt = now;

  const net: NetPlayerState = {
    x: local.x,
    y: local.y,
    vx: local.vx,
    vy: local.vy,
  };

  window.game.sendMessage(NET_EVENT_STATE, net);
}

function loop(timestamp: number): void {
  if (!canvasEl || !ctx) return;

  if (lastTimestamp == null) {
    lastTimestamp = timestamp;
  }

  const dt = Math.min((timestamp - lastTimestamp) / 1000, 0.05);
  lastTimestamp = timestamp;

  update(dt);
  render();

  animationFrameId = requestAnimationFrame(loop);
}

function update(dt: number): void {
  if (!localPlayerId) return;

  const local = players.get(localPlayerId);
  if (!local) {
    return;
  }

  let moveX = 0;
  let moveY = 0;
  if (input.up) moveY -= 1;
  if (input.down) moveY += 1;
  if (input.left) moveX -= 1;
  if (input.right) moveX += 1;

  const length = Math.hypot(moveX, moveY) || 1;
  moveX /= length;
  moveY /= length;

  const speed =
    BASE_SPEED * (local.isIt ? IT_SPEED_MULTIPLIER : 1);

  local.vx = moveX * speed;
  local.vy = moveY * speed;

  local.x += local.vx * dt;
  local.y += local.vy * dt;

  const halfWidth = WORLD_WIDTH / 2 - local.radius;
  const halfHeight = WORLD_HEIGHT / 2 - local.radius;
  if (local.x < -halfWidth) local.x = -halfWidth;
  if (local.x > halfWidth) local.x = halfWidth;
  if (local.y < -halfHeight) local.y = -halfHeight;
  if (local.y > halfHeight) local.y = halfHeight;

  if (hostPlayerId && window.game.state.playerId === hostPlayerId) {
    performTagChecks();
  }

  updateHud();
}

function performTagChecks(): void {
  if (!itPlayerId) return;
  const itPlayer = players.get(itPlayerId);
  if (!itPlayer) return;

  for (const player of players.values()) {
    if (player.id === itPlayerId) continue;

    const dx = player.x - itPlayer.x;
    const dy = player.y - itPlayer.y;
    const distSq = dx * dx + dy * dy;
    const minDist = player.radius + itPlayer.radius;
    if (distSq <= minDist * minDist) {
      const newItId = player.id;
      if (newItId !== itPlayerId) {
        window.game.sendMessage(NET_EVENT_IT, { itId: newItId });
        applyItUpdate(newItId);
        updateStatusText(`Player ${shortId(newItId)} is now IT!`);
      }
      break;
    }
  }
}

function applyItUpdate(newItId: string): void {
  itPlayerId = newItId;
  for (const player of players.values()) {
    player.isIt = player.id === newItId;
  }
  updateHud();
}

function updateHud(): void {
  const roleSpan = document.getElementById('tag-hud-role');
  const playersSpan = document.getElementById('tag-hud-players');
  if (!roleSpan || !playersSpan) return;

  const total = players.size;
  playersSpan.textContent = `${total} player${total === 1 ? '' : 's'} in game`;

  if (!localPlayerId || !itPlayerId) {
    roleSpan.textContent = 'Waiting for players...';
    return;
  }

  if (localPlayerId === itPlayerId) {
    roleSpan.textContent = 'You are IT! You run faster.';
  } else {
    roleSpan.textContent = `You are hiding. Avoid ${shortId(itPlayerId)}.`;
  }
}

function updateStatusText(text: string): void {
  const el = document.getElementById('tag-status-text');
  if (!el) return;
  el.textContent = text;
}

function render(): void {
  if (!canvasEl || !ctx) return;

  const rect = canvasEl.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.restore();

  ctx.save();
  ctx.translate(width / 2, height / 2);

  const arenaWidth = width * 0.9;
  const arenaHeight = height * 0.8;
  const scaleX = arenaWidth / WORLD_WIDTH;
  const scaleY = arenaHeight / WORLD_HEIGHT;
  const scale = Math.min(scaleX, scaleY);

  ctx.scale(scale, scale);

  ctx.fillStyle = '#020617';
  ctx.fillRect(-WORLD_WIDTH / 2, -WORLD_HEIGHT / 2, WORLD_WIDTH, WORLD_HEIGHT);

  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 0.03;
  ctx.strokeRect(
    -WORLD_WIDTH / 2,
    -WORLD_HEIGHT / 2,
    WORLD_WIDTH,
    WORLD_HEIGHT,
  );

  const sorted = [...players.values()].sort((a, b) =>
    a.id.localeCompare(b.id),
  );

  for (const player of sorted) {
    ctx.save();
    ctx.translate(player.x, player.y);

    ctx.beginPath();
    ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
    ctx.fillStyle = player.color;
    ctx.fill();

    if (player.id === itPlayerId) {
      ctx.lineWidth = 0.04;
      ctx.strokeStyle = '#f97316';
      ctx.stroke();
    }

    if (player.id === localPlayerId) {
      ctx.beginPath();
      ctx.arc(0, 0, player.radius + 0.04, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(59,130,246,0.9)';
      ctx.lineWidth = 0.03;
      ctx.stroke();
    }

    ctx.restore();
  }

  ctx.restore();
}

function shortId(id: string): string {
  if (id.length <= 4) return id;
  return id.slice(0, 4);
}

const topDownTagGame: Game = {
  canPlay,
  start,
  stop,
};

registerGame('topDownTag', topDownTagGame);


import type { Game, PlayerInfo } from './types.js';

interface NetPlayerState {
  x: number;
  y: number;
  angle: number;
  vx: number;
  vy: number;
  alive: boolean;
}

interface PlayerRuntimeState extends NetPlayerState {
  id: string;
  radius: number;
  color: string;
  isLocal: boolean;
  dashTime: number;
  dashCooldown: number;
}

interface InputState {
  left: boolean;
  right: boolean;
  dashQueued: boolean;
}

let backdropEl: HTMLDivElement | null = null;
let canvasEl: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let styleEl: HTMLStyleElement | null = null;

let animationFrameId: number | null = null;
let lastTimestamp: number | null = null;

let players: Map<string, PlayerRuntimeState> = new Map();
let localPlayerId: string | null = null;

let arenaRadius = 1; // world units (normalized)

const input: InputState = {
  left: false,
  right: false,
  dashQueued: false,
};

let stateSendTimer: number | null = null;
let lastSentStateAt = 0;

let unsubscribeMessages: (() => void) | null = null;
let prevOnPlayersChanged: typeof window.game.handlePlayersChanged | null = null;

const WORLD_RADIUS = 1; // arena radius in world units
const PLAYER_RADIUS = 0.08;
const BASE_SPEED = 0.5; // units / second
const DASH_MULTIPLIER = 2.2;
const DASH_DURATION = 0.22; // seconds
const DASH_COOLDOWN = 1.2; // seconds
const ROT_SPEED = Math.PI * 1.4; // rad / second

const NET_EVENT_STATE = 'arena-bumpers-state';

function canPlay(): boolean {
  const count = window.game.players.length;
  return count >= 2 && count <= 8;
}

function start(): void {
  if (!canPlay()) {
    alert('Arena Bumpers needs 2–8 players in the room.');
    return;
  }

  if (backdropEl) {
    stop();
  }

  localPlayerId = window.game.state.playerId;
  if (!localPlayerId) {
    alert('Join a room before starting Arena Bumpers.');
    return;
  }

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
  lastTimestamp = null;
}

function installStyles(): void {
  const css = `
  .arena-bumpers-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.92);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px;
  }
  .arena-bumpers-frame {
    background: radial-gradient(circle at top, #111827 0, #020617 55%);
    border-radius: 18px;
    box-shadow: 0 18px 45px rgba(0,0,0,0.65);
    max-width: 900px;
    width: 100%;
    color: #e5e7eb;
    display: flex;
    flex-direction: column;
    padding: 12px;
    gap: 8px;
  }
  .arena-bumpers-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .arena-bumpers-title {
    font-weight: 700;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    font-size: 0.9rem;
    color: #a5b4fc;
  }
  .arena-bumpers-subtitle {
    font-size: 0.8rem;
    opacity: 0.85;
  }
  .arena-bumpers-button {
    background: #ef4444;
    border: none;
    color: #fee2e2;
    font-size: 0.8rem;
    padding: 6px 10px;
    border-radius: 999px;
    cursor: pointer;
    white-space: nowrap;
  }
  .arena-bumpers-button:hover {
    background: #b91c1c;
  }
  .arena-bumpers-canvas-wrap {
    position: relative;
    width: 100%;
    aspect-ratio: 1 / 1;
    border-radius: 16px;
    overflow: hidden;
    background: radial-gradient(circle at 50% -10%, #1e293b 0, #020617 60%);
  }
  #arena-bumpers-canvas {
    width: 100%;
    height: 100%;
    touch-action: none;
    display: block;
  }
  .arena-bumpers-hud {
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
  .arena-bumpers-hud span {
    background: rgba(15,23,42,0.75);
    padding: 4px 8px;
    border-radius: 999px;
    backdrop-filter: blur(6px);
  }
  .arena-bumpers-status {
    margin-top: 4px;
    font-size: 0.82rem;
    color: #e5e7eb;
    text-align: center;
    min-height: 1.3em;
  }
  .arena-bumpers-controls {
    margin-top: 6px;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }
  .arena-bumpers-control-btn {
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
  .arena-bumpers-control-btn:active {
    transform: translateY(1px);
  }
  @media (min-width: 768px) {
    .arena-bumpers-frame {
      padding: 16px;
    }
    .arena-bumpers-controls {
      max-width: 360px;
      margin: 6px auto 0;
    }
  }
  @media (max-width: 640px) {
    .arena-bumpers-frame {
      max-width: 480px;
    }
    .arena-bumpers-title {
      font-size: 0.8rem;
    }
    .arena-bumpers-subtitle {
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
  backdrop.className = 'arena-bumpers-backdrop';

  const frame = document.createElement('div');
  frame.className = 'arena-bumpers-frame';
  frame.innerHTML = `
    <div class="arena-bumpers-header">
      <div>
        <div class="arena-bumpers-title">Arena Bumpers</div>
        <div class="arena-bumpers-subtitle">Rotate, dash, and knock rivals off the ring.</div>
      </div>
      <button class="arena-bumpers-button" data-arena-exit>Return to chat</button>
    </div>
    <div class="arena-bumpers-canvas-wrap">
      <canvas id="arena-bumpers-canvas"></canvas>
      <div class="arena-bumpers-hud">
        <span id="arena-bumpers-hud-players"></span>
        <span id="arena-bumpers-hud-status"></span>
      </div>
    </div>
    <div class="arena-bumpers-status" id="arena-bumpers-status-text"></div>
    <div class="arena-bumpers-controls" aria-label="Touch controls">
      <button class="arena-bumpers-control-btn" data-arena-control="left">⟲ Turn Left</button>
      <button class="arena-bumpers-control-btn" data-arena-control="dash">Dash</button>
      <button class="arena-bumpers-control-btn" data-arena-control="right">Turn Right ⟳</button>
    </div>
  `;

  backdrop.appendChild(frame);
  document.body.appendChild(backdrop);

  backdropEl = backdrop;

  const canvas = frame.querySelector<HTMLCanvasElement>(
    '#arena-bumpers-canvas',
  );
  canvasEl = canvas;
  if (canvasEl) {
    const ctx2d = canvasEl.getContext('2d');
    if (ctx2d) {
      ctx = ctx2d;
    }
  }

  const exitButtons =
    frame.querySelectorAll<HTMLButtonElement>('[data-arena-exit]');
  exitButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      stop();
    });
  });

  const controlButtons = frame.querySelectorAll<HTMLButtonElement>(
    '.arena-bumpers-control-btn',
  );

  controlButtons.forEach((btn) => {
    const control = btn.dataset.arenaControl;
    if (!control) return;

    if (control === 'dash') {
      btn.addEventListener('click', () => {
        input.dashQueued = true;
      });
      return;
    }

    const flag = control === 'left' ? 'left' : 'right';
    btn.addEventListener('pointerdown', () => {
      input[flag] = true;
    });
    btn.addEventListener('pointerup', () => {
      input[flag] = false;
    });
    btn.addEventListener('pointerleave', () => {
      input[flag] = false;
    });
  });

  handleResize();
  window.addEventListener('resize', handleResize);
}

function setupPlayers(): void {
  players = new Map();

  const ids = [...window.game.players].sort();
  const colors = generateColorPalette(ids.length);

  ids.forEach((id, index) => {
    const angle = (index / ids.length) * Math.PI * 2;
    const radius = WORLD_RADIUS * 0.4;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;

    const isLocal = id === localPlayerId;

    const state: PlayerRuntimeState = {
      id,
      x,
      y,
      angle: angle + Math.PI, // face inward-ish
      vx: 0,
      vy: 0,
      alive: true,
      radius: PLAYER_RADIUS,
      color: colors[index],
      isLocal,
      dashTime: 0,
      dashCooldown: 0,
    };

    players.set(id, state);
  });

  updateHud();
  updateStatusText('Rotate and dash to knock players off the edge.');
}

function generateColorPalette(count: number): string[] {
  const palette: string[] = [];
  const baseHues = [200, 30, 140, 80, 260, 0, 320, 180];
  for (let i = 0; i < count; i++) {
    const hue = baseHues[i % baseHues.length];
    const lightness = 55;
    const sat = 70;
    palette.push(`hsl(${hue}, ${sat}%, ${lightness}%)`);
  }
  return palette;
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
  if (event.defaultPrevented) return;

  switch (event.key) {
    case 'ArrowLeft':
    case 'a':
    case 'A':
      input.left = true;
      event.preventDefault();
      break;
    case 'ArrowRight':
    case 'd':
    case 'D':
      input.right = true;
      event.preventDefault();
      break;
    case ' ':
    case 'ArrowUp':
    case 'w':
    case 'W':
      input.dashQueued = true;
      event.preventDefault();
      break;
    default:
      break;
  }
}

function handleKeyUp(event: KeyboardEvent): void {
  switch (event.key) {
    case 'ArrowLeft':
    case 'a':
    case 'A':
      input.left = false;
      break;
    case 'ArrowRight':
    case 'd':
    case 'D':
      input.right = false;
      break;
    default:
      break;
  }
}

function handleResize(): void {
  if (!canvasEl || !ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const rect = canvasEl.getBoundingClientRect();
  canvasEl.width = Math.max(1, Math.floor(rect.width * dpr));
  canvasEl.height = Math.max(1, Math.floor(rect.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const size = Math.min(rect.width, rect.height);
  arenaRadius = (size / 2) * 0.8;
}

function setupNetworking(): void {
  prevOnPlayersChanged = window.game.handlePlayersChanged;

  unsubscribeMessages = window.game.subscribeToMessages((playerId, event, payload) => {
    if (event === NET_EVENT_STATE) {
      handleRemoteState(playerId, payload as NetPlayerState);
    }
  });

  window.game.handlePlayersChanged = (playersList) => {
    handlePlayersChanged(playersList);
    if (prevOnPlayersChanged) {
      prevOnPlayersChanged(playersList);
    }
  };

  if (stateSendTimer !== null) {
    clearInterval(stateSendTimer);
  }
  stateSendTimer = window.setInterval(() => {
    sendLocalState();
  }, 1000 / 15);
}

function teardownNetworking(): void {
  if (unsubscribeMessages) {
    unsubscribeMessages();
    unsubscribeMessages = null;
  }

  if (prevOnPlayersChanged) {
    window.game.handlePlayersChanged = prevOnPlayersChanged;
  } else {
    window.game.handlePlayersChanged = null;
  }

  if (stateSendTimer !== null) {
    clearInterval(stateSendTimer);
    stateSendTimer = null;
  }

  prevOnPlayersChanged = null;
}

function handlePlayersChanged(playersList: PlayerInfo[]): void {
  const remaining = new Set(playersList);
  for (const id of players.keys()) {
    if (!remaining.has(id)) {
      players.delete(id);
    }
  }

  for (const id of playersList) {
    if (!players.has(id)) {
      const ids = [...playersList].sort();
      const colors = generateColorPalette(ids.length);
      const idx = ids.indexOf(id);
      const angle = (idx / ids.length) * Math.PI * 2;
      const radius = WORLD_RADIUS * 0.4;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;

      const isLocal = id === localPlayerId;
      const state: PlayerRuntimeState = {
        id,
        x,
        y,
        angle,
        vx: 0,
        vy: 0,
        alive: true,
        radius: PLAYER_RADIUS,
        color: colors[idx],
        isLocal,
        dashTime: 0,
        dashCooldown: 0,
      };
      players.set(id, state);
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
    const ids = [...window.game.players].sort();
    const colors = generateColorPalette(ids.length);
    const idx = ids.indexOf(id);
    const color = colors[idx] ?? '#f97316';

    players.set(id, {
      id,
      x: net.x,
      y: net.y,
      angle: net.angle,
      vx: net.vx,
      vy: net.vy,
      alive: net.alive,
      radius: PLAYER_RADIUS,
      color,
      isLocal: false,
      dashTime: 0,
      dashCooldown: 0,
    });
    updateHud();
    return;
  }

  existing.x = net.x;
  existing.y = net.y;
  existing.angle = net.angle;
  existing.vx = net.vx;
  existing.vy = net.vy;
  existing.alive = net.alive;
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
    angle: local.angle,
    vx: local.vx,
    vy: local.vy,
    alive: local.alive,
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
  if (!local || !local.alive) {
    checkWinCondition();
    return;
  }

  if (input.left) {
    local.angle -= ROT_SPEED * dt;
  } else if (input.right) {
    local.angle += ROT_SPEED * dt;
  }

  if (local.dashCooldown > 0) {
    local.dashCooldown -= dt;
  }

  if (input.dashQueued && local.dashCooldown <= 0) {
    local.dashTime = DASH_DURATION;
    local.dashCooldown = DASH_COOLDOWN;
  }
  input.dashQueued = false;

  const speed = BASE_SPEED * (local.dashTime > 0 ? DASH_MULTIPLIER : 1);
  if (local.dashTime > 0) {
    local.dashTime -= dt;
  }

  local.vx = Math.cos(local.angle) * speed;
  local.vy = Math.sin(local.angle) * speed;

  local.x += local.vx * dt;
  local.y += local.vy * dt;

  const distSq = local.x * local.x + local.y * local.y;
  const maxRadius = WORLD_RADIUS - local.radius * 0.1;
  if (distSq > maxRadius * maxRadius) {
    const dist = Math.sqrt(distSq) || 1;
    const nx = local.x / dist;
    const ny = local.y / dist;
    local.x = nx * maxRadius;
    local.y = ny * maxRadius;
    local.vx += nx * 0.6;
    local.vy += ny * 0.6;
  }

  for (const player of players.values()) {
    if (!player.alive) continue;
    const dSq = player.x * player.x + player.y * player.y;
    if (dSq > WORLD_RADIUS * WORLD_RADIUS) {
      player.alive = false;
    }
  }

  const allPlayers = [...players.values()];
  for (let i = 0; i < allPlayers.length; i++) {
    const a = allPlayers[i];
    if (!a.alive) continue;
    for (let j = i + 1; j < allPlayers.length; j++) {
      const b = allPlayers[j];
      if (!b.alive) continue;
      resolveCollision(a, b);
    }
  }

  checkWinCondition();
}

function resolveCollision(a: PlayerRuntimeState, b: PlayerRuntimeState): void {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const distSq = dx * dx + dy * dy;
  const minDist = a.radius + b.radius;

  if (distSq === 0 || distSq > minDist * minDist) {
    return;
  }

  const dist = Math.sqrt(distSq);
  const nx = dx / dist;
  const ny = dy / dist;
  const overlap = minDist - dist;

  const push = overlap / 2;
  a.x -= nx * push;
  a.y -= ny * push;
  b.x += nx * push;
  b.y += ny * push;

  const rvx = b.vx - a.vx;
  const rvy = b.vy - a.vy;
  const impact = rvx * nx + rvy * ny;
  const impulse = impact < 0 ? -impact : impact;

  const bump = impulse + 0.4;
  a.vx -= nx * bump;
  a.vy -= ny * bump;
  b.vx += nx * bump;
  b.vy += ny * bump;
}

function checkWinCondition(): void {
  const alive = [...players.values()].filter((p) => p.alive);
  if (alive.length <= 1) {
    const winner = alive[0];
    if (!winner) {
      updateStatusText('Round over! Everyone fell off.');
      return;
    }
    if (winner.id === localPlayerId) {
      updateStatusText('You win! Stay on the ring to defend your title.');
    } else {
      updateStatusText(
        `Round over! ${winner.id.slice(0, 6)} is the last one standing.`,
      );
    }
  } else {
    updateHud();
  }
}

function updateHud(): void {
  const playersSpan = document.getElementById('arena-bumpers-hud-players');
  const statusSpan = document.getElementById('arena-bumpers-hud-status');
  if (!playersSpan || !statusSpan) return;

  const total = players.size;
  const alive = [...players.values()].filter((p) => p.alive).length;

  playersSpan.textContent = `${alive}/${total} in the arena`;

  const local = localPlayerId ? players.get(localPlayerId) : null;
  const cooldownPercent = local
    ? Math.max(0, Math.min(1, local.dashCooldown / DASH_COOLDOWN))
    : 0;
  if (local && local.dashCooldown <= 0) {
    statusSpan.textContent = 'Dash ready';
  } else if (local) {
    statusSpan.textContent = `Dash recharging ${(cooldownPercent * 100).toFixed(0)}%`;
  } else {
    statusSpan.textContent = '';
  }
}

function updateStatusText(text: string): void {
  const el = document.getElementById('arena-bumpers-status-text');
  if (!el) return;
  el.textContent = text;
}

function render(): void {
  if (!canvasEl || !ctx) return;

  const rect = canvasEl.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  const cx = width / 2;
  const cy = height / 2;

  ctx.clearRect(0, 0, width, height);

  const gradient = ctx.createRadialGradient(
    cx,
    cy,
    0,
    cx,
    cy,
    arenaRadius * 1.1,
  );
  gradient.addColorStop(0, '#111827');
  gradient.addColorStop(0.7, '#020617');
  gradient.addColorStop(1, '#000000');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.translate(cx, cy);

  ctx.beginPath();
  ctx.arc(0, 0, arenaRadius, 0, Math.PI * 2);
  ctx.fillStyle = '#020617';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#3b82f6';
  ctx.stroke();

  ctx.setLineDash([6, 6]);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(148,163,184,0.5)';
  ctx.stroke();
  ctx.setLineDash([]);

  const sorted = [...players.values()].sort((a, b) => a.id.localeCompare(b.id));

  for (const player of sorted) {
    const px = player.x * arenaRadius;
    const py = player.y * arenaRadius;

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(player.angle + Math.PI / 2);

    if (!player.alive) {
      ctx.globalAlpha = 0.25;
    }

    ctx.beginPath();
    ctx.arc(0, 0, player.radius * arenaRadius, 0, Math.PI * 2);
    ctx.fillStyle = player.color;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(0, -player.radius * arenaRadius);
    ctx.lineTo(0, -player.radius * arenaRadius * 0.4);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    if (player.isLocal) {
      ctx.beginPath();
      ctx.arc(0, 0, player.radius * arenaRadius + 6, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(59,130,246,0.9)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.restore();
  }

  ctx.restore();
}

const arenaBumpersGame: Game = {
  canPlay,
  start,
  stop,
};

if (!window.games) {
  window.games = {};
}

window.games.arenaBumpers = arenaBumpersGame;

export {};

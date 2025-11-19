import type { Game } from './types.js';

interface NetMarbleState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  checkpoint: number;
  finished: boolean;
  time: number;
}

interface Marble extends NetMarbleState {
  id: string;
  color: string;
  isLocal: boolean;
  trail: { x: number; y: number }[];
  lastUpdate: number;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Checkpoint {
  x: number;
  y: number;
  r: number;
}

const WORLD_WIDTH = 10;
const WORLD_HEIGHT = 18;
const MARBLE_RADIUS = 0.28;
const MAX_SPEED = 6;
const ACCEL_SCALE = 8;
const FRICTION = 0.92;

const STATE_EVENT = 'marble-race-state';

let backdropEl: HTMLDivElement | null = null;
let canvasEl: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let styleEl: HTMLStyleElement | null = null;

let animationId: number | null = null;
let lastTime: number | null = null;

let localId: string | null = null;
let marbles = new Map<string, Marble>();

let ax = 0;
let ay = 0;

let motionHandler: ((e: DeviceMotionEvent) => void) | null = null;
let pointerId: number | null = null;

let resizeHandler: (() => void) | null = null;
let stateSendTimer: number | null = null;
let unsubscribeMessages: (() => void) | null = null;
let prevOnPlayersChanged: typeof window.game.handlePlayersChanged | null = null;

const TRACK_WALLS: Rect[] = [
  { x: 0, y: 0, w: WORLD_WIDTH, h: 0.5 },
  { x: 0, y: WORLD_HEIGHT - 0.5, w: WORLD_WIDTH, h: 0.5 },
  { x: 0, y: 0, w: 0.5, h: WORLD_HEIGHT },
  { x: WORLD_WIDTH - 0.5, y: 0, w: 0.5, h: WORLD_HEIGHT },
  { x: 2, y: 3, w: WORLD_WIDTH - 4, h: 0.5 },
  { x: 2, y: 6, w: WORLD_WIDTH - 4, h: 0.5 },
  { x: 1.2, y: 9, w: WORLD_WIDTH - 2.4, h: 0.5 },
  { x: 2, y: 12, w: WORLD_WIDTH - 4, h: 0.5 },
  { x: 3, y: 15, w: WORLD_WIDTH - 6, h: 0.5 },
];

const CHECKPOINTS: Checkpoint[] = [
  { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT - 2, r: 0.6 },
  { x: 1.2, y: 13.3, r: 0.6 },
  { x: WORLD_WIDTH - 1.2, y: 10.3, r: 0.6 },
  { x: 1.2, y: 7.3, r: 0.6 },
  { x: WORLD_WIDTH - 1.2, y: 4.3, r: 0.6 },
  { x: WORLD_WIDTH / 2, y: 1.4, r: 0.7 },
];

function canPlay(): boolean {
  return window.game.players.length >= 1;
}

function start(): void {
  if (!canPlay()) {
    alert('Join a room to play Marble Race.');
    return;
  }

  if (backdropEl) {
    stop();
  }

  localId = window.game.state.playerId;
  if (!localId) {
    alert('Join a room before starting Marble Race.');
    return;
  }

  installStyles();
  createUI();
  setupMarbles();
  setupInput();
  setupNetworking();

  lastTime = null;
  animationId = requestAnimationFrame(loop);
}

function stop(): void {
  if (animationId !== null) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }

  teardownInput();
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

  marbles = new Map();
  localId = null;
}

function installStyles(): void {
  const css = `
    .marble-race-backdrop {
      position: fixed;
      inset: 0;
      background: radial-gradient(circle at top, rgba(15,23,42,0.98), rgba(15,23,42,0.96));
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      padding: 14px;
    }
    .marble-race-frame {
      width: min(920px, 100%);
      background: linear-gradient(145deg, #020617, #020617);
      border-radius: 16px;
      box-shadow: 0 14px 38px rgba(0,0,0,0.7);
      color: #e5e7eb;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 12px;
    }
    .marble-race-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
    }
    .marble-race-title {
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      font-size: 0.95rem;
      color: #a5b4fc;
    }
    .marble-race-subtitle {
      font-size: 0.8rem;
      opacity: 0.8;
    }
    .marble-race-button {
      border: none;
      border-radius: 999px;
      padding: 7px 12px;
      font-size: 0.8rem;
      cursor: pointer;
      background: #ef4444;
      color: #fee2e2;
      white-space: nowrap;
    }
    .marble-race-button:hover {
      background: #b91c1c;
    }
    .marble-race-main {
      display: grid;
      grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
      gap: 10px;
    }
    .marble-race-canvas-wrap {
      position: relative;
      background: radial-gradient(circle at 50% -20%, #0f172a, #020617 70%);
      border-radius: 12px;
      overflow: hidden;
      box-shadow: inset 0 0 0 1px rgba(148,163,184,0.3);
    }
    #marble-race-canvas {
      width: 100%;
      display: block;
      touch-action: none;
    }
    .marble-race-hud {
      position: absolute;
      top: 8px;
      left: 8px;
      right: 8px;
      display: flex;
      justify-content: space-between;
      font-size: 0.75rem;
      pointer-events: none;
      color: #e5e7eb;
    }
    .marble-race-hud span {
      background: rgba(15,23,42,0.8);
      padding: 4px 8px;
      border-radius: 999px;
      backdrop-filter: blur(6px);
    }
    .marble-race-side {
      display: flex;
      flex-direction: column;
      gap: 8px;
      font-size: 0.8rem;
    }
    .marble-race-instructions {
      background: rgba(15,23,42,0.9);
      border-radius: 10px;
      padding: 8px 10px;
      border: 1px solid rgba(148,163,184,0.35);
      line-height: 1.45;
    }
    .marble-race-list {
      background: rgba(15,23,42,0.9);
      border-radius: 10px;
      padding: 8px 10px;
      border: 1px solid rgba(148,163,184,0.35);
      max-height: 190px;
      overflow: auto;
    }
    .marble-race-list h3 {
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-bottom: 6px;
      color: #9ca3af;
    }
    .marble-race-list ul {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .marble-race-list li {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 3px 0;
    }
    .marble-race-dot {
      width: 10px;
      height: 10px;
      border-radius: 999px;
      margin-right: 6px;
      flex-shrink: 0;
    }
    .marble-race-player {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .marble-race-joystick {
      margin-top: 4px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .marble-race-joystick-pad {
      width: 80px;
      aspect-ratio: 1 / 1;
      border-radius: 999px;
      border: 1px solid rgba(148,163,184,0.6);
      background: radial-gradient(circle at 30% 20%, #1f2937, #020617);
      position: relative;
      touch-action: none;
    }
    .marble-race-joystick-thumb {
      position: absolute;
      width: 34px;
      height: 34px;
      border-radius: 999px;
      background: #38bdf8;
      box-shadow: 0 4px 12px rgba(56,189,248,0.6);
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
    }
    .marble-race-joystick-text {
      flex: 1;
    }
    .marble-race-joystick-text strong {
      display: block;
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #9ca3af;
      margin-bottom: 2px;
    }
    @media (max-width: 768px) {
      .marble-race-frame {
        padding: 10px;
      }
      .marble-race-main {
        grid-template-columns: 1fr;
      }
    }
  `;

  styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);
}

function createUI(): void {
  const backdrop = document.createElement('div');
  backdrop.className = 'marble-race-backdrop';

  const frame = document.createElement('div');
  frame.className = 'marble-race-frame';
  frame.innerHTML = `
    <div class="marble-race-header">
      <div>
        <div class="marble-race-title">Marble Race</div>
        <div class="marble-race-subtitle">Tilt your phone to roll through the maze. First to the top wins.</div>
      </div>
      <button class="marble-race-button" data-marble-exit>Return to chat</button>
    </div>
    <div class="marble-race-main">
      <div class="marble-race-canvas-wrap">
        <canvas id="marble-race-canvas"></canvas>
        <div class="marble-race-hud">
          <span id="marble-race-hud-players"></span>
          <span id="marble-race-hud-status"></span>
        </div>
      </div>
      <div class="marble-race-side">
        <div class="marble-race-instructions">
          Tilt your phone to steer your marble. On desktop or devices without motion sensors, drag the blue pad to apply force.
          Stay on the track, weave through walls, and reach the glowing finish circle at the top.
        </div>
        <div class="marble-race-list">
          <h3>Race Progress</h3>
          <ul id="marble-race-standings"></ul>
        </div>
        <div class="marble-race-joystick" aria-label="Fallback touch controls">
          <div class="marble-race-joystick-pad" id="marble-race-joystick">
            <div class="marble-race-joystick-thumb" id="marble-race-thumb"></div>
          </div>
          <div class="marble-race-joystick-text">
            <strong>Tilt or drag to roll</strong>
            <span id="marble-race-input-note">Waiting for motion data… you can always drag the pad.</span>
          </div>
        </div>
      </div>
    </div>
  `;

  backdrop.appendChild(frame);
  document.body.appendChild(backdrop);
  backdropEl = backdrop;

  const canvas = frame.querySelector<HTMLCanvasElement>('#marble-race-canvas');
  canvasEl = canvas ?? null;
  if (canvasEl) {
    const context = canvasEl.getContext('2d');
    if (context) {
      ctx = context;
    }
  }

  const exitButtons =
    frame.querySelectorAll<HTMLButtonElement>('[data-marble-exit]');
  exitButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      stop();
    });
  });

  handleResize();
  resizeHandler = handleResize;
  window.addEventListener('resize', handleResize, { passive: true });
}

function setupMarbles(): void {
  marbles = new Map();

  const ids = [...window.game.players].sort();
  const colors = generateColors(ids.length);

  ids.forEach((id, index) => {
    const startX = WORLD_WIDTH / 2 + (index - (ids.length - 1) / 2) * 0.6;
    const startY = WORLD_HEIGHT - 1.6;

    const marble: Marble = {
      id,
      x: startX,
      y: startY,
      vx: 0,
      vy: 0,
      checkpoint: 0,
      finished: false,
      time: 0,
      color: colors[index] ?? '#38bdf8',
      isLocal: id === localId,
      trail: [],
      lastUpdate: performance.now(),
    };

    marbles.set(id, marble);
  });

  updateHud();
  updateStandings();
}

function generateColors(count: number): string[] {
  const base = [200, 35, 140, 90, 260, 10, 310, 180];
  const colors: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const hue = base[i % base.length];
    const sat = 70;
    const light = 60;
    colors.push(`hsl(${hue} ${sat}% ${light}%)`);
  }
  return colors;
}

function setupInput(): void {
  const inputNote = document.getElementById('marble-race-input-note');
  const joystick = document.getElementById(
    'marble-race-joystick',
  ) as HTMLDivElement | null;

  if ('DeviceMotionEvent' in window) {
    motionHandler = (event: DeviceMotionEvent) => {
      const acc = event.accelerationIncludingGravity;
      if (!acc) return;

      ax = clamp(acc.x != null ? -acc.x : 0, -1.5, 1.5);
      ay = clamp(acc.y != null ? acc.y : 0, -1.5, 1.5);
      if (inputNote) {
        inputNote.textContent =
          'Motion enabled. Keep the phone upright and tilt gently.';
      }
    };
    window.addEventListener('devicemotion', motionHandler, { passive: true });
  }

  if (joystick) {
    const thumb = document.getElementById(
      'marble-race-thumb',
    ) as HTMLDivElement | null;
    const rect = () => joystick.getBoundingClientRect();

    const updateFromPointer = (clientX: number, clientY: number) => {
      const r = rect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      let dx = (clientX - cx) / (r.width / 2);
      let dy = (clientY - cy) / (r.height / 2);
      const len = Math.hypot(dx, dy);
      if (len > 1) {
        dx /= len;
        dy /= len;
      }
      ax = clamp(dx * 1.2, -1.5, 1.5);
      ay = clamp(dy * 1.2, -1.5, 1.5);
      if (thumb) {
        thumb.style.transform = `translate(${dx * 22 - 50}%, ${dy * 22 - 50}%)`;
      }
      if (inputNote && !('DeviceMotionEvent' in window)) {
        inputNote.textContent = 'Using touch pad for control.';
      }
    };

    const resetThumb = () => {
      if (thumb) {
        thumb.style.transform = 'translate(-50%, -50%)';
      }
      ax = 0;
      ay = 0;
    };

    joystick.addEventListener('pointerdown', (ev) => {
      if (pointerId !== null && ev.pointerId !== pointerId) return;
      pointerId = ev.pointerId;
      joystick.setPointerCapture(ev.pointerId);
      updateFromPointer(ev.clientX, ev.clientY);
    });

    joystick.addEventListener('pointermove', (ev) => {
      if (pointerId === null || ev.pointerId !== pointerId) return;
      updateFromPointer(ev.clientX, ev.clientY);
    });

    const end = (ev: PointerEvent) => {
      if (pointerId === null || ev.pointerId !== pointerId) return;
      joystick.releasePointerCapture(ev.pointerId);
      pointerId = null;
      resetThumb();
    };

    joystick.addEventListener('pointerup', end);
    joystick.addEventListener('pointercancel', end);
    joystick.addEventListener('pointerleave', (ev) => {
      if (pointerId === null || ev.pointerId !== pointerId) return;
      end(ev);
    });
  }
}

function teardownInput(): void {
  if (motionHandler) {
    window.removeEventListener('devicemotion', motionHandler);
    motionHandler = null;
  }

  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler);
    resizeHandler = null;
  }

  pointerId = null;
}

function setupNetworking(): void {
  prevOnPlayersChanged = window.game.handlePlayersChanged;

  unsubscribeMessages = window.game.subscribeToMessages(
    (playerId, event, payload) => {
      if (event === STATE_EVENT) {
        handleRemoteState(playerId, payload as NetMarbleState);
      }
    },
  );

  window.game.handlePlayersChanged = (playersList: string[]) => {
    handlePlayersChanged(playersList);
    if (prevOnPlayersChanged) prevOnPlayersChanged(playersList);
  };

  if (stateSendTimer !== null) {
    clearInterval(stateSendTimer);
  }
  stateSendTimer = window.setInterval(() => {
    sendLocalState();
  }, 1000 / 20);
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
  prevOnPlayersChanged = null;

  if (stateSendTimer !== null) {
    clearInterval(stateSendTimer);
    stateSendTimer = null;
  }
}

function handlePlayersChanged(playersList: string[]): void {
  const active = new Set(playersList);
  for (const id of marbles.keys()) {
    if (!active.has(id)) {
      marbles.delete(id);
    }
  }

  const ids = [...playersList].sort();
  const colors = generateColors(ids.length);

  ids.forEach((id, index) => {
    if (marbles.has(id)) return;
    const startX = WORLD_WIDTH / 2 + (index - (ids.length - 1) / 2) * 0.6;
    const startY = WORLD_HEIGHT - 1.6;
    const marble: Marble = {
      id,
      x: startX,
      y: startY,
      vx: 0,
      vy: 0,
      checkpoint: 0,
      finished: false,
      time: 0,
      color: colors[index] ?? '#38bdf8',
      isLocal: id === localId,
      trail: [],
      lastUpdate: performance.now(),
    };
    marbles.set(id, marble);
  });

  updateHud();
  updateStandings();
}

function handleRemoteState(id: string, net: NetMarbleState): void {
  if (id === localId) return;

  let marble = marbles.get(id);
  if (!marble) {
    marble = {
      id,
      x: net.x,
      y: net.y,
      vx: net.vx,
      vy: net.vy,
      checkpoint: net.checkpoint,
      finished: net.finished,
      time: net.time,
      color: '#38bdf8',
      isLocal: false,
      trail: [],
      lastUpdate: performance.now(),
    };
    marbles.set(id, marble);
  } else {
    marble.x = net.x;
    marble.y = net.y;
    marble.vx = net.vx;
    marble.vy = net.vy;
    marble.checkpoint = net.checkpoint;
    marble.finished = net.finished;
    marble.time = net.time;
    marble.lastUpdate = performance.now();
  }

  marble.trail.push({ x: marble.x, y: marble.y });
  if (marble.trail.length > 80) {
    marble.trail.shift();
  }

  updateHud();
  updateStandings();
}

function sendLocalState(): void {
  if (!localId) return;
  const marble = marbles.get(localId);
  if (!marble) return;

  const net: NetMarbleState = {
    x: marble.x,
    y: marble.y,
    vx: marble.vx,
    vy: marble.vy,
    checkpoint: marble.checkpoint,
    finished: marble.finished,
    time: marble.time,
  };

  window.game.sendMessage(STATE_EVENT, net);
}

function loop(timestamp: number): void {
  if (!canvasEl || !ctx) return;

  if (lastTime == null) {
    lastTime = timestamp;
  }
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;

  update(dt);
  render();

  animationId = requestAnimationFrame(loop);
}

function update(dt: number): void {
  if (!localId) return;
  const marble = marbles.get(localId);
  if (!marble) return;

  if (Math.abs(ax) < 0.02 && Math.abs(ay) < 0.02) {
    ax = 0;
    ay = 0;
  }

  const accelX = ax * ACCEL_SCALE;
  const accelY = ay * ACCEL_SCALE;

  marble.vx += accelX * dt;
  marble.vy += accelY * dt;

  const speed = Math.hypot(marble.vx, marble.vy);
  if (speed > MAX_SPEED) {
    marble.vx = (marble.vx / speed) * MAX_SPEED;
    marble.vy = (marble.vy / speed) * MAX_SPEED;
  }

  marble.vx *= FRICTION;
  marble.vy *= FRICTION;

  marble.x += marble.vx * dt;
  marble.y += marble.vy * dt;

  marble.x = clamp(
    marble.x,
    MARBLE_RADIUS + 0.2,
    WORLD_WIDTH - MARBLE_RADIUS - 0.2,
  );
  marble.y = clamp(
    marble.y,
    MARBLE_RADIUS + 0.2,
    WORLD_HEIGHT - MARBLE_RADIUS - 0.2,
  );

  resolveCollisions(marble);
  updateCheckpoint(marble, dt);

  marble.trail.push({ x: marble.x, y: marble.y });
  if (marble.trail.length > 80) {
    marble.trail.shift();
  }

  for (const m of marbles.values()) {
    if (!m.isLocal && performance.now() - m.lastUpdate > 2000) {
      m.finished = true;
    }
  }

  updateHud();
  updateStandings();
}

function resolveCollisions(marble: Marble): void {
  for (const wall of TRACK_WALLS) {
    const nearestX = clamp(marble.x, wall.x, wall.x + wall.w);
    const nearestY = clamp(marble.y, wall.y, wall.y + wall.h);
    const dx = marble.x - nearestX;
    const dy = marble.y - nearestY;
    const distSq = dx * dx + dy * dy;
    const r = MARBLE_RADIUS;
    if (distSq < r * r) {
      const dist = Math.sqrt(distSq) || 0.0001;
      const overlap = r - dist;
      const nx = dx / dist;
      const ny = dy / dist;
      marble.x += nx * overlap;
      marble.y += ny * overlap;

      const dot = marble.vx * nx + marble.vy * ny;
      if (dot < 0) {
        marble.vx -= 1.4 * dot * nx;
        marble.vy -= 1.4 * dot * ny;
      }
    }
  }
}

function updateCheckpoint(marble: Marble, dt: number): void {
  if (marble.finished) {
    marble.time += dt;
    return;
  }

  marble.time += dt;

  const nextIndex = marble.checkpoint;
  if (nextIndex >= CHECKPOINTS.length) {
    marble.finished = true;
    return;
  }

  const cp = CHECKPOINTS[nextIndex];
  const dx = marble.x - cp.x;
  const dy = marble.y - cp.y;
  const distSq = dx * dx + dy * dy;
  if (distSq <= cp.r * cp.r) {
    marble.checkpoint += 1;
    if (marble.checkpoint >= CHECKPOINTS.length) {
      marble.finished = true;
    }
  }
}

function render(): void {
  if (!canvasEl || !ctx) return;

  const rect = canvasEl.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;

  canvasEl.width = width * window.devicePixelRatio;
  canvasEl.height = height * window.devicePixelRatio;

  ctx.setTransform(
    window.devicePixelRatio,
    0,
    0,
    window.devicePixelRatio,
    0,
    0,
  );
  ctx.clearRect(0, 0, width, height);

  const scaleX = width / WORLD_WIDTH;
  const scaleY = height / WORLD_HEIGHT;

  ctx.save();
  ctx.scale(scaleX, scaleY);

  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  const grad = ctx.createLinearGradient(0, WORLD_HEIGHT, 0, 0);
  grad.addColorStop(0, '#020617');
  grad.addColorStop(1, '#0f172a');
  ctx.fillStyle = grad;
  ctx.fillRect(0.6, 0.6, WORLD_WIDTH - 1.2, WORLD_HEIGHT - 1.2);

  ctx.strokeStyle = 'rgba(148,163,184,0.4)';
  ctx.lineWidth = 0.04;
  ctx.setLineDash([0.3, 0.7]);
  ctx.beginPath();
  ctx.moveTo(1, 1);
  ctx.lineTo(WORLD_WIDTH - 1, WORLD_HEIGHT - 1);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = '#020617';
  for (const wall of TRACK_WALLS) {
    ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
  }

  for (let i = 0; i < CHECKPOINTS.length; i += 1) {
    const cp = CHECKPOINTS[i];
    const isFinish = i === CHECKPOINTS.length - 1;
    const innerR = cp.r * (isFinish ? 0.6 : 0.45);
    const outerR = cp.r;

    const g = ctx.createRadialGradient(
      cp.x,
      cp.y,
      innerR * 0.3,
      cp.x,
      cp.y,
      outerR,
    );
    if (isFinish) {
      g.addColorStop(0, 'rgba(248,250,252,0.95)');
      g.addColorStop(0.4, 'rgba(52,211,153,0.9)');
      g.addColorStop(1, 'rgba(22,163,74,0.05)');
    } else {
      g.addColorStop(0, 'rgba(129,140,248,0.85)');
      g.addColorStop(1, 'rgba(79,70,229,0)');
    }
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cp.x, cp.y, outerR, 0, Math.PI * 2);
    ctx.fill();
  }

  const sorted = [...marbles.values()].sort((a, b) => a.id.localeCompare(b.id));

  for (const marble of sorted) {
    if (marble.trail.length < 4) continue;
    ctx.save();
    ctx.globalAlpha = marble.isLocal ? 0.35 : 0.22;
    ctx.strokeStyle = marble.color;
    ctx.lineWidth = MARBLE_RADIUS * 0.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    const [first, ...rest] = marble.trail;
    ctx.moveTo(first.x, first.y);
    for (const p of rest) {
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.restore();
  }

  for (const marble of sorted) {
    ctx.save();
    ctx.translate(marble.x, marble.y);

    ctx.beginPath();
    ctx.arc(0, 0, MARBLE_RADIUS, 0, Math.PI * 2);
    const fillGrad = ctx.createRadialGradient(
      -MARBLE_RADIUS * 0.4,
      -MARBLE_RADIUS * 0.6,
      MARBLE_RADIUS * 0.1,
      0,
      0,
      MARBLE_RADIUS,
    );
    fillGrad.addColorStop(0, '#f9fafb');
    fillGrad.addColorStop(0.3, marble.color);
    fillGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = fillGrad;
    ctx.fill();

    ctx.lineWidth = 0.03;
    ctx.strokeStyle = 'rgba(15,23,42,0.85)';
    ctx.stroke();

    if (marble.isLocal) {
      ctx.beginPath();
      ctx.arc(0, 0, MARBLE_RADIUS * 1.4, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(56,189,248,0.9)';
      ctx.lineWidth = 0.05;
      ctx.stroke();
    }

    ctx.restore();
  }

  ctx.restore();
}

function updateHud(): void {
  const playersSpan = document.getElementById('marble-race-hud-players');
  const statusSpan = document.getElementById('marble-race-hud-status');
  if (!playersSpan || !statusSpan) return;

  const total = marbles.size;
  const finished = [...marbles.values()].filter((m) => m.finished).length;
  playersSpan.textContent = `${finished}/${total} finished`;

  const local = localId ? marbles.get(localId) : null;
  if (!local) {
    statusSpan.textContent = '';
    return;
  }

  const cpIndex = local.checkpoint;
  if (local.finished) {
    statusSpan.textContent = 'You reached the finish!';
  } else if (cpIndex >= CHECKPOINTS.length - 1) {
    statusSpan.textContent = 'Final stretch — roll into the glowing circle!';
  } else if (cpIndex === 0) {
    statusSpan.textContent = 'Follow the glowing rings to climb the track.';
  } else {
    statusSpan.textContent = `Checkpoint ${cpIndex}/${CHECKPOINTS.length - 1}`;
  }
}

function updateStandings(): void {
  const list = document.getElementById('marble-race-standings');
  if (!list) return;

  const items = [...marbles.values()].map((m) => {
    const progress = m.checkpoint;
    const distToNext =
      m.checkpoint >= CHECKPOINTS.length
        ? 0
        : distanceToCheckpoint(m, CHECKPOINTS[m.checkpoint]);
    const finished = m.finished;
    return { marble: m, progress, distToNext, finished };
  });

  items.sort((a, b) => {
    if (a.finished && b.finished) {
      return a.marble.time - b.marble.time;
    }
    if (a.finished) return -1;
    if (b.finished) return 1;
    if (a.progress !== b.progress) {
      return b.progress - a.progress;
    }
    return a.distToNext - b.distToNext;
  });

  list.innerHTML = '';
  items.forEach((item, index) => {
    const li = document.createElement('li');
    const playerSpan = document.createElement('span');
    playerSpan.className = 'marble-race-player';
    const dot = document.createElement('span');
    dot.className = 'marble-race-dot';
    dot.style.background = item.marble.color;
    const label = document.createElement('span');
    label.textContent =
      item.marble.id === localId
        ? 'You'
        : item.marble.id.slice(0, 6).toUpperCase();
    playerSpan.appendChild(dot);
    playerSpan.appendChild(label);

    const status = document.createElement('span');
    if (item.finished) {
      if (index === 0) {
        status.textContent = 'Finished · 1st';
      } else if (index === 1) {
        status.textContent = 'Finished · 2nd';
      } else if (index === 2) {
        status.textContent = 'Finished · 3rd';
      } else {
        status.textContent = 'Finished';
      }
    } else if (item.progress === 0) {
      status.textContent = 'Racing…';
    } else {
      status.textContent = `Checkpoint ${item.progress}`;
    }

    li.appendChild(playerSpan);
    li.appendChild(status);
    list.appendChild(li);
  });
}

function distanceToCheckpoint(m: Marble, cp: Checkpoint): number {
  const dx = m.x - cp.x;
  const dy = m.y - cp.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function handleResize(): void {
  if (!canvasEl) return;
  const parent = canvasEl.parentElement;
  if (!parent) return;

  const rect = parent.getBoundingClientRect();
  const width = rect.width;
  const height = (width * WORLD_HEIGHT) / WORLD_WIDTH;
  canvasEl.style.width = `${width}px`;
  canvasEl.style.height = `${height}px`;
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

const marbleRaceGame: Game = {
  canPlay,
  start,
  stop,
};

if (!window.games) {
  window.games = {};
}

window.games.marbleRace = marbleRaceGame;

export {};

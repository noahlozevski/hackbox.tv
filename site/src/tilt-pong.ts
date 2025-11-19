import type {
  Game,
  MessageCallback,
  PlayersChangedCallback,
  PlayerInfo,
} from './types.js';
import { getPlayerIds } from './player-utils.js';
import { defaultHandlePlayersChanged } from './client.js';

type Edge = 'top' | 'right' | 'bottom' | 'left';

interface PaddleNetState {
  edge: Edge;
  pos: number; // 0..1 along that edge
}

interface NetGameState {
  ballX: number;
  ballY: number;
  vx: number;
  vy: number;
  paddles: Record<string, PaddleNetState>;
  scores: Record<string, number>;
  lastMissId?: string;
}

interface PaddleRuntimeState extends PaddleNetState {
  id: string;
}

const STATE_EVENT = 'tilt-pong-state';
const INPUT_EVENT = 'tilt-pong-input';

const EDGE_ORDER: Edge[] = ['bottom', 'right', 'top', 'left'];

const WORLD_SIZE = 1;
const BALL_RADIUS = 0.03;
const BASE_BALL_SPEED = 0.55;
const PADDLE_LENGTH = 0.3;
const PADDLE_THICKNESS = 0.04;

let backdropEl: HTMLDivElement | null = null;
let canvasEl: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let styleEl: HTMLStyleElement | null = null;

let animationId: number | null = null;
let lastTimestamp: number | null = null;

let localPlayerId: string | null = null;
let hostPlayerId: string | null = null;

let paddles: Map<string, PaddleRuntimeState> = new Map();
let scores: Map<string, number> = new Map();

let ballX = 0.5;
let ballY = 0.5;
let ballVX = BASE_BALL_SPEED;
let ballVY = -BASE_BALL_SPEED * 0.7;
let lastMissId: string | null = null;

let localControl = 0; // -1..1, mapped to paddle pos
let lastSentInputPos = 0.5;

let motionHandler: ((e: DeviceMotionEvent) => void) | null = null;
let pointerId: number | null = null;

let prevOnMessage: MessageCallback | null = null;
let prevOnPlayersChanged: PlayersChangedCallback | null = null;
let unsubscribeMessages: (() => void) | null = null;
let stateSendTimer: number | null = null;
let inputSendTimer: number | null = null;

let resizeHandler: (() => void) | null = null;

function isHost(): boolean {
  return localPlayerId != null && hostPlayerId === localPlayerId;
}

function canPlay(): boolean {
  const count = window.game.players.length;
  return count >= 2 && count <= 4;
}

function start(): void {
  if (!canPlay()) {
    alert('Tilt Pong needs 2–4 players in the room.');
    return;
  }

  if (backdropEl) {
    stop();
  }

  localPlayerId = window.game.state.playerId;
  if (!localPlayerId) {
    alert('Join a room before starting Tilt Pong.');
    return;
  }

  const ids = getPlayerIds(window.game.players);
  hostPlayerId = ids[0] ?? null;

  installStyles();
  createUI();
  initializePlayers(ids);
  setupInput();
  setupNetworking();

  resetBallTowardsRandomPlayer();

  lastTimestamp = null;
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

  paddles = new Map();
  scores = new Map();
  localPlayerId = null;
  hostPlayerId = null;
  lastTimestamp = null;
  lastMissId = null;
}

function installStyles(): void {
  const css = `
    .tilt-pong-backdrop {
      position: fixed;
      inset: 0;
      background: radial-gradient(circle at top, rgba(15,23,42,0.98), rgba(15,23,42,0.96));
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      padding: 14px;
    }
    .tilt-pong-frame {
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
    .tilt-pong-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
    }
    .tilt-pong-title {
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      font-size: 0.95rem;
      color: #a5b4fc;
    }
    .tilt-pong-subtitle {
      font-size: 0.8rem;
      opacity: 0.8;
    }
    .tilt-pong-button {
      border: none;
      border-radius: 999px;
      padding: 7px 12px;
      font-size: 0.8rem;
      cursor: pointer;
      background: #ef4444;
      color: #fee2e2;
      white-space: nowrap;
    }
    .tilt-pong-button:hover {
      background: #b91c1c;
    }
    .tilt-pong-main {
      display: grid;
      grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
      gap: 10px;
    }
    .tilt-pong-canvas-wrap {
      position: relative;
      background: radial-gradient(circle at 50% -20%, #020617, #020617 70%);
      border-radius: 12px;
      overflow: hidden;
      box-shadow: inset 0 0 0 1px rgba(148,163,184,0.3);
    }
    #tilt-pong-canvas {
      width: 100%;
      display: block;
      touch-action: none;
    }
    .tilt-pong-hud {
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
    .tilt-pong-hud span {
      background: rgba(15,23,42,0.8);
      padding: 4px 8px;
      border-radius: 999px;
      backdrop-filter: blur(6px);
    }
    .tilt-pong-side {
      display: flex;
      flex-direction: column;
      gap: 8px;
      font-size: 0.8rem;
    }
    .tilt-pong-instructions {
      background: rgba(15,23,42,0.9);
      border-radius: 10px;
      padding: 8px 10px;
      border: 1px solid rgba(148,163,184,0.35);
      line-height: 1.45;
    }
    .tilt-pong-scoreboard {
      background: rgba(15,23,42,0.9);
      border-radius: 10px;
      padding: 8px 10px;
      border: 1px solid rgba(148,163,184,0.35);
      max-height: 190px;
      overflow: auto;
    }
    .tilt-pong-scoreboard h3 {
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-bottom: 6px;
      color: #9ca3af;
    }
    .tilt-pong-scoreboard ul {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .tilt-pong-scoreboard li {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 3px 0;
    }
    .tilt-pong-player {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .tilt-pong-dot {
      width: 10px;
      height: 10px;
      border-radius: 999px;
      margin-right: 6px;
      flex-shrink: 0;
    }
    .tilt-pong-slider {
      margin-top: 4px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .tilt-pong-slider-bar {
      position: relative;
      height: 32px;
      border-radius: 999px;
      border: 1px solid rgba(148,163,184,0.6);
      background: radial-gradient(circle at 50% 50%, #1f2937, #020617);
      touch-action: none;
      overflow: hidden;
    }
    .tilt-pong-slider-thumb {
      position: absolute;
      width: 32px;
      height: 32px;
      border-radius: 999px;
      background: #38bdf8;
      box-shadow: 0 4px 12px rgba(56,189,248,0.6);
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
    }
    .tilt-pong-slider-text strong {
      display: block;
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #9ca3af;
      margin-bottom: 2px;
    }
    @media (max-width: 768px) {
      .tilt-pong-frame {
        padding: 10px;
      }
      .tilt-pong-main {
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
  backdrop.className = 'tilt-pong-backdrop';

  const frame = document.createElement('div');
  frame.className = 'tilt-pong-frame';
  frame.innerHTML = `
    <div class="tilt-pong-header">
      <div>
        <div class="tilt-pong-title">Tilt Pong</div>
        <div class="tilt-pong-subtitle">Tilt to slide your paddle along your wall. Miss the ball and you concede a point.</div>
      </div>
      <button class="tilt-pong-button" data-tilt-pong-exit>Return to chat</button>
    </div>
    <div class="tilt-pong-main">
      <div class="tilt-pong-canvas-wrap">
        <canvas id="tilt-pong-canvas"></canvas>
        <div class="tilt-pong-hud">
          <span id="tilt-pong-hud-role"></span>
          <span id="tilt-pong-hud-status"></span>
        </div>
      </div>
      <div class="tilt-pong-side">
        <div class="tilt-pong-instructions">
          Tilt your phone gently left and right to slide your paddle along your wall. The ball bounces between players; if it slips past your side, everyone sees you concede a point. On desktop or devices without motion sensors, drag the blue slider to move instead.
        </div>
        <div class="tilt-pong-scoreboard">
          <h3>Scoreboard</h3>
          <ul id="tilt-pong-score-list"></ul>
        </div>
        <div class="tilt-pong-slider" aria-label="Fallback touch controls">
          <div class="tilt-pong-slider-bar" id="tilt-pong-slider">
            <div class="tilt-pong-slider-thumb" id="tilt-pong-thumb"></div>
          </div>
          <div class="tilt-pong-slider-text">
            <strong>Tilt or drag to move</strong>
            <span id="tilt-pong-input-note">Waiting for motion data… you can always drag the slider.</span>
          </div>
        </div>
      </div>
    </div>
  `;

  backdrop.appendChild(frame);
  document.body.appendChild(backdrop);
  backdropEl = backdrop;

  const canvas = frame.querySelector<HTMLCanvasElement>('#tilt-pong-canvas');
  canvasEl = canvas ?? null;
  if (canvasEl) {
    const context = canvasEl.getContext('2d');
    if (context) {
      ctx = context;
    }
  }

  const exitButtons = frame.querySelectorAll<HTMLButtonElement>(
    '[data-tilt-pong-exit]',
  );
  exitButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      stop();
    });
  });

  handleResize();
  resizeHandler = handleResize;
  window.addEventListener('resize', handleResize, { passive: true });
}

function initializePlayers(sortedIds: string[]): void {
  paddles = new Map();
  scores = new Map();

  sortedIds.forEach((id, index) => {
    const edge = EDGE_ORDER[index % EDGE_ORDER.length];
    const paddle: PaddleRuntimeState = {
      id,
      edge,
      pos: 0.5,
    };
    paddles.set(id, paddle);
    scores.set(id, 0);
  });

  updateHud();
  updateScoreboard();
}

function setupInput(): void {
  const inputNote = document.getElementById('tilt-pong-input-note');
  const slider = document.getElementById(
    'tilt-pong-slider',
  ) as HTMLDivElement | null;

  if ('DeviceMotionEvent' in window) {
    motionHandler = (event: DeviceMotionEvent) => {
      const acc = event.accelerationIncludingGravity;
      if (!acc) return;

      // Map horizontal tilt to control range
      const raw = acc.x != null ? -acc.x : 0;
      const normalized = clamp(raw / 6, -1, 1);
      localControl = normalized;

      if (inputNote) {
        inputNote.textContent =
          'Motion enabled. Keep the phone upright and tilt gently.';
      }
    };
    window.addEventListener('devicemotion', motionHandler, { passive: true });
  }

  if (slider) {
    const thumb = document.getElementById(
      'tilt-pong-thumb',
    ) as HTMLDivElement | null;

    const rect = () => slider.getBoundingClientRect();

    const updateFromPointer = (clientX: number) => {
      const r = rect();
      if (r.width <= 0) return;
      let t = (clientX - r.left) / r.width;
      t = clamp(t, 0, 1);
      localControl = t * 2 - 1;
      if (thumb) {
        thumb.style.transform = `translate(${t * 100 - 50}%, -50%)`;
      }
      if (inputNote && !('DeviceMotionEvent' in window)) {
        inputNote.textContent = 'Using touch slider for control.';
      }
    };

    const end = (ev: PointerEvent) => {
      if (pointerId === null || ev.pointerId !== pointerId) return;
      slider.releasePointerCapture(ev.pointerId);
      pointerId = null;
    };

    slider.addEventListener('pointerdown', (ev) => {
      if (pointerId !== null && ev.pointerId !== pointerId) return;
      pointerId = ev.pointerId;
      slider.setPointerCapture(ev.pointerId);
      updateFromPointer(ev.clientX);
    });

    slider.addEventListener('pointermove', (ev) => {
      if (pointerId === null || ev.pointerId !== pointerId) return;
      updateFromPointer(ev.clientX);
    });

    slider.addEventListener('pointerup', end);
    slider.addEventListener('pointercancel', end);
    slider.addEventListener('pointerleave', (ev) => {
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
  prevOnMessage = window.game.onMessage;
  prevOnPlayersChanged = window.game.handlePlayersChanged;

  unsubscribeMessages = window.game.subscribeToMessages(
    (playerId, event, payload) => {
      if (event === STATE_EVENT) {
        handleRemoteState(playerId, payload as NetGameState);
      } else if (event === INPUT_EVENT && isHost()) {
        handleRemoteInput(playerId, payload as PaddleNetState);
      }
    },
  );

  window.game.handlePlayersChanged = (playersList) => {
    handlePlayersChanged(playersList);
    if (prevOnPlayersChanged) {
      prevOnPlayersChanged(playersList);
    }
  };

  if (stateSendTimer !== null) {
    clearInterval(stateSendTimer);
  }
  if (inputSendTimer !== null) {
    clearInterval(inputSendTimer);
  }

  if (isHost()) {
    stateSendTimer = window.setInterval(() => {
      sendHostState();
    }, 1000 / 20);
  } else {
    stateSendTimer = null;
  }

  inputSendTimer = window.setInterval(() => {
    sendLocalInput();
  }, 1000 / 20);
}

function teardownNetworking(): void {
  if (unsubscribeMessages) {
    unsubscribeMessages();
    unsubscribeMessages = null;
  }

  if (prevOnMessage) {
    window.game.onMessage = prevOnMessage;
  } else {
    window.game.onMessage = null;
  }

  window.game.handlePlayersChanged =
    prevOnPlayersChanged ?? defaultHandlePlayersChanged;

  prevOnMessage = null;
  prevOnPlayersChanged = null;

  if (stateSendTimer !== null) {
    clearInterval(stateSendTimer);
    stateSendTimer = null;
  }

  if (inputSendTimer !== null) {
    clearInterval(inputSendTimer);
    inputSendTimer = null;
  }
}

function handlePlayersChanged(playersList: PlayerInfo[]): void {
  const ids = getPlayerIds(playersList);
  initializePlayers(ids);

  // Ensure host stays deterministic if players join/leave
  hostPlayerId = ids[0] ?? null;
}

function handleRemoteInput(playerId: string, net: PaddleNetState): void {
  if (!isHost()) return;
  const paddle = paddles.get(playerId);
  if (!paddle) return;
  paddle.pos = clamp(net.pos, 0.1, 0.9);
}

function handleRemoteState(senderId: string, net: NetGameState): void {
  if (!hostPlayerId || senderId !== hostPlayerId || isHost()) return;

  ballX = net.ballX;
  ballY = net.ballY;
  ballVX = net.vx;
  ballVY = net.vy;
  lastMissId = net.lastMissId ?? null;

  paddles = new Map();
  Object.entries(net.paddles).forEach(([id, paddle]) => {
    paddles.set(id, {
      id,
      edge: paddle.edge,
      pos: clamp(paddle.pos, 0.1, 0.9),
    });
  });

  scores = new Map();
  Object.entries(net.scores).forEach(([id, value]) => {
    scores.set(id, value);
  });

  updateHud();
  updateScoreboard();
}

function sendHostState(): void {
  if (!isHost()) return;

  const paddlesPayload: Record<string, PaddleNetState> = {};
  for (const [id, paddle] of paddles.entries()) {
    paddlesPayload[id] = { edge: paddle.edge, pos: paddle.pos };
  }

  const scoresPayload: Record<string, number> = {};
  for (const [id, score] of scores.entries()) {
    scoresPayload[id] = score;
  }

  const net: NetGameState = {
    ballX,
    ballY,
    vx: ballVX,
    vy: ballVY,
    paddles: paddlesPayload,
    scores: scoresPayload,
    lastMissId: lastMissId ?? undefined,
  };

  window.game.sendMessage(STATE_EVENT, net);
}

function sendLocalInput(): void {
  if (!localPlayerId) return;
  const paddle = paddles.get(localPlayerId);
  if (!paddle) return;

  // Update local paddle from control
  const nextPos = clamp(0.5 + localControl * 0.4, 0.1, 0.9);
  paddle.pos = nextPos;

  if (!isHost()) {
    if (Math.abs(nextPos - lastSentInputPos) < 0.005) {
      return;
    }
    lastSentInputPos = nextPos;

    const net: PaddleNetState = {
      edge: paddle.edge,
      pos: nextPos,
    };
    window.game.sendMessage(INPUT_EVENT, net);
  }
}

function loop(timestamp: number): void {
  if (!canvasEl || !ctx) return;

  if (lastTimestamp == null) {
    lastTimestamp = timestamp;
  }

  const dt = Math.min((timestamp - lastTimestamp) / 1000, 0.05);
  lastTimestamp = timestamp;

  if (isHost()) {
    updatePhysics(dt);
  } else if (localPlayerId) {
    // Non-host still locally updates paddle position from control for responsiveness
    const paddle = paddles.get(localPlayerId);
    if (paddle) {
      paddle.pos = clamp(0.5 + localControl * 0.4, 0.1, 0.9);
    }
  }

  render();

  animationId = requestAnimationFrame(loop);
}

function updatePhysics(dt: number): void {
  // Apply control to local paddle every frame for host
  if (localPlayerId) {
    const localPaddle = paddles.get(localPlayerId);
    if (localPaddle) {
      localPaddle.pos = clamp(0.5 + localControl * 0.4, 0.1, 0.9);
    }
  }

  ballX += ballVX * dt;
  ballY += ballVY * dt;

  // Handle collisions with each edge
  handleEdgeCollision('left');
  handleEdgeCollision('right');
  handleEdgeCollision('top');
  handleEdgeCollision('bottom');
}

function handleEdgeCollision(edge: Edge): void {
  const paddleEntry = [...paddles.values()].find((p) => p.edge === edge);
  const hasPlayer = !!paddleEntry;

  if (edge === 'left') {
    if (ballX - BALL_RADIUS <= 0) {
      if (hasPlayer && isHitOnPaddle(paddleEntry!, ballY)) {
        ballX = BALL_RADIUS;
        ballVX = Math.abs(ballVX) || BASE_BALL_SPEED;
        tweakBounce(paddleEntry!, 'vertical');
      } else if (hasPlayer) {
        registerMiss(paddleEntry!.id);
      } else {
        ballX = BALL_RADIUS;
        ballVX = Math.abs(ballVX) || BASE_BALL_SPEED;
      }
    }
  } else if (edge === 'right') {
    if (ballX + BALL_RADIUS >= WORLD_SIZE) {
      if (hasPlayer && isHitOnPaddle(paddleEntry!, ballY)) {
        ballX = WORLD_SIZE - BALL_RADIUS;
        ballVX = -Math.abs(ballVX) || -BASE_BALL_SPEED;
        tweakBounce(paddleEntry!, 'vertical');
      } else if (hasPlayer) {
        registerMiss(paddleEntry!.id);
      } else {
        ballX = WORLD_SIZE - BALL_RADIUS;
        ballVX = -Math.abs(ballVX) || -BASE_BALL_SPEED;
      }
    }
  } else if (edge === 'top') {
    if (ballY - BALL_RADIUS <= 0) {
      if (hasPlayer && isHitOnPaddle(paddleEntry!, ballX)) {
        ballY = BALL_RADIUS;
        ballVY = Math.abs(ballVY) || BASE_BALL_SPEED;
        tweakBounce(paddleEntry!, 'horizontal');
      } else if (hasPlayer) {
        registerMiss(paddleEntry!.id);
      } else {
        ballY = BALL_RADIUS;
        ballVY = Math.abs(ballVY) || BASE_BALL_SPEED;
      }
    }
  } else if (edge === 'bottom') {
    if (ballY + BALL_RADIUS >= WORLD_SIZE) {
      if (hasPlayer && isHitOnPaddle(paddleEntry!, ballX)) {
        ballY = WORLD_SIZE - BALL_RADIUS;
        ballVY = -Math.abs(ballVY) || -BASE_BALL_SPEED;
        tweakBounce(paddleEntry!, 'horizontal');
      } else if (hasPlayer) {
        registerMiss(paddleEntry!.id);
      } else {
        ballY = WORLD_SIZE - BALL_RADIUS;
        ballVY = -Math.abs(ballVY) || -BASE_BALL_SPEED;
      }
    }
  }
}

function isHitOnPaddle(
  paddle: PaddleRuntimeState,
  coordAlongEdge: number,
): boolean {
  const halfLen = PADDLE_LENGTH / 2;
  const min = paddle.pos - halfLen;
  const max = paddle.pos + halfLen;
  return coordAlongEdge >= min && coordAlongEdge <= max;
}

function tweakBounce(
  paddle: PaddleRuntimeState,
  axis: 'horizontal' | 'vertical',
): void {
  const offset = paddle.pos - 0.5;
  if (axis === 'horizontal') {
    ballVX += offset * 0.4;
  } else {
    ballVY += offset * 0.4;
  }

  const speed = Math.sqrt(ballVX * ballVX + ballVY * ballVY);
  const target = BASE_BALL_SPEED * 1.1;
  if (speed < target) {
    const scale = target / (speed || target);
    ballVX *= scale;
    ballVY *= scale;
  }
}

function registerMiss(playerId: string): void {
  const current = scores.get(playerId) ?? 0;
  scores.set(playerId, current + 1);
  lastMissId = playerId;
  updateHud();
  updateScoreboard();
  resetBallTowardsRandomPlayer(playerId);
}

function resetBallTowardsRandomPlayer(missedById?: string): void {
  ballX = 0.5;
  ballY = 0.5;

  const ids = [...paddles.keys()];
  const candidates = missedById ? ids.filter((id) => id !== missedById) : ids;
  const targetId =
    candidates.length > 0
      ? candidates[Math.floor(Math.random() * candidates.length)]
      : ids[Math.floor(Math.random() * ids.length)];

  const target = targetId ? paddles.get(targetId ?? '') : null;
  let angle = Math.random() * Math.PI * 2;

  if (target) {
    if (target.edge === 'top') {
      angle = Math.random() * Math.PI + Math.PI; // heading down
    } else if (target.edge === 'bottom') {
      angle = Math.random() * Math.PI; // heading up
    } else if (target.edge === 'left') {
      angle = Math.random() * Math.PI * 0.5 - Math.PI / 4; // right-ish
    } else if (target.edge === 'right') {
      angle = Math.random() * Math.PI * 0.5 + (Math.PI * 3) / 4; // left-ish
    }
  }

  const speed = BASE_BALL_SPEED * 1.1;
  ballVX = Math.cos(angle) * speed;
  ballVY = Math.sin(angle) * speed;
}

function render(): void {
  if (!canvasEl || !ctx) return;

  const rect = canvasEl.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;

  ctx.clearRect(0, 0, width, height);

  const inset = 16;
  const arenaWidth = width - inset * 2;
  const arenaHeight = height - inset * 2;
  const size = Math.min(arenaWidth, arenaHeight);
  const offsetX = (width - size) / 2;
  const offsetY = (height - size) / 2;

  ctx.save();
  ctx.translate(offsetX, offsetY);

  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size * 0.7,
  );
  grad.addColorStop(0, '#020617');
  grad.addColorStop(1, '#000000');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, size, size);

  // Draw paddles
  for (const paddle of paddles.values()) {
    drawPaddle(paddle, size);
  }

  // Draw ball
  const ballPx = ballX * size;
  const ballPy = ballY * size;
  const r = BALL_RADIUS * size;

  ctx.beginPath();
  ctx.arc(ballPx, ballPy, r, 0, Math.PI * 2);
  const ballGrad = ctx.createRadialGradient(
    ballPx - r * 0.4,
    ballPy - r * 0.4,
    r * 0.3,
    ballPx,
    ballPy,
    r,
  );
  ballGrad.addColorStop(0, '#fbbf24');
  ballGrad.addColorStop(1, '#f97316');
  ctx.fillStyle = ballGrad;
  ctx.fill();

  if (lastMissId) {
    ctx.font = '12px system-ui';
    ctx.fillStyle = 'rgba(248, 250, 252, 0.75)';
    ctx.textAlign = 'center';
    ctx.fillText(`${shortId(lastMissId)} missed`, size / 2, 18);
  }

  ctx.restore();
}

function drawPaddle(paddle: PaddleRuntimeState, size: number): void {
  if (!ctx) return;

  const lengthPx = PADDLE_LENGTH * size;
  const thicknessPx = PADDLE_THICKNESS * size;

  ctx.save();

  const isLocal = paddle.id === localPlayerId;
  const baseColor = isLocal ? '#22c55e' : '#38bdf8';

  if (paddle.edge === 'bottom') {
    const x = paddle.pos * size;
    const y = size;
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.roundRect(-lengthPx / 2, -thicknessPx, lengthPx, thicknessPx, 6);
  } else if (paddle.edge === 'top') {
    const x = paddle.pos * size;
    const y = 0;
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.roundRect(-lengthPx / 2, 0, lengthPx, thicknessPx, 6);
  } else if (paddle.edge === 'left') {
    const x = 0;
    const y = paddle.pos * size;
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.roundRect(0, -lengthPx / 2, thicknessPx, lengthPx, 6);
  } else {
    const x = size;
    const y = paddle.pos * size;
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.roundRect(-thicknessPx, -lengthPx / 2, thicknessPx, lengthPx, 6);
  }

  ctx.fillStyle = baseColor;
  ctx.fill();

  if (isLocal) {
    ctx.strokeStyle = 'rgba(34,197,94,0.9)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  ctx.restore();
}

function updateHud(): void {
  const roleSpan = document.getElementById('tilt-pong-hud-role');
  const statusSpan = document.getElementById('tilt-pong-hud-status');
  if (!roleSpan || !statusSpan) return;

  const totalPlayers = paddles.size;
  statusSpan.textContent = `${totalPlayers} player${totalPlayers === 1 ? '' : 's'} in game`;

  if (!localPlayerId) {
    roleSpan.textContent = '';
    return;
  }

  const paddle = paddles.get(localPlayerId);
  const isHostPlayer = isHost();

  const edgeLabel = paddle ? edgeToLabel(paddle.edge) : '';
  roleSpan.textContent = `${edgeLabel}${isHostPlayer ? ' · Host' : ''}`;
}

function updateScoreboard(): void {
  const list = document.getElementById('tilt-pong-score-list');
  if (!list) return;

  const items = [...scores.entries()].sort((a, b) => a[1] - b[1]);

  list.innerHTML = '';
  for (const [id, misses] of items) {
    const li = document.createElement('li');

    const playerSpan = document.createElement('span');
    playerSpan.className = 'tilt-pong-player';

    const dot = document.createElement('span');
    dot.className = 'tilt-pong-dot';
    dot.style.background = id === localPlayerId ? '#22c55e' : '#38bdf8';

    const label = document.createElement('span');
    label.textContent = id === localPlayerId ? 'You' : shortId(id);

    playerSpan.appendChild(dot);
    playerSpan.appendChild(label);

    const stat = document.createElement('span');
    stat.textContent = `${misses} miss${misses === 1 ? '' : 'es'}`;

    li.appendChild(playerSpan);
    li.appendChild(stat);
    list.appendChild(li);
  }
}

function edgeToLabel(edge: Edge): string {
  if (edge === 'top') return 'Top wall';
  if (edge === 'bottom') return 'Bottom wall';
  if (edge === 'left') return 'Left wall';
  return 'Right wall';
}

function handleResize(): void {
  if (!canvasEl || !ctx) return;
  const parent = canvasEl.parentElement;
  if (!parent) return;

  const rect = parent.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  const dpr = window.devicePixelRatio || 1;

  canvasEl.width = Math.max(1, Math.floor(width * dpr));
  canvasEl.height = Math.max(1, Math.floor(height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

function shortId(id: string): string {
  if (id.length <= 6) return id;
  return id.slice(0, 6).toUpperCase();
}

const tiltPongGame: Game = {
  canPlay,
  start,
  stop,
};

if (!window.games) {
  window.games = {};
}

window.games.tiltPong = tiltPongGame;

export {};

import type { Game } from './types.js';
import {
  getFirstPlayerId,
  getPlayerIndex,
  getNextPlayerId,
} from './player-utils.js';

type Cell = string | null;

interface ConnectFourState {
  playerId: string | null;
  board: Cell[][];
  currentTurn: string;
  winner: string | null;
  gameOver: boolean;
  isResetting: boolean;
}

const ROWS = 6;
const COLS = 7;

let state: ConnectFourState | null = null;
let overlay: HTMLDivElement | null = null;
let boardContainer: HTMLDivElement | null = null;
let statusLine: HTMLParagraphElement | null = null;
let unsubscribe: (() => void) | null = null;
let restartTimer: number | null = null;

function canPlay(): boolean {
  return window.game.players.length === 2;
}

function start(): void {
  if (!canPlay()) {
    alert('Need exactly 2 players to play Connect Four.');
    return;
  }

  initializeState();
  renderUI();

  unsubscribe = window.game.subscribeToMessages(handleMessage);
  updateStatus();
}

function initializeState(): void {
  const playerId = window.game.state.playerId;

  state = {
    playerId,
    board: Array.from({ length: ROWS }, () => Array<Cell>(COLS).fill(null)),
    currentTurn: getFirstPlayerId(window.game.players) || playerId,
    winner: null,
    gameOver: false,
    isResetting: false,
  };
}

function renderUI(): void {
  cleanupOverlay();

  overlay = document.createElement('div');
  overlay.id = 'connect-four-overlay';
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.backgroundColor = 'rgba(0,0,0,0.6)';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.padding = '16px';
  overlay.style.zIndex = '9999';

  const card = document.createElement('div');
  card.style.backgroundColor = '#111827';
  card.style.color = '#e5e7eb';
  card.style.borderRadius = '12px';
  card.style.boxShadow = '0 10px 50px rgba(0,0,0,0.5)';
  card.style.padding = '18px';
  card.style.width = 'min(520px, 96vw)';
  card.style.maxHeight = '90vh';
  card.style.overflow = 'auto';
  card.style.boxSizing = 'border-box';
  card.style.fontFamily = 'Arial, sans-serif';

  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'center';

  const title = document.createElement('h2');
  title.textContent = 'Connect Four';
  title.style.margin = '0';

  const close = document.createElement('button');
  close.textContent = 'Close';
  close.style.backgroundColor = '#ef4444';
  close.style.border = 'none';
  close.style.color = '#fff';
  close.style.padding = '8px 12px';
  close.style.borderRadius = '6px';
  close.style.cursor = 'pointer';
  close.addEventListener('click', stop);

  header.appendChild(title);
  header.appendChild(close);
  card.appendChild(header);

  statusLine = document.createElement('p');
  statusLine.style.margin = '12px 0';
  statusLine.style.fontSize = '16px';
  card.appendChild(statusLine);

  boardContainer = document.createElement('div');
  boardContainer.style.display = 'grid';
  boardContainer.style.gridTemplateColumns = `repeat(${COLS}, 1fr)`;
  boardContainer.style.gap = '8px';
  boardContainer.style.backgroundColor = '#1f2937';
  boardContainer.style.padding = '10px';
  boardContainer.style.borderRadius = '10px';
  boardContainer.style.boxShadow = 'inset 0 0 0 1px rgba(255,255,255,0.05)';
  boardContainer.style.touchAction = 'manipulation';
  card.appendChild(boardContainer);

  renderBoard();

  overlay.appendChild(card);
  document.body.appendChild(overlay);
}

function renderBoard(): void {
  if (!boardContainer || !state) return;

  boardContainer.innerHTML = '';

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const cell = document.createElement('div');
      cell.style.aspectRatio = '1 / 1';
      cell.style.borderRadius = '50%';
      cell.style.backgroundColor = '#374151';
      cell.style.display = 'flex';
      cell.style.alignItems = 'center';
      cell.style.justifyContent = 'center';
      cell.style.cursor = 'pointer';
      cell.style.touchAction = 'manipulation';
      cell.dataset.col = String(col);
      cell.addEventListener('click', () => handleColumnClick(col));

      const value = state.board[row][col];
      if (value) {
        const playerIndex = getPlayerIndex(window.game.players, value);
        cell.style.backgroundColor = playerIndex === 0 ? '#f87171' : '#fbbf24';
        cell.style.cursor = 'default';
      }

      boardContainer.appendChild(cell);
    }
  }
}

function handleColumnClick(col: number): void {
  if (!state || state.gameOver) return;
  if (state.currentTurn !== state.playerId) return;

  const row = findDropRow(col);
  if (row === -1) return;

  makeMove(state.playerId!, col, row);
  window.game.sendMessage('move', { col, row });
}

function findDropRow(col: number): number {
  if (!state) return -1;
  for (let row = ROWS - 1; row >= 0; row--) {
    if (state.board[row][col] === null) {
      return row;
    }
  }
  return -1;
}

function handleMessage(
  playerId: string,
  event: string,
  payload: unknown,
): void {
  if (event === 'move') {
    const data = payload as { col: number; row: number };
    makeMove(playerId, data.col, data.row);
  } else if (event === 'restart') {
    resetBoard();
  }
}

function makeMove(playerId: string, col: number, row: number): void {
  if (!state) return;
  if (state.board[row][col]) return;

  state.board[row][col] = playerId;
  renderBoard();

  if (checkWin(row, col, playerId)) {
    state.winner = playerId;
    state.gameOver = true;
    updateStatus();
    scheduleRestart();
    return;
  }

  if (isBoardFull()) {
    state.gameOver = true;
    updateStatus();
    scheduleRestart();
    return;
  }

  state.currentTurn =
    getNextPlayerId(window.game.players, state.currentTurn) || state.currentTurn;
  updateStatus();
}

function checkWin(row: number, col: number, playerId: string): boolean {
  const directions = [
    [
      [0, 1],
      [0, -1],
    ],
    [
      [1, 0],
      [-1, 0],
    ],
    [
      [1, 1],
      [-1, -1],
    ],
    [
      [1, -1],
      [-1, 1],
    ],
  ];

  return directions.some((dir) => {
    let count = 1;
    for (const [dx, dy] of dir) {
      let r = row + dx;
      let c = col + dy;
      while (
        r >= 0 &&
        r < ROWS &&
        c >= 0 &&
        c < COLS &&
        state?.board[r][c] === playerId
      ) {
        count++;
        r += dx;
        c += dy;
      }
    }
    return count >= 4;
  });
}

function isBoardFull(): boolean {
  return state?.board.every((r) => r.every((cell) => cell !== null)) ?? false;
}

function scheduleRestart(): void {
  if (!state || state.isResetting) return;

  state.isResetting = true;
  restartTimer = window.setTimeout(() => {
    if (state?.playerId === getFirstPlayerId(window.game.players)) {
      window.game.sendMessage('restart', {});
    }
    resetBoard();
  }, 3000);
}

function resetBoard(): void {
  if (!state) return;

  state.board = Array.from({ length: ROWS }, () =>
    Array<Cell>(COLS).fill(null),
  );
  state.currentTurn = getFirstPlayerId(window.game.players) || state.playerId;
  state.winner = null;
  state.gameOver = false;
  state.isResetting = false;

  renderBoard();
  updateStatus();
}

function updateStatus(): void {
  if (!statusLine || !state) return;

  if (state.winner) {
    const isLocal = state.winner === state.playerId;
    statusLine.textContent = isLocal
      ? 'You win! Restarting...'
      : 'Opponent wins. Restarting...';
    return;
  }

  if (state.gameOver) {
    statusLine.textContent = 'Draw. Restarting...';
    return;
  }

  const isOurTurn = state.currentTurn === state.playerId;
  const activeIndex = getPlayerIndex(window.game.players, state.currentTurn);
  const color = activeIndex === 0 ? 'Red' : 'Yellow';
  statusLine.textContent = isOurTurn
    ? `Your turn (${color})`
    : `Waiting for opponent (${color})`;
}

function stop(): void {
  if (restartTimer) {
    clearTimeout(restartTimer);
    restartTimer = null;
  }

  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }

  cleanupOverlay();
  state = null;
}

function cleanupOverlay(): void {
  if (overlay) {
    overlay.remove();
    overlay = null;
  }
}

const connectFourGame: Game = {
  canPlay,
  start,
  stop,
};

if (!window.games) {
  window.games = {};
}

window.games.connectFour = connectFourGame;

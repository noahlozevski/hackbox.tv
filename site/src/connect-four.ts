import type { Game } from './types.js';
import {
  getFirstPlayerId,
  getPlayerIndex,
  getNextPlayerId,
} from './player-utils.js';
import { showGameContainer, hideGameContainer } from './game-container.js';

type Cell = string | null;

interface ConnectFourState {
  playerId: string | null;
  board: Cell[][];
  currentTurn: string | null;
  winner: string | null;
  gameOver: boolean;
  isResetting: boolean;
}

interface SerializedConnectFourState {
  version: 1;
  board: (0 | 1 | null)[][];
  currentTurnIndex: 0 | 1 | null;
  winnerIndex: 0 | 1 | null;
  gameOver: boolean;
  isResetting: boolean;
}

const ROWS = 6;
const COLS = 7;

let state: ConnectFourState | null = null;
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
  syncGameStateWithServer();
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
  const content = showGameContainer('Connect Four', stop);

  const card = document.createElement('div');
  card.style.background =
    'radial-gradient(circle at top, #0f172a 0, #020617 65%)';
  card.style.color = '#e5e7eb';
  card.style.borderRadius = '14px';
  card.style.boxShadow =
    '0 18px 45px rgba(15,23,42,0.85), 0 0 0 1px rgba(148,163,184,0.25)';
  card.style.padding = '14px 16px 16px';
  card.style.width = 'min(520px, 96vw)';
  card.style.maxHeight = '90vh';
  card.style.overflow = 'auto';
  card.style.boxSizing = 'border-box';
  card.style.fontFamily =
    '-apple-system, BlinkMacSystemFont, system-ui, -system-ui, sans-serif';

  const headerRow = document.createElement('div');
  headerRow.style.display = 'flex';
  headerRow.style.justifyContent = 'space-between';
  headerRow.style.alignItems = 'baseline';
  headerRow.style.marginBottom = '6px';

  const title = document.createElement('h3');
  title.textContent = 'Connect Four';
  title.style.margin = '0';
  title.style.fontSize = '17px';
  title.style.letterSpacing = '0.04em';
  title.style.textTransform = 'uppercase';
  title.style.color = '#e5e7eb';

  const meta = document.createElement('span');
  meta.textContent = '2 players · quick match';
  meta.style.fontSize = '12px';
  meta.style.color = '#9ca3af';

  headerRow.appendChild(title);
  headerRow.appendChild(meta);
  card.appendChild(headerRow);

  const subtitle = document.createElement('p');
  subtitle.style.margin = '0 0 10px';
  subtitle.style.fontSize = '13px';
  subtitle.style.color = '#9ca3af';

  const ourIndex = getPlayerIndex(window.game.players, state?.playerId ?? null);
  const ourColor = ourIndex === 0 ? 'Red' : ourIndex === 1 ? 'Yellow' : null;

  subtitle.textContent = ourColor
    ? `First to connect four wins. You are ${ourColor}.`
    : 'First to connect four wins.';
  card.appendChild(subtitle);

  if (window.game.players.length >= 2) {
    const playersRow = document.createElement('div');
    playersRow.style.display = 'flex';
    playersRow.style.gap = '12px';
    playersRow.style.margin = '8px 0 10px';
    playersRow.style.fontSize = '13px';

    window.game.players.slice(0, 2).forEach((player, index) => {
      const chip = document.createElement('div');
      chip.style.display = 'flex';
      chip.style.alignItems = 'center';
      chip.style.gap = '6px';

      const dot = document.createElement('span');
      dot.style.display = 'inline-block';
      dot.style.width = '10px';
      dot.style.height = '10px';
      dot.style.borderRadius = '999px';
      dot.style.boxShadow = '0 0 0 1px rgba(15,23,42,0.9)';
      dot.style.backgroundColor = index === 0 ? '#f87171' : '#fbbf24';

      const label = document.createElement('span');
      const isUs = player.id === state?.playerId;
      label.textContent = `${index === 0 ? 'Red' : 'Yellow'} · ${
        player.name || 'Player'
      }${isUs ? ' (you)' : ''}`;

      chip.appendChild(dot);
      chip.appendChild(label);
      playersRow.appendChild(chip);
    });

    card.appendChild(playersRow);
  }

  statusLine = document.createElement('p');
  statusLine.style.margin = '0 0 12px';
  statusLine.style.fontSize = '14px';
  statusLine.style.fontWeight = '500';
  card.appendChild(statusLine);

  boardContainer = document.createElement('div');
  boardContainer.style.display = 'grid';
  boardContainer.style.gridTemplateColumns = `repeat(${COLS}, 1fr)`;
  boardContainer.style.gap = '8px';
  boardContainer.style.backgroundColor = '#1f2937';
  boardContainer.style.padding = '10px';
  boardContainer.style.borderRadius = '10px';
  boardContainer.style.boxShadow =
    '0 10px 30px rgba(15,23,42,0.85), inset 0 0 0 1px rgba(148,163,184,0.25)';
  boardContainer.style.touchAction = 'manipulation';
  card.appendChild(boardContainer);

  renderBoard();

  content.appendChild(card);
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
      cell.style.boxShadow = '0 0 0 1px rgba(15,23,42,0.9)';
      cell.style.display = 'flex';
      cell.style.alignItems = 'center';
      cell.style.justifyContent = 'center';
      cell.style.cursor = 'pointer';
      cell.style.touchAction = 'manipulation';
      cell.dataset.col = String(col);
      cell.addEventListener('click', () => handleColumnClick(col));

      cell.addEventListener('mouseenter', () => {
        if (cell.style.cursor === 'pointer') {
          cell.style.transform = 'translateY(-2px)';
          cell.style.boxShadow =
            '0 0 0 1px rgba(15,23,42,0.9), 0 8px 14px rgba(15,23,42,0.7)';
        }
      });

      cell.addEventListener('mouseleave', () => {
        cell.style.transform = 'translateY(0)';
        cell.style.boxShadow = '0 0 0 1px rgba(15,23,42,0.9)';
      });

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
    syncGameStateWithServer();
    scheduleRestart();
    return;
  }

  if (isBoardFull()) {
    state.gameOver = true;
    updateStatus();
    syncGameStateWithServer();
    scheduleRestart();
    return;
  }

  const nextPlayer = getNextPlayerId(
    window.game.players,
    state.currentTurn || state.playerId,
  );
  state.currentTurn = nextPlayer;
  updateStatus();
  syncGameStateWithServer();
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
  syncGameStateWithServer();
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
  hideGameContainer();
  boardContainer = null;
  statusLine = null;
}

function serializeState(): SerializedConnectFourState | null {
  if (!state) return null;

  const players = window.game.players;
  if (players.length < 2) return null;

  const board = state.board.map((row) =>
    row.map((cell) => {
      if (!cell) return null;
      const index = getPlayerIndex(players, cell);
      return index === 0 || index === 1 ? (index as 0 | 1) : null;
    }),
  );

  const currentIndex = getPlayerIndex(players, state.currentTurn);
  const winnerIndex = getPlayerIndex(players, state.winner);

  return {
    version: 1,
    board,
    currentTurnIndex:
      currentIndex === 0 || currentIndex === 1 ? (currentIndex as 0 | 1) : null,
    winnerIndex:
      winnerIndex === 0 || winnerIndex === 1 ? (winnerIndex as 0 | 1) : null,
    gameOver: state.gameOver,
    isResetting: state.isResetting,
  };
}

function applySerializedState(savedState: unknown): void {
  if (!state || !savedState) return;

  const data = savedState as SerializedConnectFourState;
  if (data.version !== 1 || !Array.isArray(data.board)) return;

  const players = window.game.players;
  if (players.length < 2) return;

  state.board = data.board.map((row) =>
    row.map((cellIndex) => {
      if (cellIndex === 0 || cellIndex === 1) {
        return players[cellIndex]?.id ?? null;
      }
      return null;
    }),
  );

  if (data.currentTurnIndex === 0 || data.currentTurnIndex === 1) {
    state.currentTurn = players[data.currentTurnIndex]?.id ?? null;
  } else {
    state.currentTurn = getFirstPlayerId(players) || state.playerId;
  }

  if (data.winnerIndex === 0 || data.winnerIndex === 1) {
    state.winner = players[data.winnerIndex]?.id ?? null;
  } else {
    state.winner = null;
  }

  state.gameOver = data.gameOver;
  state.isResetting = data.isResetting;

  renderBoard();
  updateStatus();
}

function syncGameStateWithServer(): void {
  const serialized = serializeState();
  if (!serialized) return;

  window.game.sendMessage('saveGameState', {
    gameId: 'connectFour',
    state: serialized,
  });
}

const connectFourGame: Game = {
  canPlay,
  start,
  stop,
  saveState: () => serializeState(),
  loadState: applySerializedState,
};

if (!window.games) {
  window.games = {};
}

window.games.connectFour = connectFourGame;

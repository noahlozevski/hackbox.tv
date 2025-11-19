import type { Game } from './types.js';

interface TicTacToeState {
  playerId: string | null;
  board: (string | null)[][];
  currentTurn: string;
  winner: string | null;
  gameOver: boolean;
  isResetting: boolean;
}

let state: TicTacToeState;
let originalContent: string;

function canPlay(): boolean {
  return window.game.players.length === 2;
}

function startGame(): void {
  if (!canPlay()) {
    alert('You need exactly 2 players to play Tic-Tac-Toe!');
    return;
  }

  // Store original DOM content
  const mainDiv = document.getElementById('main');
  if (mainDiv) {
    originalContent = mainDiv.innerHTML;
  }

  // Initialize game state
  state = {
    playerId: window.game.state.playerId,
    board: Array(3)
      .fill(null)
      .map(() => Array(3).fill(null)),
    currentTurn: window.game.players[0],
    winner: null,
    gameOver: false,
    isResetting: false,
  };

  // Set up game UI
  renderGameUI();

  // Set up message handler
  window.game.onMessage = handleGameMessage;

  console.log('Tic-Tac-Toe started!');
}

function handleGameMessage(playerId: string, event: string, payload: unknown): void {
  if (event === 'move') {
    const move = payload as { row: number; col: number };
    handleOpponentMove(playerId, move.row, move.col);
  } else if (event === 'restart') {
    resetGame();
  }
}

function renderGameUI(): void {
  const mainDiv = document.getElementById('main');
  if (!mainDiv) return;

  mainDiv.innerHTML = `
    <div id="tic-tac-toe-game">
      <h2>Tic-Tac-Toe</h2>
      <div id="game-status"></div>
      <div id="turn-indicator"></div>
      <div id="game-board"></div>
    </div>
  `;

  renderBoard();
  updateStatus();
}

function renderBoard(): void {
  const boardDiv = document.getElementById('game-board');
  if (!boardDiv) return;

  boardDiv.innerHTML = '';
  boardDiv.style.cssText = `
    display: grid;
    grid-template-columns: repeat(3, 100px);
    grid-gap: 5px;
    margin: 20px auto;
    width: fit-content;
  `;

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const cell = document.createElement('div');
      cell.style.cssText = `
        width: 100px;
        height: 100px;
        border: 2px solid #333;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 48px;
        font-weight: bold;
        cursor: pointer;
        background-color: #f0f0f0;
        user-select: none;
      `;

      const cellValue = state.board[row][col];
      if (cellValue) {
        cell.textContent = getPlayerSymbol(cellValue);
        cell.style.cursor = 'default';
        cell.style.backgroundColor = '#e0e0e0';
      }

      cell.dataset.row = String(row);
      cell.dataset.col = String(col);
      cell.addEventListener('click', () => handleCellClick(row, col));

      boardDiv.appendChild(cell);
    }
  }
}

function getPlayerSymbol(playerId: string): string {
  const playerIndex = window.game.players.indexOf(playerId);
  return playerIndex === 0 ? 'X' : 'O';
}

function handleCellClick(row: number, col: number): void {
  // Check if it's our turn
  if (state.currentTurn !== state.playerId) {
    console.log('Not your turn!');
    return;
  }

  // Check if cell is already occupied
  if (state.board[row][col] !== null) {
    console.log('Cell already occupied!');
    return;
  }

  // Check if game is over
  if (state.gameOver) {
    console.log('Game is over!');
    return;
  }

  // Make the move locally
  makeMove(state.playerId!, row, col);

  // Send move to other players
  window.game.sendMessage('move', { row, col });
}

function handleOpponentMove(playerId: string, row: number, col: number): void {
  makeMove(playerId, row, col);
}

function makeMove(playerId: string, row: number, col: number): void {
  // Update board state
  state.board[row][col] = playerId;

  // Re-render board
  renderBoard();

  // Check for winner
  const winner = checkWinner();
  if (winner) {
    state.winner = winner;
    state.gameOver = true;
    updateStatus();
    scheduleRestart();
    return;
  }

  // Check for draw
  if (isBoardFull()) {
    state.gameOver = true;
    updateStatus();
    scheduleRestart();
    return;
  }

  // Switch turns
  const currentIndex = window.game.players.indexOf(state.currentTurn);
  state.currentTurn = window.game.players[(currentIndex + 1) % window.game.players.length];

  updateStatus();
}

function checkWinner(): string | null {
  const lines = [
    // Rows
    [
      [0, 0],
      [0, 1],
      [0, 2],
    ],
    [
      [1, 0],
      [1, 1],
      [1, 2],
    ],
    [
      [2, 0],
      [2, 1],
      [2, 2],
    ],
    // Columns
    [
      [0, 0],
      [1, 0],
      [2, 0],
    ],
    [
      [0, 1],
      [1, 1],
      [2, 1],
    ],
    [
      [0, 2],
      [1, 2],
      [2, 2],
    ],
    // Diagonals
    [
      [0, 0],
      [1, 1],
      [2, 2],
    ],
    [
      [0, 2],
      [1, 1],
      [2, 0],
    ],
  ];

  for (const line of lines) {
    const [a, b, c] = line;
    const cellA = state.board[a[0]][a[1]];
    const cellB = state.board[b[0]][b[1]];
    const cellC = state.board[c[0]][c[1]];

    if (cellA && cellA === cellB && cellA === cellC) {
      return cellA;
    }
  }

  return null;
}

function isBoardFull(): boolean {
  return state.board.every((row) => row.every((cell) => cell !== null));
}

function updateStatus(): void {
  const statusDiv = document.getElementById('game-status');
  const turnDiv = document.getElementById('turn-indicator');

  if (!statusDiv || !turnDiv) return;

  if (state.winner) {
    const winnerSymbol = getPlayerSymbol(state.winner);
    const isLocalWinner = state.winner === state.playerId;
    statusDiv.textContent = isLocalWinner
      ? `You win! (${winnerSymbol})`
      : `Player ${winnerSymbol} wins!`;
    statusDiv.style.color = isLocalWinner ? 'green' : 'red';
    statusDiv.style.fontSize = '24px';
    statusDiv.style.fontWeight = 'bold';
    turnDiv.textContent = 'Game will restart in 3 seconds...';
  } else if (state.gameOver) {
    statusDiv.textContent = "It's a draw!";
    statusDiv.style.color = 'blue';
    statusDiv.style.fontSize = '24px';
    statusDiv.style.fontWeight = 'bold';
    turnDiv.textContent = 'Game will restart in 3 seconds...';
  } else {
    const currentSymbol = getPlayerSymbol(state.currentTurn);
    const isOurTurn = state.currentTurn === state.playerId;
    statusDiv.textContent = '';
    turnDiv.textContent = isOurTurn
      ? `Your turn (${currentSymbol})`
      : `Waiting for ${currentSymbol}...`;
    turnDiv.style.fontSize = '18px';
    turnDiv.style.fontWeight = 'normal';
  }
}

function scheduleRestart(): void {
  if (state.isResetting) return;
  state.isResetting = true;

  setTimeout(() => {
    // Only the first player sends restart message to avoid duplicates
    if (state.playerId === window.game.players[0]) {
      window.game.sendMessage('restart', {});
    }
    resetGame();
  }, 3000);
}

function resetGame(): void {
  state.board = Array(3)
    .fill(null)
    .map(() => Array(3).fill(null));
  state.currentTurn = window.game.players[0];
  state.winner = null;
  state.gameOver = false;
  state.isResetting = false;

  renderBoard();
  updateStatus();
}

function stopGame(): void {
  // Restore original DOM
  const mainDiv = document.getElementById('main');
  if (mainDiv && originalContent) {
    mainDiv.innerHTML = originalContent;
  }

  // Clear message handler
  window.game.onMessage = function (player: string, event: string, payload: unknown) {
    console.log(`Received event [${event}] from player ${player}:`, payload);
  };

  console.log('Tic-Tac-Toe stopped!');
}

// Register the game
const ticTacToeGame: Game = {
  canPlay,
  start: startGame,
  stop: stopGame,
};

if (!window.games) {
  window.games = {};
}

window.games.ticTacToe = ticTacToeGame;

import type { Game, TicTacToeState, TicTacToeAction } from './types.js';

let originalContent: string;
let currentState: TicTacToeState | null = null;

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

  // Set up game UI
  renderGameUI();

  // Set up state update handler from server
  window.game.onGameStateUpdate = handleGameStateUpdate;

  // Send initial action to start the game
  const action: TicTacToeAction = {
    type: 'restart',
    playerId: window.game.state.playerId!,
  };
  window.game.sendGameAction('tic-tac-toe', action);

  console.log('Tic-Tac-Toe started (server-authoritative)!');
}

function handleGameStateUpdate(data: unknown): void {
  const update = data as {
    gameType: string;
    state: TicTacToeState;
    validationError?: string;
  };

  if (update.gameType !== 'tic-tac-toe') {
    return; // Not for us
  }

  if (update.validationError) {
    console.warn('Invalid move:', update.validationError);
    showError(update.validationError);
    return;
  }

  currentState = update.state;
  renderBoard();
  updateStatus();

  // Auto-restart after game over
  if (currentState.gameOver && !currentState.winner) {
    scheduleRestart();
  } else if (currentState.winner) {
    scheduleRestart();
  }
}

function renderGameUI(): void {
  const mainDiv = document.getElementById('main');
  if (!mainDiv) return;

  mainDiv.innerHTML = `
    <div id="tic-tac-toe-game">
      <h2>Tic-Tac-Toe (Server-Authoritative)</h2>
      <div id="game-status"></div>
      <div id="turn-indicator"></div>
      <div id="error-message" style="color: red; font-weight: bold;"></div>
      <div id="game-board"></div>
    </div>
  `;

  renderBoard();
  updateStatus();
}

function renderBoard(): void {
  const boardDiv = document.getElementById('game-board');
  if (!boardDiv || !currentState) return;

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

      const cellValue = currentState.board[row][col];
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
  if (!currentState) return '?';
  const playerIndex = currentState.players.indexOf(playerId);
  return playerIndex === 0 ? 'X' : 'O';
}

function handleCellClick(row: number, col: number): void {
  if (!currentState || !window.game.state.playerId) return;

  // Client-side pre-validation (for UX)
  if (currentState.currentTurn !== window.game.state.playerId) {
    showError('Not your turn!');
    return;
  }

  if (currentState.board[row][col] !== null) {
    showError('Cell already occupied!');
    return;
  }

  if (currentState.gameOver) {
    showError('Game is over!');
    return;
  }

  // Send action to server
  const action: TicTacToeAction = {
    type: 'move',
    playerId: window.game.state.playerId,
    move: { row, col },
  };
  window.game.sendGameAction('tic-tac-toe', action);
}

function updateStatus(): void {
  if (!currentState) return;

  const statusDiv = document.getElementById('game-status');
  const turnDiv = document.getElementById('turn-indicator');

  if (!statusDiv || !turnDiv) return;

  if (currentState.winner) {
    const winnerSymbol = getPlayerSymbol(currentState.winner);
    const isLocalWinner = currentState.winner === window.game.state.playerId;
    statusDiv.textContent = isLocalWinner
      ? `You win! (${winnerSymbol})`
      : `Player ${winnerSymbol} wins!`;
    statusDiv.style.color = isLocalWinner ? 'green' : 'red';
    statusDiv.style.fontSize = '24px';
    statusDiv.style.fontWeight = 'bold';
    turnDiv.textContent = 'Game will restart in 3 seconds...';
  } else if (currentState.gameOver) {
    statusDiv.textContent = "It's a draw!";
    statusDiv.style.color = 'blue';
    statusDiv.style.fontSize = '24px';
    statusDiv.style.fontWeight = 'bold';
    turnDiv.textContent = 'Game will restart in 3 seconds...';
  } else {
    const currentSymbol = getPlayerSymbol(currentState.currentTurn);
    const isOurTurn = currentState.currentTurn === window.game.state.playerId;
    statusDiv.textContent = '';
    turnDiv.textContent = isOurTurn
      ? `Your turn (${currentSymbol})`
      : `Waiting for ${currentSymbol}...`;
    turnDiv.style.fontSize = '18px';
    turnDiv.style.fontWeight = 'normal';
  }
}

function showError(message: string): void {
  const errorDiv = document.getElementById('error-message');
  if (!errorDiv) return;

  errorDiv.textContent = message;
  setTimeout(() => {
    errorDiv.textContent = '';
  }, 2000);
}

function scheduleRestart(): void {
  setTimeout(() => {
    // Only the first player sends restart
    if (
      currentState &&
      window.game.state.playerId === currentState.players[0]
    ) {
      const action: TicTacToeAction = {
        type: 'restart',
        playerId: window.game.state.playerId!,
      };
      window.game.sendGameAction('tic-tac-toe', action);
    }
  }, 3000);
}

function stopGame(): void {
  // Restore original DOM
  const mainDiv = document.getElementById('main');
  if (mainDiv && originalContent) {
    mainDiv.innerHTML = originalContent;
  }

  // Clear handler
  window.game.onGameStateUpdate = null;

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

// Store the original body content to restore it later
let originalContent = null;

function startGame() {
  // Store the original content
  originalContent = document.body.innerHTML;

  // Clear and style the body
  document.body.innerHTML = '';
  document.body.style.margin = '0';
  document.body.style.padding = '0';
  document.body.style.backgroundColor = '#1a1a1a';
  document.body.style.fontFamily = 'Arial, sans-serif';

  // Initialize game state
  game.state = {
    playerId: game.state.playerId,
    board: Array(6)
      .fill()
      .map(() => Array(7).fill(null)),
    currentTurn: game.players[0],
    winner: null,
    gameOver: false,
    isResetting: false,
  };

  // Create and style game container
  const container = document.createElement('div');
  container.style.maxWidth = '100vw';
  container.style.minHeight = '100vh';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.alignItems = 'center';
  container.style.padding = '20px';
  document.body.appendChild(container);

  // Create status display
  const statusDisplay = document.createElement('div');
  statusDisplay.style.color = 'white';
  statusDisplay.style.fontSize = '24px';
  statusDisplay.style.marginBottom = '20px';
  statusDisplay.style.textAlign = 'center';
  container.appendChild(statusDisplay);

  // Create game board
  const board = document.createElement('div');
  board.style.display = 'grid';
  board.style.gridTemplateColumns = 'repeat(7, 1fr)';
  board.style.gap = '8px';
  board.style.padding = '10px';
  board.style.backgroundColor = '#2c3e50';
  board.style.borderRadius = '10px';
  board.style.maxWidth = '90vw';
  container.appendChild(board);

  // Store cell references in a 2D array
  const cellElements = Array(6)
    .fill()
    .map(() => Array(7));

  // Create cells for the game board
  for (let col = 0; col < 7; col++) {
    const column = document.createElement('div');
    column.style.display = 'flex';
    column.style.flexDirection = 'column-reverse';
    column.style.gap = '8px';

    for (let row = 0; row < 6; row++) {
      const cell = document.createElement('div');
      cell.style.width = '40px';
      cell.style.height = '40px';
      cell.style.borderRadius = '50%';
      cell.style.backgroundColor = '#34495e';
      cell.style.transition = 'background-color 0.3s ease';

      cellElements[row][col] = cell;
      column.appendChild(cell);
    }

    column.addEventListener('click', () => handleMove(col));
    board.appendChild(column);
  }

  // Function to handle a player's move
  function handleMove(col) {
    if (game.state.gameOver || game.state.currentTurn !== game.state.playerId)
      return;

    const row = getLowestEmptyRow(col);
    if (row === -1) return; // Column is full

    game.sendMessage('move', { col, row });
    makeMove(game.state.currentTurn, col, row);
  }

  // Function to make a move
  function makeMove(player, col, row) {
    game.state.board[row][col] = player;
    updateUI();

    if (checkWin(row, col, player)) {
      game.state.winner = player;
      game.state.gameOver = true;
      if (player === game.state.playerId) {
        setTimeout(() => {
          game.sendMessage('restart', {});
          cleanupAndRestore();
        }, 3000);
      }
    } else if (checkDraw()) {
      game.state.gameOver = true;
      if (game.state.playerId === game.players[0]) {
        setTimeout(() => {
          game.sendMessage('restart', {});
          cleanupAndRestore();
        }, 3000);
      }
    } else {
      const currentIndex = game.players.indexOf(game.state.currentTurn);
      game.state.currentTurn =
        game.players[(currentIndex + 1) % game.players.length];
    }

    updateStatus();
  }

  // Helper function to get the lowest empty row in a column
  function getLowestEmptyRow(col) {
    for (let row = 0; row < 6; row++) {
      if (game.state.board[row][col] === null) {
        return row;
      }
    }
    return -1;
  }

  // Function to check for a win
  function checkWin(row, col, player) {
    const directions = [
      [
        [0, 1],
        [0, -1],
      ], // horizontal
      [
        [1, 0],
        [-1, 0],
      ], // vertical
      [
        [1, 1],
        [-1, -1],
      ], // diagonal
      [
        [1, -1],
        [-1, 1],
      ], // other diagonal
    ];

    return directions.some((dir) => {
      let count = 1;
      dir.forEach(([dx, dy]) => {
        let r = row + dx;
        let c = col + dy;
        while (
          r >= 0 &&
          r < 6 &&
          c >= 0 &&
          c < 7 &&
          game.state.board[r][c] === player
        ) {
          count++;
          r += dx;
          c += dy;
        }
      });
      return count >= 4;
    });
  }

  // Function to check for a draw
  function checkDraw() {
    return game.state.board.every((row) => row.every((cell) => cell !== null));
  }

  // Function to update the UI based on game state
  function updateUI() {
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 7; col++) {
        const cell = cellElements[row][col];
        const player = game.state.board[row][col];

        if (player === null) {
          cell.style.backgroundColor = '#34495e';
        } else if (player === game.players[0]) {
          cell.style.backgroundColor = '#e74c3c';
        } else {
          cell.style.backgroundColor = '#f1c40f';
        }
      }
    }
  }

  // Function to update status display
  function updateStatus() {
    if (game.state.gameOver) {
      if (game.state.winner) {
        statusDisplay.textContent = `Player ${game.state.winner === game.state.playerId ? 'You' : 'Opponent'} won!`;
      } else {
        statusDisplay.textContent = "It's a draw!";
      }
    } else {
      statusDisplay.textContent =
        game.state.currentTurn === game.state.playerId
          ? 'Your turn!'
          : "Opponent's turn";
    }
  }

  // Set up message handler
  game.onMessage = function(player, event, payload) {
    if (event === 'move') {
      makeMove(player, payload.col, payload.row);
    } else if (event === 'restart') {
      if (!game.state.isResetting) {
        game.state.isResetting = true;
        cleanupAndRestore();
      }
    }
  };

  // Initial UI update
  updateUI();
  updateStatus();
}

// Function to cleanup the game and restore original content
function cleanupAndRestore() {
  // Reset game state
  game.state = {
    playerId: game.state.playerId,
    isResetting: false,
  };

  // Restore the original content
  document.body.innerHTML = originalContent;

  // Reattach the click event listener to the button
  document.getElementById('connect-four').addEventListener('click', startGame);
}

if (!window.games) {
  window.games = {};
}

window.games.connectFour = {
  start: startGame,
  stop: cleanupAndRestore,
  canPlay: (playerCount) => playerCount === 2,
};

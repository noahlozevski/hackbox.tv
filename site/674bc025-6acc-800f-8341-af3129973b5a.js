window.game.startGame = (function() {
  // Wipe current UI
  document.body.innerHTML = '';

  // Get game and player info
  const game = window.game;
  const playerId = game.state.playerId;
  const players = game.players;
  const myIndex = players.indexOf(playerId);
  const hostId = players[0];
  const mySymbol = myIndex === 0 ? 'X' : myIndex === 1 ? 'O' : 'Spectator';

  // Initialize game state
  let currentTurnIndex = null;
  let board = Array(9).fill(null);

  // Create UI elements
  document.body.style.backgroundColor = '#f0f0f0';
  document.body.style.fontFamily = 'Arial, sans-serif';
  const gameContainer = document.createElement('div');
  gameContainer.style.display = 'flex';
  gameContainer.style.flexDirection = 'column';
  gameContainer.style.alignItems = 'center';
  gameContainer.style.marginTop = '50px';
  document.body.appendChild(gameContainer);

  const title = document.createElement('h1');
  title.textContent = 'Tic-Tac-Toe';
  title.style.color = '#333';
  gameContainer.appendChild(title);

  const statusDisplay = document.createElement('div');
  statusDisplay.textContent = 'Waiting for game to start...';
  statusDisplay.style.marginBottom = '20px';
  statusDisplay.style.fontSize = '18px';
  statusDisplay.style.color = '#555';
  gameContainer.appendChild(statusDisplay);

  const boardContainer = document.createElement('div');
  boardContainer.style.display = 'grid';
  boardContainer.style.gridTemplateColumns = 'repeat(3, 100px)';
  boardContainer.style.gridTemplateRows = 'repeat(3, 100px)';
  boardContainer.style.gap = '5px';
  gameContainer.appendChild(boardContainer);

  const cells = [];
  for (let i = 0; i < 9; i++) {
    const cell = document.createElement('div');
    cell.style.width = '100px';
    cell.style.height = '100px';
    cell.style.backgroundColor = '#fff';
    cell.style.border = '2px solid #ccc';
    cell.style.display = 'flex';
    cell.style.alignItems = 'center';
    cell.style.justifyContent = 'center';
    cell.style.fontSize = '48px';
    cell.style.cursor = 'pointer';
    cell.style.transition = 'background-color 0.3s';
    cell.dataset.index = i;
    cell.addEventListener('click', onCellClick);
    cell.addEventListener('mouseover', () => {
      cell.style.backgroundColor = '#e6e6e6';
    });
    cell.addEventListener('mouseout', () => {
      cell.style.backgroundColor = '#fff';
    });
    boardContainer.appendChild(cell);
    cells.push(cell);
  }

  function onCellClick(event) {
    const index = event.target.dataset.index;
    if (players[currentTurnIndex] !== playerId || board[index]) return;
    board[index] = mySymbol;
    event.target.textContent = mySymbol;
    if (checkWin(mySymbol)) {
      statusDisplay.textContent = 'You win!';
      game.sendMessage('gameOver', { winner: playerId });
      return;
    } else if (board.every(cell => cell)) {
      statusDisplay.textContent = 'It\'s a draw!';
      game.sendMessage('gameOver', { winner: null });
      return;
    }
    currentTurnIndex = 1 - currentTurnIndex;
    game.sendMessage('makeMove', { index, symbol: mySymbol, currentTurnIndex });
    updateStatusDisplay();
  }

  function checkWin(symbol) {
    const winConditions = [
      [0,1,2], [3,4,5], [6,7,8],
      [0,3,6], [1,4,7], [2,5,8],
      [0,4,8], [2,4,6],
    ];
    return winConditions.some(condition => {
      const [a, b, c] = condition;
      return board[a] === symbol && board[b] === symbol && board[c] === symbol;
    });
  }

  function updateStatusDisplay() {
    if (mySymbol === 'Spectator') {
      statusDisplay.textContent = 'Spectating...';
      return;
    }
    if (players[currentTurnIndex] === playerId) {
      statusDisplay.textContent = 'Your turn';
    } else {
      statusDisplay.textContent = 'Waiting for opponent\'s turn';
    }
  }

  game.onMessage = function(player, event, payload) {
    if (event === 'startGame') {
      currentTurnIndex = payload.currentTurnIndex;
      board = payload.board;
      board.forEach((symbol, i) => {
        cells[i].textContent = symbol;
      });
      updateStatusDisplay();
    } else if (event === 'makeMove') {
      board[payload.index] = payload.symbol;
      cells[payload.index].textContent = payload.symbol;
      currentTurnIndex = payload.currentTurnIndex;
      if (checkWin(payload.symbol)) {
        statusDisplay.textContent = 'You lose!';
        return;
      } else if (board.every(cell => cell)) {
        statusDisplay.textContent = 'It\'s a draw!';
        return;
      }
      updateStatusDisplay();
    } else if (event === 'gameOver') {
      if (payload.winner === playerId) {
        statusDisplay.textContent = 'You win!';
      } else if (payload.winner === null) {
        statusDisplay.textContent = 'It\'s a draw!';
      } else {
        statusDisplay.textContent = 'You lose!';
      }
    }
  };

  if (playerId === hostId) {
    currentTurnIndex = 0;
    board = Array(9).fill(null);
    game.sendMessage('startGame', { currentTurnIndex, board });
    updateStatusDisplay();
  }
})();

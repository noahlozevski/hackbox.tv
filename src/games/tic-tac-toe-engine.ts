import type {
  GameEngine,
  TicTacToeState,
  TicTacToeAction,
} from '../../shared/types';

export class TicTacToeEngine
  implements GameEngine<TicTacToeState, TicTacToeAction>
{
  init(players: string[]): TicTacToeState {
    if (players.length !== 2) {
      throw new Error('Tic-Tac-Toe requires exactly 2 players');
    }

    return {
      gameType: 'tic-tac-toe',
      board: Array(3)
        .fill(null)
        .map(() => Array(3).fill(null)),
      currentTurn: players[0],
      winner: null,
      gameOver: false,
      players,
    };
  }

  validateAction(
    state: TicTacToeState,
    action: TicTacToeAction,
  ): { valid: boolean; error?: string } {
    // Restart is always valid
    if (action.type === 'restart') {
      return { valid: true };
    }

    // Move validation
    if (action.type === 'move') {
      if (!action.move) {
        return { valid: false, error: 'Move data is required' };
      }

      const { row, col } = action.move;

      // Check if game is over
      if (state.gameOver) {
        return { valid: false, error: 'Game is already over' };
      }

      // Check if it's the player's turn
      if (action.playerId !== state.currentTurn) {
        return { valid: false, error: 'Not your turn' };
      }

      // Check if move is in bounds
      if (row < 0 || row > 2 || col < 0 || col > 2) {
        return { valid: false, error: 'Move out of bounds' };
      }

      // Check if cell is already occupied
      if (state.board[row][col] !== null) {
        return { valid: false, error: 'Cell already occupied' };
      }

      return { valid: true };
    }

    return { valid: false, error: 'Unknown action type' };
  }

  applyAction(state: TicTacToeState, action: TicTacToeAction): TicTacToeState {
    if (action.type === 'restart') {
      return this.init(state.players);
    }

    if (action.type === 'move' && action.move) {
      const { row, col } = action.move;
      const newBoard = state.board.map((r) => [...r]);
      newBoard[row][col] = action.playerId;

      const winner = this.checkWinner(newBoard);
      const isBoardFull = this.isBoardFull(newBoard);
      const gameOver = winner !== null || isBoardFull;

      // Switch turns
      const currentPlayerIndex = state.players.indexOf(state.currentTurn);
      const nextTurn =
        state.players[(currentPlayerIndex + 1) % state.players.length];

      return {
        ...state,
        board: newBoard,
        currentTurn: gameOver ? state.currentTurn : nextTurn,
        winner,
        gameOver,
      };
    }

    return state;
  }

  isGameOver(state: TicTacToeState): boolean {
    return state.gameOver;
  }

  getWinner(state: TicTacToeState): string | null {
    return state.winner;
  }

  private checkWinner(board: (string | null)[][]): string | null {
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
      const cellA = board[a[0]][a[1]];
      const cellB = board[b[0]][b[1]];
      const cellC = board[c[0]][c[1]];

      if (cellA && cellA === cellB && cellA === cellC) {
        return cellA;
      }
    }

    return null;
  }

  private isBoardFull(board: (string | null)[][]): boolean {
    return board.every((row) => row.every((cell) => cell !== null));
  }
}

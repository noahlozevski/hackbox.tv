import { describe, it, expect } from 'vitest';
import { TicTacToeEngine } from './games/tic-tac-toe-engine';
import type { TicTacToeAction } from '../shared/types';

describe('TicTacToeEngine', () => {
  const engine = new TicTacToeEngine();
  const players = ['player-1', 'player-2'];

  it('initializes a valid state', () => {
    const state = engine.init(players);

    expect(state.gameType).toBe('tic-tac-toe');
    expect(state.players).toEqual(players);
    expect(state.board).toHaveLength(3);
    expect(state.board[0]).toHaveLength(3);
  });

  it('rejects moves out of turn', () => {
    const state = engine.init(players);

    const action: TicTacToeAction = {
      type: 'move',
      playerId: players[1],
      move: { row: 0, col: 0 },
    };

    const validation = engine.validateAction(state, action);
    expect(validation.valid).toBe(false);
    expect(validation.error).toBe('Not your turn');
  });

  it('detects a winning line', () => {
    let state = engine.init(players);

    const moves: TicTacToeAction[] = [
      { type: 'move', playerId: players[0], move: { row: 0, col: 0 } },
      { type: 'move', playerId: players[1], move: { row: 1, col: 0 } },
      { type: 'move', playerId: players[0], move: { row: 0, col: 1 } },
      { type: 'move', playerId: players[1], move: { row: 1, col: 1 } },
      { type: 'move', playerId: players[0], move: { row: 0, col: 2 } },
    ];

    for (const action of moves) {
      const validation = engine.validateAction(state, action);
      expect(validation.valid).toBe(true);
      state = engine.applyAction(state, action);
    }

    expect(state.gameOver).toBe(true);
    expect(state.winner).toBe(players[0]);
  });
});

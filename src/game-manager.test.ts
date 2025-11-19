import { describe, it, expect } from 'vitest';
import { GameManager } from './game-manager';
import type { TicTacToeAction, TicTacToeState } from '../shared/types';

describe('GameManager with TicTacToeEngine', () => {
  const players = ['player-1', 'player-2'];

  it('starts a new tic-tac-toe game', () => {
    const manager = new GameManager();

    // Ensure the default engine is wired correctly
    const state = manager.startGame(
      'room-1',
      'tic-tac-toe',
      players,
    ) as TicTacToeState;

    expect(state.gameType).toBe('tic-tac-toe');
    expect(state.players).toEqual(players);
    expect(manager.hasActiveGame('room-1')).toBe(true);
  });

  it('processes a valid move', () => {
    const manager = new GameManager();
    manager.startGame('room-1', 'tic-tac-toe', players);

    const action: TicTacToeAction = {
      type: 'move',
      playerId: players[0],
      move: { row: 0, col: 0 },
    };

    const result = manager.processAction('room-1', action);
    const state = result.state as TicTacToeState;

    expect(result.error).toBeUndefined();
    expect(state.board[0][0]).toBe(players[0]);
  });

  it('returns an error when there is no active game', () => {
    const manager = new GameManager();

    const action: TicTacToeAction = {
      type: 'move',
      playerId: players[0],
      move: { row: 0, col: 0 },
    };

    const result = manager.processAction('unknown-room', action);
    expect(result.error).toBe('No active game in this room');
  });
});

import type { GameEngine, GameState, GameAction } from '../shared/types';
import { TicTacToeEngine } from './games/tic-tac-toe-engine';

interface ActiveGame {
  gameType: string;
  state: GameState;
  engine: GameEngine<GameState, GameAction>;
}

export class GameManager {
  private games: Map<string, ActiveGame> = new Map();
  private engines: Map<string, GameEngine<GameState, GameAction>> = new Map();

  constructor() {
    // Register game engines
    this.engines.set(
      'tic-tac-toe',
      new TicTacToeEngine() as GameEngine<GameState, GameAction>,
    );
  }

  /**
   * Start a new game in a room
   */
  startGame(roomName: string, gameType: string, players: string[]): GameState {
    const engine = this.engines.get(gameType);
    if (!engine) {
      throw new Error(`Unknown game type: ${gameType}`);
    }

    const state = engine.init(players);
    this.games.set(roomName, {
      gameType,
      state,
      engine,
    });

    return state;
  }

  /**
   * Process a game action
   */
  processAction(
    roomName: string,
    action: GameAction,
  ): { state: GameState; error?: string } {
    const game = this.games.get(roomName);
    if (!game) {
      return {
        state: {} as GameState,
        error: 'No active game in this room',
      };
    }

    // Validate action
    const validation = game.engine.validateAction(game.state, action);
    if (!validation.valid) {
      return {
        state: game.state,
        error: validation.error,
      };
    }

    // Apply action
    const newState = game.engine.applyAction(game.state, action);
    game.state = newState;

    return { state: newState };
  }

  /**
   * Get current game state for a room
   */
  getGameState(roomName: string): GameState | null {
    const game = this.games.get(roomName);
    return game ? game.state : null;
  }

  /**
   * End a game in a room
   */
  endGame(roomName: string): void {
    this.games.delete(roomName);
  }

  /**
   * Check if a room has an active game
   */
  hasActiveGame(roomName: string): boolean {
    return this.games.has(roomName);
  }
}

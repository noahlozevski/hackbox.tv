/**
 * Client-side types
 * Re-exports shared types and adds client-specific interfaces
 */

// Re-export local copy of shared types for client build
export * from './shared/types.js';

// Client-specific game framework types
export type PlayersChangedCallback = (players: string[]) => void;
export type MessageCallback = (
  playerId: string,
  event: string,
  payload: unknown,
) => void;
export type GameStateCallback = (state: unknown) => void;

// Game state interface
export interface GameState {
  playerId: string | null;
  currentRoom: string | null;
}

// Main game framework interface
export interface GameFramework {
  players: string[];
  currentGame: string | null;
  state: GameState;
  ws: WebSocket | null;

  // Callbacks
  handlePlayersChanged: PlayersChangedCallback | null;
  onMessage: MessageCallback | null;
  onGameStateUpdate: GameStateCallback | null;

  // Methods
  sendMessage: (event: string, payload: unknown) => void;
  sendGameAction: (gameType: string, action: unknown) => void;
}

// Individual game interface that each game must implement
export interface Game {
  /**
   * Check if the game can be played with current number of players
   */
  canPlay: () => boolean;

  /**
   * Start the game
   */
  start: () => void;

  /**
   * Stop/cleanup the game
   */
  stop: () => void;
}

// Game registry
export interface GameRegistry {
  [gameName: string]: Game;
}

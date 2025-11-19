/**
 * Client-side types
 * Re-exports shared types and adds client-specific interfaces
 */

// Re-export shared protocol types for client build (including PlayerInfo)
export * from './shared/types.js';
import type { PlayerInfo } from './shared/types.js';

// Client-specific game framework types
export type PlayersChangedCallback = (players: PlayerInfo[]) => void;
export type MessageCallback = (
  playerId: string,
  event: string,
  payload: unknown,
) => void;
export type GameStateCallback = (state: unknown) => void;

// Game state interface
export interface GameState {
  playerId: string | null;
  playerName: string | null;
  currentRoom: string | null;
}

// Main game framework interface
export interface GameFramework {
  players: PlayerInfo[];
  currentGame: string | null;
  state: GameState;
  ws: WebSocket | null;

  // Callbacks
  handlePlayersChanged: PlayersChangedCallback | null;
  onMessage: MessageCallback | null;
  onGameStateUpdate: GameStateCallback | null;

  // Event subscription helpers
  subscribeToMessages: (listener: MessageCallback) => () => void;
  subscribeToGameState: (listener: GameStateCallback) => () => void;

  // Methods
  sendMessage: (event: string, payload: unknown) => void;
  sendGameAction: (gameType: string, action: unknown) => void;
  updateName: (name: string) => void;
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
   * @param clearState - If true, completely clear saved state (exit game)
   */
  stop: (clearState?: boolean) => void;

  /**
   * Save the current game state (optional - for persistence)
   * Should return a serializable object representing the game state
   */
  saveState?: () => unknown;

  /**
   * Load a previously saved game state (optional - for persistence)
   * Should restore the game to the saved state
   */
  loadState?: (state: unknown) => void;

  /**
   * Original stop method before wrapping (used internally for sync)
   */
  _originalStop?: () => void;

  /**
   * Internal marker used to avoid reapplying identical saved state payloads
   */
  _lastSyncedState?: string;
  _lastSyncedRevision?: number;
}

// Game registry
export interface GameRegistry {
  [gameName: string]: Game;
}

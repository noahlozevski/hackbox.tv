/**
 * Shared types between server and client
 * Single source of truth for WebSocket message protocol
 */

// ============================================================================
// Player/Client Types
// ============================================================================

/**
 * Player information shared between client and server
 * Add new player properties here to make them available everywhere
 */
export interface PlayerInfo {
  id: string;
  name: string;
}

// ============================================================================
// WebSocket Message Types
// ============================================================================

export type ServerMessageType =
  | 'connected'
  | 'roomsList'
  | 'joinedRoom'
  | 'newClient'
  | 'clientLeft'
  | 'message'
  | 'gameStateUpdate' // New: Server-authoritative game state
  | 'nameUpdated'
  | 'error';

export type ClientMessageType =
  | 'joinRoom'
  | 'leaveRoom'
  | 'message'
  | 'gameAction' // New: Game actions
  | 'updateName';

// Base message structure
export interface BaseMessage {
  type: ServerMessageType | ClientMessageType;
  data?: unknown;
}

// ============================================================================
// Server -> Client Messages
// ============================================================================

export interface ConnectedMessage extends BaseMessage {
  type: 'connected';
  data: {
    clientId: string;
    name: string;
  };
}

export interface RoomsListMessage extends BaseMessage {
  type: 'roomsList';
  data: Array<{
    name: string;
    clients: PlayerInfo[];
  }>;
}

export interface JoinedRoomMessage extends BaseMessage {
  type: 'joinedRoom';
  data: {
    room: string;
    clients: PlayerInfo[];
  };
}

export interface NewClientMessage extends BaseMessage {
  type: 'newClient';
  data: {
    clientId: string;
    name: string;
  };
}

export interface ClientLeftMessage extends BaseMessage {
  type: 'clientLeft';
  data: {
    clientId: string;
  };
}

export interface GameMessage extends BaseMessage {
  type: 'message';
  data: {
    playerId: string;
    message: {
      event: string;
      payload: unknown;
    };
  };
}

export interface GameStateUpdateMessage extends BaseMessage {
  type: 'gameStateUpdate';
  data: {
    gameType: string;
    state: GameState;
    validationError?: string;
  };
}

export interface NameUpdatedMessage extends BaseMessage {
  type: 'nameUpdated';
  data: {
    clientId: string;
    name: string;
  };
}

export interface ErrorMessage extends BaseMessage {
  type: 'error';
  data: {
    error: string;
  };
}

export type ServerMessage =
  | ConnectedMessage
  | RoomsListMessage
  | JoinedRoomMessage
  | NewClientMessage
  | ClientLeftMessage
  | GameMessage
  | GameStateUpdateMessage
  | NameUpdatedMessage
  | ErrorMessage;

// ============================================================================
// Client -> Server Messages
// ============================================================================

export interface JoinRoomRequest extends BaseMessage {
  type: 'joinRoom';
  data: {
    roomName: string;
  };
}

export interface LeaveRoomRequest extends BaseMessage {
  type: 'leaveRoom';
  data: Record<string, never>;
}

export interface GameActionRequest extends BaseMessage {
  type: 'gameAction';
  data: {
    gameType: string;
    action: GameAction;
  };
}

export interface UpdateNameRequest extends BaseMessage {
  type: 'updateName';
  data: {
    name: string;
  };
}

export type ClientMessage =
  | JoinRoomRequest
  | LeaveRoomRequest
  | GameActionRequest
  | UpdateNameRequest
  | GameMessage;

// ============================================================================
// Game State Types (generic, game-agnostic)
// ============================================================================

/**
 * Minimal shape that all game states share.
 * Individual games can extend this with their own fields without
 * modifying server-side unions.
 */
export interface BaseGameState {
  gameType: string;
  players: string[];
  // Extra per-game fields are allowed
  [key: string]: unknown;
}

/**
 * Minimal shape that all game actions share.
 * Individual games define their own action types that are structurally
 * compatible with this interface.
 */
export interface BaseGameAction {
  type: string;
  playerId: string;
  // Extra per-game fields are allowed
  [key: string]: unknown;
}

// Generic aliases used by the server/client protocol.
// New games should not need to touch these.
export type GameAction = BaseGameAction;
export type GameState = BaseGameState;

// ----------------------------------------------------------------------------
// Tic-Tac-Toe (example of a strongly-typed game built on the generic base)
// ----------------------------------------------------------------------------

export interface TicTacToeAction extends BaseGameAction {
  type: 'move' | 'restart';
  playerId: string;
  move?: {
    row: number;
    col: number;
  };
}

export interface TicTacToeState extends BaseGameState {
  gameType: 'tic-tac-toe';
  board: (string | null)[][];
  currentTurn: string;
  winner: string | null;
  gameOver: boolean;
}

// ----------------------------------------------------------------------------
// Rock-Paper-Scissors (example of another typed game)
// ----------------------------------------------------------------------------

export type Choice = 'rock' | 'paper' | 'scissors';

export interface RockPaperScissorsAction extends BaseGameAction {
  type: 'choice' | 'restart';
  playerId: string;
  choice?: Choice;
}

export interface RockPaperScissorsState extends BaseGameState {
  gameType: 'rock-paper-scissors';
  choices: Record<string, Choice | null>;
  scores: Record<string, number>;
  roundComplete: boolean;
  roundWinner: string | null;
}

// ============================================================================
// Game Engine Interface
// ============================================================================

export interface GameEngine<
  S extends GameState = GameState,
  A extends GameAction = GameAction,
> {
  /**
   * Initialize a new game state
   */
  init(players: string[]): S;

  /**
   * Validate if an action is legal
   */
  validateAction(state: S, action: A): { valid: boolean; error?: string };

  /**
   * Apply an action to the state (assumes action is valid)
   */
  applyAction(state: S, action: A): S;

  /**
   * Check if the game is over
   */
  isGameOver(state: S): boolean;

  /**
   * Get the winner (if game is over)
   */
  getWinner(state: S): string | null;
}

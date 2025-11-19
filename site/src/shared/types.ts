/**
 * Shared types between server and client (local copy for client build)
 * Single source of truth for WebSocket message protocol
 */

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
  | 'gameStateUpdate'
  | 'error';

export type ClientMessageType =
  | 'joinRoom'
  | 'leaveRoom'
  | 'message'
  | 'gameAction';

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
  };
}

export interface RoomsListMessage extends BaseMessage {
  type: 'roomsList';
  data: Array<{
    name: string;
    clients: string[];
  }>;
}

export interface JoinedRoomMessage extends BaseMessage {
  type: 'joinedRoom';
  data: {
    room: string;
    clients: string[];
  };
}

export interface NewClientMessage extends BaseMessage {
  type: 'newClient';
  data: {
    clientId: string;
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

export type ClientMessage =
  | JoinRoomRequest
  | LeaveRoomRequest
  | GameActionRequest
  | GameMessage;

// ============================================================================
// Game State Types
// ============================================================================

export type GameAction = TicTacToeAction | RockPaperScissorsAction;

export type GameState = TicTacToeState | RockPaperScissorsState;

// Tic-Tac-Toe
export interface TicTacToeAction {
  type: 'move' | 'restart';
  playerId: string;
  move?: {
    row: number;
    col: number;
  };
}

export interface TicTacToeState {
  gameType: 'tic-tac-toe';
  board: (string | null)[][];
  currentTurn: string;
  winner: string | null;
  gameOver: boolean;
  players: string[];
}

// Rock-Paper-Scissors
export type Choice = 'rock' | 'paper' | 'scissors';

export interface RockPaperScissorsAction {
  type: 'choice' | 'restart';
  playerId: string;
  choice?: Choice;
}

export interface RockPaperScissorsState {
  gameType: 'rock-paper-scissors';
  choices: Record<string, Choice | null>;
  scores: Record<string, number>;
  roundComplete: boolean;
  roundWinner: string | null;
  players: string[];
}

// ============================================================================
// Game Engine Interface
// ============================================================================

export interface GameEngine<S extends GameState, A extends GameAction> {
  init(players: string[]): S;
  validateAction(state: S, action: A): { valid: boolean; error?: string };
  applyAction(state: S, action: A): S;
}

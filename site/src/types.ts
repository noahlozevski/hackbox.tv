/**
 * Shared types for the hackbox.tv game framework
 */

// WebSocket message types from server
export type ServerMessageType =
  | 'connected'
  | 'roomsList'
  | 'joinedRoom'
  | 'newClient'
  | 'clientLeft'
  | 'message'
  | 'error';

// Client -> Server message types
export type ClientMessageType =
  | 'joinRoom'
  | 'leaveRoom'
  | 'message';

// Base message structure
export interface BaseMessage {
  type: ServerMessageType | ClientMessageType;
  data?: unknown;
}

// Specific message payloads
export interface ConnectedMessage extends BaseMessage {
  type: 'connected';
  data: {
    id: string; // Player UUID
  };
}

export interface RoomsListMessage extends BaseMessage {
  type: 'roomsList';
  data: {
    rooms: Array<{
      name: string;
      clients: string[]; // Array of player UUIDs in the room
    }>;
  };
}

export interface JoinedRoomMessage extends BaseMessage {
  type: 'joinedRoom';
  data: {
    room: string;
    clients: string[]; // Array of player UUIDs
  };
}

export interface NewClientMessage extends BaseMessage {
  type: 'newClient';
  data: {
    id: string; // New player UUID
  };
}

export interface ClientLeftMessage extends BaseMessage {
  type: 'clientLeft';
  data: {
    id: string; // Player UUID who left
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

export interface ErrorMessage extends BaseMessage {
  type: 'error';
  data: {
    error: string;
  };
}

// Union of all server messages
export type ServerMessage =
  | ConnectedMessage
  | RoomsListMessage
  | JoinedRoomMessage
  | NewClientMessage
  | ClientLeftMessage
  | GameMessage
  | ErrorMessage;

// Game state interface
export interface GameState {
  playerId: string | null;
  currentRoom: string | null;
}

// Game event callback types
export type PlayersChangedCallback = (players: string[]) => void;
export type MessageCallback = (playerId: string, event: string, payload: unknown) => void;

// Main game framework interface
export interface GameFramework {
  players: string[];
  currentGame: string | null;
  state: GameState;
  ws: WebSocket | null;

  // Callbacks
  handlePlayersChanged: PlayersChangedCallback | null;
  onMessage: MessageCallback | null;

  // Methods
  sendMessage: (event: string, payload: unknown) => void;
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

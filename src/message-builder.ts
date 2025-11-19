/**
 * Type-safe message builder utilities for server-side WebSocket communication
 * Eliminates duplication and ensures type safety across all server messages
 */

import type { Client } from './client';
import type { Room } from './room';
import type {
  ConnectedMessage,
  RoomsListMessage,
  JoinedRoomMessage,
  NewClientMessage,
  ClientLeftMessage,
  GameMessage,
  GameStateUpdateMessage,
  NameUpdatedMessage,
  ErrorMessage,
  GameState,
  RoomInfo,
} from '../shared/types';

/**
 * Send a message to a single client with type safety
 */
function sendToClient<T>(client: Client, message: T): void {
  client.ws.send(JSON.stringify(message));
}

/**
 * Broadcast a message to all clients in a room
 */
function broadcastToRoom<T>(
  room: Room,
  message: T,
  excludeClient?: Client,
): void {
  const serialized = JSON.stringify(message);
  room.clients.forEach((client) => {
    if (client !== excludeClient) {
      client.ws.send(serialized);
    }
  });
}

/**
 * Broadcast a message to all clients in a room, including the sender
 */
function broadcastToRoomIncludingSender<T>(room: Room, message: T): void {
  const serialized = JSON.stringify(message);
  room.clients.forEach((client) => {
    client.ws.send(serialized);
  });
}

// ============================================================================
// Server -> Client Message Builders
// ============================================================================

export function sendConnected(
  client: Client,
  clientId: string,
  name: string,
): void {
  const message: ConnectedMessage = {
    type: 'connected',
    data: { clientId, name },
  };
  sendToClient(client, message);
}

export function sendRoomsList(client: Client, rooms: RoomInfo[]): void {
  const message: RoomsListMessage = {
    type: 'roomsList',
    data: rooms,
  };
  sendToClient(client, message);
}

export function sendJoinedRoom(
  client: Client,
  roomName: string,
  clients: Array<{ id: string; name: string }>,
): void {
  const message: JoinedRoomMessage = {
    type: 'joinedRoom',
    data: {
      room: roomName,
      clients,
    },
  };
  sendToClient(client, message);
}

export function broadcastNewClient(
  room: Room,
  clientId: string,
  name: string,
  excludeClient?: Client,
): void {
  const message: NewClientMessage = {
    type: 'newClient',
    data: { clientId, name },
  };
  broadcastToRoom(room, message, excludeClient);
}

export function broadcastClientLeft(room: Room, clientId: string): void {
  const message: ClientLeftMessage = {
    type: 'clientLeft',
    data: { clientId },
  };
  broadcastToRoom(room, message);
}

export function broadcastChatMessage(
  room: Room,
  senderId: string,
  messageContent: string,
  excludeSender?: Client,
): void {
  const message: GameMessage = {
    type: 'message',
    data: {
      playerId: senderId,
      message: {
        event: 'chat',
        payload: messageContent,
      },
    },
  };
  broadcastToRoom(room, message, excludeSender);
}

export function broadcastGameMessage(
  room: Room,
  senderId: string,
  event: string,
  payload: unknown,
  excludeSender?: Client,
): void {
  const message: GameMessage = {
    type: 'message',
    data: {
      playerId: senderId,
      message: {
        event,
        payload,
      },
    },
  };
  broadcastToRoom(room, message, excludeSender);
}

export function broadcastGameStateUpdate(
  room: Room,
  gameType: string,
  state: GameState,
  validationError?: string,
): void {
  const message: GameStateUpdateMessage = {
    type: 'gameStateUpdate',
    data: {
      gameType,
      state,
      validationError,
    },
  };
  broadcastToRoomIncludingSender(room, message);
}

export function sendNameUpdated(
  client: Client,
  clientId: string,
  name: string,
): void {
  const message: NameUpdatedMessage = {
    type: 'nameUpdated',
    data: { clientId, name },
  };
  sendToClient(client, message);
}

export function broadcastNameUpdated(
  room: Room,
  clientId: string,
  name: string,
  excludeClient?: Client,
): void {
  const message: NameUpdatedMessage = {
    type: 'nameUpdated',
    data: { clientId, name },
  };
  broadcastToRoom(room, message, excludeClient);
}

export function sendError(client: Client, errorMessage: string): void {
  const message: ErrorMessage = {
    type: 'error',
    data: {
      error: errorMessage,
    },
  };
  sendToClient(client, message);
}

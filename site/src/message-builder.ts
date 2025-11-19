/**
 * Type-safe message builder utilities for client-side WebSocket communication
 * Eliminates duplication and ensures type safety across all client messages
 */

import type {
  JoinRoomRequest,
  GameActionRequest,
  GameMessage,
  UpdateNameRequest,
} from './shared/types.js';

/**
 * Send a message to the server with type safety
 */
function sendToServer<T>(ws: WebSocket | null, message: T): void {
  if (!ws) {
    console.error('WebSocket not connected');
    return;
  }
  ws.send(JSON.stringify(message));
}

// ============================================================================
// Client -> Server Message Builders
// ============================================================================

export function sendJoinRoom(ws: WebSocket | null, roomName: string): void {
  const message: JoinRoomRequest = {
    type: 'joinRoom',
    data: { roomName },
  };
  sendToServer(ws, message);
}

export function sendChatMessage(
  ws: WebSocket | null,
  messageContent: string,
): void {
  const message: GameMessage = {
    type: 'message',
    data: {
      playerId: '', // Will be set by server
      message: {
        event: 'chat',
        payload: messageContent,
      },
    },
  };
  sendToServer(ws, message);
}

export function sendGameMessage(
  ws: WebSocket | null,
  event: string,
  payload: unknown,
): void {
  const message: GameMessage = {
    type: 'message',
    data: {
      playerId: '', // Will be set by server
      message: {
        event,
        payload,
      },
    },
  };
  sendToServer(ws, message);
}

export function sendGameAction(
  ws: WebSocket | null,
  gameType: string,
  action: unknown,
): void {
  const message: GameActionRequest = {
    type: 'gameAction',
    data: {
      gameType,
      action: action as GameActionRequest['data']['action'],
    },
  };
  sendToServer(ws, message);
}

export function sendUpdateName(ws: WebSocket | null, name: string): void {
  const message: UpdateNameRequest = {
    type: 'updateName',
    data: { name },
  };
  sendToServer(ws, message);
}

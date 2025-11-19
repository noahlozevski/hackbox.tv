import type { JoinedRoomMessage } from './types';

export interface JoinedRoomDataLike {
  room?: string;
  roomName?: string;
  clients?: string[];
}

/**
 * Normalize joined-room payloads coming from the server.
 *
 * Supports both the current shape:
 *   { room: string; clients: string[] }
 * and an older shape:
 *   { roomName: string; clients?: string[] }
 */
export function normalizeJoinedRoomData(
  data: JoinedRoomDataLike,
): { room: string; clients: string[] } | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const room =
    (data.room && typeof data.room === 'string' && data.room) ||
    (data.roomName && typeof data.roomName === 'string' && data.roomName) ||
    null;

  if (!room) {
    return null;
  }

  const clients = Array.isArray(data.clients) ? data.clients : [];

  return { room, clients };
}

// Convenience overload for strongly-typed current payloads.
export function normalizeJoinedRoomMessage(message: JoinedRoomMessage): {
  room: string;
  clients: string[];
} {
  const normalized = normalizeJoinedRoomData(message.data);
  if (!normalized) {
    throw new Error('JoinedRoomMessage has invalid data payload');
  }
  return normalized;
}

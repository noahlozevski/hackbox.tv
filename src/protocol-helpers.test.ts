import { describe, it, expect } from 'vitest';
import {
  normalizeJoinedRoomData,
  normalizeJoinedRoomMessage,
} from '../shared/protocol-helpers';
import type { JoinedRoomMessage } from '../shared/types';

describe('normalizeJoinedRoomData', () => {
  it('handles current { room, clients } shape', () => {
    const data = { room: 'Room1', clients: ['a', 'b'] };
    const result = normalizeJoinedRoomData(data);

    expect(result).not.toBeNull();
    expect(result?.room).toBe('Room1');
    expect(result?.clients).toEqual(['a', 'b']);
  });

  it('handles legacy { roomName } shape and defaults clients to []', () => {
    const data = { roomName: 'Room2' };
    const result = normalizeJoinedRoomData(data);

    expect(result).not.toBeNull();
    expect(result?.room).toBe('Room2');
    expect(result?.clients).toEqual([]);
  });

  it('returns null for invalid payloads', () => {
    const result = normalizeJoinedRoomData({} as never);
    expect(result).toBeNull();
  });
});

describe('normalizeJoinedRoomMessage', () => {
  it('normalizes a valid JoinedRoomMessage', () => {
    const message: JoinedRoomMessage = {
      type: 'joinedRoom',
      data: {
        room: 'Room3',
        clients: ['c1'],
      },
    };

    const normalized = normalizeJoinedRoomMessage(message);
    expect(normalized.room).toBe('Room3');
    expect(normalized.clients).toEqual(['c1']);
  });
});

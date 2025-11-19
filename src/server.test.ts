import { describe, it, expect } from 'vitest';

describe('Server Message Protocol', () => {
  it('should create a connected message with clientId field', () => {
    const clientId = 'test-uuid-123';
    const message = {
      type: 'connected',
      data: {
        clientId: clientId,
      },
    };

    expect(message.type).toBe('connected');
    expect(message.data.clientId).toBe(clientId);
  });

  it('should create a roomsList message as direct array', () => {
    const roomsData = [
      { name: 'Room1', clients: ['client-1', 'client-2'] },
      { name: 'pixel-party', clients: [] },
    ];

    const message = {
      type: 'roomsList',
      data: roomsData,
    };

    expect(message.type).toBe('roomsList');
    expect(Array.isArray(message.data)).toBe(true);
    expect(message.data[0].name).toBe('Room1');
    expect(message.data[0].clients).toHaveLength(2);
  });

  it('should create a newClient message with clientId field', () => {
    const message = {
      type: 'newClient',
      data: {
        clientId: 'new-client-uuid',
      },
    };

    expect(message.type).toBe('newClient');
    expect(message.data.clientId).toBe('new-client-uuid');
  });

  it('should create a clientLeft message with clientId field', () => {
    const message = {
      type: 'clientLeft',
      data: {
        clientId: 'leaving-client-uuid',
      },
    };

    expect(message.type).toBe('clientLeft');
    expect(message.data.clientId).toBe('leaving-client-uuid');
  });

  it('should create a game message with playerId and event', () => {
    const message = {
      type: 'message',
      data: {
        playerId: 'player-uuid',
        message: {
          event: 'move',
          payload: { row: 1, col: 2 },
        },
      },
    };

    expect(message.type).toBe('message');
    expect(message.data.playerId).toBe('player-uuid');
    expect(message.data.message.event).toBe('move');
    expect(message.data.message.payload).toEqual({ row: 1, col: 2 });
  });

  it('should parse a JSON message without errors', () => {
    const jsonMessage = JSON.stringify({
      type: 'connected',
      data: { clientId: 'test-id' },
    });

    const parsed = JSON.parse(jsonMessage);
    expect(parsed.type).toBe('connected');
    expect(parsed.data.clientId).toBe('test-id');
  });
});

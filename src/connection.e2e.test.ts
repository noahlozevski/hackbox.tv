import WebSocket from 'ws';
import { describe, it, expect } from 'vitest';
import type { ServerMessage } from '../shared/types';

const WS_URL = process.env.HACKBOX_WS_URL ?? 'wss://hackbox.tv.lozev.ski/ws/';

function waitForMessage(
  ws: WebSocket,
  predicate: (msg: ServerMessage) => boolean,
  timeoutMs = 10_000,
): Promise<ServerMessage> {
  return new Promise<ServerMessage>((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.removeListener('message', onMessage);
      reject(new Error('Timed out waiting for matching message'));
    }, timeoutMs);

    const onMessage = (data: WebSocket.RawData) => {
      try {
        const parsed = JSON.parse(String(data)) as ServerMessage;
        if (predicate(parsed)) {
          clearTimeout(timer);
          ws.removeListener('message', onMessage);
          resolve(parsed);
        }
      } catch {
        // Ignore parse errors here; the main code path logs them.
      }
    };

    ws.on('message', onMessage);
  });
}

describe('Prod WebSocket connection E2E', () => {
  it('can reconnect and rejoin the same room', async () => {
    // First connection
    const ws1 = new WebSocket(WS_URL);

    await new Promise<void>((resolve, reject) => {
      ws1.once('open', () => resolve());
      ws1.once('error', (err) => reject(err));
    });

    // Wait for initial protocol messages
    const connected1 = await waitForMessage(ws1, (m) => m.type === 'connected');
    expect(connected1.type).toBe('connected');

    const roomsList1 = await waitForMessage(ws1, (m) => m.type === 'roomsList');
    expect(roomsList1.type).toBe('roomsList');

    const roomName = (roomsList1.data as Array<{ name: string }>)[1]?.name;
    expect(roomName).toBeDefined();

    // Join a room
    ws1.send(
      JSON.stringify({
        type: 'joinRoom',
        data: { roomName },
      }),
    );

    const joined1 = await waitForMessage(ws1, (m) => m.type === 'joinedRoom');
    expect(joined1.type).toBe('joinedRoom');

    ws1.close();

    // Second connection simulates a page refresh: new client id,
    // but it can rejoin the same room by name.
    const ws2 = new WebSocket(WS_URL);

    await new Promise<void>((resolve, reject) => {
      ws2.once('open', () => resolve());
      ws2.once('error', (err) => reject(err));
    });

    const connected2 = await waitForMessage(ws2, (m) => m.type === 'connected');
    expect(connected2.type).toBe('connected');

    ws2.send(
      JSON.stringify({
        type: 'joinRoom',
        data: { roomName },
      }),
    );

    const joined2 = await waitForMessage(ws2, (m) => m.type === 'joinedRoom');
    expect(joined2.type).toBe('joinedRoom');

    ws2.close();
  }, 30_000);
});

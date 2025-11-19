import WebSocket from 'ws';
import { describe, it, expect } from 'vitest';
import type { ServerMessage } from '../shared/types';

const WS_URL = process.env.HACKBOX_WS_URL ?? 'wss://hackbox.tv.lozev.ski/ws/';

const E2E_ENABLED = process.env.HACKBOX_E2E === '1';

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

/**
 * This test verifies that player count updates correctly when players join/leave a room.
 * It ensures the fix for the issue where the game list UI wasn't updating properly.
 */
describe.skipIf(!E2E_ENABLED)('Player count updates E2E', () => {
  it('correctly reports player count when players join and leave', async () => {
    const ws1 = new WebSocket(WS_URL);
    const ws2 = new WebSocket(WS_URL);

    // Wait for both connections to open
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        ws1.once('open', () => resolve());
        ws1.once('error', (err) => reject(err));
      }),
      new Promise<void>((resolve, reject) => {
        ws2.once('open', () => resolve());
        ws2.once('error', (err) => reject(err));
      }),
    ]);

    // Get client IDs
    const connected1 = (await waitForMessage(
      ws1,
      (m) => m.type === 'connected',
    )) as Extract<ServerMessage, { type: 'connected' }>;
    const player1Id = connected1.data.clientId;

    const connected2 = (await waitForMessage(
      ws2,
      (m) => m.type === 'connected',
    )) as Extract<ServerMessage, { type: 'connected' }>;
    const player2Id = connected2.data.clientId;

    // Get room name
    const roomsList1 = await waitForMessage(ws1, (m) => m.type === 'roomsList');
    const rooms = roomsList1.data as Array<{
      name: string;
      clients: Array<{ id: string; name: string }>;
    }>;
    const roomName = rooms[1]?.name ?? rooms[0]?.name;
    expect(roomName).toBeDefined();

    // Player 1 joins the room
    ws1.send(
      JSON.stringify({
        type: 'joinRoom',
        data: { roomName },
      }),
    );

    const joined1 = (await waitForMessage(
      ws1,
      (m) => m.type === 'joinedRoom',
    )) as Extract<ServerMessage, { type: 'joinedRoom' }>;

    expect(joined1.type).toBe('joinedRoom');

    // Verify the initial player list has 1 player
    const initialClients = joined1.data.clients as Array<{
      id: string;
      name: string;
    }>;
    expect(initialClients).toHaveLength(1);
    expect(initialClients[0].id).toBe(player1Id);

    // Player 2 joins the same room
    ws2.send(
      JSON.stringify({
        type: 'joinRoom',
        data: { roomName },
      }),
    );

    // Player 1 should receive a newClient message
    const newClientMsg = (await waitForMessage(
      ws1,
      (m) => m.type === 'newClient',
    )) as Extract<ServerMessage, { type: 'newClient' }>;

    expect(newClientMsg.data.clientId).toBe(player2Id);

    // Player 2 should receive joinedRoom with 2 players
    const joined2 = (await waitForMessage(
      ws2,
      (m) => m.type === 'joinedRoom',
    )) as Extract<ServerMessage, { type: 'joinedRoom' }>;

    const clientsAfterJoin = joined2.data.clients as Array<{
      id: string;
      name: string;
    }>;
    expect(clientsAfterJoin).toHaveLength(2);

    // Close player 2's connection
    ws2.close();

    // Player 1 should receive a clientLeft message
    const clientLeftMsg = await waitForMessage(
      ws1,
      (m) => m.type === 'clientLeft',
      5000,
    );

    expect(clientLeftMsg.type).toBe('clientLeft');
    expect(clientLeftMsg.data).toHaveProperty('clientId', player2Id);

    ws1.close();
  }, 30_000);
});

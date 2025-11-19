import WebSocket from 'ws';
import { describe, it, expect } from 'vitest';
import type {
  ServerMessage,
  GameStateUpdateMessage,
  TicTacToeAction,
} from '../shared/types';

const WS_URL =
  process.env.HACKBOX_WS_URL ?? 'wss://hackbox.tv.lozev.ski/ws/';

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
        // Ignore parse errors; the main code logs them.
      }
    };

    ws.on('message', onMessage);
  });
}

describe.skipIf(!E2E_ENABLED)('Tic-Tac-Toe E2E against prod', () => {
  it(
    'plays a full winning game over the WebSocket protocol',
    async () => {
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

      // First client gets connected + rooms list
      const connected1 = (await waitForMessage(
        ws1,
        (m) => m.type === 'connected',
      )) as Extract<ServerMessage, { type: 'connected' }>;
      const player1Id = connected1.data.clientId;

      const roomsList1 = await waitForMessage(
        ws1,
        (m) => m.type === 'roomsList',
      );
      const rooms = roomsList1.data as Array<{ name: string }>;
      const roomName = rooms[1]?.name ?? rooms[0]?.name;
      expect(roomName).toBeDefined();

      // Second client connects and gets its id
      const connected2 = (await waitForMessage(
        ws2,
        (m) => m.type === 'connected',
      )) as Extract<ServerMessage, { type: 'connected' }>;
      const player2Id = connected2.data.clientId;

      // Both join the same room
      const joinPayload = (name: string) =>
        JSON.stringify({ type: 'joinRoom', data: { roomName: name } });

      ws1.send(joinPayload(roomName!));
      ws2.send(joinPayload(roomName!));

      await waitForMessage(ws1, (m) => m.type === 'joinedRoom');
      await waitForMessage(ws2, (m) => m.type === 'joinedRoom');

      // Start a tic-tac-toe game with a restart action from player1
      const restartAction: TicTacToeAction = {
        type: 'restart',
        playerId: player1Id,
      };

      ws1.send(
        JSON.stringify({
          type: 'gameAction',
          data: { gameType: 'tic-tac-toe', action: restartAction },
        }),
      );

      // Consume the initial gameStateUpdate after restart
      await waitForMessage(
        ws1,
        (m) => m.type === 'gameStateUpdate' && m.data.gameType === 'tic-tac-toe',
      );

      // Sequence of moves: player1 wins on the top row
      const moves: TicTacToeAction[] = [
        { type: 'move', playerId: player1Id, move: { row: 0, col: 0 } },
        { type: 'move', playerId: player2Id, move: { row: 1, col: 0 } },
        { type: 'move', playerId: player1Id, move: { row: 0, col: 1 } },
        { type: 'move', playerId: player2Id, move: { row: 1, col: 1 } },
        { type: 'move', playerId: player1Id, move: { row: 0, col: 2 } },
      ];

      let finalState: GameStateUpdateMessage['data'] | null = null;

      for (const action of moves) {
        const sender = action.playerId === player1Id ? ws1 : ws2;
        sender.send(
          JSON.stringify({
            type: 'gameAction',
            data: { gameType: 'tic-tac-toe', action },
          }),
        );

        const update = (await waitForMessage(
          ws1,
          (m) => m.type === 'gameStateUpdate' && m.data.gameType === 'tic-tac-toe',
        )) as GameStateUpdateMessage;

        finalState = update.data;
      }

      expect(finalState).not.toBeNull();
      expect(finalState?.state.gameOver).toBe(true);
      expect(finalState?.state.winner).toBe(player1Id);

      ws1.close();
      ws2.close();
    },
    30_000,
  );
});

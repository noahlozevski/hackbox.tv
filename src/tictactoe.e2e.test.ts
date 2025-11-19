import WebSocket from 'ws';
import { describe, it, expect } from 'vitest';
import type {
  ServerMessage,
  GameStateUpdateMessage,
  TicTacToeAction,
  TicTacToeState,
} from '../shared/types';

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
        // Ignore parse errors; the main code logs them.
      }
    };

    ws.on('message', onMessage);
  });
}

// NOTE: Currently skipped because the production server does not yet
// support `gameAction` for tic-tac-toe. Once deployed, change to `describe`.
describe.skip('Tic-Tac-Toe E2E against prod', () => {
  it('initializes tic-tac-toe and applies a valid move', async () => {
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

    const roomsList1 = await waitForMessage(ws1, (m) => m.type === 'roomsList');
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
    const initialUpdate = (await waitForMessage(
      ws1,
      (m) => m.type === 'gameStateUpdate' && m.data.gameType === 'tic-tac-toe',
    )) as GameStateUpdateMessage;

    const initialState = initialUpdate.data.state as TicTacToeState;

    // Choose whichever player id the server considers the current turn
    const currentPlayerId = initialState.currentTurn;
    expect([player1Id, player2Id]).toContain(currentPlayerId);

    // Apply a single valid move for the current player
    const moveAction: TicTacToeAction = {
      type: 'move',
      playerId: currentPlayerId,
      move: { row: 0, col: 0 },
    };

    const moveSender = currentPlayerId === player1Id ? ws1 : ws2;
    moveSender.send(
      JSON.stringify({
        type: 'gameAction',
        data: { gameType: 'tic-tac-toe', action: moveAction },
      }),
    );

    const moveUpdate = (await waitForMessage(
      ws1,
      (m) => m.type === 'gameStateUpdate' && m.data.gameType === 'tic-tac-toe',
    )) as GameStateUpdateMessage;

    const movedState = moveUpdate.data.state as TicTacToeState;
    expect(movedState.board[0][0]).toBe(currentPlayerId);

    ws1.close();
    ws2.close();
  }, 30_000);
});

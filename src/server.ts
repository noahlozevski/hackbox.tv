import * as http from 'http';
import WebSocket, { Server as WebSocketServer } from 'ws';
import { Room } from './room';
import { Client } from './client';
import { WS } from './types';
import { GameManager } from './game-manager';
import type {
  ClientMessage,
  GameAction,
  JoinRoomRequest,
  GameActionRequest,
  UpdateNameRequest,
} from '../shared/types';
import * as MessageBuilder from './message-builder';
import { buildSharePageHtml } from './share-page';

// Server setup
const PORT = 3000;
const HOST = '0.0.0.0';
const wss = new WebSocketServer({ port: PORT, host: HOST });
console.log(`WebSocket server is running on ws://${HOST}:${PORT}`);

// Lightweight HTTP share page server for social previews
const SHARE_PORT = 3001;
const PUBLIC_ORIGIN =
  process.env.HACKBOX_PUBLIC_ORIGIN ?? 'https://hackbox.tv.lozev.ski';

const shareServer = http.createServer((req, res) => {
  if (!req.url) {
    res.statusCode = 400;
    res.end('Bad Request');
    return;
  }

  const url = new URL(req.url, PUBLIC_ORIGIN);
  const segments = url.pathname.split('/').filter(Boolean);

  if (segments[0] !== 'share') {
    res.statusCode = 404;
    res.end('Not Found');
    return;
  }

  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET');
    res.end('Method Not Allowed');
    return;
  }

  const roomSegment = segments[1] ?? '';
  const gameSegment = segments[2] ?? null;

  if (!roomSegment) {
    res.statusCode = 400;
    res.end('Missing room');
    return;
  }

  const roomName = decodeURIComponent(roomSegment);
  const gameId = gameSegment ? decodeURIComponent(gameSegment) : null;

  const html = buildSharePageHtml({
    origin: PUBLIC_ORIGIN,
    roomName,
    gameId,
    // Optional: include inviter name when present in the URL
    playerName: url.searchParams.get('name') ?? undefined,
  });

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(html);
});

shareServer.listen(SHARE_PORT, HOST, () => {
  console.log(
    `Share page server is running on http://${HOST}:${SHARE_PORT}/share/{room}/{game?}`,
  );
});

const rooms: Map<string, Room> = new Map();
const clients: Map<WS, Client> = new Map();
const gameManager = new GameManager();

// Default rooms with fun, URL-safe names
const DEFAULT_ROOMS = [
  'pixel-party',
  'latency-lounge',
  'chaos-corner',
  'debug-disco',
  'infinite-lobby',
];

for (const roomName of DEFAULT_ROOMS) {
  rooms.set(roomName, new Room(roomName));
}

function getOrCreateRoom(roomName: string): Room | null {
  const sanitized = roomName.trim();
  if (!sanitized || sanitized.length > 32) {
    return null;
  }
  const safeName = sanitized.replace(/[^\w-]/g, '');
  if (!safeName) return null;

  let room = rooms.get(safeName);
  if (!room) {
    room = new Room(safeName);
    rooms.set(safeName, room);
    console.log(`Created new room: ${safeName}`);
  }
  return room;
}

// Handle new client connections
wss.on('connection', (websocket: WebSocket) => {
  const ws = websocket as WS;
  ws.isAlive = false;

  const client = new Client(ws);
  clients.set(ws, client);
  MessageBuilder.sendConnected(client, client.id, client.name);
  console.log(`New client connected: ${client.id} (${client.name})`);

  // Send available rooms to the client
  sendAvailableRooms(client);

  ws.on('message', (message: string) => {
    handleMessage(client, message);
  });

  ws.on('close', () => {
    handleDisconnect(client);
  });

  ws.on('error', (error: Error) => {
    console.error(`WebSocket error for client ${client.id}: ${error}`);
  });
});

// Send updated room list info every 2 seconds to those connected
setInterval(() => {
  clients.forEach((client) => {
    sendAvailableRooms(client);
  });
}, 2_000);

// Heartbeat mechanism to detect stale clients
setInterval(() => {
  wss.clients.forEach((ws) => {
    const websocket = ws as WS;
    if (!websocket.isAlive) {
      const client = clients.get(websocket);
      console.log(`Terminating stale client: ${client?.id}`);
      websocket.terminate();
      clients.delete(websocket);
      if (client && client.room) {
        client.room.removeClient(client);
      }
    } else {
      websocket.isAlive = false;
      websocket.ping();
    }
  });
}, 30_000); // Ping every 30 seconds

function sendAvailableRooms(client: Client) {
  const roomsInfo = Array.from(rooms.values()).map((room) => ({
    name: room.name,
    clients: room.getClientList(),
    activeGame: room.activeGame,
    gameState: room.gameState,
    gameTimeout: room.gameTimeout,
  }));

  MessageBuilder.sendRoomsList(client, roomsInfo);
}

function isJoinRoomMessage(message: ClientMessage): message is JoinRoomRequest {
  return (
    message.type === 'joinRoom' && typeof message.data?.roomName === 'string'
  );
}

function isGameActionMessage(
  message: ClientMessage,
): message is GameActionRequest {
  return (
    message.type === 'gameAction' &&
    typeof message.data?.gameType === 'string' &&
    typeof message.data?.action === 'object' &&
    message.data.action !== null
  );
}

function isUpdateNameMessage(
  message: ClientMessage,
): message is UpdateNameRequest {
  return (
    message.type === 'updateName' && typeof message.data?.name === 'string'
  );
}

function handleMessage(client: Client, message: string) {
  try {
    const parsed = JSON.parse(message) as Partial<ClientMessage> & {
      data?: unknown;
    };

    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof parsed.type !== 'string'
    ) {
      MessageBuilder.sendError(client, 'Invalid message format');
      return;
    }

    switch (parsed.type) {
      case 'joinRoom': {
        if (!parsed.data || !isJoinRoomMessage(parsed as ClientMessage)) {
          MessageBuilder.sendError(client, 'Invalid joinRoom payload');
          return;
        }
        const data = parsed.data as JoinRoomRequest['data'];
        handleJoinRoom(client, data.roomName);
        break;
      }
      case 'message': {
        const data = parsed.data as
          | { message?: { event: string; payload: unknown } }
          | undefined;
        if (!data || !data.message || typeof data.message.event !== 'string') {
          MessageBuilder.sendError(client, 'Invalid message payload');
          return;
        }
        handleClientMessage(client, data.message.event, data.message.payload);
        break;
      }
      case 'gameAction': {
        if (!parsed.data || !isGameActionMessage(parsed as ClientMessage)) {
          MessageBuilder.sendError(client, 'Invalid gameAction payload');
          return;
        }
        handleGameAction(client, parsed.data as GameActionRequest['data']);
        break;
      }
      case 'updateName': {
        if (!parsed.data || !isUpdateNameMessage(parsed as ClientMessage)) {
          MessageBuilder.sendError(client, 'Invalid updateName payload');
          return;
        }
        handleUpdateName(client, parsed.data.name);
        break;
      }
      default:
        console.error(
          `Unknown message type from client ${client.id}:`,
          JSON.stringify(parsed, null, 2),
        );
        MessageBuilder.sendError(client, 'Unknown message type');
    }
  } catch (error) {
    console.error(`Error handling message from client ${client.id}: ${error}`);
    MessageBuilder.sendError(client, 'Invalid message format');
  }
}

function handleJoinRoom(client: Client, roomName: string) {
  const room = getOrCreateRoom(roomName);
  if (!room) {
    MessageBuilder.sendError(client, 'Room does not exist');
    return;
  }

  // Remove client from the previous room
  client.room?.removeClient(client);
  room.addClient(client);
  console.log(`Client ${client.id} joined room ${room.name}`);

  // Notify the client
  MessageBuilder.sendJoinedRoom(client, room.name, room.getClientList());

  // Notify other clients in the room
  MessageBuilder.broadcastNewClient(room, client.id, client.name, client);

  // Send updated room info to the client
  sendAvailableRooms(client);
}

// Handle messages sent by the client
function handleClientMessage(client: Client, event: string, payload: unknown) {
  if (!client.room) {
    MessageBuilder.sendError(client, 'You are not in a room');
    return;
  }

  // Handle game lifecycle events
  if (event === 'startGame') {
    const gameId = payload as string;
    client.room.activeGame = gameId;
    // Clear any existing timeout when starting a game
    client.room.clearGameState();
    client.room.activeGame = gameId; // Restore activeGame after clear
    console.log(`Game "${gameId}" started in room ${client.room.name}`);
  } else if (event === 'stopGame') {
    const gameId = payload as string;
    if (client.room.activeGame === gameId) {
      // Set a timeout to clear state after 30 minutes of inactivity
      client.room.setGameTimeout(
        () => {
          console.log(`Game timeout reached for room ${client.room?.name}`);
          client.room?.clearGameState();
        },
        30 * 60 * 1000,
      ); // 30 minutes

      client.room.activeGame = null;
      console.log(
        `Game "${gameId}" stopped in room ${client.room.name}, state will be cleared in 30 minutes`,
      );
    }
  } else if (event === 'saveGameState') {
    // Client is saving game state (happens during stop)
    const data = payload as { gameId: string; state: unknown };
    // Only save if we recently had this game active or still have it active
    if (client.room.activeGame === data.gameId || client.room.gameState) {
      client.room.gameState = data.state;
      console.log(
        `Game state saved for "${data.gameId}" in room ${client.room.name}`,
      );
    }
  } else if (event === 'clearGameState') {
    // Client is exiting game completely - clear all state immediately
    const gameId = payload as string;
    if (client.room.activeGame === gameId || client.room.gameState) {
      client.room.clearGameState();
      console.log(
        `Game state cleared for "${gameId}" in room ${client.room.name}`,
      );
    }
  }

  // Broadcast the message to all clients in the room (including sender)
  MessageBuilder.broadcastGameMessage(client.room, client.id, event, payload);
}

// Handle client disconnection
function handleDisconnect(client: Client) {
  console.log(`Client disconnected: ${client.id}`);
  clients.delete(client.ws);
  const room = client.room;
  if (room) {
    room.removeClient(client);
  }
}

// Handle name updates
function handleUpdateName(client: Client, name: string) {
  const trimmedName = name.trim();
  const defaultName = `Player ${client.id.slice(0, 4)}`;

  let nextName: string;
  if (!trimmedName) {
    // Empty input "unsets" the custom name and resets to the default label.
    nextName = defaultName;
  } else {
    if (trimmedName.length > 20) {
      MessageBuilder.sendError(client, 'Name must be 1-20 characters');
      return;
    }
    nextName = trimmedName;
  }

  console.log(
    `Client ${client.id} changed name from "${client.name}" to "${nextName}"`,
  );
  client.name = nextName;

  // Notify the client that the name was updated
  MessageBuilder.sendNameUpdated(client, client.id, client.name);

  // If client is in a room, notify other clients in the room
  if (client.room) {
    MessageBuilder.broadcastNameUpdated(
      client.room,
      client.id,
      client.name,
      client,
    );
  }
}

// Handle game actions (server-authoritative)
function handleGameAction(
  client: Client,
  data: { gameType: string; action: GameAction },
) {
  if (!client.room) {
    MessageBuilder.sendError(client, 'You must be in a room to play');
    return;
  }

  const { gameType, action } = data;

  // Initialize game if not started
  if (!gameManager.hasActiveGame(client.room.name)) {
    const clientList = client.room.getClientList();
    if (clientList.length < 2) {
      MessageBuilder.sendError(client, 'Need at least 2 players to start');
      return;
    }
    const playerIds = clientList.map((c) => c.id);
    gameManager.startGame(client.room.name, gameType, playerIds);
  }

  // Process action
  const result = gameManager.processAction(client.room.name, action);

  // Broadcast updated state to all players in the room
  MessageBuilder.broadcastGameStateUpdate(
    client.room,
    gameType,
    result.state,
    result.error,
  );
}

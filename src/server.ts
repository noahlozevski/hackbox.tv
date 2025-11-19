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
} from '../shared/types';
import * as MessageBuilder from './message-builder';

// Server setup
const PORT = 3000;
const HOST = '0.0.0.0';
const wss = new WebSocketServer({ port: PORT, host: HOST });
console.log(`WebSocket server is running on ws://${HOST}:${PORT}`);

const rooms: Map<string, Room> = new Map();
const clients: Map<WS, Client> = new Map();
const gameManager = new GameManager();

// Hardcoded list of rooms
const roomNames = ['Room1', 'Room2', 'Room3'];
roomNames.forEach((roomName) => {
  rooms.set(roomName, new Room(roomName));
});

// Handle new client connections
wss.on('connection', (websocket: WebSocket) => {
  const ws = websocket as WS;
  ws.isAlive = false;

  const client = new Client(ws);
  clients.set(ws, client);
  MessageBuilder.sendConnected(client, client.id);
  console.log(`New client connected: ${client.id}`);

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
  }));

  MessageBuilder.sendRoomsList(client, roomsInfo);
}

function isJoinRoomMessage(
  message: ClientMessage,
): message is JoinRoomRequest {
  return message.type === 'joinRoom' && typeof message.data?.roomName === 'string';
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

function handleMessage(client: Client, message: string) {
  try {
    const parsed = JSON.parse(message) as Partial<ClientMessage>;

    if (!parsed || typeof parsed !== 'object' || typeof parsed.type !== 'string') {
      MessageBuilder.sendError(client, 'Invalid message format');
      return;
    }

    switch (parsed.type) {
      case 'joinRoom': {
        if (!isJoinRoomMessage(parsed as ClientMessage)) {
          MessageBuilder.sendError(client, 'Invalid joinRoom payload');
          return;
        }
        handleJoinRoom(client, parsed.data.roomName);
        break;
      }
      case 'message': {
        if (!parsed.data || typeof (parsed.data as { message?: unknown }).message !== 'string') {
          MessageBuilder.sendError(client, 'Invalid message payload');
          return;
        }
        const { message: messageContent } = parsed
          .data as { message: string };
        handleClientMessage(client, messageContent);
        break;
      }
      case 'gameAction': {
        if (!isGameActionMessage(parsed as ClientMessage)) {
          MessageBuilder.sendError(client, 'Invalid gameAction payload');
          return;
        }
        handleGameAction(client, parsed.data);
        break;
      }
      default:
        MessageBuilder.sendError(client, 'Unknown message type');
    }
  } catch (error) {
    console.error(`Error handling message from client ${client.id}: ${error}`);
    MessageBuilder.sendError(client, 'Invalid message format');
  }
}

function handleJoinRoom(client: Client, roomName: string) {
  const room = rooms.get(roomName);
  if (room) {
    // Remove client from the previous room
    client.room?.removeClient(client);
    room.addClient(client);
    console.log(`Client ${client.id} joined room ${room.name}`);

    // Notify the client
    MessageBuilder.sendJoinedRoom(client, room.name, room.getClientList());

    // Notify other clients in the room
    MessageBuilder.broadcastNewClient(room, client.id, client);

    // Send updated room info to the client
    sendAvailableRooms(client);
  } else {
    MessageBuilder.sendError(client, 'Room does not exist');
  }
}

// Handle messages sent by the client
function handleClientMessage(client: Client, messageContent: string) {
  if (client.room) {
    // Broadcast the message to other clients in the room
    MessageBuilder.broadcastChatMessage(
      client.room,
      client.id,
      messageContent,
      client,
    );
  } else {
    MessageBuilder.sendError(client, 'You are not in a room');
  }
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
    const players = client.room.getClientList();
    if (players.length < 2) {
      MessageBuilder.sendError(client, 'Need at least 2 players to start');
      return;
    }
    gameManager.startGame(client.room.name, gameType, players);
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

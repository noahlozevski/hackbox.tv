import WebSocket, { Server as WebSocketServer } from 'ws';
import { Room } from './room';
import { Client } from './client';
import { WS } from './types';
import { GameManager } from './game-manager';
import type { GameAction } from '../shared/types';

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
  ws.send(
    JSON.stringify({
      type: 'connected',
      data: {
        clientId: client.id,
      },
    }),
  );
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

  const message = JSON.stringify({
    type: 'roomsList',
    data: roomsInfo,
  });

  client.ws.send(message);
}

function handleMessage(client: Client, message: string) {
  try {
    const parsedMessage = JSON.parse(message);
    switch (parsedMessage.type) {
      case 'joinRoom':
        handleJoinRoom(client, parsedMessage.data.roomName);
        break;
      case 'message':
        handleClientMessage(client, parsedMessage.data.message);
        break;
      case 'gameAction':
        handleGameAction(client, parsedMessage.data);
        break;
      default:
        sendError(client, 'Unknown message type');
    }
  } catch (error) {
    console.error(`Error handling message from client ${client.id}: ${error}`);
    sendError(client, 'Invalid message format');
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
    client.ws.send(
      JSON.stringify({
        type: 'joinedRoom',
        data: {
          room: room.name,
          clients: room.getClientList(),
        },
      }),
    );

    // Notify other clients in the room
    broadcastToRoom(
      room,
      JSON.stringify({
        type: 'newClient',
        data: {
          clientId: client.id,
        },
      }),
      client,
    );

    // Send updated room info to the client
    sendAvailableRooms(client);
  } else {
    sendError(client, 'Room does not exist');
  }
}

// Handle messages sent by the client
function handleClientMessage(client: Client, messageContent: string) {
  if (client.room) {
    // Broadcast the message to other clients in the room
    broadcastToRoom(
      client.room,
      JSON.stringify({
        type: 'message',
        data: {
          clientId: client.id,
          message: messageContent,
        },
      }),
      client,
    );
  } else {
    sendError(client, 'You are not in a room');
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

// Broadcast a message to all clients in a room
function broadcastToRoom(room: Room, message: string, sender?: Client) {
  room.clients.forEach((client) => {
    if (client !== sender) {
      client.ws.send(message);
    }
  });
}

// Handle game actions (server-authoritative)
function handleGameAction(
  client: Client,
  data: { gameType: string; action: GameAction },
) {
  if (!client.room) {
    sendError(client, 'You must be in a room to play');
    return;
  }

  const { gameType, action } = data;

  // Initialize game if not started
  if (!gameManager.hasActiveGame(client.room.name)) {
    const players = client.room.getClientList();
    if (players.length < 2) {
      sendError(client, 'Need at least 2 players to start');
      return;
    }
    gameManager.startGame(client.room.name, gameType, players);
  }

  // Process action
  const result = gameManager.processAction(client.room.name, action);

  // Broadcast updated state to all players in the room
  const stateUpdate = JSON.stringify({
    type: 'gameStateUpdate',
    data: {
      gameType,
      state: result.state,
      validationError: result.error,
    },
  });

  // Send to all clients in room (including sender)
  client.room.clients.forEach((roomClient) => {
    roomClient.ws.send(stateUpdate);
  });
}

// Send an error message to the client
function sendError(client: Client, errorMessage: string) {
  client.ws.send(
    JSON.stringify({
      type: 'error',
      data: {
        message: errorMessage,
      },
    }),
  );
}

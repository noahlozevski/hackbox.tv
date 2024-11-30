import WebSocket, { Server as WebSocketServer } from 'ws';
import { Room } from './room';
import { Client } from './client';
import { WS } from './types';

// Server setup
const PORT = 3000;
const wss = new WebSocketServer({ port: PORT });
console.log(`WebSocket server is running on ws://localhost:${PORT}`);

const rooms: Map<string, Room> = new Map();
const clients: Map<WS, Client> = new Map();

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
        notifyRoomClientLeft(client.room, client.id);
      }
    } else {
      websocket.isAlive = false;
      websocket.ping();
    }
  });
}, 30000); // Ping every 30 seconds

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
    if (client.room) {
      throw new Error(
        'You are already in a room. You must leave the first one to join the another one',
      );
      // // Remove client from the previous room
      // client.room.removeClient(client);
      // notifyRoomClientLeft(client.room, client.id);
    }
    room.addClient(client);
    console.log(`Client ${client.id} joined room ${room.name}`);

    // Notify the client
    client.ws.send(
      JSON.stringify({
        type: 'joinedRoom',
        data: {
          roomName: room.name,
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
  if (client.room) {
    client.room.removeClient(client);
    notifyRoomClientLeft(client.room, client.id);
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

// Notify room clients that a client has left
function notifyRoomClientLeft(room: Room, clientId: string) {
  broadcastToRoom(
    room,
    JSON.stringify({
      type: 'clientLeft',
      data: {
        clientId: clientId,
      },
    }),
  );
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

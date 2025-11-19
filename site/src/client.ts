import type { GameFramework, GameRegistry, ServerMessage } from './types.js';
import * as MessageBuilder from './message-builder.js';

declare global {
  interface Window {
    game: GameFramework;
    games: GameRegistry;
  }
}

const game: GameFramework = {
  players: [],
  currentGame: null,
  state: {
    playerId: null,
    currentRoom: null,
  },
  ws: null,
  handlePlayersChanged: null,
  onMessage: null,
  onGameStateUpdate: null,

  sendMessage(event: string, payload: unknown): void {
    MessageBuilder.sendGameMessage(this.ws, event, payload);
  },

  sendGameAction(gameType: string, action: unknown): void {
    MessageBuilder.sendGameAction(this.ws, gameType, action);
  },
};

// Default handlers
game.handlePlayersChanged = function (players: string[]): void {
  console.log('Players changed: ', players);
  game.players = players;

  for (const [gameName, { canPlay }] of Object.entries(window.games)) {
    if (!canPlay()) {
      console.log('Cannot play game:', gameName);
      // Future: Auto-stop games when player count is insufficient
    }
  }
};

game.onMessage = function (
  player: string,
  event: string,
  payload: unknown,
): void {
  console.log(`Received event [${event}] from player ${player}:`, payload);
};

window.game = game;

const ws = new WebSocket('wss://hackbox.tv.lozev.ski/ws/');
game.ws = ws;

ws.addEventListener('open', function () {
  console.log('Connected to WebSocket server.');
});

ws.addEventListener('message', function (event) {
  console.log('Message from server:', event.data);
  handleServerMessage(event.data);
});

ws.addEventListener('close', function () {
  console.log('WebSocket connection closed.');
});

ws.addEventListener('error', function (event) {
  console.error('WebSocket error:', event);
});

function handleServerMessage(data: string): void {
  try {
    const message = JSON.parse(data) as ServerMessage;
    switch (message.type) {
      case 'connected':
        console.log(
          'Connected to server with client ID:',
          message.data.clientId,
        );
        game.state.playerId = message.data.clientId;
        break;
      case 'roomsList':
        // message.data is Array<{ name: string; clients: string[] }>
        handleRoomsList(message.data);
        // Update the client list if we are in a room
        if (game.state.currentRoom) {
          const room = message.data.find(
            (room: { name: string; clients: string[] }) =>
              room.name === game.state.currentRoom,
          );
          if (room && game.handlePlayersChanged) {
            game.handlePlayersChanged(room.clients.sort());
          }
        }
        break;
      case 'joinedRoom':
        handleJoinedRoom(message.data.room, message.data.clients);
        break;
      case 'newClient':
        handleNewClient(message.data.clientId);
        if (game.handlePlayersChanged) {
          game.handlePlayersChanged(
            [...game.players, message.data.clientId].sort(),
          );
        }
        break;
      case 'clientLeft':
        handleClientLeft(message.data.clientId);
        if (game.handlePlayersChanged) {
          game.handlePlayersChanged(
            game.players
              .filter((player) => player !== message.data.clientId)
              .sort(),
          );
        }
        break;
      case 'message': {
        const clientId = message.data.playerId;
        const event = message.data.message.event;
        const payload = message.data.message.payload;
        if (game.onMessage) {
          game.onMessage(clientId, event, payload);
        }
        if (event === 'chat') {
          handleChatMessage(clientId, payload as string);
        }
        break;
      }
      case 'gameStateUpdate':
        if (game.onGameStateUpdate) {
          game.onGameStateUpdate(message.data);
        }
        break;
      case 'error':
        handleError(message.data.error);
        break;
      default:
        console.warn(
          'Unknown message type:',
          (message as { type: string }).type,
        );
    }
  } catch (error) {
    console.error('Error parsing message from server:', error);
  }
}

function handleRoomsList(
  rooms: Array<{ name: string; clients: string[] }>,
): void {
  const roomList = document.getElementById('roomList');
  if (!roomList) return;

  roomList.innerHTML = '';
  rooms.forEach(function (room) {
    const li = document.createElement('li');
    li.textContent = room.name;
    li.dataset.roomCount = String(room.clients.length);
    li.addEventListener('click', function () {
      joinRoom(room.name);
    });
    roomList.appendChild(li);
  });
}

function joinRoom(roomName: string): void {
  MessageBuilder.sendJoinRoom(ws, roomName);
}

function handleJoinedRoom(roomName: string, clients: string[]): void {
  game.state.currentRoom = roomName;
  const roomNameEl = document.getElementById('roomName');
  if (roomNameEl) {
    roomNameEl.textContent = 'Room: ' + roomName;
  }

  const messageInput = document.getElementById(
    'messageInput',
  ) as HTMLInputElement;
  const sendButton = document.getElementById('sendButton') as HTMLButtonElement;
  if (messageInput) messageInput.disabled = false;
  if (sendButton) sendButton.disabled = false;

  const messages = document.getElementById('messages');
  const clientList = document.getElementById('clientList');
  if (messages) messages.innerHTML = '';
  if (clientList) clientList.innerHTML = '';

  updateClientList(clients);
}

function handleNewClient(clientId: string): void {
  addClientToList(clientId);
  addSystemMessage('Client ' + clientId + ' has joined the room.');
}

function handleClientLeft(clientId: string): void {
  removeClientFromList(clientId);
  addSystemMessage('Client ' + clientId + ' has left the room.');
}

function handleChatMessage(clientId: string, message: string): void {
  addChatMessage(clientId, message);
}

function handleError(message: string): void {
  alert('Error: ' + message);
}

function addClientToList(clientId: string): void {
  const clientList = document.getElementById('clientList');
  if (!clientList) return;

  const li = document.createElement('li');
  li.textContent = clientId;
  li.id = 'client-' + clientId;
  clientList.appendChild(li);
}

function removeClientFromList(clientId: string): void {
  const clientLi = document.getElementById('client-' + clientId);
  if (clientLi && clientLi.parentNode) {
    clientLi.parentNode.removeChild(clientLi);
  }
}

function updateClientList(clients: string[]): void {
  const clientList = document.getElementById('clientList');
  if (!clientList) return;

  clientList.innerHTML = '';
  clients.forEach(function (clientId) {
    addClientToList(clientId);
  });
}

function addChatMessage(clientId: string, message: string): void {
  const messagesDiv = document.getElementById('messages');
  if (!messagesDiv) return;

  const messageElement = document.createElement('div');
  messageElement.innerHTML = '<strong>' + clientId + ':</strong> ' + message;
  messagesDiv.appendChild(messageElement);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function addSystemMessage(message: string): void {
  const messagesDiv = document.getElementById('messages');
  if (!messagesDiv) return;

  const messageElement = document.createElement('div');
  messageElement.style.fontStyle = 'italic';
  messageElement.textContent = message;
  messagesDiv.appendChild(messageElement);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Chat UI handlers
const messageInput = document.getElementById(
  'messageInput',
) as HTMLInputElement;
const sendButton = document.getElementById('sendButton') as HTMLButtonElement;

if (sendButton) {
  sendButton.addEventListener('click', () => {
    const message = messageInput?.value.trim();
    if (!message) {
      return;
    }
    game.sendMessage('chat', message);
    addChatMessage('You', message);
    if (messageInput) messageInput.value = '';
  });
}

if (messageInput) {
  messageInput.addEventListener('keyup', function (event) {
    if (event.key === 'Enter') {
      const message = messageInput.value.trim();
      if (!message) {
        return;
      }
      game.sendMessage('chat', message);
      addChatMessage('You', message);
      messageInput.value = '';
    }
  });
}

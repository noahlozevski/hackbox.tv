import type {
  GameFramework,
  GameRegistry,
  ServerMessage,
  Game,
} from './types.js';
import * as MessageBuilder from './message-builder.js';
import { ConnectionManager } from './connection-manager.js';
import { normalizeJoinedRoomData } from './shared/protocol-helpers.js';

declare global {
  interface Window {
    game: GameFramework;
    games: GameRegistry;
    startGame: (gameId: string) => void;
    // Optional global QRCode constructor injected by the page
    QRCode?: new (
      element: HTMLElement,
      options: { text: string; width: number; height: number },
    ) => unknown;
  }
}

const connection = new ConnectionManager();

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

  subscribeToMessages(listener) {
    const previous = this.onMessage;
    this.onMessage = (player, event, payload) => {
      if (previous) previous(player, event, payload);
      listener(player, event, payload);
    };

    return () => {
      this.onMessage = previous ?? null;
    };
  },

  subscribeToGameState(listener) {
    const previous = this.onGameStateUpdate;
    this.onGameStateUpdate = (state) => {
      if (previous) previous(state);
      listener(state);
    };

    return () => {
      this.onGameStateUpdate = previous ?? null;
    };
  },

  sendMessage(event: string, payload: unknown): void {
    MessageBuilder.sendGameMessage(this.ws, event, payload);
  },

  sendGameAction(gameType: string, action: unknown): void {
    MessageBuilder.sendGameAction(this.ws, gameType, action);
  },
};

const gameModuleLoaders: Record<string, () => Promise<unknown>> = {
  connectFour: () => import('./connect-four.js'),
  marbleRace: () => import('./marble-race.js'),
  tiltPong: () => import('./tilt-pong.js'),
  arenaBumpers: () => import('./arena-bumpers.js'),
  frogger: () => import('./frogger.js'),
  ticTacToe: () => import('./tic-tac-toe.js'),
  rockPaperScissors: () => import('./rock-paper-scissors.js'),
  lightcycle: () => import('./lightcycle.js'),
};

window.startGame = async (gameId: string): Promise<void> => {
  let gameEntry: Game | undefined = window.games?.[gameId];

  if (!gameEntry) {
    const loader = gameModuleLoaders[gameId];
    if (!loader) {
      console.warn('Unknown game id:', gameId);
      return;
    }
    await loader();
    gameEntry = window.games?.[gameId];
  }

  if (!gameEntry) {
    console.warn('Game not registered after loading module:', gameId);
    return;
  }

  if (!gameEntry.canPlay()) {
    alert('Not enough players to start this game.');
    return;
  }

  gameEntry.start();
};

// Default handlers
game.handlePlayersChanged = function (players: string[]): void {
  console.log('Players changed: ', players);
  game.players = players;

  const games = window.games ?? {};
  for (const [gameName, { canPlay }] of Object.entries(games)) {
    if (typeof canPlay === 'function' && !canPlay()) {
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
if (!window.games) {
  window.games = {};
}

connection.connect('/ws/');
game.ws = connection.getWebSocket();

// Check URL for room parameter on initial load
const urlParams = new URLSearchParams(window.location.search);
const roomParam = urlParams.get('room');

// Try to rejoin the last room on reload/reconnect, or join room from URL
const persisted = connection.getPersistedState();
const roomToJoin = roomParam || persisted?.lastRoom;
if (roomToJoin) {
  // wait a tick so the socket has a chance to open
  window.setTimeout(() => {
    joinRoom(roomToJoin);
  }, 200);
}

connection.addMessageListener((message: ServerMessage) => {
  handleServerMessage(message);
});

function handleServerMessage(message: ServerMessage): void {
  switch (message.type) {
    case 'connected':
      console.log('Connected to server with client ID:', message.data.clientId);
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
    case 'joinedRoom': {
      const normalized = normalizeJoinedRoomData(
        message.data as {
          room?: string;
          roomName?: string;
          clients?: string[];
        },
      );

      if (!normalized) {
        console.warn('joinedRoom message missing room name', message.data);
        break;
      }

      handleJoinedRoom(normalized.room, normalized.clients);
      break;
    }
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
      console.warn('Unknown message type:', (message as { type: string }).type);
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
  MessageBuilder.sendJoinRoom(connection.getWebSocket(), roomName);
}

function handleJoinedRoom(roomName: string, clients: string[]): void {
  game.state.currentRoom = roomName;
  connection.setLastRoom(roomName);
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
  updateQRCode(roomName);
}

function updateQRCode(roomName: string): void {
  const qrContainer = document.getElementById('qr-container');
  const qrCodeDiv = document.getElementById('qr-code');
  const shareUrlEl = document.getElementById('share-url');

  if (!qrContainer || !qrCodeDiv || !shareUrlEl) return;

  // Build the shareable URL
  const shareUrl = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(roomName)}`;

  // Show the container
  qrContainer.style.display = 'block';

  // Clear any existing QR code
  qrCodeDiv.innerHTML = '';

  // Generate new QR code
  if (window.QRCode) {
    new window.QRCode(qrCodeDiv, {
      text: shareUrl,
      width: 200,
      height: 200,
    });
  }

  // Update the URL text
  shareUrlEl.textContent = shareUrl;
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

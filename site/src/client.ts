import type {
  GameFramework,
  GameRegistry,
  ServerMessage,
  Game,
  PlayerInfo,
} from './types.js';
import * as MessageBuilder from './message-builder.js';
import { ConnectionManager } from './connection-manager.js';
import { normalizeJoinedRoomData } from './shared/protocol-helpers.js';
import {
  handleNameUpdated,
  updatePlayerNameDisplay,
  initializeNameInput,
} from './name-manager.js';

declare global {
  interface Window {
    game: GameFramework;
    games: GameRegistry;
    startGame: (gameId: string, broadcastToOthers?: boolean) => Promise<void>;
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
    playerName: null,
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

  updateName(name: string): void {
    MessageBuilder.sendUpdateName(this.ws, name);
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
  // Hidden test game, only started via ?game=e2eTest
  e2eTest: () => import('./e2e-test-game.js'),
};

window.startGame = async (
  gameId: string,
  broadcastToOthers = true,
): Promise<void> => {
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

  game.currentGame = gameId;
  gameEntry.start();

  // Update QR code to include the game parameter
  if (game.state.currentRoom) {
    updateQRCode(game.state.currentRoom);
  }

  // Broadcast to other players so they also start the game
  if (broadcastToOthers) {
    game.sendMessage('startGame', gameId);
  }
};

// Default handlers
export function defaultHandlePlayersChanged(players: PlayerInfo[]): void {
  console.log('Players changed: ', players);
  game.players = players;

  const games = window.games ?? {};
  for (const [gameName, { canPlay }] of Object.entries(games)) {
    if (typeof canPlay === 'function' && !canPlay()) {
      console.log('Cannot play game:', gameName);
      // Future: Auto-stop games when player count is insufficient
    }
  }

  updateGamesList();
}

game.handlePlayersChanged = defaultHandlePlayersChanged;

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

// Check URL for room and game parameters on initial load
const urlParams = new URLSearchParams(window.location.search);
const roomParam = urlParams.get('room');
const gameParam = urlParams.get('game');

// Try to rejoin the last room on reload/reconnect, or join room from URL
const persisted = connection.getPersistedState();
const roomToJoin = roomParam || persisted?.lastRoom;
if (roomToJoin) {
  // wait a tick so the socket has a chance to open
  window.setTimeout(() => {
    joinRoom(roomToJoin);

    // If there's a game parameter, auto-start it after joining
    if (gameParam) {
      window.setTimeout(() => {
        window.startGame(gameParam);
      }, 500);
    }
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
      game.state.playerName = message.data.name;
      updatePlayerNameDisplay(game);
      break;
    case 'roomsList':
      // message.data is Array<{ name: string; clients: Array<{ id: string; name: string }> }>
      handleRoomsList(message.data);
      // Update the client list if we are in a room
      if (game.state.currentRoom) {
        const room = message.data.find(
          (room: {
            name: string;
            clients: Array<{ id: string; name: string }>;
          }) => room.name === game.state.currentRoom,
        );
        if (room && game.handlePlayersChanged) {
          game.handlePlayersChanged(
            room.clients.sort((a, b) => a.id.localeCompare(b.id)),
          );
        }
      }
      break;
    case 'joinedRoom': {
      const normalized = normalizeJoinedRoomData(message.data);

      if (!normalized) {
        console.warn('joinedRoom message missing room name', message.data);
        break;
      }

      handleJoinedRoom(normalized.room, normalized.clients);
      break;
    }
    case 'newClient':
      handleNewClient(message.data.clientId, message.data.name);
      if (game.handlePlayersChanged) {
        game.handlePlayersChanged(
          [
            ...game.players,
            { id: message.data.clientId, name: message.data.name },
          ].sort((a, b) => a.id.localeCompare(b.id)),
        );
      }
      break;
    case 'clientLeft':
      handleClientLeft(message.data.clientId);
      if (game.handlePlayersChanged) {
        game.handlePlayersChanged(
          game.players
            .filter((player) => player.id !== message.data.clientId)
            .sort((a, b) => a.id.localeCompare(b.id)),
        );
      }
      break;
    case 'nameUpdated':
      handleNameUpdated(game, message.data.clientId, message.data.name);
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
      } else if (event === 'startGame') {
        // Start the game for all players in the room
        window.startGame(payload as string, false);
      }
      break;
    }
    case 'gameStateUpdate':
      if (game.onGameStateUpdate) {
        game.onGameStateUpdate(message.data);
      }
      break;
    case 'error':
      console.error('Server error:', message.data.error);
      handleError(message.data.error);
      break;
    default:
      console.warn('Unknown message type:', (message as { type: string }).type);
  }
}

function handleRoomsList(
  rooms: Array<{ name: string; clients: Array<{ id: string; name: string }> }>,
): void {
  const roomList = document.getElementById('roomList');
  if (!roomList) return;

  const currentRoom = game.state.currentRoom;
  roomList.innerHTML = '';
  rooms.forEach(function (room) {
    const li = document.createElement('li');
    li.textContent = room.name;
    li.dataset.roomCount = String(room.clients.length);
    if (currentRoom === room.name) {
      li.classList.add('active');
    }
    li.addEventListener('click', function () {
      joinRoom(room.name);
    });
    roomList.appendChild(li);
  });
}

function joinRoom(roomName: string): void {
  MessageBuilder.sendJoinRoom(connection.getWebSocket(), roomName);
}

function handleJoinedRoom(
  roomName: string,
  clients: Array<{ id: string; name: string }>,
): void {
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

  // Initialize game.players with the current clients in the room
  if (game.handlePlayersChanged) {
    game.handlePlayersChanged(
      clients
        .map((c) => ({ id: c.id, name: c.name }))
        .sort((a, b) => a.id.localeCompare(b.id)),
    );
  }
}

function updateQRCode(roomName: string): void {
  const qrContainer = document.getElementById('qr-container');
  const qrCodeDiv = document.getElementById('qr-code');
  const shareUrlEl = document.getElementById('share-url');

  if (!qrContainer || !qrCodeDiv || !shareUrlEl) return;

  // Build the shareable URL with room and optional game
  const params = new URLSearchParams();
  params.set('room', roomName);

  // Add current game if one is active
  if (game.currentGame) {
    params.set('game', game.currentGame);
  }

  const shareUrl = `${window.location.origin}${window.location.pathname}?${params.toString()}`;

  // Show the container
  qrContainer.style.display = 'block';

  // Clear any existing QR code
  qrCodeDiv.innerHTML = '';

  // Generate new QR code (smaller size)
  if (window.QRCode) {
    new window.QRCode(qrCodeDiv, {
      text: shareUrl,
      width: 128,
      height: 128,
    });
  }

  // Update the URL text
  shareUrlEl.textContent = shareUrl;

  // Setup share buttons
  setupShareButtons(shareUrl);
}

function setupShareButtons(shareUrl: string): void {
  const shareButton = document.getElementById('share-button');
  const copyButton = document.getElementById('copy-button');

  if (!shareButton || !copyButton) return;

  // Remove old event listeners by cloning
  const newShareButton = shareButton.cloneNode(true) as HTMLButtonElement;
  const newCopyButton = copyButton.cloneNode(true) as HTMLButtonElement;
  shareButton.parentNode?.replaceChild(newShareButton, shareButton);
  copyButton.parentNode?.replaceChild(newCopyButton, copyButton);

  // Native share button (if Web Share API is available)
  if (navigator.share) {
    newShareButton.addEventListener('click', async () => {
      try {
        await navigator.share({
          title: 'Join my hackbox.tv room',
          text: 'Join my game room on hackbox.tv!',
          url: shareUrl,
        });
      } catch (err) {
        // User cancelled or share failed
        if (err instanceof Error && err.name !== 'AbortError') {
          console.error('Share failed:', err);
        }
      }
    });
  } else {
    // Hide share button if not supported
    newShareButton.style.display = 'none';
  }

  // Copy button
  newCopyButton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      const originalText = newCopyButton.textContent;
      newCopyButton.textContent = 'Copied!';
      setTimeout(() => {
        newCopyButton.textContent = originalText;
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      alert('Failed to copy link');
    }
  });
}

const gameInfo: Record<
  string,
  { name: string; minPlayers: number; maxPlayers?: number }
> = {
  connectFour: { name: 'Connect Four', minPlayers: 2, maxPlayers: 2 },
  marbleRace: { name: 'Marble Race', minPlayers: 2 },
  tiltPong: { name: 'Tilt Pong', minPlayers: 2 },
  arenaBumpers: { name: 'Arena Bumpers', minPlayers: 2 },
  frogger: { name: 'Frogger', minPlayers: 1 },
  ticTacToe: { name: 'Tic-Tac-Toe', minPlayers: 2, maxPlayers: 2 },
  rockPaperScissors: { name: 'Rock Paper Scissors', minPlayers: 2 },
  lightcycle: { name: 'Lightcycles', minPlayers: 2 },
};

function updateGamesList(): void {
  const gameListEl = document.getElementById('game-list');
  if (!gameListEl) return;

  gameListEl.innerHTML = '';

  const games = window.games ?? {};
  const playerCount = game.players.length;

  Object.entries(gameInfo).forEach(([gameId, info]) => {
    const gameEntry = games[gameId];
    const canPlay =
      gameEntry && typeof gameEntry.canPlay === 'function'
        ? gameEntry.canPlay()
        : playerCount >= info.minPlayers;

    const item = document.createElement('div');
    item.className = 'game-item';

    if (canPlay) {
      item.classList.add('ready');
    } else {
      item.classList.add('disabled');
    }

    const nameSpan = document.createElement('span');
    nameSpan.className = 'game-name';
    nameSpan.textContent = info.name;

    const playersSpan = document.createElement('span');
    playersSpan.className = 'game-players';

    if (canPlay) {
      playersSpan.classList.add('ready');
      playersSpan.textContent = '✓ Ready';
    } else {
      playersSpan.classList.add('waiting');
      const needed = info.minPlayers - playerCount;
      if (needed === 1) {
        playersSpan.textContent = `Need ${needed} more`;
      } else {
        playersSpan.textContent = `Need ${needed} more`;
      }
    }

    item.appendChild(nameSpan);
    item.appendChild(playersSpan);

    if (canPlay) {
      item.addEventListener('click', () => {
        window.startGame(gameId);
      });
    }

    gameListEl.appendChild(item);
  });
}

function handleNewClient(clientId: string, clientName: string): void {
  addClientToList(clientId, clientName);
  addSystemMessage('Client ' + clientName + ' has joined the room.');
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

function addClientToList(clientId: string, clientName?: string): void {
  const clientList = document.getElementById('clientList');
  if (!clientList) return;

  const li = document.createElement('li');
  li.textContent = clientName || clientId;
  li.id = 'client-' + clientId;
  clientList.appendChild(li);
}

function removeClientFromList(clientId: string): void {
  const clientLi = document.getElementById('client-' + clientId);
  if (clientLi && clientLi.parentNode) {
    clientLi.parentNode.removeChild(clientLi);
  }
}

function updateClientList(clients: Array<{ id: string; name: string }>): void {
  const clientList = document.getElementById('clientList');
  if (!clientList) return;

  clientList.innerHTML = '';
  clients.forEach(function (client) {
    addClientToList(client.id, client.name);
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

// Initialize name input functionality
initializeNameInput(game);

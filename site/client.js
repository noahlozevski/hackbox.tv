const game = {
  /**
   * Client IDs of all players in the room
   * @type {string[]}
   */
  players: [],
  /**
   * The current game being played
   * @type {string}
   */
  currentGame: null,
  /**
   * The current state of the game. This can be mutated to hold anything you want.
   * @type {object}
   */
  state: {
    /**
     * The ID of the current player. This is set by the server when the player joins a room
     * @type {string}
     */
    playerId: null,
  },
  /** @type {WebSocket | null} */
  ws: null,

  /**
   * Handles a change in the list of players in the room
   * @param {string[]} players - The new list of players
   * @returns {void}
   */
  handlePlayersChanged: function(players) {
    console.log('Players changed: ', players);
    game.players = players;

    for (const [gameName, { start, stop, canPlay }] of Object.entries(
      window.games,
    )) {
      if (!canPlay(players.length)) {
        console.log('Stopping game:', gameName);
        // // kill the game
        // if (gameName === game.currentGame) {
        //   stop();
        //   gameName.currentGame = null;
        // }
      }
    }
  },

  /**
   * Sends a message to all the other players in the room
   * @param {string} event - the event type to send
   * @param {string} message - The payload to send
   */
  sendMessage: function(event, payload) {
    game.ws.send(
      JSON.stringify({
        type: 'message',
        data: {
          message: {
            event,
            payload,
          },
        },
      }),
    );
  },
  /**
   * Handles a message from the server
   * @param {string} player - The player id that send this message
   * @param {string} event - The event type
   * @param {any} payload - The payload of the message. A JSON object
   */
  onMessage: function(player, event, payload) {
    console.log(`Received event [${event}] from player ${player}:`, payload);
  },
};
window.game = game;

const ws = new WebSocket('wss://hackbox.tv.lozev.ski/ws/');
game.ws = ws;

game.state.currentRoom = null;

ws.addEventListener('open', function(event) {
  console.log('Connected to WebSocket server.');
});

ws.addEventListener('message', function(event) {
  console.log('Message from server:', event.data);
  handleServerMessage(event.data);
});

ws.addEventListener('close', function(event) {
  console.log('WebSocket connection closed.');
});

ws.addEventListener('error', function(event) {
  console.error('WebSocket error:', event);
});

function handleServerMessage(data) {
  try {
    const message = JSON.parse(data);
    switch (message.type) {
      case 'connected':
        console.log(
          'Connected to server with client ID:',
          message.data.clientId,
        );
        game.state.playerId = message.data.clientId;
        break;
      case 'roomsList':
        handleRoomsList(message.data);
        // update the client list if we are in a room
        if (game.state.currentRoom) {
          const room = message.data.find(
            (room) => room.name === game.state.currentRoom,
          );
          if (room) {
            game.handlePlayersChanged(room.clients.sort());
          }
        }
        break;
      case 'joinedRoom':
        handleJoinedRoom(message.data);
        break;
      case 'newClient':
        handleNewClient(message.data);
        game.handlePlayersChanged(
          [...game.players, message.data.clientId].sort(),
        );
        break;
      case 'clientLeft':
        handleClientLeft(message.data);
        game.handlePlayersChanged(
          game.players
            .filter((player) => player !== message.data.clientId)
            .sort(),
        );
        break;
      case 'message':
        const clientId = message.data.clientId;
        const event = message.data.message.event;
        const payload = message.data.message.payload;
        game.onMessage(clientId, event, payload);
        if (event === 'chat') {
          handleChatMessage(clientId, payload);
        }
        break;
      case 'error':
        handleError(message.data);
        break;
      default:
        console.warn('Unknown message type:', message.type);
    }
  } catch (error) {
    console.error('Error parsing message from server:', error);
  }
}

/**
 * Handles the list of rooms received from the server
 * @param {Array<{ name: string; clients: string[]; }>} data - List of rooms
 */
function handleRoomsList(data) {
  const roomList = document.getElementById('roomList');
  roomList.innerHTML = ''; // Clear existing rooms
  data.forEach(function(room) {
    const li = document.createElement('li');
    li.textContent = room.name;
    li.addEventListener('click', function() {
      joinRoom(room.name);
    });
    roomList.appendChild(li);
    // If we are in this room, update client list
    if (room.name === game.state.currentRoom) {
      updateClientList(room.clients);
    }
  });
}

function joinRoom(roomName) {
  const message = {
    type: 'joinRoom',
    data: {
      roomName: roomName,
    },
  };
  ws.send(JSON.stringify(message));
}

function handleJoinedRoom(data) {
  game.state.currentRoom = data.roomName;
  document.getElementById('roomName').textContent =
    'Room: ' + game.state.currentRoom;
  document.getElementById('messageInput').disabled = false;
  document.getElementById('sendButton').disabled = false;
  document.getElementById('messages').innerHTML = '';
  document.getElementById('clientList').innerHTML = '';
}

function handleNewClient(data) {
  const clientId = data.clientId;
  addClientToList(clientId);
  addSystemMessage('Client ' + clientId + ' has joined the room.');
}

function handleClientLeft(data) {
  const clientId = data.clientId;
  removeClientFromList(clientId);
  addSystemMessage('Client ' + clientId + ' has left the room.');
}

function handleChatMessage(clientId, message) {
  addChatMessage(clientId, message);
}

function handleError(data) {
  const message = data.message;
  alert('Error: ' + message);
}

function addClientToList(clientId) {
  const clientList = document.getElementById('clientList');
  const li = document.createElement('li');
  li.textContent = clientId;
  li.id = 'client-' + clientId;
  clientList.appendChild(li);
}

function removeClientFromList(clientId) {
  const clientLi = document.getElementById('client-' + clientId);
  if (clientLi) {
    clientLi.parentNode.removeChild(clientLi);
  }
}

/**
 * Updates the list of clients in the room
 * @param {string[]} clients - List of client IDs
 */
function updateClientList(clients) {
  const clientList = document.getElementById('clientList');
  clientList.innerHTML = ''; // Clear existing clients
  clients.forEach(function(clientId) {
    addClientToList(clientId);
  });
}

function addChatMessage(clientId, message) {
  const messagesDiv = document.getElementById('messages');
  const messageElement = document.createElement('div');
  messageElement.innerHTML = '<strong>' + clientId + ':</strong> ' + message;
  messagesDiv.appendChild(messageElement);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function addSystemMessage(message) {
  const messagesDiv = document.getElementById('messages');
  const messageElement = document.createElement('div');
  messageElement.style.fontStyle = 'italic';
  messageElement.textContent = message;
  messagesDiv.appendChild(messageElement);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');

sendButton.addEventListener('click', () => {
  const message = messageInput.value.trim();
  if (message == '') {
    return;
  }
  game.sendMessage('chat', message);
  addChatMessage('You', message);
  messageInput.value = '';
});
messageInput.addEventListener('keyup', function(event) {
  if (event.key === 'Enter') {
    const message = messageInput.value.trim();
    if (message == '') {
      return;
    }
    game.sendMessage('chat', message);
    addChatMessage('You', message);
    messageInput.value = '';
  }
});

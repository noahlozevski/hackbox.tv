/**
 * Name management functionality for players
 */

import type { GameFramework } from './types.js';

export function handleNameUpdated(
  game: GameFramework,
  clientId: string,
  name: string,
): void {
  // Update in player list
  const playerIndex = game.players.findIndex((p) => p.id === clientId);
  if (playerIndex !== -1) {
    game.players[playerIndex].name = name;
  }

  // Update UI
  if (clientId === game.state.playerId) {
    game.state.playerName = name;
    updatePlayerNameDisplay(game);
  }

  // Update client list display
  const clientLi = document.getElementById('client-' + clientId);
  if (clientLi) {
    clientLi.textContent = name;
  }

  // Trigger players changed callback
  if (game.handlePlayersChanged) {
    game.handlePlayersChanged([...game.players]);
  }
}

export function updatePlayerNameDisplay(game: GameFramework): void {
  const nameDisplay = document.getElementById('playerNameDisplay');
  if (nameDisplay && game.state.playerName) {
    nameDisplay.textContent = game.state.playerName;
  }

  const nameInput = document.getElementById(
    'playerNameInput',
  ) as HTMLInputElement;
  if (nameInput && game.state.playerName) {
    nameInput.value = game.state.playerName;
  }
}

export function initializeNameInput(game: GameFramework): void {
  let nameUpdateTimeout: ReturnType<typeof setTimeout> | null = null;

  const playerNameInput = document.getElementById(
    'playerNameInput',
  ) as HTMLInputElement;
  if (!playerNameInput) return;

  const debouncedUpdateName = () => {
    if (nameUpdateTimeout) {
      clearTimeout(nameUpdateTimeout);
    }
    nameUpdateTimeout = setTimeout(() => {
      const newName = playerNameInput.value.trim();
      if (newName && newName !== game.state.playerName) {
        game.updateName(newName);
        localStorage.setItem('playerName', newName);
      }
    }, 500);
  };

  playerNameInput.addEventListener('input', debouncedUpdateName);

  playerNameInput.addEventListener('blur', () => {
    if (nameUpdateTimeout) {
      clearTimeout(nameUpdateTimeout);
    }
    const newName = playerNameInput.value.trim();
    if (newName && newName !== game.state.playerName) {
      game.updateName(newName);
      localStorage.setItem('playerName', newName);
    }
  });

  // Load saved name from localStorage
  const savedName = localStorage.getItem('playerName');
  if (savedName) {
    playerNameInput.value = savedName;
    setTimeout(() => {
      if (game.ws && game.ws.readyState === WebSocket.OPEN) {
        game.updateName(savedName);
      }
    }, 300);
  }
}

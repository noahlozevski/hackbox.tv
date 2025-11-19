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
  const nameInput = document.getElementById(
    'playerNameInput',
  ) as HTMLInputElement;

  const playerId = game.state.playerId;
  const currentName = game.state.playerName ?? '';
  const defaultName = playerId ? `Player ${playerId.slice(0, 4)}` : '';
  const isDefaultName = !currentName || currentName === defaultName;

  if (nameDisplay) {
    nameDisplay.textContent = isDefaultName ? '' : currentName;
  }

  // Only overwrite the input when we have an explicit, non-default name.
  if (nameInput && !isDefaultName && currentName) {
    nameInput.value = currentName;
  }
}

export function initializeNameInput(game: GameFramework): void {
  const playerNameInput = document.getElementById(
    'playerNameInput',
  ) as HTMLInputElement;
  const saveButton = document.getElementById(
    'playerNameSaveButton',
  ) as HTMLButtonElement | null;
  if (!playerNameInput || !saveButton) return;

  saveButton.addEventListener('click', () => {
    const newName = playerNameInput.value.trim();

    if (!newName) {
      // Clear any saved custom name and ask the server to reset to default.
      localStorage.removeItem('playerName');
      game.updateName('');
      return;
    }

    if (newName !== game.state.playerName) {
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

import type { Game } from './types.js';

export function registerGame(name: string, game: Game): void {
  if (!window.games) {
    window.games = {};
  }

  window.games[name] = game;
}


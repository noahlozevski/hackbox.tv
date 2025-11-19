/**
 * Player utility functions for working with PlayerInfo objects
 * Single source of truth for player comparisons and lookups
 */

import type { PlayerInfo } from './types.js';

/**
 * Get player IDs from PlayerInfo array
 */
export function getPlayerIds(players: PlayerInfo[]): string[] {
  return players.map((p) => p.id);
}

/**
 * Find player by ID
 */
export function findPlayerById(
  players: PlayerInfo[],
  id: string | null,
): PlayerInfo | undefined {
  if (!id) return undefined;
  return players.find((p) => p.id === id);
}

/**
 * Get player index by ID
 */
export function getPlayerIndex(
  players: PlayerInfo[],
  id: string | null,
): number {
  if (!id) return -1;
  return players.findIndex((p) => p.id === id);
}

/**
 * Check if player ID exists in list
 */
export function hasPlayer(players: PlayerInfo[], id: string | null): boolean {
  if (!id) return false;
  return players.some((p) => p.id === id);
}

/**
 * Get player name by ID, falls back to ID if not found
 */
export function getPlayerName(
  players: PlayerInfo[],
  id: string | null,
): string {
  if (!id) return 'Unknown';
  const player = findPlayerById(players, id);
  return player?.name || id;
}

/**
 * Compare if two player references are the same
 */
export function isSamePlayer(
  player1: PlayerInfo | string | null,
  player2: PlayerInfo | string | null,
): boolean {
  if (!player1 || !player2) return player1 === player2;

  const id1 = typeof player1 === 'string' ? player1 : player1.id;
  const id2 = typeof player2 === 'string' ? player2 : player2.id;

  return id1 === id2;
}

/**
 * Get first player's ID (useful for determining host/first player)
 */
export function getFirstPlayerId(players: PlayerInfo[]): string | null {
  return players[0]?.id || null;
}

/**
 * Get next player ID in rotation
 */
export function getNextPlayerId(
  players: PlayerInfo[],
  currentId: string,
): string | null {
  const index = getPlayerIndex(players, currentId);
  if (index === -1) return getFirstPlayerId(players);
  return players[(index + 1) % players.length]?.id || null;
}

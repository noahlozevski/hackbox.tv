import { Client } from './client';
import * as MessageBuilder from './message-builder';

export class Room {
  public name: string;
  public clients: Set<Client>;
  public activeGame: string | null;
  public gameState: unknown;
  public gameTimeout: number | null; // Timestamp when game session expires
  private gameTimeoutHandle: NodeJS.Timeout | null;

  constructor(name: string) {
    this.name = name;
    this.clients = new Set();
    this.activeGame = null;
    this.gameState = null;
    this.gameTimeout = null;
    this.gameTimeoutHandle = null;
  }

  clearGameState(): void {
    this.activeGame = null;
    this.gameState = null;
    this.gameTimeout = null;
    if (this.gameTimeoutHandle) {
      clearTimeout(this.gameTimeoutHandle);
      this.gameTimeoutHandle = null;
    }
  }

  setGameTimeout(callback: () => void, timeoutMs: number): void {
    if (this.gameTimeoutHandle) {
      clearTimeout(this.gameTimeoutHandle);
    }
    this.gameTimeout = Date.now() + timeoutMs;
    this.gameTimeoutHandle = setTimeout(callback, timeoutMs);
  }

  addClient(client: Client) {
    this.clients.add(client);
    client.room = this;
  }

  removeClient(client: Client) {
    const wasDeleted = this.clients.delete(client);
    if (!wasDeleted) {
      return;
    }

    client.room = null;
    MessageBuilder.broadcastClientLeft(this, client.id);
  }

  getClientList(): Array<{ id: string; name: string }> {
    return Array.from(this.clients).map((client) => ({
      id: client.id,
      name: client.name,
    }));
  }
}

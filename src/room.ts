import { Client } from './client';
import * as MessageBuilder from './message-builder';

export class Room {
  public name: string;
  public clients: Set<Client>;
  public activeGame: string | null;

  constructor(name: string) {
    this.name = name;
    this.clients = new Set();
    this.activeGame = null;
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

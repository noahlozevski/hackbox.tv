import { Client } from './client';

export class Room {
  public name: string;
  public clients: Set<Client>;

  constructor(name: string) {
    this.name = name;
    this.clients = new Set();
  }

  addClient(client: Client) {
    this.clients.add(client);
    client.room = this;
  }

  removeClient(client: Client) {
    this.clients.delete(client);
    client.room = null;
  }

  getClientList(): string[] {
    return Array.from(this.clients).map((client) => client.id);
  }
}

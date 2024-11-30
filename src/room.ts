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
    const wasDeleted = this.clients.delete(client);
    if (!wasDeleted) {
      return;
    }

    client.room = null;
    this.#broadcast(
      JSON.stringify({
        type: 'clientLeft',
        data: {
          clientId: client.id,
        },
      }),
    );
  }

  getClientList(): string[] {
    return Array.from(this.clients).map((client) => client.id);
  }

  /** broadcast a message to all clients in the room */
  #broadcast(message: string, sender?: Client) {
    this.clients.forEach((client) => {
      if (client !== sender) {
        client.ws.send(message);
      }
    });
  }
}

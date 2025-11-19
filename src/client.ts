import crypto from 'crypto';
import { Room } from './room';
import { WS } from './types';

export class Client {
  public id: string;
  public name: string;
  public ws: WS;
  public room: Room | null;

  constructor(ws: WS, name?: string) {
    this.id = crypto.randomUUID();
    this.name = name || `Player ${this.id.slice(0, 4)}`;
    this.ws = ws;
    this.room = null;

    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });
  }
}

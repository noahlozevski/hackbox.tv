import { Room } from './room';
import { WS } from './types';

export class Client {
  public id: string;
  public ws: WS;
  public room: Room | null;

  constructor(ws: WS) {
    this.id = crypto.randomUUID();
    this.ws = ws;
    this.room = null;

    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });
  }
}

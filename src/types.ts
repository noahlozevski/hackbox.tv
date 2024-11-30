import WebSocket from 'ws';

export type WS = {
  isAlive: boolean;
} & WebSocket;

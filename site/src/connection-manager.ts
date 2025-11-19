import type { ServerMessage } from './types.js';

type MessageListener = (message: ServerMessage) => void;

export class ConnectionManager {
  private ws: WebSocket | null = null;
  private readonly listeners = new Set<MessageListener>();

  connect(path = '/ws/'): void {
    const url = this.buildWebSocketUrl(path);
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.addEventListener('open', () => {
      console.log('Connected to WebSocket server.', url);
    });

    ws.addEventListener('message', (event) => {
      console.log('Message from server:', event.data);
      this.handleRawMessage(event.data);
    });

    ws.addEventListener('close', () => {
      console.log('WebSocket connection closed.');
    });

    ws.addEventListener('error', (event) => {
      console.error('WebSocket error:', event);
    });
  }

  getWebSocket(): WebSocket | null {
    return this.ws;
  }

  send(data: unknown): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('WebSocket not connected');
      return;
    }
    this.ws.send(JSON.stringify(data));
  }

  addMessageListener(listener: MessageListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private handleRawMessage(raw: string): void {
    try {
      const message = JSON.parse(raw) as ServerMessage;
      for (const listener of this.listeners) {
        listener(message);
      }
    } catch (error) {
      console.error('Error parsing message from server:', error);
    }
  }

  private buildWebSocketUrl(path: string): string {
    if (path.startsWith('ws://') || path.startsWith('wss://')) {
      return path;
    }

    const { protocol, host } = window.location;
    const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:';
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;

    return `${wsProtocol}//${host}${normalizedPath}`;
  }
}


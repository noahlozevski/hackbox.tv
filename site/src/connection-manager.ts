import type { ServerMessage } from './types.js';

type MessageListener = (message: ServerMessage) => void;

const STORAGE_KEY = 'hackbox.connection';

interface PersistedConnectionState {
  lastConnectedAt: number;
  lastRoom: string | null;
}

export class ConnectionManager {
  private ws: WebSocket | null = null;
  private readonly listeners = new Set<MessageListener>();
  private reconnectAttempts = 0;
  private readonly maxReconnectDelayMs = 10_000;
  private readonly baseReconnectDelayMs = 500;
  private path: string = '/ws/';

  connect(path = '/ws/'): void {
    this.path = path;
    this.openWebSocket();
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

  getPersistedState(): PersistedConnectionState | null {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as PersistedConnectionState;
    } catch {
      return null;
    }
  }

  setLastRoom(room: string | null): void {
    const existing = this.getPersistedState();
    const state: PersistedConnectionState = {
      lastConnectedAt: existing?.lastConnectedAt ?? Date.now(),
      lastRoom: room,
    };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore storage errors
    }
  }

  private openWebSocket(): void {
    const url = this.buildWebSocketUrl(this.path);
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.addEventListener('open', () => {
      console.log('Connected to WebSocket server.', url);
      this.reconnectAttempts = 0;
      this.persistConnectionMetadata();
    });

    ws.addEventListener('message', (event) => {
      console.log('Message from server:', event.data);
      this.handleRawMessage(event.data);
    });

    ws.addEventListener('close', () => {
      console.log('WebSocket connection closed.');
      this.scheduleReconnect();
    });

    ws.addEventListener('error', (event) => {
      console.error('WebSocket error:', event);
    });
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

  private scheduleReconnect(): void {
    this.reconnectAttempts += 1;
    const delay = Math.min(
      this.maxReconnectDelayMs,
      this.baseReconnectDelayMs * this.reconnectAttempts,
    );
    console.log(
      `Reconnecting WebSocket in ${delay}ms (attempt ${this.reconnectAttempts})`,
    );
    window.setTimeout(() => this.openWebSocket(), delay);
  }

  private persistConnectionMetadata(): void {
    const existing = this.getPersistedState();
    const state: PersistedConnectionState = {
      lastConnectedAt: Date.now(),
      lastRoom: existing?.lastRoom ?? null,
    };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore storage errors
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

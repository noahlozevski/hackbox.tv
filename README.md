# hackbox.tv

A real-time multiplayer game platform with WebSocket-based multiplayer framework.

> Mobile-first: the games and UI are optimized for mobile devices and are expected to be used on phones. Frogger now ships with on-screen touch controls plus responsive canvas sizing—verify on an actual phone after any change.

## 🚨 CODE HYGIENE POLICY 🚨

**ZERO TOLERANCE FOR CODE DEBT**

1. **NO versioned files** - Never create `file-v2.ts`, `file-old.js`, `file.bak`
2. **NO deprecated code** - Delete immediately, don't comment out
3. **NO orphaned files** - If you replace a file, DELETE the old one
4. **Replace, don't duplicate** - Update existing files in place
5. **Clean as you go** - Leave no trace of old implementations

**Before every commit:** Run `git status` and delete any orphaned files.

---

## 🚨 IMPORTANT: Deployment Policy 🚨

**ALWAYS DEPLOY AFTER PUSHING TO GIT!**

Whenever you push changes to the repository, you MUST immediately deploy to the server. The deployment is not automatic!

### Deployment Steps:
```bash
# 1) Build and test locally
npm run lint
npm test
npm run build

# 2) Commit and PUSH your changes
git add .
git commit -m "Your change"
git push

# 3) Only AFTER push, deploy:
./deploy-local.sh

# Otherwise, deploy remotely:
ssh hackbox "cd /home/noahlozevski/app && git pull && ./deploy.sh"
```

Or SSH in and deploy manually:
```bash
ssh hackbox
cd /home/noahlozevski/app
git pull
./deploy.sh
```

**Note:** `deploy-local.sh` is gitignored and only exists on the development machine for convenience.

> Important: The deploy scripts always build from the code on the server.
> If you forget to `git push` before running `./deploy-local.sh`, the remote
> build will use the old code and can fail with TypeScript errors even though
> your local build works. Always push first, then deploy.

## Development

### Build System

This project uses TypeScript for both server and client code:

```bash
# Build everything (server + client)
npm run build

# Build server only
npm run build:server

# Build client only
npm run build:client

# Run locally
npm run dev

# Run tests
npm test

# Run opt-in E2E test against production WebSocket
npm run test:e2e   # uses HACKBOX_E2E=1 and hits wss://hackbox.tv.lozev.ski/ws/

# Run tests in watch mode
npm run test:watch

# Run linter
npm run lint
```

### Testing Policy

**Write tests for critical flows!** All major connection/reconnection logic and message handling should have unit tests.

**Focus on:**
- WebSocket connection/reconnection flows
- Message builder utilities (type safety)
- Room management (join/leave/broadcast)
- Game state synchronization
- Client/server message protocol

**Test files location:** `__tests__/` directory (create if needed)

**Example test structure:**
```typescript
// __tests__/message-builder.test.ts
import { sendConnected, broadcastNewClient } from '../src/message-builder';

describe('Message Builder', () => {
  it('should send typed connected message', () => {
    // Test type-safe message construction
  });
});
```

### Project Structure

```
├── src/                    # Server-side TypeScript
│   ├── server.ts          # WebSocket server
│   ├── client.ts          # Client connection handler
│   ├── room.ts            # Room management
│   └── types.ts           # Server types
│
├── site/                   # Client-side code
│   ├── src/               # Client TypeScript source
│   │   ├── types.ts       # Shared client types
│   │   ├── client.ts      # WebSocket client framework
│   │   ├── tic-tac-toe.ts # Tic-tac-toe game
│   │   └── ...            # Other games
│   ├── dist/              # Compiled client JS (gitignored, built on deploy)
│   └── index.html         # Main HTML
│
├── dist/                   # Compiled server JS (gitignored, built on deploy)
├── tsconfig.json          # Server TS config
└── tsconfig.client.json   # Client TS config
```

## Game Development Philosophy

All games on hackbox.tv follow these core principles:

1. **Mobile-First**: Games must work perfectly on phones with touch controls
2. **Single-File Games**: Each game should be self-contained in one TypeScript file (`site/src/game-name.ts`)
3. **Simple & Fast**: Games should be lightweight, load quickly, and have minimal dependencies
4. **Responsive UI**: All UI elements must scale properly on different screen sizes
5. **Touch-Optimized**: On-screen controls for mobile, keyboard support for desktop
6. **Self-Contained Styling**: All game-specific CSS should be injected via the game's own code
7. **Clean Lifecycle**: Implement proper `start()` and `stop()` methods that clean up all resources

## Adding a New Game

1. Create `site/src/your-game.ts` (single file, self-contained)
2. Import types: `import type { Game } from './types.js'`
3. Implement the `Game` interface following the philosophy above:
   ```typescript
   const yourGame: Game = {
     canPlay: () => window.game.players.length === 2,
     start: () => { /* Initialize game, inject styles, setup touch controls */ },
     stop: () => { /* Clean up everything: DOM, listeners, intervals, styles */ }
   };
   window.games.yourGame = yourGame;
   ```
4. Add to `site/index.html`:
   ```html
   <script type="module" src="dist/your-game.js"></script>
   <button onclick="games.yourGame.start()">Your Game</button>
   ```
5. Build and deploy:
   ```bash
   npm run build
   git add .
   git commit -m "Add your game"
   git push
   # DEPLOY NOW! (see above)
   ```
6. **Test on mobile**: Load the site on an actual phone to verify touch controls work

## Multiplayer Framework & State Synchronization

### Two Synchronization Models

hackbox.tv supports two different approaches to multiplayer game state:

#### 1. **Peer-to-Peer (P2P) Model** - For simple games
- Each client runs full game logic independently
- Players broadcast their moves to other players
- All clients execute the same game rules to stay in sync
- **Examples**: Connect Four, Rock Paper Scissors, Frogger, Arena Bumpers

#### 2. **Server-Authoritative Model** - For games requiring validation
- Server is the single source of truth for game state
- Clients send actions to server, receive validated state updates
- Prevents cheating and handles complex game logic
- **Examples**: Tic-Tac-Toe

---

### P2P Game Pattern

**Key APIs:**
```typescript
// Subscribe to messages from other players (returns unsubscribe function)
const unsubscribe = window.game.subscribeToMessages(
  (playerId: string, event: string, payload: unknown) => {
    if (event === 'move') {
      applyMove(playerId, payload);
    }
  }
);

// Send message to all players in room
window.game.sendMessage('move', { row: 1, col: 2 });

// Clean up on game stop
unsubscribe();
```

**Complete P2P Example:**
```typescript
let state: GameState | null = null;
let unsubscribe: (() => void) | null = null;

function start(): void {
  // Initialize local state
  state = initializeState();

  // Subscribe to peer messages
  unsubscribe = window.game.subscribeToMessages(handleMessage);

  renderUI();
}

function handleMessage(playerId: string, event: string, payload: unknown): void {
  if (event === 'move') {
    const move = payload as { row: number; col: number };
    applyMove(playerId, move);
    renderUI();
  }
}

function onPlayerMove(move: Move): void {
  // Apply locally
  applyMove(window.game.state.playerId!, move);

  // Broadcast to peers
  window.game.sendMessage('move', move);
}

function stop(): void {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  state = null;
}
```

---

### Server-Authoritative Game Pattern

**Key APIs:**
```typescript
// Subscribe to game state updates from server (returns unsubscribe function)
const unsubscribe = window.game.subscribeToGameState(
  (data: unknown) => {
    const update = data as { gameType: string; state: YourGameState };
    if (update.gameType === 'your-game') {
      currentState = update.state;
      renderBoard();
    }
  }
);

// Send action to server for validation and state update
window.game.sendGameAction('your-game', {
  type: 'move',
  playerId: window.game.state.playerId,
  move: { row: 1, col: 2 }
});

// Clean up on game stop
unsubscribe();
```

**Complete Server-Authoritative Example:**
```typescript
let currentState: YourGameState | null = null;
let unsubscribe: (() => void) | null = null;

function start(): void {
  // Subscribe to server state updates
  unsubscribe = window.game.subscribeToGameState(handleGameStateUpdate);

  // Request initial state from server
  window.game.sendGameAction('your-game', {
    type: 'restart',
    playerId: window.game.state.playerId
  });

  renderUI();
}

function handleGameStateUpdate(data: unknown): void {
  const update = data as {
    gameType: string;
    state: YourGameState;
    validationError?: string;
  };

  if (update.gameType !== 'your-game') return;

  if (update.validationError) {
    showError(update.validationError);
    return;
  }

  // Server state is now source of truth
  currentState = update.state;
  renderBoard();
}

function onPlayerMove(move: Move): void {
  // Send action to server (don't modify local state)
  window.game.sendGameAction('your-game', {
    type: 'move',
    playerId: window.game.state.playerId,
    move
  });

  // Wait for server to validate and send back updated state
}

function stop(): void {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  currentState = null;
}
```

---

### Subscription Model Benefits

The subscription model provides:

1. **Automatic Cleanup**: Unsubscribe function handles restoration of previous handlers
2. **Composability**: Multiple games can layer subscriptions without conflicts
3. **Type Safety**: TypeScript ensures correct handler signatures
4. **Memory Safety**: Prevents handler leaks when games stop

**❌ OLD WAY (Don't do this):**
```typescript
let previousOnMessage = window.game.onMessage;
window.game.onMessage = handleMessage;
// ... later ...
window.game.onMessage = previousOnMessage;  // Easy to forget or mess up
```

**✅ NEW WAY (Always do this):**
```typescript
const unsubscribe = window.game.subscribeToMessages(handleMessage);
// ... later ...
unsubscribe();  // Simple, safe, guaranteed cleanup
```

---

### Shared Game Framework APIs

All games have access to these framework features:

```typescript
// Player information
window.game.state.playerId      // Your player ID
window.game.players              // Array of all player IDs in room
window.game.state.currentRoom    // Current room name

// Message/State APIs (choose based on your model)
window.game.subscribeToMessages(handler)    // P2P games
window.game.subscribeToGameState(handler)   // Server-authoritative games
window.game.sendMessage(event, payload)     // P2P games
window.game.sendGameAction(gameType, action) // Server-authoritative games

// WebSocket
window.game.ws                   // WebSocket instance

// Dynamic player handling (optional)
window.game.handlePlayersChanged = (players: string[]) => {
  // Called when players join/leave room during gameplay
  updatePlayerList(players);
};
```

---

### Choosing a Synchronization Model

**Use P2P when:**
- Game logic is simple and deterministic
- All players can be trusted (no competitive advantage to cheating)
- Low latency is critical (no server round-trip)
- Examples: Turn-based games, cooperative games, casual games

**Use Server-Authoritative when:**
- Game requires validation (preventing cheating)
- Game has complex state that's hard to keep in sync
- Competitive integrity matters
- Server needs to enforce rules
- Examples: Competitive games, games with scoring, complex rule validation

All messages are multiplexed over a single WebSocket connection with type safety throughout.

# hackbox.tv

A real-time multiplayer game platform with WebSocket-based multiplayer framework.

## 🚨 IMPORTANT: Deployment Policy 🚨

**ALWAYS DEPLOY AFTER PUSHING TO GIT!**

Whenever you push changes to the repository, you MUST immediately deploy to the server. The deployment is not automatic!

### Deployment Steps:
```bash
# After git push, SSH into the server and run:
cd /home/noahlozevski/app
git pull
./deploy.sh
```

Or deploy remotely:
```bash
ssh your-server "cd /home/noahlozevski/app && git pull && ./deploy.sh"
```

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

## Adding a New Game

1. Create `site/src/your-game.ts`
2. Import types: `import type { Game } from './types.js'`
3. Implement the `Game` interface:
   ```typescript
   const yourGame: Game = {
     canPlay: () => window.game.players.length === 2,
     start: () => { /* Initialize game */ },
     stop: () => { /* Cleanup */ }
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

## Multiplayer Framework

Games communicate via a type-safe WebSocket message protocol:

```typescript
// Send a game event
window.game.sendMessage('move', { row: 1, col: 2 });

// Receive game events from other players
window.game.onMessage = (playerId, event, payload) => {
  if (event === 'move') {
    // Handle the move
  }
};
```

All messages are multiplexed over a single WebSocket connection with type safety throughout.
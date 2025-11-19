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
# After git push, if deploy-local.sh exists (local machine only), use it:
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
